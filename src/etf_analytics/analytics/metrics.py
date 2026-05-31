from __future__ import annotations

import numpy as np
import pandas as pd


def _max_drawdown(returns: pd.Series) -> float:
    cumulative = (1 + returns).cumprod()
    peak = cumulative.cummax()
    dd = (cumulative / peak) - 1
    return float(dd.min()) if not dd.empty else 0.0


def _rolling_return(prices: pd.Series, days: int) -> pd.Series:
    return prices / prices.shift(days) - 1


def calc_summary_metrics(price_df: pd.DataFrame, dividend_df: pd.DataFrame) -> pd.DataFrame:
    rows: list[dict[str, float | str]] = []
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

        rows.append(
            {
                "ticker": ticker,
                "total_return": total_return,
                "cagr": cagr,
                "volatility": volatility,
                "max_drawdown": max_drawdown,
                "distribution_yield": distribution_yield,
            }
        )
    return pd.DataFrame(rows).sort_values("ticker")


def calc_correlation_matrix(price_df: pd.DataFrame) -> pd.DataFrame:
    piv = (
        price_df.pivot(index="date", columns="ticker", values="adj_close")
        .sort_index()
        .ffill()
        .dropna(how="all")
    )
    returns = piv.pct_change().dropna(how="all")
    return returns.corr()


def calc_rolling_returns(price_df: pd.DataFrame) -> pd.DataFrame:
    output: list[pd.DataFrame] = []
    windows = {"1y": 252, "3y": 756, "5y": 1260}
    for ticker, grp in price_df.groupby("ticker"):
        series = grp.set_index("date")["adj_close"].sort_index().dropna()
        frame = pd.DataFrame(index=series.index)
        frame["ticker"] = ticker
        for label, days in windows.items():
            frame[f"rolling_{label}"] = _rolling_return(series, days)
        output.append(frame.reset_index())
    if not output:
        return pd.DataFrame(columns=["date", "ticker", "rolling_1y", "rolling_3y", "rolling_5y"])
    return pd.concat(output, ignore_index=True)


def backtest_buy_and_hold(
    price_df: pd.DataFrame, weights: dict[str, float], initial_capital: float = 100000.0
) -> pd.DataFrame:
    piv = (
        price_df.pivot(index="date", columns="ticker", values="adj_close")
        .sort_index()
        .ffill()
        .dropna(how="all")
    )
    valid_weights = {k: v for k, v in weights.items() if k in piv.columns}
    if not valid_weights:
        return pd.DataFrame(columns=["date", "portfolio_value"])

    w = pd.Series(valid_weights)
    w = w / w.sum()
    returns = piv[list(w.index)].pct_change().dropna(how="all")
    portfolio_returns = returns.mul(w, axis=1).sum(axis=1)
    portfolio_value = initial_capital * (1 + portfolio_returns).cumprod()

    return pd.DataFrame({"date": portfolio_value.index, "portfolio_value": portfolio_value.values})
