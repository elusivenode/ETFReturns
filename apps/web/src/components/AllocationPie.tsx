import Plot from 'react-plotly.js';
import { ASSET_CLASSES } from '../data/assetClasses';
import type { Allocation } from '../types/contracts';

const CLASS_COLORS: Record<string, string> = {
  'aus-equities':           '#0a6e4f',
  'global-equities':        '#1a56b0',
  'fixed-income':           '#6b7a8d',
  'defensive-alternatives': '#b8860b',
  'property-infra':         '#7b3c8f',
  'cash':                   '#a0a0a0',
};

const CLASS_LABELS: Record<string, string> = {
  'aus-equities':           'Aust. Equities',
  'global-equities':        'Global Equities',
  'fixed-income':           'Fixed Income',
  'defensive-alternatives': 'Defensive',
  'property-infra':         'Property & Infra',
  'cash':                   'Cash',
};

function classIdForTicker(ticker: string): string {
  if (ticker === 'CASH') return 'cash';
  return ASSET_CLASSES.find(c => c.etfs.some(e => e.ticker === ticker))?.id ?? 'cash';
}

export function AllocationPie({ allocations }: { allocations: Allocation[] }) {
  const active = allocations.filter(a => a.weight > 0);

  if (active.length === 0) {
    return <div className="empty-chart">No allocations set yet</div>;
  }

  // Group by asset class
  const grouped: Record<string, number> = {};
  for (const a of active) {
    const id = classIdForTicker(a.ticker);
    grouped[id] = (grouped[id] ?? 0) + a.weight;
  }

  const labels = Object.keys(grouped).map(id => CLASS_LABELS[id] ?? id);
  const values = Object.values(grouped);
  const colors = Object.keys(grouped).map(id => CLASS_COLORS[id] ?? '#ccc');

  return (
    <Plot
      data={[
        {
          type: 'pie',
          labels,
          values,
          marker: { colors },
          hole: 0.52,
          textinfo: 'label+percent',
          hoverinfo: 'label+value+percent',
          hovertemplate: '%{label}<br>%{value}%<extra></extra>',
        },
      ]}
      layout={{
        autosize: true,
        margin: { t: 8, r: 8, b: 8, l: 8 },
        paper_bgcolor: 'transparent',
        showlegend: false,
      }}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: '100%', height: '260px' }}
    />
  );
}
