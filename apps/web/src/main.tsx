import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { ErrorBoundary } from './error-boundary';
import { initializeTelemetry, telemetry } from './telemetry';
import './styles.css';

void initializeTelemetry();

createRoot(document.getElementById('root')!, {
  onUncaughtError: (error) => telemetry.exception(error, 'RENDER_ERROR'),
  onRecoverableError: (error) => telemetry.exception(error, 'RENDER_ERROR'),
}).render(
  <StrictMode>
    <ErrorBoundary><App /></ErrorBoundary>
  </StrictMode>,
);
