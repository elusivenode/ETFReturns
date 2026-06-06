import { useMemo, useState } from 'react';
import Plot from 'react-plotly.js';
import { ASSET_CLASSES } from '../data/assetClasses';
import { usePriceSeries, computeCumReturn } from '../hooks/usePriceSeries';
import { useCpiSeries, findPeriodMetric } from '../hooks/useArtifacts';
import type { CpiDateValues } from '../hooks/useArtifacts';
import type { PeriodMetricRow } from '../types/contracts';

const ETF_GROUPS = ASSET_CLASSES
  .filter(c => c.etfs.length > 0)
  .map(c => ({ id: c.id, name: c.name, tickers: c.etfs.map(e => e.ticker) }));

const ALL_ETF_TICKERS = ETF_GROUPS.flatMap(g => g.tickers);

const PALETTE = [
  '#0a6e4f', '#1a56b0', '#b91c1c', '#b8860b', '#7b3c8f',
  '#0891b2', '#059669', '#d97706', '#6366f1', '#db2777',
  '#0f766e', '#92400e', '#1d4ed8', '#65a30d',
];

const SIDEBAR_PERIODS = ['1y', '3y', '5y', '10y'] as const;
type SidebarPeriod = typeof SIDEBAR_PERIODS[number];
const SIDEBAR_LABELS: Record<SidebarPeriod, string> = {
  '1y': '1Y', '3y': '3Y', '5y': '5Y', '10y': '10Y',
};

function fmt1(v: number | null | undefined, pct = true): string {
  if (v == null) return 'n/a';
  return pct ? `${(v * 100).toFixed(1)}%` : v.toFixed(2);
}

function numCls(v: number | null | undefined): string {
  if (v == null) return '';
  return v >= 0 ? 'perf-pos' : 'perf-neg';
}

function MiniTable({
  title, selected, periodMetrics, field, pct, colored, palette,
}: {
  title: string;
  selected: string[];
  periodMetrics: PeriodMetricRow[];
  field: 'ret' | 'vol' | 'sharpe';
  pct: boolean;
  colored: boolean;
  palette: string[];
}) {
  return (
    <div className="cmp-mini-table">
      <div className="cmp-mini-title">{title}</div>
      <table>
        <thead>
          <tr>
            <th>ETF</th>
            {SIDEBAR_PERIODS.map(p => <th key={p}>{SIDEBAR_LABELS[p]}</th>)}
          </tr>
        </thead>
        <tbody>
          {selected.map((ticker, i) => {
            const row = findPeriodMetric(periodMetrics, ticker);
            return (
              <tr key={ticker}>
                <td>
                  <span className="cmp-mini-swatch" style={{ background: palette[i % palette.length] }} />
                  {ticker.replace('.AX', '')}
                </td>
                {SIDEBAR_PERIODS.map(p => {
                  const val = (row?.[`${field}_${p}` as keyof PeriodMetricRow] ?? null) as number | null;
                  return (
                    <td key={p} className={colored ? numCls(val) : ''}>
                      {fmt1(val, pct)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function computeCpiCumReturn(
  cpi: CpiDateValues,
  startDate: string,
): { x: string[]; y: number[] } | null {
  const idx = cpi.dates.findIndex(d => d >= startDate);
  if (idx === -1) return null;
  const base = cpi.values[idx];
  if (!base || base <= 0) return null;
  return {
    x: cpi.dates.slice(idx),
    y: cpi.values.slice(idx).map(v => (v / base - 1) * 100),
  };
}

function defaultStartDate(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 5);
  return d.toISOString().slice(0, 10);
}

interface Props {
  periodMetrics: PeriodMetricRow[];
}

export function Compare({ periodMetrics }: Props) {
  const { series, loaded, error } = usePriceSeries();
  const cpiSeries = useCpiSeries();

  const [selected, setSelected]   = useState<string[]>([]);
  const [startDate, setStartDate] = useState(defaultStartDate);

  const toggle    = (ticker: string) =>
    setSelected(s => s.includes(ticker) ? s.filter(t => t !== ticker) : [...s, ticker]);
  const selectAll = () => setSelected(ALL_ETF_TICKERS.filter(t => series[t]));
  const clearAll  = () => setSelected([]);

  const { traces, noDataTickers } = useMemo(() => {
    const traces: Plotly.Data[] = [];
    const noData: string[] = [];

    selected.forEach((ticker, i) => {
      const result = computeCumReturn(ticker, series, startDate);
      if (!result) { noData.push(ticker.replace('.AX', '')); return; }
      traces.push({
        name: ticker.replace('.AX', ''),
        x: result.x,
        y: result.y,
        type: 'scatter',
        mode: 'lines',
        line: { color: PALETTE[i % PALETTE.length], width: 2 },
        hovertemplate: `<b>${ticker.replace('.AX', '')}</b><br>%{x}<br>%{y:.2f}%<extra></extra>`,
      });
    });

    if (cpiSeries) {
      const cpiResult = computeCpiCumReturn(cpiSeries.quarterly_index, startDate);
      if (cpiResult) {
        traces.push({
          name: 'CPI (inflation)',
          x: cpiResult.x,
          y: cpiResult.y,
          type: 'scatter',
          mode: 'lines',
          line: { width: 1.5, dash: 'dot', color: '#9b59b6' },
          hovertemplate: 'CPI: %{y:.2f}%<extra></extra>',
        });
      }
    }

    return { traces, noDataTickers: noData };
  }, [selected, series, startDate, cpiSeries]);

  const minDate = useMemo(() => {
    const firsts = ALL_ETF_TICKERS.map(t => series[t]?.dates[0]).filter(Boolean) as string[];
    return firsts.length ? firsts.sort()[0] : '2000-01-01';
  }, [series]);

  const showSidebar = selected.length > 0 && traces.length > 0;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Compare Returns</h1>
        <p className="page-subtitle">
          Cumulative total return (adjusted for dividends) from the selected start date.
          All ETFs start at 0%.
        </p>
      </div>

      {/* Controls */}
      <div className="card compare-controls">
        <div className="compare-date-row">
          <label htmlFor="cmp-start" className="compare-date-label">Start date</label>
          <input
            id="cmp-start"
            type="date"
            value={startDate}
            min={minDate}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setStartDate(e.target.value)}
            className="compare-date-input"
          />
          <div className="compare-bulk-actions">
            <button className="btn btn-secondary" onClick={selectAll} disabled={!loaded}>
              Select all
            </button>
            <button className="btn btn-secondary" onClick={clearAll} disabled={selected.length === 0}>
              Clear
            </button>
          </div>
        </div>

        {!loaded ? (
          <div className="compare-loading">Loading price data…</div>
        ) : error ? (
          <div className="compare-error">
            Could not load price data. Run <code>python scripts/run_refresh.py</code> and copy{' '}
            <code>data/artifacts/latest/price_series.json</code> to{' '}
            <code>apps/web/public/data/</code>.
          </div>
        ) : (
          <div className="compare-groups">
            {ETF_GROUPS.map(group => (
              <div key={group.id} className="compare-group">
                <span className="compare-group-label">{group.name}</span>
                <div className="compare-chips">
                  {group.tickers.map(ticker => {
                    const hasData = !!series[ticker];
                    const isSelected = selected.includes(ticker);
                    return (
                      <button
                        key={ticker}
                        className={`compare-chip${isSelected ? ' selected' : ''}${!hasData ? ' no-data' : ''}`}
                        onClick={() => hasData && toggle(ticker)}
                        disabled={!hasData}
                        title={!hasData ? 'No data available yet — run refresh' : undefined}
                      >
                        {ticker.replace('.AX', '')}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}

        {noDataTickers.length > 0 && (
          <div className="compare-warning">
            No data from {startDate} for: {noDataTickers.join(', ')} — try an earlier start date.
          </div>
        )}
      </div>

      {/* Chart + sidebar */}
      <div className={showSidebar ? 'compare-bottom-row' : ''}>
        <div className="card">
          {selected.length === 0 ? (
            <div className="empty-chart" style={{ height: 320 }}>
              Select ETFs above to start comparing returns.
            </div>
          ) : traces.length === 0 ? (
            <div className="empty-chart" style={{ height: 320 }}>
              No data available for the selected ETFs from {startDate}.
            </div>
          ) : (
            <Plot
              data={traces}
              layout={{
                autosize: true,
                margin: { t: 24, r: 24, b: 56, l: 64 },
                paper_bgcolor: '#ffffff',
                plot_bgcolor: '#ffffff',
                xaxis: { type: 'date', showgrid: true, gridcolor: '#f0f4f8', zeroline: false },
                yaxis: {
                  title: { text: 'Cumulative Return (%)' },
                  showgrid: true,
                  gridcolor: '#f0f4f8',
                  zeroline: true,
                  zerolinecolor: '#6b7a8d',
                  zerolinewidth: 1.5,
                  ticksuffix: '%',
                },
                legend: { orientation: 'h', yanchor: 'bottom', y: -0.22, xanchor: 'center', x: 0.5 },
                hovermode: 'x unified',
              }}
              config={{ displayModeBar: false, responsive: true }}
              style={{ width: '100%', height: '420px' }}
            />
          )}
        </div>

        {showSidebar && (
          <div className="card cmp-sidebar">
            <MiniTable
              title="Returns"
              selected={selected}
              periodMetrics={periodMetrics}
              field="ret"
              pct
              colored
              palette={PALETTE}
            />
            <MiniTable
              title="Volatility (annualised)"
              selected={selected}
              periodMetrics={periodMetrics}
              field="vol"
              pct
              colored={false}
              palette={PALETTE}
            />
            <MiniTable
              title="Sharpe Ratio"
              selected={selected}
              periodMetrics={periodMetrics}
              field="sharpe"
              pct={false}
              colored
              palette={PALETTE}
            />
          </div>
        )}
      </div>
    </div>
  );
}
