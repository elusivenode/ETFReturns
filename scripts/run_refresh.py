from __future__ import annotations

from pathlib import Path

from etf_analytics.analytics.metrics import calc_summary_metrics
from etf_analytics.export.artifacts import write_metrics, write_price_series
from etf_analytics.ingestion.watchlist import load_watchlist
from etf_analytics.ingestion.yf_client import (
    fetch_dividend_history,
    fetch_metadata,
    fetch_price_history,
)
from etf_analytics.settings import ARTIFACT_DIR, SCHEMA_PATH, SQLITE_PATH, WATCHLIST_PATH
from etf_analytics.storage.db import connect, init_db
from etf_analytics.storage.repository import (
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

    metrics_df = calc_summary_metrics(price_df, dividend_df)

    write_metrics(artifact_dir / "metrics.json", metrics_df)
    write_price_series(artifact_dir / "price_series.json", price_df)


def main() -> None:
    tickers = refresh_cache()
    build_artifacts(tickers)
    print(f"Refreshed {len(tickers)} tickers and wrote artifacts to {ARTIFACT_DIR}")


if __name__ == "__main__":
    main()
