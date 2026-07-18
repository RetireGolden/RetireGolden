# Code map

Where things live, so you can find the right file fast. Pairs with [architecture.md](architecture.md) (the
why) and [standards.md](standards.md) (the conventions).

## Repository top level

The repo is an npm workspace: `npm ci` at the root installs everything; the app consumes the
engine as `@retiregolden/engine` and the planner UI as `@retiregolden/planner-ui` (workspace
dependencies, published to npm from `packages/`).

```
RetireGolden/
├── package.json          workspace root ("app", "packages/*") + cross-workspace scripts
├── app/                  the web host (Vite + React + TS): entry, PWA/SEO, cases harness, e2e
├── packages/engine/      @retiregolden/engine — the pure calculation engine (published to npm)
├── packages/planner-ui/  @retiregolden/planner-ui — the planner React UI (published to npm; ships TS source)
├── DOCS/             this documentation set
├── LICENSE            AGPL-3.0-only (© RetireGolden, LLC); see TRADEMARKS.md for the brand policy
└── .github/workflows/  CI: azure-static-web-apps-retiregolden.yml, owl-parity.yml, semgrep.yml,
                        zap.yml, cla.yml (CLA signatures), publish-engine.yml / publish-planner-ui.yml
                        (npm releases on engine-v* / planner-ui-v* tags)
```

The root `LICENSE` is AGPL-3.0-only; copyright is held by RetireGolden, LLC. `app/THIRD-PARTY-NOTICES.txt` (and the shipped copy
in `app/public/`) attribute every bundled MIT/ISC/0BSD package; regenerate with `npm run licenses`
(see maintenance-schedule.md for the regeneration reminder).

## `app/` — the thin web host

```
app/
├── package.json          deps + scripts; engines: node >= 20
├── eslint.config.js       flat config (the engine-purity rule lives in packages/engine/eslint.config.js)
├── index.html
├── scripts/               local Node/Vite-backed tooling (`cases.mjs`, `owl-parity.mjs`, sitemap generator, license notices)
├── public/                staticwebapp.config.json (SPA fallback), PWA manifest/icons
├── e2e/                   Playwright browser specs
└── src/                   host source (below)
```

## `app/src/` — what the host keeps

- [`main.tsx`](../app/src/main.tsx) — React root; owns `BrowserRouter`, imports
  `@retiregolden/planner-ui/index.css`, and mounts `<PlannerApp/>`. Everything inside the router
  lives in the planner-ui package.
- `cases/` — the exact-ledger case runner, manifest diffing, Owl parity harness, and the standalone
  report regression test (`npm run cases`, `npm run cases:diff`, `npm run owl-parity`).
- Host-level guards: `staticwebapp.config.test.ts` (SWA routing config) and
  `docsConsistency.test.ts` (docs ↔ tree drift).

## `packages/engine/` — `@retiregolden/engine`, pure domain math

The calculation engine, published to npm and consumed by the app via `@retiregolden/engine/<subpath>`
imports (Vite/Vitest alias the package to its TypeScript source for dev and tests; `tsc -b` builds and
type-checks against the real `dist/` through a project reference). No React/DOM/storage/network imports
— enforced by the package's own ESLint config. See [packages/engine/README.md](../packages/engine/README.md).

| Folder (`src/`) | What's here |
|--------|-------------|
| `model/` | `plan.ts` (Zod `Plan` schema, `CURRENT_PLAN_SCHEMA_VERSION`), `migrations.ts` |
| `params/` | `index.ts` (incl. `TRUSTEES_DEFAULT_SS_HAIRCUT`) + `provenance.ts`; federal packs in `data/` (e.g. `year2026.ts`); per-state in `state/` |
| `tax/` | `federalTax.ts` (incl. `applyCapitalLossCarryforward`), `stateTax.ts`, `aca.ts`, `medicare.ts` |
| `allocation/` | `assetClasses.ts` (per-class returns/volatilities/yields, blended-return helpers) |
| `ladder/` | TIPS income floor: `ladderMath.ts` (rung solve, pricing, `realPresentValue`), `bridge.ts` (SS bridge sizing), `fundedRatio.ts`, `fedInvest.ts` (CSV parsing/date math only — the fetch + cache live in the app's `data/fedInvestClient.ts`) |
| `rmd/` | `rmd.ts` |
| `socialSecurity/` | Pure SS math consumed by the ledger: `nra`, `benefitFactor`, `claimFactor`, `piaFromEarnings`, `ssaWageData`, `maritalBenefits`, `survivorBenefit`, `familyMaximum`, `disability` |
| `longevity/` | `ssaPeriod2022.ts` (SSA period life table) + shared `types.ts` |
| `strategies/` | `rothConversion.ts`, `optimizer.ts`, `sepp.ts`, `inheritedIra.ts` |
| `projection/` | `simulate.ts` (the annual ledger), `compare.ts`, `optimizePlan.ts`, `types.ts` (`YearResult`) |
| `montecarlo/` | `marketModels.ts`, `historicalReturns.ts`, `rng.ts`, `mortality.ts`, `survival.ts` (survival-percentile ages), `ltcShock.ts`, `run.ts`, `frontiers.ts` |
| `decisions/` | Shared exact-ledger decision engine: `objectives.ts` (objective policies), candidate `generators.ts`, `evaluateCandidate.ts`, `tournament.ts`, `search.ts`, `spendingSolver.ts`, `swrComparator.ts` (published SWR rules on the user's plan) |
| `spending/` | Spending layers, guardrails, flexible goals, ABW, and shape presets (`layers.ts`, `guardrails.ts`, `flexibleGoals.ts`, `abw.ts`, `shapePresets.ts`) |
| `insights/` | Insight detectors + registry (`runInsights.ts`, `detectors/`) surfaced on the planner Insights page |
| `household/` | `householdGraph.ts` — pure household-topology selector (typed nodes/edges, completeness, entered-value totals) behind the Household map ([features/household-map.md](features/household-map.md)) |
| `scenarios/` | `scenarios.ts` |
| `testing/` | Test fixtures shared with the app's suites (`planFixtures.ts`, `money.ts`), exported as `@retiregolden/engine/testing/*` |

## `packages/planner-ui/` — `@retiregolden/planner-ui`, the planner UI

Everything inside the router, published to npm and consumed by the app (and by downstream hosts)
as `@retiregolden/planner-ui`. The package ships TypeScript source and requires a Vite-class
bundler — see [packages/planner-ui/README.md](../packages/planner-ui/README.md) for the consumer
contract. Vite/Vitest alias it to source in-repo, same as the engine.

Top level of `src/`: `index.ts` (public API: `PlannerApp`, the `PlanStore` seam, the route groups,
`ReportBrandingProvider`), `App.tsx` (app shell: chrome + theme + `useRoutes` over the exported
route groups), `routes/` (`groups.tsx` — the exported `plannerWorkspaceRoutes` /
`plannerContentRoutes` / `plannerHomeRoutes` route-object arrays: `/` plan picker + `/import` in
home; `/plan/*` via lazy `routes/PlanRoutes` + `/compare` in workspace; `/examples`, `/learn/*`
via lazy `routes/LearnRoutes`, `/disclaimer`, `/how-tested` in content; retired v1 routes redirect
to `/`), `RouteErrorBoundary.tsx`, `index.css` (the design-token layer, exported as
`@retiregolden/planner-ui/index.css`), plus the `staticGuards` / `tokenContrast` / `appShell.smoke`
test files.

| Folder (`src/`) | What's here |
|--------|-------------|
| `data/` | Persistence: `planStoreContext.ts` + `PlanStoreProvider.tsx` (the host-implementable `PlanStore` seam and its store-generic `*Via` operations; demo records route to the browser store), `planStore.ts` (the IndexedDB implementation via `idb`, user vs demo filtering), `planOrigin.ts`, `planFormat.ts` (the v2 backup envelope — the stable `plan-format` subpath), `v2Backup.ts` (re-exports the envelope + storage-aware import normalization), `localStore.ts` (guarded localStorage + `STORAGE_KEYS`), `fedInvestClient.ts` (the opt-in FedInvest fetch + cache — the planner's only network touch) |
| `planner/` | The planner UI (see below) |
| `report/` | Self-contained HTML report rendering and browser download helper |
| `mc/` | Monte Carlo Web Worker: `monteCarlo.worker.ts`, `pool.ts`, `runRequest.ts`, `messages.ts` |
| `optimize/` | Optimizer + spending-solver Web Workers: `optimize.worker.ts` (HiGHS-WASM), `spendingSolve.worker.ts`, `runOptimize.ts`, `runner.ts`, `spendingRunner.ts` |
| `relocation/` | Relocation-compare Web Worker: `relocation.worker.ts`, `runRelocation.ts`, `runner.ts`, `messages.ts` (engine in `engine/projection/relocation.ts`) |
| `workers/` | `run.ts` — the generic `runWorkerRequest` helper shared by `mc/`, `optimize/`, and `relocation/` |
| `socialSecurity/` | SS analysis features on top of the engine's SS math: `expectedPv`, `breakEven`, `explain`, `ficaReturn`, `survivorSwitching`, `ssaStatementXml`, plus form storage/guards (the ledger-consumed math lives in the engine package) |
| `longevity/` | Life-expectancy wizard: `model`, `factors`, `LongevityWizard.tsx`, `LongevityResults.tsx` (the SSA period table + types live in the engine package) |
| `integration/` | Engine-adjacent tests that drive engine code through app harnesses (`useProjection`, the learning registry, the spending solver) |
| `import/` | Import & migration wizard (`/import`): hardened CSV core (`csv.ts`), broker positions mappers (`brokerCsv.ts`), ProjectionLab JSON mapper (`projectionLab.ts`), generic/RPM column-mapping (`genericCsv.ts`), 1040 guided seed (`tenForty.ts`), shared review checklist (`reviewChecklist.ts` + `ReviewChecklistView.tsx`), `ImportPage.tsx` |
| `learn/` | Learning Center: pages, `learningRegistry.ts`, `glossary.ts`, `components/`, 136 articles in `content/` |
| `testSupport/` | `samplePlan.ts` (deprecated shim over the example library); shared fixtures moved to the engine package's `testing/` |

### `packages/planner-ui/src/planner/` highlights

- State/data: `PlanContext.tsx` (autosave incl. pagehide flush), `planContextCore.ts`, `useProjection.ts`.
- Home: `home/` (`useHomeData.ts`, `useHomeMode.ts`, `YourPlans.tsx`, `WelcomeHero.tsx`, getting-started cards, `DataAndPrivacyCard.tsx`).
- Example library: `examples/` (`registry.ts`, `loadExample.ts`, `ExampleLibrary.tsx`, `ExamplesPage.tsx`, `ExamplePreviewBanner.tsx`, per-example `build*.ts`).
- Entry: `PlanPickerPage.tsx`, `PlanWorkspace.tsx`, `sections.tsx` (barrel over `sections/` — one file per
  section + `sectionHelpers.ts`), `fields.tsx`, `SocialSecuritySection.tsx`, `LongevityModal.tsx`,
  `usStates.ts`, `householdActions.ts`.
- Results/analysis: `ResultsPage.tsx`, `ReportPage.tsx`, `SsAnalysisPage.tsx` + `ssAnalysis.ts`,
  `MonteCarloPage.tsx`, `OptimizePage.tsx`, `SpendingSolverPage.tsx`, `ScenariosPage.tsx`,
  `RelocationComparePage.tsx`, `ComparePlansPage.tsx`, `ProvenancePanel.tsx`, `insights/`
  (`InsightsPage.tsx`, `InsightCardView.tsx`).
- Trust layer: `AssumptionsCardPage.tsx` + `assumptionsExport.ts` (per-plan assumptions card with
  provenance tags and copy-export), `explainPanels.tsx` ("why this number" panels on Monte Carlo and
  Optimize), `HowTestedPage.tsx` (`/how-tested` validation story), `provenanceLinks.ts` (cite-the-authority
  `source` links in field help bubbles).
- Shared bits: `format.ts` (the money formatter), `chartStyle.ts` (recharts tooltip style),
  `learnLinks.ts` (`LEARN.*` slugs used by field help).

## Where to find…

`engine:` paths are under `packages/engine/src/`; `cases/` is under `app/src/`; the rest are under
`packages/planner-ui/src/`.

| You want… | Look at |
|-----------|---------|
| The year-by-year projection | `engine: projection/simulate.ts` |
| The plan data shape / schema version | `engine: model/plan.ts` |
| Tax brackets / limits / 2026 numbers | `engine: params/data/year2026.ts` (+ `params/state/`) |
| How a plan is saved/loaded | `data/planStoreContext.ts` (the `PlanStore` seam) over `data/planStore.ts` (IndexedDB default); export in `data/planFormat.ts` / `data/v2Backup.ts` (format contract: `DOCS/features/plan-file-format.md`) |
| Importing from other tools / broker CSVs / a 1040 | `import/` (`ImportPage.tsx`, per-source mappers); balance updates in `planner/sections/UpdateBalancesPanel.tsx` |
| Example library demos | `planner/examples/registry.ts`, `planner/examples/loadExample.ts`, `planner/examples/ExamplesPage.tsx`; `origin` on `Plan` in `engine: model/plan.ts` |
| Local engine-regression manifests | `cases/caseRunner.ts`, `cases/caseDiff.ts`, `scripts/cases.mjs` |
| Self-contained HTML reports | `report/reportHtml.ts` (renders the model), `report/downloadReport.ts`; UI buttons in `planner/ResultsPage.tsx`, `planner/ReportPage.tsx`, `planner/OptimizePage.tsx` |
| The edition-neutral report data model | `report/reportModel.ts` (`buildReportModel`, stable block ids, JSON/CSV export; published as `@retiregolden/planner-ui/report-model`); goldens in `report/goldens/` |
| Monte Carlo / optimizer entry points | `mc/monteCarlo.worker.ts` / `optimize/optimize.worker.ts` |
| The Social Security PIA math | `engine: socialSecurity/piaFromEarnings.ts`, `socialSecurity/ssaWageData.ts` |
| Learning Center articles + metadata | `learn/learningRegistry.ts`, `learn/content/` |
| Assumption sources shown in the UI | `engine: params/provenance.ts`, `planner/ProvenancePanel.tsx`, `planner/AssumptionsCardPage.tsx`, `planner/provenanceLinks.ts` |
| The in-app validation story | `planner/HowTestedPage.tsx` (`/how-tested`); invariance fixture `engine: decisions/assetLocationInvariance.test.ts` |

## Commands

Install once at the repo root with `npm ci` (npm workspaces). The root `package.json` runs each of
these across all three workspaces (engine, then planner-ui, then app); the same commands run from
`app/` or a `packages/*` directory scope to that workspace.

| Command (repo root) | Does |
|---------|------|
| `npm run dev` | Vite dev server (app) |
| `npm run build` | Engine `tsc -b`, planner-ui `tsc -b` (type check — the package ships source), then app `tsc -b && vite build` + sitemap generation → `app/dist/` |
| `npm run test` | Vitest in every workspace (co-located `*.test.ts(x)`) |
| `npm run test:coverage` | Vitest with the coverage thresholds CI enforces (per workspace) |
| `npm run lint` | ESLint in every workspace (incl. the engine-purity rule) |
| `npm run cases` | Emit a stable exact-ledger case manifest (default: bundled example library) |
| `npm run cases:diff` | Compare two case manifests and exit nonzero on unexpected deltas |
| `npm run owl-parity` | Run the Owl parity oracle harness |

App-only (run from `app/`): `npm run test:e2e` (Playwright specs in `e2e/`), `npm run preview`
(serve the built `dist/`), `npm run licenses`.
