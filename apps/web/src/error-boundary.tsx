import { Component } from 'react';
import type { PropsWithChildren } from 'react';
import { telemetry } from './telemetry';

export class ErrorBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: Error) {
    telemetry.exception(error, 'RENDER_ERROR');
  }

  render() {
    if (this.state.failed) {
      return <main><h1>Não foi possível exibir esta tela.</h1><a href="/">Atualizar a página</a></main>;
    }
    return this.props.children;
  }
}
