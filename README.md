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

Ten GitHub Actions workflows: the SWA pipeline and both security scans run on pushes and pull requests to `main`; OpenRouter review and CLA enforcement run on PR activity; the resolve gate re-resolves dependencies on manifest-touching PRs and weekly; Grok Build review is manual emergency-only; the Owl parity oracle and the engine and planner-ui npm releases are triggered manually (the engine release also fires on `engine-v*` tags). Full setup notes: [DOCS/operations/ci-cd-and-deploy.md](DOCS/operations/ci-cd-and-deploy.md).

### Azure Static Web Apps — build & deploy

[`.github/workflows/azure-static-web-apps-retiregolden.yml`](.github/workflows/azure-static-web-apps-retiregolden.yml)

| Job | What it does |
|-----|----------------|
| `lint` | Root `pnpm install --frozen-lockfile` + `pnpm lint` (engine, planner-ui, and app) |
| `test` | Root `pnpm install --frozen-lockfile` + `pnpm test:coverage` (engine, planner-ui, and app unit tests + coverage thresholds) |
| `e2e` | Playwright browser smoke/layout specs (`pnpm test:e2e` in `app/`) |
| `build` | Runs after lint, test, and e2e pass; `pnpm build` → `app/dist/` (artifact retained 1 day) |
| `deploy` | Uploads `app/dist` to **Azure Static Web Apps** (`skip_app_build: true`) |
| `dast` | PR previews only — calls the ZAP workflow against the deployed preview URL |
| `close_pull_request` | Tears down the SWA preview environment when a PR is closed |

**Triggers:** push to `main` deploys production; open/sync/reopen PRs get a preview URL; closing a PR removes the preview.

**Requirements:** repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (Azure SWA deployment token). Node **24** in CI (the workspaces require Node >=24.15.0). SPA routing is configured in [`app/public/staticwebapp.config.json`](app/public/staticwebapp.config.json).

**Live site:** [https://retiregolden.app/](https://retiregolden.app/)

### Owl parity oracle — engine cross-check

[`.github/workflows/owl-parity.yml`](.github/workflows/owl-parity.yml)

Manually triggered (Actions tab). Runs the Owl parity harness (`pnpm owl-parity`), replaying the bundled fixtures through the open-source Owl planner and comparing ending after-tax estates against RetireGolden's exact ledger. How the harness and its gate work: [DOCS/operations/owl-parity.md](DOCS/operations/owl-parity.md).

### Semgrep SAST — static analysis

[`.github/workflows/semgrep.yml`](.github/workflows/semgrep.yml)

Runs on every push and PR to `main`. Scans the repo with Semgrep's `p/default` ruleset (open-source, no external account). Uploads a SARIF report as a build artifact and publishes findings to GitHub code scanning when available. **Only ERROR-severity findings fail the check** — lower severities are reported but do not block merge.

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
