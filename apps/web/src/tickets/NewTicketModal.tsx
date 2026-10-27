import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { createTicket, TicketApiError } from './api';
import { getTicketDraftError, ticketScreenOptions } from './form';

type NewTicketModalProps = {
  onClose: () => void;
  onCreated: () => void;
};

const validationMessages = {
  type: 'Escolha se o chamado é um erro ou uma melhoria.',
  screen: 'Selecione a tela afetada.',
  title: 'Informe um título com até 160 caracteres.',
  description: 'Descreva o chamado em até 4.000 caracteres.',
  image: 'A imagem deve ser PNG, JPEG ou WebP e ter até 5 MiB.',
};

export function NewTicketModal({ onClose, onCreated }: NewTicketModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<'bug' | 'improvement'>('bug');
  const [screen, setScreen] = useState('stock');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError('');
    const validationError = getTicketDraftError({ type, screen, title, description, image });
    if (validationError) {
      setError(validationMessages[validationError]);
      return;
    }

    const form = new FormData();
    form.set('type', type);
    form.set('screen', screen);
    form.set('title', title.trim());
    form.set('description', description.trim());
    if (image) form.set('image', image);

    setBusy(true);
    try {
      await createTicket(form);
      onCreated();
      onClose();
    } catch (cause) {
      if (cause instanceof TicketApiError && cause.status === 401)
        setError('Sua sessão expirou. Atualize a página e entre novamente.');
      else if (cause instanceof TicketApiError && cause.status === 403)
        setError('Seu acesso precisa de autorização para abrir chamados.');
      else if (cause instanceof TicketApiError && cause.status === 400)
        setError('Confira os campos e o formato da imagem. O formulário foi mantido.');
      else setError('Não foi possível salvar o chamado. Tente novamente.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={dialogRef}
      className="ticket-dialog"
      aria-labelledby="ticket-modal-title"
      onCancel={(event) => {
        event.preventDefault();
        if (!busy) onClose();
      }}
    >
      <header className="ticket-dialog-header">
        <div>
          <div className="inv-page-pretitle">CONTRIBUIÇÃO DO USUÁRIO</div>
          <h2 id="ticket-modal-title">Novo chamado</h2>
          <p>Conte o que aconteceu ou a melhoria que gostaria de ver.</p>
        </div>
        <button
          type="button"
          className="inv-btn inv-btn-secondary inv-btn-sm"
          onClick={onClose}
          disabled={busy}
          aria-label="Fechar formulário"
        >
          <span className="material-symbols-outlined" aria-hidden="true">close</span>
        </button>
      </header>

      <form onSubmit={(event) => void submit(event)}>
        <div className="ticket-dialog-body">
          <div className="ticket-form-grid">
            <label className="ticket-field">
              <span>Tipo <b aria-hidden="true">*</b></span>
              <select value={type} onChange={(event) => setType(event.target.value as 'bug' | 'improvement')}>
                <option value="bug">Erro</option>
                <option value="improvement">Melhoria</option>
              </select>
            </label>
            <label className="ticket-field">
              <span>Tela afetada <b aria-hidden="true">*</b></span>
              <select value={screen} onChange={(event) => setScreen(event.target.value)}>
                {ticketScreenOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>

          <label className="ticket-field">
            <span>Título <b aria-hidden="true">*</b></span>
            <input
              autoFocus
              required
              maxLength={320}
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Resuma o erro ou a melhoria"
            />
            <small>{Array.from(title).length}/160</small>
          </label>

          <label className="ticket-field">
            <span>Descrição <b aria-hidden="true">*</b></span>
            <textarea
              required
              maxLength={8000}
              rows={5}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="Explique o que aconteceu ou como a melhoria ajudaria no seu trabalho."
            />
            <small>{Array.from(description).length}/4.000</small>
          </label>

          <label className="ticket-field">
            <span>Imagem <small>(opcional)</small></span>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(event) => setImage(event.target.files?.[0] ?? null)}
            />
            <small>PNG, JPEG ou WebP · até 5 MiB</small>
          </label>
          {image && (
            <div className="ticket-file-chip">
              <span className="material-symbols-outlined" aria-hidden="true">image</span>
              <span title={image.name}>{image.name}</span>
              <button type="button" onClick={() => setImage(null)} disabled={busy} aria-label="Remover imagem">
                Remover
              </button>
            </div>
          )}
          {error && <p className="ticket-form-error" role="alert">{error}</p>}
        </div>

        <footer className="ticket-dialog-footer">
          <button type="button" className="inv-btn inv-btn-secondary" onClick={onClose} disabled={busy}>
            Cancelar
          </button>
          <button type="submit" className="inv-btn inv-btn-primary" disabled={busy} aria-busy={busy}>
            {busy ? 'Enviando…' : 'Enviar chamado'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}
