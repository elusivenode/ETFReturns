from __future__ import annotations

from datetime import date, timedelta

import pandas as pd
import yfinance as yf


def _start_with_overlap(last_date: str | None, overlap_days: int = 7) -> str:
    if not last_date:
        return "2000-01-01"
    d = date.fromisoformat(last_date) - timedelta(days=overlap_days)
    return d.isoformat()


def fetch_price_history(ticker: str, last_cached_date: str | None) -> pd.DataFrame:
    start_date = _start_with_overlap(last_cached_date)
    # auto_adjust=False keeps both Close and Adj Close for transparent total-return calculations.
    df = yf.download(ticker, start=start_date, auto_adjust=False, progress=False)

    # yfinance may return a MultiIndex even for one ticker. Normalize to OHLCV columns.
    if isinstance(df.columns, pd.MultiIndex):
        df = df.droplevel(-1, axis=1)
    return df


def fetch_dividend_history(ticker: str, last_cached_ex_date: str | None) -> pd.Series:
    info = yf.Ticker(ticker)
    series = info.dividends
    if last_cached_ex_date:
        cutoff = pd.Timestamp(last_cached_ex_date) - pd.Timedelta(days=7)
        series = series[series.index >= cutoff]
    return series


def fetch_metadata(ticker: str) -> tuple[str, str, str]:
    info = yf.Ticker(ticker).fast_info
    name = str(info.get("shortName") or ticker)
    currency = str(info.get("currency") or "AUD")
    exchange = str(info.get("exchange") or "ASX")
    return name, currency, exchange
