import { useState } from 'react';
import type { ScreenState } from '../types';
import { initialSalesMetrics } from '../mock-data';
import { StatCard } from '../components/StatCard';
import { ProposalBadge } from '../components/ProposalBadge';
import { StateControls } from '../components/StateControls';

export function AnalyticsScreen() {
  const [screenState, setScreenState] = useState<ScreenState>('ready');
  const [channelFilter, setChannelFilter] = useState<'all' | 'ml' | 'shopee'>('all');
  const [period, setPeriod] = useState('30d');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [successBanner, setSuccessBanner] = useState('');

  const metrics = initialSalesMetrics;

  function handleRefresh() {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setSuccessBanner('Métricas consolidadas atualizadas com sucesso dos marketplaces.');
      setTimeout(() => setSuccessBanner(''), 4000);
    }, 700);
  }

  // Calculate filtered values
  const units =
    channelFilter === 'ml'
      ? metrics.mlUnits
      : channelFilter === 'shopee'
        ? metrics.shopeeUnits
        : metrics.totalUnitsSold;

  const revenue =
    channelFilter === 'ml'
      ? metrics.mlRevenue
      : channelFilter === 'shopee'
        ? metrics.shopeeRevenue
        : metrics.grossRevenue;

  const ticket =
    channelFilter === 'ml'
      ? metrics.mlTicket
      : channelFilter === 'shopee'
        ? metrics.shopeeTicket
        : metrics.averageTicket;

  return (
    <div>
      <StateControls
        currentState={screenState}
        onStateChange={setScreenState}
        screenName="Painel Analítico de Vendas"
      />

      {/* Header */}
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">
            INTELIGÊNCIA COMERCIAL & MULTICANAL • RF-18 / RF-19 / RF-20
          </div>
          <h1 className="inv-page-title">Painel Analítico de Vendas</h1>
          <p className="inv-page-desc">
            Acompanhamento consolidado de vendas elegíveis, faturamento bruto, ticket médio e métricas oficiais de audiência fornecidas por Mercado Livre e Shopee.
          </p>
        </div>

        <div className="inv-page-actions">
          <select
            className="inv-select"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            aria-label="Período"
          >
            <option value="7d">Últimos 7 dias</option>
            <option value="15d">Últimos 15 dias</option>
            <option value="30d">Últimos 30 dias (23/09 a 23/10/2026)</option>
            <option value="90d">Últimos 90 dias</option>
          </select>

          <select
            className="inv-select"
            value={channelFilter}
            onChange={(e) => setChannelFilter(e.target.value as 'all' | 'ml' | 'shopee')}
            aria-label="Canal de Venda"
          >
            <option value="all">Consolidado (ML & Shopee)</option>
            <option value="ml">Mercado Livre Oficial</option>
            <option value="shopee">Shopee Oficial</option>
          </select>

          <button
            type="button"
            className="inv-btn inv-btn-secondary"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <span
              className="material-symbols-outlined"
              style={{ fontSize: 16, animation: isRefreshing ? 'spin 1s linear infinite' : 'none' }}
            >
              sync
            </span>
            {isRefreshing ? 'Atualizando...' : 'Atualizar Dados'}
          </button>
        </div>
      </div>

      {successBanner && (
        <div className="inv-banner-success" role="status">
          <span>{successBanner}</span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            onClick={() => setSuccessBanner('')}
          >
            ✕
          </button>
        </div>
      )}

      <ProposalBadge variant="box" ruleId="RF-18 / RF-19 / RF-20">
        As definições de pedidos elegíveis para métricas comerciais (ex: desconsideração de cancelamentos antes da emissão), granularidade e escopos de acesso aos relatórios de tráfego dependem de homologação dos contratos de API de cada canal.
      </ProposalBadge>

      {/* Screen State Handling */}
      {screenState === 'loading' && (
        <div className="inv-card inv-state-panel loading">
          <span className="material-symbols-outlined">progress_activity</span>
          <div className="inv-state-title-text">Carregando métricas de vendas...</div>
          <div className="inv-state-desc-text">
            Consultando agregações de pedidos locais e endpoints de audiência de Mercado Livre e Shopee.
          </div>
        </div>
      )}

      {screenState === 'empty' && (
        <div className="inv-card inv-state-panel empty">
          <span className="material-symbols-outlined">analytics</span>
          <div className="inv-state-title-text">Nenhuma venda registrada no período</div>
          <div className="inv-state-desc-text">
            Não foram identificados pedidos faturados ou elegíveis entre as datas selecionadas. Tente ampliar o intervalo de busca.
          </div>
        </div>
      )}

      {screenState === 'error' && (
        <div className="inv-card inv-state-panel error">
          <span className="material-symbols-outlined">error</span>
          <div className="inv-state-title-text">Erro ao consolidar métricas dos canais</div>
          <div className="inv-state-desc-text">
            A API de relatórios da Shopee retornou HTTP 503 (Serviço temporariamente indisponível). Os saldos locais continuam preservados.
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
          {/* KPI Cards Grid */}
          <div className="inv-kpi-grid">
            <StatCard
              label="Unidades Vendidas"
              value={`${units.toLocaleString('pt-BR')} un`}
              icon="trending_up"
              badge={{ text: `+${metrics.unitsGrowthPercent}%`, type: 'success' }}
              subtext={
                <span style={{ fontSize: 11 }}>
                  ML: {metrics.mlUnits} un • Shopee: {metrics.shopeeUnits} un
                </span>
              }
            />

            <StatCard
              label="Receita Bruta"
              value={`R$ ${revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon="payments"
              badge={{ text: `+${metrics.revenueGrowthPercent}%`, type: 'success' }}
              subtext={
                <span style={{ fontSize: 11 }}>
                  ML: R$ {(metrics.mlRevenue / 1000).toFixed(1)}k • Shopee: R$ {(metrics.shopeeRevenue / 1000).toFixed(1)}k
                </span>
              }
            />

            <StatCard
              label="Ticket Médio"
              value={`R$ ${ticket.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
              icon="receipt"
              badge={{ text: `+${metrics.ticketGrowthPercent}%`, type: 'success' }}
              subtext={
                <span style={{ fontSize: 11 }}>
                  ML: R$ {metrics.mlTicket.toFixed(2)} • Shopee: R$ {metrics.shopeeTicket.toFixed(2)}
                </span>
              }
            />

            <StatCard
              label="Produto Mais Vendido"
              value={metrics.topProduct.name}
              icon="star"
              subtext={
                <span style={{ fontSize: 11 }}>
                  SKU: <strong>{metrics.topProduct.sku}</strong> • {metrics.topProduct.unitsSold} un
                </span>
              }
            />
          </div>

          {/* Two-Column Section: Evolution Chart + Top SKUs */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 360px), 1fr))', gap: 16, marginBottom: 24 }}>
            {/* Left: Evolution & Share */}
            <div className="inv-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 750, margin: 0 }}>
                  Vendas por Marketplace (Evolução Semanal)
                </h2>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Últimos 30 dias</span>
              </div>

              {/* Share Bar */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 6 }}>
                  <span>
                    <strong>Mercado Livre:</strong> 64% (R$ 118,4k)
                  </span>
                  <span>
                    <strong>Shopee:</strong> 36% (R$ 65,8k)
                  </span>
                </div>
                <div style={{ height: 8, background: '#e2e8f0', borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                  <div style={{ width: '64%', background: '#f59e0b' }} title="Mercado Livre 64%" />
                  <div style={{ width: '36%', background: '#ef4444' }} title="Shopee 36%" />
                </div>
              </div>

              {/* Weekly Evolution Inline SVG Chart */}
              <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 8, padding: 16 }}>
                <svg viewBox="0 0 400 160" style={{ width: '100%', height: 'auto', display: 'block' }}>
                  {/* Grid lines */}
                  <line x1="40" y1="20" x2="380" y2="20" stroke="#e5e7eb" strokeDasharray="3,3" />
                  <line x1="40" y1="60" x2="380" y2="60" stroke="#e5e7eb" strokeDasharray="3,3" />
                  <line x1="40" y1="100" x2="380" y2="100" stroke="#e5e7eb" strokeDasharray="3,3" />
                  <line x1="40" y1="130" x2="380" y2="130" stroke="#9ca3af" />

                  {/* Y Axis labels */}
                  <text x="32" y="24" fontSize="9" fill="#9ca3af" textAnchor="end">400</text>
                  <text x="32" y="64" fontSize="9" fill="#9ca3af" textAnchor="end">250</text>
                  <text x="32" y="104" fontSize="9" fill="#9ca3af" textAnchor="end">100</text>
                  <text x="32" y="134" fontSize="9" fill="#9ca3af" textAnchor="end">0</text>

                  {/* ML Bar Group (yellow) */}
                  <rect x="70" y="55" width="22" height="75" fill="#f59e0b" rx="2" />
                  <rect x="150" y="47" width="22" height="83" fill="#f59e0b" rx="2" />
                  <rect x="230" y="42" width="22" height="88" fill="#f59e0b" rx="2" />
                  <rect x="310" y="38" width="22" height="92" fill="#f59e0b" rx="2" />

                  {/* Shopee Bar Group (red) */}
                  <rect x="96" y="85" width="22" height="45" fill="#ef4444" rx="2" />
                  <rect x="176" y="79" width="22" height="51" fill="#ef4444" rx="2" />
                  <rect x="256" y="75" width="22" height="55" fill="#ef4444" rx="2" />
                  <rect x="336" y="72" width="22" height="58" fill="#ef4444" rx="2" />

                  {/* X labels */}
                  <text x="94" y="148" fontSize="9" fill="#6b7280" textAnchor="middle">Semana 1</text>
                  <text x="174" y="148" fontSize="9" fill="#6b7280" textAnchor="middle">Semana 2</text>
                  <text x="254" y="148" fontSize="9" fill="#6b7280" textAnchor="middle">Semana 3</text>
                  <text x="334" y="148" fontSize="9" fill="#6b7280" textAnchor="middle">Semana 4</text>
                </svg>

                <div style={{ display: 'flex', justifyContent: 'center', gap: 20, marginTop: 10, fontSize: 11 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#f59e0b', borderRadius: 2 }} />
                    Mercado Livre
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 10, height: 10, background: '#ef4444', borderRadius: 2 }} />
                    Shopee
                  </span>
                </div>
              </div>
            </div>

            {/* Right: Top 5 SKUs */}
            <div className="inv-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <h2 style={{ fontSize: 15, fontWeight: 750, margin: 0 }}>
                  Top 5 SKUs da Fase Sport
                </h2>
                <span style={{ fontSize: 11, color: 'var(--muted)' }}>Por volume de vendas</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {metrics.topSkus.map((sku, idx) => (
                  <div key={sku.sku} style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span style={{ fontWeight: 650 }}>
                        <span style={{ color: 'var(--brand)', marginRight: 6 }}>#{idx + 1}</span>
                        {sku.productName}
                      </span>
                      <span className="inv-num">
                        {sku.unitsSold} un • R$ {(sku.revenue / 1000).toFixed(1)}k
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 6, background: '#f1f1f4', borderRadius: 3, overflow: 'hidden' }}>
                        <div
                          style={{
                            width: `${sku.sharePercent * 2.5}%`,
                            height: '100%',
                            background: idx === 0 ? 'var(--brand)' : '#6b7280',
                            borderRadius: 3,
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 10, color: 'var(--muted)', width: 34, textAlign: 'right' }}>
                        {sku.sharePercent}%
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Section: Official Audience & Interest Metrics (RF-19 / RF-20) */}
          <div className="inv-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
              <div>
                <div className="inv-page-pretitle" style={{ marginBottom: 2 }}>
                  RF-19 / RF-20 • DADOS AGREGADOS AUTORIZADOS
                </div>
                <h2 style={{ fontSize: 16, fontWeight: 750, margin: 0 }}>
                  Métricas Oficiais de Audiência &amp; Interesse nos Marketplaces
                </h2>
                <p style={{ fontSize: 12, color: 'var(--muted)', margin: '4px 0 0' }}>
                  Conforme RF-20 do PRD: dados oficiais de tráfego somente são exibidos quando disponibilizados pelo canal; métricas indisponíveis não são calculadas nem inferidas.
                </p>
              </div>
              <ProposalBadge ruleId="RF-19" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: 16 }}>
              {/* Mercado Livre Official */}
              <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="inv-channel-badge inv-channel-ml">
                    Mercado Livre Oficial
                  </span>
                  <span className="inv-badge inv-badge-success" style={{ fontSize: 10 }}>
                    Relatório Ativo
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Visitas aos Anúncios</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }} className="inv-num">
                      {metrics.officialMetrics.ml.adVisits.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Conversão Média</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-success-text)' }} className="inv-num">
                      {metrics.officialMetrics.ml.averageConversionRate}%
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Perguntas Recebidas</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }} className="inv-num">
                      {metrics.officialMetrics.ml.questionsReceived}
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  Fonte: {metrics.officialMetrics.ml.sourceInfo}
                </div>
              </div>

              {/* Shopee Official */}
              <div style={{ background: '#fafafa', border: '1px solid var(--border)', borderRadius: 10, padding: 18 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <span className="inv-channel-badge inv-channel-shopee">
                    Shopee Oficial
                  </span>
                  <span className="inv-badge inv-badge-success" style={{ fontSize: 10 }}>
                    Relatório Ativo
                  </span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12 }}>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Views de Produto</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }} className="inv-num">
                      {metrics.officialMetrics.shopee.productViews.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Cliques Loja</span>
                    <div style={{ fontSize: 18, fontWeight: 800 }} className="inv-num">
                      {metrics.officialMetrics.shopee.shopClicks.toLocaleString('pt-BR')}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: 'var(--muted)', textTransform: 'uppercase' }}>Taxa Conversão</span>
                    <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--status-success-text)' }} className="inv-num">
                      {metrics.officialMetrics.shopee.conversionRate}%
                    </div>
                  </div>
                </div>

                <div style={{ fontSize: 11, color: 'var(--muted)', borderTop: '1px solid var(--border)', paddingTop: 8 }}>
                  Fonte: {metrics.officialMetrics.shopee.sourceInfo}
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
