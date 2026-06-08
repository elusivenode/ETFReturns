from __future__ import annotations

import sqlite3

import pandas as pd

from etf_analytics.analytics.performance import TRADING_DAYS_PER_YEAR, annualize_return, linked_return
from etf_analytics.analytics.performance import (
    classify_flow_type,
    compute_daily_twr,
    summarize_capital_sources,
)
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


def data_quality_warnings(
    valuations: pd.DataFrame,
    cash_flows: pd.DataFrame,
    benchmark_df: pd.DataFrame,
) -> list[str]:
    warnings: list[str] = []

    if valuations.empty:
        warnings.append("No valuation rows found for portfolio.")
        return warnings

    v = valuations.copy()
    v["valuation_date"] = pd.to_datetime(v["valuation_date"])

    duplicate_dates = v["valuation_date"].duplicated().sum()
    if duplicate_dates > 0:
        warnings.append(f"Found {duplicate_dates} duplicate valuation dates.")

    unique_dates = pd.DatetimeIndex(v["valuation_date"].drop_duplicates().sort_values())
    if len(unique_dates) > 1:
        expected = pd.bdate_range(unique_dates.min(), unique_dates.max())
        missing = expected.difference(unique_dates)
        if len(missing) > 0:
            warnings.append(f"Missing {len(missing)} business-day valuations in date range.")

    if not cash_flows.empty:
        unknown_types = {
            str(ft)
            for ft in cash_flows["flow_type"].astype(str).tolist()
            if _is_unknown_flow_type(ft)
        }
        if unknown_types:
            names = ", ".join(sorted(unknown_types))
            warnings.append(f"Unknown flow types found: {names}.")

    if benchmark_df.empty:
        warnings.append("No benchmark rows found for selected benchmark code.")

    return warnings


def _is_unknown_flow_type(flow_type: str) -> bool:
    try:
        classify_flow_type(flow_type)
        return False
    except ValueError:
        return True


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

    current_value = float(valuations.sort_values("valuation_date").iloc[-1]["net_assets"]) if not valuations.empty else None
    capital_sources = summarize_capital_sources(current_value or 0.0, cash_flows)

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
    metrics.attrs["as_of_date"] = as_of
    metrics.attrs["benchmark_code"] = benchmark_code
    metrics.attrs["calculation_version"] = calculation_version
    metrics.attrs["portfolio_id"] = portfolio_id
    metrics.attrs["current_value"] = current_value
    metrics.attrs["capital_sources"] = capital_sources
    return metrics


def run_performance_pipeline(
    conn: sqlite3.Connection,
    *,
    portfolio_id: str,
    benchmark_code: str,
    calculation_version: str,
    as_of_date: str | None = None,
) -> tuple[pd.DataFrame, list[str]]:
    valuations = load_portfolio_valuations(conn, portfolio_id)
    cash_flows = load_cash_flows(conn, portfolio_id)
    benchmark = load_benchmark_series(conn, benchmark_code)

    warnings = data_quality_warnings(valuations, cash_flows, benchmark)
    metrics = compute_and_store_performance_metrics(
        conn,
        portfolio_id=portfolio_id,
        benchmark_code=benchmark_code,
        calculation_version=calculation_version,
        as_of_date=as_of_date,
    )
    return metrics, warnings
