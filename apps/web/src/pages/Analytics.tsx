import { useState, useMemo, type ChangeEvent } from 'react';
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
  const [tickerFilter, setTickerFilter] = useState('');
  const [selectedSet, setSelectedSet] = useState<string[]>([]);

  const allPeriodTickers = useMemo(
    () => periodMetrics.map(r => r.ticker),
    [periodMetrics],
  );

  const allTickers = useMemo(() => {
    const merged = new Set<string>([
      ...periodMetrics.map(r => r.ticker),
      ...riskMetrics.map(r => r.ticker),
    ]);
    return [...merged].sort();
  }, [periodMetrics, riskMetrics]);

  const effectiveFilter = useMemo(() => {
    const normalizedInput = tickerFilter.trim().toUpperCase().replace(/\.AX$/, '');
    if (normalizedInput) {
      const matched = allTickers.find(t => t.toUpperCase().replace(/\.AX$/, '') === normalizedInput);
      return matched ? [matched] : [];
    }
    return selectedSet;
  }, [tickerFilter, selectedSet, allTickers]);

  const tickersSorted = useMemo(() => {
    const baseTickers = effectiveFilter.length > 0
      ? allPeriodTickers.filter(t => effectiveFilter.includes(t))
      : allPeriodTickers;

    return [...baseTickers].sort((a, b) => {
      const va = (findPeriodMetric(periodMetrics, a)?.[sortField] as number | null) ?? null;
      const vb = (findPeriodMetric(periodMetrics, b)?.[sortField] as number | null) ?? null;
      if (va === null && vb === null) return 0;
      if (va === null) return 1;
      if (vb === null) return -1;
      return ascending ? va - vb : vb - va;
    });
  }, [allPeriodTickers, effectiveFilter, periodMetrics, sortField, ascending]);

  const tickersByRisk = useMemo(() => {
    const filteredRisk = effectiveFilter.length > 0
      ? riskMetrics.filter(r => effectiveFilter.includes(r.ticker))
      : riskMetrics;

    return [...filteredRisk]
      .sort((a, b) => {
        const sa = a.sharpe_annualised ?? null;
        const sb = b.sharpe_annualised ?? null;
        if (sa === null && sb === null) return 0;
        if (sa === null) return 1;
        if (sb === null) return -1;
        return sb - sa;
      })
      .map(r => r.ticker);
  }, [riskMetrics, effectiveFilter]);

  const onSetChange = (e: ChangeEvent<HTMLSelectElement>) => {
    const values = Array.from(e.target.selectedOptions).map(o => o.value);
    setSelectedSet(values);
  };

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

      <div className="card analytics-filter-card">
        <div className="analytics-filter-grid">
          <div className="analytics-filter-field">
            <label htmlFor="analytics-ticker-filter" className="analytics-filter-label">Single ETF ticker</label>
            <input
              id="analytics-ticker-filter"
              type="text"
              className="analytics-filter-input"
              value={tickerFilter}
              onChange={e => setTickerFilter(e.target.value)}
              placeholder="e.g. VGS or VGS.AX"
            />
            <p className="analytics-filter-help">When set, this overrides the ETF set selection below.</p>
          </div>

          <div className="analytics-filter-field">
            <label htmlFor="analytics-set-filter" className="analytics-filter-label">ETF set</label>
            <select
              id="analytics-set-filter"
              multiple
              className="analytics-filter-multiselect"
              value={selectedSet}
              onChange={onSetChange}
            >
              {allTickers.map(ticker => (
                <option key={ticker} value={ticker}>{ticker.replace('.AX', '')}</option>
              ))}
            </select>
            <p className="analytics-filter-help">Select multiple ETFs (Cmd/Ctrl-click). Used when the single ticker box is empty.</p>
          </div>
        </div>
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

      {tickersSorted.length === 0 && tickersByRisk.length === 0 && (
        <div className="card">
          <p className="page-subtitle">No ETFs match the current filter. Try a different ticker or clear the filter.</p>
        </div>
      )}

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
