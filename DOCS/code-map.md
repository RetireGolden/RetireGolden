# Code map

Where things live, so you can find the right file fast. Pairs with [architecture.md](architecture.md) (the
why) and [standards.md](standards.md) (the conventions).

## Repository top level

```
RetireGolden/
├── app/              the entire application (Vite + React + TS)
├── DOCS/             this documentation set
├── LICENSE            proprietary (All Rights Reserved); Apache-2.0 is the documented future open-source path
└── .github/workflows/  CI: azure-static-web-apps-retiregolden.yml, owl-parity.yml, semgrep.yml, zap.yml
```

The root `LICENSE` is proprietary (All Rights Reserved). `app/THIRD-PARTY-NOTICES.txt` (and the shipped copy
in `app/public/`) attribute every bundled MIT/ISC/0BSD package; regenerate with `npm run licenses`
(see maintenance-schedule.md for the regeneration reminder).

## `app/`

```
app/
├── package.json          deps + scripts; engines: node >= 20
├── eslint.config.js       flat config; encodes the engine-purity rule
├── index.html
├── scripts/               local Node/Vite-backed tooling (`cases.mjs`, `owl-parity.mjs`, sitemap generator, license notices)
├── public/                staticwebapp.config.json (SPA fallback), PWA manifest/icons
└── src/                   all source (below)
```

## `app/src/` — entry points

- [`main.tsx`](../app/src/main.tsx) — React root; mounts `<App/>`.
- [`App.tsx`](../app/src/App.tsx) — app shell + route table. Routes: `/` (plan picker), `/examples` (lazy),
  `/compare` (lazy), `/plan/*` (lazy `routes/PlanRoutes`), `/learn/*` (lazy `routes/LearnRoutes`),
  `/disclaimer`. Retired v1 routes (`/legacy`, `/longevity`, `/social-security`) redirect to `/`.
- [`routes/`](../app/src/routes/) — `PlanRoutes.tsx`, `LearnRoutes.tsx`, `RouteFallback.tsx`.
- `index.css`, `RouteErrorBoundary.tsx`, plus `staticwebapp.config.test.ts` / `appShell.smoke.test.tsx`.

## `app/src/engine/` — pure domain math

(No React/DOM/storage imports — enforced by ESLint.) See [engine/README.md](../app/src/engine/README.md).

| Folder | What's here |
|--------|-------------|
| `model/` | `plan.ts` (Zod `Plan` schema, `CURRENT_PLAN_SCHEMA_VERSION`), `migrations.ts` |
| `params/` | `index.ts` (incl. `TRUSTEES_DEFAULT_SS_HAIRCUT`) + `provenance.ts`; federal packs in `data/` (e.g. `year2026.ts`); per-state in `state/` |
| `tax/` | `federalTax.ts` (incl. `applyCapitalLossCarryforward`), `stateTax.ts`, `aca.ts`, `medicare.ts` |
| `allocation/` | `assetClasses.ts` (per-class returns/volatilities/yields, blended-return helpers) |
| `ladder/` | TIPS income floor: `ladderMath.ts` (rung solve, pricing, `realPresentValue`), `bridge.ts` (SS bridge sizing), `fundedRatio.ts`, `fedInvest.ts` (opt-in live prices — the app's only network touch) |
| `rmd/` | `rmd.ts` |
| `strategies/` | `rothConversion.ts`, `optimizer.ts`, `sepp.ts`, `inheritedIra.ts` |
| `projection/` | `simulate.ts` (the annual ledger), `compare.ts`, `optimizePlan.ts`, `types.ts` (`YearResult`) |
| `montecarlo/` | `marketModels.ts`, `historicalReturns.ts`, `rng.ts`, `mortality.ts`, `survival.ts` (survival-percentile ages), `ltcShock.ts`, `run.ts`, `frontiers.ts` |
| `decisions/` | Shared exact-ledger decision engine: `objectives.ts` (objective policies), candidate `generators.ts`, `evaluateCandidate.ts`, `tournament.ts`, `search.ts`, `spendingSolver.ts`, `swrComparator.ts` (published SWR rules on the user's plan) |
| `spending/` | Spending layers, guardrails, flexible goals, ABW, and shape presets (`layers.ts`, `guardrails.ts`, `flexibleGoals.ts`, `abw.ts`, `shapePresets.ts`) |
| `insights/` | Insight detectors + registry (`runInsights.ts`, `detectors/`) surfaced on the planner Insights page |
| `scenarios/` | `scenarios.ts` |

Pure Social Security claim math consumed by the ledger (`claimFactor.ts`, `expectedPv.ts`) lives in
[`src/socialSecurity/`](../app/src/socialSecurity/) with the rest of the SS module; those two files must
stay pure (no UI/storage imports) because `engine/projection/simulate.ts` imports them.

## `app/src/` — app layer

| Folder | What's here |
|--------|-------------|
| `cases/` | Local exact-ledger case runner, manifest diffing, Owl parity harness, and deterministic JSON helpers (`npm run cases`, `npm run cases:diff`, `npm run owl-parity`) |
| `data/` | Persistence: `planStore.ts` (IndexedDB via `idb`, user vs demo filtering), `planOrigin.ts`, `v2Backup.ts` (JSON export), `localStore.ts` (guarded localStorage + `STORAGE_KEYS`) |
| `planner/` | The planner UI (see below) |
| `report/` | Self-contained HTML report rendering and browser download helper |
| `mc/` | Monte Carlo Web Worker: `monteCarlo.worker.ts`, `pool.ts`, `runRequest.ts`, `messages.ts` |
| `optimize/` | Optimizer + spending-solver Web Workers: `optimize.worker.ts` (HiGHS-WASM), `spendingSolve.worker.ts`, `runOptimize.ts`, `runner.ts`, `spendingRunner.ts` |
| `relocation/` | Relocation-compare Web Worker: `relocation.worker.ts`, `runRelocation.ts`, `runner.ts`, `messages.ts` (engine in `engine/projection/relocation.ts`) |
| `workers/` | `run.ts` — the generic `runWorkerRequest` helper shared by `mc/`, `optimize/`, and `relocation/` |
| `socialSecurity/` | SS math: `nra`, `benefitFactor`, `piaFromEarnings`, `claimFactor`, `expectedPv`, `ssaWageData`, `ssaStatementXml`, `breakEven`, `explain`, `maritalBenefits`, `survivorSwitching` |
| `longevity/` | Ported life-expectancy model: `model`, `factors`, `ssaPeriod2022`, `LongevityWizard.tsx`, `LongevityResults.tsx` |
| `import/` | Import & migration wizard (`/import`): hardened CSV core (`csv.ts`), broker positions mappers (`brokerCsv.ts`), ProjectionLab JSON mapper (`projectionLab.ts`), generic/RPM column-mapping (`genericCsv.ts`), 1040 guided seed (`tenForty.ts`), shared review checklist (`reviewChecklist.ts` + `ReviewChecklistView.tsx`), `ImportPage.tsx` |
| `learn/` | Learning Center: pages, `learningRegistry.ts`, `glossary.ts`, `components/`, 131 articles in `content/` |
| `testSupport/` | Test-only fixtures and helpers (`planFixtures.ts`, `money.ts`, `samplePlan.ts`) |

### `app/src/planner/` highlights

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

| You want… | Look at |
|-----------|---------|
| The year-by-year projection | `engine/projection/simulate.ts` |
| The plan data shape / schema version | `engine/model/plan.ts` |
| Tax brackets / limits / 2026 numbers | `engine/params/data/year2026.ts` (+ `engine/params/state/`) |
| How a plan is saved/loaded | `data/planStore.ts`; export in `data/v2Backup.ts` (format contract: `DOCS/features/plan-file-format.md`) |
| Importing from other tools / broker CSVs / a 1040 | `import/` (`ImportPage.tsx`, per-source mappers); balance updates in `planner/sections/UpdateBalancesPanel.tsx` |
| Example library demos | `planner/examples/registry.ts`, `planner/examples/loadExample.ts`, `planner/examples/ExamplesPage.tsx`; `origin` on `Plan` in `engine/model/plan.ts` |
| Local engine-regression manifests | `cases/caseRunner.ts`, `cases/caseDiff.ts`, `scripts/cases.mjs` |
| Self-contained HTML reports | `report/reportHtml.ts`, `report/downloadReport.ts`; UI buttons in `planner/ResultsPage.tsx`, `planner/ReportPage.tsx`, `planner/OptimizePage.tsx` |
| Monte Carlo / optimizer entry points | `mc/monteCarlo.worker.ts` / `optimize/optimize.worker.ts` |
| The Social Security PIA math | `socialSecurity/piaFromEarnings.ts`, `ssaWageData.ts` |
| Learning Center articles + metadata | `learn/learningRegistry.ts`, `learn/content/` |
| Assumption sources shown in the UI | `engine/params/provenance.ts`, `planner/ProvenancePanel.tsx`, `planner/AssumptionsCardPage.tsx`, `planner/provenanceLinks.ts` |
| The in-app validation story | `planner/HowTestedPage.tsx` (`/how-tested`); invariance fixture `engine/decisions/assetLocationInvariance.test.ts` |

## Commands

Run from `app/`:

| Command | Does |
|---------|------|
| `npm run dev` | Vite dev server |
| `npm run build` | `tsc -b && vite build` + sitemap generation → `app/dist/` |
| `npm run test` | Vitest (co-located `*.test.ts(x)`) |
| `npm run test:coverage` | Vitest with the coverage thresholds CI enforces |
| `npm run test:e2e` | Playwright browser specs in `e2e/` |
| `npm run lint` | ESLint (incl. the engine-purity rule) |
| `npm run preview` | Serve the built `dist/` |
| `npm run cases` | Emit a stable exact-ledger case manifest (default: bundled example library) |
| `npm run cases:diff` | Compare two case manifests and exit nonzero on unexpected deltas |
| `npm run owl-parity` | Run the Owl parity oracle harness |