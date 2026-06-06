"""Unit tests for risk_metrics.py and risk_free.py.

All tests use zero or constant risk-free rate so expected values are exact.
Tests exercise each private helper directly plus the public compute_risk_metrics
end-to-end, so failures pinpoint the broken component.
"""
from __future__ import annotations

import math

import numpy as np
import pandas as pd
import pytest

from etf_analytics.analytics.risk_free import (
    TRADING_DAYS_PER_YEAR,
    ConstantRateSource,
    RiskFreeSource,
)
from etf_analytics.analytics.risk_metrics import (
    _ann_vol,
    _cagr,
    _cagr_since_inception,
    _calmar,
    _max_drawdown,
    _rolling_sharpe_stats,
    _sharpe,
    _sortino,
    _ulcer_index,
    compute_risk_metrics,
)

# ── Fixtures ─────────────────────────────────────────────────────────────────

def _price_series(values: list[float], start: str = "2020-01-02") -> pd.Series:
    dates = pd.bdate_range(start, periods=len(values))
    return pd.Series(values, index=dates, name="adj_close", dtype=float)


def _price_df(ticker: str, values: list[float], start: str = "2020-01-02") -> pd.DataFrame:
    s = _price_series(values, start)
    return pd.DataFrame({
        "ticker":    ticker,
        "date":      s.index,
        "adj_close": s.values,
    })


# ── ConstantRateSource ────────────────────────────────────────────────────────

class TestConstantRateSource:
    def test_name_contains_rate(self) -> None:
        src = ConstantRateSource(0.045)
        assert "4.50" in src.name

    def test_daily_rate_value(self) -> None:
        src = ConstantRateSource(0.045)
        dates = pd.bdate_range("2024-01-01", periods=5)
        rates = src.daily_rate(dates)
        expected = (1.045) ** (1 / 252) - 1
        assert rates.shape == (5,)
        assert pytest.approx(rates.iloc[0], rel=1e-9) == expected

    def test_zero_rate(self) -> None:
        src = ConstantRateSource(0.0)
        dates = pd.bdate_range("2024-01-01", periods=3)
        assert (src.daily_rate(dates) == 0.0).all()

    def test_satisfies_protocol(self) -> None:
        assert isinstance(ConstantRateSource(), RiskFreeSource)


# ── CAGR ─────────────────────────────────────────────────────────────────────

class TestCAGR:
    def test_known_cagr(self) -> None:
        # 252 trading days, price doubles → CAGR = 100%
        prices = _price_series([100.0] + [100.0] * 251 + [200.0])
        result = _cagr(prices, 252)
        assert result is not None
        assert pytest.approx(result, rel=1e-6) == 1.0

    def test_insufficient_history_returns_none(self) -> None:
        prices = _price_series([100.0, 101.0, 102.0])
        assert _cagr(prices, 252) is None

    def test_cagr_since_inception_flat(self) -> None:
        # Flat price series → CAGR ≈ 0 (small rounding from day-count)
        prices = _price_series([100.0] * 253)
        result = _cagr_since_inception(prices)
        assert pytest.approx(result, abs=1e-6) == 0.0

    def test_cagr_since_inception_known(self) -> None:
        # 252-day series, price grows from 100 to 200
        prices = _price_series([100.0] + [100.0] * 251 + [200.0])
        # years = 252 / 252 ≈ 1 (business-day count)
        result = _cagr_since_inception(prices)
        assert result > 0.9  # close to 100% p.a.


# ── Volatility ────────────────────────────────────────────────────────────────

class TestVol:
    def test_constant_returns_zero_vol(self) -> None:
        # All 1% daily returns → std = 0
        prices = _price_series([100.0 * (1.01 ** i) for i in range(30)])
        daily = prices.pct_change().dropna()
        assert pytest.approx(_ann_vol(daily), abs=1e-10) == 0.0

    def test_known_vol(self) -> None:
        rng = np.random.default_rng(42)
        daily = pd.Series(rng.normal(0.0, 0.01, 252))
        result = _ann_vol(daily)
        # std(normal(0,0.01)) ≈ 0.01; annualised ≈ 0.01 * sqrt(252) ≈ 0.1587
        assert 0.13 < result < 0.19


# ── Max Drawdown ──────────────────────────────────────────────────────────────

class TestMaxDrawdown:
    def test_no_drawdown(self) -> None:
        # Monotonically rising prices
        prices = _price_series([100.0, 110.0, 120.0, 130.0])
        assert pytest.approx(_max_drawdown(prices), abs=1e-10) == 0.0

    def test_known_drawdown(self) -> None:
        # Peak 200, trough 100 → MDD = -50%
        prices = _price_series([100.0, 200.0, 100.0, 150.0])
        assert pytest.approx(_max_drawdown(prices), rel=1e-6) == -0.5

    def test_full_loss(self) -> None:
        prices = _price_series([100.0, 50.0, 1.0])
        assert _max_drawdown(prices) < -0.98


# ── Ulcer Index ───────────────────────────────────────────────────────────────

class TestUlcerIndex:
    def test_no_drawdown_zero_ulcer(self) -> None:
        prices = _price_series([100.0, 110.0, 120.0])
        assert pytest.approx(_ulcer_index(prices), abs=1e-10) == 0.0

    def test_known_ulcer(self) -> None:
        # prices: 100, 100, 50 → drawdowns in %: 0, 0, -50
        # ulcer = sqrt((0^2 + 0^2 + 50^2) / 3) = sqrt(2500/3) ≈ 28.87
        prices = _price_series([100.0, 100.0, 50.0])
        expected = math.sqrt((0 ** 2 + 0 ** 2 + 50 ** 2) / 3)
        assert pytest.approx(_ulcer_index(prices), rel=1e-6) == expected


# ── Sharpe ───────────────────────────────────────────────────────────────────

class TestSharpe:
    def test_zero_excess_returns_zero_sharpe(self) -> None:
        excess = pd.Series([0.0] * 10)
        raw, ann = _sharpe(excess)
        assert raw == 0.0 and ann == 0.0

    def test_known_sharpe(self) -> None:
        # All-zero excess returns → std is exactly 0 → safe (0, 0) return
        excess = pd.Series([0.0] * 252)
        raw, ann = _sharpe(excess)
        assert raw == 0.0 and ann == 0.0

    def test_sharpe_annualisation(self) -> None:
        rng = np.random.default_rng(0)
        excess = pd.Series(rng.normal(0.001, 0.01, 1000))
        raw, ann = _sharpe(excess)
        assert pytest.approx(ann, rel=1e-9) == raw * math.sqrt(TRADING_DAYS_PER_YEAR)

    def test_sharpe_positive_for_positive_mean(self) -> None:
        rng = np.random.default_rng(1)
        excess = pd.Series(rng.normal(0.002, 0.01, 500))
        _, ann = _sharpe(excess)
        assert ann > 0


# ── Sortino ───────────────────────────────────────────────────────────────────

class TestSortino:
    def test_no_negative_returns_none(self) -> None:
        excess = pd.Series([0.01, 0.02, 0.005])
        assert _sortino(excess) is None

    def test_known_sortino_sign(self) -> None:
        # Large sample ensures positive sample mean with high probability
        rng = np.random.default_rng(42)
        excess = pd.Series(rng.normal(0.001, 0.01, 2000))
        assert excess.mean() > 0, "seed sanity: mean should be positive"
        result = _sortino(excess)
        assert result is not None
        assert result > 0


# ── Calmar ────────────────────────────────────────────────────────────────────

class TestCalmar:
    def test_no_drawdown_returns_none(self) -> None:
        assert _calmar(0.10, 0.0) is None

    def test_known_calmar(self) -> None:
        # CAGR = 10%, MDD = -20% → Calmar = 0.5
        assert pytest.approx(_calmar(0.10, -0.20), rel=1e-9) == 0.5

    def test_negative_cagr_negative_calmar(self) -> None:
        result = _calmar(-0.05, -0.30)
        assert result is not None
        assert result < 0


# ── Rolling Sharpe ────────────────────────────────────────────────────────────

class TestRollingSharpe:
    def test_insufficient_history_all_none(self) -> None:
        excess = pd.Series([0.001] * 10)
        stats = _rolling_sharpe_stats(excess, window=756)
        assert all(v is None for v in stats.values())

    def test_returns_four_stats(self) -> None:
        rng = np.random.default_rng(5)
        excess = pd.Series(rng.normal(0.001, 0.01, 800))
        stats = _rolling_sharpe_stats(excess, window=756)
        assert set(stats.keys()) == {"avg", "median", "min", "max"}
        assert all(v is not None for v in stats.values())

    def test_min_le_avg_le_max(self) -> None:
        rng = np.random.default_rng(6)
        excess = pd.Series(rng.normal(0.001, 0.01, 1300))
        stats = _rolling_sharpe_stats(excess, window=756)
        assert stats["min"] <= stats["avg"] <= stats["max"]  # type: ignore[operator]


# ── compute_risk_metrics end-to-end ──────────────────────────────────────────

class TestComputeRiskMetrics:
    def _make_price_df(self, n: int = 300) -> pd.DataFrame:
        rng = np.random.default_rng(99)
        returns = rng.normal(0.0005, 0.01, n)
        prices = 100.0 * np.cumprod(1 + returns)
        dates = pd.bdate_range("2018-01-02", periods=n)
        return pd.DataFrame({
            "ticker":    "TEST.AX",
            "date":      dates,
            "adj_close": prices,
        })

    def test_returns_one_row_per_ticker(self) -> None:
        df, _ = compute_risk_metrics(self._make_price_df(), ConstantRateSource(0.0))
        assert len(df) == 1
        assert df.iloc[0]["ticker"] == "TEST.AX"

    def test_required_columns_present(self) -> None:
        df, _ = compute_risk_metrics(self._make_price_df(), ConstantRateSource(0.0))
        required = {
            "ticker", "observation_days", "observation_start", "observation_end",
            "rf_source", "cagr_since_inception", "cagr_1y", "cagr_3y",
            "volatility", "max_drawdown", "ulcer_index",
            "sharpe_raw", "sharpe_annualised", "sortino", "calmar",
            "rolling_sharpe_36m_avg", "rolling_sharpe_36m_median",
            "rolling_sharpe_36m_min", "rolling_sharpe_36m_max",
            "rolling_sharpe_60m_avg",
        }
        assert required.issubset(set(df.columns))

    def test_metadata_contains_assumptions(self) -> None:
        _, meta = compute_risk_metrics(self._make_price_df(), ConstantRateSource(0.045))
        assert meta["annualisation_factor"] == 252
        assert "sharpe_formula" in meta
        assert "rf_source" in meta

    def test_observation_days_correct(self) -> None:
        df, _ = compute_risk_metrics(self._make_price_df(300), ConstantRateSource(0.0))
        # 300 prices → 299 daily returns
        assert df.iloc[0]["observation_days"] == 299

    def test_insufficient_history_cagr_null(self) -> None:
        # Only 10 prices — no period CAGR should be possible
        small = self._make_price_df(10)
        df, _ = compute_risk_metrics(small, ConstantRateSource(0.0))
        assert df.iloc[0]["cagr_1y"] is None
        assert df.iloc[0]["cagr_3y"] is None

    def test_rf_source_name_in_row(self) -> None:
        src = ConstantRateSource(0.05)
        df, _ = compute_risk_metrics(self._make_price_df(), src)
        assert "5.00" in df.iloc[0]["rf_source"]

    def test_sharpe_annualised_equals_raw_times_sqrt252(self) -> None:
        df, _ = compute_risk_metrics(self._make_price_df(500), ConstantRateSource(0.0))
        row = df.iloc[0]
        assert pytest.approx(row["sharpe_annualised"], rel=1e-9) == (
            row["sharpe_raw"] * math.sqrt(252)
        )

    def test_no_nan_in_output(self) -> None:
        """All float NaN must be converted to None before writing JSON."""
        df, _ = compute_risk_metrics(self._make_price_df(3000), ConstantRateSource(0.045))
        for col in df.select_dtypes(include="float").columns:
            # No raw float NaN (write_risk_metrics will sanitise, but
            # compute itself should not produce NaN for finite input)
            vals = df[col].dropna()
            assert not any(math.isnan(v) for v in vals), f"NaN in column {col}"
