# RetireGolden — standing agent rules

Public AGPL-3.0 repository. The published packages are
[`@retiregolden/engine`](packages/engine) and
[`@retiregolden/planner-ui`](packages/planner-ui).

## Ground truth

Engineering ground truth lives in [DOCS/README.md](DOCS/README.md). Read
[DOCS/standards.md](DOCS/standards.md) before changing code. Read
[PRODUCT.md](PRODUCT.md) and [DESIGN.md](DESIGN.md) before UI work.

Docs before code. Do not invent tax, statute, or product behavior. If Docs
and code disagree on tax, statute, or product behavior, stop — do not invent
a side. If a doc is stale relative to already-decided implementation, follow
[DOCS/README.md](DOCS/README.md) and [DOCS/standards.md](DOCS/standards.md)
and fix the doc to match the code.

## Bidirectional correctness

Research → Rules (`DOCS/domain` + the per-domain record modules in
`packages/engine/src/rules/records/`, composed by
`packages/engine/src/rules/taxRuleRegistry.ts`) → discriminating unit tests
→ calculator/code.

Reverse: find code missing tests, or tests missing ground-truth rules.

A calculation change is incomplete unless a unit test covers it, and that
test's expected value is not taken from reading the new code. The authority
is a citable source — statute subparagraph plus what it requires, IRS pub,
or `DOCS/domain`. The fixture form may be a hand worksheet, official
worksheet, or documented external oracle of that source (see
[DOCS/testing.md](DOCS/testing.md)); an oracle number with no citation
still does not count. The fixture has to discriminate between plausible
readings. Unsettled stays disclosed. Out of scope fails closed.

## Invariants

- Money math stays in the engine. The UI never recomputes dollars.
- New UI uses existing tokens and component classes
  (`packages/planner-ui/src/index.css`); keep light and dark themes in parity.

## Tooling

pnpm + Corepack. Run `corepack enable` before the first `pnpm` command.

<!-- rg-shared-agent-rules:start -->
<!-- This block is identical in every RetireGolden org repo (RetireGolden,
     RetireGolden-MCP, RetireGolden-Pro, retiregolden.org). The canonical copy
     is RetireGolden/AGENTS.md. Change it there and re-sync the others; do not
     edit a copy in place. Repo-specific facts go in the section after the
     end marker, never inside the block. -->

## Pull requests, reviews, and merging (shared across the org)

These rules bind every agent working in any RetireGolden repository: Claude
Code, Codex, Cursor, the Grok and OpenRouter review bots, and any other tool.

### Opening PRs

- Ready for review, never drafts. Prefer one PR per repo per phase when the
  changes belong together. Follow-up work for an open PR stays on that PR's
  branch.
- Stacks are allowed when they are explicit: base each child PR on the
  preceding branch, describe the stack and merge order in every PR, and merge
  from the bottom up. After a parent is squash-merged, rebase the child's
  unique commits onto the updated base (retargeting the PR alone is not
  enough), push the rewritten head, and repeat the review and CI gates below.
- Work the queue serially: one PR in automated review at a time. Rebase it
  once onto the base branch immediately before its review, and hold the next
  PR (or at least its review dispatch) until the one ahead has merged.
  Parallel coding in separate worktrees is fine; parallel review rounds on
  shared files are not.

### Automated review

- Opening or pushing to a PR runs the OpenRouter code-review workflow
  (`.github/workflows/openrouter-code-review.yml`). Wait for it to finish.
  Fix valid findings, reply to incorrect ones with evidence, resolve only the
  threads you fixed, and push fixes to the same branch. Claude Code sessions
  do this with the `/needful` skill; other tools follow the same steps.
- A PR is review-clean only when a completed review reports the PR's current
  head SHA and **Verdict:** `clean`. A skipped run, or a verdict carried
  forward from an older SHA, does not count. Every new commit resets this.
- Push-triggered runs verify the latest commit against the existing review
  ledger. A manual `workflow_dispatch` re-reviews the entire PR and generates
  a fresh set of findings. Dispatch only when a push has produced no run for
  the head after a few minutes; never on top of a completed run for the same
  SHA.

### CI and the `run-ci` label

- Some repos gate expensive jobs behind the exact `run-ci` label (see
  "Repo-specific" below). Where they do, add the label only after the PR is
  review-clean, then confirm the gated jobs actually ran (not skipped) for the
  current head. Never add it early to get CI going.
- Before merge, every expected check for the latest commit (gated, ungated,
  security scans, resolve gates) must be present and successful. A later fix
  invalidates prior results: review-clean and green CI must both hold for the
  same head SHA.

### Merging

- Squash-merge is the repository admin's call. When the repo admin (Nathan)
  is operating the agent session, that session may squash-merge with admin
  bypass once the head is review-clean, all expected checks are green, and
  every review thread is resolved. The bypass exists solely to clear the CLA
  and last-push-approval rules that block agent-authored commits. It is never
  used to get past an absent, skipped, pending, or failing review, security,
  or CI check.
- Any other contributor's agent stops at an open, review-clean PR. It does
  not merge and does not ask for the bypass.
- No publish, release, or tag unless the user asked for that activation step.

### Conduct

- Refer to Nathan in plain text in PR comments and replies. Never @-mention a
  guessed GitHub handle; on a public repo that pings a stranger.
- Never add `cursoragent` or any other shared tool account to a CLA
  allowlist, and never edit `.github/workflows/cla.yml` to do so.
- Delegate mechanical loops (review-fix rounds, rebases, check watches) to
  subagents where the tool supports them. Verify each subagent's report
  against live GitHub state (head SHA, verdict, unresolved threads, gated
  jobs) before acting on it.

<!-- rg-shared-agent-rules:end -->

### Repo-specific

- `run-ci` is required here. The `lint`, `test`, `e2e`, and `build` jobs run
  only with the label and are required checks on `main`, alongside Semgrep
  (`Scan (p/default)`), ZAP, CLA, and the first-pass review gate. Semgrep and
  the resolve gate run without the label.
- `main` also requires every review thread resolved and a post-push approval
  by someone other than the pusher. Those two rules, plus CLA, are what the
  admin bypass clears for agent-authored PRs.
