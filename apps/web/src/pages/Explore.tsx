import { ASSET_CLASSES } from '../data/assetClasses';
import { RoleBadge, RiskBadge } from '../components/Badge';
import { ETFCard } from '../components/ETFCard';
import { findMetric, findPeriodMetric, findRiskMetric } from '../hooks/useArtifacts';
import { PerfTable, fmtPeriodPct, fmtSharpe } from '../components/PerfTables';
import { RiskTable } from '../components/RiskTable';
import type { MetricRow, PeriodMetricRow, RiskMetricRow } from '../types/contracts';
import type { Page } from '../components/Nav';

interface Props {
  metrics: MetricRow[];
  periodMetrics: PeriodMetricRow[];
  riskMetrics: RiskMetricRow[];
  onNavigate: (page: Page) => void;
}

export function Explore({ metrics, periodMetrics, riskMetrics, onNavigate }: Props) {
  const allTickers = ASSET_CLASSES.flatMap(c => c.etfs).map(e => e.ticker);

  // Sort by 3Y return ascending (nulls last)
  const tickersSorted = [...allTickers].sort((a, b) => {
    const ra = findPeriodMetric(periodMetrics, a)?.ret_3y ?? null;
    const rb = findPeriodMetric(periodMetrics, b)?.ret_3y ?? null;
    if (ra === null && rb === null) return 0;
    if (ra === null) return 1;
    if (rb === null) return -1;
    return ra - rb;
  });

  // Sort by Sharpe descending (nulls last)
  const tickersByRisk = [...allTickers].sort((a, b) => {
    const sa = findRiskMetric(riskMetrics, a)?.sharpe_annualised ?? null;
    const sb = findRiskMetric(riskMetrics, b)?.sharpe_annualised ?? null;
    if (sa === null && sb === null) return 0;
    if (sa === null) return 1;
    if (sb === null) return -1;
    return sb - sa;
  });

  return (
    <div className="page">
      <div className="page-header">
        <h1>Explore ETFs</h1>
        <p className="page-subtitle">
          Browse by asset class. Add ETFs to your portfolio, then set allocations in the Portfolio Builder.
        </p>
      </div>

      {ASSET_CLASSES.map(cls => (
        <section key={cls.id} className="asset-class-section card">
          <div className="asset-class-header">
            <div>
              <h2 className="asset-class-name">{cls.name}</h2>
              <p className="asset-class-desc">{cls.description}</p>
            </div>
            <div className="asset-class-badges">
              <RoleBadge role={cls.role} />
              <RiskBadge risk={cls.risk} />
            </div>
          </div>

          {cls.etfs.length === 0 ? (
            <div className="cash-bucket">
              <p>
                Cash is managed directly in your SMSF bank account. Set your cash allocation and
                current yield in the{' '}
                <button className="link-btn" onClick={() => onNavigate('portfolio')}>
                  Portfolio Builder
                </button>
                .
              </p>
            </div>
          ) : (
            <div className="etf-grid">
              {cls.etfs.map(etf => (
                <ETFCard
                  key={etf.ticker}
                  etf={etf}
                  liveMetric={findMetric(metrics, etf.ticker)}
                  onNavigateToPortfolio={() => onNavigate('portfolio')}
                />
              ))}
            </div>
          )}
        </section>
      ))}

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h2>All ETFs — Performance Summary</h2>
        <p className="page-subtitle">Sorted by 3-year annualised return, lowest to highest. n/a = insufficient history.</p>
      </div>

      <PerfTable
        title="Returns"
        tickers={tickersSorted}
        periodMetrics={periodMetrics}
        field="ret"
        fmt={fmtPeriodPct}
        colored
      />
      <PerfTable
        title="Volatility (annualised)"
        tickers={tickersSorted}
        periodMetrics={periodMetrics}
        field="vol"
        fmt={fmtPeriodPct}
        colored={false}
      />
      <PerfTable
        title="Sharpe Ratio"
        tickers={tickersSorted}
        periodMetrics={periodMetrics}
        field="sharpe"
        fmt={fmtSharpe}
        colored
      />

      <div className="page-header" style={{ marginTop: '2rem' }}>
        <h2>Risk-Adjusted Returns</h2>
        <p className="page-subtitle">Since-inception metrics using daily excess returns over the RBA Cash Rate Target. Sorted by Sharpe ratio, highest to lowest.</p>
      </div>

      <RiskTable tickers={tickersByRisk} riskMetrics={riskMetrics} />
    </div>
  );
}
