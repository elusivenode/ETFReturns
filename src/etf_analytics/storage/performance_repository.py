from __future__ import annotations

import sqlite3
from datetime import datetime, timezone

import pandas as pd


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def upsert_portfolio(
    conn: sqlite3.Connection,
    *,
    portfolio_id: str,
    code: str,
    name: str,
    structure_type: str,
    inception_date: str,
    base_currency: str = "AUD",
    objective_type: str = "CPI_PLUS_SPREAD",
    objective_spread_bps: int = 500,
) -> None:
    ts = _utc_now_iso()
    conn.execute(
        """
        INSERT INTO portfolio(
            id, code, name, structure_type, base_currency,
            inception_date, objective_type, objective_spread_bps,
            created_at, updated_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            code=excluded.code,
            name=excluded.name,
            structure_type=excluded.structure_type,
            base_currency=excluded.base_currency,
            inception_date=excluded.inception_date,
            objective_type=excluded.objective_type,
            objective_spread_bps=excluded.objective_spread_bps,
            updated_at=excluded.updated_at
        """,
        (
            portfolio_id,
            code,
            name,
            structure_type,
            base_currency,
            inception_date,
            objective_type,
            objective_spread_bps,
            ts,
            ts,
        ),
    )


def upsert_portfolio_valuations(
    conn: sqlite3.Connection,
    portfolio_id: str,
    valuations_df: pd.DataFrame,
    source_system: str,
    source_ref: str | None = None,
) -> int:
    if valuations_df.empty:
        return 0

    rows = []
    for _, row in valuations_df.iterrows():
        rows.append(
            (
                portfolio_id,
                str(pd.Timestamp(row["valuation_date"]).date()),
                float(row["gross_assets"]) if pd.notna(row.get("gross_assets")) else None,
                float(row["liabilities"]) if pd.notna(row.get("liabilities")) else None,
                float(row["net_assets"]),
                float(row["cash_balance"]) if pd.notna(row.get("cash_balance")) else None,
                str(row.get("valuation_cutoff", "end_of_day")),
                int(row.get("is_final", 1)),
                source_system,
                source_ref,
                str(row.get("quality_flag")) if pd.notna(row.get("quality_flag")) else None,
                _utc_now_iso(),
            )
        )

    conn.executemany(
        """
        INSERT INTO portfolio_valuation(
            portfolio_id, valuation_date, gross_assets, liabilities, net_assets,
            cash_balance, valuation_cutoff, is_final, source_system, source_ref,
            quality_flag, created_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(portfolio_id, valuation_date) DO UPDATE SET
            gross_assets=excluded.gross_assets,
            liabilities=excluded.liabilities,
            net_assets=excluded.net_assets,
            cash_balance=excluded.cash_balance,
            valuation_cutoff=excluded.valuation_cutoff,
            is_final=excluded.is_final,
            source_system=excluded.source_system,
            source_ref=excluded.source_ref,
            quality_flag=excluded.quality_flag
        """,
        rows,
    )
    return len(rows)


def upsert_cash_flows(
    conn: sqlite3.Connection,
    portfolio_id: str,
    cash_flows_df: pd.DataFrame,
    source_ref: str | None = None,
) -> int:
    if cash_flows_df.empty:
        return 0

    rows = []
    for _, row in cash_flows_df.iterrows():
        rows.append(
            (
                portfolio_id,
                str(pd.Timestamp(row["flow_date"]).date()),
                float(row["amount"]),
                str(row["direction"]),
                str(row["flow_type"]),
                int(row["is_external_flow"]),
                str(row["twr_treatment"]),
                str(row.get("flow_timing", "end_of_day")),
                str(row.get("member_id")) if pd.notna(row.get("member_id")) else None,
                source_ref,
                str(row.get("note")) if pd.notna(row.get("note")) else None,
                _utc_now_iso(),
            )
        )

    conn.executemany(
        """
        INSERT INTO cash_flow(
            portfolio_id, flow_date, amount, direction, flow_type,
            is_external_flow, twr_treatment, flow_timing,
            member_id, source_ref, note, created_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        rows,
    )
    return len(rows)


def upsert_benchmark_series(
    conn: sqlite3.Connection,
    benchmark_code: str,
    series_df: pd.DataFrame,
    source: str,
    source_version: str | None = None,
) -> int:
    if series_df.empty:
        return 0

    rows = []
    for _, row in series_df.iterrows():
        rows.append(
            (
                benchmark_code,
                str(pd.Timestamp(row["date"]).date()),
                float(row["level"]) if pd.notna(row.get("level")) else None,
                float(row["period_return"]) if pd.notna(row.get("period_return")) else None,
                source,
                source_version,
                _utc_now_iso(),
            )
        )

    conn.executemany(
        """
        INSERT INTO benchmark_series(
            benchmark_code, date, level, period_return, source, source_version, created_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(benchmark_code, date) DO UPDATE SET
            level=excluded.level,
            period_return=excluded.period_return,
            source=excluded.source,
            source_version=excluded.source_version
        """,
        rows,
    )
    return len(rows)


def upsert_performance_metrics(
    conn: sqlite3.Connection,
    portfolio_id: str,
    as_of_date: str,
    metrics_df: pd.DataFrame,
    calculation_version: str,
) -> int:
    if metrics_df.empty:
        return 0

    rows = []
    for _, row in metrics_df.iterrows():
        rows.append(
            (
                portfolio_id,
                as_of_date,
                str(row["period_code"]),
                float(row["twr_annualized"]) if pd.notna(row.get("twr_annualized")) else None,
                float(row["mwr_annualized"]) if pd.notna(row.get("mwr_annualized")) else None,
                (
                    float(row["benchmark_annualized"])
                    if pd.notna(row.get("benchmark_annualized"))
                    else None
                ),
                float(row["excess_annualized"]) if pd.notna(row.get("excess_annualized")) else None,
                (
                    float(row["volatility_annualized"])
                    if pd.notna(row.get("volatility_annualized"))
                    else None
                ),
                float(row["max_drawdown"]) if pd.notna(row.get("max_drawdown")) else None,
                calculation_version,
                _utc_now_iso(),
            )
        )

    conn.executemany(
        """
        INSERT INTO performance_metrics(
            portfolio_id, as_of_date, period_code, twr_annualized,
            mwr_annualized, benchmark_annualized, excess_annualized,
            volatility_annualized, max_drawdown, calculation_version, created_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(portfolio_id, as_of_date, period_code, calculation_version) DO UPDATE SET
            twr_annualized=excluded.twr_annualized,
            mwr_annualized=excluded.mwr_annualized,
            benchmark_annualized=excluded.benchmark_annualized,
            excess_annualized=excluded.excess_annualized,
            volatility_annualized=excluded.volatility_annualized,
            max_drawdown=excluded.max_drawdown
        """,
        rows,
    )
    return len(rows)


def load_portfolio_valuations(
    conn: sqlite3.Connection,
    portfolio_id: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> pd.DataFrame:
    clauses = ["portfolio_id = ?"]
    params: list[object] = [portfolio_id]

    if start_date:
        clauses.append("valuation_date >= ?")
        params.append(start_date)
    if end_date:
        clauses.append("valuation_date <= ?")
        params.append(end_date)

    where = " AND ".join(clauses)
    query = f"""
    SELECT portfolio_id, valuation_date, gross_assets, liabilities, net_assets,
           cash_balance, valuation_cutoff, is_final, source_system, source_ref,
           quality_flag, created_at
    FROM portfolio_valuation
    WHERE {where}
    ORDER BY valuation_date ASC
    """
    return pd.read_sql_query(query, conn, params=params, parse_dates=["valuation_date"])


def load_cash_flows(
    conn: sqlite3.Connection,
    portfolio_id: str,
    start_date: str | None = None,
    end_date: str | None = None,
) -> pd.DataFrame:
    clauses = ["portfolio_id = ?"]
    params: list[object] = [portfolio_id]

    if start_date:
        clauses.append("flow_date >= ?")
        params.append(start_date)
    if end_date:
        clauses.append("flow_date <= ?")
        params.append(end_date)

    where = " AND ".join(clauses)
    query = f"""
    SELECT portfolio_id, flow_date, amount, direction, flow_type,
           is_external_flow, twr_treatment, flow_timing,
           member_id, source_ref, note, created_at
    FROM cash_flow
    WHERE {where}
    ORDER BY flow_date ASC, id ASC
    """
    return pd.read_sql_query(query, conn, params=params, parse_dates=["flow_date"])


def load_benchmark_series(
    conn: sqlite3.Connection,
    benchmark_code: str,
) -> pd.DataFrame:
    query = """
    SELECT benchmark_code, date, level, period_return, source, source_version, created_at
    FROM benchmark_series
    WHERE benchmark_code = ?
    ORDER BY date ASC
    """
    return pd.read_sql_query(query, conn, params=[benchmark_code], parse_dates=["date"])


def load_performance_metrics(
    conn: sqlite3.Connection,
    portfolio_id: str,
    as_of_date: str,
    calculation_version: str | None = None,
) -> pd.DataFrame:
    clauses = ["portfolio_id = ?", "as_of_date = ?"]
    params: list[object] = [portfolio_id, as_of_date]

    if calculation_version:
        clauses.append("calculation_version = ?")
        params.append(calculation_version)

    where = " AND ".join(clauses)
    query = f"""
    SELECT portfolio_id, as_of_date, period_code, twr_annualized,
           mwr_annualized, benchmark_annualized, excess_annualized,
           volatility_annualized, max_drawdown, calculation_version, created_at
    FROM performance_metrics
    WHERE {where}
    ORDER BY period_code ASC
    """
    return pd.read_sql_query(query, conn, params=params)
