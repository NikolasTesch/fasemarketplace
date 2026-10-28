import { randomUUID } from 'node:crypto';
import { Inject, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { LocalAccessService, type AccessUser } from '../access/service.js';
import { TICKET_IMAGE_STORAGE, type TicketImageStorage } from './image-storage.js';
import type { ValidTicketInput } from './validation.js';
import { parseTicketId, parseTicketOffset } from './validation.js';

const pageSize = 20;

type TicketRow = {
  id: string;
  type: string;
  screen: string;
  title: string;
  description: string;
  status: string;
  authorName: string;
  createdAt: Date | string;
  imageStorageProvider: string | null;
  imageStorageKey: string | null;
  imageMime: string | null;
};

function ticketDto(row: TicketRow) {
  return {
    id: row.id,
    type: row.type,
    screen: row.screen,
    title: row.title,
    description: row.description,
    status: row.status,
    authorName: row.authorName,
    createdAt: new Date(row.createdAt).toISOString(),
    hasImage: row.imageStorageKey !== null,
    imageMime: row.imageMime,
  };
}

@Injectable()
export class TicketService {
  constructor(
    @Inject(LocalAccessService) private readonly access: LocalAccessService,
    @Inject(TICKET_IMAGE_STORAGE) private readonly images: TicketImageStorage,
  ) {}

  async list(offsetQuery: string | undefined) {
    const offset = parseTicketOffset(offsetQuery);
    const [page, count] = await Promise.all([
      this.access.pool.query<TicketRow>(`
        SELECT t.id::text, t.type, t.screen, t.title, t.description, t.status,
          u.name AS "authorName", t.created_at AS "createdAt",
          t.image_storage_provider AS "imageStorageProvider",
          t.image_storage_key AS "imageStorageKey", t.image_mime AS "imageMime"
        FROM support_ticket t
        JOIN auth_user u ON u.id = t.author_id
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT $1 OFFSET $2
      `, [pageSize, offset]),
      this.access.pool.query<{ count: string }>('SELECT count(*) FROM support_ticket'),
    ]);
    return {
      tickets: page.rows.map(ticketDto),
      total: Number(count.rows[0].count),
      offset,
      limit: pageSize,
    };
  }

  async create(actor: AccessUser, ticket: ValidTicketInput) {
    const imageKey = ticket.imageBytes ? `support-ticket/${randomUUID()}` : null;
    const client = await this.access.pool.connect();
    let imageWriteAttempted = false;
    let commitRequested = false;
    try {
      await client.query('BEGIN');
      if (imageKey && ticket.imageBytes && ticket.imageMime) {
        imageWriteAttempted = true;
        await this.images.write(imageKey, ticket.imageBytes, ticket.imageMime, client);
      }
      const result = await client.query<TicketRow>(`
        WITH inserted AS (
          INSERT INTO support_ticket
            (type, screen, title, description, status, author_id,
              image_storage_provider, image_storage_key, image_mime)
          VALUES ($1, $2, $3, $4, 'open', $5, $6, $7, $8)
          RETURNING id, type, screen, title, description, status, author_id, created_at,
            image_storage_provider AS "imageStorageProvider",
            image_storage_key AS "imageStorageKey", image_mime AS "imageMime"
        )
        SELECT i.id::text, i.type, i.screen, i.title, i.description, i.status,
          u.name AS "authorName", i.created_at AS "createdAt", i."imageStorageProvider",
          i."imageStorageKey", i."imageMime"
        FROM inserted i JOIN auth_user u ON u.id = i.author_id
      `, [
        ticket.type,
        ticket.screen,
        ticket.title,
        ticket.description,
        actor.id,
        imageKey ? this.images.provider : null,
        imageKey,
        ticket.imageMime,
      ]);
      commitRequested = true;
      await client.query('COMMIT');
      return ticketDto(result.rows[0]);
    } catch (error) {
      await client.query('ROLLBACK').catch(() => undefined);
      if (imageWriteAttempted && imageKey && !commitRequested)
        await this.images.discard(imageKey).catch(() => undefined);
      throw error;
    } finally {
      client.release();
    }
  }

  async image(idInput: string) {
    const id = parseTicketId(idInput);
    const result = await this.access.pool.query<{
      storageProvider: string | null;
      storageKey: string | null;
      mime: string | null;
    }>(
      'SELECT image_storage_provider AS "storageProvider", image_storage_key AS "storageKey", image_mime AS mime FROM support_ticket WHERE id=$1',
      [id],
    );
    const image = result.rows[0];
    if (!image?.storageKey || !image.mime) throw new NotFoundException('Imagem do chamado não encontrada');
    if (image.storageProvider !== this.images.provider)
      throw new ServiceUnavailableException('O armazenamento desta imagem não está disponível');
    const bytes = await this.images.read(image.storageKey);
    if (!bytes) throw new NotFoundException('Imagem do chamado não encontrada');
    return { bytes, mime: image.mime };
  }
}
