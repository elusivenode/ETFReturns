from pathlib import Path


def _find_project_root() -> Path:
    # Strategy 1: walk up from __file__ — works for editable installs and direct source runs
    for p in Path(__file__).resolve().parents:
        if (p / "pyproject.toml").exists():
            return p
    # Strategy 2: walk up from CWD — works for regular installs run from the project root
    # (the default on GitHub Actions after actions/checkout)
    for p in [Path.cwd(), *Path.cwd().parents]:
        if (p / "pyproject.toml").exists():
            return p
    raise RuntimeError(
        "Cannot locate project root: no pyproject.toml found in parents of __file__ "
        "or CWD. Run scripts from the project root directory."
    )


PROJECT_ROOT = _find_project_root()
DATA_DIR = PROJECT_ROOT / "data"
ARTIFACT_DIR = DATA_DIR / "artifacts" / "latest"
SQLITE_PATH = DATA_DIR / "sqlite" / "etf_cache.db"
WATCHLIST_PATH = PROJECT_ROOT / "config" / "watchlist.yml"
SCHEMA_PATH = PROJECT_ROOT / "sql" / "schema.sql"
OVERRIDES_PATH = DATA_DIR / "price_overrides.csv"
