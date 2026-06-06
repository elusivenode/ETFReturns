"""Fetch Australian CPI data from the ABS SDMX REST API.

Series: CPI All Groups, Weighted average of eight capital cities, Index Numbers.
ABS dataflow key: CPI / 1.10001.10.50.Q  (quarterly)
"""
from __future__ import annotations

import json
import urllib.request
from datetime import date

import pandas as pd

_CPI_URL = (
    "https://api.data.abs.gov.au/data/CPI/1.10001.10.50.Q"
    "?startPeriod=2010-Q1&detail=dataonly"
)

_QUARTER_END: dict[str, int] = {"Q1": 3, "Q2": 6, "Q3": 9, "Q4": 12}

# Last day of month for each possible quarter-end month
_MONTH_END_DAY: dict[int, int] = {3: 31, 6: 30, 9: 30, 12: 31}


def _quarter_end_date(period_id: str) -> date:
    """Convert 'YYYY-QN' → last calendar date of that quarter."""
    year_str, q_str = period_id.split("-")
    year = int(year_str)
    month = _QUARTER_END[q_str]
    return date(year, month, _MONTH_END_DAY[month])


def fetch_cpi_quarterly() -> pd.DataFrame:
    """Return a DataFrame with columns ``date`` (quarter-end) and ``cpi`` (index level).

    Raises on network or parse failure — caller should catch and skip.
    """
    req = urllib.request.Request(_CPI_URL, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=30) as resp:
        payload = json.loads(resp.read().decode())

    structure = payload["data"]["structure"]
    obs_dims = structure["dimensions"]["observation"]
    time_dim = next(d for d in obs_dims if d["id"] == "TIME_PERIOD")
    period_values = [v["id"] for v in time_dim["values"]]

    datasets = payload["data"]["dataSets"]
    series_map = datasets[0]["series"]
    # There should be exactly one series key for this specific query
    series_key = next(iter(series_map))
    observations = series_map[series_key]["observations"]

    rows: list[dict] = []
    for idx_str, obs_values in observations.items():
        value = obs_values[0]
        if value is None:
            continue
        period_id = period_values[int(idx_str)]
        rows.append({"date": _quarter_end_date(period_id), "cpi": float(value)})

    df = pd.DataFrame(rows).sort_values("date").reset_index(drop=True)
    df["date"] = pd.to_datetime(df["date"])
    return df
