import { ASSET_CLASSES } from '../data/assetClasses';
import { RoleBadge, RiskBadge } from '../components/Badge';
import { ETFCard } from '../components/ETFCard';
import { findMetric, findPeriodMetric } from '../hooks/useArtifacts';
import { PerfTable, fmtPeriodPct, fmtSharpe } from '../components/PerfTables';
import type { MetricRow, PeriodMetricRow } from '../types/contracts';
import type { Page } from '../components/Nav';

interface Props {
  metrics: MetricRow[];
  periodMetrics: PeriodMetricRow[];
  onNavigate: (page: Page) => void;
}

export function Explore({ metrics, periodMetrics, onNavigate }: Props) {
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
    </div>
  );
}
