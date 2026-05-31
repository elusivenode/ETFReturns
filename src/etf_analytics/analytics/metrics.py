from __future__ import annotations

import numpy as np
import pandas as pd

# Trading-day windows for 1–5 year period metrics
_PERIODS: dict[str, int] = {"1y": 252, "2y": 504, "3y": 756, "4y": 1008, "5y": 1260}


def _max_drawdown(returns: pd.Series) -> float:
    cumulative = (1 + returns).cumprod()
    peak = cumulative.cummax()
    dd = (cumulative / peak) - 1
    return float(dd.min()) if not dd.empty else 0.0


def _period_cagr(series: pd.Series, days: int) -> float | None:
    if len(series) < days:
        return None
    p_end = float(series.iloc[-1])
    p_start = float(series.iloc[-days])
    if p_start <= 0:
        return None
    return float((p_end / p_start) ** (252 / days) - 1)


def _period_vol(daily_returns: pd.Series, days: int) -> float | None:
    if len(daily_returns) < days:
        return None
    return float(daily_returns.iloc[-days:].std() * np.sqrt(252))


def calc_summary_metrics(price_df: pd.DataFrame, dividend_df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict] = []
    for ticker, grp in price_df.groupby("ticker"):
        series = grp.set_index("date")["adj_close"].sort_index().dropna()
        daily_returns = series.pct_change().dropna()
        if series.empty or daily_returns.empty:
            continue

        years = max((series.index[-1] - series.index[0]).days / 365.25, 1 / 365.25)
        total_return = float(series.iloc[-1] / series.iloc[0] - 1)
        cagr = float((series.iloc[-1] / series.iloc[0]) ** (1 / years) - 1)
        volatility = float(daily_returns.std() * np.sqrt(252))
        max_drawdown = _max_drawdown(daily_returns)

        div = dividend_df[dividend_df["ticker"] == ticker].copy()
        trailing_12m = 0.0
        if not div.empty:
            cutoff = series.index.max() - pd.Timedelta(days=365)
            trailing_12m = float(div[div["ex_date"] >= cutoff]["amount"].sum())
        distribution_yield = float(trailing_12m / series.iloc[-1]) if series.iloc[-1] else 0.0

        row: dict = {
            "ticker": ticker,
            "latest_date": series.index[-1].strftime("%Y-%m-%d"),
            "total_return": total_return,
            "cagr": cagr,
            "volatility": volatility,
            "max_drawdown": max_drawdown,
            "distribution_yield": distribution_yield,
        }

        for label, days in _PERIODS.items():
            row[f"cagr_{label}"] = _period_cagr(series, days)
            row[f"vol_{label}"] = _period_vol(daily_returns, days)

        rows.append(row)

    return pd.DataFrame(rows).sort_values("ticker")
