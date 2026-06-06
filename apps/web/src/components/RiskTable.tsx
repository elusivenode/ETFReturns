import { findRiskMetric } from '../hooks/useArtifacts';
import type { RiskMetricRow } from '../types/contracts';

function fmt2(v: number | null | undefined): string {
  return v == null ? 'n/a' : v.toFixed(2);
}

function fmtPct(v: number | null | undefined): string {
  return v == null ? 'n/a' : `${(v * 100).toFixed(1)}%`;
}

function fmtUlcer(v: number | null | undefined): string {
  return v == null ? 'n/a' : v.toFixed(1);
}

function numClass(v: number | null | undefined): string {
  if (v == null) return '';
  return v >= 0 ? 'perf-pos' : 'perf-neg';
}

export function RiskTable({
  tickers,
  riskMetrics,
}: {
  tickers: string[];
  riskMetrics: RiskMetricRow[];
}) {
  if (tickers.length === 0) return null;

  return (
    <div className="card">
      <h3>Risk-Adjusted Returns</h3>
      <p className="perf-table-note">
        Since-inception metrics using daily excess returns over the RBA Cash Rate Target.
        Observation period varies per ETF — check the Since column.
      </p>
      <div className="perf-table-wrap">
        <table className="perf-table">
          <thead>
            <tr>
              <th>ETF</th>
              <th>Sharpe</th>
              <th>Sortino</th>
              <th>Calmar</th>
              <th>Max DD</th>
              <th>Ulcer</th>
              <th>Since</th>
            </tr>
          </thead>
          <tbody>
            {tickers.map(ticker => {
              const row = findRiskMetric(riskMetrics, ticker);
              const since = row?.observation_start?.slice(0, 4) ?? 'n/a';
              return (
                <tr key={ticker}>
                  <td><span className="table-ticker">{ticker.replace('.AX', '')}</span></td>
                  <td className={numClass(row?.sharpe_annualised)}>{fmt2(row?.sharpe_annualised)}</td>
                  <td className={numClass(row?.sortino)}>{fmt2(row?.sortino)}</td>
                  <td className={numClass(row?.calmar)}>{fmt2(row?.calmar)}</td>
                  <td className="perf-neg">{fmtPct(row?.max_drawdown)}</td>
                  <td>{fmtUlcer(row?.ulcer_index)}</td>
                  <td className="perf-table-since">{since}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
