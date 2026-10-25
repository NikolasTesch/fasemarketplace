import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import { TelemetryService } from './telemetry.js';

@Catch()
export class TelemetryExceptionFilter extends BaseExceptionFilter {
  constructor(
    adapter: HttpAdapterHost,
    private readonly telemetry: TelemetryService,
  ) {
    super(adapter.httpAdapter);
  }

  catch(exception: unknown, host: ArgumentsHost) {
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const path = host
      .switchToHttp()
      .getRequest<{ url?: string }>()
      .url?.split('?')[0];
    if (path === '/access' || path?.startsWith('/access/')) {
      const known = exception as { status?: number };
      const accessStatus =
        exception instanceof HttpException
          ? status
          : [400, 413, 415].includes(known?.status ?? 0)
            ? known.status!
            : 503;
      const messages: Record<number, string> = {
        400: 'Dados inválidos ou operação recusada',
        401: 'Sessão ou credenciais inválidas',
        403: 'Acesso recusado',
        404: 'Rota não encontrada',
        413: 'Solicitação muito grande',
        415: 'Conteúdo recusado',
        429: 'Aguarde antes de tentar novamente',
      };
      const response = host.switchToHttp().getResponse<{
        status: (code: number) => { json: (body: unknown) => void };
        setHeader: (name: string, value: string) => void;
      }>();
      response.setHeader('cache-control', 'no-store');
      if (accessStatus === 429) response.setHeader('retry-after', '900');
      response.status(accessStatus).json({
        statusCode: accessStatus,
        message:
          messages[accessStatus] ?? 'Acesso temporariamente indisponível',
      });
      return;
    }
    if (status >= 500 && path !== '/health/ready' && path !== '/health/live') {
      this.telemetry.exception(exception, 'HTTP_UNEXPECTED_ERROR');
    }
    super.catch(exception, host);
  }
}
