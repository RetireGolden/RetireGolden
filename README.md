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

The repo is an npm workspace: the Vite + React + TypeScript client lives in [`app/`](app/), and the
pure calculation engine lives in [`packages/engine/`](packages/engine/) — published to npm as
[`@retiregolden/engine`](https://www.npmjs.com/package/@retiregolden/engine) and consumed by the app
as a workspace dependency.

**Requirements:** Node.js 20+

```bash
npm install
npm run dev
```

| Command (repo root) | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Engine package build, then production app build → `app/dist/` |
| `npm run test` | Vitest unit tests (engine package + app) |
| `npm run lint` | ESLint (engine package + app) |

## CI/CD

Six GitHub Actions workflows: the SWA pipeline and both security scans run on pushes and pull requests to `main`; CLA enforcement runs on PR activity; the Owl parity oracle and the engine npm release are triggered manually (the release also fires on `engine-v*` tags). Full setup notes: [DOCS/operations/ci-cd-and-deploy.md](DOCS/operations/ci-cd-and-deploy.md).

### Azure Static Web Apps — build & deploy

[`.github/workflows/azure-static-web-apps-retiregolden.yml`](.github/workflows/azure-static-web-apps-retiregolden.yml)

| Job | What it does |
|-----|----------------|
| `lint` | Root `npm ci` + `npm run lint` (engine package + app) |
| `test` | Root `npm ci` + `npm run test:coverage` (engine package + app, unit tests + coverage thresholds) |
| `e2e` | Playwright browser smoke/layout specs (`npm run test:e2e` in `app/`) |
| `build` | Runs after lint, test, and e2e pass; `npm run build` → `app/dist/` (artifact retained 1 day) |
| `deploy` | Uploads `app/dist` to **Azure Static Web Apps** (`skip_app_build: true`) |
| `dast` | PR previews only — calls the ZAP workflow against the deployed preview URL |
| `close_pull_request` | Tears down the SWA preview environment when a PR is closed |

**Triggers:** push to `main` deploys production; open/sync/reopen PRs get a preview URL; closing a PR removes the preview.

**Requirements:** repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (Azure SWA deployment token). Node **22** in CI (the workspaces require Node ≥ 20). SPA routing is configured in [`app/public/staticwebapp.config.json`](app/public/staticwebapp.config.json).

**Live site:** [https://retiregolden.app/](https://retiregolden.app/)

### Owl parity oracle — engine cross-check

[`.github/workflows/owl-parity.yml`](.github/workflows/owl-parity.yml)

Manually triggered (Actions tab). Runs the Owl parity harness (`npm run owl-parity`), replaying the bundled fixtures through the open-source Owl planner and comparing ending after-tax estates against RetireGolden's exact ledger.

### Semgrep SAST — static analysis

[`.github/workflows/semgrep.yml`](.github/workflows/semgrep.yml)

Runs on every push and PR to `main`. Scans the repo with Semgrep's `p/default` ruleset (open-source, no external account). Uploads a SARIF report as a build artifact and publishes findings to GitHub code scanning when available. **Only ERROR-severity findings fail the check** — lower severities are reported but do not block merge.

### OWASP ZAP DAST — dynamic scan

[`.github/workflows/zap.yml`](.github/workflows/zap.yml)

Reusable workflow invoked by the Azure deploy job after a **PR preview** is live (production pushes are not scanned). Runs a passive ZAP baseline scan against the deployed URL and uploads HTML/JSON reports. **Only High-risk alerts fail the check** — lower severities are surfaced for review. Can also be triggered manually from the Actions tab with a custom `target_url`.

### CLA enforcement

[`.github/workflows/cla.yml`](.github/workflows/cla.yml)

Runs on pull-request activity. First-time contributors are asked to sign the [Contributor License Agreement](CLA.md) by replying with the acceptance phrase; the check blocks merge until every commit author has signed. See [CONTRIBUTING.md](CONTRIBUTING.md).

### Engine package release

[`.github/workflows/publish-engine.yml`](.github/workflows/publish-engine.yml)

Publishes [`packages/engine`](packages/engine/) to npm as `@retiregolden/engine` with provenance. Fires on `engine-v<version>` tags (the tag must match the package version) or manually from the Actions tab (manual runs default to `--dry-run`). Requires the `NPM_TOKEN` repository secret — a granular npm automation token for the `@retiregolden` org.

## License

RetireGolden is free and open-source software licensed under the **[GNU Affero General Public License, version 3 only (AGPL-3.0-only)](LICENSE)**. © 2026 RetireGolden, LLC. "RetireGolden" and the RetireGolden logo are trademarks of RetireGolden, LLC — see [TRADEMARKS.md](TRADEMARKS.md). Bundled third-party packages are covered in [app/THIRD-PARTY-NOTICES.txt](app/THIRD-PARTY-NOTICES.txt). Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

Product specs, architecture, domain rules, standards, maintenance schedule, and a sequential changelog live in **[DOCS/README.md](DOCS/README.md)** (and the root `CHANGELOG.md`).
