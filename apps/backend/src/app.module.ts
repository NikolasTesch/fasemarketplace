import { Module } from '@nestjs/common';
import { HealthController } from './health.controller.js';
import { Infrastructure } from './infrastructure.js';
import { TelemetryService } from './telemetry.js';
import { readAccessConfig } from './access/config.js';
import { readBusinessConfig } from './persistence/config.js';

@Module({
  imports: [...(readAccessConfig()
    ? [import('./access/module.js').then(({ LocalAccessModule }) => ({ module: LocalAccessModule }))]
    : []), ...(readBusinessConfig()
      ? [import('./persistence/module.js').then(({ BusinessPersistenceModule }) => ({ module: BusinessPersistenceModule }))]
      : [])],
  controllers: [HealthController],
  providers: [
    Infrastructure,
    { provide: TelemetryService, useFactory: () => new TelemetryService('api') },
  ],
})
export class AppModule {}
