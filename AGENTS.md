# ETFReturns — Agent Context

SMSF portfolio analysis tool for an Australian self-managed superannuation fund.
Deployed as a static site on GitHub Pages. No server; all analytics run in Python
locally and artifacts are committed to the repo for CI to pick up and deploy.

---

## Architecture

```
scripts/run_refresh.py          ← main pipeline (fetch → clean → compute → write)
src/etf_analytics/
  ingestion/
    yf_client.py                ← yfinance price + dividend + metadata fetch
    abs_client.py               ← ABS SDMX-JSON API for quarterly CPI
    rba_client.py               ← RBA F1.1 CSV for cash rate (risk-free rate)
    watchlist.py                ← loads config/watchlist.yml
  storage/
    db.py                       ← SQLite connect + init_db
    repository.py               ← load/upsert prices, dividends, metadata;
                                   apply_price_overrides, apply_start_date_filters
  analytics/
    metrics.py                  ← summary metrics (yield, PE, etc.)
    cpi.py                      ← rolling 3Y annualised CPI from quarterly index
    risk_free.py                ← RiskFreeSource Protocol; RBACashRateSource;
                                   ConstantRateSource (fallback only)
    risk_metrics.py             ← Sharpe, Sortino, Calmar, Ulcer Index,
                                   rolling 36M/60M Sharpe; compute_risk_metrics()
  export/
    artifacts.py                ← write_* functions; scrub_price_df(); _sanitize_record()
  settings.py                   ← all paths and constants (single source of truth)

apps/web/                       ← React + TypeScript (Vite)
  src/
    pages/                      ← Dashboard, Explore, Compare, Backtest, Insights,
                                   PortfolioBuilder
    hooks/useArtifacts.ts       ← useCpiSeries, usePeriodMetrics, etc.
    hooks/usePriceSeries.ts     ← computeCumReturn()
    context/PortfolioContext.tsx ← active SMSF member + allocations

data/
  sqlite/etf_cache.db           ← price + dividend + metadata store
  artifacts/latest/             ← committed JSON artifacts (CI copies to public/)
  price_overrides.csv           ← explicit single-date price corrections
  ticker_start_dates.csv        ← per-ticker history start dates (drops bad pre-break data)

.github/workflows/deploy-pages.yml  ← copies artifacts/latest/ → apps/web/public/data/,
                                       then builds and deploys to GitHub Pages
```

---

## Price Cleaning Pipeline

**Order matters.** In `build_artifacts()` (`scripts/run_refresh.py`), price_df is
cleaned in this sequence before any analytics or artifact writes:

```python
price_df = apply_price_overrides(price_df, OVERRIDES_PATH)      # 1. explicit overrides
price_df = apply_start_date_filters(price_df, START_DATES_PATH) # 2. drop pre-break history
price_df = scrub_price_df(price_df)                             # 3. algorithmic spike scrub
```

### 1. `apply_price_overrides` — `data/price_overrides.csv`
Replaces `adj_close` for a specific `(ticker, date)` with a known-good value.
Use for isolated spike-and-revert events where the correct price can be interpolated.

**Current overrides:**
| ticker | date | adj_close | reason |
|--------|------|-----------|--------|
| IVV.AX | 2015-12-28 | 16.2916 | yfinance spike to 242.87; interpolated from adjacent days |

### 2. `apply_start_date_filters` — `data/ticker_start_dates.csv`
Drops all rows before `start_date` for a ticker. Use when yfinance back-fills
synthetic pre-listing history at a completely different price scale — a situation
that cannot be fixed by interpolation.

**Current filters:**
| ticker | start_date | reason |
|--------|------------|--------|
| IVV.AX | 2011-01-05 | Permanent -93% scale break on 2011-01-04. Pre-2011 adj_close is ~100× the post-2011 basis, producing a spurious -94% max drawdown in risk metrics. |

### 3. `scrub_price_df` — algorithmic spike-and-revert
Defined in `artifacts.py`. Applies `_scrub_price_outliers()` per ticker.
Detects a spike when:
- `|return[i]| > 50%`, AND
- `|return from [i-1] to [i+1]| < 50%` (price reverts the next day)

Replaces the bad price with the midpoint of its neighbours.
**Does NOT fix sustained scale breaks** — use `ticker_start_dates.csv` for those.

### Known index-alignment bug (fixed 2026-06-06)
`scrub_price_df` previously called `grp["adj_close"].reset_index(drop=True)`
before passing to `_scrub_price_outliers`. This returned a 0-based Series that
misaligned with the DataFrame's original index, producing NaN in adj_close for
most tickers and silently dropping them from `compute_risk_metrics` output.
Fixed by removing the `reset_index` call — `_scrub_price_outliers` preserves
the input index internally via `to_numpy`.

---

## Known Data Quality Issues

### IVV.AX — two separate issues, both handled
1. **Scale break 2011-01-04**: -93% permanent drop. Pre-2011 data dropped via
   `ticker_start_dates.csv`. Risk metrics now reflect 2011-01-05 onwards (~14 years).
2. **Spike 2015-12-28**: Single-day spike to 242.87. Fixed via `price_overrides.csv`
   with interpolated value 16.2916.

### Watchlist tickers not yet in SQLite DB
The following tickers are in `config/watchlist.yml` but may have zero or
incomplete price history in `data/sqlite/etf_cache.db` — they were not present
when most recent full refresh ran:
- VISM.AX, IJR.AX, VGE.AX, IEM.AX, GLIN.AX, QPON.AX, FLOT.AX, MXT.AX,
  MOT.AX, PCI.AX, ILB.AX

Run `python scripts/run_refresh.py` to fetch missing tickers. Artifacts are
only generated for tickers that have data in the DB.

### JSON NaN serialisation
Python `json.dump` writes `float('nan')` as the literal `NaN` — invalid JSON
that browsers silently fail to parse. All artifact writers use `_sanitize_record()`
from `artifacts.py` to replace `float NaN/Inf` with `None` before serialising.
Do not use `json.dump` directly on DataFrames with nullable floats.

---

## Risk Metrics Framework

- **Risk-free rate**: RBA Cash Rate Target (`FIRMMCRT`) from
  `https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv` (Table F1.1).
  Forward-filled from monthly averages to daily. Falls back to
  `ConstantRateSource(0.045)` on network failure (`RF_FALLBACK_RATE` in settings.py).
  Do not use a static rate over multi-year windows — rates ranged 0.10%→4.35%
  over the 10-year ETF window.
- **Sharpe**: Daily excess return method: `mean(r_daily - rf_daily) / std(ddof=1)`,
  annualised by `× sqrt(252)`. Academically standard (AQR/Dimensional).
- **Sortino**: `mean(excess)*252 / (rms(negative_excess)*sqrt(252))`.
  Returns `None` when there are no negative excess returns.
- **Calmar**: `cagr_since_inception / |max_drawdown|`. Returns `None` when MDD = 0.
- **Ulcer Index**: `sqrt(mean(drawdown_pct²))` in percentage points.
- **Rolling Sharpe**: 36M (756 days) and 60M (1260 days) windows.
  Stats: avg, median, min, max across all rolling windows.

---

## CPI Artifact

Source: ABS SDMX-JSON API — `https://api.data.abs.gov.au/data/CPI/1.10001.10.50.Q`

**ABS API response shape** (top-level keys, NOT nested under `data`):
```json
{ "header": {}, "dataSets": [{}], "structure": {} }
```
`abs_client.py` uses `payload["structure"]` and `payload["dataSets"]` directly.

Output: `data/artifacts/latest/cpi_series.json` with two series:
- `quarterly_index` — raw index levels, used by Compare chart for cumulative inflation
- `rolling_3y` — 3Y annualised CPI, used by Backtest chart as reference line

---

## Artifact Deployment

CI (`deploy-pages.yml`) does NOT run the Python pipeline. It copies pre-committed
artifacts from `data/artifacts/latest/` into `apps/web/public/data/` at build time.

**Consequence**: after any pipeline run that changes artifacts, the JSON files in
`data/artifacts/latest/` must be committed and pushed for the changes to appear
on the live site. `risk_metrics.json` and `cpi_series.json` use `|| true` in the
copy step so the build does not fail if they are missing.

---

## Key Commands

```bash
# Run full refresh (fetch prices, compute all artifacts)
python scripts/run_refresh.py

# Copy artifacts to local web dev server
cp data/artifacts/latest/*.json apps/web/public/data/

# Run frontend dev server
cd apps/web && npm run dev

# Lint
ruff check src tests scripts

# Tests
pytest tests/
```

---

## Frontend Notes

- Vite `BASE_URL=/ETFReturns/` — all `fetch()` calls must use
  `${import.meta.env.BASE_URL}data/<file>.json`
- `useCpiSeries()` returns `{ quarterly_index: {dates, values}, rolling_3y: {dates, values} }`
- Backtest rolling 3Y uses `cpiSeries.rolling_3y`; Compare cumulative uses `cpiSeries.quarterly_index`
- Plotly traces: CPI is always purple dotted (`#9b59b6`, `dash: 'dot'`, `width: 1.5`)
