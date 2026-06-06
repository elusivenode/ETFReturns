"""Compute rolling 3-year annualised CPI from quarterly index data."""
from __future__ import annotations

import pandas as pd

ROLLING_YEARS = 3
QUARTERS_PER_YEAR = 4
ROLLING_QUARTERS = ROLLING_YEARS * QUARTERS_PER_YEAR  # 12


def compute_rolling_cpi_3y(cpi_df: pd.DataFrame) -> pd.DataFrame:
    """Return a DataFrame with columns ``date`` and ``cpi_3y`` (annualised, as a fraction).

    Args:
        cpi_df: DataFrame with ``date`` (datetime, quarter-end) and ``cpi`` (index level).

    Returns:
        DataFrame of quarterly dates where a full 3-year window is available,
        with ``cpi_3y`` = (CPI_t / CPI_{t-12})^(1/3) - 1.
    """
    df = cpi_df.sort_values("date").reset_index(drop=True)

    rows: list[dict] = []
    for i in range(ROLLING_QUARTERS, len(df)):
        cpi_now = df.loc[i, "cpi"]
        cpi_then = df.loc[i - ROLLING_QUARTERS, "cpi"]
        if cpi_then <= 0:
            continue
        cpi_3y = (cpi_now / cpi_then) ** (1 / ROLLING_YEARS) - 1
        rows.append({"date": df.loc[i, "date"], "cpi_3y": round(float(cpi_3y), 6)})

    return pd.DataFrame(rows)
