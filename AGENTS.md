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

- Squash-merge is the repository admin's call. The admin, and whether the
  admin has recorded a standing merge grant for this repository, are stated
  in "Repo-specific" below. Where no grant is recorded, every session stops
  at an open, review-clean PR.
- Where a grant is recorded, an agent session may squash-merge only when all
  of the following hold: `gh auth status` shows the session is authenticated
  as that admin account; the head is review-clean; every check the repo
  expects is green for that head; and every review thread is resolved.
- Admin bypass is used only to clear ruleset conditions an agent-authored PR
  cannot satisfy on its own (a required post-push approval by someone other
  than the pusher, and the CLA check where it blocks agent-authored
  commits), and only in a repository whose "Repo-specific" section says
  those conditions exist. It is never used to skip thread resolution, or to
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
  allowlist. Never edit `.github/workflows/cla.yml`: it is a
  `pull_request_target` workflow with write permissions and a PAT. No agent
  session edits it, admin-authenticated or not; the admin changes it by
  hand.
- Delegate mechanical loops (review-fix rounds, rebases, check watches) to
  subagents where the tool supports them. Every rule in this file binds a
  subagent as well. A subagent never merges, dispatches a release or
  production workflow, or edits CI or CLA workflows, even when the parent
  session asks it to; those actions stay with the orchestrating session.
  Verify each subagent's report against live GitHub state (head SHA,
  verdict, unresolved threads, gated jobs) before acting on it.

<!-- rg-shared-agent-rules:end -->

## Repo-specific

- With this repository's review-continuity workflow pin, an ordinary manual
  dispatch reviews the full PR **without resetting** existing finding IDs,
  ledger decisions, or rebuttals. This supersedes the older-pin dispatch
  behavior described in the shared section. Profile reviews require
  `reset_review: false`; discarding history with `true` is rejected. Do not
  repeat an ordinary `auto` dispatch on an already-reviewed head. An intentional
  maintainer `deep` request is the specific exception described below.
- Poll all pages of reviews, inline comments, and issue comments. Read every
  continuation part of a large review, and match the explicit reviewed SHA
  and bot identity before deciding that a head is reviewed or clean.

- Repository admin: @FlyOverCoderKY.
- Merge grant: standing, recorded by @FlyOverCoderKY on 2026-09-02 (PR
  #588). In this repository, administrative override is permitted only for
  an agent-authored CLA restriction. This supersedes the broader bypass
  language in the shared section; post-push approval must actually be met.
- The required-check list and the thread and approval rules below were
  read from the live ruleset on 2026-09-03 with
  `gh api repos/RetireGolden/RetireGolden/rules/branches/main`. Re-run it
  when in doubt; the live ruleset wins over this text. Which jobs the label
  gates, and which checks are path-triggered, come from the workflow files,
  not the ruleset.
- `run-ci` is required here. `authorize` is the required live gate; `lint`,
  `test`, `e2e`, `build`, and ZAP (`ZAP DAST / ZAP Baseline`) run only after
  it authorizes the label-gated path and are required checks on `main`. GitHub
  counts a skipped required check as satisfied,
  which is why the shared rule demands that the gated jobs actually ran:
  an unlabeled ZAP skip is not acceptable evidence here even though the
  ruleset would let it through. Semgrep (`Scan (p/default)`), `CLA`, and
  the first-pass review gate (`review / openrouter-first-pass-gate`) run
  without the label. The broker normally adds `run-ci` after an exact-head
  clean review and reruns the existing exact-head Azure workflow. For manual
  recovery and same-repository Dependabot PRs, apply `run-ci`, then rerun that
  Azure workflow; the label alone does not start CI. The resolve gate is path-triggered (workspace
  manifest, lockfile, or any `package.json`) and is expected only on PRs
  that touch those files.
- For a caller-pin migration with a seeded review ledger, the dedicated
  `openrouter-review-recovery.yml` may be dispatched from `main` after other
  review runs finish, even when a completed review exists for that head. It
  verifies the full PR while retaining the ledger; it does not restart the
  initial review. This is an exception specifically to "Never dispatch on top of
  a completed review of the same SHA" in the shared Automated review section;
  the ordinary review workflow must not be dispatched to perform this recovery.
  A clean successful recovery, `run-ci`, and an exact-head Azure rerun
  are still required before merge. See the CI/CD runbook for provenance checks.
- `main` also requires every review thread resolved and a post-push approval
  by someone other than the pusher. Resolve the threads yourself and obtain
  the qualifying approval; never use the administrative override to bypass
  it. CLA currently passes for the admin's own commits.


### Current review profile workflow

- The caller now enables organization profiles. Earlier `reset_review: true` guidance applies only to legacy callers; profile reviews require `false` and retain findings.
- Use `review_level: deep` on a default-branch manual dispatch to request extra review; `cancel` cancels only a manual pending request. A fresh deep request needs its own successful required lanes, even if this head already has an older clean deep review.
- An intentional deep request on an already reviewed head is an exception to the shared rule against redundant same-head dispatches. Wait for that request's required lanes and current profile proof before treating the head as review-clean or authorizing CI.
- Check `OpenRouter profile completion` and the `openrouter-profile` status for the current head in addition to the existing review and CI requirements. The profile gate rechecks current base policy. A missing/failed required lane or pending deep request is not clean.
- Profile evidence is bounded to PRs younger than 25 days. For older work, open a replacement PR; do not bypass the profile gate or delete request evidence.
- Recovery now forwards to the normal trusted review workflow on `main`. Wait for that review and its profile completion; the forwarding run does not publish a review itself. The existing caller-pin migration procedure applies until this revision is on `main`.
