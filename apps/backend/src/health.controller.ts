import { Controller, Get, Inject, ServiceUnavailableException } from '@nestjs/common';
import { Infrastructure } from './infrastructure.js';

@Controller('health')
export class HealthController {
  constructor(@Inject(Infrastructure) private readonly infrastructure: Infrastructure) {}

  @Get('live')
  live() {
    return { status: 'alive', service: 'api' };
  }

  @Get('ready')
  async ready() {
    const result = await this.infrastructure.readiness();
    if (result.status !== 'ready') throw new ServiceUnavailableException(result);
    return result;
  }
}
