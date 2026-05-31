import type { AssetClassRole, RiskLevel } from '../types/contracts';

const ROLE: Record<AssetClassRole, { bg: string; color: string; label: string }> = {
  income:    { bg: '#e6f4ec', color: '#0a6e4f', label: 'Income' },
  growth:    { bg: '#e8f0fb', color: '#1a56b0', label: 'Growth' },
  stability: { bg: '#f0f4f8', color: '#3d5166', label: 'Stability' },
  defensive: { bg: '#fff8e8', color: '#8a6200', label: 'Defensive' },
};

const RISK: Record<RiskLevel, { bg: string; color: string }> = {
  low:    { bg: '#e6f4ec', color: '#0a6e4f' },
  medium: { bg: '#fff8e8', color: '#8a6200' },
  high:   { bg: '#fdecea', color: '#b91c1c' },
};

export function RoleBadge({ role }: { role: AssetClassRole }) {
  const s = ROLE[role];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

export function RiskBadge({ risk }: { risk: RiskLevel }) {
  const s = RISK[risk];
  return (
    <span className="badge" style={{ background: s.bg, color: s.color }}>
      {risk} risk
    </span>
  );
}
