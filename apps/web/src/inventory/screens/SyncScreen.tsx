import { useState } from 'react';
import type { ScreenState, StockDiscrepancy } from '../types';
import { initialChannels, initialDiscrepancies } from '../mock-data';
import { ProposalBadge } from '../components/ProposalBadge';
import { StateControls } from '../components/StateControls';

export function SyncScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [channels] = useState(initialChannels);
  const [discrepancies, setDiscrepancies] = useState<StockDiscrepancy[]>(initialDiscrepancies);
  const [globalPaused, setGlobalPaused] = useState(false);
  const [filterTab, setFilterTab] = useState<'all' | 'pending' | 'resolved'>('all');
  const [isReconciling, setIsReconciling] = useState(false);
  const [banner, setBanner] = useState('');
  const [activePayload, setActivePayload] = useState<StockDiscrepancy | null>(null);

  function handleReconcile() {
    setIsReconciling(true);
    setTimeout(() => {
      setIsReconciling(false);
      setBanner('Reconciliação concluída: 124 SKUs verificados. Nenhuma nova divergência encontrada nos marketplaces.');
      setTimeout(() => setBanner(''), 5000);
    }, 1200);
  }

  function handleResolveDiscrepancy(id: string) {
    setDiscrepancies((prev) =>
      prev.map((d) => (d.id === id ? { ...d, status: 'RESOLVIDO' } : d))
    );
    setBanner('Ação executada: saldo forçado nos canais remotos e registro de auditoria gravado.');
    setTimeout(() => setBanner(''), 5000);
  }

  function handleTestConnection(channelId: 'mercadolivre' | 'shopee') {
    const ch = channels.find((c) => c.id === channelId);
    setBanner(`Teste de conectividade com ${ch?.name || channelId}: 200 OK (Latência 180ms). Token válido.`);
    setTimeout(() => setBanner(''), 4000);
  }

  const filteredDiscrepancies = discrepancies.filter((d) => {
    if (filterTab === 'pending') return d.status === 'PENDENTE';
    if (filterTab === 'resolved') return d.status === 'RESOLVIDO';
    return true;
  });

  return (
    <div>
      <StateControls
        currentState={screenState}
        onStateChange={setScreenState}
        screenName="Sincronização e Alertas"
      />

      {/* Header */}
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">
            INTEGRAÇÃO & CONVERGÊNCIA • RF-05 / RF-06 / RF-11 a RF-15
          </div>
          <h1 className="inv-page-title">Sincronização e Alertas</h1>
          <p className="inv-page-desc">
            Monitoramento em tempo real das chamadas de API, fila de publicação de disponibilidade e resolução de divergências.
          </p>
        </div>

        <div className="inv-page-actions">
          <button
            type="button"
            className={`inv-btn ${globalPaused ? 'inv-btn-primary' : 'inv-btn-danger'}`}
            onClick={() => {
              setGlobalPaused(!globalPaused);
              setBanner(
                globalPaused
                  ? 'Escrita global reativada para todos os canais conectados.'
                  : 'Escrita global pausada: nenhuma publicação remota de saldo será realizada.'
              );
              setTimeout(() => setBanner(''), 5000);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
              {globalPaused ? 'play_arrow' : 'pause_circle'}
            </span>
            {globalPaused ? 'Retomar Escrita Global' : 'Pausar Escrita Global'}
          </button>

          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={handleReconcile}
            disabled={isReconciling}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, animation: isReconciling ? 'spin 1s linear infinite' : 'none' }}
            >
              sync
            </span>
            {isReconciling ? 'Reconciliando...' : 'Executar Reconciliação Geral'}
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

      {globalPaused && (
        <div
          className="inv-card"
          style={{
            background: 'var(--status-warn-bg)',
            borderColor: '#f59e0b',
            color: 'var(--status-warn-text)',
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 24, color: '#d97706' }}>
            pause_circle
          </span>
          <div>
            <strong>ESCRITA GLOBAL PAUSADA MANUALMENTE (RF-15)</strong>
            <p style={{ margin: '2px 0 0', fontSize: 12 }}>
              Nenhuma alteração de disponibilidade será enviada ao Mercado Livre ou Shopee. Webhooks continuam sendo recebidos em modo leitura.
            </p>
          </div>
        </div>
      )}

      <ProposalBadge variant="box" ruleId="RF-12 / RF-15">
        A política de resolução automática de divergências e a periodicidade das reconciliações em lote figuram como propostas para o piloto, garantindo que o saldo remoto nunca sobrescreva o físico próprio sem confirmação.
      </ProposalBadge>

      {/* Screen States */}
      {screenState === 'loading' && (
        <div className="inv-card inv-state-panel loading">
          <span className="material-symbols-outlined">progress_activity</span>
          <div className="inv-state-title-text">Conferindo status dos canais e filas de publicação...</div>
          <div className="inv-state-desc-text">
            Testando integridade de webhooks, autenticação OAuth2 e filas no Redis.
          </div>
        </div>
      )}

      {screenState === 'empty' && (
        <div className="inv-card inv-state-panel empty">
          <span className="material-symbols-outlined">check_circle</span>
          <div className="inv-state-title-text">Nenhuma divergência ou alerta pendente</div>
          <div className="inv-state-desc-text">
            Todos os anúncios ativos e variantes estão 100% sincronizados entre o depósito central, Mercado Livre e Shopee.
          </div>
        </div>
      )}

      {screenState === 'error' && (
        <div className="inv-card inv-state-panel error">
          <span className="material-symbols-outlined">error</span>
          <div className="inv-state-title-text">Alerta Crítico: Token do Mercado Livre Requer Reautorização</div>
          <div className="inv-state-desc-text">
            O canal retornou erro 401 (Invalid Token). A publicação de disponibilidade para o Mercado Livre foi pausada preventivamente.
          </div>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            onClick={() => setScreenState('ready')}
            style={{ marginTop: 8 }}
          >
            Iniciar Reautorização OAuth2
          </button>
        </div>
      )}

      {(screenState === 'ready' || screenState === 'success') && (
        <>
          {/* Channel Cards Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16, marginBottom: 24 }}>
            {channels.map((ch) => (
              <div key={ch.id} className="inv-card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <span
                      className={`inv-channel-badge ${
                        ch.id === 'mercadolivre' ? 'inv-channel-ml' : 'inv-channel-shopee'
                      }`}
                    >
                      {ch.name}
                    </span>
                    <h2 style={{ fontSize: 16, fontWeight: 750, margin: '6px 0 2px' }}>
                      {ch.connectedAccount}
                    </h2>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>{ch.apiVer}</span>
                  </div>

                  <span className="inv-badge inv-badge-success">
                    <span className="inv-env-dot" />
                    Conectado e Operando
                  </span>
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 12,
                    background: '#fafafa',
                    padding: 12,
                    borderRadius: 8,
                    marginBottom: 14,
                    fontSize: 12,
                  }}
                >
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>Último Webhook:</span>
                    <div style={{ fontWeight: 700 }}>Há {ch.lastWebhookSecondsAgo}s • 200 OK</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>Fila de Publicação:</span>
                    <div style={{ fontWeight: 700 }}>
                      {ch.queuePending} pendentes ({ch.queueLatencySeconds}s latência)
                    </div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>Token de Acesso:</span>
                    <div style={{ fontWeight: 700 }}>{ch.tokenExpiresIn}</div>
                  </div>
                  <div>
                    <span style={{ color: 'var(--muted)', fontSize: 11 }}>Margem Padrão:</span>
                    <div style={{ fontWeight: 700 }}>{ch.activeMarginDefault} un de proteção</div>
                  </div>
                </div>

                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    className="inv-btn inv-btn-secondary inv-btn-sm"
                    onClick={() => handleTestConnection(ch.id)}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>bolt</span>
                    Testar Conexão
                  </button>
                  <button
                    type="button"
                    className="inv-btn inv-btn-secondary inv-btn-sm"
                    onClick={() => {
                      setBanner(`Configurações de margem de segurança abertas para ${ch.name}.`);
                      setTimeout(() => setBanner(''), 4000);
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: 14 }}>tune</span>
                    Configurar Margem
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Divergences & Incidents Table */}
          <div className="inv-table-card">
            <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
              <div>
                <h2 style={{ fontSize: 15, fontWeight: 750, margin: 0 }}>
                  Ocorrências e Divergências de Estoque
                </h2>
                <span style={{ fontSize: 12, color: 'var(--muted)' }}>
                  Comparativo entre a disponibilidade local calculada e a quantidade observada nos canais remotos
                </span>
              </div>

              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  type="button"
                  className={`inv-btn inv-btn-sm ${filterTab === 'all' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
                  onClick={() => setFilterTab('all')}
                >
                  Todas ({discrepancies.length})
                </button>
                <button
                  type="button"
                  className={`inv-btn inv-btn-sm ${filterTab === 'pending' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
                  onClick={() => setFilterTab('pending')}
                >
                  Pendentes ({discrepancies.filter((d) => d.status === 'PENDENTE').length})
                </button>
                <button
                  type="button"
                  className={`inv-btn inv-btn-sm ${filterTab === 'resolved' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
                  onClick={() => setFilterTab('resolved')}
                >
                  Resolvidas ({discrepancies.filter((d) => d.status === 'RESOLVIDO').length})
                </button>
              </div>
            </div>

            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Canal</th>
                    <th>Recurso / SKU</th>
                    <th style={{ textAlign: 'center' }}>Estoque Local (Disp.)</th>
                    <th style={{ textAlign: 'center' }}>Estoque Remoto</th>
                    <th style={{ textAlign: 'center' }}>Diferença</th>
                    <th>Motivo / Causa Provável</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Ação Auditada</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDiscrepancies.map((disc) => (
                    <tr key={disc.id}>
                      <td>
                        <span
                          className={`inv-channel-badge ${
                            disc.channel === 'mercadolivre' ? 'inv-channel-ml' : 'inv-channel-shopee'
                          }`}
                        >
                          {disc.channel === 'mercadolivre' ? 'Mercado Livre' : 'Shopee'}
                        </span>
                      </td>
                      <td>
                        <strong>{disc.resourceSku}</strong>
                        <div style={{ fontSize: 11, color: 'var(--muted)' }}>{disc.productName}</div>
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }} className="inv-num">
                        {disc.localAvailable} un
                      </td>
                      <td style={{ textAlign: 'center', fontWeight: 700 }} className="inv-num">
                        {disc.remoteObserved} un
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          className="inv-badge"
                          style={{
                            background: disc.difference === 0 ? 'var(--status-success-bg)' : '#fee2e2',
                            color: disc.difference === 0 ? 'var(--status-success-text)' : '#b91c1c',
                          }}
                        >
                          {disc.difference > 0 ? `+${disc.difference}` : disc.difference} un
                        </span>
                      </td>
                      <td style={{ maxWidth: 260, fontSize: 11, color: 'var(--muted)' }}>
                        <div>{disc.probableCause}</div>
                        <small style={{ color: 'var(--text)', display: 'block', marginTop: 2 }}>
                          {disc.proposalResolution}
                        </small>
                      </td>
                      <td>
                        <span
                          className={`inv-badge ${
                            disc.status === 'RESOLVIDO' ? 'inv-badge-success' : 'inv-badge-warning'
                          }`}
                        >
                          {disc.status}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {disc.status === 'PENDENTE' ? (
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="inv-btn inv-btn-primary inv-btn-sm"
                              onClick={() => handleResolveDiscrepancy(disc.id)}
                              title="Publicar imediatamente o saldo local para o canal remoto"
                            >
                              Forçar Saldo Local ({disc.localAvailable} un)
                            </button>
                            <button
                              type="button"
                              className="inv-btn inv-btn-secondary inv-btn-sm"
                              onClick={() => setActivePayload(disc)}
                            >
                              Ver Payload
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--status-success-text)', fontWeight: 600 }}>
                            Convergência OK
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Idempotency Invariants Box */}
          <div className="inv-card" style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 750, margin: '0 0 8px' }}>
              Garantias de Idempotência e Tratamento de Falhas (RF-11 a RF-14)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>1. Chave de Idempotência por Evento:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  Cada notificação externa é processada sob chave composta `[canal + order_id + status]`. Mensagens repetidas são descartadas sem duplicidade de efeitos.
                </p>
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>2. Saldo Central como Fonte da Verdade:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  A quantidade remota nunca altera o saldo físico do depósito. Em caso de divergência, o sistema gera alerta para apuração de vendas concorrentes.
                </p>
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>3. Fila de Retentativas com Backoff Exponencial:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  Falhas de rede na chamada aos marketplaces entram em fila no Redis com limite de 5 tentativas. Falhas permanentes (ex: 400 Bad Request) geram alerta de suporte.
                </p>
              </div>
            </div>
          </div>

          {/* Payload Inspector Modal */}
          {activePayload && (
            <div className="inv-modal-overlay" role="dialog" aria-modal="true">
              <div className="inv-modal-dialog" style={{ maxWidth: 520 }}>
                <div className="inv-modal-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16 }}>Payload da Notificação</h3>
                    <span style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {activePayload.channel} • {activePayload.resourceSku}
                    </span>
                  </div>
                  <button
                    type="button"
                    className="inv-btn inv-btn-secondary inv-btn-sm"
                    onClick={() => setActivePayload(null)}
                  >
                    Fechar
                  </button>
                </div>
                <div className="inv-modal-body">
                  <pre
                    style={{
                      background: '#1e293b',
                      color: '#e2e8f0',
                      padding: 12,
                      borderRadius: 6,
                      fontSize: 11,
                      overflowX: 'auto',
                    }}
                  >
                    {JSON.stringify(
                      {
                        event_id: `evt-${activePayload.id}`,
                        channel: activePayload.channel,
                        sku: activePayload.resourceSku,
                        detected_at: activePayload.detectedAt,
                        discrepancy: {
                          local_available: activePayload.localAvailable,
                          remote_observed: activePayload.remoteObserved,
                          delta: activePayload.difference,
                        },
                        probable_cause: activePayload.probableCause,
                      },
                      null,
                      2
                    )}
                  </pre>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
