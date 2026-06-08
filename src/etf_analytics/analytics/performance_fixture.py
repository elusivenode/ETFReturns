from __future__ import annotations

from pathlib import Path

import pandas as pd

from etf_analytics.analytics.performance import classify_flow_type
from etf_analytics.settings import PROJECT_ROOT
from etf_analytics.storage.performance_repository import (
    upsert_benchmark_series,
    upsert_cash_flows,
    upsert_portfolio,
    upsert_portfolio_valuations,
)


def _fixture_path(scenario: str, kind: str) -> Path:
    return PROJECT_ROOT / "tests" / "fixtures" / "performance" / f"{scenario}_{kind}.csv"


def _build_benchmark_from_dates(dates: pd.Series, daily_return: float) -> pd.DataFrame:
    if dates.empty:
        return pd.DataFrame(columns=["date", "period_return", "level"])

    levels: list[float] = []
    level = 100.0
    for _ in range(len(dates)):
        level *= 1.0 + daily_return
        levels.append(level)

    return pd.DataFrame(
        {
            "date": pd.to_datetime(dates).dt.strftime("%Y-%m-%d"),
            "period_return": [daily_return] * len(dates),
            "level": levels,
        }
    )


def seed_fixture_portfolio(
    conn,
    *,
    portfolio_id: str = "fixture_smsf",
    code: str = "FIXTURE-SMSF",
    name: str = "Fixture SMSF",
    structure_type: str = "SMSF",
    inception_date: str = "2026-01-01",
    scenario: str = "scenario3",
    benchmark_code: str = "CPI_PLUS_5_TOTAL",
    benchmark_daily_return: float = 0.0008,
) -> dict[str, int]:
    upsert_portfolio(
        conn,
        portfolio_id=portfolio_id,
        code=code,
        name=name,
        structure_type=structure_type,
        inception_date=inception_date,
    )

    valuations = pd.read_csv(_fixture_path(scenario, "valuations"))
    valuation_rows = upsert_portfolio_valuations(
        conn,
        portfolio_id=portfolio_id,
        valuations_df=valuations,
        source_system="fixture",
        source_ref=f"{scenario}_valuations.csv",
    )

    cash_flow_file = _fixture_path(scenario, "cash_flows")
    cash_flows = pd.read_csv(cash_flow_file)
    if cash_flows.empty:
        cash_rows = 0
    else:
        policies = cash_flows["flow_type"].astype(str).map(classify_flow_type)
        cash_flows["is_external_flow"] = policies.map(lambda p: int(p.is_external_flow))
        cash_flows["twr_treatment"] = policies.map(lambda p: p.twr_treatment)
        cash_flows["flow_timing"] = "end_of_day"
        cash_rows = upsert_cash_flows(
            conn,
            portfolio_id=portfolio_id,
            cash_flows_df=cash_flows,
            source_ref=cash_flow_file.name,
        )

    benchmark_dates = pd.to_datetime(valuations["valuation_date"]).iloc[1:]
    benchmark = _build_benchmark_from_dates(benchmark_dates, benchmark_daily_return)
    benchmark_rows = upsert_benchmark_series(
        conn,
        benchmark_code=benchmark_code,
        series_df=benchmark,
        source="fixture",
        source_version=f"{scenario}:{benchmark_daily_return}",
    )

    return {
        "portfolio_rows": 1,
        "valuation_rows": valuation_rows,
        "cash_flow_rows": cash_rows,
        "benchmark_rows": benchmark_rows,
    }
