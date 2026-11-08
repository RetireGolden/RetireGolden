# CI/CD and deployment

How RetireGolden builds, tests, and ships. RetireGolden is a **static single-page app** (Vite build →
`app/dist/`) hosted on **Azure Static Web Apps (SWA)** and deployed by **GitHub Actions**. There is
no server and no backend — "deploy" means uploading static files to a CDN.

**Production:** [https://retiregolden.app/](https://retiregolden.app/)

## The pipeline

The source workflow
[`azure-static-web-apps-retiregolden.yml`](../../.github/workflows/azure-static-web-apps-retiregolden.yml)
drives authorization, lint, tests, and build. The default-branch
[`azure-static-web-apps-controller.yml`](../../.github/workflows/azure-static-web-apps-controller.yml)
owns deployment, preview scanning, and teardown from trusted default-branch code.
The source workflow triggers on push to `main` and on `opened`, `synchronize`, and `reopened`
pull-request events targeting `main`; the controller separately handles PR close. On a same-repository PR,
the lightweight `authorize` job reads **live** PR state before any checkout: it requires the current head,
the `run-ci` label, an exact-head clean OpenRouter review ledger, and a successful trusted
`openrouter-profile` completion status for that head. An unauthorized run fails the existing
`authorize` context while its expensive jobs remain skipped, preserving the broker's
cheap exact-head rerun path (see [Label-gated PR CI](#label-gated-pr-ci) below).

The source workflow ends at the exact `dist` artifact. The default-branch controller consumes that artifact,
rechecks live PR ownership and the `run-ci` label from `main`, deploys named `pr<number>` previews, invokes ZAP, and
publishes `ZAP DAST / ZAP Baseline` on the source head. Successful current-`main` artifacts deploy to
production under a serialized production concurrency group, with a final live-branch check immediately
before upload so a queued older run cannot replace a newer commit. Production intentionally represents
the last successfully built `main` artifact; if `main` advances during an upload, the later successful
source run supersedes it, while a failed newer build leaves the last successful deployment in place.
The controller's `workflow_run: completed` trigger also receives rerun attempts. A
late rerun of an old source workflow therefore enters the `legacy-result` path and republishes its
source-identified ZAP result after the legacy job-level check.
Both authorization gates use the trusted default-branch helper. A newer independently verified dispatch can
recover an unverifiable automatic review; older dispatches never hide a newer verification failure. The
authoritative run must succeed with its own exact-head clean ledger and current profile proof. Neither gate
retries a rejected live authorization under older helper semantics. The source gate loads the helper
only from the default branch; missing files and other load failures fail closed without a bootstrap blob.
Preview deploy jobs recheck ownership before and after upload and self-clean when the PR closes or its
head changes, so cleanup does not depend on a pending close job being preserved. The controller never
checks out or executes PR code. For PR runs, it also requires the source-workflow blob at the exact head
to match the active default-branch source workflow before it accepts the artifact. Changes to that source
workflow therefore use the same staged-controller sequence as this cutover: land the trusted controller
support first, then change the source workflow in a follow-up PR. The controller-support PR adds the
planned source file's exact Git blob SHA to `TRUSTED_STAGED_AZURE_SOURCE_WORKFLOW_BLOB_SHAS` in the
default-branch CI helper. After that PR merges, the source-workflow PR can use exactly that reviewed blob;
once the source change reaches `main` and becomes the default blob, remove the temporary entry in a cleanup PR.
Staging the helper does not change the source workflow: the retired bootstrap helper pin is absent,
so the planned source blob and the helper allowlist have no circular hash dependency.

Source-workflow prerequisites flow into controller-owned deployment:

```
authorize --+--> lint ---------------------+
            +--> test shards --> test -----+
            +--> e2e ----------------------+--> successful source run
            +--> build --> dist artifact --+              |
                                                          v
                                            controller deploy --> dast (PR only)
```

| Job | Runs | What it does |
|-----|------|--------------|
| `authorize` | push + PR open/sync/reopen | API-only live-state gate. Pushes to `main` pass; same-repo PRs must be open, unchanged at the event head, carry `run-ci`, have the trusted exact-head clean OpenRouter ledger, and pass the org profile consumer's `openrouter-profile` proof for that head. Unlabeled first attempts fail this gate but leave expensive jobs skipped for the broker rerun. Forks do not pass: the target caller publishes an explicit failed review gate, and the unprivileged source workflow publishes the fork-head ZAP failure without invoking the controller. A maintainer must reproduce the change on a same-repository branch before review and CI can proceed. Manual recovery and same-repository Dependabot use `run-ci` followed by a rerun of the existing exact-head Azure workflow. |
| `lint` | authorized push/PR | root `pnpm install --frozen-lockfile`, `pnpm lint` (ESLint in `packages/engine`, `packages/planner-ui`, and `app`), then workflow contract tests |
| `test engine`, `test planner-ui`, `test web` | authorized push/PR, in parallel | Each workspace runs its own `test:coverage`, retaining its own coverage threshold. The fail-closed aggregate check is still named **`test`** for Main Guard. |
| `e2e` | authorized push/PR | Playwright browser layout tests (`pnpm test:e2e`) in `app/` |
| `build` | authorized push/PR, in parallel with lint/tests/e2e | root `pnpm build`, then the third-party notices drift and both package pack-smoke checks, then the production-build Playwright spec (`pnpm test:e2e:dist` in `app/`, `vite preview` of the built `dist`); uploads `app/dist` as the `dist` artifact |
| controller `deploy_preview` / `deploy_production` | successful completed source run | downloads the exact `dist` artifact and deploys it via the pinned `Azure/static-web-apps-deploy` action with `skip_app_build: true` and `app_location: app/dist`; token-holding jobs do not check out PR code or run repository setup |
| controller `dast` / `publish_pr_result` | authorized PR preview | scans the deployed URL with OWASP ZAP and publishes the exact-head `ZAP DAST / ZAP Baseline` check — see [security-scanning.md](security-scanning.md) |
| controller `close_preview` | PR close | tears down the named preview plus any transitional legacy preview environment |

CI uses **Node 24**, set up by the shared composite `.github/actions/setup-toolchain` (pnpm from the
`packageManager` pin plus `actions/setup-node` with the pnpm store cache; the fresh-resolve gate passes
`cache: 'false'`); the workspaces require **Node ≥ 24.15.0**. Dependencies install
once at the repo root (`pnpm install --frozen-lockfile` against the root `pnpm-lock.yaml` — the repo is a pnpm workspace).
Semgrep SAST runs as a separate workflow on every push/PR — deliberately **not** label-gated, because the
scan is cheap and it is a Main Guard required check (also in [security-scanning.md](security-scanning.md)).

## Label-gated PR CI

To keep Actions minutes down, PR pushes do **not** run the expensive pipeline by default — review bots can
iterate without every commit running lint/test/e2e/build or starting the controller deploy/DAST path. The trusted default-branch
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
the run commit exactly equals the caller blob on the default branch for dispatch runs. Trusted
`pull_request_target` runs execute the caller from the
default branch and instead require the exact reviewed head,
the live head branch, and every same-repository PR from that branch to have always targeted the
default branch. Base-history proof uses a complete filtered timeline connection with no base-change
events; unrelated timeline counts cannot reject an unchanged branch. Trusted `workflow_dispatch` and `repository_dispatch` runs use the default-branch
commit and must be linked from the exact-head ledger. They read GitHub APIs only and
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
[`FlyOverCoderKY/openrouter-pr-review-action@0d6a05e41616281368c1f6bb7fb5a47ddf41375d`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/tree/0d6a05e41616281368c1f6bb7fb5a47ddf41375d).
RetireGolden authorization validates decoded markers against that producer, not a vendored copy:

| Contract | Source |
|----------|--------|
| Finding decode (`id`, `sev`, `file`, `line`, `title`, `ev`, `st`, `m`) | [`loop.py` `_decode_finding`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/loop.py#L491-L531) |
| Safe relative paths for `file` | [`schema.py` `valid_review_path`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/schema.py#L281-L283) is a three-line compatibility predicate delegating to [`normalize_review_path`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/schema.py#L256-L278); its length limit is [`MAX_FILE = 500`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/schema.py#L26). |
| Round state: `fixed` removes an entry; `disputed` is carried; open counts | [`loop.py` `apply_round`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/loop.py#L196-L298) (including `open_issue_count`) |
| Ledger encode/decode envelope | [`loop.py` `_encode`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/loop.py#L384-L408) / [`_decode`](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/0d6a05e41616281368c1f6bb7fb5a47ddf41375d/src/or_pr_review/loop.py#L450-L488) |

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

The [pinned shared workflow](https://github.com/RetireGolden/.github/blob/cb192b3e6ae8f12cb7081a0b6a3de95098d4ffaf/README.md) uses the 180-second HTTP limit for connection/header setup and socket inactivity. Active bodies can finish within the remaining lane-stage deadline; a structured finish uses its whole remaining window before any retry. Timeout diagnostics distinguish connection setup, inactivity, and absolute deadline expiry.

The current caller uses the [shared Sol 6.1 configuration through organization PR #56](https://github.com/RetireGolden/.github/blob/cb192b3e6ae8f12cb7081a0b6a3de95098d4ffaf/.github/workflows/openrouter-code-review.yml)
with `review_profiles_enabled: true`, `review_policy: base`, and org workflow pin
`cb192b3e6ae8f12cb7081a0b6a3de95098d4ffaf`. Root and nested `REVIEW.md` guidance comes from the
immutable target-branch tip and is frozen before model calls. A policy proposed by the PR begins
affecting reviews only after merge. The `code` profile uses required GPT-6.1 Sol (pinned to Azure US ZDR) plus optional GLM;
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
org reusable at `cb192b3e6ae8f12cb7081a0b6a3de95098d4ffaf`. Reviews publish both the v1 ledger
marker and a v1 plan receipt (`<!-- openrouter-review-plan:v1:… -->`) that records the effective
profile, required and successful models, and the authoritative workflow run.

[`openrouter-profile-completion.yml`](../../.github/workflows/openrouter-profile-completion.yml)
invokes the matching org reusable on `workflow_run` completion of OpenRouter code review, on `main`
pushes, and on manual dispatch. Its proof job (`complete / profile #<n> <digest>`) verifies the trusted review artifacts
and current base policy. A separate publish job rechecks the obligations and successful proof
before writing the `openrouter-profile` commit status. Profile artifacts retain 30 days (requests 90 days).

CI authorization and the broker load the org
[`scripts/profile_consumer.mjs`](https://github.com/RetireGolden/.github/blob/cb192b3e6ae8f12cb7081a0b6a3de95098d4ffaf/scripts/profile_consumer.mjs)
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
- **Without the label**, `authorize` fails while the expensive jobs remain **skipped**; after the source
  run completes, the controller separately publishes a failed exact-head ZAP context. The broker
  deliberately recognizes that exact shape, applies `run-ci` only after current
  review proof, and reruns the same exact-head Azure attempt. The authorized rerun must be green before merge.
  A branch that predates a required Azure job name must first synchronize with `main`; the broker rejects
  stale workflow shapes rather than treating a missing expensive job as safely skipped.
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
`scripts/profile_consumer.mjs` loaded at the org workflow pin. That pinned consumer exports both
`verifyTargetBase` and `authorizeProfileReceipt`; the former binds target reviews to the expected base
history before the latter admits the review/profile receipt. Trust is established through GitHub
artifact, workflow run, job, and caller-blob provenance — not cryptographic signatures on review
bodies or status descriptions.

At this cutover, an open PR whose latest authoritative ledger came from the retired branch
`pull_request` caller does not receive a new event merely because `main` changed. After active reviews
settle, dispatch `openrouter-review-recovery.yml` from `main` once for each such unchanged head; the
forwarder starts the normal trusted review. Wait for its exact-head clean ledger and current profile proof
before CI authorization. This one-time migration is intentionally operator-driven: repository reviews are
serialized, and the broker does not initiate review recovery, so an automatic fan-out could overlap the
review queue or spend on a head that a maintainer is already replacing. A new PR event naturally uses the
target caller.

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

- **`AZURE_STATIC_WEB_APPS_API_TOKEN`** — the SWA deployment token (the only deploy secret). ZAP
  orchestration uses the built-in `GITHUB_TOKEN`. The post-cutover `workflow_run` deploy intentionally
  omits the action's `repo_token` because it has no pull-request event context for preview comments; the
  preview URL is passed directly to ZAP and remains visible in the controller run.
- Azure creates a **fresh named preview environment per PR** (a unique `*.azurestaticapps.net` URL); the
  controller passes its deploy output directly to the `dast` job. Pushing to `main` deploys production.

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

Each workflow first runs an unprivileged `build-and-smoke` job with read-only repository access. It
installs the frozen workspace, runs the package checks, creates a release tarball, records its SHA-256
digest, runs the pack smoke against that exact tarball, and uploads it with seven-day retention. The
environment-protected `publish` job does
not check out the repository or install workspace dependencies. It downloads that tarball, verifies the
digest and packed name/version against the tag, installs exactly npm 11.5.1, and publishes the tarball.

The `publish` job runs in the **`npm-publish`** GitHub environment, which requires manual reviewer approval
before its steps run — this includes manual `workflow_dispatch` dry-runs, which also pause for approval.
A separate ungated `guard` job forces `workflow_dispatch` runs to `--dry-run`, so an approved dispatch can
only rehearse; a real release must come from a version-matched `engine-v*` / `planner-ui-v*` tag push. The
`npm-publish` environment is shared by both package workflows; its deployment-branch policy allows the
`engine-v*` and `planner-ui-v*` tag patterns plus `main`.

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
