"""Regenerate with the pinned action's environment (no model/API calls).

uv run --project <action-checkout> python <path-to-this-script>
The checkout must contain the pinned commit and matching, unmodified source.
"""

import json
from pathlib import Path
import subprocess

from or_pr_review import publish
from or_pr_review.collect import CollectedReview, DiffPlan, Truncation
from or_pr_review.loop import Ledger, LedgerFinding, _encode
from or_pr_review.merge import MergedIssue
from or_pr_review.schema import LaneResult, SCHEMA_VERSION
from or_pr_review.review_policy import PolicyFile, ResolvedPolicy

PRODUCER = "93cc91130605bc17cb583c5a5e899591773e048c"
root = Path(publish.__file__).resolve().parents[2]


def git(*args):
    return subprocess.check_output(["git", "-C", str(root), *args], text=True).strip()


if git("rev-parse", "HEAD:src/or_pr_review") != git("rev-parse", f"{PRODUCER}:src/or_pr_review"):
    raise SystemExit("Action source does not match the pinned producer")
if git("diff", "HEAD", "--", "src/or_pr_review"):
    raise SystemExit("Action source has uncommitted changes")

sha = "a" * 40
repo = "RetireGolden/RetireGolden"
pr = 267
url = f"https://github.com/{repo}/actions/runs/123"
cases = []
for name, mode, status in [
    ("initial-clean", "initial", None),
    ("verify-clean-disputed", "verify", "disputed"),
    ("initial-issues", "initial", "open"),
    ("initial-clean-policy", "initial", None),
]:
    finding = LedgerFinding(
        "r1-1",
        "risk",
        "packages/engine/src/example.ts",
        42,
        "Synthetic contract finding",
        "Synthetic evidence; no repository or model data.",
        status or "open",
        ("test/model",),
    )
    findings = (finding,) if status else ()
    ledger = Ledger(2 if mode == "verify" else 1, findings, sha, "9b1e3d99671f")
    collected = CollectedReview(
        pr_number=pr,
        title="Synthetic contract fixture",
        body="",
        head_sha=sha,
        base_ref="main",
        head_ref="test",
        mode=mode,
        plan=DiffPlan("full-pr", "full-pr", None, sha, None),
        truncation=Truncation("diff", False, 4, 4, 300),
        policy_base_sha="b" * 40 if name.endswith("-policy") else "",
        review_policy=ResolvedPolicy(
            "b" * 40, "code", "standard",
            (PolicyFile("REVIEW.md", "c" * 40, "Synthetic contract guidance.",
                        ("packages/engine/src/example.ts",)),),
            (), ("packages/engine/src/example.ts",), "d" * 64,
        ) if name.endswith("-policy") else None,
    )
    issues = (
        [
            MergedIssue(
                finding.title,
                finding.evidence,
                "risk",
                finding.file,
                finding.line,
                list(finding.models),
                finding.id,
            )
        ]
        if status == "open"
        else []
    )
    body = publish.render_review(
        collected=collected,
        lanes=[LaneResult(SCHEMA_VERSION, True, "test/model", [], None)],
        issues=issues,
        verdict="issues" if issues else "clean",
        run_url=url,
        hidden_marker=_encode(ledger, list(findings), repo=repo, pr_number=pr),
        round_lines=["### Round 2 resolution", "", "- No prior findings were open."]
        if mode == "verify"
        else None,
    )
    cases.append({"name": name, "accepted": not bool(issues), "body": body})

Path(__file__).with_name("openrouter-producer.json").write_text(
    json.dumps({"producerSha": PRODUCER, "cases": cases}, indent=2) + "\n",
    encoding="utf-8",
    newline="\n",
)
