import { Module } from '@nestjs/common';
import { LocalAccessModule } from '../access/module.js';
import { TicketController } from './controller.js';
import { TicketAccessGuard } from './guard.js';
import { TicketService } from './service.js';
import { PostgresTicketImageStorage, TICKET_IMAGE_STORAGE } from './image-storage.js';

@Module({
  imports: [LocalAccessModule],
  controllers: [TicketController],
  providers: [
    TicketService,
    TicketAccessGuard,
    PostgresTicketImageStorage,
    { provide: TICKET_IMAGE_STORAGE, useExisting: PostgresTicketImageStorage },
  ],
})
export class TicketsModule {}
