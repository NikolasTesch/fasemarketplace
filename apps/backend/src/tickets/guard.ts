import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { LocalAccessService, type AccessUser } from '../access/service.js';

export type TicketRequest = Request & { ticketActor?: AccessUser };

@Injectable()
export class TicketAccessGuard implements CanActivate {
  constructor(@Inject(LocalAccessService) private readonly access: LocalAccessService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<TicketRequest>();
    const { user } = await this.access.principal(request, false);
    if (
      request.method === 'POST' &&
      (request.headers.origin !== this.access.config.origin ||
        request.headers['sec-fetch-site'] === 'cross-site')
    ) throw new ForbiddenException('Origem recusada');
    request.ticketActor = user;
    return true;
  }
}
