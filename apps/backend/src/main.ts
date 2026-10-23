import 'reflect-metadata';
import { HttpAdapterHost, NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { TelemetryService } from './telemetry.js';
import { TelemetryExceptionFilter } from './api-exception-filter.js';
import { readBrowserOrigins } from './local-config.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const origins = readBrowserOrigins();
  if (origins.length) app.enableCors({ origin: origins, methods: ['GET'], credentials: false });
  app.useGlobalFilters(new TelemetryExceptionFilter(app.get(HttpAdapterHost), app.get(TelemetryService)));
  app.enableShutdownHooks();
  await app.listen(3001, '0.0.0.0');
}

bootstrap().catch(() => {
  console.error('API startup failed; check local configuration and service logs');
  process.exitCode = 1;
});
