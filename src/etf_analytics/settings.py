from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR = PROJECT_ROOT / "data"
ARTIFACT_DIR = DATA_DIR / "artifacts" / "latest"
SQLITE_PATH = DATA_DIR / "sqlite" / "etf_cache.db"
WATCHLIST_PATH = PROJECT_ROOT / "config" / "watchlist.yml"
SCHEMA_PATH = PROJECT_ROOT / "sql" / "schema.sql"
