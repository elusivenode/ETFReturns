import type { PortfolioState, PortfolioStateFile } from '../types/contracts';

const API_BASE = 'https://api.github.com';
const PORTFOLIO_FILE  = 'data/portfolio.json';
const STATE_FILE      = 'data/portfolio-state.json';

export interface GitHubConfig {
  token: string;
  owner: string;
  repo: string;
}

export interface PortfolioAllocation {
  asset_class: string;
  ticker: string;
  weight: number;
}

export interface PortfolioFile {
  portfolio_name: string;
  updated_at: string;
  allocations: PortfolioAllocation[];
}

// ── Shared helpers ────────────────────────────────────────────────────────────

function authHeaders(token: string) {
  return {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github.v3+json',
    'Content-Type': 'application/json',
  };
}

function classifyError(status: number, message: string): Error {
  if (status === 401) return new Error('Invalid or expired token. Check your GitHub settings.');
  if (status === 403) return new Error('Access denied. Ensure your token has Contents: Read and Write permission.');
  if (status === 404) return new Error('Repository or file not found. Check the owner and repository name.');
  if (status === 409) return new Error('Conflict: the file was modified remotely. Try again.');
  return new Error(message || `GitHub API error (${status})`);
}

function encodeContent(obj: object): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(obj, null, 2))));
}

function decodeContent(base64: string): unknown {
  return JSON.parse(decodeURIComponent(escape(atob(base64.replace(/\n/g, '')))));
}

async function getSha(config: GitHubConfig, path: string): Promise<string | null> {
  const resp = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`,
    { headers: authHeaders(config.token) },
  );
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: '' }));
    throw classifyError(resp.status, err.message);
  }
  return ((await resp.json()) as { sha: string }).sha;
}

async function putFile(
  config: GitHubConfig,
  path: string,
  payload: object,
  message: string,
): Promise<void> {
  const sha = await getSha(config, path);
  const body: Record<string, unknown> = { message, content: encodeContent(payload) };
  if (sha) body.sha = sha;

  const resp = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`,
    { method: 'PUT', headers: authHeaders(config.token), body: JSON.stringify(body) },
  );
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: '' }));
    throw classifyError(resp.status, err.message);
  }
}

async function getFile<T>(config: GitHubConfig, path: string): Promise<T | null> {
  const resp = await fetch(
    `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${path}`,
    { headers: authHeaders(config.token) },
  );
  if (resp.status === 404) return null;
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: '' }));
    throw classifyError(resp.status, err.message);
  }
  const data = await resp.json() as { content: string };
  return decodeContent(data.content) as T;
}

// ── Public API ────────────────────────────────────────────────────────────────

/** Commit the final validated allocation to data/portfolio.json */
export async function commitPortfolio(
  config: GitHubConfig,
  portfolio: PortfolioFile,
): Promise<void> {
  await putFile(config, PORTFOLIO_FILE, portfolio, 'Update SMSF strategic allocation');
}

/** Save working portfolio state (partial OK) to data/portfolio-state.json */
export async function savePortfolioState(
  config: GitHubConfig,
  state: PortfolioState,
): Promise<void> {
  const payload: PortfolioStateFile = { ...state, saved_at: new Date().toISOString() };
  await putFile(config, STATE_FILE, payload, 'Save SMSF portfolio working state');
}

/** Load working portfolio state from data/portfolio-state.json */
export async function loadPortfolioState(
  config: GitHubConfig,
): Promise<PortfolioStateFile | null> {
  return getFile<PortfolioStateFile>(config, STATE_FILE);
}
