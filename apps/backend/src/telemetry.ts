import { Logger, OnModuleDestroy } from '@nestjs/common';
import { PostHog } from 'posthog-node';
import type { PostHogOptions } from 'posthog-node';
import { createReporter, filterEvent, resolveTelemetryConfig } from '@fasemarketplace/telemetry';
import type { ErrorCode, Reporter, TelemetryEventName, TelemetryService as ServiceKind } from '@fasemarketplace/telemetry';

type Client = Pick<PostHog, 'capture' | 'captureException' | 'on' | 'shutdown'>;
type ClientFactory = (token: string, options: PostHogOptions) => Client;

export class TelemetryService implements OnModuleDestroy {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly reporter: Reporter;
  private client?: Client;
  private transportFailed = false;

  constructor(service: ServiceKind = 'api', env: NodeJS.ProcessEnv = process.env,
    makeClient: ClientFactory = (token, options) => new PostHog(token, options)) {
    const config = resolveTelemetryConfig({
      mode: env.TELEMETRY_MODE,
      environment: env.TELEMETRY_ENVIRONMENT ?? 'local',
      release: env.APP_RELEASE ?? 'development',
      token: env.POSTHOG_PROJECT_TOKEN,
      host: env.POSTHOG_HOST,
    });
    if (env.APP_ENV === 'local' && config.environment !== 'local') config.mode = 'off';
    if (config.disabledReason) this.logger.warn('Invalid telemetry configuration; collection disabled');

    if (config.mode === 'posthog') {
      try {
        this.client = makeClient(config.token!, {
          host: config.host,
          disableGeoip: true,
          enableExceptionAutocapture: false,
          enableLocalEvaluation: false,
          featureFlagsPollingInterval: null,
          flushAt: 10,
          flushInterval: 5000,
          maxQueueSize: 100,
          requestTimeout: 2000,
          fetchRetryCount: 0,
          before_send: (event) => filterEvent(event, config, service),
        });
        this.client.on('error', () => {
          if (!this.transportFailed) this.logger.warn('Telemetry transport unavailable; application remains operational');
          this.transportFailed = true;
        });
      } catch {
        this.transportFailed = true;
        this.logger.warn('Telemetry initialization failed; application remains operational');
      }
    }

    this.reporter = createReporter(config, service, {
      capture: (event, properties) => {
        if (config.mode === 'console') this.logger.log(JSON.stringify({ event, properties }));
        else if (!this.transportFailed) this.client?.capture({ distinctId: `system-${service}`, event, properties });
      },
      exception: (error, properties) => {
        if (config.mode === 'console') this.logger.log(JSON.stringify({ event: '$exception', properties, stack: error.stack }));
        else if (!this.transportFailed) this.client?.captureException(error, `system-${service}`, properties);
      },
    });
  }

  capture(event: TelemetryEventName, properties?: Record<string, unknown>) {
    this.reporter.capture(event, properties);
  }

  exception(error: unknown, code: ErrorCode) {
    this.reporter.exception(error, code);
  }

  async onModuleDestroy() {
    try { await this.client?.shutdown(1000); } catch { /* Best effort, bounded shutdown. */ }
  }
}
