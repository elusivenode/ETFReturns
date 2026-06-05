import Plot from 'react-plotly.js';
import { ASSET_CLASSES } from '../data/assetClasses';
import type { Allocation } from '../types/contracts';

const CLASS_COLORS: Record<string, string> = {
  'aus-equities':            '#0a6e4f',
  'intl-developed':          '#1a56b0',
  'intl-small-caps':         '#2563eb',
  'emerging-markets':        '#0f766e',
  'property':                '#7b3c8f',
  'infrastructure':          '#8b5cf6',
  'aus-bonds':               '#6b7a8d',
  'credit':                  '#475569',
  'inflation-protection':    '#b8860b',
  'diversified-real-return': '#d97706',
  'alternatives':            '#92400e',
  'cash':                    '#a0a0a0',
};

const CLASS_LABELS: Record<string, string> = {
  'aus-equities':            'Aust. Equities',
  'intl-developed':          'Intl Developed',
  'intl-small-caps':         'Intl Small Caps',
  'emerging-markets':        'Emerging Mkts',
  'property':                'Property',
  'infrastructure':          'Infrastructure',
  'aus-bonds':               'Aust. Bonds',
  'credit':                  'Credit',
  'inflation-protection':    'Inflation Protection',
  'diversified-real-return': 'Diversified / Real Return',
  'alternatives':            'Alternatives',
  'cash':                    'Cash',
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
