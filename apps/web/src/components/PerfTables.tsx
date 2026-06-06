import { findPeriodMetric } from '../hooks/useArtifacts';
import type { PeriodMetricRow } from '../types/contracts';

export const PERIODS = ['1m', '3m', '6m', '1y', '3y', '5y', '10y'] as const;
export type Period = typeof PERIODS[number];

export const PERIOD_LABELS: Record<Period, string> = {
  '1m': '1M', '3m': '3M', '6m': '6M', '1y': '1Y',
  '3y': '3Y p.a.', '5y': '5Y p.a.', '10y': '10Y p.a.',
};

export function fmtPeriodPct(v: number | null | undefined): string {
  if (v == null) return 'n/a';
  return `${(v * 100).toFixed(1)}%`;
}

export function fmtSharpe(v: number | null | undefined): string {
  if (v == null) return 'n/a';
  return v.toFixed(2);
}

function colorClass(v: number | null | undefined, isReturn: boolean): string {
  if (v == null) return '';
  if (isReturn) return v >= 0 ? 'perf-pos' : 'perf-neg';
  return '';
}

export function PerfTable({
  title,
  tickers,
  periodMetrics,
  field,
  fmt,
  colored,
}: {
  title: string;
  tickers: string[];
  periodMetrics: PeriodMetricRow[];
  field: 'ret' | 'vol' | 'sharpe';
  fmt: (v: number | null | undefined) => string;
  colored: boolean;
}) {
  if (tickers.length === 0) return null;

  return (
    <div className="card">
      <h3>{title}</h3>
      <div className="perf-table-wrap">
        <table className="perf-table">
          <thead>
            <tr>
              <th>ETF</th>
              {PERIODS.map(p => <th key={p}>{PERIOD_LABELS[p]}</th>)}
            </tr>
          </thead>
          <tbody>
            {tickers.map(ticker => {
              const row = findPeriodMetric(periodMetrics, ticker);
              return (
                <tr key={ticker}>
                  <td>
                    <span className="table-ticker">{ticker.replace('.AX', '')}</span>
                  </td>
                  {PERIODS.map(p => {
                    const val = row?.[`${field}_${p}` as keyof PeriodMetricRow] as number | null | undefined;
                    const cls = colored ? colorClass(val, field === 'ret' || field === 'sharpe') : '';
                    return <td key={p} className={cls}>{fmt(val)}</td>;
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
