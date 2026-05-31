import { useState } from 'react';
import type { GitHubConfig } from '../lib/github';

const TOKEN_KEY = 'smsf_github_token';
const OWNER_KEY = 'smsf_github_owner';
const REPO_KEY  = 'smsf_github_repo';

export function loadGitHubConfig(): GitHubConfig {
  return {
    token: localStorage.getItem(TOKEN_KEY) ?? '',
    owner: localStorage.getItem(OWNER_KEY) ?? '',
    repo:  localStorage.getItem(REPO_KEY)  ?? '',
  };
}

function saveConfig(cfg: GitHubConfig) {
  localStorage.setItem(TOKEN_KEY, cfg.token);
  localStorage.setItem(OWNER_KEY, cfg.owner);
  localStorage.setItem(REPO_KEY,  cfg.repo);
}

interface Props {
  onClose: () => void;
}

export function GitHubSettings({ onClose }: Props) {
  const [cfg, setCfg] = useState<GitHubConfig>(loadGitHubConfig);

  const handleSave = () => {
    saveConfig(cfg);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h3>GitHub Settings</h3>
          <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        </div>

        <div className="modal-body">
          <div className="security-warning">
            🔒 Your token is stored in browser localStorage only and is never committed to the
            repository. Create a <strong>Fine-Grained Personal Access Token</strong> with{' '}
            <strong>Contents: Read and Write</strong> permission scoped to this repository only.
            Revoke it any time from GitHub → Settings → Developer settings.
          </div>

          <div className="settings-field">
            <label htmlFor="gh-owner">GitHub username (owner)</label>
            <input
              id="gh-owner"
              type="text"
              value={cfg.owner}
              placeholder="e.g. elusivenode"
              autoComplete="off"
              spellCheck={false}
              onChange={e => setCfg(c => ({ ...c, owner: e.target.value.trim() }))}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="gh-repo">Repository name</label>
            <input
              id="gh-repo"
              type="text"
              value={cfg.repo}
              placeholder="e.g. ETFReturns"
              autoComplete="off"
              spellCheck={false}
              onChange={e => setCfg(c => ({ ...c, repo: e.target.value.trim() }))}
            />
          </div>

          <div className="settings-field">
            <label htmlFor="gh-token">Fine-Grained Personal Access Token</label>
            <input
              id="gh-token"
              type="password"
              value={cfg.token}
              placeholder="github_pat_…"
              autoComplete="new-password"
              onChange={e => setCfg(c => ({ ...c, token: e.target.value.trim() }))}
            />
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
          <button
            className="btn btn-primary"
            onClick={handleSave}
            disabled={!cfg.token || !cfg.owner || !cfg.repo}
          >
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
