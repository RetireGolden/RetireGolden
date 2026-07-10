#!/usr/bin/env python3
"""Run Owl CLI cases for the RetireGolden parity harness.

This script is dev/CI-only. It invokes Owl as a separate process and writes
normalized JSON artifacts that the TypeScript comparator can price on
RetireGolden's exact ledger.
"""

from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
import venv
from pathlib import Path
from typing import Any


OWL_REPOSITORY = "https://github.com/mdlacasse/Owl"
OWL_PINNED_COMMIT = "f09b4022b05e033efc34a74c7c384d605239c9bf"  # tag v2026.07.04
OWL_PACKAGE_SPEC = f"owlplanner @ git+{OWL_REPOSITORY}.git@{OWL_PINNED_COMMIT}"
TAX_KEYS = (
    "federal_income_tax",
    "ltcg_tax",
    "niit",
    "state_tax",
    "medicare_premiums",
    "aca_premiums",
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run Owl cases for RetireGolden parity")
    parser.add_argument("--cases-dir", required=True)
    parser.add_argument("--out-dir", required=True)
    parser.add_argument("--summary", required=True)
    parser.add_argument("--max-time", default="120")
    parser.add_argument("--gap", default="0.0001")
    return parser.parse_args()


def truthy(value: str | None) -> bool:
    return value is not None and value.lower() in {"1", "true", "yes", "on"}


def venv_python(venv_dir: Path) -> Path:
    if os.name == "nt":
        return venv_dir / "Scripts" / "python.exe"
    return venv_dir / "bin" / "python"


def ensure_venv(app_dir: Path) -> list[str]:
    venv_dir = app_dir / ".cache" / "owl-parity" / OWL_PINNED_COMMIT[:12]
    python = venv_python(venv_dir)
    if not python.exists():
        venv.EnvBuilder(with_pip=True, clear=False).create(venv_dir)
    subprocess.run(
        [str(python), "-m", "pip", "install", "--disable-pip-version-check", "--upgrade", OWL_PACKAGE_SPEC],
        check=True,
    )
    return [str(python), "-m", "owlplanner.cli._main"]


def owl_metadata(invocation: str, pinned_commit: str | None, unverified_reason: str | None = None) -> dict[str, Any]:
    metadata = {
        "repository": OWL_REPOSITORY,
        "pinnedCommit": pinned_commit,
        "verifiedPinnedCommit": pinned_commit == OWL_PINNED_COMMIT,
        "invocation": invocation,
    }
    if unverified_reason:
        metadata["unverifiedReason"] = unverified_reason
    return metadata


def find_owl(app_dir: Path) -> tuple[list[str] | None, dict[str, Any]]:
    if truthy(os.environ.get("OWL_PARITY_AUTO_INSTALL")):
        try:
            return ensure_venv(app_dir), owl_metadata(f"isolated venv ({OWL_PACKAGE_SPEC})", OWL_PINNED_COMMIT)
        except Exception as exc:  # pragma: no cover - environment dependent
            return None, owl_metadata("none", None, f"Could not install pinned Owl: {exc}")

    owlcli = shutil.which("owlcli")
    if owlcli:
        return [owlcli], owl_metadata(
            "owlcli on PATH",
            None,
            "Existing owlcli on PATH was not installed or verified by this harness.",
        )

    probe = subprocess.run(
        [sys.executable, "-c", "import owlplanner"],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    if probe.returncode == 0:
        return [sys.executable, "-m", "owlplanner.cli._main"], owl_metadata(
            "owlplanner import in current Python",
            None,
            "Current Python owlplanner import was not installed or verified by this harness.",
        )

    return None, owl_metadata("none", None, "Owl CLI not found. Install Owl or set OWL_PARITY_AUTO_INSTALL=1.")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(value, indent=2, sort_keys=True) + "\n", encoding="utf-8")


def skipped_summary(cases: list[Path], reason: str, owl: dict[str, Any]) -> dict[str, Any]:
    return {
        "status": "skipped",
        "reason": reason,
        "owl": owl,
        "artifacts": [
            {
                "fixtureId": case.stem,
                "status": "skipped",
                "conversions": [],
                "withdrawals": [],
                "selfReportedEndingWealth": None,
                "selfReportedLifetimeTax": None,
                "warnings": [reason],
            }
            for case in cases
        ],
    }


def normalize_owl_output(fixture_id: str, raw_path: Path, normalized_path: Path, raw: dict[str, Any]) -> dict[str, Any]:
    by_year = raw.get("by_year", [])
    lifetime_tax = 0
    if isinstance(by_year, list):
        for row in by_year:
            if isinstance(row, dict):
                lifetime_tax += sum(float(row.get(key, 0) or 0) for key in TAX_KEYS)

    schedule = raw.get("roth_conversions", {}).get("schedule", [])
    conversions = []
    if isinstance(schedule, list):
        for row in schedule:
            if not isinstance(row, dict):
                continue
            amount = float(row.get("amount_nominal", 0) or 0)
            if amount > 1:
                conversions.append({"year": int(row["year"]), "amount": round(amount)})

    summary = raw.get("summary", {})
    if not isinstance(summary, dict):
        summary = {}
    artifact = {
        "fixtureId": fixture_id,
        "status": "solved",
        "rawJsonFile": str(raw_path),
        "normalizedJsonFile": str(normalized_path),
        "conversions": conversions,
        "withdrawals": [],
        "selfReportedEndingWealth": summary.get("final_bequest_nominal", raw.get("total_bequest_nominal")),
        "selfReportedLifetimeTax": round(lifetime_tax),
        "warnings": [
            "owlcli JSON does not expose account-level withdrawal schedules; RetireGolden prices Owl conversions using the fixture withdrawal strategy."
        ],
    }
    write_json(normalized_path, artifact)
    return artifact


def run_case(command: list[str], case: Path, out_dir: Path, max_time: str, gap: str) -> dict[str, Any]:
    fixture_id = case.stem
    raw_path = out_dir / f"{fixture_id}.raw.json"
    normalized_path = out_dir / f"{fixture_id}.json"
    process = subprocess.run(
        [
            *command,
            "--log-level",
            "ERROR",
            "run",
            str(case),
            "--output-format",
            "json",
            "--solver",
            "HiGHS",
            "--max-time",
            max_time,
            "--gap",
            gap,
        ],
        text=True,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    raw_path.write_text(process.stdout, encoding="utf-8")
    if process.returncode != 0:
        artifact = {
            "fixtureId": fixture_id,
            "status": "failed",
            "rawJsonFile": str(raw_path),
            "normalizedJsonFile": str(normalized_path),
            "conversions": [],
            "withdrawals": [],
            "selfReportedEndingWealth": None,
            "selfReportedLifetimeTax": None,
            "warnings": [],
            "error": process.stderr.strip() or process.stdout.strip() or f"owlcli exited {process.returncode}",
        }
        write_json(normalized_path, artifact)
        return artifact

    try:
        raw = read_json(raw_path)
    except Exception as exc:
        artifact = {
            "fixtureId": fixture_id,
            "status": "failed",
            "rawJsonFile": str(raw_path),
            "normalizedJsonFile": str(normalized_path),
            "conversions": [],
            "withdrawals": [],
            "selfReportedEndingWealth": None,
            "selfReportedLifetimeTax": None,
            "warnings": [],
            "error": f"Could not parse owlcli JSON: {exc}",
        }
        write_json(normalized_path, artifact)
        return artifact

    return normalize_owl_output(fixture_id, raw_path, normalized_path, raw)


def main() -> int:
    args = parse_args()
    app_dir = Path(__file__).resolve().parent.parent
    cases_dir = Path(args.cases_dir).resolve()
    out_dir = Path(args.out_dir).resolve()
    summary_path = Path(args.summary).resolve()
    cases = sorted(cases_dir.glob("*.toml"))
    out_dir.mkdir(parents=True, exist_ok=True)

    command, owl = find_owl(app_dir)
    if command is None:
        summary = skipped_summary(cases, owl.get("unverifiedReason", "Owl CLI not found."), owl)
        write_json(summary_path, summary)
        return 0

    artifacts = [run_case(command, case, out_dir, args.max_time, args.gap) for case in cases]
    failed = [artifact for artifact in artifacts if artifact["status"] == "failed"]
    summary = {
        "status": "failed" if failed else "completed",
        "reason": f"{len(failed)} Owl case(s) failed." if failed else None,
        "owl": owl,
        "artifacts": artifacts,
    }
    write_json(summary_path, summary)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
