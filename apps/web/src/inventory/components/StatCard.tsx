import type { ReactNode } from 'react';

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: ReactNode;
  icon?: string;
  badge?: {
    text: string;
    type: 'success' | 'warning' | 'danger' | 'info' | 'neutral';
  };
}

export function StatCard({ label, value, subtext, icon, badge }: StatCardProps) {
  return (
    <div className="inv-card inv-kpi-card">
      <div className="inv-kpi-header">
        <span className="inv-kpi-label">{label}</span>
        {icon && <span className="material-symbols-outlined inv-kpi-icon">{icon}</span>}
      </div>
      <div className="inv-kpi-value">{value}</div>
      <div className="inv-kpi-sub">
        {badge && (
          <span className={`inv-badge inv-badge-${badge.type}`}>
            {badge.text}
          </span>
        )}
        {subtext}
      </div>
    </div>
  );
}
