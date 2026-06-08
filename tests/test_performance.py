from __future__ import annotations

from pathlib import Path

import pandas as pd
import pytest

from etf_analytics.analytics.performance import (
    build_cpi_plus_spread_returns,
    classify_flow_type,
    compute_daily_twr,
    linked_return,
    rolling_linked_returns,
    summarize_capital_sources,
)

FIXTURE_DIR = Path(__file__).parent / "fixtures" / "performance"


def _load_csv(name: str) -> pd.DataFrame:
    return pd.read_csv(FIXTURE_DIR / name)


def test_flow_policy_mapping() -> None:
    neutralized = classify_flow_type("CONTRIBUTION_PERSONAL")
    assert neutralized.is_external_flow is True
    assert neutralized.twr_treatment == "NEUTRALIZE"

    included = classify_flow_type("ADMINISTRATION_FEES")
    assert included.is_external_flow is False
    assert included.twr_treatment == "INCLUDE"

    with pytest.raises(ValueError):
        classify_flow_type("UNKNOWN_FLOW")


def test_scenario_1_simple_growth() -> None:
    valuations = _load_csv("scenario1_valuations.csv")
    flows = _load_csv("scenario1_cash_flows.csv")

    twr = compute_daily_twr(valuations, flows)
    assert pytest.approx(twr["daily_return"].iloc[0], rel=1e-12) == 0.01
    assert pytest.approx(twr["daily_return"].iloc[1], rel=1e-12) == 0.01

    total = linked_return(twr["daily_return"])
    assert pytest.approx(total, rel=1e-12) == 0.0201


def test_scenario_2_mid_period_contribution_is_neutralized() -> None:
    valuations = _load_csv("scenario2_valuations.csv")
    flows = _load_csv("scenario2_cash_flows.csv")

    twr = compute_daily_twr(valuations, flows)
    assert pytest.approx(twr["daily_return"].iloc[0], rel=1e-12) == 0.01
    assert pytest.approx(twr["daily_return"].iloc[1], rel=1e-12) == 0.01

    total = linked_return(twr["daily_return"])
    assert pytest.approx(total, rel=1e-12) == 0.0201


def test_scenario_3_fee_remains_in_return_outcome() -> None:
    valuations = _load_csv("scenario3_valuations.csv")
    flows = _load_csv("scenario3_cash_flows.csv")

    twr = compute_daily_twr(valuations, flows)
    assert pytest.approx(twr["daily_return"].iloc[0], rel=1e-12) == 0.009
    assert pytest.approx(twr["daily_return"].iloc[1], rel=1e-12) == 0.01

    total = linked_return(twr["daily_return"])
    assert pytest.approx(total, rel=1e-12) == 0.01909


def test_scenario_4_decline_then_recovery_rolling_returns() -> None:
    valuations = _load_csv("scenario4_valuations.csv")
    flows = _load_csv("scenario4_cash_flows.csv")

    twr = compute_daily_twr(valuations, flows)
    roll = rolling_linked_returns(twr["daily_return"], window=3)

    expected = [-0.109, 0.089, 0.331]
    assert len(roll) == 3
    for got, exp in zip(roll.tolist(), expected, strict=False):
        assert pytest.approx(got, rel=1e-12) == exp


def test_cpi_plus_spread_geometric_composition() -> None:
    cpi_returns = pd.Series([0.02, 0.015, 0.01])
    out = build_cpi_plus_spread_returns(cpi_returns, spread=0.05)

    expected = [
        (1.02 * 1.05) - 1,
        (1.015 * 1.05) - 1,
        (1.01 * 1.05) - 1,
    ]
    assert out.tolist() == expected


def test_capital_source_breakdown() -> None:
    flows = pd.DataFrame(
        {
            "flow_date": ["2026-01-02", "2026-01-03", "2026-01-04", "2026-01-05"],
            "amount": [500000, 10000, 5000, 1000],
            "direction": ["IN", "IN", "OUT", "OUT"],
            "flow_type": [
                "ROLLOVER_IN",
                "CONTRIBUTION_PERSONAL",
                "PENSION_PAYMENT",
                "ADMINISTRATION_FEES",
            ],
        }
    )

    summary = summarize_capital_sources(current_value=520000, cash_flows=flows)
    assert summary["rollover_capital"] == 500000
    assert summary["contributions"] == 5000
    assert summary["investment_returns"] == 15000
