from __future__ import annotations

import sqlite3

import pandas as pd

from etf_analytics.analytics.performance import TRADING_DAYS_PER_YEAR, annualize_return, linked_return
from etf_analytics.analytics.performance import compute_daily_twr
from etf_analytics.storage.performance_repository import (
    load_benchmark_series,
    load_cash_flows,
    load_portfolio_valuations,
    upsert_performance_metrics,
)

PERIOD_WINDOWS: list[tuple[str, int | None]] = [
    ("SI", None),
    ("1Y", 1 * TRADING_DAYS_PER_YEAR),
    ("3Y", 3 * TRADING_DAYS_PER_YEAR),
    ("5Y", 5 * TRADING_DAYS_PER_YEAR),
    ("10Y", 10 * TRADING_DAYS_PER_YEAR),
]


def _aligned_daily_returns(
    daily_twr: pd.DataFrame,
    benchmark_df: pd.DataFrame,
) -> pd.DataFrame:
    if daily_twr.empty or benchmark_df.empty:
        return pd.DataFrame(columns=["portfolio_return", "benchmark_return"])

    p = daily_twr[["date", "daily_return"]].copy()
    p["date"] = pd.to_datetime(p["date"])
    p = p.rename(columns={"daily_return": "portfolio_return"}).set_index("date")

    b = benchmark_df[["date", "period_return"]].copy()
    b["date"] = pd.to_datetime(b["date"])
    b = b.rename(columns={"period_return": "benchmark_return"}).set_index("date")

    merged = p.join(b, how="inner").dropna()
    return merged.sort_index()


def _annualized_from_window(returns: pd.Series, years: float) -> float | None:
    if returns.empty:
        return None
    total = linked_return(returns)
    return annualize_return(total, years)


def build_period_performance_metrics(aligned_returns: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, object]] = []

    for period_code, window in PERIOD_WINDOWS:
        if period_code == "SI":
            if aligned_returns.empty:
                twr = None
                bm = None
            else:
                years = len(aligned_returns) / TRADING_DAYS_PER_YEAR
                twr = _annualized_from_window(aligned_returns["portfolio_return"], years)
                bm = _annualized_from_window(aligned_returns["benchmark_return"], years)
        else:
            if window is None or len(aligned_returns) < window:
                twr = None
                bm = None
            else:
                window_df = aligned_returns.tail(window)
                years = window / TRADING_DAYS_PER_YEAR
                twr = _annualized_from_window(window_df["portfolio_return"], years)
                bm = _annualized_from_window(window_df["benchmark_return"], years)

        excess = (twr - bm) if (twr is not None and bm is not None) else None

        rows.append(
            {
                "period_code": period_code,
                "twr_annualized": twr,
                "mwr_annualized": None,
                "benchmark_annualized": bm,
                "excess_annualized": excess,
                "volatility_annualized": None,
                "max_drawdown": None,
            }
        )

    return pd.DataFrame(rows)


def compute_and_store_performance_metrics(
    conn: sqlite3.Connection,
    *,
    portfolio_id: str,
    benchmark_code: str,
    calculation_version: str,
    as_of_date: str | None = None,
) -> pd.DataFrame:
    valuations = load_portfolio_valuations(conn, portfolio_id)
    cash_flows = load_cash_flows(conn, portfolio_id)
    benchmark = load_benchmark_series(conn, benchmark_code)

    daily_twr = compute_daily_twr(valuations, cash_flows)
    aligned = _aligned_daily_returns(daily_twr, benchmark)
    metrics = build_period_performance_metrics(aligned)

    if as_of_date is None:
        if aligned.empty:
            as_of = pd.Timestamp.utcnow().date().isoformat()
        else:
            as_of = aligned.index.max().date().isoformat()
    else:
        as_of = as_of_date

    upsert_performance_metrics(
        conn,
        portfolio_id=portfolio_id,
        as_of_date=as_of,
        metrics_df=metrics,
        calculation_version=calculation_version,
    )
    return metrics
