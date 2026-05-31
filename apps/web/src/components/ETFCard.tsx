import type { ETFDefinition, MetricRow } from '../types/contracts';
import { usePortfolio } from '../context/PortfolioContext';

interface Props {
  etf: ETFDefinition;
  liveMetric?: MetricRow;
  onNavigateToPortfolio?: () => void;
}

export function ETFCard({ etf, liveMetric, onNavigateToPortfolio }: Props) {
  const { portfolio, addETF } = usePortfolio();
  const isAdded = portfolio.members.some(m => m.allocations.some(a => a.ticker === etf.ticker));

  const liveYield = liveMetric && liveMetric.distribution_yield > 0
    ? liveMetric.distribution_yield * 100
    : null;

  const displayYield = liveYield ?? etf.approxYield;
  const yieldLabel = liveYield ? 'Trailing yield' : 'Est. yield';

  const handleAdd = () => {
    addETF(etf.ticker);
    onNavigateToPortfolio?.();
  };

  return (
    <div className="etf-card">
      <div className="etf-card-header">
        <div className="etf-identity">
          <span className="etf-ticker">{etf.ticker.replace('.AX', '')}</span>
          <span className="etf-name">{etf.name}</span>
        </div>
        <div className="etf-metrics-row">
          <div className="etf-metric">
            <span className="metric-value">{displayYield.toFixed(1)}%</span>
            <span className="metric-label">{yieldLabel}</span>
          </div>
          <div className="etf-metric">
            <span className="metric-value">{etf.fee.toFixed(2)}%</span>
            <span className="metric-label">Fee p.a.</span>
          </div>
        </div>
      </div>

      <div className="etf-tags">
        {etf.tags.map(t => (
          <span key={t} className="tag-chip">{t}</span>
        ))}
      </div>

      <details className="etf-details">
        <summary>Pros &amp; Cons</summary>
        <div className="pros-cons">
          <div className="pros">
            {etf.pros.map(p => (
              <div key={p} className="pro-item">&#10003; {p}</div>
            ))}
          </div>
          <div className="cons">
            {etf.cons.map(c => (
              <div key={c} className="con-item">&#10007; {c}</div>
            ))}
          </div>
        </div>
      </details>

      {isAdded ? (
        <button className="btn btn-added" disabled>
          Added to Portfolio ✓
        </button>
      ) : (
        <button className="btn btn-primary" onClick={handleAdd}>
          + Add to Portfolio
        </button>
      )}
    </div>
  );
}
