# CI/CD and deployment

How RetireGolden builds, tests, and ships. RetireGolden is a **static single-page app** (Vite build →
`app/dist/`) hosted on **Azure Static Web Apps (SWA)** and deployed by **GitHub Actions**. There is
no server and no backend — "deploy" means uploading static files to a CDN.

**Production:** [https://retiregolden.app/](https://retiregolden.app/)

## The pipeline

One workflow drives build + deploy:
[`.github/workflows/azure-static-web-apps-retiregolden.yml`](../../.github/workflows/azure-static-web-apps-retiregolden.yml).
It triggers on push to `main` and on `opened`, `synchronize`, `reopened`, and `closed` pull-request
events targeting `main`. On a same-repository PR,
the lightweight `authorize` job reads **live** PR state before any checkout: it requires the current head,
the `run-ci` label, and an exact-head clean OpenRouter review ledger. An unauthorized run therefore stays
cheap and its expensive jobs report skipped (see [Label-gated PR CI](#label-gated-pr-ci) below).

```
authorize ─┬─► lint ─────┐
           ├─► test engine ─┐
           ├─► test planner-ui ─┼─► test ─┐
           ├─► test web ──────┘          ├─► deploy ─► dast (PR only)
           ├─► e2e ──────────────────────┤
           └─► build ────────────────────┘
```

| Job | Runs | What it does |
|-----|------|--------------|
| `authorize` | push + non-closed PR events | API-only live-state gate. Pushes to `main` pass; same-repo PRs must be open, unchanged at the event head, carry `run-ci`, and have the trusted exact-head clean OpenRouter ledger. Unlabeled first attempts remain cheap placeholders; requested paths fail closed. Forks do not pass; manual recovery and same-repository Dependabot use `run-ci` followed by a rerun of the existing exact-head Azure workflow. |
| `lint` | authorized push/PR | root `pnpm install --frozen-lockfile` then `pnpm lint` (ESLint in `packages/engine`, `packages/planner-ui`, and `app`) |
| `test engine`, `test planner-ui`, `test web` | authorized push/PR, in parallel | Each workspace runs its own `test:coverage`, retaining its own coverage threshold. The fail-closed aggregate check is still named **`test`** for Main Guard. |
| `e2e` | authorized push/PR | Playwright browser layout tests (`pnpm test:e2e`) in `app/` |
| `build` | authorized push/PR, in parallel with lint/tests/e2e | root `pnpm build`, then the third-party notices drift and both package pack-smoke checks; uploads `app/dist` as the `dist` artifact |
| `deploy` | every authorized prerequisite succeeds; skipped on PR close | the all-gates barrier: downloads `dist`, deploys via `Azure/static-web-apps-deploy@v1` with `skip_app_build: true`, `app_location: app/dist`; exposes the deployed URL as `preview_url` |
| `dast` | PR only; needs `authorize` and `deploy` | OWASP ZAP baseline scan of the freshly deployed authorized same-repository PR preview URL — see [security-scanning.md](security-scanning.md). On unauthorized PRs it still invokes `zap.yml` with an empty URL (the scan job skips itself) so the required nested check reports as skipped instead of hanging on "Expected" |
| `close_pull_request` | PR close | tears down the SWA preview environment |

CI uses **Node 24**, set up by the shared composite `.github/actions/setup-toolchain` (pnpm from the
`packageManager` pin plus `actions/setup-node` with the pnpm store cache; the deploy job passes `pnpm: 'false'`
and the fresh-resolve gate `cache: 'false'`); the workspaces require **Node ≥ 24.15.0**. Dependencies install
once at the repo root (`pnpm install --frozen-lockfile` against the root `pnpm-lock.yaml` — the repo is a pnpm workspace).
Semgrep SAST runs as a separate workflow on every push/PR — deliberately **not** label-gated, because the
scan is cheap and it is a Main Guard required check (also in [security-scanning.md](security-scanning.md)).

## Label-gated PR CI

To keep Actions minutes down, PR pushes do **not** run the expensive pipeline by default — review bots can
iterate without every commit running lint/test/e2e/build/deploy/DAST. The trusted default-branch
[`openrouter-ci-broker.yml`](../../.github/workflows/openrouter-ci-broker.yml) automatically adds
`run-ci` only after a successful OpenRouter run is associated with exactly one open same-repository PR to
`main`, whose live head still equals the run SHA and whose `github-actions[bot]` review has bot id
`41898282`, type `Bot`, the decoded clean ledger, these production Markdown fields, and that run's exact
URL. The lane section is intentionally variable-length:

```
## OpenRouter pull-request review
<!-- openrouter-review-ledger:v1:<canonical base64 JSON> -->

**Verdict:** `clean`
**Scope:** `<review scope>`
**Mode:** `<review mode>`
**Commit:** `<40-character SHA>`
... production lane report ...
[Workflow run](https://github.com/RetireGolden/RetireGolden/actions/runs/<id>)
```

The marker JSON must have ledger version `1`, this repository, PR number, head SHA, a 12-character
generation id, a positive round, and a `findings` array that is either empty or contains only valid
`disputed` entries with zero `open` findings (a clean **Verdict** therefore means no open findings,
not necessarily an empty ledger). Ledger finding states are only `open` and `disputed`; a `fixed`
resolution removes the entry rather than storing a settled state. Both authorization paths also prove the
successful `pull_request` review run came from the same repository and that its caller workflow blob at
the reviewed head exactly equals the caller blob on the default branch. They read GitHub APIs only and
never check out or execute PR code.

#### Review continuity on manual reruns

The pinned reusable workflow now treats manual dispatch as a full-PR recheck
that retains the existing ledger, finding IDs, and rebuttals. It requires both
file coverage and finding resolutions. With no ledger it seeds an initial
review. `reset_review: true` explicitly starts a new initial review; leave it
false for ordinary manual rechecks. Caller-pin migrations use the dedicated
`openrouter-review-recovery.yml` workflow described below, which has no reset
input. Pushes retain latest-commit verification scope.
Do not dispatch redundantly over a completed exact-head review.

Agents must paginate reviews, inline comments, and issue comments, and read
every continuation part of a multipart review. The first API page or first
published part can omit the latest verdict or remaining findings.

#### Ledger producer contract

The embedded ledger is produced by the pinned upstream review action
[`FlyOverCoderKY/openrouter-pr-review-action@93cc91130605bc17cb583c5a5e899591773e048c`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/tree/93cc91130605bc17cb583c5a5e899591773e048c).
RetireGolden authorization validates decoded markers against that producer, not a vendored copy:

| Contract | Source |
|----------|--------|
| Finding decode (`id`, `sev`, `file`, `line`, `title`, `ev`, `st`, `m`) | [`loop.py` `_decode_finding`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/loop.py#L476-L516) |
| Safe relative paths for `file` | [`schema.py` `valid_review_path`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/schema.py#L269-L271) is a three-line compatibility predicate delegating to [`normalize_review_path`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/schema.py#L244-L266); its length limit is [`MAX_FILE = 500`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/schema.py#L26). |
| Round state: `fixed` removes an entry; `disputed` is carried; open counts | [`loop.py` `apply_round`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/loop.py#L193-L288) (including `open_issue_count`) |
| Ledger encode/decode envelope | [`loop.py` `_encode`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/loop.py#L374-L398) / [`_decode`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/loop.py#L435-L473) |

These function spans were checked against the source at the linked immutable action revision.
The path predicate's short span is intentional: normalization contains the validation logic.
When advancing the action, verify the new source spans as well as the producer revision;
the local contract test checks revision consistency across the caller, helper comments and this table.
The SHA checks treat links in this runbook as active pins. Historical full-SHA citations belong in a
separate history document, or require deliberately narrowing the guard when adding that history here.
The caller's action reference is read only from the active `uses:` line, so its historical pin notes
may name other action revisions. Guards recognize the documented action references and GitHub
`blob`/`tree` links; bare SHAs in prose remain subject to review, not a claim of exhaustive detection.

The current caller uses the [shared configuration from organization PR #39](https://github.com/RetireGolden/.github/blob/a6a690b82fa76bbda4334b87dd179551534d183b/.github/workflows/openrouter-code-review.yml) and enables
`review_policy: base`. Root and nested `REVIEW.md` guidance comes from the immutable target-branch
tip and is frozen before model calls. A policy proposed by the PR begins affecting reviews only
after merge. The standing Grok/GLM roster and Luna merge judge are unchanged; the expired Astra
trial is no longer evaluated. Model budgets and CI authorization remain workflow-owned.

At this producer revision, `loop.py` and `schema.py` are unchanged from the previous approved
producer. The existing ledger and safe-path predicates therefore remain unchanged locally.
Policy source/digest receipt fields follow the existing positional header; offline tests using
actual producer output confirm clean-ledger acceptance and open-finding rejection in both CI
consumers. The review publication context is v2; the findings ledger remains v1.

- The broker serializes review/Azure completion events for a head, finds the newest eligible skipped Azure
  `pull_request` run before it mutates the PR, rechecks live PR state, adds `run-ci`, rechecks again, then
  reruns that run through the Actions API. It does nothing when live work is queued/running or a
  current-head Azure run has already performed a non-skipped expensive job. For manual recovery and
  same-repository Dependabot, apply `run-ci`, then rerun the existing exact-head Azure workflow; the label
  alone does not start CI, and the live authorization gate remains authoritative.
- A rerun deliberately ignores its frozen event labels. `authorize` re-reads the live PR, label, review,
  and head immediately before releasing checkout jobs; a head race fails closed. Fork PRs never authorize
  or deploy. The broker never auto-reruns Dependabot PRs.
- **Without the label**, the gated jobs report as **skipped**. Skipped checks *satisfy* the Main Guard
  required checks, so always apply `run-ci` (and let CI go green) **before merging** — a merge without
  the label lands on `main` unvalidated (the push-to-`main` run will still catch it, but after the fact).
- **Semgrep is exempt**: it runs on every PR push regardless of the label, so the SAST required check is
  always a real result. It's a cheap CLI scan — the label gate covers the expensive pipeline only.
- **The resolve gate is also exempt**: [`resolve-gate.yml`](../../.github/workflows/resolve-gate.yml)
  runs ungated on PRs touching `pnpm-workspace.yaml`, `pnpm-lock.yaml`, or any `package.json` (plus
  weekly and on dispatch). It deletes the lockfile and re-resolves from scratch, because every other
  job's `--frozen-lockfile` install skips resolution and therefore the workspace supply-chain gates
  (`trustPolicy`, `minimumReleaseAge`, `blockExoticSubdeps`); it also fails when a `trustPolicyExclude`
  entry no longer appears in a fresh resolve, so stale exemptions surface instead of standing as
  silent trust waivers. Like Semgrep, it's a ~1-minute job.
- The Azure Static Web Apps and Semgrep workflows also **cancel in-progress PR runs** when a newer commit is
  pushed (concurrency groups), so rapid-fire pushes only pay for the latest commit. Pushes to `main` are never cancelled.

The trust boundary is explicit: GitHub review objects do not expose which workflow created them. The broker
therefore admits only same-repository PRs and trusts the write-capable repository workflows on the default
branch, plus the pinned reusable review workflow they invoke. The Markdown workflow URL is an identifying
link, not cryptographic provenance; a signed central artifact or ledger would be future hardening.

For operational recovery, a maintainer may dispatch the review workflow, apply `run-ci`, then rerun the existing
exact-head Azure workflow. The dispatch
run may report `main` as its `head_sha`; authorization accepts it only when an exact-head bot review contains
the canonical ledger link, the fetched run passes the same workflow/repository/caller-blob checks, and the
run succeeds. The human label and exact-head Azure rerun remain required after dispatch; the broker never
auto-labels or reruns a Dependabot PR.

For a caller-pin migration with an existing review ledger, use
`gh workflow run openrouter-review-recovery.yml --ref main -f pr_number=<PR>`.
This dedicated workflow runs explicit verify mode instead of restarting the initial review.
It retains the ledger but examines the full PR, including when that ledger already names
the current head. Earlier commits are not omitted based on the prior ledger. It refuses forks and
closed PRs, uses a pinned action against the resolved PR head, and fails
unless verification reports `clean`; the action refuses verification without an existing ledger.
Normal pull-request review and first-pass gates are unchanged.

The recovery workflow uses the same action producer as the regular caller in the table above. Its
[`_resolve_loop` guard](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/93cc91130605bc17cb583c5a5e899591773e048c/src/or_pr_review/cli.py#L701-L743)
rejects verify mode without an existing ledger. Recovery fixes the baseline Grok/GLM lanes and Luna
judge locally, with the existing follow-up
budget of low effort, 30 tool turns and 600 KB. It changes coverage to full PR and retains prior
ledger decisions; it does not claim to be an independent first-pass review or inherit future central
model or budget changes. Recovery also loads target-branch REVIEW.md guidance. Changes to these
workflow choices require review and a new workflow blob pin.

Wait for other reviews before dispatching. Recovery rejects active ordinary reviews of the target
head before invoking the action. CI additionally refuses a recovery created before an ordinary
exact-head review completed, including an ordinary run that later posts issues; dispatch a new
recovery after all reviews finish in that case. Ordinary follow-up jobs share recovery's concurrency
group. Off-default dispatches fail explicitly and cannot authorize CI.

CI admits this recovery only when its workflow ID matches GitHub's registered recovery workflow,
the dispatch came from the default branch in this repository, and the workflow files at both the
run commit and current default branch match the helper's pinned recovery Git blob SHA. The usual
exact-head bot ledger, successful-run, live-label and PR-state checks still apply. After recovery,
apply `run-ci` and rerun the existing exact-head Azure workflow, then wait for every required job.
The broker does not initiate this recovery or grant CI automatically from it. When changing the
recovery workflow, update its blob pin in the helper and the helper's Azure bootstrap pin together.

## Build and SPA routing

- The web app lives under **`app/`** (the engine package under `packages/engine/`); production output
  is **`app/dist/`**.
- The deploy action uses `skip_app_build: true` — the action uploads the already-built `app/dist`
  rather than building inside Azure.
- SPA deep links (e.g. `/plan/...`, `/learn/...`) are served by a navigation fallback in
  [`app/public/staticwebapp.config.json`](../../app/public/staticwebapp.config.json) (Vite copies it into
  `app/dist/`), which rewrites unknown paths to `/index.html`. A regression test guards it:
  [`app/src/staticwebapp.config.test.ts`](../../app/src/staticwebapp.config.test.ts).
- `app/public/import-feature.json` is an intentionally non-precached, no-store production switch. Setting
  its sole `enabled` value to `false` in a reviewed deploy disables the web new-plan wizard, broker CSV
  refresh, mySSA XML import, and FedInvest CSV fallback on the next online refresh/restart; restoring `true`
  re-enables them. Invalid or missing config fails closed. This does not affect a tab that is already loaded
  or an offline desktop package. After either change, rehearse all four surfaces plus RetireGolden backup
  restore in the deployed environment before closing the incident action.

## Secrets and environments

- **`AZURE_STATIC_WEB_APPS_API_TOKEN`** — the SWA deployment token (the only deploy secret). ZAP and the
  PR comment use the built-in `GITHUB_TOKEN`.
- Azure creates a **fresh preview environment per PR** (a unique `*.azurestaticapps.net` URL); the `dast`
  job reads that URL dynamically from the deploy job's output. Pushing to `main` deploys production.

## Branch protection

The **"Main Guard"** ruleset on `main` requires the security checks and the
independent `review / openrouter-first-pass-gate` review context to pass before
merge. Required contexts are coupled to job/display names — see
[security-scanning.md](security-scanning.md) §5 before renaming any job.

## Local commands

From the repo root: `pnpm dev` (Vite dev server), `pnpm build` (type-check + production build),
`pnpm test` (Vitest, all workspaces), `pnpm lint` (ESLint, all workspaces). From `app/`:
`pnpm preview` (serve the built `dist/`).

## Package releases

[`publish-engine.yml`](../../.github/workflows/publish-engine.yml) publishes `packages/engine` to npm
as **`@retiregolden/engine`** (`npm publish --access public --provenance`). It fires on `engine-v<version>`
tags — the tag must match `packages/engine/package.json` — or manually via workflow_dispatch (manual runs
default to `--dry-run`). It authenticates via **npm Trusted Publishing (OIDC)** — no long-lived token:
the package on npmjs.com is configured with a trusted publisher pinned to this repo and workflow file, and
the job exchanges GitHub's OIDC token (`id-token: write`) for short-lived publish credentials, generating
provenance automatically. OIDC requires npm ≥ 11.5.1, so the workflow upgrades npm before publishing.

The publish job runs in the **`npm-publish`** GitHub environment, which requires manual reviewer approval
before any of its steps run — this includes manual `workflow_dispatch` dry-runs, which also pause for
approval. A separate ungated `guard` job forces `workflow_dispatch` runs to `--dry-run`, so an approved
dispatch can only ever rehearse; a real release must come from a version-matched `engine-v*` /
`planner-ui-v*` tag push. The `npm-publish` environment is shared by both package workflows; its
deployment-branch policy allows the `engine-v*` and `planner-ui-v*` tag patterns plus `main`.

[`publish-planner-ui.yml`](../../.github/workflows/publish-planner-ui.yml) is the same pipeline for
`packages/planner-ui` → **`@retiregolden/planner-ui`**, firing on `planner-ui-v<version>` tags. Its
pack-smoke step installs the packed tarball into a scratch Vite consumer and builds it, proving the
exports map, the dep-internal worker chunks, and the HiGHS wasm for external consumers. It uses the same
OIDC trusted-publishing flow — its own trusted publisher must be configured for this package on npmjs.com.

## Run on a new host / fork

1. Create an Azure **Static Web App** (deployment source: GitHub; build preset: Custom).
2. Add the **`AZURE_STATIC_WEB_APPS_API_TOKEN`** repo secret Azure generates, and enable Actions.
3. Push to `main` — the workflow builds `app/dist` and deploys it. Confirm a hard-refresh on a deep link
   does not 404 (proves the SPA fallback). Optionally bind a custom domain in the SWA resource.
