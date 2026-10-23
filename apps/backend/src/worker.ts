import 'reflect-metadata';
import { Inject, Injectable, Logger, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { writeFile, rm } from 'node:fs/promises';
import { Infrastructure } from './infrastructure.js';
import { TelemetryService } from './telemetry.js';
import { readLocalConfig } from './local-config.js';

@Injectable()
class WorkerHeartbeat implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(WorkerHeartbeat.name);
  private timer?: ReturnType<typeof setTimeout>;
  private stopped = false;
  private active?: Promise<void>;
  private dependenciesAvailable = false;
  private failedChecks = 0;
  private readonly checkIntervalMs = readLocalConfig().workerCheckIntervalMs;

  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure,
    @Inject(TelemetryService) private readonly telemetry: TelemetryService) {}

  async onModuleInit() {
    await this.tick();
  }

  private tick(): Promise<void> {
    this.active = this.check();
    return this.active;
  }

  private async check() {
    try {
      const state = await this.infrastructure.readiness();
      if (state.status === 'ready') {
        this.dependenciesAvailable = true;
        this.failedChecks = 0;
        await writeFile('/tmp/fasemarketplace-worker-ready', String(Date.now()));
      } else {
        this.recordFailure(undefined, 'DEPENDENCY_UNAVAILABLE');
        await rm('/tmp/fasemarketplace-worker-ready', { force: true });
        this.logger.warn('Worker dependencies unavailable');
      }
    } catch (error) {
      this.recordFailure(error, 'WORKER_HEARTBEAT_FAILED');
      await rm('/tmp/fasemarketplace-worker-ready', { force: true });
      this.logger.error('Worker heartbeat failed');
    } finally {
      // Retry transient startup/recovery races promptly, then back off after
      // three failures so an unavailable remote database is not polled forever.
      const delay = this.failedChecks > 0 && this.failedChecks < 3
        ? Math.min(5000, this.checkIntervalMs) : this.checkIntervalMs;
      if (!this.stopped) this.timer = setTimeout(() => void this.tick(), delay);
    }
  }

  private recordFailure(error: unknown, code: 'DEPENDENCY_UNAVAILABLE' | 'WORKER_HEARTBEAT_FAILED') {
    this.failedChecks++;
    // Initial Redis connection can race the first heartbeat. Report a startup
    // failure only when sustained; subsequent healthy -> failed transitions report immediately.
    if (this.dependenciesAvailable || this.failedChecks === 3) this.telemetry.exception(error, code);
    this.dependenciesAvailable = false;
  }

  async onModuleDestroy() {
    this.stopped = true;
    clearTimeout(this.timer);
    await this.active;
    await rm('/tmp/fasemarketplace-worker-ready', { force: true });
  }
}

@Module({ providers: [Infrastructure, WorkerHeartbeat,
  { provide: TelemetryService, useFactory: () => new TelemetryService('worker') },
] })
class WorkerModule {}

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(WorkerModule);
  app.enableShutdownHooks();
  new Logger('Worker').log('Local bootstrap worker started; no marketplace jobs configured');
}

bootstrap().catch(() => {
  console.error('Worker startup failed; check local configuration and service logs');
  process.exitCode = 1;
});
