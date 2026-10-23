import { createReporter, filterEvent, resolveTelemetryConfig } from '@fasemarketplace/telemetry';
import type { PostHog, PostHogConfig } from 'posthog-js';

const config = resolveTelemetryConfig({
  mode: import.meta.env.VITE_TELEMETRY_MODE,
  environment: import.meta.env.VITE_TELEMETRY_ENVIRONMENT ?? 'local',
  release: import.meta.env.VITE_APP_RELEASE ?? 'development',
  token: import.meta.env.VITE_POSTHOG_PROJECT_TOKEN,
  host: import.meta.env.VITE_POSTHOG_HOST,
});

// A local development session must never masquerade as production analytics.
if (import.meta.env.DEV && config.environment !== 'local') {
  config.mode = 'off';
  config.disabledReason = 'environment mismatch';
}
let client: PostHog | undefined;
let started = false;
let failed = false;
const pending: Array<() => void> = [];

function dispatch(action: () => void) {
  if (failed) return;
  if (client) action();
  else if (pending.length < 20) pending.push(action);
}

export const telemetry = createReporter(config, 'web', {
  capture: (name, properties) => {
    if (config.mode === 'console') console.info('[telemetry]', { event: name, properties });
    else dispatch(() => client?.capture(name, properties));
  },
  exception: (error, properties) => {
    if (config.mode === 'console') console.info('[telemetry]', { event: '$exception', properties, stack: error.stack });
    else dispatch(() => client?.captureException(error, properties));
  },
});

export async function initializeTelemetry() {
  if (config.disabledReason && !started) console.warn('Configuração de telemetria inválida; coleta desligada.');
  if (started || config.mode === 'off') return;
  started = true;
  window.addEventListener('error', (event) => telemetry.exception(event.error, 'UNHANDLED_ERROR'));
  window.addEventListener('unhandledrejection', (event) => telemetry.exception(event.reason, 'UNHANDLED_REJECTION'));
  if (config.mode === 'posthog') {
    try {
      const posthog = (await import('posthog-js')).default;
      const options: Partial<PostHogConfig> = {
        api_host: config.host,
        autocapture: false,
        capture_pageview: false,
        capture_pageleave: false,
        capture_exceptions: false,
        capture_dead_clicks: false,
        rageclick: false,
        capture_heatmaps: false,
        capture_performance: false,
        disable_session_recording: true,
        disable_surveys: true,
        disable_external_dependency_loading: true,
        advanced_disable_flags: true,
        person_profiles: 'never',
        persistence: 'memory',
        disable_persistence: true,
        save_referrer: false,
        save_campaign_params: false,
        get_current_url: () => `${window.location.origin}/`,
        ip: false,
        request_queue_config: { flush_interval_ms: 1000 },
        before_send: (event) => filterEvent(event, config, 'web'),
        // Stop accepting further events after a transport error for this page load.
        on_request_error: () => { failed = true; pending.length = 0; },
      };
      client = posthog.init(config.token!, options, 'fasemarketplace');
      if (!client) throw new Error('SDK initialization failed');
      for (const action of pending.splice(0)) {
        try { action(); } catch { /* Best effort; application startup continues. */ }
      }
    } catch {
      failed = true;
      pending.length = 0;
      console.warn('Telemetria indisponível; a aplicação continuará funcionando.');
    }
  }
  telemetry.capture('screen viewed', { screen: 'bootstrap' });
}
