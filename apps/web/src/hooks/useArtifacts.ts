import { useEffect, useState } from 'react';
import type { MetricRow } from '../types/contracts';

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
