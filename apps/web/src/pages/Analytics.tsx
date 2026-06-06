import { useState, useMemo } from 'react';
import { findPeriodMetric } from '../hooks/useArtifacts';
import { PerfTable, fmtPeriodPct, fmtSharpe } from '../components/PerfTables';
import { RiskTable } from '../components/RiskTable';
import type { PeriodMetricRow, RiskMetricRow } from '../types/contracts';

type SortField = 'ret_1m' | 'ret_3m' | 'ret_6m' | 'ret_1y' | 'ret_3y' | 'ret_5y' | 'ret_10y' | 'sharpe_3y' | 'vol_3y';

const SORT_FIELDS: { value: SortField; label: string }[] = [
  { value: 'ret_3y',    label: '3Y Return' },
  { value: 'ret_1y',    label: '1Y Return' },
  { value: 'ret_5y',    label: '5Y Return' },
  { value: 'ret_10y',   label: '10Y Return' },
  { value: 'ret_1m',    label: '1M Return' },
  { value: 'ret_6m',    label: '6M Return' },
  { value: 'sharpe_3y', label: 'Sharpe (3Y)' },
  { value: 'vol_3y',    label: 'Volatility (3Y)' },
];

interface Props {
  periodMetrics: PeriodMetricRow[];
  riskMetrics: RiskMetricRow[];
}

export function Analytics({ periodMetrics, riskMetrics }: Props) {
  const [sortField, setSortField] = useState<SortField>('ret_3y');
  const [ascending, setAscending] = useState(true);

  const allPeriodTickers = useMemo(
    () => periodMetrics.map(r => r.ticker),
    [periodMetrics],
  );

  const tickersSorted = useMemo(() => {
    return [...allPeriodTickers].sort((a, b) => {
      const va = (findPeriodMetric(periodMetrics, a)?.[sortField] as number | null) ?? null;
      const vb = (findPeriodMetric(periodMetrics, b)?.[sortField] as number | null) ?? null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return ascending ? va - vb : vb - va;
    });
  }, [allPeriodTickers, periodMetrics, sortField, ascending]);

  const tickersByRisk = useMemo(() => {
    return [...riskMetrics]
      .sort((a, b) => {
        const sa = a.sharpe_annualised ?? null;
        const sb = b.sharpe_annualised ?? null;
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      })
      .map(r => r.ticker);
  }, [riskMetrics]);

  const rfSource = riskMetrics[0]?.rf_source ?? 'RBA Cash Rate Target (F1.1)';
  const sortDir = ascending ? '↑ lowest first' : '↓ highest first';

  return (
    <div className="page">
      <div className="page-header">
        <h1>Analytics</h1>
        <p className="page-subtitle">
          Compare all ETFs across period performance and risk-adjusted return metrics.
        </p>
      </div>

      {/* ── Period Performance ─────────────────────────────────────────────── */}
      <div className="analytics-section-header">
        <div>
          <h2>Period Performance</h2>
          <p className="page-subtitle">Returns, volatility and Sharpe ratio over fixed lookback windows.</p>
        </div>
        <div className="analytics-sort-controls">
          <label htmlFor="sort-field" className="analytics-sort-label">Sort by</label>
          <select
            id="sort-field"
            className="analytics-sort-select"
            value={sortField}
            onChange={e => setSortField(e.target.value as SortField)}
          >
            {SORT_FIELDS.map(f => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <button
            className="analytics-sort-dir"
            onClick={() => setAscending(a => !a)}
            title="Toggle sort direction"
          >
            {sortDir}
          </button>
        </div>
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

      {/* ── Risk-Adjusted Returns ──────────────────────────────────────────── */}
      <div className="analytics-section-header" style={{ marginTop: '2rem' }}>
        <div>
          <h2>Risk-Adjusted Returns</h2>
          <p className="page-subtitle">
            Since-inception metrics · Risk-free rate: {rfSource} · Sorted by Sharpe, highest to lowest.
          </p>
        </div>
      </div>

      <RiskTable tickers={tickersByRisk} riskMetrics={riskMetrics} />
    </div>
  );
}
