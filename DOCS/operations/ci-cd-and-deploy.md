# CI/CD and deployment

How RetireGolden builds, tests, and ships. RetireGolden is a **static single-page app** (Vite build →
`app/dist/`) hosted on **Azure Static Web Apps (SWA)** and deployed by **GitHub Actions**. There is
no server and no backend — "deploy" means uploading static files to a CDN.

**Production:** [https://retiregolden.app/](https://retiregolden.app/)

## The pipeline

One workflow drives build + deploy:
[`.github/workflows/azure-static-web-apps-retiregolden.yml`](../../.github/workflows/azure-static-web-apps-retiregolden.yml).
It triggers on push to `main` and on every pull-request event targeting `main`, but on PRs the jobs
themselves are gated on the **`run-ci` label** — an unlabeled PR produces a workflow run whose jobs
all report **skipped** (see [Label-gated PR CI](#label-gated-pr-ci) below).

```
lint ─┐
test ─┼─► build ─► deploy ─► dast (PR only)
e2e  ─┘
```

| Job | Runs | What it does |
|-----|------|--------------|
| `lint` | push + labeled PR | `npm ci` then `npm run lint` (ESLint) in `app/` |
| `test` | push + labeled PR | `npm ci` then `npm run test:coverage` (Vitest) in `app/` |
| `e2e` | push + labeled PR | Playwright browser layout tests (`npm run test:e2e`) in `app/` |
| `build` | needs `lint`, `test`, `e2e` | `npm run build` (`tsc -b && vite build`); uploads `app/dist` as the `dist` artifact |
| `deploy` | needs `build`; skipped on PR close | downloads `dist`, deploys via `Azure/static-web-apps-deploy@v1` with `skip_app_build: true`, `app_location: app/dist`; exposes the deployed URL as `preview_url` |
| `dast` | PR only; needs `deploy` | OWASP ZAP baseline scan of the freshly deployed PR preview URL — see [security-scanning.md](security-scanning.md). On unlabeled PRs it still invokes `zap.yml` with an empty URL (the scan job skips itself) so the required nested check reports as skipped instead of hanging on "Expected" |
| `close_pull_request` | PR close | tears down the SWA preview environment |

CI uses **Node 22** (`actions/setup-node`); `app/package.json` requires **Node ≥ 20**. Semgrep SAST runs
as a separate workflow on every push/PR — deliberately **not** label-gated, because the scan is cheap and
it is a Main Guard required check (also in [security-scanning.md](security-scanning.md)).

## Label-gated PR CI

To keep Actions minutes down, PR pushes do **not** run the pipeline by default — review bots can
iterate on a PR without every commit re-running lint/test/e2e/deploy/DAST. The full pipeline runs on a
PR only while it carries the **`run-ci` label**:

- **Apply `run-ci`** when the PR is ready for CI (typically after the first round of bot review and
  follow-up commits). Applying the label triggers a run immediately, and every later push runs CI too.
  Applying any **other** label never starts or re-runs the pipeline.
- **Without the label**, the gated jobs report as **skipped**. Skipped checks *satisfy* the Main Guard
  required checks, so always apply `run-ci` (and let CI go green) **before merging** — a merge without
  the label lands on `main` unvalidated (the push-to-`main` run will still catch it, but after the fact).
- **Semgrep is exempt**: it runs on every PR push regardless of the label, so the SAST required check is
  always a real result. It's a cheap CLI scan — the label gate covers the expensive pipeline only.
- Both workflows also **cancel in-progress PR runs** when a newer commit is pushed (concurrency
  groups), so rapid-fire pushes only pay for the latest commit. Pushes to `main` are never cancelled,
  and unrelated label events never cancel a live pipeline.

## Build and SPA routing

- Source and `package.json` live under **`app/`**; production output is **`app/dist/`**.
- The deploy action uses `skip_app_build: true` — the action uploads the already-built `app/dist`
  rather than building inside Azure.
- SPA deep links (e.g. `/plan/...`, `/learn/...`) are served by a navigation fallback in
  [`app/public/staticwebapp.config.json`](../../app/public/staticwebapp.config.json) (Vite copies it into
  `app/dist/`), which rewrites unknown paths to `/index.html`. A regression test guards it:
  [`app/src/staticwebapp.config.test.ts`](../../app/src/staticwebapp.config.test.ts).

## Secrets and environments

- **`AZURE_STATIC_WEB_APPS_API_TOKEN`** — the SWA deployment token (the only deploy secret). ZAP and the
  PR comment use the built-in `GITHUB_TOKEN`.
- Azure creates a **fresh preview environment per PR** (a unique `*.azurestaticapps.net` URL); the `dast`
  job reads that URL dynamically from the deploy job's output. Pushing to `main` deploys production.

## Branch protection

The **"Main Guard"** ruleset on `main` requires the security checks to pass before merge; the required
contexts are coupled to job/display names — see [security-scanning.md](security-scanning.md) §5 before
renaming any job.

## Local commands

From `app/`: `npm run dev` (Vite dev server), `npm run build` (type-check + production build),
`npm run test` (Vitest), `npm run lint` (ESLint), `npm run preview` (serve the built `dist/`).

## Run on a new host / fork

1. Create an Azure **Static Web App** (deployment source: GitHub; build preset: Custom).
2. Add the **`AZURE_STATIC_WEB_APPS_API_TOKEN`** repo secret Azure generates, and enable Actions.
3. Push to `main` — the workflow builds `app/dist` and deploys it. Confirm a hard-refresh on a deep link
   does not 404 (proves the SPA fallback). Optionally bind a custom domain in the SWA resource.
