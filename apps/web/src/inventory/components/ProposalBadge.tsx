import type { ReactNode } from 'react';

interface ProposalBadgeProps {
  ruleId?: string;
  children?: ReactNode;
  variant?: 'inline' | 'box';
}

export function ProposalBadge({ ruleId, children, variant = 'inline' }: ProposalBadgeProps) {
  if (variant === 'box') {
    return (
      <aside className="inv-proposal-box" role="note">
        <span className="material-symbols-outlined" aria-hidden="true">
          help_outline
        </span>
        <div>
          <div>
            <strong>Regra Proposta (Aguardando Homologação)</strong>
            {ruleId && <span className="inv-proposal-badge" style={{ marginLeft: 6 }}>{ruleId}</span>}
          </div>
          <div>{children}</div>
        </div>
      </aside>
    );
  }

  return (
    <span
      className="inv-proposal-badge"
      title="Esta regra ou cálculo é uma proposta preliminar definida no PRD e aguarda homologação operacional formal."
    >
      Proposta {ruleId ? `• ${ruleId}` : ''}
    </span>
  );
}
