import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { TelemetryService } from './telemetry.js';

@Catch()
export class TelemetryExceptionFilter extends BaseExceptionFilter {
  constructor(adapter: HttpAdapterHost, private readonly telemetry: TelemetryService) {
    super(adapter.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const status = exception instanceof HttpException ? exception.getStatus() : 500;
    const path = host.switchToHttp().getRequest<{ url?: string }>().url?.split('?')[0];
    if (status >= 500 && path !== '/health/ready' && path !== '/health/live') {
      this.telemetry.exception(exception, 'HTTP_UNEXPECTED_ERROR');
    }
    super.catch(exception, host);
  }
}
