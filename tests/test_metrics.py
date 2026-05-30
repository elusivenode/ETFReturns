import pandas as pd

from etf_analytics.analytics.metrics import calc_summary_metrics


def test_calc_summary_metrics_returns_expected_columns() -> None:
    price_df = pd.DataFrame(
        {
            "ticker": ["VAS.AX", "VAS.AX", "VAS.AX"],
            "date": pd.to_datetime(["2024-01-01", "2024-01-02", "2024-01-03"]),
            "adj_close": [100.0, 101.0, 102.0],
        }
    )
    dividend_df = pd.DataFrame(
        {
            "ticker": ["VAS.AX"],
            "ex_date": pd.to_datetime(["2024-01-02"]),
            "amount": [1.0],
        }
    )

    metrics = calc_summary_metrics(price_df, dividend_df)

    expected = {
        "ticker",
        "total_return",
        "cagr",
        "volatility",
        "max_drawdown",
        "distribution_yield",
    }
    assert expected.issubset(set(metrics.columns))
    assert len(metrics) == 1
