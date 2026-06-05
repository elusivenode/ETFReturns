import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { ETFDefinition, MetricRow } from '../types/contracts';
import { usePortfolio } from '../context/PortfolioContext';

interface Props {
  etf: ETFDefinition;
  liveMetric?: MetricRow;
  onNavigateToPortfolio?: () => void;
}

const PERIODS: Array<{ label: string; years: number; cagrKey: keyof MetricRow; volKey: keyof MetricRow }> = [
  { label: '1 year',  years: 1, cagrKey: 'cagr_1y', volKey: 'vol_1y' },
  { label: '2 years', years: 2, cagrKey: 'cagr_2y', volKey: 'vol_2y' },
  { label: '3 years', years: 3, cagrKey: 'cagr_3y', volKey: 'vol_3y' },
  { label: '4 years', years: 4, cagrKey: 'cagr_4y', volKey: 'vol_4y' },
  { label: '5 years', years: 5, cagrKey: 'cagr_5y', volKey: 'vol_5y' },
];

function pct(v: number | null | undefined): string {
  if (v == null) return '—';
  return `${(v * 100).toFixed(1)}%`;
}

function returnClass(v: number | null | undefined): string {
  if (v == null) return '';
  return v >= 0 ? 'return-positive' : 'return-negative';
}

export function ETFCard({ etf, liveMetric, onNavigateToPortfolio }: Props) {
  const { portfolio, addETF } = usePortfolio();
  const isAdded = portfolio.members.some(m => m.allocations.some(a => a.ticker === etf.ticker));

  const liveYield = liveMetric && liveMetric.distribution_yield > 0
    ? liveMetric.distribution_yield * 100
    : null;
  const displayYield = liveYield ?? etf.approxYield;
  const yieldLabel   = liveYield ? 'Trailing yield' : 'Est. yield';
  const feeLabel     = etf.feeVerified ? 'Fee p.a. (verified)' : 'Fee p.a. (est.)';

  // ── Returns popup ────────────────────────────────────────────────────────
  const [showReturns, setShowReturns] = useState(false);
  const [popupPos, setPopupPos]       = useState<{ top: number; left: number } | null>(null);
  const returnsBtnRef                 = useRef<HTMLButtonElement>(null);

  const handleReturnsClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (showReturns) { setShowReturns(false); setPopupPos(null); return; }
    if (returnsBtnRef.current) {
      const rect = returnsBtnRef.current.getBoundingClientRect();
      // Prefer opening below; flip above if within 240px of bottom
      const spaceBelow = window.innerHeight - rect.bottom;
      const top = spaceBelow > 240 ? rect.bottom + 6 : rect.top - 6;
      const left = Math.min(rect.left, window.innerWidth - 300);
      setPopupPos({ top, left });
    }
    setShowReturns(true);
  };

  // Close on any outside click
  useEffect(() => {
    if (!showReturns) return;
    const close = () => { setShowReturns(false); setPopupPos(null); };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [showReturns]);

  const hasAnyData = liveMetric && PERIODS.some(p => liveMetric[p.cagrKey] != null);

  const handleAdd = () => { addETF(etf.ticker); onNavigateToPortfolio?.(); };

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
            <span className="metric-label">{feeLabel}</span>
          </div>
        </div>
      </div>

      {(!etf.feeVerified || etf.metadataNote) && (
        <div className="section-note" style={{ marginBottom: 8 }}>
          {etf.metadataNote ?? 'Some metadata values are estimated pending PDS/issuer verification.'}
        </div>
      )}

      <div className="etf-tags">
        {etf.tags.map(t => <span key={t} className="tag-chip">{t}</span>)}
      </div>

      <details className="etf-details">
        <summary>Pros &amp; Cons</summary>
        <div className="pros-cons">
          <div className="pros">{etf.pros.map(p => <div key={p} className="pro-item">&#10003; {p}</div>)}</div>
          <div className="cons">{etf.cons.map(c => <div key={c} className="con-item">&#10007; {c}</div>)}</div>
        </div>
      </details>

      <div className="etf-card-actions">
        {isAdded ? (
          <button className="btn btn-added" disabled>Added to Portfolio ✓</button>
        ) : (
          <button className="btn btn-primary" onClick={handleAdd}>+ Add to Portfolio</button>
        )}
        <button
          ref={returnsBtnRef}
          className={`btn btn-returns${showReturns ? ' active' : ''}`}
          onClick={handleReturnsClick}
          title="View historical returns"
        >
          Returns ↗
        </button>
      </div>

      {/* Returns popup — portaled to body so it floats above the grid */}
      {showReturns && popupPos && createPortal(
        <div
          className="returns-popup"
          style={{
            position: 'fixed',
            top: popupPos.top,
            left: popupPos.left,
            // Flip anchor: if opening above, align bottom to cursor
            transform: window.innerHeight - popupPos.top < 240
              ? 'translateY(-100%) translateY(-12px)'
              : undefined,
          }}
          onClick={e => e.stopPropagation()}
        >
          <div className="returns-popup-header">
            <span>
              {etf.ticker.replace('.AX', '')} Historical Returns
              {liveMetric?.latest_date && (
                <span className="returns-popup-date"> — to {liveMetric.latest_date}</span>
              )}
            </span>
            <button
              className="modal-close"
              onClick={() => { setShowReturns(false); setPopupPos(null); }}
              aria-label="Close"
            >×</button>
          </div>

          {!liveMetric || !hasAnyData ? (
            <div className="returns-no-data">
              No data available yet — run a data refresh.
            </div>
          ) : (
            <table className="returns-table">
              <thead>
                <tr>
                  <th>Period</th>
                  <th>Ann. Return</th>
                  <th>Volatility</th>
                </tr>
              </thead>
              <tbody>
                {PERIODS.map(p => {
                  const ret = liveMetric[p.cagrKey] as number | null;
                  const vol = liveMetric[p.volKey]  as number | null;
                  return (
                    <tr key={p.label}>
                      <td>{p.label}</td>
                      <td className={returnClass(ret)}>{pct(ret)}</td>
                      <td>{pct(vol)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>,
        document.body,
      )}
    </div>
  );
}
