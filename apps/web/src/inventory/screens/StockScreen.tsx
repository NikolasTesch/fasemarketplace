import { useState } from 'react';
import type { ScreenState, SkuStockItem } from '../types';
import { StatCard } from '../components/StatCard';
import { ProposalBadge } from '../components/ProposalBadge';
import { StateControls } from '../components/StateControls';

interface StockScreenProps {
  stockItems: SkuStockItem[];
  onOpenMovementModal: () => void;
  onNavigateToAudit: () => void;
}

export function StockScreen({
  stockItems,
  onOpenMovementModal,
  onNavigateToAudit,
}: StockScreenProps) {
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockLevelFilter, setStockLevelFilter] = useState<'ALL' | 'CRITICAL' | 'NORMAL'>('ALL');
  const [banner, setBanner] = useState('');

  // Total metrics
  const totalPhysical = stockItems.reduce((acc, it) => acc + it.physicalStock, 0);
  const totalReserved = stockItems.reduce((acc, it) => acc + it.reservedStock, 0);
  const totalMargin = stockItems.reduce((acc, it) => acc + it.safetyMargin, 0);
  const totalAvailable = stockItems.reduce((acc, it) => acc + it.availableStock, 0);

  const filteredItems = stockItems.filter((item) => {
    if (categoryFilter !== 'ALL' && item.category !== categoryFilter) return false;
    if (stockLevelFilter === 'CRITICAL' && item.availableStock > 0) return false;
    if (stockLevelFilter === 'NORMAL' && item.availableStock <= 0) return false;

    if (search.trim()) {
      const q = search.toLowerCase();
      const matchSku = item.sku.toLowerCase().includes(q);
      const matchName = item.productName.toLowerCase().includes(q);
      const matchVariant = item.variantName.toLowerCase().includes(q);
      const matchBarcode = item.barcode.includes(q);
      if (!matchSku && !matchName && !matchVariant && !matchBarcode) return false;
    }
    return true;
  });

  return (
    <div>
      <StateControls
        currentState={screenState}
        onStateChange={setScreenState}
        screenName="Estoque e Saldos"
      />

      {/* Header */}
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">
            VISÃO OPERACIONAL • RF-02 / RF-03 / RF-04
          </div>
          <h1 className="inv-page-title">Estoque e Saldos Centrais</h1>
          <p className="inv-page-desc">
            Controle de saldo próprio, reservas ativas e disponibilidade sincronizada com Mercado Livre e Shopee.
          </p>
        </div>

        <div className="inv-page-actions">
          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={() => {
              setBanner('Exportação CSV de inventário pronta para download.');
              setTimeout(() => setBanner(''), 4000);
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>download</span>
            Exportar CSV
          </button>
          <button
            type="button"
            className="inv-btn inv-btn-primary"
            onClick={onOpenMovementModal}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
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

      <ProposalBadge variant="box" ruleId="RF-04 / RF-15">
        A margem de segurança configurada por variante e a política de alocação de estoque entre múltiplos canais simultâneos são premissas propostas no PRD, sujeitas a homologação operacional com a loja piloto.
      </ProposalBadge>

      {/* States */}
      {screenState === 'loading' && (
        <div className="inv-card inv-state-panel loading">
          <span className="material-symbols-outlined">progress_activity</span>
          <div className="inv-state-title-text">Carregando saldos de inventário...</div>
          <div className="inv-state-desc-text">
            Consultando depósitos e calculando fórmula de disponibilidade em tempo real.
          </div>
        </div>
      )}

      {screenState === 'empty' && (
        <div className="inv-card inv-state-panel empty">
          <span className="material-symbols-outlined">inventory_2</span>
          <div className="inv-state-title-text">Nenhum SKU encontrado</div>
          <div className="inv-state-desc-text">
            Nenhum produto cadastrado corresponde aos critérios de pesquisa ou filtros selecionados.
          </div>
        </div>
      )}

      {screenState === 'error' && (
        <div className="inv-card inv-state-panel error">
          <span className="material-symbols-outlined">error</span>
          <div className="inv-state-title-text">Falha ao consultar saldos</div>
          <div className="inv-state-desc-text">
            Ocorreu uma falha no cálculo de disponibilidade. Verifique o status da API NestJS.
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
              label="Físico Total no Depósito"
              value={`${totalPhysical.toLocaleString('pt-BR')} un`}
              icon="warehouse"
              badge={{ text: '100% OPERACIONAL', type: 'success' }}
              subtext="Depósito Principal Itaquera / SP"
            />
            <StatCard
              label="Reservas Ativas"
              value={`${totalReserved.toLocaleString('pt-BR')} un`}
              icon="pending_actions"
              badge={{ text: 'Pedidos Hoje', type: 'warning' }}
              subtext="Comprometidas com pedidos"
            />
            <StatCard
              label="Margem de Segurança"
              value={`${totalMargin.toLocaleString('pt-BR')} un`}
              icon="shield"
              badge={{ text: 'Proteção', type: 'info' }}
              subtext="Prevenção contra overselling"
            />
            <StatCard
              label="Global Disponível para Venda"
              value={`${totalAvailable.toLocaleString('pt-BR')} un`}
              icon="storefront"
              badge={{ text: 'Sincronizado', type: 'success' }}
              subtext="Físico − Reservas − Margem"
            />
          </div>

          {/* Filter Bar */}
          <div className="inv-filter-bar">
            <div className="inv-filter-group">
              <div className="inv-search-input-wrap">
                <span className="material-symbols-outlined">search</span>
                <input
                  type="text"
                  className="inv-input inv-search-input"
                  placeholder="Buscar por SKU, Produto ou Código de Barras..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <select
                className="inv-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrar Categoria"
              >
                <option value="ALL">Todas as Categorias</option>
                <option value="Vestuário Esportivo">Vestuário Esportivo</option>
                <option value="Linha Casual">Linha Casual</option>
                <option value="Bermudas e Shorts">Bermudas e Shorts</option>
                <option value="Acessórios">Acessórios</option>
                <option value="Equipamentos">Equipamentos</option>
              </select>

              <select
                className="inv-select"
                value={stockLevelFilter}
                onChange={(e) => setStockLevelFilter(e.target.value as 'ALL' | 'CRITICAL' | 'NORMAL')}
                aria-label="Nível de Estoque"
              >
                <option value="ALL">Todos os Níveis</option>
                <option value="NORMAL">Estoque Normal</option>
                <option value="CRITICAL">Estoque Zerado / Crítico</option>
              </select>
            </div>

            <div style={{ fontSize: 12, color: 'var(--muted)' }}>
              Mostrando <strong>{filteredItems.length}</strong> de {stockItems.length} SKUs cadastrados
            </div>
          </div>

          {/* Table */}
          <div className="inv-table-card">
            <div className="inv-table-wrap">
              <table className="inv-table">
                <thead>
                  <tr>
                    <th>SKU</th>
                    <th>Produto &amp; Variante</th>
                    <th style={{ textAlign: 'center' }}>Saldo Físico</th>
                    <th style={{ textAlign: 'center' }}>Reservado</th>
                    <th style={{ textAlign: 'center' }}>Margem</th>
                    <th style={{ textAlign: 'center' }}>Disponível</th>
                    <th>Status nos Canais</th>
                    <th style={{ textAlign: 'right' }}>Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const isZero = item.availableStock === 0;

                    return (
                      <tr key={item.id}>
                        <td>
                          <code style={{ fontSize: 12, fontWeight: 700 }}>{item.sku}</code>
                          <div style={{ fontSize: 10, color: 'var(--muted)' }}>EAN: {item.barcode}</div>
                        </td>
                        <td>
                          <strong>{item.productName}</strong>
                          <div style={{ fontSize: 11, color: 'var(--muted)' }}>
                            {item.variantName} • <span style={{ color: '#4b5563' }}>{item.category}</span>
                          </div>
                        </td>
                        <td style={{ textAlign: 'center', fontWeight: 700 }} className="inv-num">
                          {item.physicalStock} un
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--muted)' }} className="inv-num">
                          {item.reservedStock} un
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--muted)' }} className="inv-num">
                          {item.safetyMargin} un
                        </td>
                        <td style={{ textAlign: 'center' }}>
                          <span
                            className="inv-num"
                            style={{
                              fontSize: 14,
                              fontWeight: 800,
                              color: isZero ? 'var(--brand-dark)' : 'var(--status-success-text)',
                            }}
                          >
                            {item.availableStock} un
                          </span>
                          {isZero && (
                            <div style={{ fontSize: 10, color: 'var(--brand-dark)', fontWeight: 700 }}>
                              ESGOTADO
                            </div>
                          )}
                        </td>
                        <td>
                          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                            <span
                              className={`inv-channel-badge inv-channel-ml`}
                              title={`Anúncio ${item.channelStatus.ml.listingId}`}
                            >
                              ML: {item.channelStatus.ml.observedStock} un
                            </span>
                            <span
                              className={`inv-channel-badge inv-channel-shopee`}
                              title={`Item ${item.channelStatus.shopee.itemId}`}
                              style={{
                                borderColor: item.channelStatus.shopee.synced ? undefined : '#f87171',
                              }}
                            >
                              SHP: {item.channelStatus.shopee.observedStock} un
                              {!item.channelStatus.shopee.synced && ' ⚠️'}
                            </span>
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 2 }}>
                            Atualizado {item.lastUpdated}
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          <div style={{ display: 'inline-flex', gap: 6 }}>
                            <button
                              type="button"
                              className="inv-btn inv-btn-secondary inv-btn-sm"
                              onClick={onOpenMovementModal}
                            >
                              Movimentar
                            </button>
                            <button
                              type="button"
                              className="inv-btn inv-btn-secondary inv-btn-sm"
                              onClick={onNavigateToAudit}
                            >
                              Histórico
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="inv-table-footer">
              <span>
                Fórmula de Disponibilidade: <code>Disponível = max(0, Físico − Reservas − Margem)</code>
              </span>
              <span style={{ fontSize: 11 }}>Depósito Único Itaquera • Próximo recálculo automático</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
