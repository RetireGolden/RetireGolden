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
| `lint` | push + labeled PR | root `pnpm install --frozen-lockfile` then `pnpm lint` (ESLint in `packages/engine`, `packages/planner-ui`, and `app`) |
| `test` | push + labeled PR | root `pnpm install --frozen-lockfile` then `pnpm test:coverage` (Vitest in `packages/engine`, `packages/planner-ui`, and `app`) |
| `e2e` | push + labeled PR | Playwright browser layout tests (`pnpm test:e2e`) in `app/` |
| `build` | needs `lint`, `test`, `e2e` | root `pnpm build` (engine `tsc -b`, planner-ui `tsc -b`, then app `tsc -b && vite build`, the **bundle budget** — `check-bundle-budget.mjs`, which fails the build when `dist/` is over its measured size limits, see [bundle-budget.md](bundle-budget.md) — the **CSS clamp gate** — `check-css-clamp.mjs`, which fails the build when the emitted stylesheet has lost any declaration of the plan-card name clamp (#533) — and sitemap generation), then the **third-party notices drift check** — re-runs `pnpm --filter retiregolden-web run licenses` and `git diff --exit-code` on `app/THIRD-PARTY-NOTICES.txt` and `app/public/THIRD-PARTY-NOTICES.txt`, so a production dependency change that ships without regenerating the AGPL attribution surface fails here (the generator is deterministic and its provenance digest covers the attributed package set, so a devDependency bump alone does not trip it) — then both packages' pack-smoke scripts (the engine tarball from plain Node ESM; the planner-ui tarball from a scratch Vite consumer, which also pins the single-worker-entry invariant); uploads `app/dist` as the `dist` artifact |
| `deploy` | needs `build`; skipped on PR close | downloads `dist`, deploys via `Azure/static-web-apps-deploy@v1` with `skip_app_build: true`, `app_location: app/dist`; exposes the deployed URL as `preview_url` |
| `dast` | PR only; needs `deploy` | OWASP ZAP baseline scan of the freshly deployed PR preview URL — see [security-scanning.md](security-scanning.md). On unlabeled PRs it still invokes `zap.yml` with an empty URL (the scan job skips itself) so the required nested check reports as skipped instead of hanging on "Expected" |
| `close_pull_request` | PR close | tears down the SWA preview environment |

CI uses **Node 24** (`actions/setup-node`); the workspaces require **Node ≥ 24**. Dependencies install
once at the repo root (`pnpm install --frozen-lockfile` against the root `pnpm-lock.yaml` — the repo is a pnpm workspace).
Semgrep SAST runs as a separate workflow on every push/PR — deliberately **not** label-gated, because the
scan is cheap and it is a Main Guard required check (also in [security-scanning.md](security-scanning.md)).

## Label-gated PR CI

To keep Actions minutes down, PR pushes do **not** run the pipeline by default — review bots can
iterate on a PR without every commit re-running lint/test/e2e/deploy/DAST. The full pipeline runs on a
PR only while it carries the **`run-ci` label**:

- **Apply `run-ci`** only after the automated review reports a clean verdict for the PR's current head
  commit. Applying the label triggers a run immediately, and every later push runs CI too.
  Applying any **other** label never starts or re-runs the pipeline.
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
- Both workflows also **cancel in-progress PR runs** when a newer commit is pushed (concurrency
  groups), so rapid-fire pushes only pay for the latest commit. Pushes to `main` are never cancelled,
  and unrelated label events never cancel a live pipeline.

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
