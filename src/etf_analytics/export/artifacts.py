from __future__ import annotations

import json
from pathlib import Path

import pandas as pd


def _write_json(path: Path, payload: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)


def write_metrics(path: Path, metrics_df: pd.DataFrame) -> None:
    _write_json(path, metrics_df.to_dict(orient="records"))


def write_correlation(path: Path, corr_df: pd.DataFrame) -> None:
    payload = {
        "tickers": list(corr_df.columns),
        "matrix": corr_df.fillna(0.0).round(6).values.tolist(),
    }
    _write_json(path, payload)


def write_rolling_returns(path: Path, rolling_df: pd.DataFrame) -> None:
    frame = rolling_df.copy()
    if "date" in frame.columns:
        frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
    _write_json(path, frame.where(pd.notna(frame), None).to_dict(orient="records"))


def write_backtest(path: Path, backtest_df: pd.DataFrame) -> None:
    frame = backtest_df.copy()
    if "date" in frame.columns:
        frame["date"] = pd.to_datetime(frame["date"]).dt.strftime("%Y-%m-%d")
    _write_json(path, frame.to_dict(orient="records"))


def _scrub_price_outliers(series: pd.Series, max_daily_move: float = 0.5) -> pd.Series:
    """Replace prices that produce an unrealistic single-day return with a linear interpolation.

    A spike-and-revert pair (e.g. yfinance bad adj_close) is detected when:
      - |return[i]| > max_daily_move, AND
      - |return from [i-1] to [i+1]| < max_daily_move  (i.e. the next price is back to normal)
    The bad price at [i] is replaced with the midpoint of its neighbours.
    """
    prices = series.copy().astype(float)
    vals = prices.to_numpy(copy=True)
    for i in range(1, len(vals) - 1):
        if vals[i - 1] <= 0:
            continue
        ret = vals[i] / vals[i - 1] - 1
        if abs(ret) > max_daily_move:
            next_ret = vals[i + 1] / vals[i - 1] - 1
            if abs(next_ret) < max_daily_move:
                vals[i] = (vals[i - 1] + vals[i + 1]) / 2
    prices[:] = vals
    return prices


def scrub_price_df(price_df: pd.DataFrame) -> pd.DataFrame:
    """Apply _scrub_price_outliers to each ticker's adj_close in-place.

    Returns a copy with spike-and-revert bad prices replaced by linear
    interpolation.  Should be called once, before any analytics or artifact
    writes, so every consumer sees clean prices.
    """
    df = price_df.copy()
    df["date"] = pd.to_datetime(df["date"])
    cleaned_parts = []
    for ticker, grp in df.groupby("ticker", sort=False):
        grp = grp.sort_values("date").copy()
        grp["adj_close"] = _scrub_price_outliers(grp["adj_close"])
        cleaned_parts.append(grp)
    return pd.concat(cleaned_parts).sort_values(["ticker", "date"]).reset_index(drop=True)


def _sanitize_record(row: dict) -> dict:
    """Replace float NaN/Inf with None so json.dump produces valid JSON."""
    import math
    return {
        k: (None if isinstance(v, float) and not math.isfinite(v) else v)
        for k, v in row.items()
    }


def write_period_metrics(path: Path, period_df: pd.DataFrame) -> None:
    """Export per-ticker period return/vol/sharpe to period_metrics.json."""
    records = [_sanitize_record(row) for row in period_df.to_dict(orient="records")]
    _write_json(path, records)


def write_risk_metrics(path: Path, metrics_df: pd.DataFrame, metadata: dict) -> None:
    """Export risk metrics artifact with embedded metadata.

    Format:
        { "metadata": {...assumptions...}, "tickers": [{...per-ticker rows...}] }

    All float NaN/Inf are converted to null so the JSON is browser-safe.
    """
    records = [_sanitize_record(row) for row in metrics_df.to_dict(orient="records")]
    _write_json(path, {"metadata": metadata, "tickers": records})


def write_cpi_series(
    path: Path,
    raw_df: pd.DataFrame,
    rolling_df: pd.DataFrame,
) -> None:
    """Export CPI artifact with two series for different chart uses.

    Args:
        raw_df:     Quarterly CPI index levels (``date``, ``cpi`` columns).
                    Used by the Compare chart to compute cumulative inflation return.
        rolling_df: Rolling 3Y annualised CPI (``date``, ``cpi_3y`` columns).
                    Used by the Backtest chart as a reference line.

    Output format::

        {
          "quarterly_index": {"dates": [...], "values": [...]},
          "rolling_3y":      {"dates": [...], "values": [...]}
        }
    """
    _write_json(path, {
        "quarterly_index": {
            "dates":  [d.strftime("%Y-%m-%d") for d in pd.to_datetime(raw_df["date"])],
            "values": [round(float(v), 4) for v in raw_df["cpi"]],
        },
        "rolling_3y": {
            "dates":  [d.strftime("%Y-%m-%d") for d in pd.to_datetime(rolling_df["date"])],
            "values": [round(float(v), 6) for v in rolling_df["cpi_3y"]],
        },
    })


def write_price_series(path: Path, price_df: pd.DataFrame) -> None:
    """Export adj_close price series per ticker for the Compare chart.

    Uses compact JSON (no indent) since this file can be several MB.
    Format: { "VAS.AX": { "dates": [...], "prices": [...] }, ... }
    """
    result: dict[str, dict[str, list]] = {}
    for ticker, grp in price_df.groupby("ticker"):
        series = grp.set_index("date")["adj_close"].sort_index().dropna()
        series = _scrub_price_outliers(series)
        result[str(ticker)] = {
            "dates":  [d.strftime("%Y-%m-%d") for d in series.index],
            "prices": [round(float(p), 4) for p in series.values],
        }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))


def write_portfolio_performance(
        path: Path,
        *,
        portfolio_id: str,
        benchmark_code: str,
        calculation_version: str,
        as_of_date: str,
        metrics_df: pd.DataFrame,
) -> None:
        """Export portfolio performance metrics for UI consumption.

        Output format:
            {
                "portfolio_id": "...",
                "benchmark_code": "...",
                "calculation_version": "...",
                "as_of_date": "YYYY-MM-DD",
                "periods": [{...}, ...]
            }
        """
        records = [_sanitize_record(row) for row in metrics_df.to_dict(orient="records")]
        payload = {
                "portfolio_id": portfolio_id,
                "benchmark_code": benchmark_code,
                "calculation_version": calculation_version,
                "as_of_date": as_of_date,
                "periods": records,
        }
        _write_json(path, payload)
