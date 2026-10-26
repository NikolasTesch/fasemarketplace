import { timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { ForbiddenException } from '@nestjs/common';
import type { Request } from 'express';
import type { readAccessConfig } from './config.js';

export function verifiedClientAddress(
  config: Pick<NonNullable<ReturnType<typeof readAccessConfig>>, 'context' | 'apiKey'>,
  request: Pick<Request, 'headers' | 'socket'>,
) {
  if (config.context === 'local') return request.socket.remoteAddress ?? 'unknown';
  const expected = Buffer.from('Bearer ' + (config.apiKey ?? ''));
  const actual = Buffer.from(request.headers.authorization ?? '');
  const ip = request.headers['x-fm-client-ip'];
  if (!config.apiKey || expected.length !== actual.length || !timingSafeEqual(expected, actual) ||
      typeof ip !== 'string' || ip.length > 64 || !isIP(ip)) throw new ForbiddenException('Transporte recusado');
  return isIP(ip) === 4 ? ip : new URL('http://[' + ip + ']').hostname.slice(1, -1).toLowerCase();
}
