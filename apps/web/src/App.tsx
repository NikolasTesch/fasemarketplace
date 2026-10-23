import { useEffect, useState } from 'react';
import { telemetry } from './telemetry';

type ApiStatus = 'loading' | 'ready' | 'unavailable';

export function App() {
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
          const status = response.ok && data.status === 'ready' &&
            data.dependencies?.postgres === true && data.dependencies?.redis === true
            ? 'ready' : 'unavailable';
          setApiStatus(status);
          telemetry.capture('api readiness checked', { status, duration_ms: performance.now() - started });
        }
      } catch {
        if (!controller.signal.aborted) {
          setApiStatus('unavailable');
          telemetry.capture('api readiness checked', { status: 'unavailable', duration_ms: performance.now() - started });
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
    <main>
      <p className="label">FASE SPORT</p>
      <h1>FaseMarketplace</h1>
      <p>{production ? 'Ambiente de Production · Neon' : preview ? 'Ambiente de Preview · Neon' : hybrid ? 'Ambiente de desenvolvimento híbrido · Neon' : 'Ambiente de desenvolvimento local'}</p>
      <section aria-labelledby="status-title">
        <h2 id="status-title">Base técnica do MVP</h2>
        <p><strong>React + Vite + NestJS + TypeScript</strong></p>
        {hybrid && <p>Interface, API e worker no Docker. Banco de desenvolvimento no Neon e Redis local.</p>}
        {preview && <p>Interface na Vercel. API e worker no Docker, banco de desenvolvimento no Neon e Redis local.</p>}
        {production && <p>Interface na Vercel. API e worker em Docker separado, banco de produção no Neon e Redis exclusivo.</p>}
        <p role="status" data-api-status={apiStatus}>API e dependências: {statusLabel}</p>
        <p>Integrações externas simuladas. Funcionalidades de estoque ainda não implementadas.</p>
        <button className="diagnostic-refresh" disabled={apiStatus === 'loading'} onClick={() => {
          telemetry.capture('diagnostic refreshed', { screen: 'bootstrap' });
          setApiStatus('loading');
          setRefreshVersion((version) => version + 1);
        }}>Atualizar diagnóstico</button>
      </section>
    </main>
  );
}
