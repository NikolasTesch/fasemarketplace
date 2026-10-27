import { Inject, Injectable } from '@nestjs/common';
import { LocalAccessService } from '../access/service.js';

export type TicketImageMime = 'image/png' | 'image/jpeg' | 'image/webp';

export interface TicketImageWriteTransaction {
  query(sql: string, values?: unknown[]): Promise<unknown>;
}

export interface TicketImageStorage {
  readonly provider: string;
  write(
    key: string,
    bytes: Buffer,
    mime: TicketImageMime,
    transaction: TicketImageWriteTransaction,
  ): Promise<void>;
  read(key: string): Promise<Buffer | null>;
  discard(key: string): Promise<void>;
}

export const TICKET_IMAGE_STORAGE = Symbol('TICKET_IMAGE_STORAGE');

@Injectable()
export class PostgresTicketImageStorage implements TicketImageStorage {
  readonly provider = 'postgres';

  constructor(@Inject(LocalAccessService) private readonly access: LocalAccessService) {}

  async write(
    key: string,
    bytes: Buffer,
    _mime: TicketImageMime,
    transaction: TicketImageWriteTransaction,
  ): Promise<void> {
    await transaction.query(
      'INSERT INTO support_ticket_image (storage_key, image_bytes) VALUES ($1, $2)',
      [key, bytes],
    );
  }

  async read(key: string): Promise<Buffer | null> {
    const result = await this.access.pool.query<{ bytes: Buffer }>(
      'SELECT image_bytes AS bytes FROM support_ticket_image WHERE storage_key=$1',
      [key],
    );
    return result.rows[0]?.bytes ?? null;
  }

  async discard(): Promise<void> {
    // The caller's PostgreSQL transaction removes this write when it rolls back.
  }
}
