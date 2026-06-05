import { usePortfolio } from '../context/PortfolioContext';
import { findETF, findAssetClass } from '../data/assetClasses';
import { findMetric } from '../hooks/useArtifacts';
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

export function Insights({ metrics, onNavigate }: Props) {
  const { portfolio, combinedAllocations, totalBalance } = usePortfolio();
  const { cashYield } = portfolio;
  const allocations = combinedAllocations;
  const totalValue = totalBalance;
  const active = allocations.filter(a => a.weight > 0);

  if (active.length === 0) {
    return (
      <div className="page">
        <div className="card empty-state">
          <div className="empty-icon">🔍</div>
          <h2>No portfolio to analyse</h2>
          <p>Build your portfolio first to see scenario analysis and concentration insights.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('explore')}>
            Browse ETFs →
          </button>
        </div>
      </div>
    );
  }

  // Asset class weights
  const equityWeight = active
    .filter(a => {
      const cls = findAssetClass(a.ticker);
      return (
        cls?.id === 'aus-equities'
        || cls?.id === 'intl-developed'
        || cls?.id === 'intl-small-caps'
        || cls?.id === 'emerging-markets'
      );
    })
    .reduce((s, a) => s + a.weight, 0);

  const ausEquityWeight = active
    .filter(a => findAssetClass(a.ticker)?.id === 'aus-equities')
    .reduce((s, a) => s + a.weight, 0);

  const globalEquityWeight = active
    .filter(a => {
      const id = findAssetClass(a.ticker)?.id;
      return id === 'intl-developed' || id === 'intl-small-caps' || id === 'emerging-markets';
    })
    .reduce((s, a) => s + a.weight, 0);

  const bondWeight = active
    .filter(a => {
      const id = findAssetClass(a.ticker)?.id;
      return id === 'aus-bonds' || id === 'credit' || id === 'inflation-protection';
    })
    .reduce((s, a) => s + a.weight, 0);

  const defensiveWeight = active
    .filter(a => {
      const cls = findAssetClass(a.ticker);
      return (
        cls?.id === 'aus-bonds'
        || cls?.id === 'credit'
        || cls?.id === 'inflation-protection'
        || cls?.id === 'diversified-real-return'
        || cls?.id === 'alternatives'
        || a.ticker === 'CASH'
      );
    })
    .reduce((s, a) => s + a.weight, 0);

  const weightedYield = active.reduce((sum, a) => {
    return sum + (a.weight / 100) * resolveYield(a.ticker, metrics, cashYield);
  }, 0);

  const annualIncome = (weightedYield / 100) * totalValue;

  // ── Stress tests ────────────────────────────────────────────────────────────

  // Equities fall 20%
  const equityDollarLoss = totalValue * (equityWeight / 100) * 0.20;
  const equityPortfolioImpact = (equityWeight / 100) * 0.20 * 100;

  // Equities yield typically drops ~30% during a downturn
  const equityIncomeReduction = active
    .filter(a => {
      const cls = findAssetClass(a.ticker);
      return (
        cls?.id === 'aus-equities'
        || cls?.id === 'intl-developed'
        || cls?.id === 'intl-small-caps'
        || cls?.id === 'emerging-markets'
      );
    })
    .reduce((sum, a) => sum + (a.weight / 100) * (resolveYield(a.ticker, metrics, cashYield) / 100) * totalValue * 0.30, 0);

  const defensiveBuffer = totalValue * (defensiveWeight / 100);

  // Rates rise 1%: bond duration impact (~5yr avg duration for broad bond ETFs)
  const bondDollarImpact = totalValue * (bondWeight / 100) * 0.05; // ~5yr duration × 1% = 5%

  return (
    <div className="page">
      <div className="page-header">
        <h1>Insights</h1>
        <p className="page-subtitle">
          Scenario analysis and concentration checks for your current portfolio.
        </p>
      </div>

      {/* Stress tests */}
      <div className="card">
        <h2>Stress Tests</h2>

        <div className="stress-grid">
          <div className="stress-card">
            <div className="stress-title">Equities fall 20%</div>
            <div className="stress-impact negative">{fmtCurrency(-equityDollarLoss)}</div>
            <div className="stress-detail">
              Portfolio impact: −{equityPortfolioImpact.toFixed(1)}%
            </div>
            <div className="stress-note">
              Your {bondWeight + (active.find(a => a.ticker === 'CASH')?.weight ?? 0)}% in bonds/cash ({fmtCurrency(defensiveBuffer)}) provides a capital buffer.
              Equity income would likely fall by ~{fmtCurrency(equityIncomeReduction)}/yr.
            </div>
          </div>

          <div className="stress-card">
            <div className="stress-title">Interest rates rise 1%</div>
            <div className="stress-impact negative">{fmtCurrency(-bondDollarImpact)}</div>
            <div className="stress-detail">
              Estimated bond value impact (~5yr duration)
            </div>
            <div className="stress-note">
              Bond prices fall when rates rise, but income distributions increase over time as bonds mature and are reinvested at higher rates.
            </div>
          </div>

          <div className="stress-card">
            <div className="stress-title">Income buffer</div>
            <div className="stress-impact positive">{fmtCurrency(defensiveBuffer)}</div>
            <div className="stress-detail">
              In bonds, cash &amp; defensive assets ({defensiveWeight}%)
            </div>
            <div className="stress-note">
              At {fmtCurrency(annualIncome / 12)}/month income, this represents{' '}
              {(defensiveBuffer / (annualIncome / 12)).toFixed(0)} months of income equivalent.
            </div>
          </div>
        </div>
      </div>

      {/* Concentration analysis */}
      <div className="card">
        <h2>Concentration Analysis</h2>
        <div className="concentration-list">
          <ConcentrationItem
            label="Home bias (AU equities + property)"
            value={ausEquityWeight}
            benchmark={50}
            benchmarkLabel="Suggested max 50%"
            note="Australia is ~2% of global markets. Overweighting is common for SMSF but limits diversification."
          />
          <ConcentrationItem
            label="Global equities"
            value={globalEquityWeight}
            benchmark={20}
            benchmarkLabel="Suggested min 20%"
            note="Essential diversification beyond Australia, especially for growth assets."
            invert
          />
          <ConcentrationItem
            label="Defensive allocation (bonds + cash + defensive)"
            value={defensiveWeight}
            benchmark={25}
            benchmarkLabel="Suggested min 25% near retirement"
            note="Near retirement, a larger defensive buffer reduces sequence-of-returns risk."
            invert
          />
          <ConcentrationItem
            label="Largest single ETF"
            value={active.reduce((m, a) => Math.max(m, a.weight), 0)}
            benchmark={40}
            benchmarkLabel="Suggested max 40%"
            note="Concentration in a single fund increases idiosyncratic risk."
          />
        </div>
      </div>

      {/* ETF-level data from pipeline */}
      {metrics.length > 0 && (
        <div className="card">
          <h2>Live ETF Metrics</h2>
          <p className="section-note">From the latest data refresh. Sorted by your allocation weight.</p>
          <table className="holdings-table">
            <thead>
              <tr>
                <th>ETF</th>
                <th>Alloc.</th>
                <th>CAGR</th>
                <th>Volatility</th>
                <th>Max Drawdown</th>
                <th>Trailing Yield</th>
              </tr>
            </thead>
            <tbody>
              {active
                .filter(a => a.ticker !== 'CASH')
                .sort((a, b) => b.weight - a.weight)
                .map(a => {
                  const m = findMetric(metrics, a.ticker);
                  return (
                    <tr key={a.ticker}>
                      <td>
                        <span className="table-ticker">{a.ticker.replace('.AX', '')}</span>
                      </td>
                      <td>{a.weight}%</td>
                      <td>{m ? `${(m.cagr * 100).toFixed(1)}%` : '—'}</td>
                      <td>{m ? `${(m.volatility * 100).toFixed(1)}%` : '—'}</td>
                      <td className={m && m.max_drawdown < -0.2 ? 'negative-cell' : ''}>
                        {m ? `${(m.max_drawdown * 100).toFixed(1)}%` : '—'}
                      </td>
                      <td>{m && m.distribution_yield > 0 ? `${(m.distribution_yield * 100).toFixed(1)}%` : '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

interface ConcentrationItemProps {
  label: string;
  value: number;
  benchmark: number;
  benchmarkLabel: string;
  note: string;
  invert?: boolean; // invert = "more is better"
}

function ConcentrationItem({ label, value, benchmark, benchmarkLabel, note, invert }: ConcentrationItemProps) {
  const ok = invert ? value >= benchmark : value <= benchmark;
  return (
    <div className={`concentration-item${ok ? '' : ' concentration-warn'}`}>
      <div className="concentration-header">
        <span className="concentration-icon">{ok ? '✅' : '⚠️'}</span>
        <div className="concentration-body">
          <div className="concentration-label">{label}</div>
          <div className="concentration-values">
            <strong>{value}%</strong>
            <span className="concentration-benchmark"> · {benchmarkLabel}</span>
          </div>
          <div className="concentration-bar-wrap">
            <div
              className="concentration-bar"
              style={{ width: `${Math.min(value, 100)}%`, background: ok ? '#0a6e4f' : '#d97706' }}
            />
          </div>
          <div className="concentration-note">{note}</div>
        </div>
      </div>
    </div>
  );
}
