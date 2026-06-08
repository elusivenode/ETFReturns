from __future__ import annotations

import pandas as pd

from etf_analytics.analytics.performance_service import data_quality_warnings


def test_quality_warning_for_missing_valuation_days() -> None:
    valuations = pd.DataFrame(
        {
            "valuation_date": ["2026-01-01", "2026-01-05"],
            "net_assets": [100.0, 101.0],
        }
    )
    flows = pd.DataFrame(columns=["flow_type"])
    benchmark = pd.DataFrame({"date": ["2026-01-02"], "period_return": [0.001]})

    warnings = data_quality_warnings(valuations, flows, benchmark)
    assert any("Missing" in w and "business-day valuations" in w for w in warnings)


def test_quality_warning_for_unknown_flow_type() -> None:
    valuations = pd.DataFrame(
        {
            "valuation_date": ["2026-01-01", "2026-01-02"],
            "net_assets": [100.0, 101.0],
        }
    )
    flows = pd.DataFrame(
        {
            "flow_type": ["CONTRIBUTION_PERSONAL", "UNKNOWN_ITEM"],
        }
    )
    benchmark = pd.DataFrame({"date": ["2026-01-02"], "period_return": [0.001]})

    warnings = data_quality_warnings(valuations, flows, benchmark)
    assert any("Unknown flow types found" in w for w in warnings)


def test_quality_warning_for_missing_benchmark() -> None:
    valuations = pd.DataFrame(
        {
            "valuation_date": ["2026-01-01", "2026-01-02"],
            "net_assets": [100.0, 101.0],
        }
    )
    flows = pd.DataFrame(columns=["flow_type"])
    benchmark = pd.DataFrame(columns=["date", "period_return"])

    warnings = data_quality_warnings(valuations, flows, benchmark)
    assert "No benchmark rows found for selected benchmark code." in warnings
