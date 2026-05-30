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
