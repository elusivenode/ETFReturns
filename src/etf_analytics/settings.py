from pathlib import Path

# Walk up from this file until we find the project root marker (pyproject.toml).
# This is robust for both editable and regular installs.
_here = Path(__file__).resolve()
PROJECT_ROOT = next(p for p in _here.parents if (p / "pyproject.toml").exists())
DATA_DIR = PROJECT_ROOT / "data"
ARTIFACT_DIR = DATA_DIR / "artifacts" / "latest"
SQLITE_PATH = DATA_DIR / "sqlite" / "etf_cache.db"
WATCHLIST_PATH = PROJECT_ROOT / "config" / "watchlist.yml"
SCHEMA_PATH = PROJECT_ROOT / "sql" / "schema.sql"
