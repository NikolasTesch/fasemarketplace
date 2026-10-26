import { Injectable, Module, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createBusinessClient, assertBusinessRuntime } from './client.js';

@Injectable()
export class BusinessPersistence implements OnModuleInit, OnModuleDestroy {
  readonly client = createBusinessClient();
  async onModuleInit() {
    if (!this.client) throw new Error('Business persistence must be explicitly enabled');
    try { await this.client.$connect(); await assertBusinessRuntime(this.client); }
    catch { await this.client.$disconnect(); throw new Error('Business persistence unavailable or privileges refused'); }
  }
  async onModuleDestroy() { await this.client?.$disconnect(); }
}

@Module({ providers: [BusinessPersistence], exports: [BusinessPersistence] })
export class BusinessPersistenceModule {}
