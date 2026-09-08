# RetireGolden

**Privacy-first retirement planning in your browser** — no accounts, no server, no data leaving your device.

**Live app:** [https://retiregolden.app/](https://retiregolden.app/)

RetireGolden is an educational retirement planner that models how your savings, income, spending, and taxes might play out over the years ahead. You build a plan section by section, then explore projections, risk, and trade-offs — all computed locally in the browser.

## What you can do

- **Build a household plan** — accounts (taxable, traditional, Roth, HSA, pensions, home equity), income, spending, insurance, and withdrawal strategy
- **Model Social Security** — claiming ages, spousal/survivor benefits, mySSA XML import, and breakeven analysis
- **Project year by year** — federal taxes, RMDs, Roth conversions, ACA premiums, IRMAA, and state tax estimates
- **Stress-test with Monte Carlo** — success rates and percentile bands under historical or parametric return assumptions
- **Compare scenarios** — clone plans, tweak assumptions, and see differences side by side
- **Optimize withdrawals** — explore bracket-aware Roth conversion and draw strategies
- **Learn as you go** — built-in articles, glossary, and source citations in the Learning Center
- **Back up your data** — export and import plans as JSON; everything stays on this device

## Privacy

RetireGolden has no user accounts and no backend storage. Plans live in your browser (IndexedDB). If you clear browser data or switch devices, your plans are gone unless you export a backup from the planner home.

## Disclaimer

RetireGolden is for **education only** — not tax, legal, financial, or medical advice. Projections use stated assumptions and planning-grade math; they are not predictions. See the in-app [disclaimer](https://retiregolden.app/disclaimer) for the full terms.

## Development

The repo is a pnpm workspace: the web host lives in [`app/`](app/), the pure calculation engine in
[`packages/engine/`](packages/engine/) — published to npm as
[`@retiregolden/engine`](https://www.npmjs.com/package/@retiregolden/engine) — and the planner React
UI in [`packages/planner-ui/`](packages/planner-ui/) — published as
[`@retiregolden/planner-ui`](https://www.npmjs.com/package/@retiregolden/planner-ui). The app
consumes both as workspace dependencies.

**Requirements:** Node.js 24.15+ (Corepack will use the `packageManager` pin)

```bash
corepack enable
pnpm install
pnpm dev
```

| Command (repo root) | Purpose |
|---------|---------|
| `pnpm dev` | Local dev server |
| `pnpm build` | Engine package build, planner-ui type-check, then production app build → `app/dist/` |
| `pnpm test` | Vitest unit tests (engine, planner-ui, and app) |
| `pnpm lint` | ESLint (engine, planner-ui, and app) |
| `pnpm verify:quotes` | Checks every tax rule's quoted authority against the source it cites — manual, needs network, [not a CI gate](DOCS/operations/quote-fidelity.md) |

## CI/CD

GitHub Actions builds production on pushes to `main`; the Azure preview workflow listens for opened, synchronized, reopened, and closed PR events. Semgrep runs on pushes to `main` and PRs targeting `main`, while ZAP runs only for an authorized same-repository PR preview after deploy. OpenRouter review runs on its pull-request events or manual dispatch, and its trusted broker accepts completion events and explicit default-branch delivery recovery. The resolve gate covers manifest-touching PRs and weekly runs; Grok Build is manual emergency-only; Owl parity is manual; both package releases also have their version-tag triggers (`engine-v*` and `planner-ui-v*`). Full setup notes: [DOCS/operations/ci-cd-and-deploy.md](DOCS/operations/ci-cd-and-deploy.md).

### Azure Static Web Apps — build & deploy

[`.github/workflows/azure-static-web-apps-retiregolden.yml`](.github/workflows/azure-static-web-apps-retiregolden.yml)

| Job | What it does |
|-----|----------------|
| `authorize` | API-only live exact-head `run-ci` + decoded trusted-clean-review and current profile-proof gate; push to `main` is authorized, forks are not, and same-repository Dependabot can be authorized only after a maintainer applies `run-ci`, reruns the existing exact-head Azure workflow, and passes both the trusted clean-review and current profile-proof gates |
| `lint` | Root `pnpm install --frozen-lockfile` + `pnpm lint` (engine, planner-ui, and app) |
| `test engine`, `test planner-ui`, `test web` → `test` | Independent workspace coverage jobs run in parallel; the fail-closed aggregate keeps the required `test` context |
| `e2e` | Playwright browser smoke/layout specs (`pnpm test:e2e` in `app/`) |
| `build` | Runs with lint/tests/e2e after authorization; `pnpm build` → `app/dist/` (artifact retained 1 day) |
| `deploy` | Uploads `app/dist` to **Azure Static Web Apps** (`skip_app_build: true`) only after every authorized prerequisite passes |
| `dast` | PR previews only — calls the ZAP workflow against the deployed preview URL |
| `close_pull_request` | Tears down the SWA preview environment when a PR is closed |

**Triggers:** push to `main` deploys production; opened/synchronized/reopened PRs create a cheap placeholder and receive a preview only after exact-head authorization; closing a PR removes the preview.

Same-repository PRs first pass an API-only live authorization gate: `run-ci`, an exact-head decoded clean
OpenRouter ledger from the real GitHub Actions bot, a review-caller blob equal to the default branch,
and current trusted `openrouter-profile` proof. Manual and Dependabot paths require the same proof.
Lint, the three coverage shards (aggregated as `test`), e2e, and build then run in parallel; deploy waits
for them all. Forks never authorize or deploy; the broker does not automatically label or rerun Dependabot PRs. For manual recovery or a same-repository Dependabot PR, apply `run-ci`, then rerun the existing exact-head Azure workflow; the label alone does not start CI.

### OpenRouter CI broker

[`.github/workflows/openrouter-ci-broker.yml`](.github/workflows/openrouter-ci-broker.yml)

Runs from trusted default-branch code when an OpenRouter review, profile completion, or Azure CI run
completes, or when explicitly dispatched on the default branch with a completed profile run ID
as `source_run_id`. One repository-wide lock serializes decisions, and each wake-up inspects all open PRs so
coalesced pending events cannot lose a ready PR. For each PR, it checks the live same-repository head,
decoded bot-authored clean ledger, matching caller blobs, and current profile proof through GitHub APIs.
It identifies an eligible skipped Azure run, then adds `run-ci` and reruns that specific run. It never
checks out or executes PR code.

**Requirements:** repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (Azure SWA deployment token). Node **24** in CI (the workspaces require Node >=24.15.0). SPA routing is configured in [`app/public/staticwebapp.config.json`](app/public/staticwebapp.config.json).

**Live site:** [https://retiregolden.app/](https://retiregolden.app/)

### Owl parity oracle — engine cross-check

[`.github/workflows/owl-parity.yml`](.github/workflows/owl-parity.yml)

Manually triggered (Actions tab). Runs the Owl parity harness (`pnpm owl-parity`), replaying the bundled fixtures through the open-source Owl planner and comparing ending after-tax estates against RetireGolden's exact ledger. How the harness and its gate work: [DOCS/operations/owl-parity.md](DOCS/operations/owl-parity.md).

### Semgrep SAST — static analysis

[`.github/workflows/semgrep.yml`](.github/workflows/semgrep.yml)

Runs on pushes to `main` and PRs targeting `main`. Scans the repo with Semgrep's `p/default` ruleset (open-source, no external account). Uploads a SARIF report as a build artifact and publishes findings to GitHub code scanning when available. **Only ERROR-severity findings fail the check** — lower severities are reported but do not block merge.

### OWASP ZAP DAST — dynamic scan

[`.github/workflows/zap.yml`](.github/workflows/zap.yml)

Reusable workflow invoked by the Azure deploy job after a **PR preview** is live (production pushes are not scanned). Runs a passive ZAP baseline scan against the deployed URL and uploads HTML/JSON reports. **High-risk alerts fail the check** — lower severities are surfaced for review — and so does a missing report, since a scan that produced nothing has not passed. Can also be triggered manually from the Actions tab with a custom `target_url`.

### Resolve gate — dependency trust policy

[`.github/workflows/resolve-gate.yml`](.github/workflows/resolve-gate.yml)

Runs on PRs that touch `pnpm-workspace.yaml`, `pnpm-lock.yaml`, or any `package.json`, on a weekly schedule, and manually from the Actions tab. Every other CI job installs with `--frozen-lockfile`, which skips dependency resolution and with it the supply-chain gates in [`pnpm-workspace.yaml`](pnpm-workspace.yaml) (`trustPolicy`, `minimumReleaseAge`, `blockExoticSubdeps`). This workflow deletes the lockfile and re-resolves from scratch so those gates are actually exercised, and it fails when a `trustPolicyExclude` entry no longer appears in a fresh resolve — a stale exemption gets dropped instead of standing as a silent trust waiver. Like Semgrep, it is cheap and not gated behind the `run-ci` label.

### CLA enforcement

[`.github/workflows/cla.yml`](.github/workflows/cla.yml)

Runs on pull-request activity. First-time contributors are asked to sign the [Contributor License Agreement](CLA.md) by replying with the acceptance phrase; the check blocks merge until every commit author has signed. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Grok Build emergency review

[`.github/workflows/grok-code-review.yml`](.github/workflows/grok-code-review.yml)

Manual-only from the Actions tab. A human supplies the PR number when an independent emergency Grok review is wanted. It is not triggered by pull-request activity, is not a fallback for OpenRouter, and is not a required check.

### OpenRouter required review

[`.github/workflows/openrouter-code-review.yml`](.github/workflows/openrouter-code-review.yml)

Runs on pull-request open, sync, reopen, and ready-for-review (and manually from the Actions tab); GitHub prevents draft PRs from merging, and the review starts when a draft is marked ready. It passes only the org `OPENROUTER_API_KEY` to the reusable workflow. The OpenRouter roster may route an `x-ai/grok-4.6` model lane through OpenRouter, but it never invokes the standalone Grok workflow, never receives `XAI_API_KEY`, and has no fallback to that legacy stack. The required context is `review / openrouter-first-pass-gate`; it turns green only after OpenRouter publishes a usable full-PR first-pass review, then carries that proof across synchronize events while follow-up reviews continue independently. If the initial run fails before seeding that proof, rerun it with this workflow's manual `pr_number` dispatch; synchronize events deliberately do not restart an unseeded full review and its token spend automatically.

Cutover requires this ordered operation: first merge the pinned OpenRouter action and central `RetireGolden/.github` reusable; then merge the product caller change while the existing Grok gate is still satisfied; immediately replace Main Guard's required context `review / grok-first-pass-gate` with `review / openrouter-first-pass-gate`. GitHub cannot make the workflow merge and ruleset edit atomic, so operators should expect a short controlled interval in which open PRs may wait for the old context. Keep that interval brief, verify the new context on an active PR, and manually dispatch OpenRouter for any existing PR that needs a seed. The old Grok workflow remains available only for explicit emergency dispatches and is never an OpenRouter fallback.

### OpenRouter profile completion

[`.github/workflows/openrouter-profile-completion.yml`](.github/workflows/openrouter-profile-completion.yml)

Runs on review completion, pushes to `main`, and manual dispatch. The trusted default-branch workflow verifies the current PR head, review policy, required lanes, and pending requests before publishing `openrouter-profile`. Its successful proof is required by the CI broker; a successful review workflow alone does not authorize CI.

### OpenRouter review recovery

[`.github/workflows/openrouter-review-recovery.yml`](.github/workflows/openrouter-review-recovery.yml)

For caller-pin migrations with an existing review ledger, dispatch this workflow from the default branch after other reviews finish. It forwards to the normal review workflow on the default branch, preserving previous findings. Follow the resulting OpenRouter code review and profile completion runs; completion of the forwarding workflow is not a review verdict. A clean profile proof and successful exact-head Azure run remain required. See the [recovery procedure](DOCS/operations/ci-cd-and-deploy.md).

### Engine package release

[`.github/workflows/publish-engine.yml`](.github/workflows/publish-engine.yml)

Publishes [`packages/engine`](packages/engine/) to npm as `@retiregolden/engine` with provenance. Fires on `engine-v<version>` tags (the tag must match the package version) or manually from the Actions tab (manual runs default to `--dry-run`). Authenticates via npm Trusted Publishing (OIDC) — no long-lived token; the package is configured with a trusted publisher pinned to this repo and workflow file.

### Planner UI package release

[`.github/workflows/publish-planner-ui.yml`](.github/workflows/publish-planner-ui.yml)

Publishes [`packages/planner-ui`](packages/planner-ui/) to npm as `@retiregolden/planner-ui` with provenance. Fires on `planner-ui-v<version>` tags (the tag must match the package version) or manually from the Actions tab (manual runs default to `--dry-run`). Uses the same npm Trusted Publishing (OIDC) flow — configure a trusted publisher for this package too, no token needed. Before publishing, a pack-smoke step builds a scratch Vite consumer from the packed tarball to prove the published surface (exports map, dep-internal workers, HiGHS wasm).

## License

RetireGolden is free and open-source software licensed under the **[GNU Affero General Public License, version 3 only (AGPL-3.0-only)](LICENSE)**. © 2026 RetireGolden, LLC. "RetireGolden" and the RetireGolden logo are trademarks of RetireGolden, LLC — see [TRADEMARKS.md](TRADEMARKS.md). Bundled third-party packages are covered in [app/THIRD-PARTY-NOTICES.txt](app/THIRD-PARTY-NOTICES.txt). Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

Product specs, architecture, domain rules, standards, maintenance schedule, and a sequential changelog live in **[DOCS/README.md](DOCS/README.md)** (and the root `CHANGELOG.md`).

## Review guidance

Per-area review contracts (additive context for automated review; merge and CI rules
remain in [AGENTS.md](AGENTS.md)):

- [REVIEW.md](REVIEW.md) — shared scope and evidence standards
- [packages/engine/REVIEW.md](packages/engine/REVIEW.md)
- [packages/planner-ui/REVIEW.md](packages/planner-ui/REVIEW.md)
- [app/REVIEW.md](app/REVIEW.md)

Branch-targeted guidance applies after merge to the target branch; new or moved
source files are still reviewed. Offline policy lint and explain semantics follow the
[OpenRouter review-policy spec](https://github.com/FlyOverCoderKY/openrouter-pr-review-action/blob/212775ffea22e806cddcb706c73a3df26fbcb6d0/docs/review-policy.md).
The pinned shared OpenRouter caller enables `review_policy: base`.


After a rebase or force-push makes the last reviewed commit unreachable, the
shared harness selects `rebase` scope automatically: a full current-PR sweep at
all severities with earlier reviews and replies as bounded context. Finding IDs
and round progression survive. Valid disputes remain settled; current-code
evidence can reopen an invalidated dispute. Fixed or retired findings supply
historical context for detecting regressions. A clean current-head review and
current profile proof are still required; old-lineage evidence cannot unlock CI.

## Review profiles and CI proof

The caller enables trusted profiles from the [organization workflow](https://github.com/RetireGolden/.github/blob/a190c3d834f2e3048b4eef8129fa3c8e10891aa0/README.md). Code uses required Grok plus optional GLM; deep adds required Astra Flex. This preserves the standing baseline; `REVIEW.md` cannot name arbitrary models or remove required lanes.

From Actions → **OpenRouter code review**, dispatch from `main` with a PR number and `review_level: auto`, `deep`, or `cancel`. Deep requests require repository write/maintain/admin permission, retain existing findings, and stay pending across retries and pushes until their own required review succeeds. Cancel removes a manual pending request; it cannot lower a policy requirement. Leave `reset_review` false.

**OpenRouter profile completion** checks the exact PR head, effective current policy, required lanes, and accepted requests. The `openrouter-profile` status supplements the existing first-pass gate and repository CI. A successful review workflow alone does not establish a clean or complete review. The CI broker also checks the trusted completion proof before requesting expensive CI.

Profile artifacts retain 30 days (requests 90 days), and the gate accepts PRs younger than 25 days. Open a replacement PR for older work. Missing evidence fails closed. An automatic policy refresh is requested at most once per head/configuration; use a manual rerun if that request fails. Maintainer labels and automatic path escalation are not enabled in this rollout.

Dispatch **OpenRouter profile completion** from the default branch; selecting a
feature branch intentionally skips its trusted proof job. Bot-dispatched reviews
explicitly wake this workflow because GitHub suppresses their downstream
`workflow_run` events. The optional `source_run_id` identifies a completed review
run to inspect; the receiver still checks its provenance and current evidence.
If notification delivery fails, retry profile completion with that run ID on
`main` instead of paying for another review.

The CI broker also accepts a default-branch manual dispatch with the completed
**profile-completion** run ID as `source_run_id`. It waits for completion and
rechecks the clean review and profile proof before adding `run-ci` or rerunning
CI. Notification failure does not invalidate the completed review; missing proof
still blocks CI. These delivery waits do not shorten model review time.

The broker polls a notifying profile run for up to 90 seconds within its
ten-minute job limit. The notification job depends on completed planning,
proof and publication jobs; the wait covers only notification/API/runner cleanup,
not the multi-PR proof work. If that tail still exceeds 90 seconds, the broker
fails visibly with the source-run recovery instruction. Retry its dispatch after
the source finishes; do not rerun the model panel.

The [immutable shared workflow](https://github.com/RetireGolden/.github/blob/a190c3d834f2e3048b4eef8129fa3c8e10891aa0/.github/workflows/openrouter-code-review.yml#L169)
sets `actions: read` as its default, inherited by both model-review jobs. Its
notification job explicitly overrides that default with `actions: write`.
GitHub's [token-triggering documentation](https://docs.github.com/en/actions/how-tos/write-workflows/choose-when-workflows-run/trigger-a-workflow)
lists `workflow_dispatch` and `repository_dispatch` as the unconditional
exceptions; it does not list `workflow_run`. The observed recovery review
[RetireGolden run 34255246099](https://github.com/RetireGolden/RetireGolden/actions/runs/34255246099)
was bot-dispatched and completed without downstream profile or broker runs.
