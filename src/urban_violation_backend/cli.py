"""CLI entrypoints for fixture import and contract inspection."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from urban_violation_backend.contracts import write_contract_schema
from urban_violation_backend.importer.parser import import_fixture_samples


DEFAULT_SAMPLE_IDS = ["000142_0_1762483003246", "001710_0_1763108687181"]


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Urban Violation backend utilities")
    subparsers = parser.add_subparsers(dest="command", required=True)

    inspect_cmd = subparsers.add_parser("inspect-fixture", help="Load deterministic fixture samples")
    inspect_cmd.add_argument("--dataset-root", type=Path, required=True)
    inspect_cmd.add_argument("--sample-id", action="append", dest="sample_ids")

    schema_cmd = subparsers.add_parser("export-contract", help="Export backend contract JSON schema")
    schema_cmd.add_argument("--output", type=Path, required=True)

    return parser


def main() -> int:
    """Run the CLI command."""
    parser = _build_parser()
    args = parser.parse_args()

    if args.command == "inspect-fixture":
        sample_ids = args.sample_ids or list(DEFAULT_SAMPLE_IDS)
        bundle = import_fixture_samples(dataset_root=args.dataset_root, sample_ids=sample_ids)
        print(bundle.model_dump_json(indent=2, ensure_ascii=False))
        return 0

    if args.command == "export-contract":
        write_contract_schema(args.output)
        print(json.dumps({"status": "ok", "output": str(args.output)}))
        return 0

    parser.error(f"Unsupported command: {args.command}")
    return 2


if __name__ == "__main__":
    raise SystemExit(main())
