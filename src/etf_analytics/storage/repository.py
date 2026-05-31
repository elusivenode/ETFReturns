from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

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


def load_dividends(conn: sqlite3.Connection, tickers: list[str]) -> pd.DataFrame:
    placeholders = ",".join("?" for _ in tickers)
    query = f"""
    SELECT ticker, ex_date, amount
    FROM dividends
    WHERE ticker IN ({placeholders})
    ORDER BY ex_date ASC
    """
    return pd.read_sql_query(query, conn, params=tickers, parse_dates=["ex_date"])
