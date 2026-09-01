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

## Pull requests

- Ready for review, never drafts.
- Prefer one PR per repo per phase when the changes belong together. Multiple
  PRs in the same repo are allowed when they form an explicit stack: base each
  child PR on the preceding branch, describe the stack and merge order in every
  PR, and merge the stack from the bottom up. Follow-up work for an open PR
  stays on that PR's branch.
- Opening or updating a PR starts the automated code-review action. Wait for it
  to finish, inspect its findings, and follow the `/needful` skill to triage and
  address them. Commit and push valid fixes to the same PR branch; the review
  action will run again for the new commit. Repeat until the newest review
  reports **Verdict:** `clean`.
- In this repo, add the exact `run-ci` label only after the PR has a clean
  review. Watch the gated CI pipelines to completion and fix any failures. A
  later fix invalidates the prior result: require both a clean review of the
  latest commit and green CI for the latest commit before merging.
- Merge completed PRs with `gh pr merge --squash --admin`. For a stacked PR,
  after its parent merges, rebase or retarget the child onto the updated base
  and repeat the review and `run-ci` validation before merging it. The admin
  override may bypass the agent-authored CLA restriction; never use it to skip
  a pending or failing review or CI check.
- No publish, release, or tag unless the user asked for that activation step.
- Never add `cursoragent` to the CLA allowlist. Do not modify
  `.github/workflows/cla.yml` to allowlist shared Cursor accounts.
