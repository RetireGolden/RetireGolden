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

The Vite + React + TypeScript client lives in [`app/`](app/).

**Requirements:** Node.js 20+

```bash
cd app
npm install
npm run dev
```

| Command | Purpose |
|---------|---------|
| `npm run dev` | Local dev server |
| `npm run build` | Production build → `app/dist/` |
| `npm run test` | Vitest unit tests |
| `npm run lint` | ESLint |

## CI/CD

Five GitHub Actions workflows: four run on relevant pushes or pull requests; the Owl parity oracle is triggered manually. Full setup notes: [DOCS/operations/ci-cd-and-deploy.md](DOCS/operations/ci-cd-and-deploy.md).

### Contributor license agreement

[`.github/workflows/cla.yml`](.github/workflows/cla.yml)

Checks pull requests for the required contributor license agreement and records signatures through CLA Assistant.

### Azure Static Web Apps — build & deploy

[`.github/workflows/azure-static-web-apps-retiregolden.yml`](.github/workflows/azure-static-web-apps-retiregolden.yml)

| Job | What it does |
|-----|----------------|
| `lint` | `npm ci` + `npm run lint` in `app/` |
| `test` | `npm ci` + `npm run test:coverage` in `app/` (unit tests + coverage thresholds) |
| `e2e` | Playwright browser smoke/layout specs (`npm run test:e2e`) |
| `build` | Runs after lint, test, and e2e pass; `npm run build` → `app/dist/` (artifact retained 1 day) |
| `deploy` | Uploads `app/dist` to **Azure Static Web Apps** (`skip_app_build: true`) |
| `dast` | PR previews only — calls the ZAP workflow against the deployed preview URL |
| `close_pull_request` | Tears down the SWA preview environment when a PR is closed |

**Triggers:** push to `main` deploys production; open/sync/reopen PRs get a preview URL; closing a PR removes the preview.

**Requirements:** repository secret `AZURE_STATIC_WEB_APPS_API_TOKEN` (Azure SWA deployment token). Node **22** in CI (`app/package.json` requires Node ≥ 20). SPA routing is configured in [`app/public/staticwebapp.config.json`](app/public/staticwebapp.config.json).

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

## License

RetireGolden is free and open-source software licensed under the **[GNU Affero General Public License, version 3 only (AGPL-3.0-only)](LICENSE)**. © 2026 RetireGolden, LLC. "RetireGolden" and the RetireGolden logo are trademarks of RetireGolden, LLC — see [TRADEMARKS.md](TRADEMARKS.md). Bundled third-party packages are covered in [app/THIRD-PARTY-NOTICES.txt](app/THIRD-PARTY-NOTICES.txt). Contributions are welcome under the terms in [CONTRIBUTING.md](CONTRIBUTING.md).

## Documentation

Product specs, architecture, domain rules, standards, maintenance schedule, and a sequential changelog live in **[DOCS/README.md](DOCS/README.md)** (and the root `CHANGELOG.md`).
