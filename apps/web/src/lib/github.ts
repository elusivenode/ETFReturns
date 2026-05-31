const FILE_PATH = 'data/portfolio.json';
const API_BASE = 'https://api.github.com';

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
  if (status === 404) return new Error('Repository not found. Check the owner and repository name.');
  if (status === 409) return new Error('Conflict: the file was modified remotely. Try again.');
  if (status === 422) return new Error(`Validation error: ${message}`);
  return new Error(message || `GitHub API error (${status})`);
}

async function getCurrentSha(config: GitHubConfig): Promise<string | null> {
  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`;
  const resp = await fetch(url, { headers: authHeaders(config.token) });

  if (resp.status === 404) return null;  // file doesn't exist yet — will be created
  if (!resp.ok) {
    const body = await resp.json().catch(() => ({ message: '' }));
    throw classifyError(resp.status, body.message);
  }

  const data = await resp.json();
  return data.sha as string;
}

export async function commitPortfolio(
  config: GitHubConfig,
  portfolio: PortfolioFile,
): Promise<void> {
  // Step 1: get current SHA (required for updates; omit for first-time create)
  const sha = await getCurrentSha(config);

  // Step 2: base64-encode the JSON (btoa + encodeURIComponent handles non-ASCII)
  const json = JSON.stringify(portfolio, null, 2);
  const encoded = btoa(unescape(encodeURIComponent(json)));

  // Step 3: PUT the file
  const body: Record<string, unknown> = {
    message: 'Update SMSF strategic allocation',
    content: encoded,
  };
  if (sha) body.sha = sha;

  const url = `${API_BASE}/repos/${config.owner}/${config.repo}/contents/${FILE_PATH}`;
  const resp = await fetch(url, {
    method: 'PUT',
    headers: authHeaders(config.token),
    body: JSON.stringify(body),
  });

  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ message: '' }));
    throw classifyError(resp.status, err.message);
  }
}
