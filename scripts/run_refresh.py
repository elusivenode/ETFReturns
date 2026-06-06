from __future__ import annotations

from pathlib import Path

from etf_analytics.analytics.cpi import compute_rolling_cpi_3y
from etf_analytics.analytics.metrics import calc_summary_metrics, compute_period_metrics
from etf_analytics.analytics.risk_free import RBACashRateSource
from etf_analytics.analytics.risk_metrics import compute_risk_metrics
from etf_analytics.export.artifacts import (
    scrub_price_df,
    write_cpi_series,
    write_metrics,
    write_period_metrics,
    write_price_series,
    write_risk_metrics,
)
from etf_analytics.ingestion.abs_client import fetch_cpi_quarterly
from etf_analytics.ingestion.watchlist import load_watchlist
from etf_analytics.ingestion.yf_client import (
    fetch_dividend_history,
    fetch_metadata,
    fetch_price_history,
)
from etf_analytics.settings import (
    ARTIFACT_DIR,
    CPI_ARTIFACT_PATH,
    OVERRIDES_PATH,
    RF_FALLBACK_RATE,
    RISK_METRICS_PATH,
    SCHEMA_PATH,
    SQLITE_PATH,
    START_DATES_PATH,
    WATCHLIST_PATH,
)
from etf_analytics.storage.db import connect, init_db
from etf_analytics.storage.repository import (
    apply_price_overrides,
    apply_start_date_filters,
    get_last_dividend_date,
    get_last_price_date,
    load_dividends,
    load_prices,
    upsert_dividends,
    upsert_metadata,
    upsert_prices,
)


def refresh_cache() -> list[str]:
    tickers = load_watchlist(WATCHLIST_PATH)
    conn = connect(SQLITE_PATH)
    try:
        init_db(conn, SCHEMA_PATH.read_text(encoding="utf-8"))

        for ticker in tickers:
            last_price_date = get_last_price_date(conn, ticker)
            last_div_date = get_last_dividend_date(conn, ticker)

            prices = fetch_price_history(ticker, last_price_date)
            dividends = fetch_dividend_history(ticker, last_div_date)
            name, currency, exchange = fetch_metadata(ticker)

            upsert_metadata(conn, ticker, name, currency, exchange)
            upsert_prices(conn, ticker, prices)
            upsert_dividends(conn, ticker, dividends)

        conn.commit()
        return tickers
    finally:
        conn.close()


def build_artifacts(tickers: list[str], artifact_dir: Path = ARTIFACT_DIR) -> None:
    conn = connect(SQLITE_PATH)
    try:
        price_df = load_prices(conn, tickers)
        dividend_df = load_dividends(conn, tickers)
    finally:
        conn.close()

    price_df = apply_price_overrides(price_df, OVERRIDES_PATH)
    price_df = apply_start_date_filters(price_df, START_DATES_PATH)
    price_df = scrub_price_df(price_df)
    metrics_df = calc_summary_metrics(price_df, dividend_df)
    period_df = compute_period_metrics(price_df)

    write_metrics(artifact_dir / "metrics.json", metrics_df)
    write_period_metrics(artifact_dir / "period_metrics.json", period_df)
    write_price_series(artifact_dir / "price_series.json", price_df)
    build_risk_metrics(price_df)


def build_risk_metrics(price_df: object) -> None:
    rf = RBACashRateSource(fallback_annual=RF_FALLBACK_RATE)
    metrics_df, metadata = compute_risk_metrics(price_df, rf)
    if rf.fetch_failed:
        print(f"WARNING: RBA cash rate fetch failed ({rf.fetch_error}); used {rf.name}")
    write_risk_metrics(RISK_METRICS_PATH, metrics_df, metadata)
    print(f"Wrote risk metrics ({len(metrics_df)} tickers) to {RISK_METRICS_PATH}")


def build_cpi_artifact() -> None:
    try:
        cpi_df = fetch_cpi_quarterly()
        rolling_df = compute_rolling_cpi_3y(cpi_df)
        write_cpi_series(CPI_ARTIFACT_PATH, cpi_df, rolling_df)
        print(f"Wrote CPI series ({len(rolling_df)} rolling quarters) to {CPI_ARTIFACT_PATH}")
    except Exception as exc:  # noqa: BLE001
        print(f"WARNING: CPI fetch failed, skipping cpi_series.json: {exc}")


def main() -> None:
    tickers = refresh_cache()
    build_artifacts(tickers)
    build_cpi_artifact()
    print(f"Refreshed {len(tickers)} tickers and wrote artifacts to {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
