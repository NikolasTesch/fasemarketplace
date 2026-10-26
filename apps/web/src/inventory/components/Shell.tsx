import type { ReactNode } from 'react';
import type { ViewScreen } from '../types';
import logo from '../../assets/fase-sport-logo.svg';
import { useAccessUser } from '../../Access';

interface ShellProps {
  currentScreen: ViewScreen;
  onNavigate: (screen: ViewScreen) => void;
  onOpenMovementModal: () => void;
  children: ReactNode;
}

export function Shell({
  currentScreen,
  onNavigate,
  onOpenMovementModal,
  children,
}: ShellProps) {
  const user = useAccessUser();
  const isHybrid = import.meta.env.VITE_DEVELOPMENT_MODE === 'hybrid';
  const isPreview = import.meta.env.VITE_DEVELOPMENT_MODE === 'preview';
  const isProduction = import.meta.env.VITE_DEVELOPMENT_MODE === 'production';

  const envLabel = isProduction
    ? 'Production · Neon'
    : isPreview
      ? 'Preview · Neon'
      : isHybrid
        ? 'Híbrido · Neon'
        : 'Desenvolvimento Local';

  return (
    <div className="inv-app">
      {/* Sidebar */}
      <aside className="inv-sidebar" aria-label="Navegação do Fase Estoque">
        <div className="inv-sidebar-logo">
          <img src={logo} alt="Fase Sport" className="inv-logo-img" />
          <div className="inv-logo-sub">FASE ESTOQUE • MULTICANAL</div>
        </div>

        <nav className="inv-nav">
          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'stock' ? 'active' : ''}`}
            onClick={() => onNavigate('stock')}
          >
            <span className="material-symbols-outlined">inventory_2</span>
            <span>Estoque e Saldos</span>
          </button>

          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'orders' ? 'active' : ''}`}
            onClick={() => onNavigate('orders')}
          >
            <span className="material-symbols-outlined">shopping_cart</span>
            <span>Pedidos e Reservas</span>
            <span className="inv-nav-badge">48</span>
          </button>

          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'sync' ? 'active' : ''}`}
            onClick={() => onNavigate('sync')}
          >
            <span className="material-symbols-outlined">sync_alt</span>
            <span>Sincronização & Alertas</span>
            <span className="inv-nav-badge" style={{ background: '#fef3c7', color: '#92400e' }}>1</span>
          </button>

          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'audit' ? 'active' : ''}`}
            onClick={() => onNavigate('audit')}
          >
            <span className="material-symbols-outlined">receipt_long</span>
            <span>Histórico e Auditoria</span>
          </button>

          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'analytics' ? 'active' : ''}`}
            onClick={() => onNavigate('analytics')}
          >
            <span className="material-symbols-outlined">trending_up</span>
            <span>Painel Analítico</span>
          </button>

          <div style={{ height: 1, background: 'var(--border)', margin: '8px 0' }} />

          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'movement' ? 'active' : ''}`}
            onClick={() => onNavigate('movement')}
          >
            <span className="material-symbols-outlined" style={{ color: 'var(--brand)' }}>add_circle</span>
            <span style={{ color: 'var(--brand)', fontWeight: 700 }}>Lançar Movimentação</span>
          </button>

          <button
            type="button"
            className={`inv-nav-btn ${currentScreen === 'diagnostics' ? 'active' : ''}`}
            onClick={() => onNavigate('diagnostics')}
          >
            <span className="material-symbols-outlined">terminal</span>
            <span>Diagnóstico do Sistema</span>
          </button>
        </nav>

        <div className="inv-sidebar-footer">
          <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.4 }}>
            <div><strong>Fase Sport Pilot v0.2</strong></div>
            <div>Mercado Livre &amp; Shopee</div>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="inv-main-wrapper">
        <header className="inv-topbar">
          <select className="inv-mobile-nav" aria-label="Navegar entre telas" value={currentScreen}
            onChange={(event) => onNavigate(event.target.value as ViewScreen)}>
            <option value="stock">Estoque e Saldos</option>
            <option value="orders">Pedidos e Reservas</option>
            <option value="sync">Sincronização e Alertas</option>
            <option value="audit">Histórico e Auditoria</option>
            <option value="analytics">Painel Analítico</option>
            <option value="movement">Lançar Movimentação</option>
            <option value="diagnostics">Diagnóstico do Sistema</option>
          </select>
          <div className="inv-topbar-left">
            <span className="inv-env-badge">
              <span className="inv-env-dot" />
              {envLabel}
            </span>
            <span style={{ fontSize: 12, color: 'var(--muted)' }}>
              Depósito Central: <strong>Itaquera / SP</strong>
            </span>
          </div>

          <div className="inv-topbar-right">
            <button
              type="button"
              className="inv-btn inv-btn-primary inv-btn-sm"
              onClick={onOpenMovementModal}
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add</span>
              Lançar Movimentação
            </button>

            <div className="inv-user-chip">
              <div className="inv-user-avatar">{user ? user.name.slice(0, 2).toUpperCase() : 'OP'}</div>
              <span>{user ? user.name : 'Operador demonstrativo'}</span>
            </div>
          </div>
        </header>

        <main className="inv-content">
          <p className="inv-prototype-notice" role="note">
            Protótipo visual — dados fictícios. As ações apenas simulam operações nesta sessão;
            não alteram estoque, pedidos ou marketplaces. Recarregar restaura os exemplos.
          </p>
          {children}
        </main>
      </div>
    </div>
  );
}
