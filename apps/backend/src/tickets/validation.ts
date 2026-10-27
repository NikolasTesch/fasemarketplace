import { BadRequestException } from '@nestjs/common';

const ticketTypes = ['bug', 'improvement'] as const;
const ticketScreens = [
  'stock',
  'orders',
  'sync',
  'audit',
  'analytics',
  'movement',
  'catalog',
  'users',
  'settings',
  'diagnostics',
] as const;
const maxImageBytes = 5 * 1024 * 1024;
const fieldNames = ['type', 'screen', 'title', 'description'];

export type TicketType = (typeof ticketTypes)[number];
export type TicketScreen = (typeof ticketScreens)[number];
export type TicketUploadFile = { mimetype: string; buffer: Buffer };
export type ValidTicketInput = {
  type: TicketType;
  screen: TicketScreen;
  title: string;
  description: string;
  imageBytes: Buffer | null;
  imageMime: 'image/png' | 'image/jpeg' | 'image/webp' | null;
};

function textField(body: Record<string, unknown>, key: string, maxLength: number) {
  const value = body[key];
  if (typeof value !== 'string') throw new BadRequestException('Dados do chamado inválidos');
  const normalized = value.trim();
  if (!normalized || [...normalized].length > maxLength)
    throw new BadRequestException('Dados do chamado inválidos');
  return normalized;
}

function imageMime(buffer: Buffer) {
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  ) return 'image/png';
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return 'image/jpeg';
  if (
    buffer.length >= 12 &&
    buffer.toString('ascii', 0, 4) === 'RIFF' &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) return 'image/webp';
  return null;
}

export function validateTicketInput(
  input: unknown,
  file?: TicketUploadFile,
): ValidTicketInput {
  if (!input || typeof input !== 'object' || Array.isArray(input))
    throw new BadRequestException('Dados do chamado inválidos');
  const body = input as Record<string, unknown>;
  if (Object.keys(body).some((key) => !fieldNames.includes(key)))
    throw new BadRequestException('Dados do chamado inválidos');

  const type = body.type;
  const screen = body.screen;
  if (
    typeof type !== 'string' || !ticketTypes.includes(type as TicketType) ||
    typeof screen !== 'string' || !ticketScreens.includes(screen as TicketScreen)
  ) throw new BadRequestException('Dados do chamado inválidos');

  let attachmentMime: ValidTicketInput['imageMime'] = null;
  let attachmentBytes: Buffer | null = null;
  if (file !== undefined) {
    if (!Buffer.isBuffer(file.buffer) || file.buffer.length === 0 || file.buffer.length > maxImageBytes)
      throw new BadRequestException('A imagem deve ter até 5 MiB');
    const detected = imageMime(file.buffer);
    if (!detected || detected !== file.mimetype)
      throw new BadRequestException('Envie uma imagem PNG, JPEG ou WebP válida');
    attachmentMime = detected;
    attachmentBytes = file.buffer;
  }

  return {
    type: type as TicketType,
    screen: screen as TicketScreen,
    title: textField(body, 'title', 160),
    description: textField(body, 'description', 4000),
    imageBytes: attachmentBytes,
    imageMime: attachmentMime,
  };
}

export function parseTicketOffset(value: string | undefined) {
  if (value === undefined) return 0;
  if (!/^(0|[1-9]\d{0,6})$/.test(value))
    throw new BadRequestException('Paginação inválida');
  const offset = Number(value);
  if (offset > 1_000_000) throw new BadRequestException('Paginação inválida');
  return offset;
}

export function parseTicketId(value: string) {
  if (!/^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value))
    throw new BadRequestException('Identificador do chamado inválido');
  return value;
}
