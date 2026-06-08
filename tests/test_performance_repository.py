from __future__ import annotations

import pandas as pd

from etf_analytics.settings import SCHEMA_PATH
from etf_analytics.storage.db import connect, init_db
from etf_analytics.storage.performance_repository import (
    load_benchmark_series,
    load_cash_flows,
    load_performance_metrics,
    load_portfolio_valuations,
    upsert_benchmark_series,
    upsert_cash_flows,
    upsert_performance_metrics,
    upsert_portfolio,
    upsert_portfolio_valuations,
)


def _init_test_db(tmp_path):
    db_path = tmp_path / "test_performance.db"
    conn = connect(db_path)
    init_db(conn, SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def test_upsert_and_load_portfolio_valuations(tmp_path) -> None:
    conn = _init_test_db(tmp_path)
    try:
        upsert_portfolio(
            conn,
            portfolio_id="smsf_main",
            code="SMSF-MAIN",
            name="SMSF Main",
            structure_type="SMSF",
            inception_date="2020-01-01",
        )

        df = pd.DataFrame(
            {
                "valuation_date": ["2026-01-01", "2026-01-02"],
                "net_assets": [100000.0, 101000.0],
                "gross_assets": [100000.0, 101000.0],
                "liabilities": [0.0, 0.0],
                "cash_balance": [5000.0, 5100.0],
            }
        )
        inserted = upsert_portfolio_valuations(conn, "smsf_main", df, source_system="fixture")
        conn.commit()

        assert inserted == 2
        loaded = load_portfolio_valuations(conn, "smsf_main")
        assert len(loaded) == 2
        assert loaded.iloc[0]["net_assets"] == 100000.0
        assert loaded.iloc[1]["net_assets"] == 101000.0
    finally:
        conn.close()


def test_upsert_and_load_cash_flows(tmp_path) -> None:
    conn = _init_test_db(tmp_path)
    try:
        upsert_portfolio(
            conn,
            portfolio_id="smsf_main",
            code="SMSF-MAIN",
            name="SMSF Main",
            structure_type="SMSF",
            inception_date="2020-01-01",
        )

        flows = pd.DataFrame(
            {
                "flow_date": ["2026-01-02", "2026-01-02"],
                "amount": [10000.0, 100.0],
                "direction": ["IN", "OUT"],
                "flow_type": ["CONTRIBUTION_PERSONAL", "ADMINISTRATION_FEES"],
                "is_external_flow": [1, 0],
                "twr_treatment": ["NEUTRALIZE", "INCLUDE"],
                "flow_timing": ["end_of_day", "end_of_day"],
            }
        )

        inserted = upsert_cash_flows(conn, "smsf_main", flows, source_ref="fixture")
        conn.commit()

        assert inserted == 2
        loaded = load_cash_flows(conn, "smsf_main")
        assert len(loaded) == 2
        assert loaded.iloc[0]["flow_type"] == "CONTRIBUTION_PERSONAL"
        assert loaded.iloc[1]["flow_type"] == "ADMINISTRATION_FEES"
    finally:
        conn.close()


def test_upsert_and_load_benchmark_and_metrics(tmp_path) -> None:
    conn = _init_test_db(tmp_path)
    try:
        upsert_portfolio(
            conn,
            portfolio_id="smsf_main",
            code="SMSF-MAIN",
            name="SMSF Main",
            structure_type="SMSF",
            inception_date="2020-01-01",
        )

        benchmark = pd.DataFrame(
            {
                "date": ["2026-01-01", "2026-01-02"],
                "level": [100.0, 100.2],
                "period_return": [0.001, 0.002],
            }
        )
        benchmark_rows = upsert_benchmark_series(
            conn,
            benchmark_code="CPI_PLUS_5_TOTAL",
            series_df=benchmark,
            source="ABS",
            source_version="fixture-v1",
        )

        metrics = pd.DataFrame(
            {
                "period_code": ["SI", "1Y"],
                "twr_annualized": [0.081, 0.074],
                "benchmark_annualized": [0.067, 0.065],
                "excess_annualized": [0.014, 0.009],
            }
        )
        metric_rows = upsert_performance_metrics(
            conn,
            portfolio_id="smsf_main",
            as_of_date="2026-01-02",
            metrics_df=metrics,
            calculation_version="v1",
        )
        conn.commit()

        assert benchmark_rows == 2
        assert metric_rows == 2

        loaded_b = load_benchmark_series(conn, "CPI_PLUS_5_TOTAL")
        assert len(loaded_b) == 2

        loaded_m = load_performance_metrics(
            conn,
            portfolio_id="smsf_main",
            as_of_date="2026-01-02",
            calculation_version="v1",
        )
        assert len(loaded_m) == 2
        assert set(loaded_m["period_code"]) == {"SI", "1Y"}
    finally:
        conn.close()
