import { useState } from 'react';
import type { FormEvent } from 'react';
import type { SkuStockItem } from '../types';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  stockItems: SkuStockItem[];
  onMovementCreated: (movement: {
    sku: string;
    productName: string;
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
    quantity: number;
    reason: string;
    documentRef: string;
    operator: string;
    notes: string;
  }) => void;
}

export function MovementModal({
  isOpen,
  onClose,
  stockItems,
  onMovementCreated,
}: MovementModalProps) {
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE'>('ENTRADA');
  const [selectedSkuId, setSelectedSkuId] = useState(stockItems[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(10);
  const [reason, setReason] = useState('Recebimento de Fornecedor com NF');
  const [documentRef, setDocumentRef] = useState('NF-e 002.819');
  const [operator, setOperator] = useState('Operador de Estoque (Itaquera)');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  if (!isOpen) return null;

  const currentItem = stockItems.find((item) => item.id === selectedSkuId) || stockItems[0];
  const physical = currentItem?.physicalStock ?? 0;
  const reserved = currentItem?.reservedStock ?? 0;
  const margin = currentItem?.safetyMargin ?? 0;

  // Calculate new physical and available
  const newPhysical =
    movementType === 'ENTRADA'
      ? physical + (quantity || 0)
      : movementType === 'SAIDA'
        ? Math.max(0, physical - (quantity || 0))
        : Math.max(0, quantity || 0);

  // PRD Rule: max(0, physical - reserved - margin)
  const newAvailable = Math.max(0, newPhysical - reserved - margin);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentItem) return;

    setIsSubmitting(true);
    setSuccessMessage('');

    // Simulate async submission
    setTimeout(() => {
      onMovementCreated({
        sku: currentItem.sku,
        productName: currentItem.productName,
        type: movementType,
        quantity: quantity || 0,
        reason,
        documentRef,
        operator,
        notes,
      });
      setIsSubmitting(false);
      setSuccessMessage('Movimentação registrada e saldo recalculado com sucesso!');
      setTimeout(() => {
        setSuccessMessage('');
        onClose();
      }, 1200);
    }, 600);
  }

  return (
    <div className="inv-modal-overlay" role="dialog" aria-modal="true" aria-labelledby="modal-mov-title">
      <div className="inv-modal-dialog">
        <div className="inv-modal-header">
          <div>
            <div className="inv-page-pretitle" style={{ marginBottom: 2 }}>
              RF-03 • REGISTRO AUDITADO
            </div>
            <h2 id="modal-mov-title" className="inv-page-title" style={{ fontSize: 20 }}>
              Lançar Movimentação Física
            </h2>
            <p className="inv-page-desc" style={{ fontSize: 12 }}>
              Entradas, saídas ou correções de inventário com recálculo automático de disponibilidade.
            </p>
          </div>
          <button
            type="button"
            className="inv-btn inv-btn-secondary inv-btn-sm"
            onClick={onClose}
            aria-label="Fechar"
            style={{ padding: '4px 8px', minHeight: 32 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
          </button>
        </div>

        {successMessage ? (
          <div className="inv-state-panel success" style={{ padding: '40px 20px' }}>
            <span className="material-symbols-outlined">check_circle</span>
            <div className="inv-state-title-text">{successMessage}</div>
            <div className="inv-state-desc-text">
              Livro-razão atualizado e fila de publicação nos canais notificada.
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="inv-modal-body">
              {/* Type selector */}
              <div className="inv-form-group">
                <label className="inv-form-label">
                  Tipo de Movimentação <span className="req">*</span>
                </label>
                <div className="inv-segmented">
                  <button
                    type="button"
                    className={`inv-segmented-btn ${movementType === 'ENTRADA' ? 'active' : ''}`}
                    onClick={() => {
                      setMovementType('ENTRADA');
                      setReason('Recebimento de Fornecedor com NF');
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
                    Entrada / Reposição (+)
                  </button>
                  <button
                    type="button"
                    className={`inv-segmented-btn ${movementType === 'SAIDA' ? 'active' : ''}`}
                    onClick={() => {
                      setMovementType('SAIDA');
                      setReason('Avaria / Descarte / Perda Física');
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>remove_circle</span>
                    Saída / Baixa (-)
                  </button>
                  <button
                    type="button"
                    className={`inv-segmented-btn ${movementType === 'AJUSTE' ? 'active' : ''}`}
                    onClick={() => {
                      setMovementType('AJUSTE');
                      setReason('Divergência de Contagem (Balanço)');
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
                    Ajuste Balanço (=)
                  </button>
                </div>
              </div>

              {/* SKU selector */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-sku">
                  Item / SKU Selecionado <span className="req">*</span>
                </label>
                <select
                  id="mov-sku"
                  className="inv-select"
                  value={selectedSkuId}
                  onChange={(e) => setSelectedSkuId(e.target.value)}
                  required
                >
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.productName} ({item.variantName}) [Físico: {item.physicalStock} un]
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-qty">
                  {movementType === 'AJUSTE' ? 'Novo Saldo Físico Total' : 'Quantidade da Movimentação'} <span className="req">*</span>
                </label>
                <input
                  id="mov-qty"
                  type="number"
                  min={movementType === 'AJUSTE' ? 0 : 1}
                  max={movementType === 'SAIDA' ? physical : 10000}
                  className="inv-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
                <span className="inv-form-help">
                  {movementType === 'AJUSTE'
                    ? 'Informe a quantidade apurada fisicamente no depósito após recontagem.'
                    : 'Informe o número de unidades inteiras para adicionar ou subtrair.'}
                </span>
              </div>

              {/* Reason */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-reason">
                  Motivo / Operação Justificada <span className="req">*</span>
                </label>
                <select
                  id="mov-reason"
                  className="inv-select"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                >
                  <option value="Recebimento de Fornecedor com NF">Recebimento de Fornecedor com NF</option>
                  <option value="Devolução de Cliente Conferida">Devolução de Cliente Conferida</option>
                  <option value="Avaria / Descarte / Perda Física">Avaria / Descarte / Perda Física</option>
                  <option value="Divergência de Contagem (Balanço)">Divergência de Contagem (Balanço)</option>
                  <option value="Ajuste Administrativo Auditado">Ajuste Administrativo Auditado</option>
                </select>
              </div>

              {/* Document and Operator */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div className="inv-form-group">
                  <label className="inv-form-label" htmlFor="mov-doc">
                    Documento / Referência
                  </label>
                  <input
                    id="mov-doc"
                    type="text"
                    className="inv-input"
                    value={documentRef}
                    onChange={(e) => setDocumentRef(e.target.value)}
                    placeholder="Ex: NF-e 1234, OS-902"
                  />
                </div>
                <div className="inv-form-group">
                  <label className="inv-form-label" htmlFor="mov-op">
                    Operador Responsável
                  </label>
                  <input
                    id="mov-op"
                    type="text"
                    className="inv-input"
                    value={operator}
                    onChange={(e) => setOperator(e.target.value)}
                    required
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-notes">
                  Observações de Auditoria
                </label>
                <textarea
                  id="mov-notes"
                  className="inv-input"
                  style={{ minHeight: 60, resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Justificativa operacional para o livro-razão digital..."
                />
              </div>

              {/* Invariant Preview Box */}
              <div className="inv-calc-box">
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Saldo Físico Atual:</span>
                  <strong>{physical} un</strong>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>
                    Impacto ({movementType === 'ENTRADA' ? '+' : movementType === 'SAIDA' ? '-' : '='}):
                  </span>
                  <strong>
                    {movementType === 'ENTRADA' ? `+${quantity}` : movementType === 'SAIDA' ? `-${quantity}` : `${quantity} (novo total)`} un
                  </strong>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Novo Saldo Físico:</span>
                  <strong>{newPhysical} un</strong>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Reservas Ativas + Margem de Segurança:</span>
                  <span>{reserved} un + {margin} un</span>
                </div>
                <div className="inv-calc-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                  <span><strong>Disponibilidade Multicanal Projetada:</strong></span>
                  <span className="inv-calc-highlight">{newAvailable} un</span>
                </div>
              </div>

              <aside className="inv-proposal-box" style={{ margin: 0, padding: '8px 12px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>shield</span>
                <div style={{ fontSize: 11 }}>
                  <strong>Regra Invariante RF-03 / RF-10:</strong> Baixa física não se confunde com reserva de pedido. Toda movimentação é registrada com operador, motivo e timestamp imutável no banco.
                </div>
              </aside>
            </div>

            <div className="inv-modal-footer">
              <button
                type="button"
                className="inv-btn inv-btn-secondary"
                onClick={onClose}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="inv-btn inv-btn-primary"
                disabled={isSubmitting}
              >
                {isSubmitting ? 'Registrando...' : 'Confirmar Movimentação'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
