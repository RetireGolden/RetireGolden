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
     edit a copy in place. Repo-specific facts, including the repo admin's
     identity and which checks the repo gates, live in the "Repo-specific"
     section after the end marker, never inside the block. -->

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
  once onto its own base (`main`, or the parent branch for a stacked child)
  immediately before its review, and hold the next PR (or at least its review
  dispatch) until the one ahead has merged. Parallel coding in separate
  worktrees is fine; parallel review rounds on shared files are not.

### Automated review

- Opening or pushing to a PR runs the OpenRouter code-review workflow
  (`.github/workflows/openrouter-code-review.yml`). Wait for it to finish.
  Fix valid findings, reply to incorrect ones with evidence, resolve only the
  threads you fixed, and push fixes to the same branch. Claude Code sessions
  use the `/needful` skill when it is available; otherwise, and for every
  other tool, follow those same steps by hand.
- A PR is review-clean only when a completed review reports the PR's current
  head SHA and **Verdict:** `clean`. A skipped run, or a verdict carried
  forward from an older SHA, does not count. Every new commit resets this.
- Push-triggered runs verify the latest commit against the existing review
  ledger. A manual `workflow_dispatch` re-reviews the entire PR and generates
  a fresh set of findings. Dispatch when the current head has no completed
  review of its own: no run started after a few minutes, or the run ended
  skipped or errored without posting a verdict (the seed case for a PR whose
  first pass never completed). Never dispatch on top of a completed review of
  the same SHA.

### CI and the `run-ci` label

- Some repos gate expensive jobs behind the exact `run-ci` label (see
  "Repo-specific" below). Where they do, add the label only after the PR is
  review-clean, then confirm the gated jobs actually ran (not skipped) for the
  current head. Never add it early to get CI going.
- Before merge, every check the repo expects for the latest commit must be
  present and successful: gated jobs, ungated jobs, security scans, and
  path-triggered checks when their paths were touched (a path-triggered check
  that never fires is not a missing check). A later fix invalidates prior
  results: review-clean and green CI must both hold for the same head SHA.

### Merging

- Squash-merge is the repository admin's call, and the admin has granted it
  as a standing rule (this replaces the earlier "do not merge unless asked"
  rule). The admin is named in "Repo-specific" below. An agent session may
  squash-merge, with admin bypass where the repo needs it, only when all of
  the following hold: `gh auth status` shows the session is
  authenticated as that admin account; the head is review-clean; every check
  the repo expects is green for that head; and every review thread is
  resolved. The bypass exists solely to clear ruleset conditions an
  agent-authored PR cannot satisfy on its own (a required post-push approval
  by someone other than the pusher, and the CLA check where it blocks
  agent-authored commits). It is never used to skip thread resolution, or to
  get past an absent, skipped, pending, or failing review, security, or CI
  check.
- A session authenticated as anyone else stops at an open, review-clean PR.
  It does not merge and does not ask for the bypass.
- No publish, release, or tag unless the user asked for that activation step.

### Conduct

- Never @-mention a guessed GitHub handle in PR comments or replies. On a
  public repo, a guessed handle pings a stranger, and the notification cannot
  be retracted. Do not derive handles from git author names; use only the
  handles named in "Repo-specific".
- Never add `cursoragent` or any other shared tool account to a CLA
  allowlist. Never edit `.github/workflows/cla.yml` for any reason: it is a
  `pull_request_target` workflow with write permissions and a PAT, and
  changes to it are the admin's alone.
- Delegate mechanical loops (review-fix rounds, rebases, check watches) to
  subagents where the tool supports them. Every rule in this file binds a
  subagent as well: a subagent never merges, dispatches a release or
  production workflow, or edits CI or CLA workflows on its own. Verify each
  subagent's report against live GitHub state (head SHA, verdict, unresolved
  threads, gated jobs) before acting on it.

<!-- rg-shared-agent-rules:end -->

## Repo-specific

- Repository admin: @FlyOverCoderKY.
- Ruleset facts below were verified 2026-09-03 with
  `gh api repos/RetireGolden/RetireGolden/rules/branches/main`; re-run it
  when in doubt, the live ruleset wins over this text.
- `run-ci` is required here. The `lint`, `test`, `e2e`, `build`, and ZAP
  (`ZAP DAST / ZAP Baseline`) jobs run only with the label and are required
  checks on `main`; an unlabeled ZAP result is a skip and does not satisfy
  the check. Semgrep (`Scan (p/default)`), `CLA`, and the first-pass review
  gate (`review / openrouter-first-pass-gate`) run without the label. The resolve gate is path-triggered (workspace
  manifest, lockfile, or any `package.json`) and is expected only on PRs
  that touch those files.
- `main` also requires every review thread resolved and a post-push approval
  by someone other than the pusher. Resolve the threads yourself; the
  post-push approval is the rule the admin bypass clears for agent-authored
  PRs. CLA currently passes for the admin's own commits, so it is not what
  the bypass is for here.
