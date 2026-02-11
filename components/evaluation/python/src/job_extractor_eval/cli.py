#!/usr/bin/env python3
"""
CLI interface for Career Catalyst evaluation.

Usage:
    python -m job_extractor_eval.cli <job_id>
    evaluate-jobs <job_id>
"""

import sys
import argparse
from typing import Optional
from .evaluators import (
    evaluate_required_terms_quality,
    evaluate_extraction_completeness,
    check_langsmith_setup,
)


def main(argv: Optional[list[str]] = None) -> int:
    """Main CLI entry point."""
    parser = argparse.ArgumentParser(
        description="Evaluate job extraction quality using LangSmith"
    )
    parser.add_argument(
        "job_id",
        nargs="?",
        help="Job ID to evaluate (optional, will analyze all if not provided)",
    )
    parser.add_argument(
        "--check-setup",
        action="store_true",
        help="Check LangSmith setup and API connection",
    )
    parser.add_argument(
        "--terms-only",
        action="store_true",
        help="Only evaluate required terms quality",
    )
    parser.add_argument(
        "--completeness-only",
        action="store_true",
        help="Only evaluate extraction completeness",
    )

    args = parser.parse_args(argv)

    if args.check_setup:
        print("🔍 Checking LangSmith Setup")
        print("=" * 50)
        is_connected = check_langsmith_setup()
        return 0 if is_connected else 1

    if not args.job_id:
        print("❌ Error: job_id is required")
        parser.print_help()
        return 1

    print(f"🔍 LangSmith Job Extraction Evaluation")
    print(f"📊 Job ID: {args.job_id}")
    print("=" * 50)
    print()

    # Check LangSmith setup
    langsmith_connected = check_langsmith_setup()
    print()

    # Run evaluations
    if not args.completeness_only:
        print("📝 Evaluating Required Terms Quality...")
        terms_metrics = evaluate_required_terms_quality(args.job_id)
        print()
        print("Results:")
        for key, value in terms_metrics.items():
            print(f"  {key}: {value}")
        print()

    if not args.terms_only:
        print("📋 Evaluating Extraction Completeness...")
        completeness_metrics = evaluate_extraction_completeness(args.job_id)
        print()
        print("Results:")
        for key, value in completeness_metrics.items():
            print(f"  {key}: {value}")
        print()

    if not langsmith_connected:
        print("💡 Tip: Set up LangSmith API key to enable cloud tracking")
        print("   Visit: https://smith.langchain.com/")

    return 0


if __name__ == "__main__":
    sys.exit(main())
