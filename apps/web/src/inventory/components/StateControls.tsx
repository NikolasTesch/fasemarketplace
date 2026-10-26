import type { ScreenState } from '../types';

interface StateControlsProps {
  currentState: ScreenState;
  onStateChange: (state: ScreenState) => void;
  screenName: string;
}

export function StateControls({ currentState, onStateChange, screenName }: StateControlsProps) {
  return (
    <div className="inv-state-bar" aria-label={`Controle de estado para ${screenName}`}>
      <div className="inv-state-title">
        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>tune</span>
        <span>Simulação de Estados da Tela:</span>
      </div>
      <div className="inv-state-buttons">
        <button
          type="button"
          className={`inv-state-btn ${currentState === 'ready' ? 'active' : ''}`}
          onClick={() => onStateChange('ready')}
        >
          Normal (Pronto)
        </button>
        <button
          type="button"
          className={`inv-state-btn ${currentState === 'loading' ? 'active' : ''}`}
          onClick={() => onStateChange('loading')}
        >
          Carregamento
        </button>
        <button
          type="button"
          className={`inv-state-btn ${currentState === 'empty' ? 'active' : ''}`}
          onClick={() => onStateChange('empty')}
        >
          Vazio
        </button>
        <button
          type="button"
          className={`inv-state-btn ${currentState === 'error' ? 'active' : ''}`}
          onClick={() => onStateChange('error')}
        >
          Erro
        </button>
        <button
          type="button"
          className={`inv-state-btn ${currentState === 'success' ? 'active' : ''}`}
          onClick={() => onStateChange('success')}
        >
          Sucesso
        </button>
      </div>
    </div>
  );
}
