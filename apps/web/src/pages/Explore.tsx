import { ASSET_CLASSES } from '../data/assetClasses';
import { RoleBadge, RiskBadge } from '../components/Badge';
import { ETFCard } from '../components/ETFCard';
import { findMetric } from '../hooks/useArtifacts';
import type { MetricRow } from '../types/contracts';
import type { Page } from '../components/Nav';

interface Props {
  metrics: MetricRow[];
  onNavigate: (page: Page) => void;
}

export function Explore({ metrics, onNavigate }: Props) {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Explore ETFs</h1>
        <p className="page-subtitle">
          Browse by asset class. Add ETFs to your portfolio, then set allocations in the Portfolio Builder.
        </p>
      </div>

      {ASSET_CLASSES.map(cls => (
        <section key={cls.id} className="asset-class-section card">
          <div className="asset-class-header">
            <div>
              <h2 className="asset-class-name">{cls.name}</h2>
              <p className="asset-class-desc">{cls.description}</p>
            </div>
            <div className="asset-class-badges">
              <RoleBadge role={cls.role} />
              <RiskBadge risk={cls.risk} />
            </div>
          </div>

          {cls.etfs.length === 0 ? (
            <div className="cash-bucket">
              <p>
                Cash is managed directly in your SMSF bank account. Set your cash allocation and
                current yield in the{' '}
                <button className="link-btn" onClick={() => onNavigate('portfolio')}>
                  Portfolio Builder
                </button>
                .
              </p>
            </div>
          ) : (
            <div className="etf-grid">
              {cls.etfs.map(etf => (
                <ETFCard
                  key={etf.ticker}
                  etf={etf}
                  liveMetric={findMetric(metrics, etf.ticker)}
                  onNavigateToPortfolio={() => onNavigate('portfolio')}
                />
              ))}
            </div>
          )}
        </section>
      ))}
    </div>
  );
}
