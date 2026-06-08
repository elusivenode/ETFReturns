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
        current_value=120000.0,
        capital_sources={
            "rollover_capital": 100000.0,
            "contributions": 10000.0,
            "investment_returns": 10000.0,
            "current_value": 120000.0,
        },
        valuation_series={
            "dates": ["2026-01-01", "2026-01-02", "2026-01-03"],
            "values": [100000.0, 110000.0, 120000.0],
        },
        cumulative_return_series={
            "dates": ["2026-01-02", "2026-01-03"],
            "portfolio": [1.0, 2.01],
            "benchmark": [0.8, 1.61],
        },
        rolling_3y_return_series={
            "dates": ["2026-01-03"],
            "portfolio_3y_pa": [7.2],
            "benchmark_3y_pa": [6.5],
        },
    )

    payload = json.loads(out_path.read_text(encoding="utf-8"))
    assert payload["portfolio_id"] == "fixture_smsf"
    assert payload["benchmark_code"] == "CPI_PLUS_5_TOTAL"
    assert payload["calculation_version"] == "v1"
    assert payload["as_of_date"] == "2026-01-03"
    assert payload["current_value"] == 120000.0
    assert payload["capital_sources"]["rollover_capital"] == 100000.0
    assert payload["valuation_series"]["values"][2] == 120000.0
    assert payload["cumulative_return_series"]["portfolio"][1] == 2.01
    assert payload["rolling_3y_return_series"]["benchmark_3y_pa"][0] == 6.5
    assert len(payload["periods"]) == 3

    three_y = next(r for r in payload["periods"] if r["period_code"] == "3Y")
    assert three_y["twr_annualized"] is None
    assert three_y["benchmark_annualized"] is None
    assert three_y["excess_annualized"] is None
