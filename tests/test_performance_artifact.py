from __future__ import annotations

import json

import pandas as pd

from etf_analytics.export.artifacts import write_portfolio_performance


def test_write_portfolio_performance_outputs_expected_shape(tmp_path) -> None:
    out_path = tmp_path / "performance_metrics.json"
    metrics = pd.DataFrame(
        {
            "period_code": ["SI", "1Y", "3Y"],
            "twr_annualized": [0.08, 0.07, None],
            "benchmark_annualized": [0.065, 0.064, None],
            "excess_annualized": [0.015, 0.006, None],
        }
    )

    write_portfolio_performance(
        out_path,
        portfolio_id="fixture_smsf",
        benchmark_code="CPI_PLUS_5_TOTAL",
        calculation_version="v1",
        as_of_date="2026-01-03",
        metrics_df=metrics,
    )

    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["portfolio_id"] == "fixture_smsf"
    assert payload["benchmark_code"] == "CPI_PLUS_5_TOTAL"
    assert payload["calculation_version"] == "v1"
    assert payload["as_of_date"] == "2026-01-03"
    assert len(payload["periods"]) == 3

    three_y = next(r for r in payload["periods"] if r["period_code"] == "3Y")
    assert three_y["twr_annualized"] is None
    assert three_y["benchmark_annualized"] is None
    assert three_y["excess_annualized"] is None
