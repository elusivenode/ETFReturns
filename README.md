# ETFReturns

MVP SMSF-focused ETF analytics project for ASX ETFs.

This repo uses a static-first architecture:
- Python pipeline pulls ETF data from Yahoo Finance using `yfinance`
- SQLite is used as a **local/build cache** (not a production datastore)
- Analytics are exported as static JSON artifacts
- React + Vite frontend renders those artifacts
- GitHub Actions refreshes data and deploys to GitHub Pages

## Tech stack

- Python 3.12
- pandas, yfinance, SQLite
- pytest, ruff
- React, TypeScript, Vite, Plotly
- GitHub Actions + GitHub Pages

## Repository structure

- `src/etf_analytics/ingestion`: watchlist + Yahoo Finance pulls
- `src/etf_analytics/storage`: SQLite schema init and repository helpers
- `src/etf_analytics/analytics`: return/risk/correlation/backtest metrics
- `src/etf_analytics/export`: JSON artifact writers
- `scripts/run_refresh.py`: end-to-end refresh + artifact build
- `sql/schema.sql`: SQLite DDL
- `config/watchlist.yml`: initial ETF watchlist
- `data/artifacts/latest`: generated JSON outputs
- `apps/web`: static React frontend
- `.github/workflows`: CI, refresh, deployment pipelines

## Local development

### 1) Python setup

```bash
python -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install .[dev]
```

### 2) Refresh cache and generate artifacts

```bash
python scripts/run_refresh.py
```

This creates/updates:
- `data/sqlite/etf_cache.db` (local cache)
- `data/artifacts/latest/*.json` (deployable artifacts)

### 3) Start frontend

```bash
cd apps/web
npm install
cp ../../data/artifacts/latest/*.json public/data/
npm run dev
```

## Testing and linting

```bash
ruff check src tests scripts
pytest -q
```

## GitHub Actions workflows

- `ci.yml`: lint/test Python and build frontend on PRs and main
- `refresh-data.yml`: scheduled/manual refresh of ETF data and artifacts
- `deploy-pages.yml`: build and deploy static site to GitHub Pages

## Notes and scope

- This is a personal research tool, not financial advice software.
- SQLite cache is intentionally ephemeral/local and can be rebuilt.
- Data source is Yahoo Finance via `yfinance`; occasional data corrections are expected.
