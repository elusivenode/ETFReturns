// ── Artifact types (from Python pipeline JSON) ──────────────────────────────

export type MetricRow = {
  ticker: string;
  latest_date: string;
  total_return: number;
  cagr: number;
  volatility: number;
  max_drawdown: number;
  distribution_yield: number;
  // Per-period annualised return + volatility (null if insufficient history)
  cagr_1y: number | null;
  cagr_2y: number | null;
  cagr_3y: number | null;
  cagr_4y: number | null;
  cagr_5y: number | null;
  vol_1y: number | null;
  vol_2y: number | null;
  vol_3y: number | null;
  vol_4y: number | null;
  vol_5y: number | null;
};

export type PeriodMetricRow = {
  ticker: string;
  ret_1m:  number | null; ret_3m:  number | null; ret_6m:  number | null;
  ret_1y:  number | null; ret_3y:  number | null; ret_5y:  number | null; ret_10y: number | null;
  vol_1m:  number | null; vol_3m:  number | null; vol_6m:  number | null;
  vol_1y:  number | null; vol_3y:  number | null; vol_5y:  number | null; vol_10y: number | null;
  sharpe_1m:  number | null; sharpe_3m:  number | null; sharpe_6m:  number | null;
  sharpe_1y:  number | null; sharpe_3y:  number | null; sharpe_5y:  number | null; sharpe_10y: number | null;
};

export type CorrelationPayload = {
  tickers: string[];
  matrix: number[][];
};

export type BacktestPoint = {
  date: string;
  portfolio_value: number;
};

// ── Static ETF / asset-class types ──────────────────────────────────────────

export type AssetClassRole = 'income' | 'growth' | 'stability' | 'defensive';
export type RiskLevel = 'low' | 'medium' | 'high';

export interface ETFDefinition {
  ticker: string;       // e.g. "VAS.AX"
  name: string;
  fee: number;          // management fee % p.a.
  feeVerified?: boolean; // true when validated against PDS/issuer page
  feeAsOf?: string;      // ISO date of fee verification
  feeSource?: string;    // source reference, e.g. issuer URL or PDS name
  approxYield: number;  // estimated distribution yield % p.a.
  yieldSource?: string;  // explanation of estimate source when live metric is unavailable
  metadataNote?: string; // optional caveat for assessment
  tags: string[];
  pros: string[];
  cons: string[];
}

export interface AssetClass {
  id: string;
  name: string;
  description: string;
  role: AssetClassRole;
  risk: RiskLevel;
  etfs: ETFDefinition[];
}

// ── Price series artifact (from price_series.json) ──────────────────────────
// { "VAS.AX": { "dates": ["2020-01-15", ...], "prices": [85.23, ...] }, ... }
export type PriceSeriesArtifact = Record<string, { dates: string[]; prices: number[] }>;

// ── Portfolio state (persisted to localStorage) ──────────────────────────────

export interface Allocation {
  ticker: string;  // ETF ticker or "CASH"
  weight: number;  // 0–100
}

export interface MemberPortfolio {
  name: string;
  balance: number;       // AUD
  allocations: Allocation[];
}

export interface PortfolioState {
  cashYield: number;                           // % p.a., shared across both members
  members: [MemberPortfolio, MemberPortfolio]; // always exactly two
}

// Stored in data/portfolio-state.json via GitHub API for cross-device state sync
export interface PortfolioStateFile extends PortfolioState {
  saved_at: string;  // ISO timestamp
}
