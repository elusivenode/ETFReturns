import { useState } from 'react';
import { usePortfolio } from '../context/PortfolioContext';
import { ASSET_CLASSES, findETF, findAssetClass } from '../data/assetClasses';
import { findMetric } from '../hooks/useArtifacts';
import { AllocationPie } from '../components/AllocationPie';
import { GitHubSettings, loadGitHubConfig } from '../components/GitHubSettings';
import { commitPortfolio } from '../lib/github';
import type { MemberPortfolio, MetricRow } from '../types/contracts';
import type { Page } from '../components/Nav';

interface Props {
  metrics: MetricRow[];
  onNavigate: (page: Page) => void;
}

const fmtCurrency = (n: number) =>
  new Intl.NumberFormat('en-AU', { style: 'currency', currency: 'AUD', maximumFractionDigits: 0 }).format(n);

function resolveYield(ticker: string, metrics: MetricRow[], cashYield: number): number {
  if (ticker === 'CASH') return cashYield;
  const live = findMetric(metrics, ticker);
  if (live && live.distribution_yield > 0) return live.distribution_yield * 100;
  return findETF(ticker)?.approxYield ?? 0;
}

// All available tickers (ETFs + CASH)
const ALL_TICKERS = [
  ...ASSET_CLASSES.flatMap(c => c.etfs.map(e => ({ ticker: e.ticker, label: `${e.ticker.replace('.AX', '')} — ${e.name}` }))),
  { ticker: 'CASH', label: 'Cash' },
];

// ── Member panel ─────────────────────────────────────────────────────────────

interface MemberPanelProps {
  idx: number;
  member: MemberPortfolio;
  metrics: MetricRow[];
  cashYield: number;
  onNavigate: (page: Page) => void;
}

function MemberPanel({ idx, member, metrics, cashYield }: MemberPanelProps) {
  const { setMemberBalance, addMemberETF, removeMemberETF, setMemberWeight } = usePortfolio();
  const [addTicker, setAddTicker] = useState('');

  const totalAllocated = member.allocations.reduce((s, a) => s + a.weight, 0);
  const remaining = 100 - totalAllocated;

  const available = ALL_TICKERS.filter(
    t => !member.allocations.find(a => a.ticker === t.ticker),
  );

  const handleAdd = () => {
    if (!addTicker) return;
    addMemberETF(idx, addTicker);
    setAddTicker('');
  };

  const weightedYield = member.allocations.reduce((sum, a) => {
    return sum + (a.weight / 100) * resolveYield(a.ticker, metrics, cashYield);
  }, 0);

  return (
    <div className="member-col card">
      <div className="member-header">
        <span className="member-name">{member.name}</span>
        <div className="input-prefix">
          <span>$</span>
          <input
            type="number"
            value={member.balance}
            min={0}
            step={10000}
            onChange={e => setMemberBalance(idx, Number(e.target.value))}
            aria-label={`${member.name} balance`}
          />
        </div>
      </div>

      <div className="member-stats">
        <span className={`remaining-badge${remaining < 0 ? ' over' : remaining === 0 ? ' done' : ''}`}>
          {remaining === 0
            ? '100% ✓'
            : remaining > 0
            ? `${remaining}% left`
            : `${Math.abs(remaining)}% over`}
        </span>
        <span className="member-yield-hint">{weightedYield.toFixed(1)}% yield</span>
      </div>

      <div className="member-allocs">
        {member.allocations.length === 0 && (
          <div className="empty-state-sm" style={{ padding: '12px 0' }}>
            No ETFs added. Use the selector below or browse Explore.
          </div>
        )}

        {member.allocations.map(alloc => {
          const y = resolveYield(alloc.ticker, metrics, cashYield);
          const etfDef = alloc.ticker === 'CASH' ? null : findETF(alloc.ticker);
          return (
            <div key={alloc.ticker} className="alloc-row">
              <div className="alloc-label">
                <span className="alloc-ticker">{alloc.ticker.replace('.AX', '')}</span>
                <span className="alloc-name">{alloc.ticker === 'CASH' ? 'Cash' : etfDef?.name ?? ''}</span>
                <span className="alloc-yield-hint">{y.toFixed(1)}%</span>
              </div>
              <div className="alloc-controls">
                <div className="alloc-weight-input">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    step={1}
                    value={alloc.weight}
                    onChange={e =>
                      setMemberWeight(idx, alloc.ticker, Math.min(100, Math.max(0, Number(e.target.value) || 0)))
                    }
                    aria-label={`${alloc.ticker} weight`}
                  />
                  <span>%</span>
                </div>
                <button
                  className="remove-btn"
                  onClick={() => removeMemberETF(idx, alloc.ticker)}
                  aria-label={`Remove ${alloc.ticker}`}
                >
                  ×
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {available.length > 0 && (
        <div className="add-etf-row">
          <select
            value={addTicker}
            onChange={e => setAddTicker(e.target.value)}
            aria-label="Select ETF to add"
          >
            <option value="">Add ETF…</option>
            {available.map(t => (
              <option key={t.ticker} value={t.ticker}>{t.label}</option>
            ))}
          </select>
          <button
            className="btn btn-secondary"
            onClick={handleAdd}
            disabled={!addTicker}
          >
            Add
          </button>
        </div>
      )}
    </div>
  );
}

// ── Combined panel ────────────────────────────────────────────────────────────

function CombinedPanel({ metrics, onNavigate }: { metrics: MetricRow[]; onNavigate: (p: Page) => void }) {
  const { combinedAllocations, totalBalance, portfolio } = usePortfolio();
  const { cashYield } = portfolio;

  const weightedYield = combinedAllocations.reduce((sum, a) => {
    return sum + (a.weight / 100) * resolveYield(a.ticker, metrics, cashYield);
  }, 0);

  const annualIncome = (weightedYield / 100) * totalBalance;

  return (
    <div className="combined-col card">
      <div className="combined-header">
        <span className="combined-title">Combined SMSF</span>
        <span className="combined-total">{fmtCurrency(totalBalance)}</span>
      </div>

      <div className="combined-income">
        <div className="income-big">{fmtCurrency(annualIncome)}</div>
        <div className="income-sub">per year · {weightedYield.toFixed(2)}% yield</div>
        <div className="income-sub">{fmtCurrency(annualIncome / 12)} / month</div>
      </div>

      <AllocationPie allocations={combinedAllocations} />

      {combinedAllocations.length > 0 ? (
        <div className="combined-alloc-list">
          {combinedAllocations.map(a => (
            <div key={a.ticker} className="combined-alloc-row">
              <span className="alloc-ticker">{a.ticker.replace('.AX', '')}</span>
              <span className="combined-alloc-name">
                {a.ticker === 'CASH' ? 'Cash' : findETF(a.ticker)?.name ?? ''}
              </span>
              <span className="combined-alloc-weight">{a.weight.toFixed(1)}%</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state-sm">
          Set allocations for each member to see the combined view.
          <br /><br />
          <button className="btn btn-primary" onClick={() => onNavigate('explore')}>Browse ETFs →</button>
        </div>
      )}
    </div>
  );
}

// ── Save status indicator ────────────────────────────────────────────────────

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

function SaveIndicator({ status, errorMsg }: { status: SaveStatus; errorMsg: string }) {
  if (status === 'idle') return null;
  const MAP = {
    saving: { label: 'Saving…',    cls: 'status-saving' },
    saved:  { label: 'Saved ✓',    cls: 'status-saved'  },
    error:  { label: errorMsg,     cls: 'status-error'  },
  } as const;
  const s = MAP[status as keyof typeof MAP];
  return <span className={`save-status ${s.cls}`}>{s.label}</span>;
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function PortfolioBuilder({ metrics, onNavigate }: Props) {
  const { portfolio, setCashYield, combinedAllocations } = usePortfolio();

  const [showSettings, setShowSettings] = useState(false);
  const [saveStatus, setSaveStatus]     = useState<SaveStatus>('idle');
  const [saveError,  setSaveError]      = useState('');

  function validate(): string | null {
    if (combinedAllocations.length === 0) {
      return 'No allocations to save — add ETFs to at least one member first.';
    }
    for (const member of portfolio.members) {
      if (member.allocations.length === 0) continue;
      const total = member.allocations.reduce((s, a) => s + a.weight, 0);
      if (Math.abs(total - 100) > 1) {
        return `${member.name}'s weights sum to ${total.toFixed(0)}% — must be 100% before saving.`;
      }
    }
    return null;
  }

  async function handleSave() {
    const validationError = validate();
    if (validationError) {
      setSaveStatus('error');
      setSaveError(validationError);
      return;
    }

    const cfg = loadGitHubConfig();
    if (!cfg.token || !cfg.owner || !cfg.repo) {
      setShowSettings(true);
      return;
    }

    setSaveStatus('saving');
    setSaveError('');

    try {
      await commitPortfolio(cfg, {
        portfolio_name: 'SMSF Strategic Allocation',
        updated_at: new Date().toISOString(),
        allocations: combinedAllocations.map(a => ({
          asset_class: findAssetClass(a.ticker)?.name ?? 'Cash',
          ticker: a.ticker.replace('.AX', ''),
          weight: Math.round(a.weight * 10) / 10,
        })),
      });
      setSaveStatus('saved');
    } catch (err) {
      setSaveStatus('error');
      setSaveError(err instanceof Error ? err.message : 'Unknown error');
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Portfolio Builder</h1>
        <p className="page-subtitle">
          Set each member's balance and ETF weights. The combined SMSF view merges them weighted by balance.
        </p>
      </div>

      <div className="card settings-bar">
        <label className="settings-inline-label">Cash yield (SMSF account)</label>
        <div className="input-suffix">
          <input
            type="number"
            value={portfolio.cashYield}
            min={0}
            max={20}
            step={0.1}
            onChange={e => setCashYield(Number(e.target.value))}
            style={{ width: 60 }}
          />
          <span>% p.a.</span>
        </div>

        <div className="save-actions">
          <SaveIndicator status={saveStatus} errorMsg={saveError} />
          <button
            className="btn btn-icon"
            onClick={() => setShowSettings(true)}
            title="GitHub Settings"
            aria-label="Open GitHub settings"
          >
            ⚙
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={saveStatus === 'saving'}
          >
            {saveStatus === 'saving' ? 'Saving…' : 'Save Portfolio'}
          </button>
        </div>
      </div>

      <div className="member-cols">
        {portfolio.members.map((member, idx) => (
          <MemberPanel
            key={member.name}
            idx={idx}
            member={member}
            metrics={metrics}
            cashYield={portfolio.cashYield}
            onNavigate={onNavigate}
          />
        ))}
        <CombinedPanel metrics={metrics} onNavigate={onNavigate} />
      </div>

      {showSettings && <GitHubSettings onClose={() => setShowSettings(false)} />}
    </div>
  );
}
