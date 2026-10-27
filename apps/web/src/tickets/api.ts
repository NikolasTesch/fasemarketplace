export type Ticket = {
  id: string;
  type: 'bug' | 'improvement';
  screen: string;
  title: string;
  description: string;
  status: 'open';
  authorName: string;
  createdAt: string;
  hasImage: boolean;
  imageMime: string | null;
};

export type TicketPage = {
  tickets: Ticket[];
  total: number;
  offset: number;
  limit: number;
};

export class TicketApiError extends Error {
  constructor(readonly status: number) {
    super('Não foi possível concluir a operação com chamados.');
  }
}

export async function listTickets(offset: number): Promise<TicketPage> {
  const response = await fetch(`/api/tickets?offset=${offset}`, {
    credentials: 'same-origin',
    cache: 'no-store',
  });
  if (!response.ok) throw new TicketApiError(response.status);
  return response.json() as Promise<TicketPage>;
}

export async function createTicket(form: FormData): Promise<Ticket> {
  const response = await fetch('/api/tickets', {
    method: 'POST',
    credentials: 'same-origin',
    body: form,
  });
  if (!response.ok) throw new TicketApiError(response.status);
  return response.json() as Promise<Ticket>;
}

export function ticketImageUrl(id: string) {
  return `/api/tickets/${encodeURIComponent(id)}/image`;
}
