import { useMemo } from 'react';
import Plot from 'react-plotly.js';
import { usePortfolio } from '../context/PortfolioContext';
import { usePriceSeries } from '../hooks/usePriceSeries';
import { useCpiSeries } from '../hooks/useArtifacts';
import type { MemberPortfolio, PriceSeriesArtifact } from '../types/contracts';

const TRADING_DAYS_PER_YEAR = 252;
const ROLLING_YEARS = 3;
const ROLLING_WINDOW = TRADING_DAYS_PER_YEAR * ROLLING_YEARS;
const CPI_PREMIUM = 0.05;

type RollingPoint = {
  date: string;
  return3y: number;
  vol3y: number;
};

type LimiterInfo = {
  ticker: string;
  originalWeight: number; // percent
  startDate: string;
};

type MemberBacktest = {
  member: string;
  points: RollingPoint[];
  rangeStart: string | null;
  rangeEnd: string | null;
  missingTickers: string[];
  limiters: LimiterInfo[];
  weightTotal: number;
  error: string | null;
};

function pct(v: number): string {
  return `${v.toFixed(2)}%`;
}

function tenYearsAgoIso(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 10);
  return d.toISOString().slice(0, 10);
}

function normalizeWeights(member: MemberPortfolio): { ticker: string; weight: number }[] {
  return member.allocations
    .filter(a => a.weight > 0)
    .map(a => ({ ticker: a.ticker, weight: a.weight / 100 }));
}

function cashDailyReturn(cashYieldPercent: number): number {
  return Math.pow(1 + (cashYieldPercent / 100), 1 / TRADING_DAYS_PER_YEAR) - 1;
}

function buildDailyReturnMap(series: PriceSeriesArtifact, ticker: string): Map<string, number> {
  const out = new Map<string, number>();
  const data = series[ticker];
  if (!data || data.dates.length < 2) return out;

  for (let i = 1; i < data.dates.length; i += 1) {
    const prev = data.prices[i - 1];
    const curr = data.prices[i];
    if (!prev || !curr || prev <= 0 || curr <= 0) continue;
    out.set(data.dates[i], (curr / prev) - 1);
  }

  return out;
}

function intersectSortedDates(maps: Map<string, number>[]): string[] {
  if (maps.length === 0) return [];
  const [first, ...rest] = maps;
  const dates = [...first.keys()].filter(date => rest.every(m => m.has(date)));
  dates.sort();
  return dates;
}

function findBestSubset(
  etfWeights: { ticker: string; weight: number }[],
  maps: Map<string, number>[],
): { includedIndices: number[]; limiters: LimiterInfo[] } {
  const tenYearsAgo = tenYearsAgoIso();

  const info = etfWeights.map((ew, i) => {
    const keys = [...maps[i].keys()].sort();
    return { index: i, ticker: ew.ticker, weight: ew.weight, startDate: keys[0] ?? '' };
  });

  const byLatestStart = [...info].sort((a, b) => b.startDate.localeCompare(a.startDate));

  let included = info.map((_, i) => i);
  const limiters: LimiterInfo[] = [];

  while (included.length > 1) {
    const commonDates = intersectSortedDates(included.map(i => maps[i]));

    if (commonDates.length < ROLLING_WINDOW) {
      const toDrop = byLatestStart.find(s => included.includes(s.index))!;
      limiters.push({ ticker: toDrop.ticker, originalWeight: toDrop.weight * 100, startDate: toDrop.startDate });
      included = included.filter(i => i !== toDrop.index);
      continue;
    }

    const firstRollingDate = commonDates[ROLLING_WINDOW - 1];
    if (firstRollingDate <= tenYearsAgo) break;

    const candidate = byLatestStart.find(s => included.includes(s.index));
    if (!candidate) break;

    const withoutCandidate = included.filter(i => i !== candidate.index);
    if (withoutCandidate.length === 0) break;

    const datesWithout = intersectSortedDates(withoutCandidate.map(i => maps[i]));
    const firstRollingWithout = datesWithout[ROLLING_WINDOW - 1];
    if (!firstRollingWithout || firstRollingWithout >= firstRollingDate) break;

    limiters.push({ ticker: candidate.ticker, originalWeight: candidate.weight * 100, startDate: candidate.startDate });
    included = withoutCandidate;
  }

  return { includedIndices: included, limiters };
}

function annualizedVolatility(returns: number[]): number {
  const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
  const variance = returns.reduce((s, r) => {
    const d = r - mean;
    return s + (d * d);
  }, 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(TRADING_DAYS_PER_YEAR);
}

function annualizedReturn(totalReturn: number, years: number): number {
  if (totalReturn <= -1) return -1;
  return Math.pow(1 + totalReturn, 1 / years) - 1;
}

function buildRollingSeries(
  member: MemberPortfolio,
  series: PriceSeriesArtifact,
  cashYield: number,
): MemberBacktest {
  const weights = normalizeWeights(member);
  const weightTotal = weights.reduce((s, w) => s + (w.weight * 100), 0);

  if (weights.length === 0) {
    return {
      member: member.name,
      points: [],
      rangeStart: null,
      rangeEnd: null,
      missingTickers: [],
      limiters: [],
      weightTotal,
      error: 'No allocations set.',
    };
  }

  if (Math.abs(weightTotal - 100) > 0.25) {
    return {
      member: member.name,
      points: [],
      rangeStart: null,
      rangeEnd: null,
      missingTickers: [],
      limiters: [],
      weightTotal,
      error: `Allocations sum to ${weightTotal.toFixed(1)}%. Set to 100% to backtest.`,
    };
  }

  const etfWeights = weights.filter(w => w.ticker !== 'CASH');
  const missingTickers = etfWeights
    .filter(w => !series[w.ticker])
    .map(w => w.ticker.replace('.AX', ''));

  if (missingTickers.length > 0) {
    return {
      member: member.name,
      points: [],
      rangeStart: null,
      rangeEnd: null,
      missingTickers,
      limiters: [],
      weightTotal,
      error: 'Missing price history for one or more selected ETFs.',
    };
  }

  const cashWeight = weights.find(w => w.ticker === 'CASH')?.weight ?? 0;
  const cashDaily = cashDailyReturn(cashYield);

  const allMaps = etfWeights.map(w => buildDailyReturnMap(series, w.ticker));
  const etfStartDates = allMaps.map(m => [...m.keys()].sort()[0] ?? '9999-12-31');

  // Backbone: use findBestSubset to get a date spine with maximum history
  const { includedIndices: backboneIndices } = findBestSubset(etfWeights, allMaps);
  const backbone = intersectSortedDates(backboneIndices.map(i => allMaps[i]));

  if (backbone.length < ROLLING_WINDOW) {
    return {
      member: member.name,
      points: [],
      rangeStart: backbone[0] ?? null,
      rangeEnd: backbone[backbone.length - 1] ?? null,
      missingTickers,
      limiters: [],
      weightTotal,
      error: 'Not enough overlap across core holdings for a 3-year rolling backtest.',
    };
  }

  // Time-varying weights: composition is determined day-by-day within each window.
  // An ETF is included on a given day if it was live on that date, with weights
  // rescaled so the portfolio is always fully invested.
  const windowLimiterSet = new Set<number>();
  const rolling: RollingPoint[] = [];

  for (let i = ROLLING_WINDOW - 1; i < backbone.length; i += 1) {
    const windowStart = backbone[i - ROLLING_WINDOW + 1];
    const windowDates = backbone.slice(i - ROLLING_WINDOW + 1, i + 1);

    etfWeights.forEach((_, idx) => {
      if (etfStartDates[idx] > windowStart) windowLimiterSet.add(idx);
    });

    const windowReturns = windowDates.map(date => {
      const presentOnDate = etfWeights
        .map((_, idx) => idx)
        .filter(idx => etfStartDates[idx] <= date);
      const totalEtfWeight = presentOnDate.reduce((s, idx) => s + etfWeights[idx].weight, 0);
      const sf = (totalEtfWeight + cashWeight) > 0 ? 1 / (totalEtfWeight + cashWeight) : 1;
      const etfReturn = presentOnDate.reduce(
        (sum, idx) => sum + etfWeights[idx].weight * sf * (allMaps[idx].get(date) ?? 0),
        0,
      );
      return etfReturn + cashWeight * sf * cashDaily;
    });

    const totalReturn = windowReturns.reduce((acc, r) => acc * (1 + r), 1) - 1;
    rolling.push({
      date: backbone[i],
      return3y: annualizedReturn(totalReturn, ROLLING_YEARS),
      vol3y: annualizedVolatility(windowReturns),
    });
  }

  const limiters: LimiterInfo[] = [...windowLimiterSet]
    .map(idx => ({
      ticker: etfWeights[idx].ticker,
      originalWeight: etfWeights[idx].weight * 100,
      startDate: etfStartDates[idx],
    }))
    .sort((a, b) => a.startDate.localeCompare(b.startDate));

  const start10y = tenYearsAgoIso();
  const preferred = rolling.filter(p => p.date >= start10y);
  const points = preferred.length > 0 ? preferred : rolling;

  return {
    member: member.name,
    points,
    rangeStart: points[0]?.date ?? null,
    rangeEnd: points[points.length - 1]?.date ?? null,
    missingTickers,
    limiters,
    weightTotal,
    error: points.length === 0 ? 'Not enough data for rolling metrics.' : null,
  };
}

function latestLabel(points: RollingPoint[]): string {
  const last = points[points.length - 1];
  if (!last) return '-';
  return `${pct(last.return3y * 100)} return, ${pct(last.vol3y * 100)} vol`;
}

export function Backtest() {
  const { portfolio } = usePortfolio();
  const { series, loaded, error } = usePriceSeries();
  const cpiSeries = useCpiSeries();

  const results = useMemo(() => {
    if (!loaded || error) return [];
    return portfolio.members.map(m => buildRollingSeries(m, series, portfolio.cashYield));
  }, [portfolio.members, portfolio.cashYield, series, loaded, error]);

  const cpiTrace: Plotly.Data | null = cpiSeries
    ? {
        name: 'CPI + 5% (3Y p.a.)',
        x: cpiSeries.rolling_3y.dates,
        y: cpiSeries.rolling_3y.values.map(v => (v + CPI_PREMIUM) * 100),
        type: 'scatter',
        mode: 'lines',
        line: { width: 1.5, dash: 'dot', color: '#9b59b6' },
        hovertemplate: 'CPI + 5% 3Y p.a.: %{y:.2f}%<extra></extra>',
      }
    : null;

  const returnTraces = [
    ...results
      .filter(r => r.points.length > 0)
      .map((r, i) => ({
        name: r.member,
        x: r.points.map(p => p.date),
        y: r.points.map(p => p.return3y * 100),
        type: 'scatter',
        mode: 'lines',
        line: { width: 2.2, color: i === 0 ? '#0a6e4f' : '#1a56b0' },
        hovertemplate: `<b>${r.member}</b><br>%{x}<br>3Y return: %{y:.2f}%<extra></extra>`,
      })),
    ...(cpiTrace ? [cpiTrace] : []),
  ] as Plotly.Data[];

  const volTraces = results
    .filter(r => r.points.length > 0)
    .map((r, i) => ({
      name: r.member,
      x: r.points.map(p => p.date),
      y: r.points.map(p => p.vol3y * 100),
      type: 'scatter',
      mode: 'lines',
      line: { width: 2.2, dash: 'dot', color: i === 0 ? '#0a6e4f' : '#1a56b0' },
      hovertemplate: `<b>${r.member}</b><br>%{x}<br>3Y volatility: %{y:.2f}%<extra></extra>`,
    })) as Plotly.Data[];

  const memberDates = results
    .filter(r => r.points.length > 0)
    .flatMap(r => r.points.map(p => p.date))
    .sort();
  const sharedStart = memberDates[0];
  const sharedEnd   = memberDates[memberDates.length - 1];
  const xRange: [string, string] | undefined =
    sharedStart && sharedEnd ? [sharedStart, sharedEnd] : undefined;

  const latestDateValue = sharedEnd;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Backtest</h1>
        <p className="page-subtitle">
          Rolling 3-year annualised return and volatility for Hamish and Becky portfolios,
          starting 10 years ago when history is available.
        </p>
      </div>

      {!loaded ? (
        <div className="card empty-chart" style={{ height: 180 }}>
          Loading price series...
        </div>
      ) : error ? (
        <div className="card compare-error">
          Could not load price data. Run python scripts/run_refresh.py and copy
          data/artifacts/latest/price_series.json into apps/web/public/data/.
        </div>
      ) : (
        <>
          <div className="card backtest-status-grid">
            {results.map(r => (
              <div key={r.member} className="backtest-status-card">
                <div className="backtest-status-head">
                  <strong>{r.member}</strong>
                  <span className={`backtest-pill${r.error ? ' warning' : ' ok'}`}>
                    {r.error ? 'Needs Attention' : 'Ready'}
                  </span>
                </div>

                {r.error ? (
                  <p className="backtest-status-msg">{r.error}</p>
                ) : (
                  <p className="backtest-status-msg">
                    Latest: {latestLabel(r.points)}
                  </p>
                )}

                <p className="backtest-status-sub">
                  Range: {r.rangeStart ?? '-'} to {r.rangeEnd ?? '-'}
                </p>

                {r.missingTickers.length > 0 && (
                  <p className="backtest-status-sub">
                    Missing: {r.missingTickers.join(', ')}
                  </p>
                )}

                {r.limiters.map(l => (
                  <p key={l.ticker} className="backtest-limiter-note">
                    {l.ticker.replace('.AX', '')} ({l.originalWeight.toFixed(0)}%) live from {l.startDate} — weight redistributed in earlier periods
                  </p>
                ))}
              </div>
            ))}
          </div>

          <div className="card">
            {returnTraces.length === 0 ? (
              <div className="empty-chart" style={{ height: 320 }}>
                Complete both portfolios to 100% and ensure overlapping ETF history.
              </div>
            ) : (
              <Plot
                data={returnTraces}
                layout={{
                  autosize: true,
                  margin: { t: 22, r: 24, b: 56, l: 68 },
                  paper_bgcolor: '#ffffff',
                  plot_bgcolor: '#ffffff',
                  xaxis: {
                    type: 'date',
                    showgrid: true,
                    gridcolor: '#f0f4f8',
                    zeroline: false,
                    ...(xRange ? { range: xRange } : {}),
                  },
                  yaxis: {
                    title: { text: 'Rolling 3Y Return (% p.a.)' },
                    showgrid: true,
                    gridcolor: '#f0f4f8',
                    ticksuffix: '%',
                  },
                  legend: {
                    orientation: 'h',
                    yanchor: 'bottom',
                    y: -0.22,
                    xanchor: 'center',
                    x: 0.5,
                  },
                  hovermode: 'x unified',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '420px' }}
              />
            )}
          </div>

          <div className="card">
            {volTraces.length === 0 ? (
              <div className="empty-chart" style={{ height: 260 }}>
                Rolling volatility appears after a valid 3-year window is available.
              </div>
            ) : (
              <Plot
                data={volTraces}
                layout={{
                  autosize: true,
                  margin: { t: 22, r: 24, b: 56, l: 68 },
                  paper_bgcolor: '#ffffff',
                  plot_bgcolor: '#ffffff',
                  xaxis: {
                    type: 'date',
                    showgrid: true,
                    gridcolor: '#f0f4f8',
                    zeroline: false,
                    ...(xRange ? { range: xRange } : {}),
                  },
                  yaxis: {
                    title: { text: 'Rolling 3Y Volatility (% p.a.)' },
                    showgrid: true,
                    gridcolor: '#f0f4f8',
                    ticksuffix: '%',
                  },
                  legend: {
                    orientation: 'h',
                    yanchor: 'bottom',
                    y: -0.22,
                    xanchor: 'center',
                    x: 0.5,
                  },
                  hovermode: 'x unified',
                }}
                config={{ displayModeBar: false, responsive: true }}
                style={{ width: '100%', height: '360px' }}
              />
            )}
          </div>

          <div className="card backtest-footnote">
            {latestDateValue
              ? `Most recent observation: ${latestDateValue}. Metrics use daily total-return series, annualized over rolling 3-year windows.`
              : 'No rolling observations yet. Add allocations with longer, overlapping price history.'}
          </div>
        </>
      )}
    </div>
  );
}