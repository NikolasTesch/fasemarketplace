export const ticketScreenOptions = [
  { value: 'stock', label: 'Estoque e Saldos' },
  { value: 'orders', label: 'Pedidos e Reservas' },
  { value: 'sync', label: 'Sincronização e Alertas' },
  { value: 'audit', label: 'Histórico e Auditoria' },
  { value: 'analytics', label: 'Painel Analítico' },
  { value: 'movement', label: 'Lançar Movimentação' },
  { value: 'catalog', label: 'Catálogo' },
  { value: 'users', label: 'Usuários' },
  { value: 'settings', label: 'Configurações' },
  { value: 'diagnostics', label: 'Diagnóstico do Sistema' },
] as const;

const allowedImageTypes = new Set(['image/png', 'image/jpeg', 'image/webp']);
const maxImageBytes = 5 * 1024 * 1024;

export type TicketDraftError = 'type' | 'screen' | 'title' | 'description' | 'image';

export function getTicketDraftError(input: {
  type?: unknown;
  screen?: unknown;
  title?: unknown;
  description?: unknown;
  image?: { type: string; size: number } | null;
}): TicketDraftError | null {
  if (input.type !== 'bug' && input.type !== 'improvement') return 'type';
  if (!ticketScreenOptions.some((option) => option.value === input.screen)) return 'screen';
  if (
    typeof input.title !== 'string' ||
    !input.title.trim() ||
    [...input.title.trim()].length > 160
  ) return 'title';
  if (
    typeof input.description !== 'string' ||
    !input.description.trim() ||
    [...input.description.trim()].length > 4000
  ) return 'description';
  if (input.image && (
    !allowedImageTypes.has(input.image.type) ||
    !Number.isFinite(input.image.size) ||
    input.image.size <= 0 ||
    input.image.size > maxImageBytes
  )) return 'image';
  return null;
}
