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
    try:
        df = yf.download(ticker, start=start_date, auto_adjust=False, progress=False)
    except Exception:
        return pd.DataFrame()

    # yfinance may return a MultiIndex even for one ticker. Normalize to OHLCV columns.
    if isinstance(df.columns, pd.MultiIndex):
        df = df.droplevel(-1, axis=1)
    return df


def fetch_dividend_history(ticker: str, last_cached_ex_date: str | None) -> pd.Series:
    try:
        info = yf.Ticker(ticker)
        series = info.dividends
    except Exception:
        return pd.Series(dtype='float64')
    if series is None:
        return pd.Series(dtype='float64')
    # yfinance >= 0.2.x may return tz-aware index; strip to keep storage tz-naive
    if not series.empty and series.index.tz is not None:
        series.index = series.index.tz_convert("UTC").tz_localize(None)
    if last_cached_ex_date:
        cutoff = pd.Timestamp(last_cached_ex_date) - pd.Timedelta(days=7)
        series = series[series.index >= cutoff]
    return series


def fetch_metadata(ticker: str) -> tuple[str, str, str]:
    try:
        info = yf.Ticker(ticker).fast_info
    except Exception:
        return ticker, "AUD", "ASX"

    def _safe_get(key: str, default: str) -> str:
        try:
            value = info.get(key)
        except Exception:
            return default
        if value is None or value == "":
            return default
        return str(value)

    name = _safe_get("shortName", ticker)
    currency = _safe_get("currency", "AUD")
    exchange = _safe_get("exchange", "ASX")
    return name, currency, exchange
