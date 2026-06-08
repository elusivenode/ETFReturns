from __future__ import annotations

import numpy as np
import pandas as pd

from etf_analytics.analytics.performance_service import compute_and_store_performance_metrics
from etf_analytics.settings import SCHEMA_PATH
from etf_analytics.storage.db import connect, init_db
from etf_analytics.storage.performance_repository import (
    load_performance_metrics,
    upsert_benchmark_series,
    upsert_cash_flows,
    upsert_portfolio,
    upsert_portfolio_valuations,
)


def _init_test_db(tmp_path):
    db_path = tmp_path / "test_performance_service.db"
    conn = connect(db_path)
    init_db(conn, SCHEMA_PATH.read_text(encoding="utf-8"))
    return conn


def test_compute_and_store_performance_metrics_end_to_end(tmp_path) -> None:
    conn = _init_test_db(tmp_path)
    try:
        upsert_portfolio(
            conn,
            portfolio_id="smsf_main",
            code="SMSF-MAIN",
            name="SMSF Main",
            structure_type="SMSF",
            inception_date="2024-01-01",
        )

        n_days = 260
        dates = pd.bdate_range("2024-01-01", periods=n_days)

        portfolio_daily_ret = 0.001
        benchmark_daily_ret = 0.0008

        portfolio_values = 100000.0 * np.cumprod(np.full(n_days, 1.0 + portfolio_daily_ret))
        valuation_df = pd.DataFrame(
            {
                "valuation_date": dates.strftime("%Y-%m-%d"),
                "net_assets": portfolio_values,
            }
        )
        upsert_portfolio_valuations(
            conn,
            portfolio_id="smsf_main",
            valuations_df=valuation_df,
            source_system="fixture",
        )

        flows_df = pd.DataFrame(
            columns=[
                "flow_date",
                "amount",
                "direction",
                "flow_type",
                "is_external_flow",
                "twr_treatment",
                "flow_timing",
            ]
        )
        upsert_cash_flows(conn, portfolio_id="smsf_main", cash_flows_df=flows_df)

        benchmark_df = pd.DataFrame(
            {
                "date": dates[1:].strftime("%Y-%m-%d"),
                "period_return": np.full(n_days - 1, benchmark_daily_ret),
                "level": np.nan,
            }
        )
        upsert_benchmark_series(
            conn,
            benchmark_code="CPI_PLUS_5_TOTAL",
            series_df=benchmark_df,
            source="fixture",
            source_version="v1",
        )

        conn.commit()

        out = compute_and_store_performance_metrics(
            conn,
            portfolio_id="smsf_main",
            benchmark_code="CPI_PLUS_5_TOTAL",
            calculation_version="v1",
        )
        conn.commit()

        assert len(out) == 5
        assert out.attrs["as_of_date"] == dates[-1].date().isoformat()
        assert len(out.attrs["valuation_series"]["dates"]) == n_days
        assert len(out.attrs["cumulative_return_series"]["dates"]) == n_days - 1
        assert isinstance(out.attrs["rolling_3y_return_series"]["dates"], list)
        si = out[out["period_code"] == "SI"].iloc[0]
        one_y = out[out["period_code"] == "1Y"].iloc[0]
        three_y = out[out["period_code"] == "3Y"].iloc[0]

        assert si["twr_annualized"] is not None
        assert one_y["twr_annualized"] is not None
        assert one_y["benchmark_annualized"] is not None
        assert one_y["excess_annualized"] > 0

        assert pd.isna(three_y["twr_annualized"])
        assert pd.isna(three_y["benchmark_annualized"])

        persisted = load_performance_metrics(
            conn,
            portfolio_id="smsf_main",
            as_of_date=out.attrs["as_of_date"],
            calculation_version="v1",
        )
        # Loader sort order by period_code alphabetical; still must include all periods
        assert set(persisted["period_code"]) == {"SI", "1Y", "3Y", "5Y", "10Y"}
    finally:
        conn.close()
