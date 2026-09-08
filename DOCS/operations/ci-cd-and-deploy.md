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
the `run-ci` label, an exact-head clean OpenRouter review ledger, and a successful trusted
`openrouter-profile` completion status for that head. An unauthorized run therefore stays
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
| `authorize` | push + non-closed PR events | API-only live-state gate. Pushes to `main` pass; same-repo PRs must be open, unchanged at the event head, carry `run-ci`, have the trusted exact-head clean OpenRouter ledger, and pass the org profile consumer's `openrouter-profile` proof for that head. Unlabeled first attempts remain cheap placeholders; requested paths fail closed. Forks do not pass; manual recovery and same-repository Dependabot use `run-ci` followed by a rerun of the existing exact-head Azure workflow. |
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
`run-ci` only after independently validating an eligible open same-repository PR to `main`.
Review, profile-completion, and Azure completion events, plus explicit default-branch
`workflow_dispatch` recovery with a completed profile `source_run_id`, wake a sweep; the event SHA
is not assumed to be a PR head. For each eligible live head, the `github-actions[bot]` review must
have bot id `41898282`, type `Bot`, the decoded clean ledger, these production Markdown fields,
the provenance-valid review run's exact URL, and a successful trusted `openrouter-profile`
completion status bound to the same head. The lane section is intentionally variable-length:

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
successful review run came from the same repository and that its caller workflow blob at
the run commit exactly equals the caller blob on the default branch. Normal `pull_request` runs
use the reviewed head; trusted `workflow_dispatch` runs use the default-branch commit and must
be linked from the exact-head ledger. They read GitHub APIs only and
never check out or execute PR code.

#### Review continuity on manual reruns

The pinned reusable workflow treats manual dispatch as a full-PR recheck
that retains the existing ledger, finding IDs, and rebuttals. It requires both
file coverage and finding resolutions. With no ledger it seeds an initial
review. `reset_review: true` is rejected for profile reviews — leave it
false so findings are retained. Dispatch `review_level: auto`, `deep`, or
`cancel` from `main`; deep requests stay pending until their own required
lanes succeed and block an older clean review from authorizing CI. Caller-pin
migrations while `main` still carries the legacy recovery workflow use the
dedicated `openrouter-review-recovery.yml` workflow described below. After
that forwarder lands on `main`, recovery dispatches the normal trusted review
instead of running its own review. Pushes retain latest-commit verification
scope. Do not dispatch redundantly over a completed exact-head review.

Agents must paginate reviews, inline comments, and issue comments, and read
every continuation part of a multipart review. The first API page or first
published part can omit the latest verdict or remaining findings.

#### Ledger producer contract

The profile receipt validator accepts retained `disputed` findings in a clean
ledger, matching the review loop and CI consumer. Open findings still block a
clean receipt. This does not resolve GitHub threads or change merge approvals.

The final CI race check ignores matching reviews that completed before trusted
profile proof started. It still blocks every matching active run and any run
completing at or after that time, and validates the authoritative review and
proof against current caller pins. Historical branch-caller audits therefore
do not permanently block a workflow-pin migration.

The embedded ledger is produced by the pinned upstream review action
[`FlyOverCoderKY/openrouter-pr-review-action@212775ffea22e806cddcb706c73a3df26fbcb6d0`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/tree/212775ffea22e806cddcb706c73a3df26fbcb6d0).
RetireGolden authorization validates decoded markers against that producer, not a vendored copy:

| Contract | Source |
|----------|--------|
| Finding decode (`id`, `sev`, `file`, `line`, `title`, `ev`, `st`, `m`) | [`loop.py` `_decode_finding`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/loop.py#L486-L526) |
| Safe relative paths for `file` | [`schema.py` `valid_review_path`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/schema.py#L280-L282) is a three-line compatibility predicate delegating to [`normalize_review_path`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/schema.py#L255-L277); its length limit is [`MAX_FILE = 500`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/schema.py#L26). |
| Round state: `fixed` removes an entry; `disputed` is carried; open counts | [`loop.py` `apply_round`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/loop.py#L196-L298) (including `open_issue_count`) |
| Ledger encode/decode envelope | [`loop.py` `_encode`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/loop.py#L384-L408) / [`_decode`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/src/or_pr_review/loop.py#L445-L483) |

These function spans were checked against the source at the linked immutable action revision.
The path predicate's short span is intentional: normalization contains the validation logic.
When advancing the action, verify the new source spans as well as the producer revision;
the local contract test checks revision consistency across the caller, helper comments and this table.
The SHA checks treat links in this runbook as active pins. Historical full-SHA citations belong in a
separate history document, or require deliberately narrowing the guard when adding that history here.
The caller's action reference is read only from the active `uses:` line, so its historical pin notes
may name other action revisions. Guards recognize the documented action references and GitHub
`blob`/`tree` links; bare SHAs in prose remain subject to review, not a claim of exhaustive detection.

The shared 22-minute review job prioritizes reviewer completion: it reserves 60 seconds total for the tool-free judge, 180 seconds for publication, and a 5-second margin. Review lanes can use roughly 18 minutes, subject to setup time. If judging times out or fails, publication retains the validated lane findings through the deterministic merge fallback.

The [pinned shared workflow](https://github.com/RetireGolden/.github/blob/a190c3d834f2e3048b4eef8129fa3c8e10891aa0/README.md) uses the 180-second HTTP limit for connection/header setup and socket inactivity. Active bodies can finish within the remaining lane-stage deadline; a structured finish uses its whole remaining window before any retry. Timeout diagnostics distinguish connection setup, inactivity, and absolute deadline expiry.

The current caller uses the [shared configuration through organization PR #51](https://github.com/RetireGolden/.github/blob/a190c3d834f2e3048b4eef8129fa3c8e10891aa0/.github/workflows/openrouter-code-review.yml)
with `review_profiles_enabled: true`, `review_policy: base`, and org workflow pin
`a190c3d834f2e3048b4eef8129fa3c8e10891aa0`. Root and nested `REVIEW.md` guidance comes from the
immutable target-branch tip and is frozen before model calls. A policy proposed by the PR begins
affecting reviews only after merge. The `code` profile uses required Grok plus optional GLM;
`review_level: deep` adds required Astra Flex. `REVIEW.md` cannot remove required lanes or name
arbitrary models. Model budgets and CI authorization remain workflow-owned.

The findings ledger remains v1; prepared review context is v3. Offline tests using actual producer
output confirm clean-ledger acceptance and open-finding rejection in both CI consumers.

#### Review profiles and profile completion

Bot-dispatched reviews use an explicit default-branch notification because GitHub
suppresses their downstream `workflow_run` events. The profile caller accepts
`source_run_id`, waits briefly for that review run to finish, and independently
validates its provenance and current receipts. A bot-dispatched profile run then
explicitly wakes the CI broker, which still rechecks the exact-head clean ledger
and trusted proof. Only the final notification job requests Actions write access;
model review jobs retain Actions read access.

If a delivery job fails, use `gh workflow run openrouter-profile-completion.yml
--ref main -f source_run_id=<completed-review-run>` to retry proof delivery. If
proof already completed but the broker did not wake, use `gh workflow run
openrouter-ci-broker.yml --ref main -f source_run_id=<completed-profile-run>`.
Do not repeat the paid review just to deliver a notification. The source ID is a
wake-up hint, never CI authorization; missing evidence still blocks CI. Manual
proof and broker dispatches from feature branches intentionally skip their jobs.


[`openrouter-code-review.yml`](../../.github/workflows/openrouter-code-review.yml) forwards to the
org reusable at `a190c3d834f2e3048b4eef8129fa3c8e10891aa0`. Reviews publish both the v1 ledger
marker and a v1 plan receipt (`<!-- openrouter-review-plan:v1:… -->`) that records the effective
profile, required and successful models, and the authoritative workflow run.

[`openrouter-profile-completion.yml`](../../.github/workflows/openrouter-profile-completion.yml)
invokes the matching org reusable on `workflow_run` completion of OpenRouter code review, on `main`
pushes, and on manual dispatch. Its proof job (`complete / profile #<n> <digest>`) verifies the trusted review artifacts
and current base policy. A separate publish job rechecks the obligations and successful proof
before writing the `openrouter-profile` commit status. Profile artifacts retain 30 days (requests 90 days).

CI authorization and the broker load the org
[`scripts/profile_consumer.mjs`](https://github.com/RetireGolden/.github/blob/a190c3d834f2e3048b4eef8129fa3c8e10891aa0/scripts/profile_consumer.mjs)
at the org workflow pin through `getContent` — it performs GitHub provenance and receipt binding
only, with no policy parsing or artifact downloads in the consumer itself. `authorizeProfileReceipt`
requires an exact-head trusted bot review with a satisfied clean receipt, provenance-valid review
and completion runs, a successful non-pending `openrouter-profile` status targeting the completion
run, matching caller blobs on live `main`, and a PR younger than 25 days. A pending deep request or
pending `openrouter-profile` status blocks an older clean review from authorizing CI. Open a
replacement PR for older work.

The broker serializes OpenRouter review, profile completion, and Azure completion events across
the repository. Each wake-up inspects all open PRs, so coalesced pending events cannot drop a
ready PR. It checks Azure run eligibility first, skipping review/provenance API calls for PRs
with active or already-executed CI, or without an eligible skipped run. After an exact-head clean ledger and successful profile proof, it adds `run-ci` and reruns
the skipped Azure workflow. It also reacts to profile completion alone when the review proof already
holds. Manual review dispatches and profile-completion reruns are broker inputs; the broker does
not initiate recovery forwarding. This rollout supplements the existing first-pass gate with
`openrouter-profile`; it does not yet add that context to the Main Guard branch ruleset.

- The broker serializes decisions across the repository and checks every open PR,
  finds the newest eligible skipped Azure
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

The trust boundary is explicit: GitHub review objects do not expose which workflow created them.
Authorization therefore admits only same-repository PRs and trusts the write-capable repository
workflows on the default branch, the pinned reusable org workflows they invoke, and the org
`scripts/profile_consumer.mjs` loaded at the org workflow pin. Trust is established through GitHub
artifact, workflow run, job, and caller-blob provenance — not cryptographic signatures on review
bodies or status descriptions.

For operational recovery, a maintainer may dispatch the normal review workflow from `main`
and wait for its exact-head clean ledger and current profile proof. The run may report `main`
as its `head_sha`; authorization accepts it only when the exact-head bot review links the run,
which must succeed and pass the workflow/repository/caller-blob checks. The broker then adds
`run-ci` and reruns the existing exact-head Azure workflow. If the broker fails, or for a
same-repository Dependabot PR that the broker skips, verify both proofs and confirm no Azure
CI is already active before manually applying the label and rerunning the existing workflow.

For a caller-pin migration with an existing review ledger while `main` still carries the legacy
verify-mode recovery workflow, complete the existing migration procedure on `main` before this
profile pin merges. Wait for **all legacy recovery runs to finish before merging**. Their CI
admission requires the registered recovery workflow ID, default-branch dispatch, and matching
pinned recovery Git blobs at both the run commit and the current default branch. A legacy run
that spans the merge cannot satisfy the new pins; after it finishes, obtain a normal review
and current profile proof. Do not relax the pins to accept stale evidence.

After the forwarder in
[`openrouter-review-recovery.yml`](../../.github/workflows/openrouter-review-recovery.yml) lands on
`main`, recovery is a cheap default-branch dispatcher only:

`gh workflow run openrouter-review-recovery.yml --ref main -f pr_number=<PR>`

One successful forwarder dispatch invokes the normal trusted
[`openrouter-code-review.yml`](../../.github/workflows/openrouter-code-review.yml) with
`review_level: auto` and the default `reset_review: false`. Do not dispatch it again after success.
It performs no review itself: wait for the resulting review and
[`openrouter-profile-completion.yml`](../../.github/workflows/openrouter-profile-completion.yml).
If rejected because a review is active, wait for that review to finish and reassess whether
recovery is still necessary. The guard checks both run-name fields and conservatively waits
for active legacy recovery or unattributable manual runs, excluding itself. It refuses forks,
closed or draft PRs, and off-default dispatches.

The forwarding run alone cannot authorize CI; only the subsequent normal review and profile
proof can. The helper retains the strict recovery provenance check for compatibility, but the
new forwarder produces no review for that path. When changing the recovery workflow, update
its blob pin in the helper together. The broker uses a repository-wide sweep so coalesced
GitHub events cannot lose a ready PR, skips expensive review checks when Azure is ineligible,
and has a ten-minute job limit so a stuck sweep releases the queue.

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
