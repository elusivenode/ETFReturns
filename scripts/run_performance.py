from __future__ import annotations

import argparse
from pathlib import Path

from etf_analytics.analytics.performance_service import run_performance_pipeline
from etf_analytics.export.artifacts import write_portfolio_performance
from etf_analytics.settings import PERFORMANCE_METRICS_ARTIFACT_PATH, SQLITE_PATH
from etf_analytics.storage.db import connect


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Run portfolio performance pipeline and persist period metrics."
    )
    parser.add_argument("--portfolio-id", required=True, help="Portfolio id in SQLite performance tables")
    parser.add_argument(
        "--benchmark-code",
        default="CPI_PLUS_5_TOTAL",
        help="Benchmark code in benchmark_series table",
    )
    parser.add_argument(
        "--calculation-version",
        default="v1",
        help="Version tag saved in performance_metrics",
    )
    parser.add_argument(
        "--as-of-date",
        default=None,
        help="Optional metrics as_of_date override (YYYY-MM-DD)",
    )
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
        metrics, warnings = run_performance_pipeline(
            conn,
            portfolio_id=args.portfolio_id,
            benchmark_code=args.benchmark_code,
            calculation_version=args.calculation_version,
            as_of_date=args.as_of_date,
        )

        write_portfolio_performance(
            Path(args.artifact_path),
            portfolio_id=args.portfolio_id,
            benchmark_code=args.benchmark_code,
            calculation_version=args.calculation_version,
            as_of_date=str(metrics.attrs.get("as_of_date", args.as_of_date or "")),
            metrics_df=metrics,
            current_value=metrics.attrs.get("current_value"),
            capital_sources=metrics.attrs.get("capital_sources"),
        )
        conn.commit()

        print(
            f"Stored performance metrics for {args.portfolio_id} "
            f"({len(metrics)} periods, version={args.calculation_version})."
        )
        print(f"Wrote performance artifact to {args.artifact_path}")

        if warnings:
            print("Data quality warnings:")
            for msg in warnings:
                print(f"- {msg}")
        else:
            print("No data quality warnings.")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
