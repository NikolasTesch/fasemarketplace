import { useState } from 'react';
import type { FormEvent } from 'react';
import type { ScreenState, SkuStockItem } from '../types';
import { ProposalBadge } from '../components/ProposalBadge';
import { StateControls } from '../components/StateControls';

interface MovementScreenProps {
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
  onNavigateToStock: () => void;
}

export function MovementScreen({
  stockItems,
  onMovementCreated,
  onNavigateToStock,
}: MovementScreenProps) {
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [movementType, setMovementType] = useState<'ENTRADA' | 'SAIDA' | 'AJUSTE'>('ENTRADA');
  const [selectedSkuId, setSelectedSkuId] = useState(stockItems[0]?.id || '');
  const [quantity, setQuantity] = useState<number>(20);
  const [reason, setReason] = useState('Recebimento de Fornecedor com NF');
  const [documentRef, setDocumentRef] = useState('NF-e 003.112');
  const [operator, setOperator] = useState('Operador de Estoque (Itaquera)');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [banner, setBanner] = useState('');

  const currentItem = stockItems.find((item) => item.id === selectedSkuId) || stockItems[0];
  const physical = currentItem?.physicalStock ?? 0;
  const reserved = currentItem?.reservedStock ?? 0;
  const margin = currentItem?.safetyMargin ?? 0;

  const newPhysical =
    movementType === 'ENTRADA'
      ? physical + (quantity || 0)
      : movementType === 'SAIDA'
        ? Math.max(0, physical - (quantity || 0))
        : Math.max(0, quantity || 0);

  const newAvailable = Math.max(0, newPhysical - reserved - margin);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!currentItem) return;

    setIsSubmitting(true);
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
      setBanner('Movimentação lançada com sucesso! O livro-razão foi atualizado e a nova disponibilidade foi calculada.');
      setTimeout(() => setBanner(''), 6000);
    }, 600);
  }

  return (
    <div>
      <StateControls
        currentState={screenState}
        onStateChange={setScreenState}
        screenName="Lançar Movimentação de Estoque"
      />

      {/* Header */}
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">
            OPERAÇÃO DE DEPÓSITO • RF-03 LIVRO-RAZÃO DIGITAL
          </div>
          <h1 className="inv-page-title">Lançar Movimentação Física de Estoque</h1>
          <p className="inv-page-desc">
            Registre entradas, saídas ou correções de inventário auditadas com impacto imediato no recálculo de disponibilidade multicanal.
          </p>
        </div>

        <div className="inv-page-actions">
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={onNavigateToStock}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Voltar aos Saldos
          </button>
        </div>
      </div>

      {banner && (
        <div className="inv-banner-success" role="status">
          <span>{banner}</span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            onClick={() => setBanner('')}
          >
            ✕
          </button>
        </div>
      )}

      <ProposalBadge variant="box" ruleId="RF-03">
        Toda alteração de saldo físico exige operador, motivo formal e documento de rastreabilidade. Em conformidade com o PRD, ajustes não apagam o histórico anterior e são processados como eventos compensatórios.
      </ProposalBadge>

      {/* States */}
      {screenState === 'loading' && (
        <div className="inv-card inv-state-panel loading">
          <span className="material-symbols-outlined">progress_activity</span>
          <div className="inv-state-title-text">Validando permissões de operador...</div>
          <div className="inv-state-desc-text">
            Consultando bloqueios de escrita e regras de depósito.
          </div>
        </div>
      )}

      {screenState === 'empty' && (
        <div className="inv-card inv-state-panel empty">
          <span className="material-symbols-outlined">rule</span>
          <div className="inv-state-title-text">Nenhum formulário ativo</div>
          <div className="inv-state-desc-text">
            Selecione uma ação de movimentação para iniciar um novo lançamento.
          </div>
        </div>
      )}

      {screenState === 'error' && (
        <div className="inv-card inv-state-panel error">
          <span className="material-symbols-outlined">error</span>
          <div className="inv-state-title-text">Erro de validação cadastral</div>
          <div className="inv-state-desc-text">
            O SKU selecionado possui bloqueio administrativo temporário para inventário físico.
          </div>
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={() => setScreenState('ready')}
            style={{ marginTop: 8 }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      {(screenState === 'ready' || screenState === 'success') && (
        <div className="inv-movement-grid">
          {/* Form Card */}
          <div className="inv-card">
            <h2 style={{ fontSize: 16, fontWeight: 750, margin: '0 0 16px' }}>
              Dados da Movimentação
            </h2>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Type */}
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

              {/* SKU */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-page-sku">
                  Item / SKU Selecionado <span className="req">*</span>
                </label>
                <select
                  id="mov-page-sku"
                  className="inv-select"
                  value={selectedSkuId}
                  onChange={(e) => setSelectedSkuId(e.target.value)}
                  required
                >
                  {stockItems.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.sku} — {item.productName} ({item.variantName}) [Físico Atual: {item.physicalStock} un]
                    </option>
                  ))}
                </select>
              </div>

              {/* Quantity */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-page-qty">
                  {movementType === 'AJUSTE' ? 'Novo Saldo Físico Total' : 'Quantidade da Movimentação'} <span className="req">*</span>
                </label>
                <input
                  id="mov-page-qty"
                  type="number"
                  min={movementType === 'AJUSTE' ? 0 : 1}
                  max={movementType === 'SAIDA' ? physical : 10000}
                  className="inv-input"
                  value={quantity}
                  onChange={(e) => setQuantity(Number(e.target.value))}
                  required
                />
              </div>

              {/* Reason */}
              <div className="inv-form-group">
                <label className="inv-form-label" htmlFor="mov-page-reason">
                  Motivo / Operação Justificada <span className="req">*</span>
                </label>
                <select
                  id="mov-page-reason"
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
                  <label className="inv-form-label" htmlFor="mov-page-doc">
                    Documento / Referência
                  </label>
                  <input
                    id="mov-page-doc"
                    type="text"
                    className="inv-input"
                    value={documentRef}
                    onChange={(e) => setDocumentRef(e.target.value)}
                  />
                </div>
                <div className="inv-form-group">
                  <label className="inv-form-label" htmlFor="mov-page-op">
                    Operador Responsável
                  </label>
                  <input
                    id="mov-page-op"
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
                <label className="inv-form-label" htmlFor="mov-page-notes">
                  Observações de Auditoria
                </label>
                <textarea
                  id="mov-page-notes"
                  className="inv-input"
                  style={{ minHeight: 70, resize: 'vertical' }}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Justificativa técnica ou comercial para registro no livro-razão..."
                />
              </div>

              <button
                type="submit"
                className="inv-btn inv-btn-primary"
                disabled={isSubmitting}
                style={{ marginTop: 8 }}
              >
                {isSubmitting ? 'Simulando Movimentação...' : 'Simular Movimentação'}
              </button>
            </form>
          </div>

          {/* Right Column: Live Calculation and Invariants */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="inv-card">
              <h3 style={{ fontSize: 14, fontWeight: 750, margin: '0 0 12px' }}>
                Simulação de Impacto no Saldo
              </h3>

              <div className="inv-calc-box">
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>SKU:</span>
                  <strong>{currentItem?.sku}</strong>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Depósito:</span>
                  <span>Itaquera / SP</span>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Saldo Físico Atual:</span>
                  <strong>{physical} un</strong>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>
                    Operação ({movementType}):
                  </span>
                  <strong>
                    {movementType === 'ENTRADA' ? `+${quantity}` : movementType === 'SAIDA' ? `-${quantity}` : `${quantity} (novo total)`} un
                  </strong>
                </div>
                <div className="inv-calc-row" style={{ borderTop: '1px solid #e2e8f0', paddingTop: 6 }}>
                  <span style={{ color: 'var(--muted)' }}>Novo Saldo Físico:</span>
                  <strong>{newPhysical} un</strong>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Reservas Ativas:</span>
                  <span>{reserved} un (inalteradas)</span>
                </div>
                <div className="inv-calc-row">
                  <span style={{ color: 'var(--muted)' }}>Margem de Segurança:</span>
                  <span>{margin} un</span>
                </div>
                <div className="inv-calc-row" style={{ borderTop: '2px solid #cbd5e1', paddingTop: 8 }}>
                  <span><strong>Nova Disponibilidade de Venda:</strong></span>
                  <span className="inv-calc-highlight">{newAvailable} un</span>
                </div>
              </div>

              <div style={{ fontSize: 11, color: 'var(--muted)', marginTop: 12, lineHeight: 1.4 }}>
                A nova quantidade de <strong>{newAvailable} un</strong> será enviada aos anúncios vinculados no Mercado Livre e Shopee assim que confirmada.
              </div>
            </div>

            <div className="inv-card">
              <h3 style={{ fontSize: 14, fontWeight: 750, margin: '0 0 8px' }}>
                Regras Invariantes (RF-03 &amp; RF-10)
              </h3>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6 }}>
                <li>Movimentações físicas alteram o depósito, não as reservas existentes de pedidos.</li>
                <li>Baixa de expedição de pedidos não deve ser feita por este formulário avulso, e sim pelo fluxo de conferência de pedidos.</li>
                <li>Nenhum ajuste exclui transações anteriores do banco de dados.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
