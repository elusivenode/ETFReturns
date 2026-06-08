from __future__ import annotations

import argparse
from pathlib import Path

from etf_analytics.analytics.performance_fixture import seed_fixture_portfolio
from etf_analytics.analytics.performance_service import run_performance_pipeline
from etf_analytics.export.artifacts import write_portfolio_performance
from etf_analytics.settings import PERFORMANCE_METRICS_ARTIFACT_PATH, SQLITE_PATH
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
    parser.add_argument(
        "--artifact-path",
        default=str(PERFORMANCE_METRICS_ARTIFACT_PATH),
        help="Path to write performance artifact JSON",
    )
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

        write_portfolio_performance(
            Path(args.artifact_path),
            portfolio_id=args.portfolio_id,
            benchmark_code=args.benchmark_code,
            calculation_version=args.calculation_version,
            as_of_date=str(metrics.attrs.get("as_of_date", "")),
            metrics_df=metrics,
            current_value=metrics.attrs.get("current_value"),
            capital_sources=metrics.attrs.get("capital_sources"),
            valuation_series=metrics.attrs.get("valuation_series"),
            cumulative_return_series=metrics.attrs.get("cumulative_return_series"),
            rolling_3y_return_series=metrics.attrs.get("rolling_3y_return_series"),
        )
        conn.commit()

        print(f"Seeded fixture data for {args.portfolio_id}: {seeded}")
        print(f"Stored metrics rows: {len(metrics)}")
        print(f"Wrote performance artifact to {args.artifact_path}")

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
