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
