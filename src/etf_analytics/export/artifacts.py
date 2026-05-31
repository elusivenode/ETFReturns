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


def write_price_series(path: Path, price_df: pd.DataFrame) -> None:
    """Export adj_close price series per ticker for the Compare chart.

    Uses compact JSON (no indent) since this file can be several MB.
    Format: { "VAS.AX": { "dates": [...], "prices": [...] }, ... }
    """
    result: dict[str, dict[str, list]] = {}
    for ticker, grp in price_df.groupby("ticker"):
        series = grp.set_index("date")["adj_close"].sort_index().dropna()
        result[str(ticker)] = {
            "dates":  [d.strftime("%Y-%m-%d") for d in series.index],
            "prices": [round(float(p), 4) for p in series.values],
        }
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        json.dump(result, f, separators=(",", ":"))
