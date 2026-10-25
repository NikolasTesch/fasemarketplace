import { Module } from '@nestjs/common';
import { readAccessConfig } from './config.js';
import { LocalAccessService } from './service.js';
import { AccessGuard, LocalAccessController } from './controller.js';
if (!readAccessConfig())
  throw new Error('Local access module requires explicit opt-in');
@Module({
  controllers: [LocalAccessController],
  providers: [LocalAccessService, AccessGuard],
})
export class LocalAccessModule {}
