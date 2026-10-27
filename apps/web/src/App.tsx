import { useEffect, useState } from 'react';
import { telemetry } from './telemetry';
import { Access, AccessSettings } from './Access';
import { CatalogScreen } from './catalog/CatalogScreen';

import './inventory/inventory.css';
import type { ViewScreen } from './inventory/types';
import { Shell } from './inventory/components/Shell';
import {Dialog} from './Dialog';
import {SettingsScreen} from './settings/SettingsScreen';
import {StockScreen} from './inventory/StockScreen';
import {MovementScreen,MovementForm} from './inventory/MovementScreen';
import {MovementHistoryScreen} from './inventory/MovementHistoryScreen';
import {InventorySettingsScreen} from './inventory/InventorySettingsScreen';
import {TicketScreen} from './tickets/TicketScreen';

export function App() {
  return import.meta.env.VITE_AUTH_ENABLED === 'true'
    ? <Access><InventoryApp /></Access>
    : <InventoryApp />;
}

function InventoryApp() {
  const [currentScreen,setCurrentScreen]=useState<ViewScreen>(import.meta.env.VITE_CATALOG_ENABLED==='true'?'stock':'diagnostics');
  const [movement,setMovement]=useState(false),[inventoryRevision,setInventoryRevision]=useState(0);
  const inventoryEnabled=import.meta.env.VITE_INVENTORY_ENABLED==='true';
  const saved=()=>setInventoryRevision(value=>value+1);
  return <Shell currentScreen={currentScreen} onNavigate={setCurrentScreen} onOpenMovementModal={()=>{if(inventoryEnabled)setMovement(true);else setCurrentScreen('movement');}}>
    {currentScreen==='catalog'&&import.meta.env.VITE_CATALOG_ENABLED==='true'&&<CatalogScreen/>}
    {currentScreen==='users'&&<AccessSettings/>}
    {currentScreen==='tickets'&&<TicketScreen/>}
    {currentScreen==='settings'&&import.meta.env.VITE_CATALOG_ENABLED==='true'&&(inventoryEnabled?<><SettingsScreen/><InventorySettingsScreen revision={inventoryRevision}/></>:<SettingsScreen/>)}
    {currentScreen==='stock'&&(inventoryEnabled?<StockScreen revision={inventoryRevision}/>:<FeatureNotice title="Estoque físico"/>)}
    {currentScreen==='movement'&&(inventoryEnabled?<MovementScreen revision={inventoryRevision} onSaved={saved}/>:<FeatureNotice title="Movimentações"/>)}
    {currentScreen==='audit'&&(inventoryEnabled?<MovementHistoryScreen revision={inventoryRevision}/>:<FeatureNotice title="Histórico de movimentações"/>)}
    {currentScreen==='diagnostics'&&<Diagnostics/>}
    {movement&&<Dialog title="Lançar movimentação" onClose={()=>setMovement(false)}><MovementForm revision={inventoryRevision} onSaved={()=>{setMovement(false);saved();}} onCancel={()=>setMovement(false)}/></Dialog>}
  </Shell>;
}
function FeatureNotice({title}:{title:string}){
  return <><div className="inv-page-header"><div><div className="inv-page-pretitle">ESTOQUE FÍSICO</div><h1 className="inv-page-title">{title}</h1></div></div><section className="workspace-unavailable"><span className="material-symbols-outlined" aria-hidden="true">inventory_2</span><h2>Integração local ainda desativada</h2><p>Esta área só fica disponível no ambiente Docker local após a migração e ativação do estoque físico.</p></section></>;
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
