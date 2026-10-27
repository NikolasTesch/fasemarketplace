import {
  Body,
  Controller,
  Get,
  HttpCode,
  Inject,
  Param,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { TicketAccessGuard, type TicketRequest } from './guard.js';
import { TicketService } from './service.js';
import { validateTicketInput, type TicketUploadFile } from './validation.js';

@Controller('tickets')
@UseGuards(TicketAccessGuard)
export class TicketController {
  constructor(@Inject(TicketService) private readonly tickets: TicketService) {}

  @Get()
  list(@Query('offset') offset?: string) {
    return this.tickets.list(offset);
  }

  @Post()
  @HttpCode(201)
  @UseInterceptors(FileInterceptor('image', {
    limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 4, fieldSize: 16 * 1024 },
  }))
  create(
    @Req() request: TicketRequest,
    @Body() body: unknown,
    @UploadedFile() file?: TicketUploadFile,
  ) {
    if (!request.ticketActor) throw new UnauthorizedException('Sessão inválida ou expirada');
    return this.tickets.create(request.ticketActor, validateTicketInput(body, file));
  }

  @Get(':id/image')
  async image(@Param('id') id: string, @Res() response: Response) {
    const image = await this.tickets.image(id);
    response.setHeader('Content-Type', image.mime);
    response.setHeader('Content-Length', image.bytes.length);
    response.setHeader('X-Content-Type-Options', 'nosniff');
    response.setHeader('Cache-Control', 'no-store');
    response.setHeader('Content-Disposition', 'inline');
    response.status(200).send(image.bytes);
  }
}
