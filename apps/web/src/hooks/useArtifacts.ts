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
