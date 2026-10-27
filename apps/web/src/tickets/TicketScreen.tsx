import { useEffect, useRef, useState } from 'react';
import { listTickets, TicketApiError, ticketImageUrl } from './api';
import type { Ticket, TicketPage } from './api';
import { NewTicketModal } from './NewTicketModal';
import { ticketScreenOptions } from './form';
import './tickets.css';

function typeLabel(type: Ticket['type']) {
  return type === 'bug' ? 'Erro' : 'Melhoria';
}

function screenLabel(value: string) {
  return ticketScreenOptions.find((option) => option.value === value)?.label ?? value;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
}

export function TicketScreen() {
  const [offset, setOffset] = useState(0);
  const [refresh, setRefresh] = useState(0);
  const requestKey = `${offset}:${refresh}`;
  const [result, setResult] = useState<{ key: string; page?: TicketPage; error?: string }>({ key: '' });
  const loading = result.key !== requestKey;
  const page = result.key === requestKey ? result.page ?? null : null;
  const error = result.key === requestKey ? result.error ?? '' : '';
  const [notice, setNotice] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [imageTicket, setImageTicket] = useState<Ticket | null>(null);
  const openButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    let active = true;
    listTickets(offset).then((result) => {
      if (active) setResult({ key: requestKey, page: result });
    }).catch((cause: unknown) => {
      if (!active) return;
      let message: string;
      if (cause instanceof TicketApiError && cause.status === 401)
        message = 'Sua sessão expirou. Atualize a página e entre novamente.';
      else if (cause instanceof TicketApiError && cause.status === 403)
        message = 'Seu acesso precisa de autorização para consultar chamados.';
      else message = 'Não foi possível carregar os chamados. Tente novamente.';
      setResult({ key: requestKey, error: message });
    });
    return () => { active = false; };
  }, [offset, refresh, requestKey]);

  function closeModal() {
    setModalOpen(false);
    window.requestAnimationFrame(() => openButton.current?.focus());
  }

  const total = page?.total ?? 0;
  const pageStart = total ? offset + 1 : 0;
  const pageEnd = Math.min(offset + (page?.limit ?? 20), total);

  return (
    <section className="ticket-page">
      <header className="inv-page-header ticket-page-header">
        <div>
          <div className="inv-page-pretitle">COLABORE COM A EVOLUÇÃO DO SISTEMA</div>
          <h1 className="inv-page-title">Bugs e melhorias</h1>
          <p className="inv-page-desc">Abra um chamado e consulte os relatos registrados pela equipe.</p>
        </div>
        <button
          ref={openButton}
          type="button"
          className="inv-btn inv-btn-primary"
          onClick={() => {
            setNotice('');
            setModalOpen(true);
          }}
        >
          <span className="material-symbols-outlined" aria-hidden="true">add</span>
          Novo chamado
        </button>
      </header>

      {notice && <p className="ticket-notice" role="status">{notice}</p>}
      {error && (
        <div className="ticket-state ticket-error" role="alert">
          <p>{error}</p>
          <button type="button" className="inv-btn inv-btn-secondary inv-btn-sm" onClick={() => setRefresh((value) => value + 1)}>
            Tentar novamente
          </button>
        </div>
      )}
      {loading && <div className="ticket-state" role="status">Carregando chamados…</div>}
      {!loading && !error && page?.tickets.length === 0 && (
        <div className="ticket-state ticket-empty">
          <span className="material-symbols-outlined" aria-hidden="true">chat_bubble_outline</span>
          <h2>Nenhum chamado aberto ainda</h2>
          <p>Use “Novo chamado” para registrar um erro ou sugerir uma melhoria.</p>
        </div>
      )}
      {!loading && !error && page && page.tickets.length > 0 && (
        <>
          <div className="ticket-list-heading">
            <h2>Chamados registrados</h2>
            <span>{total} {total === 1 ? 'chamado' : 'chamados'}</span>
          </div>
          <div className="ticket-list">
            {page.tickets.map((ticket) => (
              <article className="ticket-card" key={ticket.id}>
                <div className="ticket-card-topline">
                  <span className={`ticket-type-badge ${ticket.type}`}>{typeLabel(ticket.type)}</span>
                  <span className="ticket-open-badge">Aberto</span>
                </div>
                <h3>{ticket.title}</h3>
                <p className="ticket-description">{ticket.description}</p>
                <div className="ticket-card-footer">
                  <div className="ticket-meta">
                    <span>{screenLabel(ticket.screen)}</span>
                    <span>{ticket.authorName} · {formatDate(ticket.createdAt)}</span>
                  </div>
                  {ticket.hasImage && (
                    <button type="button" className="ticket-image-button" onClick={() => setImageTicket(ticket)}>
                      <span className="material-symbols-outlined" aria-hidden="true">image</span>
                      Ver imagem
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
          <nav className="ticket-pagination" aria-label="Paginação de chamados">
            <span>{pageStart}–{pageEnd} de {total}</span>
            <div>
              <button
                type="button"
                className="inv-btn inv-btn-secondary inv-btn-sm"
                disabled={offset === 0 || loading}
                onClick={() => setOffset(Math.max(0, offset - (page?.limit ?? 20)))}
              >Anterior</button>
              <button
                type="button"
                className="inv-btn inv-btn-secondary inv-btn-sm"
                disabled={offset + (page?.limit ?? 20) >= total || loading}
                onClick={() => setOffset(offset + (page?.limit ?? 20))}
              >Próxima</button>
            </div>
          </nav>
        </>
      )}

      {modalOpen && (
        <NewTicketModal
          onClose={closeModal}
          onCreated={() => {
            setOffset(0);
            setRefresh((value) => value + 1);
            setNotice('Chamado registrado com sucesso.');
          }}
        />
      )}
      {imageTicket && (
        <TicketImageDialog ticket={imageTicket} onClose={() => setImageTicket(null)} />
      )}
    </section>
  );
}

function TicketImageDialog({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  return (
    <dialog
      ref={dialogRef}
      className="ticket-image-dialog"
      aria-labelledby="ticket-image-title"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="ticket-image-dialog-panel">
        <div className="ticket-image-dialog-header">
          <strong id="ticket-image-title">{ticket.title}</strong>
          <button type="button" className="inv-btn inv-btn-secondary inv-btn-sm" onClick={onClose}>
            Fechar
          </button>
        </div>
        <img src={ticketImageUrl(ticket.id)} alt={`Imagem anexada ao chamado: ${ticket.title}`} />
      </div>
    </dialog>
  );
}
