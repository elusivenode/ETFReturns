"""Fetch interest rate series from the RBA Statistics CSV endpoint.

Source: https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv
Table:  F1.1 Interest Rates and Yields – Money Market (monthly averages)

CSV layout (rows are 0-indexed):
    0  : Table title
    1  : Column titles
    2  : Column descriptions
    3  : Frequency
    4  : Type
    5  : Units  (all rates are "Per cent" p.a.)
    6-7: Blank
    8  : Source
    9  : Publication date
    10 : Series ID  ← column headers used here to locate each series
    11+: Data rows  "DD/MM/YYYY,val,val,..."

Available series IDs and their content:
    FIRMMCRT    Cash Rate Target (monthly average)             ← default
    FIRMMCRI    Interbank Overnight Cash Rate (monthly avg)
    FIRMMBAB30  1-month BABs/NCDs
    FIRMMBAB90  3-month BABs/NCDs
    FIRMMBAB180 6-month BABs/NCDs
    FIRMMOIS1   1-month OIS
    FIRMMOIS3   3-month OIS
    FIRMMOIS6   6-month OIS
    FIRMMTN1    1-month Treasury Notes
    FIRMMTN3    3-month Treasury Notes
    FIRMMTN6    6-month Treasury Notes

All values are published as percentages (e.g. 4.35 = 4.35% p.a.).
This module converts them to decimals (0.0435) before returning.
"""
from __future__ import annotations

import csv
import io
import urllib.request
from datetime import datetime

import pandas as pd

_URL = "https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv"
_HEADER_ROW = 10        # zero-indexed row containing Series IDs
_DATA_START_ROW = 11    # first row of actual observations
_DATE_COL = 0           # column index for the date field
_DATE_FMT = "%d/%m/%Y"  # RBA uses DD/MM/YYYY


def fetch_rba_series(series_id: str = "FIRMMCRT") -> pd.Series | None:
    """Fetch a named rate series from RBA Table F1.1.

    Args:
        series_id: RBA series identifier (e.g. ``"FIRMMCRT"`` for Cash Rate
                   Target, ``"FIRMMBAB90"`` for 3-month BABs/NCDs).

    Returns:
        pd.Series[float] with DatetimeIndex (month-end dates), values as
        annual rates in decimal form (e.g. 0.0435 for 4.35%).
        Returns None on any network or parse failure so callers can fall back.

    Notes:
        * Values are monthly averages, not decision-date snapshots.
        * The series starts August 1990 for FIRMMCRT; other series vary.
        * Forward-filling to daily frequency is the caller's responsibility.
    """
    try:
        req = urllib.request.Request(_URL, headers={"User-Agent": "ETFReturns/1.0"})
        with urllib.request.urlopen(req, timeout=20) as resp:
            raw = resp.read().decode("utf-8-sig", errors="replace")

        return _parse_csv(raw, series_id)

    except Exception:  # noqa: BLE001
        return None


def _parse_csv(raw: str, series_id: str) -> pd.Series | None:
    """Parse the RBA CSV and return the requested series."""
    reader = list(csv.reader(io.StringIO(raw)))

    if len(reader) <= _HEADER_ROW:
        return None

    headers = reader[_HEADER_ROW]

    # Locate the column for this series ID
    try:
        col_idx = headers.index(series_id)
    except ValueError:
        return None  # series not found in this table

    rows: list[tuple[pd.Timestamp, float]] = []
    for row in reader[_DATA_START_ROW:]:
        if len(row) <= col_idx:
            continue
        date_str = row[_DATE_COL].strip()
        val_str = row[col_idx].strip()
        if not date_str or not val_str:
            continue
        try:
            date = pd.Timestamp(datetime.strptime(date_str, _DATE_FMT))
            value = float(val_str) / 100.0  # pct → decimal
        except (ValueError, TypeError):
            continue
        rows.append((date, value))

    if not rows:
        return None

    dates, values = zip(*rows)
    return pd.Series(
        list(values),
        index=pd.DatetimeIndex(list(dates)),
        name=series_id,
        dtype=float,
    )
