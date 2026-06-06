interface Term {
  term: string;
  definition: string;
  note?: string;
}

interface Section {
  heading: string;
  terms: Term[];
}

const SECTIONS: Section[] = [
  {
    heading: 'Return Metrics',
    terms: [
      {
        term: 'Cumulative Return',
        definition:
          'Total percentage gain (or loss) over the full period, including reinvested dividends. A 50% cumulative return means $100 grew to $150.',
      },
      {
        term: 'CAGR — Compound Annual Growth Rate',
        definition:
          'The constant annual rate that would produce the same cumulative return over the period. CAGR smooths out year-to-year volatility into a single representative figure.',
        note: 'Formula: (end / start)^(1/years) − 1',
      },
      {
        term: 'Period Returns (1M / 3M / 6M / 1Y / 3Y / 5Y / 10Y)',
        definition:
          'Annualised return over the trailing period, calculated from the most recent price date backwards. Shorter periods (1M, 3M, 6M) are simple returns scaled to annual; longer periods (≥1Y) use CAGR.',
        note: 'A ticker with insufficient history shows "n/a" for any period longer than its available data.',
      },
    ],
  },
  {
    heading: 'Risk & Volatility',
    terms: [
      {
        term: 'Volatility (Annualised)',
        definition:
          'Standard deviation of daily log-returns, scaled to an annual figure by multiplying by √252 (trading days per year). Higher volatility means wider price swings — both up and down.',
      },
      {
        term: 'Max Drawdown',
        definition:
          'The largest peak-to-trough decline in the price series, expressed as a percentage. A max drawdown of −30% means the ETF fell at least 30% from its highest point before recovering (or not).',
      },
      {
        term: 'Ulcer Index',
        definition:
          'A measure of downside risk that weights both the depth and duration of drawdowns. Unlike max drawdown, it penalises prolonged underwater periods, not just the single worst drop. Lower is better.',
        note: 'Calculated over the full observation period from each ticker\'s inception date in the dataset.',
      },
    ],
  },
  {
    heading: 'Risk-Adjusted Return Metrics',
    terms: [
      {
        term: 'Sharpe Ratio (Period — Analytics tab)',
        definition:
          'Annualised excess return over a fixed risk-free rate of 4.35% p.a. (approximate RBA Cash Rate), divided by annualised volatility. Used in the period table for comparability across a fixed benchmark.',
        note: 'A Sharpe above 1.0 is generally considered good; above 2.0 is excellent.',
      },
      {
        term: 'Sharpe Ratio (Since Inception — Risk table)',
        definition:
          'Daily excess return over the RBA Cash Rate Target (FIRMMCRT), divided by daily volatility, then scaled by √252. Uses the live RBA rate from the ABS data feed, so it varies over time with monetary policy.',
        note: 'Observation periods differ across tickers depending on data availability — compare with care.',
      },
      {
        term: 'Sortino Ratio',
        definition:
          'Like Sharpe, but the denominator uses only downside volatility — the standard deviation of negative daily returns. Rewards ETFs that achieve returns through upside swings rather than general volatility.',
      },
      {
        term: 'Calmar Ratio',
        definition:
          'CAGR since inception divided by the absolute max drawdown. Measures how much return you earned per unit of worst-case drawdown. A Calmar of 0.5 means 0.5% CAGR per 1% of peak-to-trough loss.',
      },
    ],
  },
  {
    heading: 'Rolling Metrics',
    terms: [
      {
        term: 'Rolling Sharpe (36M avg / 36M median)',
        definition:
          'The Sharpe ratio calculated repeatedly over consecutive 36-month windows, then averaged or median-aggregated across all windows. Reveals consistency — an ETF with a high average but low median has had erratic periods.',
      },
      {
        term: 'Rolling Sharpe (60M avg / 60M median)',
        definition:
          'Same as the 36-month rolling Sharpe, but using 60-month (5-year) windows. Longer windows smooth out short-term market regimes and give a more stable view of risk-adjusted performance.',
      },
    ],
  },
  {
    heading: 'Reference Lines',
    terms: [
      {
        term: 'CPI (Backtest chart)',
        definition:
          'Annualised inflation rate over the trailing 3-year window, sourced from the ABS CPI quarterly index (All Groups, weighted average of eight capital cities). Displayed as a dashed line so you can see whether your portfolio\'s rolling return is beating inflation.',
      },
      {
        term: 'CPI (Compare chart)',
        definition:
          'Cumulative inflation since the selected start date, rebased to 0% at that date — the same baseline as the ETF return lines. Shows the real purchasing-power hurdle your investments need to clear.',
      },
      {
        term: 'Risk-Free Rate (RBA Cash Rate)',
        definition:
          'The Reserve Bank of Australia\'s official Cash Rate Target (FIRMMCRT), retrieved via the ABS SDMX-JSON API. Used as the risk-free rate in all since-inception Sharpe, Sortino, and Calmar calculations.',
      },
    ],
  },
  {
    heading: 'Other Terms',
    terms: [
      {
        term: 'Distribution Yield',
        definition:
          'Estimated annual income distributions as a percentage of the ETF\'s unit price. Sources vary by ETF — most are sourced from issuer fact sheets or Morningstar data. Useful for estimating cash flow from income-focused ETFs.',
        note: 'Not the same as total return — distribution yield ignores price appreciation and capital gains.',
      },
      {
        term: 'Management Fee (MER)',
        definition:
          'The annual fee charged by the fund manager, expressed as a percentage of assets under management. Already deducted from the ETF\'s unit price in the historical data, so return figures are net of fees.',
      },
      {
        term: 'Observation Period',
        definition:
          'The date range used to calculate since-inception risk metrics for a given ticker. Varies by ETF depending on when it was listed on the ASX and when reliable price data begins. Always check the observation start/end columns when comparing across ETFs.',
      },
    ],
  },
];

export function Glossary() {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Glossary</h1>
        <p className="page-subtitle">
          Definitions for all metrics used across the dashboard.
        </p>
      </div>

      {SECTIONS.map(section => (
        <div key={section.heading} className="card glossary-section">
          <h2 className="glossary-heading">{section.heading}</h2>
          <dl className="glossary-list">
            {section.terms.map(({ term, definition, note }) => (
              <div key={term} className="glossary-entry">
                <dt className="glossary-term">{term}</dt>
                <dd className="glossary-def">
                  {definition}
                  {note && <span className="glossary-note">{note}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}
