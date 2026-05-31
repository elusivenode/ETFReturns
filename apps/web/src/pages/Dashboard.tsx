import { usePortfolio } from '../context/PortfolioContext';
import { findETF, findAssetClass, ASSET_CLASSES } from '../data/assetClasses';
import { findMetric } from '../hooks/useArtifacts';
import { AllocationPie } from '../components/AllocationPie';
import type { MetricRow } from '../types/contracts';
import type { Page } from '../components/Nav';

interface Props {
  metrics: MetricRow[];
  onNavigate: (page: Page) => void;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(n);

function resolveYield(ticker: string, metrics: MetricRow[], cashYield: number): number {
  if (ticker === 'CASH') return cashYield;
  const live = findMetric(metrics, ticker);
  if (live && live.distribution_yield > 0) return live.distribution_yield * 100;
  return findETF(ticker)?.approxYield ?? 0;
}

const ROLE_COLORS: Record<string, string> = {
  income:    '#0a6e4f',
  growth:    '#1a56b0',
  stability: '#6b7a8d',
  defensive: '#b8860b',
};

export function Dashboard({ metrics, onNavigate }: Props) {
  const { portfolio, combinedAllocations, totalBalance } = usePortfolio();
  const { cashYield } = portfolio;
  const allocations = combinedAllocations;
  const totalValue = totalBalance;
  const active = allocations.filter(a => a.weight > 0);
  const totalAllocated = Math.round(active.reduce((s, a) => s + a.weight, 0));

  if (active.length === 0) {
    return (
      <div className="page">
        <div className="card empty-state">
          <div className="empty-icon">📊</div>
          <h2>No portfolio set up yet</h2>
          <p>Start by browsing asset classes and adding ETFs, then set your allocation percentages.</p>
          <div className="empty-actions">
            <button className="btn btn-primary" onClick={() => onNavigate('explore')}>
              Browse ETFs →
            </button>
            <button className="btn btn-secondary" onClick={() => onNavigate('portfolio')}>
              Go to Portfolio Builder
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Core calculations
  const weightedYield = active.reduce((sum, a) => {
    return sum + (a.weight / 100) * resolveYield(a.ticker, metrics, cashYield);
  }, 0);
  const annualIncome = (weightedYield / 100) * totalValue;

  // Role breakdown
  const byRole: Record<string, number> = {};
  for (const a of active) {
    const cls = findAssetClass(a.ticker);
    const role = cls?.role ?? 'stability';
    byRole[role] = (byRole[role] ?? 0) + a.weight;
  }

  // Asset class sums for health checks
  const ausWeight = active
    .filter(a => {
      const cls = findAssetClass(a.ticker);
      return cls?.id === 'aus-equities' || cls?.id === 'property-infra';
    })
    .reduce((s, a) => s + a.weight, 0);

  const maxSingle = active.reduce((m, a) => Math.max(m, a.weight), 0);
  const defensiveWeight = (byRole['stability'] ?? 0) + (byRole['defensive'] ?? 0);
  const vapWeight = allocations.find(a => a.ticker === 'VAP.AX')?.weight ?? 0;

  return (
    <div className="page">
      <div className="dashboard-hero card">
        <div className="hero-left">
          <div className="hero-label">Portfolio Value</div>
          <div className="hero-value">{fmtCurrency(totalValue)}</div>
          <button className="link-btn" style={{ fontSize: '0.82rem', marginTop: 6 }} onClick={() => onNavigate('portfolio')}>
            Edit allocations →
          </button>
        </div>
        <div className="hero-divider" />
        <div className="hero-right">
          <div className="hero-label">Estimated Annual Income</div>
          <div className="hero-income">{fmtCurrency(annualIncome)}</div>
          <div className="hero-yield">{weightedYield.toFixed(2)}% weighted yield · {fmtCurrency(annualIncome / 12)} / month</div>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Allocation pie */}
        <div className="card">
          <h3>Allocation by Asset Class</h3>
          <AllocationPie allocations={allocations} />
        </div>

        {/* Right column */}
        <div className="dashboard-right-col">
          {/* Role breakdown */}
          <div className="card">
            <h3>Portfolio Mix</h3>
            <div className="role-breakdown">
              {Object.entries(byRole)
                .sort((a, b) => b[1] - a[1])
                .map(([role, pct]) => (
                  <div key={role} className="role-row">
                    <span className="role-label">
                      {role.charAt(0).toUpperCase() + role.slice(1)}
                    </span>
                    <div className="role-bar-wrap">
                      <div
                        className="role-bar"
                        style={{
                          width: `${pct}%`,
                          background: ROLE_COLORS[role] ?? '#ccc',
                        }}
                      />
                    </div>
                    <span className="role-pct">{pct}%</span>
                  </div>
                ))}
            </div>
          </div>

          {/* Health check */}
          <div className="card">
            <h3>Health Check</h3>
            <div className="health-list">
              <HealthItem
                ok={ausWeight <= 60}
                text={`Australian concentration: ${ausWeight}% in AU assets`}
                detail={ausWeight > 60 ? 'Consider increasing global exposure' : undefined}
              />
              <HealthItem
                ok={maxSingle <= 45}
                text={`Largest single holding: ${maxSingle}%`}
                detail={maxSingle > 45 ? 'High concentration in one ETF' : undefined}
              />
              <HealthItem
                ok={defensiveWeight >= 20}
                text={`Defensive buffer: ${defensiveWeight}% in bonds/cash`}
                detail={defensiveWeight < 20 ? 'Consider increasing fixed income or cash for capital preservation' : undefined}
              />
              {vapWeight > 5 && (
                <HealthItem
                  ok={false}
                  text={`VAP at ${vapWeight}% — you already have significant direct property`}
                  detail="Consider keeping listed property minimal"
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Holdings summary table */}
      <div className="card">
        <h3>Holdings</h3>
        <table className="holdings-table">
          <thead>
            <tr>
              <th>ETF</th>
              <th>Asset Class</th>
              <th>Allocation</th>
              <th>Est. Yield</th>
              <th>Income Contribution</th>
            </tr>
          </thead>
          <tbody>
            {active
              .sort((a, b) => b.weight - a.weight)
              .map(a => {
                const y = resolveYield(a.ticker, metrics, cashYield);
                const income = (a.weight / 100) * (y / 100) * totalValue;
                const cls = findAssetClass(a.ticker);
                return (
                  <tr key={a.ticker}>
                    <td>
                      <span className="table-ticker">{a.ticker.replace('.AX', '')}</span>
                      <span className="table-name">{a.ticker === 'CASH' ? 'Cash' : findETF(a.ticker)?.name ?? ''}</span>
                    </td>
                    <td>{cls?.name ?? '—'}</td>
                    <td>{a.weight}%</td>
                    <td>{y.toFixed(1)}%</td>
                    <td>{fmtCurrency(income)}</td>
                  </tr>
                );
              })}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={2}><strong>Total</strong></td>
              <td><strong>{totalAllocated}%</strong></td>
              <td><strong>{weightedYield.toFixed(2)}%</strong></td>
              <td><strong>{fmtCurrency(annualIncome)}</strong></td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function HealthItem({ ok, text, detail }: { ok: boolean; text: string; detail?: string }) {
  return (
    <div className={`health-item${ok ? '' : ' health-warn'}`}>
      <span className="health-icon">{ok ? '✅' : '⚠️'}</span>
      <div>
        <div>{text}</div>
        {detail && <div className="health-detail">{detail}</div>}
      </div>
    </div>
  );
}
