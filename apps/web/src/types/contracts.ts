// ── Artifact types (from Python pipeline JSON) ──────────────────────────────

export type MetricRow = {
  ticker: string;
  total_return: number;
  cagr: number;
  volatility: number;
  max_drawdown: number;
  distribution_yield: number;
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
  approxYield: number;  // estimated distribution yield % p.a.
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
