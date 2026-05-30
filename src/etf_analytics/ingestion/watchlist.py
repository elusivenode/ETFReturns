from __future__ import annotations

from pathlib import Path

import yaml


def load_watchlist(path: Path) -> list[str]:
    with path.open("r", encoding="utf-8") as f:
        parsed = yaml.safe_load(f) or {}
    tickers = parsed.get("tickers", [])
    if not isinstance(tickers, list) or not all(isinstance(t, str) for t in tickers):
        raise ValueError("watchlist.yml must contain a string list under 'tickers'")
    return tickers
