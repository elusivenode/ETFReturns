"""Risk-free rate sources for Sharpe and related calculations.

Architecture: ``RiskFreeSource`` is a structural Protocol so new sources
(90-day BBSW, CPI+target, user-defined) can be added without touching
any metric calculation code.

Usage
-----
    rf = RBACashRateSource()                        # Cash Rate Target (default)
    rf = RBACashRateSource("FIRMMBAB90")            # 3-month BABs/NCDs
    daily = rf.daily_rate(dates)                    # pd.Series aligned to dates
    print(rf.name)                                  # appears in artifact metadata

Adding a new source
-------------------
Implement ``name`` (property) and ``daily_rate(dates)``; that is all.
"""
from __future__ import annotations

from typing import Protocol, runtime_checkable

import numpy as np
import pandas as pd

TRADING_DAYS_PER_YEAR = 252


@runtime_checkable
class RiskFreeSource(Protocol):
    """Structural protocol: anything with ``name`` and ``daily_rate`` qualifies."""

    @property
    def name(self) -> str:
        """Human-readable label stored in artifact metadata."""
        ...

    def daily_rate(self, dates: pd.DatetimeIndex) -> pd.Series:
        """Return daily (not annualised) risk-free return for each trading date.

        Args:
            dates: DatetimeIndex of trading days for which a rate is needed.

        Returns:
            pd.Series indexed by ``dates``, dtype float64.
        """
        ...


class ConstantRateSource:
    """Constant annual rate converted to an equivalent daily compound return.

    ``(1 + annual_rate) ^ (1 / 252) - 1`` is applied uniformly to every date.
    This is the last-resort fallback when live data cannot be retrieved.
    It should NOT be used as a substitute for time-varying rates over long
    periods — cash rates moved from ~0.1% to ~4.35% between 2020 and 2024,
    so a static rate will materially distort Sharpe calculations.

    Args:
        annual_rate: Annual rate as a decimal (e.g. 0.045 for 4.5%).
    """

    def __init__(self, annual_rate: float = 0.045) -> None:
        self.annual_rate = annual_rate
        self._daily = float((1 + annual_rate) ** (1 / TRADING_DAYS_PER_YEAR) - 1)

    @property
    def name(self) -> str:
        return f"Constant {self.annual_rate * 100:.2f}% p.a. (fallback only)"

    def daily_rate(self, dates: pd.DatetimeIndex) -> pd.Series:
        return pd.Series(self._daily, index=dates, dtype=np.float64)


class RBACashRateSource:
    """RBA interest rate series, forward-filled from monthly averages to daily.

    Fetches from RBA Table F1.1 (f1.1-data.csv):
        https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv

    The series is configurable so callers can switch from the Cash Rate Target
    to 3-month BABs/NCDs or any other F1.1 series without changing any metric
    calculation code.

    Available series IDs:
        FIRMMCRT    Cash Rate Target (monthly average)  ← default
        FIRMMCRI    Interbank Overnight Cash Rate
        FIRMMBAB30  1-month BABs/NCDs
        FIRMMBAB90  3-month BABs/NCDs
        FIRMMTN3    3-month Treasury Notes

    Falls back to ``ConstantRateSource(fallback_annual)`` if the fetch fails,
    with ``self.fetch_failed = True`` so the pipeline can log a warning.
    The fallback is a last resort — a static rate should not be used over
    long periods where rates have moved materially.

    Args:
        series_id:      RBA series identifier.  Defaults to ``"FIRMMCRT"``.
        fallback_annual: Annual rate used only when the live fetch fails.
    """

    _SERIES_LABELS: dict[str, str] = {
        "FIRMMCRT":   "RBA Cash Rate Target (F1.1)",
        "FIRMMCRI":   "RBA Interbank Overnight Cash Rate (F1.1)",
        "FIRMMBAB30": "RBA 1-month BABs/NCDs (F1.1)",
        "FIRMMBAB90": "RBA 3-month BABs/NCDs (F1.1)",
        "FIRMMTN3":   "RBA 3-month Treasury Notes (F1.1)",
    }

    def __init__(
        self,
        series_id: str = "FIRMMCRT",
        fallback_annual: float = 0.045,
    ) -> None:
        self.series_id = series_id
        self._fallback = ConstantRateSource(fallback_annual)
        self._cache: pd.Series | None = None
        self.fetch_failed: bool = False
        self.fetch_error: str = ""

    @property
    def name(self) -> str:
        label = self._SERIES_LABELS.get(self.series_id, f"RBA {self.series_id} (F1.1)")
        if self.fetch_failed:
            return f"{label} (fetch failed — {self._fallback.name})"
        return label

    def _load(self) -> None:
        from etf_analytics.ingestion.rba_client import fetch_rba_series
        try:
            series = fetch_rba_series(self.series_id)
            if series is None or series.empty:
                raise ValueError("fetch returned empty series")
            self._cache = series
        except Exception as exc:  # noqa: BLE001
            self.fetch_failed = True
            self.fetch_error = str(exc)

    def daily_rate(self, dates: pd.DatetimeIndex) -> pd.Series:
        if self._cache is None and not self.fetch_failed:
            self._load()

        if self.fetch_failed:
            return self._fallback.daily_rate(dates)

        # Forward-fill monthly averages onto every requested trading day.
        # Dates before the first available observation fall through to the fallback.
        annual = (
            self._cache
            .reindex(self._cache.index.union(dates))
            .sort_index()
            .ffill()
            .reindex(dates)
        )

        daily_compound = annual.map(
            lambda r: float((1 + r) ** (1 / TRADING_DAYS_PER_YEAR) - 1)
            if pd.notna(r) else np.nan
        )

        fallback_daily = self._fallback.daily_rate(dates)
        return daily_compound.fillna(fallback_daily)
