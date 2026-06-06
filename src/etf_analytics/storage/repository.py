from __future__ import annotations

import sqlite3
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd


def get_last_price_date(conn: sqlite3.Connection, ticker: str) -> str | None:
    row = conn.execute(
        "SELECT MAX(date) AS max_date FROM prices WHERE ticker = ?",
        (ticker,),
    ).fetchone()
    return row["max_date"] if row and row["max_date"] else None


def get_last_dividend_date(conn: sqlite3.Connection, ticker: str) -> str | None:
    row = conn.execute(
        "SELECT MAX(ex_date) AS max_date FROM dividends WHERE ticker = ?",
        (ticker,),
    ).fetchone()
    return row["max_date"] if row and row["max_date"] else None


def upsert_metadata(
    conn: sqlite3.Connection, ticker: str, name: str, currency: str, exchange: str
) -> None:
    conn.execute(
        """
        INSERT INTO metadata(ticker, name, currency, exchange, last_refreshed_at)
        VALUES(?, ?, ?, ?, ?)
        ON CONFLICT(ticker) DO UPDATE SET
            name=excluded.name,
            currency=excluded.currency,
            exchange=excluded.exchange,
            last_refreshed_at=excluded.last_refreshed_at
        """,
        (ticker, name, currency, exchange, datetime.now(timezone.utc).isoformat()),
    )


def upsert_prices(conn: sqlite3.Connection, ticker: str, prices_df: pd.DataFrame) -> int:
    if prices_df.empty:
        return 0

    rows = [
        (
            ticker,
            str(idx.date()),
            float(row.get("Open")) if pd.notna(row.get("Open")) else None,
            float(row.get("High")) if pd.notna(row.get("High")) else None,
            float(row.get("Low")) if pd.notna(row.get("Low")) else None,
            float(row.get("Close")) if pd.notna(row.get("Close")) else None,
            float(row.get("Adj Close")) if pd.notna(row.get("Adj Close")) else None,
            float(row.get("Volume")) if pd.notna(row.get("Volume")) else None,
        )
        for idx, row in prices_df.iterrows()
    ]

    conn.executemany(
        """
        INSERT INTO prices(ticker, date, open, high, low, close, adj_close, volume)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(ticker, date) DO UPDATE SET
            open=excluded.open,
            high=excluded.high,
            low=excluded.low,
            close=excluded.close,
            adj_close=excluded.adj_close,
            volume=excluded.volume
        """,
        rows,
    )
    return len(rows)


def upsert_dividends(conn: sqlite3.Connection, ticker: str, dividends_series: pd.Series) -> int:
    if dividends_series.empty:
        return 0

    rows = [(ticker, str(idx.date()), float(amount)) for idx, amount in dividends_series.items()]

    conn.executemany(
        """
        INSERT INTO dividends(ticker, ex_date, amount)
        VALUES(?, ?, ?)
        ON CONFLICT(ticker, ex_date) DO UPDATE SET amount=excluded.amount
        """,
        rows,
    )
    return len(rows)


def load_prices(conn: sqlite3.Connection, tickers: list[str]) -> pd.DataFrame:
    placeholders = ",".join("?" for _ in tickers)
    query = f"""
    SELECT ticker, date, adj_close
    FROM prices
    WHERE ticker IN ({placeholders})
    ORDER BY date ASC
    """
    return pd.read_sql_query(query, conn, params=tickers, parse_dates=["date"])


def apply_price_overrides(price_df: pd.DataFrame, overrides_path: Path) -> pd.DataFrame:
    """Apply known manual price corrections from data/price_overrides.csv.

    The CSV must have columns: ticker, date, adj_close, reason.
    Rows in price_df matching (ticker, date) have their adj_close replaced.
    """
    if not overrides_path.exists():
        return price_df
    overrides = pd.read_csv(overrides_path, parse_dates=["date"])
    if overrides.empty:
        return price_df
    df = price_df.copy()
    for _, row in overrides.iterrows():
        mask = (df["ticker"] == row["ticker"]) & (df["date"] == row["date"])
        if mask.any():
            df.loc[mask, "adj_close"] = float(row["adj_close"])
    return df


def apply_start_date_filters(price_df: pd.DataFrame, start_dates_path: Path) -> pd.DataFrame:
    """Drop rows before a per-ticker start date defined in data/ticker_start_dates.csv.

    The CSV must have columns: ticker, start_date, reason.
    Used to remove pre-listing synthetic price history from yfinance.
    """
    if not start_dates_path.exists():
        return price_df
    cfg = pd.read_csv(start_dates_path, parse_dates=["start_date"])
    if cfg.empty:
        return price_df
    df = price_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    for _, row in cfg.iterrows():
        mask = (df["ticker"] == row["ticker"]) & (df["date"] < row["start_date"])
        df = df[~mask]
    return df.reset_index(drop=True)


def load_dividends(conn: sqlite3.Connection, tickers: list[str]) -> pd.DataFrame:
    placeholders = ",".join("?" for _ in tickers)
    query = f"""
    SELECT ticker, ex_date, amount
    FROM dividends
    WHERE ticker IN ({placeholders})
    ORDER BY ex_date ASC
    """
    return pd.read_sql_query(query, conn, params=tickers, parse_dates=["ex_date"])
