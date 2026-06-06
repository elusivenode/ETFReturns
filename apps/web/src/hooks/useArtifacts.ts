import { useEffect, useState } from 'react';
import type { MetricRow, PeriodMetricRow } from '../types/contracts';

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

export interface CpiDateValues {
  dates: string[];
  values: number[];
}

export interface CpiSeries {
  quarterly_index: CpiDateValues;
  rolling_3y: CpiDateValues;
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
