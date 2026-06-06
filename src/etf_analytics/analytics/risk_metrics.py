"""Comprehensive risk-adjusted return metrics for SMSF portfolio analysis.

All calculations are daily-return-based.  Assumptions are explicit:
  - Input prices are adjusted-close (total-return series).
  - Annualisation uses TRADING_DAYS_PER_YEAR = 252 throughout.
  - Sharpe uses the daily excess return method:
        excess_daily = r_daily - rf_daily
        sharpe_raw   = mean(excess_daily) / std(excess_daily, ddof=1)
        sharpe_ann   = sharpe_raw * sqrt(252)
  - Sortino downside deviation is the RMS of negative excess daily returns,
    annualised by sqrt(252).  Minimum Acceptable Return = risk-free rate.
  - Calmar = cagr_since_inception / |max_drawdown|.
  - Ulcer Index is computed on the full price series (depth × duration of drawdowns).
  - Rolling Sharpe windows: 36 months ≈ 756 trading days,
                             60 months ≈ 1260 trading days.
  - Null is returned for any metric where insufficient history exists.

Risk-free rate
--------------
Pass any object satisfying the RiskFreeSource protocol (risk_free.py).
Default is ConstantRateSource(0.045).  The source name is stored in
artifact metadata so results are always interpretable.
"""
from __future__ import annotations

import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd

from etf_analytics.analytics.risk_free import (
    TRADING_DAYS_PER_YEAR,
    ConstantRateSource,
    RiskFreeSource,
)

# Rolling window sizes (trading days)
_WINDOW_36M = 756
_WINDOW_60M = 1260

# CAGR lookback windows (trading days → label)
_CAGR_WINDOWS: dict[str, int] = {
    "cagr_1y":  252,
    "cagr_3y":  756,
    "cagr_5y":  1260,
    "cagr_10y": 2520,
}


# ── Private helpers ──────────────────────────────────────────────────────────

def _cagr(prices: pd.Series, window_days: int) -> float | None:
    """CAGR over the trailing ``window_days`` trading days.

    Uses price at position ``[-window_days - 1]`` as start so the window
    contains exactly ``window_days`` daily returns.
    """
    if len(prices) < window_days + 1:
        return None
    p_end = float(prices.iloc[-1])
    p_start = float(prices.iloc[-window_days - 1])
    if p_start <= 0:
        return None
    return float((p_end / p_start) ** (TRADING_DAYS_PER_YEAR / window_days) - 1)


def _cagr_since_inception(prices: pd.Series) -> float:
    """CAGR from first to last observation."""
    years = (prices.index[-1] - prices.index[0]).days / 365.25
    if years <= 0 or prices.iloc[0] <= 0:
        return 0.0
    return float((prices.iloc[-1] / prices.iloc[0]) ** (1.0 / years) - 1)


def _ann_vol(daily_returns: pd.Series) -> float:
    """Annualised volatility of daily returns (ddof=1)."""
    return float(daily_returns.std(ddof=1) * math.sqrt(TRADING_DAYS_PER_YEAR))


def _max_drawdown(prices: pd.Series) -> float:
    """Peak-to-trough decline as a negative fraction (e.g. -0.38 = -38%)."""
    peak = prices.cummax()
    dd = prices / peak - 1.0
    return float(dd.min())


def _ulcer_index(prices: pd.Series) -> float:
    """Ulcer Index: RMS of percentage drawdowns from rolling peak.

    Captures both depth and duration of underwater periods.
    Result is in percentage points (not a fraction).
    """
    peak = prices.cummax()
    dd_pct = (prices - peak) / peak * 100.0
    return float(math.sqrt((dd_pct ** 2).mean()))


def _sharpe(excess_daily: pd.Series) -> tuple[float, float]:
    """Raw and annualised Sharpe using the daily excess return method.

    sharpe_raw = mean(excess) / std(excess, ddof=1)
    sharpe_ann = sharpe_raw * sqrt(252)

    Returns (0.0, 0.0) if std is zero (constant-return series).
    """
    std = float(excess_daily.std(ddof=1))
    if std == 0.0:
        return 0.0, 0.0
    raw = float(excess_daily.mean() / std)
    return raw, raw * math.sqrt(TRADING_DAYS_PER_YEAR)


def _sortino(excess_daily: pd.Series) -> float | None:
    """Sortino ratio.

    Numerator  : annualised mean excess return  = mean(excess) * 252
    Denominator: annualised downside deviation  = rms(negative excess) * sqrt(252)

    Minimum Acceptable Return = risk-free rate (already subtracted in excess_daily).
    Returns None if there are no negative excess return observations.
    """
    ann_excess = float(excess_daily.mean() * TRADING_DAYS_PER_YEAR)
    negative = excess_daily[excess_daily < 0.0]
    if negative.empty:
        return None
    downside_dev = float(math.sqrt((negative ** 2).mean()) * math.sqrt(TRADING_DAYS_PER_YEAR))
    if downside_dev == 0.0:
        return None
    return ann_excess / downside_dev


def _calmar(cagr_inception: float, max_dd: float) -> float | None:
    """Calmar ratio = CAGR since inception / |max drawdown|.

    Returns None if max_dd is 0 (no drawdown recorded).
    """
    if max_dd >= 0.0:
        return None
    return cagr_inception / abs(max_dd)


def _rolling_sharpe_stats(excess_daily: pd.Series, window: int) -> dict[str, float | None]:
    """Summary statistics for rolling annualised Sharpe over ``window`` trading days.

    Uses vectorised rolling mean / std to avoid Python-loop overhead.
    Returns avg / median / min / max, all None when there is insufficient history.
    """
    null: dict[str, float | None] = {
        "avg": None, "median": None, "min": None, "max": None,
    }
    if len(excess_daily) < window:
        return null

    roll_mean = excess_daily.rolling(window).mean()
    roll_std  = excess_daily.rolling(window).std(ddof=1)

    # Avoid division by zero for constant-return windows
    roll_sharpe = (roll_mean / roll_std.replace(0.0, np.nan)) * math.sqrt(TRADING_DAYS_PER_YEAR)
    roll_sharpe = roll_sharpe.dropna()

    if roll_sharpe.empty:
        return null

    return {
        "avg":    float(roll_sharpe.mean()),
        "median": float(roll_sharpe.median()),
        "min":    float(roll_sharpe.min()),
        "max":    float(roll_sharpe.max()),
    }


# ── Public API ───────────────────────────────────────────────────────────────

def compute_risk_metrics(
    price_df: pd.DataFrame,
    rf_source: RiskFreeSource | None = None,
) -> tuple[pd.DataFrame, dict]:
    """Compute Phase 1 + Phase 2 risk metrics for every ticker in ``price_df``.

    Args:
        price_df: Long-form DataFrame with columns ``ticker``, ``date``,
                  ``adj_close``.  Prices must be adjusted-close (total return).
        rf_source: Any object satisfying the RiskFreeSource protocol.
                   Defaults to ``ConstantRateSource(0.045)``.

    Returns:
        (metrics_df, metadata) where:
          - metrics_df has one row per ticker with all metric columns.
          - metadata is a dict of computation assumptions for the artifact header.
    """
    if rf_source is None:
        rf_source = ConstantRateSource()

    rows: list[dict] = []

    for ticker, grp in price_df.groupby("ticker"):
        prices = grp.set_index("date")["adj_close"].sort_index().dropna()
        if len(prices) < 2:
            continue

        daily_returns = prices.pct_change().dropna()
        rf_daily = rf_source.daily_rate(daily_returns.index)
        excess_daily = daily_returns - rf_daily

        sharpe_raw, sharpe_ann = _sharpe(excess_daily)
        max_dd = _max_drawdown(prices)
        cagr_inc = _cagr_since_inception(prices)

        r36 = _rolling_sharpe_stats(excess_daily, _WINDOW_36M)
        r60 = _rolling_sharpe_stats(excess_daily, _WINDOW_60M)

        row: dict = {
            "ticker": ticker,
            # Observation metadata
            "observation_days":  len(daily_returns),
            "observation_start": daily_returns.index[0].strftime("%Y-%m-%d"),
            "observation_end":   daily_returns.index[-1].strftime("%Y-%m-%d"),
            "rf_source":         rf_source.name,
            # CAGR
            "cagr_since_inception": cagr_inc,
            **{label: _cagr(prices, days) for label, days in _CAGR_WINDOWS.items()},
            # Absolute risk
            "volatility":   _ann_vol(daily_returns),
            "max_drawdown": max_dd,
            "ulcer_index":  _ulcer_index(prices),
            # Risk-adjusted
            "sharpe_raw":        sharpe_raw,
            "sharpe_annualised": sharpe_ann,
            "sortino":           _sortino(excess_daily),
            "calmar":            _calmar(cagr_inc, max_dd),
            # Rolling Sharpe — 36M
            "rolling_sharpe_36m_avg":    r36["avg"],
            "rolling_sharpe_36m_median": r36["median"],
            "rolling_sharpe_36m_min":    r36["min"],
            "rolling_sharpe_36m_max":    r36["max"],
            # Rolling Sharpe — 60M
            "rolling_sharpe_60m_avg":    r60["avg"],
            "rolling_sharpe_60m_median": r60["median"],
            "rolling_sharpe_60m_min":    r60["min"],
            "rolling_sharpe_60m_max":    r60["max"],
        }
        rows.append(row)

    metrics_df = pd.DataFrame(rows).sort_values("ticker").reset_index(drop=True)

    metadata: dict = {
        "generated_at":           datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "rf_source":              rf_source.name,
        "annualisation_factor":   TRADING_DAYS_PER_YEAR,
        "sharpe_formula":         "mean(excess_daily) / std(excess_daily, ddof=1) * sqrt(252)",
        "excess_daily_formula":   "r_daily - rf_daily",
        "sortino_denominator":    "rms(negative_excess_daily) * sqrt(252)",
        "calmar_denominator":     "max_drawdown (since inception)",
        "ulcer_index_unit":       "percentage points (not fraction)",
        "rolling_36m_window_days": _WINDOW_36M,
        "rolling_60m_window_days": _WINDOW_60M,
    }

    return metrics_df, metadata
