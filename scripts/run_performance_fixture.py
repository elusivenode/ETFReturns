from __future__ import annotations

import argparse

from etf_analytics.analytics.performance_fixture import seed_fixture_portfolio
from etf_analytics.analytics.performance_service import run_performance_pipeline
from etf_analytics.settings import SQLITE_PATH
from etf_analytics.storage.db import connect, init_db


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Seed fixture performance data and run performance pipeline."
    )
    parser.add_argument("--portfolio-id", default="fixture_smsf")
    parser.add_argument("--scenario", default="scenario3")
    parser.add_argument("--benchmark-code", default="CPI_PLUS_5_TOTAL")
    parser.add_argument("--calculation-version", default="fixture-v1")
    parser.add_argument("--benchmark-daily-return", type=float, default=0.0008)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    conn = connect(SQLITE_PATH)
    try:
        from etf_analytics.settings import SCHEMA_PATH

        init_db(conn, SCHEMA_PATH.read_text(encoding="utf-8"))

        seeded = seed_fixture_portfolio(
            conn,
            portfolio_id=args.portfolio_id,
            scenario=args.scenario,
            benchmark_code=args.benchmark_code,
            benchmark_daily_return=args.benchmark_daily_return,
        )
        metrics, warnings = run_performance_pipeline(
            conn,
            portfolio_id=args.portfolio_id,
            benchmark_code=args.benchmark_code,
            calculation_version=args.calculation_version,
        )
        conn.commit()

        print(f"Seeded fixture data for {args.portfolio_id}: {seeded}")
        print(f"Stored metrics rows: {len(metrics)}")

        if warnings:
            print("Warnings:")
            for warning in warnings:
                print(f"- {warning}")
        else:
            print("No warnings.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
