PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS metadata (
    ticker TEXT PRIMARY KEY,
    name TEXT,
    currency TEXT,
    exchange TEXT,
    last_refreshed_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS prices (
    ticker TEXT NOT NULL,
    date TEXT NOT NULL,
    open REAL,
    high REAL,
    low REAL,
    close REAL,
    adj_close REAL,
    volume REAL,
    PRIMARY KEY (ticker, date),
    FOREIGN KEY (ticker) REFERENCES metadata(ticker)
);

CREATE INDEX IF NOT EXISTS idx_prices_date ON prices(date);

CREATE TABLE IF NOT EXISTS dividends (
    ticker TEXT NOT NULL,
    ex_date TEXT NOT NULL,
    amount REAL NOT NULL,
    PRIMARY KEY (ticker, ex_date),
    FOREIGN KEY (ticker) REFERENCES metadata(ticker)
);

CREATE INDEX IF NOT EXISTS idx_dividends_ex_date ON dividends(ex_date);

CREATE TABLE IF NOT EXISTS portfolios (
    portfolio_id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS portfolio_weights (
    portfolio_id TEXT NOT NULL,
    ticker TEXT NOT NULL,
    weight REAL NOT NULL,
    effective_date TEXT NOT NULL,
    PRIMARY KEY (portfolio_id, ticker, effective_date),
    FOREIGN KEY (portfolio_id) REFERENCES portfolios(portfolio_id),
    FOREIGN KEY (ticker) REFERENCES metadata(ticker)
);

-- Performance module (Phase 1A foundations)

CREATE TABLE IF NOT EXISTS portfolio (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    structure_type TEXT NOT NULL,
    base_currency TEXT NOT NULL DEFAULT 'AUD',
    inception_date TEXT NOT NULL,
    objective_type TEXT NOT NULL DEFAULT 'CPI_PLUS_SPREAD',
    objective_spread_bps INTEGER NOT NULL DEFAULT 500,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK (structure_type IN ('SMSF', 'FamilyTrust', 'Other')),
    CHECK (objective_type IN ('CPI_PLUS_SPREAD'))
);

CREATE TABLE IF NOT EXISTS portfolio_valuation (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id TEXT NOT NULL,
    valuation_date TEXT NOT NULL,
    gross_assets REAL,
    liabilities REAL,
    net_assets REAL NOT NULL,
    cash_balance REAL,
    valuation_cutoff TEXT NOT NULL DEFAULT 'end_of_day',
    is_final INTEGER NOT NULL DEFAULT 1,
    source_system TEXT NOT NULL,
    source_ref TEXT,
    quality_flag TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (portfolio_id) REFERENCES portfolio(id),
    UNIQUE (portfolio_id, valuation_date),
    CHECK (valuation_cutoff IN ('end_of_day')),
    CHECK (is_final IN (0, 1))
);

CREATE INDEX IF NOT EXISTS idx_portfolio_valuation_portfolio_date
ON portfolio_valuation(portfolio_id, valuation_date);

CREATE TABLE IF NOT EXISTS cash_flow (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id TEXT NOT NULL,
    flow_date TEXT NOT NULL,
    amount REAL NOT NULL,
    direction TEXT NOT NULL,
    flow_type TEXT NOT NULL,
    is_external_flow INTEGER NOT NULL,
    twr_treatment TEXT NOT NULL,
    flow_timing TEXT NOT NULL DEFAULT 'end_of_day',
    member_id TEXT,
    source_ref TEXT,
    note TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (portfolio_id) REFERENCES portfolio(id),
    CHECK (direction IN ('IN', 'OUT')),
    CHECK (is_external_flow IN (0, 1)),
    CHECK (twr_treatment IN ('NEUTRALIZE', 'INCLUDE')),
    CHECK (flow_timing IN ('end_of_day'))
);

CREATE INDEX IF NOT EXISTS idx_cash_flow_portfolio_date
ON cash_flow(portfolio_id, flow_date);

CREATE TABLE IF NOT EXISTS benchmark_series (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    benchmark_code TEXT NOT NULL,
    date TEXT NOT NULL,
    level REAL,
    period_return REAL,
    source TEXT NOT NULL,
    source_version TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (benchmark_code, date)
);

CREATE INDEX IF NOT EXISTS idx_benchmark_series_code_date
ON benchmark_series(benchmark_code, date);

CREATE TABLE IF NOT EXISTS performance_metrics (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    portfolio_id TEXT NOT NULL,
    as_of_date TEXT NOT NULL,
    period_code TEXT NOT NULL,
    twr_annualized REAL,
    mwr_annualized REAL,
    benchmark_annualized REAL,
    excess_annualized REAL,
    volatility_annualized REAL,
    max_drawdown REAL,
    calculation_version TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (portfolio_id) REFERENCES portfolio(id),
    UNIQUE (portfolio_id, as_of_date, period_code, calculation_version),
    CHECK (period_code IN ('SI', '1Y', '3Y', '5Y', '10Y'))
);

CREATE INDEX IF NOT EXISTS idx_performance_metrics_portfolio_date_period
ON performance_metrics(portfolio_id, as_of_date, period_code);
