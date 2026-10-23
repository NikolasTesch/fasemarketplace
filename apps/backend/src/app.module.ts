import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { Infrastructure } from './infrastructure.js';
import { TelemetryService } from './telemetry.js';

@Module({ controllers: [HealthController], providers: [Infrastructure,
  { provide: TelemetryService, useFactory: () => new TelemetryService('api') },
] })
export class AppModule {}
