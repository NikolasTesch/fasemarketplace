import { useState } from 'react';
import type { ScreenState, OrderReservation } from '../types';
import { initialOrders } from '../mock-data';
import { StatCard } from '../components/StatCard';
import { ProposalBadge } from '../components/ProposalBadge';
import { StateControls } from '../components/StateControls';

export function OrdersScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [orders, setOrders] = useState<OrderReservation[]>(initialOrders);
  const [search, setSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<'all' | 'mercadolivre' | 'shopee'>('all');
  const [statusTab, setStatusTab] = useState<'all' | 'ready' | 'picking' | 'uncovered' | 'shipped'>('all');
  const [banner, setBanner] = useState('');

  // Handle expedite (Baixa física atômica)
  function handleExpedite(orderId: string) {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            orderStatus: 'EXPEDIDO',
            reservationStatus: 'CONSUMIDA_EXPEDICAO',
            notes: 'Expedição física confirmada. Baixa de estoque físico e consumo de reserva executados atomicamente.',
          };
        }
        return ord;
      })
    );
    setBanner('Expedição registrada: reserva consumida e baixa física executada atomicamente no estoque central.');
    setTimeout(() => setBanner(''), 5000);
  }

  // Handle cancellation release
  function handleRelease(orderId: string) {
    setOrders((prev) =>
      prev.map((ord) => {
        if (ord.id === orderId) {
          return {
            ...ord,
            orderStatus: 'CANCELADO',
            reservationStatus: 'LIBERADA',
            reservedQuantity: 0,
            notes: 'Cancelamento pré-expedição: unidades reservadas devolvidas à disponibilidade de venda.',
          };
        }
        return ord;
      })
    );
    setBanner('Reserva liberada: unidades devolvidas à disponibilidade global de venda.');
    setTimeout(() => setBanner(''), 5000);
  }

  // Filter orders
  const filteredOrders = orders.filter((o) => {
    if (channelFilter !== 'all' && o.channel !== channelFilter) return false;
    if (statusTab === 'ready' && o.reservationStatus !== 'RESERVADO_INTEGRAL') return false;
    if (statusTab === 'picking' && o.orderStatus !== 'EM_SEPARACAO') return false;
    if (statusTab === 'uncovered' && o.reservationStatus !== 'FALTA_ESTOQUE') return false;
    if (statusTab === 'shipped' && o.orderStatus !== 'EXPEDIDO') return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchNumber = o.orderNumber.toLowerCase().includes(q);
      const matchCustomer = o.customerName.toLowerCase().includes(q);
      const matchItem = o.items.some(
        (i) => i.sku.toLowerCase().includes(q) || i.productName.toLowerCase().includes(q)
      );
      if (!matchNumber && !matchCustomer && !matchItem) return false;
    }
    return true;
  });

  return (
    <div>
      <StateControls
        currentState={screenState}
        onStateChange={setScreenState}
        screenName="Pedidos e Reservas"
      />

      {/* Header */}
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">
            FLUXO DE EXPEDIÇÃO & RESERVAS • RF-09 / RF-10
          </div>
          <h1 className="inv-page-title">Pedidos e Reservas de Estoque</h1>
          <p className="inv-page-desc">
            Acompanhe as reservas ativas geradas pelos marketplaces e controle a baixa física por expedição sem duplicidade.
          </p>
        </div>

        <div className="inv-page-actions">
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={() => {
              setBanner('Lista de pedidos atualizada com o último webhook.');
              setTimeout(() => setBanner(''), 4000);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>date_range</span>
            Filtrar Período
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            onClick={() => {
              setBanner('Modo de conferência e bipagem de expedição ativado.');
              setTimeout(() => setBanner(''), 4000);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>verified</span>
            Conferência de Expedição
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

      <ProposalBadge variant="box" ruleId="RF-10">
        O tratamento de pedidos com falta de estoque (demanda descoberta parcial) e a regra de priorização entre canais estão documentados como propostas e aguardam validação com o operador da loja piloto.
      </ProposalBadge>

      {/* Screen State Handling */}
      {screenState === 'loading' && (
        <div className="inv-card inv-state-panel loading">
          <span className="material-symbols-outlined">progress_activity</span>
          <div className="inv-state-title-text">Carregando pedidos e reservas...</div>
          <div className="inv-state-desc-text">
            Consultando estado das reservas ativas no banco de dados e conferindo fila de webhooks.
          </div>
        </div>
      )}

      {screenState === 'empty' && (
        <div className="inv-card inv-state-panel empty">
          <span className="material-symbols-outlined">inbox</span>
          <div className="inv-state-title-text">Nenhum pedido encontrado</div>
          <div className="inv-state-desc-text">
            Não existem pedidos ou reservas ativas correspondentes aos filtros selecionados.
          </div>
        </div>
      )}

      {screenState === 'error' && (
        <div className="inv-card inv-state-panel error">
          <span className="material-symbols-outlined">error</span>
          <div className="inv-state-title-text">Falha ao consultar reservas</div>
          <div className="inv-state-desc-text">
            Não foi possível recuperar a tabela de reservas do banco de dados local. Verifique a conexão com o PostgreSQL.
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
              label="Pedidos em Aberto (Hoje)"
              value="48 pedidos"
              icon="inbox"
              badge={{ text: '42 novos', type: 'info' }}
              subtext="Importados e aguardando processamento"
            />
            <StatCard
              label="Unidades Reservadas"
              value="114 itens"
              icon="lock_clock"
              badge={{ text: 'Comprometidos', type: 'warning' }}
              subtext="Retidos do disponível multicanal"
            />
            <StatCard
              label="Prontos p/ Expedição"
              value="36 pedidos"
              icon="local_shipping"
              badge={{ text: 'Estoque 100%', type: 'success' }}
              subtext="Reserva garantida para bipagem"
            />
            <StatCard
              label="Demanda Descoberta (Falta)"
              value="1 pedido (2 un)"
              icon="warning"
              badge={{ text: 'Atenção RF-10', type: 'danger' }}
              subtext="Saldo insuficiente para reserva integral"
            />
          </div>

          {/* Status Tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 16, overflowX: 'auto', paddingBottom: 4 }}>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${statusTab === 'all' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setStatusTab('all')}
            >
              Todos ({orders.length})
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${statusTab === 'ready' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setStatusTab('ready')}
            >
              Prontos p/ Expedição
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${statusTab === 'picking' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setStatusTab('picking')}
            >
              Em Separação
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${statusTab === 'uncovered' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setStatusTab('uncovered')}
            >
              Demanda Descoberta (Falta)
            </button>
            <button
              type="button"
              className={`inv-btn inv-btn-sm ${statusTab === 'shipped' ? 'inv-btn-primary' : 'inv-btn-secondary'}`}
              onClick={() => setStatusTab('shipped')}
            >
              Expedidos
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
                  placeholder="Buscar por número do pedido, SKU ou cliente..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="inv-select"
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value as 'all' | 'mercadolivre' | 'shopee')}
                aria-label="Filtrar por canal"
              >
                <option value="all">Todos os Canais</option>
                <option value="mercadolivre">Mercado Livre</option>
                <option value="shopee">Shopee</option>
              </select>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Mostrando <strong>{filteredOrders.length}</strong> de {orders.length} pedidos
            </div>
          </div>

          {/* Orders Table */}
          <div className="inv-table-card">
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>Número do Pedido</th>
                    <th>Canal</th>
                    <th>Data &amp; Hora</th>
                    <th>Cliente</th>
                    <th>Itens &amp; SKU</th>
                    <th style={{ textAlign: 'center' }}>Qtd Reservada</th>
                    <th>Status do Pedido</th>
                    <th>Status da Reserva</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.length === 0 ? (
                    <tr>
                      <td colSpan={9} style={{ textAlign: 'center', padding: '36px', color: 'var(--muted)' }}>
                        Nenhum pedido encontrado para os filtros ativos.
                      </td>
                    </tr>
                  ) : (
                    filteredOrders.map((ord) => (
                      <tr key={ord.id}>
                        <td style={{ fontWeight: 700 }}>
                          <div>{ord.orderNumber}</div>
                          {ord.notes && (
                            <small style={{ color: 'var(--muted)', fontSize: 10, display: 'block' }}>
                              {ord.notes}
                            </small>
                          )}
                        </td>
                        <td>
                          <span
                            className={`inv-channel-badge ${
                              ord.channel === 'mercadolivre' ? 'inv-channel-ml' : 'inv-channel-shopee'
                            }`}
                          >
                            {ord.channel === 'mercadolivre' ? 'Mercado Livre' : 'Shopee'}
                          </span>
                        </td>
                        <td style={{ fontSize: 11, color: 'var(--muted)' }}>{ord.placedAt}</td>
                        <td>
                          <div><strong>{ord.customerName}</strong></div>
                          <small style={{ color: 'var(--muted)', fontSize: 11 }}>{ord.customerDocumentMasked}</small>
                        </td>
                        <td>
                          {ord.items.map((it) => (
                            <div key={it.sku} style={{ fontSize: 11 }}>
                              <strong>{it.quantity}x</strong> {it.productName} <span style={{ color: 'var(--muted)' }}>({it.sku})</span>
                            </div>
                          ))}
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span className="inv-num" style={{ fontSize: 13, fontWeight: 750 }}>
                            {ord.reservedQuantity} un
                          </span>
                          {ord.uncoveredDemand > 0 && (
                            <div style={{ color: 'var(--brand-dark)', fontSize: 10, fontWeight: 700 }}>
                              +{ord.uncoveredDemand} un falta
                            </div>
                          )}
                        </td>
                        <td>
                          <span
                            className={`inv-badge ${
                              ord.orderStatus === 'EXPEDIDO'
                                ? 'inv-badge-success'
                                : ord.orderStatus === 'CANCELADO'
                                  ? 'inv-badge-danger'
                                  : ord.orderStatus === 'EM_SEPARACAO'
                                    ? 'inv-badge-warning'
                                    : 'inv-badge-info'
                            }`}
                          >
                            {ord.orderStatus}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`inv-badge ${
                              ord.reservationStatus === 'RESERVADO_INTEGRAL'
                                ? 'inv-badge-success'
                                : ord.reservationStatus === 'FALTA_ESTOQUE'
                                  ? 'inv-badge-danger'
                                  : ord.reservationStatus === 'CONSUMIDA_EXPEDICAO'
                                    ? 'inv-badge-neutral'
                                    : 'inv-badge-info'
                            }`}
                          >
                            {ord.reservationStatus === 'RESERVADO_INTEGRAL'
                              ? 'Reservado Integral'
                              : ord.reservationStatus === 'FALTA_ESTOQUE'
                                ? 'Falta de Estoque'
                                : ord.reservationStatus === 'CONSUMIDA_EXPEDICAO'
                                  ? 'Consumida na Expedição'
                                  : ord.reservationStatus}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {ord.orderStatus !== 'EXPEDIDO' && ord.orderStatus !== 'CANCELADO' ? (
                            <div style={{ display: 'inline-flex', gap: 6 }}>
                              <button
                                type="button"
                                className="inv-btn inv-btn-primary inv-btn-sm"
                                onClick={() => handleExpedite(ord.id)}
                                title="Confirmar separação física e baixa no estoque"
                              >
                                Expedir
                              </button>
                              <button
                                type="button"
                                className="inv-btn inv-btn-danger inv-btn-sm"
                                onClick={() => handleRelease(ord.id)}
                                title="Liberar reserva por cancelamento"
                              >
                                Liberar
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--muted)' }}>Concluído</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="inv-table-footer">
              <span>
                Total de reservas auditadas nesta visão: <strong>{filteredOrders.reduce((acc, o) => acc + o.reservedQuantity, 0)} unidades</strong>
              </span>
              <span style={{ fontSize: 11 }}>Página 1 de 1 • Atualizado via WebSocket em tempo real</span>
            </div>
          </div>

          {/* Operational Invariants Explanatory Card */}
          <div className="inv-card" style={{ marginTop: 20 }}>
            <h2 style={{ fontSize: 14, fontWeight: 750, margin: '0 0 8px' }}>
              Invariantes Operacionais do Fluxo de Pedidos (RF-09 &amp; RF-10)
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
              <div>
                <strong style={{ color: 'var(--text)' }}>1. Reserva no Webhook de Compra:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  A reserva é alocada imediatamente na chegada da notificação de pedido aprovado, reduzindo a disponibilidade multicanal antes de qualquer alteração física no galpão.
                </p>
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>2. Baixa Física Apenas na Expedição:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  O saldo físico do depósito NÃO é baixado no pagamento; a baixa ocorre estritamente na conferência de saída (bipagem de envio), consumindo a reserva sem duplicidade.
                </p>
              </div>
              <div>
                <strong style={{ color: 'var(--text)' }}>3. Cancelamento Pré-Expedição:</strong>
                <p style={{ margin: '4px 0 0' }}>
                  Cancelamentos liberam apenas a reserva comprometida, devolvendo as unidades imediatamente ao disponível de venda. Devoluções pós-envio exigem conferência manual.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
