import { useEffect, useState } from 'react';
import { telemetry } from './telemetry';
import { Access } from './Access';

import './inventory/inventory.css';
import type { ViewScreen, SkuStockItem } from './inventory/types';
import { initialStockItems } from './inventory/mock-data';
import { Shell } from './inventory/components/Shell';
import { MovementModal } from './inventory/components/MovementModal';
import { StockScreen } from './inventory/screens/StockScreen';
import { OrdersScreen } from './inventory/screens/OrdersScreen';
import { SyncScreen } from './inventory/screens/SyncScreen';
import { AuditScreen } from './inventory/screens/AuditScreen';
import { AnalyticsScreen } from './inventory/screens/AnalyticsScreen';
import { MovementScreen } from './inventory/screens/MovementScreen';

export function App() {
  return import.meta.env.VITE_AUTH_ENABLED === 'true'
    ? <Access><InventoryApp /></Access>
    : <InventoryApp />;
}

function InventoryApp() {
  const [currentScreen, setCurrentScreen] = useState<ViewScreen>('stock');
  const [stockItems, setStockItems] = useState<SkuStockItem[]>(initialStockItems);
  const [isMovementModalOpen, setIsMovementModalOpen] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState('');

  function handleMovementCreated(movement: {
    sku: string;
    productName: string;
    type: 'ENTRADA' | 'SAIDA' | 'AJUSTE';
    quantity: number;
    reason: string;
    documentRef: string;
    operator: string;
    notes: string;
  }) {
    setStockItems((prev) =>
      prev.map((it) => {
        if (it.sku === movement.sku) {
          let newPhysical = it.physicalStock;
          if (movement.type === 'ENTRADA') newPhysical += movement.quantity;
          else if (movement.type === 'SAIDA') newPhysical = Math.max(0, newPhysical - movement.quantity);
          else newPhysical = Math.max(0, movement.quantity);

          // PRD Invariant: Available = max(0, physical - reserved - margin)
          const newAvailable = Math.max(0, newPhysical - it.reservedStock - it.safetyMargin);

          return {
            ...it,
            physicalStock: newPhysical,
            availableStock: newAvailable,
            lastUpdated: 'agora mesmo',
            channelStatus: {
              ml: { ...it.channelStatus.ml, observedStock: newAvailable },
              shopee: { ...it.channelStatus.shopee, observedStock: newAvailable },
            },
          };
        }
        return it;
      })
    );

    setFeedbackBanner(
      `Movimentação física de ${movement.quantity} un no SKU ${movement.sku} processada com sucesso. Disponibilidade multicanal recalculada.`
    );
    setTimeout(() => setFeedbackBanner(''), 6000);
  }

  return (
    <Shell
      currentScreen={currentScreen}
      onNavigate={setCurrentScreen}
      onOpenMovementModal={() => setIsMovementModalOpen(true)}
    >
      {feedbackBanner && (
        <div className="inv-banner-success" role="status">
          <span>{feedbackBanner}</span>
          <button
            type="button"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit' }}
            onClick={() => setFeedbackBanner('')}
          >
            ✕
          </button>
        </div>
      )}

      {currentScreen === 'stock' && (
        <StockScreen
          stockItems={stockItems}
          onOpenMovementModal={() => setIsMovementModalOpen(true)}
          onNavigateToAudit={() => setCurrentScreen('audit')}
        />
      )}

      {currentScreen === 'orders' && <OrdersScreen />}

      {currentScreen === 'sync' && <SyncScreen />}

      {currentScreen === 'audit' && (
        <AuditScreen onOpenMovementModal={() => setIsMovementModalOpen(true)} />
      )}

      {currentScreen === 'analytics' && <AnalyticsScreen />}

      {currentScreen === 'movement' && (
        <MovementScreen
          stockItems={stockItems}
          onMovementCreated={handleMovementCreated}
          onNavigateToStock={() => setCurrentScreen('stock')}
        />
      )}

      {currentScreen === 'diagnostics' && (
        <Diagnostics onBack={() => setCurrentScreen('stock')} />
      )}

      <MovementModal
        isOpen={isMovementModalOpen}
        onClose={() => setIsMovementModalOpen(false)}
        stockItems={stockItems}
        onMovementCreated={handleMovementCreated}
      />
    </Shell>
  );
}

type ApiStatus = 'loading' | 'ready' | 'unavailable';

function Diagnostics({ onBack }: { onBack?: () => void }) {
  const hybrid = import.meta.env.VITE_DEVELOPMENT_MODE === 'hybrid';
  const preview = import.meta.env.VITE_DEVELOPMENT_MODE === 'preview';
  const production = import.meta.env.VITE_DEVELOPMENT_MODE === 'production';
  const [apiStatus, setApiStatus] = useState<ApiStatus>('loading');
  const [refreshVersion, setRefreshVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();

    async function checkApi() {
      const started = performance.now();
      try {
        const base = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');
        if (base !== '/api' && (!base.startsWith('https://') || new URL(base).origin !== base)) {
          throw new Error('Invalid API origin');
        }
        const response = await fetch(`${base}/health/ready`, {
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(15000)]),
          cache: 'no-store',
        });
        const data = await response.json();
        if (!controller.signal.aborted) {
          const status =
            response.ok &&
            data.status === 'ready' &&
            data.dependencies?.postgres === true &&
            data.dependencies?.redis === true
              ? 'ready'
              : 'unavailable';
          setApiStatus(status);
          telemetry.capture('api readiness checked', { status, duration_ms: performance.now() - started });
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus('unavailable');
          telemetry.capture('api readiness checked', {
            status: 'unavailable',
            duration_ms: performance.now() - started,
          });
        }
      }
    }

    void checkApi();
    return () => controller.abort();
  }, [refreshVersion]);

  const statusLabel = {
    loading: 'verificando…',
    ready: 'disponíveis',
    unavailable: 'indisponíveis',
  }[apiStatus];

  return (
    <div style={{ maxWidth: 800 }}>
      <div className="inv-page-header">
        <div>
          <div className="inv-page-pretitle">DIAGNÓSTICO TÉCNICO • DOCKER & NEON</div>
          <h1 className="inv-page-title">Saúde da Base do MVP</h1>
          <p className="inv-page-desc">
            Verificação de prontidão da API NestJS, PostgreSQL e Redis conforme especificações SPEC-001 a SPEC-007.
          </p>
        </div>
        {onBack && (
          <button type="button" className="inv-btn inv-btn-secondary" onClick={onBack}>
            <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_back</span>
            Voltar ao Estoque
          </button>
        )}
      </div>

      <div className="inv-card" style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 16, fontWeight: 750, margin: '0 0 12px' }}>Estado da Conexão</h2>
        <p style={{ margin: '0 0 8px', color: 'var(--muted)' }}>
          {production
            ? 'Ambiente de Production · Neon'
            : preview
              ? 'Ambiente de Preview · Neon'
              : hybrid
                ? 'Ambiente de desenvolvimento híbrido · Neon'
                : 'Ambiente de desenvolvimento local'}
        </p>

        <div style={{ background: '#fafafa', padding: 14, borderRadius: 8, margin: '14px 0', border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700 }}>
            <span
              className="inv-env-dot"
              style={{
                background: apiStatus === 'ready' ? '#10b981' : apiStatus === 'loading' ? '#f59e0b' : '#ef4444',
              }}
            />
            API e Dependências: <span style={{ textTransform: 'capitalize' }}>{statusLabel}</span>
          </div>
          <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 4 }}>
            Stack: React 19 + Vite 8 + NestJS + PostgreSQL 17 + Redis 7.4
          </div>
        </div>

        <button
          type="button"
          className="inv-btn inv-btn-secondary inv-btn-sm"
          disabled={apiStatus === 'loading'}
          onClick={() => {
            telemetry.capture('diagnostic refreshed', { screen: 'bootstrap' });
            setApiStatus('loading');
            setRefreshVersion((v) => v + 1);
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>refresh</span>
          Atualizar diagnóstico agora
        </button>
      </div>
    </div>
  );
}
