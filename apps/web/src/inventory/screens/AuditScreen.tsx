import { useState } from 'react';
import type { ScreenState, AuditMovement } from '../types';
import { initialAuditMovements } from '../mock-data';
import { StatCard } from '../components/StatCard';
import { ProposalBadge } from '../components/ProposalBadge';
import { StateControls } from '../components/StateControls';

interface AuditScreenProps {
  onOpenMovementModal: () => void;
}

export function AuditScreen({ onOpenMovementModal }: AuditScreenProps) {
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [movements] = useState<AuditMovement[]>(initialAuditMovements);
  const [search, setSearch] = useState('');
  const [eventTypeFilter, setEventTypeFilter] = useState('ALL');
  const [activePill, setActivePill] = useState<'ALL' | 'ENTRADA' | 'BAIXA' | 'AJUSTE'>('ALL');
  const [banner, setBanner] = useState('');
  const [selectedMovement, setSelectedMovement] = useState<AuditMovement | null>(null);

  function handleExportCsv() {
    setBanner('Exportação CSV gerada: 64 registros transacionais prontos para download.');
    setTimeout(() => setBanner(''), 4000);
  }

  const filteredMovements = movements.filter((m) => {
    if (activePill === 'ENTRADA' && m.eventType !== 'ENTRADA_REPOSICAO') return false;
    if (activePill === 'BAIXA' && m.eventType !== 'BAIXA_EXPEDICAO') return false;
    if (activePill === 'AJUSTE' && m.eventType !== 'AJUSTE_BALANCO') return false;

    if (eventTypeFilter !== 'ALL' && m.eventType !== eventTypeFilter) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSku = m.sku.toLowerCase().includes(q);
      const matchProduct = m.productName.toLowerCase().includes(q);
      const matchDoc = m.documentRef.toLowerCase().includes(q);
      const matchOp = m.operator.toLowerCase().includes(q);
      if (!matchSku && !matchProduct && !matchDoc && !matchOp) return false;
    }
    return true;
  });

  return (
    <div>
      <StateControls
        currentState={screenState}
        onStateChange={setScreenState}
        screenName="Histórico e Auditoria"
      />

      {/* Header */}
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">
            RASTREABILIDADE & AUDITORIA • RF-17 LIVRO-RAZÃO DIGITAL
          </div>
          <h1 className="inv-page-title">Histórico e Auditoria de Movimentações</h1>
          <p className="inv-page-desc">
            Registro imutável e transacional de todas as alterações de saldo físico, reservas ativas e eventos compensatórios de estoque.
          </p>
        </div>

        <div className="inv-page-actions">
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={handleExportCsv}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Exportar Relatório CSV
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            onClick={onOpenMovementModal}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_circle</span>
            Lançar Movimentação
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

      <ProposalBadge variant="box" ruleId="RF-17">
        Conforme RF-17 do PRD: nenhum ajuste de saldo físico apaga movimentações anteriores; todas as correções são registradas como transações compensatórias rastreáveis com indicação explícita de operador e documento.
      </ProposalBadge>

      {/* States */}
      {screenState === 'loading' && (
        <div className="inv-card inv-state-panel loading">
          <span className="material-symbols-outlined">progress_activity</span>
          <div className="inv-state-title-text">Carregando livro-razão transacional...</div>
          <div className="inv-state-desc-text">
            Consultando registros imutáveis de estoque no PostgreSQL.
          </div>
        </div>
      )}

      {screenState === 'empty' && (
        <div className="inv-card inv-state-panel empty">
          <span className="material-symbols-outlined">receipt_long</span>
          <div className="inv-state-title-text">Nenhuma movimentação encontrada</div>
          <div className="inv-state-desc-text">
            Não há registros de eventos para os filtros ou período informados.
          </div>
        </div>
      )}

      {screenState === 'error' && (
        <div className="inv-card inv-state-panel error">
          <span className="material-symbols-outlined">error</span>
          <div className="inv-state-title-text">Erro ao ler logs de auditoria</div>
          <div className="inv-state-desc-text">
            Falha na conexão com o serviço de persistência de auditoria. Tente recarregar.
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
        <>
          {/* KPI Cards */}
          <div className="inv-kpi-grid">
            <StatCard
              label="Movimentações Hoje"
              value="64 transações"
              icon="receipt_long"
              badge={{ text: '100% auditadas', type: 'success' }}
              subtext="Com operador e justificativa"
            />
            <StatCard
              label="Entradas / Reposições"
              value="+ 450 unidades"
              icon="move_to_inbox"
              badge={{ text: '+18.4%', type: 'info' }}
              subtext="2 notas fiscais conferidas"
            />
            <StatCard
              label="Baixas por Expedição"
              value="- 114 unidades"
              icon="local_shipping"
              badge={{ text: 'Expedição', type: 'warning' }}
              subtext="36 pedidos atendidos e bipados"
            />
            <StatCard
              label="Ajustes de Inventário"
              value="- 3 unidades"
              icon="tune"
              badge={{ text: 'Compensatório', type: 'neutral' }}
              subtext="Recontagem física em balanço"
            />
          </div>

          {/* Quick Filter Pills */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 14, overflowX: 'auto' }}>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${activePill === 'ALL' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setActivePill('ALL')}
            >
              Todas Hoje (64)
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${activePill === 'ENTRADA' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setActivePill('ENTRADA')}
            >
              Entradas (+450 un)
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${activePill === 'BAIXA' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setActivePill('BAIXA')}
            >
              Baixas Expedição (-114 un)
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${activePill === 'AJUSTE' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setActivePill('AJUSTE')}
            >
              Ajustes Balanço (-3 un)
            </button>
          </div>

          {/* Filter Bar */}
          <div className="inv-filter-bar">
            <div className="inv-filter-group">
              <div className="inv-search-input-wrap">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  className="inv-input inv-search-input"
                  placeholder="Buscar por SKU, produto ou nº de documento..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="inv-select"
                value={eventTypeFilter}
                onChange={(e) => setEventTypeFilter(e.target.value)}
                aria-label="Tipo de Evento"
              >
                <option value="ALL">Todos os Tipos de Evento</option>
                <option value="ENTRADA_REPOSICAO">Entrada / Reposição</option>
                <option value="BAIXA_EXPEDICAO">Baixa por Expedição</option>
                <option value="RESERVA_COMPRA">Reserva de Compra</option>
                <option value="LIBERACAO_CANCELAMENTO">Liberação por Cancelamento</option>
                <option value="AJUSTE_BALANCO">Ajuste de Balanço</option>
              </select>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Mostrando <strong>{filteredMovements.length}</strong> de {movements.length} transações
            </div>
          </div>

          {/* Ledger Table */}
          <div className="inv-table-card">
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Data &amp; Hora</th>
                    <th>SKU &amp; Produto</th>
                    <th>Tipo de Evento</th>
                    <th>Documento / Ref</th>
                    <th>Operador</th>
                    <th style={{ textAlign: 'center' }}>Impacto Físico</th>
                    <th style={{ textAlign: 'center' }}>Saldo Resultante</th>
                    <th>Justificativa &amp; Detalhes</th>
                    <th style={{ textAlign: 'right' }}>Ação</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMovements.map((mov) => {
                    const isPositive = mov.quantityDelta > 0;
                    const isZero = mov.quantityDelta === 0;

                    return (
                      <tr key={mov.id}>
                        <td style={{ fontSize: 11, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          {mov.timestamp}
                        </td>
                        <td>
                          <strong>{mov.sku}</strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>{mov.productName}</div>
                        </td>
                        <td>
                          <span
                            className={`inv-badge ${
                              mov.eventType === 'ENTRADA_REPOSICAO'
                                ? 'inv-badge-success'
                                : mov.eventType === 'BAIXA_EXPEDICAO'
                                  ? 'inv-badge-warning'
                                  : mov.eventType === 'RESERVA_COMPRA'
                                    ? 'inv-badge-info'
                                    : mov.eventType === 'AJUSTE_BALANCO'
                                      ? 'inv-badge-danger'
                                      : 'inv-badge-neutral'
                            }`}
                          >
                            {mov.eventType === 'ENTRADA_REPOSICAO'
                              ? 'Entrada'
                              : mov.eventType === 'BAIXA_EXPEDICAO'
                                ? 'Baixa Expedição'
                                : mov.eventType === 'RESERVA_COMPRA'
                                  ? 'Reserva Compra'
                                  : mov.eventType === 'LIBERACAO_CANCELAMENTO'
                                    ? 'Liberação Canc.'
                                    : 'Ajuste Balanço'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11 }}>
                          <code>{mov.documentRef}</code>
                        </td>
                        <td style={{ fontSize: 12 }}>{mov.operator}</td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="inv-num"
                            style={{
                              fontWeight: 750,
                              color: isZero
                                ? 'var(--muted)'
                                : isPositive
                                  ? 'var(--status-success-text)'
                                  : 'var(--brand-dark)',
                            }}
                          >
                            {isZero ? '0 (Reserva)' : isPositive ? `+${mov.quantityDelta}` : mov.quantityDelta} un
                          </span>
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="inv-num" style={{ fontWeight: 700 }}>
                            {mov.resultingPhysical} un
                          </span>
                          <div style={{ fontSize: 10, color: 'var(--status-success-text)' }}>
                            Disp: {mov.resultingAvailable} un
                          </div>
                        </td>
                        <td style={{ maxWidth: 300, fontSize: 11, color: 'var(--muted)' }}>
                          <div>{mov.justification}</div>
                          {mov.proposalNote && (
                            <small style={{ color: '#b45309', display: 'block', marginTop: 2 }}>
                              {mov.proposalNote}
                            </small>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            className="inv-btn inv-btn-secondary inv-btn-sm"
                            onClick={() => setSelectedMovement(mov)}
                          >
                            Detalhes
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="inv-table-footer">
              <span>Livro-Razão Transacional • Invariante RNF-01 (Atomicidade e Imutabilidade)</span>
              <span style={{ fontSize: 11 }}>Exibindo {filteredMovements.length} eventos</span>
            </div>
          </div>

          {/* Details Modal */}
          {selectedMovement && (
            <div className="inv-modal-overlay" role="dialog" aria-modal="true">
              <div className="inv-modal-dialog" style={{ maxWidth: 500 }}>
                <div className="inv-modal-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Registro de Auditoria</h3>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>ID: {selectedMovement.id}</span>
                  </div>
                  <button
                    type="button"
                    className="inv-btn inv-btn-secondary inv-btn-sm"
                    onClick={() => setSelectedMovement(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="inv-modal-body" style={{ fontSize: 12 }}>
                  <div><strong>Timestamp:</strong> {selectedMovement.timestamp}</div>
                  <div><strong>SKU:</strong> {selectedMovement.sku} — {selectedMovement.productName}</div>
                  <div><strong>Tipo de Evento:</strong> {selectedMovement.eventType}</div>
                  <div><strong>Documento / Ref:</strong> {selectedMovement.documentRef}</div>
                  <div><strong>Operador Responsável:</strong> {selectedMovement.operator}</div>
                  <div><strong>Impacto no Físico:</strong> {selectedMovement.quantityDelta} un</div>
                  <div><strong>Saldo Físico Resultante:</strong> {selectedMovement.resultingPhysical} un</div>
                  <div><strong>Disponibilidade Resultante:</strong> {selectedMovement.resultingAvailable} un</div>
                  <div><strong>Justificativa Operacional:</strong> {selectedMovement.justification}</div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
