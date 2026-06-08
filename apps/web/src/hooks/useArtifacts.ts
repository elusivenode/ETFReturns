import { useEffect, useState } from 'react';
import type { MetricRow, PeriodMetricRow, RiskMetricRow, RiskMetricsArtifact } from '../types/contracts';

export interface ArtifactsState {
  metrics: MetricRow[];
  loaded: boolean;
}

export function useArtifacts(): ArtifactsState {
  const [state, setState] = useState<ArtifactsState>({ metrics: [], loaded: false });

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/metrics.json`)
      .then(r => r.json())
      .then((metrics: MetricRow[]) => setState({ metrics, loaded: true }))
      .catch(() => setState({ metrics: [], loaded: true }));
  }, []);

  return state;
}

export function findMetric(metrics: MetricRow[], ticker: string): MetricRow | undefined {
  return metrics.find(m => m.ticker === ticker);
}

export function usePeriodMetrics(): PeriodMetricRow[] {
  const [rows, setRows] = useState<PeriodMetricRow[]>([]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/period_metrics.json`)
      .then(r => r.json())
      .then((data: PeriodMetricRow[]) => setRows(data))
      .catch(() => {});
  }, []);
  return rows;
}

export function findPeriodMetric(rows: PeriodMetricRow[], ticker: string): PeriodMetricRow | undefined {
  return rows.find(r => r.ticker === ticker);
}

export function useRiskMetrics(): RiskMetricRow[] {
  const [rows, setRows] = useState<RiskMetricRow[]>([]);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/risk_metrics.json`)
      .then(r => r.ok ? r.json() : null)
      .then((d: RiskMetricsArtifact | null) => { if (d?.tickers?.length) setRows(d.tickers); })
      .catch(() => {});
  }, []);
  return rows;
}

export function findRiskMetric(rows: RiskMetricRow[], ticker: string): RiskMetricRow | undefined {
  return rows.find(r => r.ticker === ticker);
}

export interface CpiDateValues {
  dates: string[];
  values: number[];
}

export interface CpiSeries {
  quarterly_index: CpiDateValues;
  rolling_3y: CpiDateValues;
}

export interface PerformancePeriodRow {
  period_code: 'SI' | '1Y' | '3Y' | '5Y' | '10Y';
  twr_annualized: number | null;
  mwr_annualized: number | null;
  benchmark_annualized: number | null;
  excess_annualized: number | null;
  volatility_annualized: number | null;
  max_drawdown: number | null;
}

export interface PerformanceArtifact {
  portfolio_id: string;
  benchmark_code: string;
  calculation_version: string;
  as_of_date: string;
  current_value: number | null;
  capital_sources: {
    rollover_capital: number;
    contributions: number;
    investment_returns: number;
    current_value: number;
  } | null;
  valuation_series: {
    dates: string[];
    values: number[];
  } | null;
  cumulative_return_series: {
    dates: string[];
    portfolio: number[];
    benchmark: number[];
  } | null;
  rolling_3y_return_series: {
    dates: string[];
    portfolio_3y_pa: number[];
    benchmark_3y_pa: number[];
  } | null;
  periods: PerformancePeriodRow[];
}

export function useCpiSeries(): CpiSeries | null {
  const [data, setData] = useState<CpiSeries | null>(null);
  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/cpi_series.json`)
      .then(r => r.ok ? r.json() : null)
      .then((d: CpiSeries | null) => {
        if (d?.rolling_3y?.dates?.length) setData(d);
      })
      .catch(() => {});
  }, []);
  return data;
}

export function usePerformanceArtifact(): PerformanceArtifact | null {
  const [data, setData] = useState<PerformanceArtifact | null>(null);

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/performance_metrics.json`)
      .then(r => r.ok ? r.json() : null)
      .then((d: PerformanceArtifact | null) => {
        if (d?.periods?.length) setData(d);
      })
      .catch(() => {});
  }, []);

  return data;
}
