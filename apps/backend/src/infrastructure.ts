import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { Pool } from 'pg';
import { Redis } from 'ioredis';
import { readLocalConfig } from './local-config.js';

@Injectable()
export class Infrastructure implements OnModuleDestroy {
  private readonly logger = new Logger(Infrastructure.name);
  private readonly config = readLocalConfig();
  private readonly postgres = new Pool({
    connectionString: this.config.databaseUrl,
    connectionTimeoutMillis: this.config.connectionTimeoutMs,
    query_timeout: 2000,
    max: 3,
  });
  private readonly redis = new Redis(this.config.redisUrl, {
    connectTimeout: 2000,
    commandTimeout: 2000,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  constructor() {
    // Never log raw connection errors: drivers may include connection details.
    this.postgres.on('error', () => this.logger.error('PostgreSQL connection unavailable'));
    this.redis.on('error', () => this.logger.error('Redis connection unavailable'));
  }

  async readiness() {
    const [postgres, redis] = await Promise.allSettled([
      this.postgres.query('SELECT 1'), this.redis.ping(),
    ]);
    return {
      status: postgres.status === 'fulfilled' && redis.status === 'fulfilled' ? 'ready' : 'unavailable',
      dependencies: {
        postgres: postgres.status === 'fulfilled',
        redis: redis.status === 'fulfilled',
      },
      marketplaceMode: 'mock',
    };
  }

  async onModuleDestroy() {
    this.redis.disconnect();
    await this.postgres.end();
  }
}
