import { useEffect, useState } from 'react';
import type { PriceSeriesArtifact } from '../types/contracts';

interface PriceSeriesState {
  series: PriceSeriesArtifact;
  loaded: boolean;
  error: boolean;
}

// Lazy-loaded — only fetched when the Compare page mounts.
export function usePriceSeries(): PriceSeriesState {
  const [state, setState] = useState<PriceSeriesState>({
    series: {},
    loaded: false,
    error: false,
  });

  useEffect(() => {
    fetch(`${import.meta.env.BASE_URL}data/price_series.json`)
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((series: PriceSeriesArtifact) => setState({ series, loaded: true, error: false }))
      .catch(() => setState({ series: {}, loaded: true, error: true }));
  }, []);

  return state;
}

// Given a ticker's price series and a start date string (YYYY-MM-DD),
// return { x: dates, y: cumulative returns from 0% } or null if no data.
export function computeCumReturn(
  ticker: string,
  series: PriceSeriesArtifact,
  startDate: string,
): { x: string[]; y: number[] } | null {
  const data = series[ticker];
  if (!data || data.dates.length === 0) return null;

  const startIdx = data.dates.findIndex(d => d >= startDate);
  if (startIdx < 0) return null;

  const base = data.prices[startIdx];
  if (!base || base === 0) return null;

  return {
    x: data.dates.slice(startIdx),
    y: data.prices.slice(startIdx).map(p => ((p / base) - 1) * 100),
  };
}
