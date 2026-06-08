from __future__ import annotations

from etf_analytics.analytics.performance_fixture import seed_fixture_portfolio
from etf_analytics.analytics.performance_service import run_performance_pipeline
from etf_analytics.settings import SCHEMA_PATH
from etf_analytics.storage.db import connect, init_db
from etf_analytics.storage.performance_repository import (
    load_benchmark_series,
    load_cash_flows,
    load_performance_metrics,
    load_portfolio_valuations,
)


def _init_test_db(tmp_path):
    db_path = tmp_path / "test_performance_fixture.db"
    conn = connect(db_path)
    init_db(conn, SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def test_seed_fixture_and_run_pipeline(tmp_path) -> None:
    conn = _init_test_db(tmp_path)
    try:
        seeded = seed_fixture_portfolio(
            conn,
            portfolio_id="fixture_smsf",
            scenario="scenario3",
            benchmark_code="CPI_PLUS_5_TOTAL",
            benchmark_daily_return=0.0008,
        )

        assert seeded["valuation_rows"] == 3
        assert seeded["cash_flow_rows"] == 2
        assert seeded["benchmark_rows"] == 2

        valuations = load_portfolio_valuations(conn, "fixture_smsf")
        flows = load_cash_flows(conn, "fixture_smsf")
        benchmark = load_benchmark_series(conn, "CPI_PLUS_5_TOTAL")

        assert len(valuations) == 3
        assert len(flows) == 2
        assert len(benchmark) == 2

        metrics, warnings = run_performance_pipeline(
            conn,
            portfolio_id="fixture_smsf",
            benchmark_code="CPI_PLUS_5_TOTAL",
            calculation_version="fixture-v1",
        )
        conn.commit()

        assert len(metrics) == 5
        assert isinstance(warnings, list)

        persisted = load_performance_metrics(
            conn,
            portfolio_id="fixture_smsf",
            as_of_date=str(metrics.attrs.get("as_of_date", "2026-01-03")),
        )
        assert len(persisted) >= 5
    finally:
        conn.close()
