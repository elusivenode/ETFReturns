from __future__ import annotations

from dataclasses import dataclass

import pandas as pd

TRADING_DAYS_PER_YEAR = 252

EXTERNAL_NEUTRALIZE_TYPES = {
    "ROLLOVER_IN",
    "ROLLOVER_OUT",
    "CONTRIBUTION_EMPLOYER",
    "CONTRIBUTION_PERSONAL",
    "PENSION_PAYMENT",
    "BENEFIT_PAYMENT",
}

INCLUDE_IN_RETURN_TYPES = {
    "BROKERAGE",
    "INVESTMENT_MANAGEMENT_FEES",
    "ADMINISTRATION_FEES",
    "AUDIT_FEES",
    "TAX_PAYMENTS",
}


@dataclass(frozen=True)
class FlowPolicy:
    is_external_flow: bool
    twr_treatment: str


def classify_flow_type(flow_type: str) -> FlowPolicy:
    """Map a flow type to explicit TWR treatment metadata.

    External capital flows are neutralized for TWR.
    Operating and investment costs remain in return outcomes.
    """
    key = flow_type.strip().upper()
    if key in EXTERNAL_NEUTRALIZE_TYPES:
        return FlowPolicy(is_external_flow=True, twr_treatment="NEUTRALIZE")
    if key in INCLUDE_IN_RETURN_TYPES:
        return FlowPolicy(is_external_flow=False, twr_treatment="INCLUDE")
    raise ValueError(f"Unknown flow type for policy mapping: {flow_type}")


def normalize_flow_amount(amount: float, direction: str) -> float:
    """Normalize cash flow sign using IN/OUT convention.

    Positive means cash into the portfolio, negative means cash out.
    """
    value = float(amount)
    dir_key = direction.strip().upper()
    if dir_key == "IN":
        return abs(value)
    if dir_key == "OUT":
        return -abs(value)
    raise ValueError(f"Unknown flow direction: {direction}")


def external_cash_flow_by_date(cash_flows: pd.DataFrame) -> pd.Series:
    """Aggregate only external (neutralized) flows by date.

    Required columns:
    - flow_date
    - amount
    - direction
    - flow_type
    """
    if cash_flows.empty:
        return pd.Series(dtype=float)

    df = cash_flows.copy()
    df["flow_type"] = df["flow_type"].astype(str)
    policy = df["flow_type"].map(classify_flow_type)
    df["twr_treatment"] = policy.map(lambda p: p.twr_treatment)
    df["normalized_amount"] = [
        normalize_flow_amount(amount, direction)
        for amount, direction in zip(df["amount"], df["direction"], strict=False)
    ]

    ext = df[df["twr_treatment"] == "NEUTRALIZE"]
    if ext.empty:
        return pd.Series(dtype=float)

    grouped = ext.groupby("flow_date", as_index=True)["normalized_amount"].sum()
    grouped.index = pd.to_datetime(grouped.index)
    grouped = grouped.sort_index()
    return grouped


def compute_daily_twr(
    valuations: pd.DataFrame,
    cash_flows: pd.DataFrame,
) -> pd.DataFrame:
    """Compute daily TWR returns using end-of-day external flow assumption.

    Daily return formula:
      r_t = (V_t - V_{t-1} - CF_t_external) / V_{t-1}

    Where CF_t_external contains only neutralized external flows on day t.
    """
    required_cols = {"valuation_date", "net_assets"}
    missing = required_cols.difference(set(valuations.columns))
    if missing:
        raise ValueError(f"valuations missing columns: {sorted(missing)}")

    if valuations.empty:
        return pd.DataFrame(columns=["date", "portfolio_value", "external_flow", "daily_return"])

    v = valuations.copy()
    v["valuation_date"] = pd.to_datetime(v["valuation_date"])
    v = v.sort_values("valuation_date").reset_index(drop=True)

    flows = external_cash_flow_by_date(cash_flows)

    rows: list[dict[str, float | pd.Timestamp]] = []
    for idx in range(1, len(v)):
        date = v.loc[idx, "valuation_date"]
        prev_value = float(v.loc[idx - 1, "net_assets"])
        curr_value = float(v.loc[idx, "net_assets"])
        ext_flow = float(flows.get(date, 0.0)) if not flows.empty else 0.0

        if prev_value <= 0:
            daily_return = 0.0
        else:
            daily_return = (curr_value - prev_value - ext_flow) / prev_value

        rows.append(
            {
                "date": date,
                "portfolio_value": curr_value,
                "external_flow": ext_flow,
                "daily_return": daily_return,
            }
        )

    return pd.DataFrame(rows)


def linked_return(daily_returns: pd.Series) -> float:
    if daily_returns.empty:
        return 0.0
    return float((1.0 + daily_returns).prod() - 1.0)


def annualize_return(total_return: float, years: float) -> float:
    if years <= 0:
        raise ValueError("years must be > 0")
    if total_return <= -1:
        return -1.0
    return float((1.0 + total_return) ** (1.0 / years) - 1.0)


def rolling_linked_returns(daily_returns: pd.Series, window: int) -> pd.Series:
    """Compute rolling linked returns over a fixed daily-return window."""
    if window <= 0:
        raise ValueError("window must be > 0")
    if daily_returns.empty:
        return pd.Series(dtype=float)

    vals = (1.0 + daily_returns).rolling(window=window).apply(lambda x: x.prod() - 1.0, raw=True)
    vals.name = "rolling_linked_return"
    return vals.dropna()


def build_cpi_plus_spread_returns(cpi_returns: pd.Series, spread: float = 0.05) -> pd.Series:
    """Convert CPI returns into CPI+spread using geometric composition."""
    out = (1.0 + cpi_returns) * (1.0 + spread) - 1.0
    out.name = "cpi_plus_spread_return"
    return out


def summarize_capital_sources(current_value: float, cash_flows: pd.DataFrame) -> dict[str, float]:
    """Break current value into rollover, contributions, and investment returns."""
    if cash_flows.empty:
        rollover = 0.0
        contributions = 0.0
    else:
        df = cash_flows.copy()
        df["flow_type"] = df["flow_type"].astype(str).str.upper()
        df["signed_amount"] = [
            normalize_flow_amount(amount, direction)
            for amount, direction in zip(df["amount"], df["direction"], strict=False)
        ]

        rollover = float(
            df[df["flow_type"].isin({"ROLLOVER_IN", "ROLLOVER_OUT"})]["signed_amount"].sum()
        )
        contributions = float(
            df[
                df["flow_type"].isin(
                    {
                        "CONTRIBUTION_EMPLOYER",
                        "CONTRIBUTION_PERSONAL",
                        "PENSION_PAYMENT",
                        "BENEFIT_PAYMENT",
                    }
                )
            ]["signed_amount"].sum()
        )

    investment_returns = float(current_value - rollover - contributions)
    return {
        "rollover_capital": rollover,
        "contributions": contributions,
        "investment_returns": investment_returns,
        "current_value": float(current_value),
    }
