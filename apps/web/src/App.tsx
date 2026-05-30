import { useEffect, useMemo, useState } from "react";
import Plot from "react-plotly.js";
import type { BacktestPoint, CorrelationPayload, MetricRow } from "./types/contracts";

const pct = (n: number) => `${(n * 100).toFixed(2)}%`;

function App() {
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [backtest, setBacktest] = useState<BacktestPoint[]>([]);
  const [correlation, setCorrelation] = useState<CorrelationPayload | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("./data/metrics.json").then((r) => r.json()),
      fetch("./data/portfolio_backtest.json").then((r) => r.json()),
      fetch("./data/correlation.json").then((r) => r.json())
    ])
      .then(([m, b, c]) => {
        setMetrics(m);
        setBacktest(b);
        setCorrelation(c);
      })
      .catch(() => {
        setMetrics([]);
        setBacktest([]);
        setCorrelation(null);
      });
  }, []);

  const topByCagr = useMemo(() => [...metrics].sort((a, b) => b.cagr - a.cagr).slice(0, 5), [metrics]);

  return (
    <main className="page">
      <header>
        <h1>SMSF ETF Analytics (MVP)</h1>
        <p>Static dashboard powered by precomputed JSON artifacts.</p>
      </header>

      <section className="card">
        <h2>Top 5 ETFs by CAGR</h2>
        <table>
          <thead>
            <tr>
              <th>Ticker</th>
              <th>CAGR</th>
              <th>Volatility</th>
              <th>Max Drawdown</th>
              <th>Dist. Yield</th>
            </tr>
          </thead>
          <tbody>
            {topByCagr.map((row) => (
              <tr key={row.ticker}>
                <td>{row.ticker}</td>
                <td>{pct(row.cagr)}</td>
                <td>{pct(row.volatility)}</td>
                <td>{pct(row.max_drawdown)}</td>
                <td>{pct(row.distribution_yield)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card">
        <h2>Equal-Weight Portfolio Backtest</h2>
        <Plot
          data={[
            {
              x: backtest.map((p) => p.date),
              y: backtest.map((p) => p.portfolio_value),
              type: "scatter",
              mode: "lines",
              line: { color: "#0a6e4f" }
            }
          ]}
          layout={{
            autosize: true,
            margin: { t: 16, r: 16, b: 40, l: 56 },
            paper_bgcolor: "#ffffff",
            plot_bgcolor: "#ffffff"
          }}
          config={{ displayModeBar: false, responsive: true }}
          style={{ width: "100%", height: "360px" }}
        />
      </section>

      <section className="card">
        <h2>Correlation Matrix (Daily Returns)</h2>
        {correlation && (
          <Plot
            data={[
              {
                z: correlation.matrix,
                x: correlation.tickers,
                y: correlation.tickers,
                type: "heatmap",
                colorscale: "Viridis",
                zmin: -1,
                zmax: 1
              }
            ]}
            layout={{
              autosize: true,
              margin: { t: 16, r: 16, b: 64, l: 64 },
              paper_bgcolor: "#ffffff",
              plot_bgcolor: "#ffffff"
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: "420px" }}
          />
        )}
      </section>
    </main>
  );
}

export default App;
