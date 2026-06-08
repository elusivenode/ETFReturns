import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePerformanceArtifact } from '../hooks/useArtifacts';

function fmtMoney(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'n/a';
  return new Intl.NumberFormat('en-AU', {
    style: 'currency',
    currency: 'AUD',
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return 'n/a';
  return `${(v * 100).toFixed(2)}%`;
}

function numCls(v: number | null | undefined): string {
  if (v == null || Number.isNaN(v)) return '';
  return v >= 0 ? 'perf-pos' : 'perf-neg';
}

const PERIOD_LABELS: Record<'SI' | '1Y' | '3Y' | '5Y' | '10Y', string> = {
  SI: 'Since inception',
  '1Y': '1 year',
  '3Y': '3 year',
  '5Y': '5 year',
  '10Y': '10 year',
};

export function Performance() {
  const artifact = usePerformanceArtifact();

  const periods = useMemo(() => {
    if (!artifact) return [];
    const order = ['SI', '1Y', '3Y', '5Y', '10Y'];
    return [...artifact.periods].sort(
      (a, b) => order.indexOf(a.period_code) - order.indexOf(b.period_code),
    );
  }, [artifact]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Performance</h1>
        <p className="page-subtitle">
          Portfolio outcomes vs objective benchmark (CPI + 5%).
        </p>
      </div>

      {!artifact ? (
        <div className="card">
          <p className="page-subtitle">
            No performance artifact found yet. Run the performance pipeline to generate data/performance_metrics.json.
          </p>
        </div>
      ) : (
        <>
          <div className="performance-kpi-grid">
            <div className="card performance-kpi-card">
              <h3>Current Value</h3>
              <div className="performance-kpi-value">{fmtMoney(artifact.current_value)}</div>
              <p className="page-subtitle">As of {artifact.as_of_date}</p>
            </div>

            <div className="card performance-kpi-card">
              <h3>Capital Sources</h3>
              <div className="performance-sources-row">
                <span>Rollover Capital</span>
                <strong>{fmtMoney(artifact.capital_sources?.rollover_capital ?? null)}</strong>
              </div>
              <div className="performance-sources-row">
                <span>Contributions</span>
                <strong>{fmtMoney(artifact.capital_sources?.contributions ?? null)}</strong>
              </div>
              <div className="performance-sources-row">
                <span>Investment Returns</span>
                <strong className={numCls(artifact.capital_sources?.investment_returns ?? null)}>
                  {fmtMoney(artifact.capital_sources?.investment_returns ?? null)}
                </strong>
              </div>
            </div>
          </div>

          <div className="card">
            <h3>Performance vs Objective</h3>
            <div className="perf-table-wrap">
              <table className="perf-table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Portfolio Return</th>
                    <th>CPI + 5%</th>
                    <th>Excess Return</th>
                  </tr>
                </thead>
                <tbody>
                  {periods.map(row => (
                    <tr key={row.period_code}>
                      <td>{PERIOD_LABELS[row.period_code]}</td>
                      <td className={numCls(row.twr_annualized)}>{fmtPct(row.twr_annualized)}</td>
                      <td>{fmtPct(row.benchmark_annualized)}</td>
                      <td className={numCls(row.excess_annualized)}>{fmtPct(row.excess_annualized)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3>Portfolio Value</h3>
            {artifact.valuation_series?.dates?.length ? (
              <Plot
                data={[
                  {
                    name: 'Portfolio Value',
                    x: artifact.valuation_series.dates,
                    y: artifact.valuation_series.values,
                    type: 'scatter',
                    mode: 'lines',
                    line: { width: 2.2, color: '#0a6e4f' },
                    hovertemplate: '%{x}<br>$%{y:,.0f}<extra></extra>',
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { t: 16, r: 24, b: 56, l: 72 },
                  paper_bgcolor: '#ffffff',
                  plot_bgcolor: '#ffffff',
                  xaxis: { type: 'date', showgrid: true, gridcolor: '#f0f4f8', zeroline: false },
                  yaxis: { title: { text: 'Portfolio Value (AUD)' }, showgrid: true, gridcolor: '#f0f4f8' },
                  hovermode: 'x unified',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '340px' }}
              />
            ) : (
              <div className="empty-chart" style={{ height: 240 }}>
                No valuation series available yet.
              </div>
            )}
          </div>

          <div className="card">
            <h3>Portfolio Return vs CPI + 5%</h3>
            {artifact.cumulative_return_series?.dates?.length ? (
              <Plot
                data={[
                  {
                    name: 'Portfolio',
                    x: artifact.cumulative_return_series.dates,
                    y: artifact.cumulative_return_series.portfolio,
                    type: 'scatter',
                    mode: 'lines',
                    line: { width: 2.2, color: '#0a6e4f' },
                    hovertemplate: 'Portfolio: %{y:.2f}%<extra></extra>',
                  },
                  {
                    name: 'CPI + 5%',
                    x: artifact.cumulative_return_series.dates,
                    y: artifact.cumulative_return_series.benchmark,
                    type: 'scatter',
                    mode: 'lines',
                    line: { width: 1.8, dash: 'dot', color: '#9b59b6' },
                    hovertemplate: 'CPI + 5%: %{y:.2f}%<extra></extra>',
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { t: 16, r: 24, b: 56, l: 68 },
                  paper_bgcolor: '#ffffff',
                  plot_bgcolor: '#ffffff',
                  xaxis: { type: 'date', showgrid: true, gridcolor: '#f0f4f8', zeroline: false },
                  yaxis: {
                    title: { text: 'Cumulative Return (%)' },
                    showgrid: true,
                    gridcolor: '#f0f4f8',
                    ticksuffix: '%',
                  },
                  legend: { orientation: 'h', yanchor: 'bottom', y: -0.22, xanchor: 'center', x: 0.5 },
                  hovermode: 'x unified',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '340px' }}
              />
            ) : (
              <div className="empty-chart" style={{ height: 240 }}>
                No cumulative return series available yet.
              </div>
            )}
          </div>

          <div className="card">
            <h3>Rolling 3Y Return vs CPI + 5%</h3>
            {artifact.rolling_3y_return_series?.dates?.length ? (
              <Plot
                data={[
                  {
                    name: 'Portfolio 3Y p.a.',
                    x: artifact.rolling_3y_return_series.dates,
                    y: artifact.rolling_3y_return_series.portfolio_3y_pa,
                    type: 'scatter',
                    mode: 'lines',
                    line: { width: 2.2, color: '#0a6e4f' },
                    hovertemplate: 'Portfolio 3Y p.a.: %{y:.2f}%<extra></extra>',
                  },
                  {
                    name: 'CPI + 5% 3Y p.a.',
                    x: artifact.rolling_3y_return_series.dates,
                    y: artifact.rolling_3y_return_series.benchmark_3y_pa,
                    type: 'scatter',
                    mode: 'lines',
                    line: { width: 1.8, dash: 'dot', color: '#9b59b6' },
                    hovertemplate: 'CPI + 5% 3Y p.a.: %{y:.2f}%<extra></extra>',
                  },
                ]}
                layout={{
                  autosize: true,
                  margin: { t: 16, r: 24, b: 56, l: 68 },
                  paper_bgcolor: '#ffffff',
                  plot_bgcolor: '#ffffff',
                  xaxis: { type: 'date', showgrid: true, gridcolor: '#f0f4f8', zeroline: false },
                  yaxis: {
                    title: { text: 'Rolling 3Y Return (% p.a.)' },
                    showgrid: true,
                    gridcolor: '#f0f4f8',
                    ticksuffix: '%',
                  },
                  legend: { orientation: 'h', yanchor: 'bottom', y: -0.22, xanchor: 'center', x: 0.5 },
                  hovermode: 'x unified',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '340px' }}
              />
            ) : (
              <div className="empty-chart" style={{ height: 240 }}>
                Rolling 3Y series will appear once at least 3 years of daily history is available.
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
