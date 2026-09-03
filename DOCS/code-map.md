# Code map

Where things live, so you can find the right file fast. Pairs with [architecture.md](architecture.md) (the
why) and [standards.md](standards.md) (the conventions).

## Repository top level

The repo is a pnpm workspace (`app` and `packages/*`): `corepack enable` then `pnpm install` at the root
installs everything. It requires Node.js >=24.15.0. The web host consumes the engine as
`@retiregolden/engine` and the planner UI as `@retiregolden/planner-ui` through workspace dependencies;
both packages are published to npm from `packages/`.

```
RetireGolden/
├── package.json          workspace root + cross-workspace scripts (`packageManager`: pnpm)
├── pnpm-workspace.yaml   workspace packages: `app`, `packages/*`
├── app/                  the web host (Vite + React + TS): entry, PWA/SEO, cases harness, e2e
├── packages/engine/      @retiregolden/engine — the pure calculation engine (published to npm)
├── packages/planner-ui/  @retiregolden/planner-ui — the planner React UI (published to npm; ships TS source)
├── DOCS/             this documentation set
├── LICENSE            AGPL-3.0-only (© RetireGolden, LLC); see TRADEMARKS.md for the brand policy
├── .github/workflows/  CI: azure-static-web-apps-retiregolden.yml, grok-code-review.yml, openrouter-code-review.yml, owl-parity.yml,
                        semgrep.yml, zap.yml, cla.yml (CLA signatures), resolve-gate.yml (fresh
                        dependency resolve exercises the pnpm trust policy), publish-engine.yml /
                        publish-planner-ui.yml (npm releases on engine-v* / planner-ui-v* tags)
└── .github/actions/setup-toolchain/  the composite every Node-running job uses for pnpm + Node (single home
                        of the CI Node major and the pnpm store cache); jobs keep their own checkout and install line
```

The root `LICENSE` is AGPL-3.0-only; copyright is held by RetireGolden, LLC. `app/THIRD-PARTY-NOTICES.txt` (and the shipped copy
in `app/public/`) attribute every bundled MIT/ISC/0BSD package; regenerate with `pnpm run licenses`
(see maintenance-schedule.md for the regeneration reminder).

## `app/` — the thin web host

```
app/
├── package.json          deps + scripts; engines: node >=24.15.0
├── eslint.config.js       flat config (the engine-purity rule lives in packages/engine/eslint.config.js)
├── index.html
├── scripts/               local Node/Vite-backed tooling (`cases.mjs`, `owl-parity.mjs`, `check-bundle-budget.mjs` + `bundleBudget.mjs`, `check-css-clamp.mjs` + `cssClamp.mjs` (post-build: the plan-card name clamp survived CSS minification, #533), sitemap generator + `sitemapRoutes.mjs`, license notices; the three Vite-SSR scripts share `viteSsr.mjs`)
├── public/                staticwebapp.config.json (SPA fallback), import-feature.json (no-store file-import incident switch), PWA manifest/icons
├── e2e/                   Playwright browser specs
└── src/                   host source (below)
```

## `app/src/` — what the host keeps

- [`main.tsx`](../app/src/main.tsx) — React root; owns `BrowserRouter`, imports
  `@retiregolden/planner-ui/index.css`, mounts the shell immediately, resolves the fail-closed same-origin
  import switch once through `HostApp.tsx` / `importFeature.ts`, and carries both enabled and resolved state
  into `PlannerApp`.
- `cases/` — the exact-ledger case runner, manifest diffing, Owl parity harness, and the standalone
  report regression test (`pnpm cases`, `pnpm cases:diff`, `pnpm owl-parity`).
- Host-level guards: `staticwebapp.config.test.ts` (SWA routing config),
  `themeBootstrap.test.ts` (the pre-React theme paint: `public/theme-bootstrap.js` reads the switcher's
  storage key, is loaded from the shell head, and is served on a plan deep link, #538), and
  `docsConsistency.test.ts` (docs ↔ tree drift).

## `packages/engine/` — `@retiregolden/engine`, pure domain math

The calculation engine, published to npm and consumed by the app via `@retiregolden/engine/<subpath>`
imports (Vite/Vitest alias the package to its TypeScript source for dev and tests; `tsc -b` builds and
type-checks against the real `dist/` through a project reference). No React/DOM/storage/network imports
— enforced by the package's own ESLint config. See [packages/engine/README.md](../packages/engine/README.md).

| Folder (`src/`) | What's here |
|--------|-------------|
| `model/` | `plan.ts` (Zod `Plan` schema, `CURRENT_PLAN_SCHEMA_VERSION`), `planCrossFieldChecks.ts` (the named cross-field validators `plan.ts`'s `superRefine` delegates to), `migrations.ts` |
| `schema/` | Plan JSON Schema package surfaces: lightweight current entry (`current.ts`), legacy compatibility barrel (`index.ts`), explicit generated versions (`plan.v1..v5.generated.ts`), generator (`generate.ts`), and metadata (`planSchemaMeta.ts`) |
| `rules/` | `records/` (one typed frozen record per statutory rule, in per-domain modules), `taxRuleRegistry.ts` (the types, the spread-composed frozen registry, and the re-verification helpers), `describeRule.ts` (the fixture helper that requires a `produced` reading for an `approximated` record), the conformance and quote-fidelity suites, `approximations/`, and `attestations/` (the per-top-level-directory coverage-attestation shards `coverageAttestations.ts` composes, the same way `records/` composes into `taxRuleRegistry.ts`) |
| `actions/` | Identity-bearing retirement actions: the request contract (`contract.ts`), exact-cent money/identity/structural-ID primitives, the three executors the ledger calls (`execution.ts`, `rothConversionExecution.ts`, `annualQcdExecution.ts`), the conversion-linked funding group, the owned-IRA / beneficiary / SEPP / employer-plan evidence boundaries, and `reasons.ts` (the typed refusal registry) |
| `internal/` | Not part of the package's public API: the bounded annual-attempt driver, the T0 counterfactual liability run, the owned-IRA runtime source-series / replay / settlement chain the simulator runs after each attempt, and `simulatorAnnualPassStateRegistry.ts` (the one capture/restore inventory for the annual pass's rollback state) |
| `params/` | `index.ts` (incl. `TRUSTEES_DEFAULT_SS_HAIRCUT`) + `provenance.ts`; `indexingScale.ts` (the shared IRC 1(j)(3)(B)-family statutory-indexing rule); federal packs in `data/` (e.g. `year2026.ts`); per-state in `state/` |
| `tax/` | `federalTax.ts` (incl. `applyCapitalLossCarryforward`), `stateTax.ts`, `aca.ts`, `medicare.ts` |
| `allocation/` | `assetClasses.ts` (per-class returns/volatilities/yields, blended-return helpers) |
| `ladder/` | TIPS income floor: `ladderMath.ts` (rung solve, pricing, `realPresentValue`), `bridge.ts` (SS bridge sizing), `fundedRatio.ts`, `fedInvest.ts` (CSV parsing/date math only — the fetch + cache live in `planner-ui/src/data/fedInvestClient.ts`) |
| `rmd/` | `rmd.ts` |
| `socialSecurity/` | Pure SS math consumed by the ledger: `nra`, `benefitFactor`, `claimFactor`, `piaFromEarnings`, `ssaWageData`, `maritalBenefits`, `survivorBenefit`, `familyMaximum`, `disability` |
| `longevity/` | `ssaPeriod2022.ts` (SSA period life table) + shared `types.ts` |
| `strategies/` | `rothConversion.ts`, `optimizer.ts`, `sepp.ts`, `inheritedIra.ts` |
| `projection/` | `simulate.ts` (the annual ledger), `compare.ts`, `optimizePlan.ts`, `types.ts` (the façade for the whole projection type surface, `YearResult` included — it re-exports the per-domain slices in `internal/types/`, which the export map keeps unimportable so this stays their one public specifier), `annualPassTransaction.ts` (the checkpoint/rollback the staging probe runs under), `annualCashFlowIds.ts` (stable reporting line IDs), `annualCashFlowYearSites.ts` (capture sites), `annualCashFlowShortfallAttribution.ts` (deterministic residual attribution), `annualCashFlowReconciliation.ts` (native-precision identity and failure diagnostics), `annualCashFlowCapture.ts` (post-commit `YearResult.cashFlow` assembly), `internal/tipsLadderAnnualCashFlow.ts` (the once-per-year TIPS-ladder coupon/maturity/accretion phase, extracted from `simulate.ts`; returns one row per ladder and never sums across them), `optimizerAggregateConversionPromotion*.ts` (turning an aggregate optimizer winner into named requests) |
| `montecarlo/` | `marketModels.ts`, `historicalReturns.ts`, `rng.ts`, `mortality.ts`, `survival.ts` (survival-percentile ages), `ltcShock.ts`, `run.ts`, `frontiers.ts` |
| `decisions/` | Shared exact-ledger decision engine: `objectives.ts` (objective policies), candidate `generators.ts`, `evaluateCandidate.ts`, `tournament.ts`, `search.ts`, `spendingSolver.ts`, `swrComparator.ts` (published SWR rules on the user's plan) |
| `spending/` | Spending layers, guardrails, flexible goals, ABW, and shape presets (`layers.ts`, `guardrails.ts`, `flexibleGoals.ts`, `abw.ts`, `shapePresets.ts`) |
| `insights/` | Insight detectors + registry (`runInsights.ts`, `detectors/`) surfaced on the planner Insights page |
| `scenarios/` | `scenarios.ts`, `taxStrategyEvaluation.ts` (shared TaxStrategyEvaluation evidence contract for the Advisor tax cockpit), `taxStrategyEvaluationRegistryCheck.ts` (opt-in registry validation for limitation refs) |
| `testing/` | Test fixtures and deterministic doubles (`planFixtures.ts`, `money.ts`, `flatTax.ts`) consumed overwhelmingly by the engine's own suites, and by the planner-UI suites, exported as `@retiregolden/engine/testing/*` |

## `packages/planner-ui/` — `@retiregolden/planner-ui`, the planner UI

Everything inside the router, published to npm and consumed by the app (and by downstream hosts)
as `@retiregolden/planner-ui`. The package ships TypeScript source and requires a Vite-class
bundler — see [packages/planner-ui/README.md](../packages/planner-ui/README.md) for the consumer
contract. Vite/Vitest alias it to source in-repo, same as the engine.

Top level of `src/`: `index.ts` (public API: `PlannerApp`, the `PlanStore` seam, the route groups,
`ReportBrandingProvider`, and `PlannerEditionProvider` / `usePlannerEdition` — route-group hosts
override the home label and the two host-specific Disclaimer sections via
`planner/editionContext.ts`), `App.tsx` (app shell: chrome + theme + `useRoutes` over the exported
route groups), `routeTitles.ts` (the non-plan tab titles, shared by the shell and the workspace
not-found page's site-level escapes so the two never drift, #536), `routes/` (`groups.tsx` — the exported `plannerWorkspaceRoutes` /
`plannerContentRoutes` / `plannerHomeRoutes` route-object arrays: `/` plan picker + `/import` in
home; `/plan/*` via lazy `routes/PlanRoutes` + `/compare` in workspace; `/examples`, `/learn/*`
via lazy `routes/LearnRoutes`, `/sources` (redirects to `/learn/sources`), `/disclaimer`,
`/how-tested` in content; retired v1 routes redirect to `/`), `RouteErrorBoundary.tsx`, `staleChunkReload.ts` (stale-deployment recovery: a
`vite:preloadError` listener the web host installs before render, plus the loop-guarded one-shot
reload the error boundary uses as a backstop — the exported route groups mount that boundary
per lazy route, so bare route-group hosts recover too — so a deploy that replaces hashed chunks
under an open tab reloads once instead of dead-ending on "Failed to fetch dynamically imported
module"),
`index.css` (the design-token layer, exported as
`@retiregolden/planner-ui/index.css`), plus the `staticGuards` / `tokenContrast` / `appShell.smoke` /
`appShell.theme` test files. The Design-QA chrome pins live beside the planner as
`planner/designQa.*.test.ts` (`chrome`, `clusterA`, `clusterB`, `clusterC`, `clusterE`, `clusterF`,
`clusterH`, `clusterI`, `clusterJ`, `decisions`, `validation`): each reads the stylesheet block its cluster
appended rather than rendering it, since jsdom computes no layout. A cluster's rendered checks sit in a
sibling file named for what they render: `designQa.clusterC.markup.test.tsx`,
`designQa.clusterH.markup.test.tsx`, `designQa.clusterI.markup.test.tsx` and
`designQa.decisions.markup.test.tsx` (markup) and `designQa.clusterE.dom.test.tsx` (DOM).
`designQa.decisions.*` is the odd one out: it pins the product decisions answered on #495 (the field
warning thresholds in `planner/warnings.ts`, the one fixed form-grid column rhythm, the fill-to-target
bracket select) rather than one QA walk's stylesheet block. The list is by hand; `ls planner/designQa.*` is the truth.

| Folder (`src/`) | What's here |
|--------|-------------|
| `data/` | Persistence: `planStoreContext.ts` + `PlanStoreProvider.tsx` (the host-implementable `PlanStore` seam and its store-generic `*Via` operations; demo records route to the browser store), `planStore.ts` (the IndexedDB implementation via `idb`, user vs demo filtering), `planOrigin.ts`, `planFormat.ts` (the v2 backup envelope — the stable `plan-format` subpath), `v2Backup.ts` (re-exports the envelope + storage-aware import normalization), `localStore.ts` (guarded localStorage + `STORAGE_KEYS`), `fedInvestClient.ts` (the opt-in FedInvest fetch + cache — the planner's only cross-origin network touch) |
| `planner/` | The planner UI (see below) |
| `report/` | Self-contained HTML report rendering and browser download helper |
| `mc/` | Monte Carlo off-thread work: `pool.ts`, `runRequest.ts`, `messages.ts` (the worker entry is shared — see `workers/`) |
| `optimize/` | Optimizer + spending solver: `runOptimize.ts` (HiGHS-WASM), `runSpendingSolve.ts`, `runner.ts`, `spendingRunner.ts` |
| `relocation/` | Relocation compare: `runRelocation.ts`, `runner.ts`, `messages.ts` (engine in `engine/projection/relocation.ts`) |
| `householdMap/` | Household map (`/plan/:id/household-map`): `householdGraph.ts` (pure topology selector — typed nodes/edges, completeness, entered-value totals; engine *types* only), deterministic layered `layout.ts`, sanitized `mapViewModel.ts` (privacy-hide strips every dollar string), `HouseholdMapPage.tsx`; the hide toggle also masks the workspace KPI bar via `planner/privacyContext.tsx` ([features/household-map.md](features/household-map.md)) |
| `workers/` | The planner's **one** Web Worker entry, `planner.worker.ts`, dispatching on the `channel` tag in `channels.ts`; `spawn.ts` holds the single `new Worker(new URL(...))` literal and `run.ts` the generic `runWorkerRequest` helper shared by `mc/`, `optimize/`, and `relocation/`. Vite bundles each worker *entry* in its own build, so separate entries cannot share a chunk — one entry is what keeps the ~740 KB engine core out of the bundle four times over ([operations/bundle-budget.md](operations/bundle-budget.md)) |
| `socialSecurity/` | SS analysis features on top of the engine's SS math: `expectedPv`, `breakEven`, `explain`, `ficaReturn`, `survivorSwitching`, `ssaStatementXml`, plus form storage/guards (the ledger-consumed math lives in the engine package) |
| `longevity/` | Life-expectancy wizard: `model`, `factors`, `LongevityWizard.tsx`, `LongevityResults.tsx` (the SSA period table + types live in the engine package) |
| `integration/` | Engine-adjacent tests that drive engine code through app harnesses (`useProjection`, the learning registry, the spending solver) |
| `import/` | Import & migration wizard (`/import`): hardened CSV core (`csv.ts`), broker positions mappers (`brokerCsv.ts`), ProjectionLab JSON mapper (`projectionLab.ts`), generic/RPM column-mapping (`genericCsv.ts`), 1040 guided seed (`tenForty.ts`), shared review checklist (`reviewChecklist.ts` + `ReviewChecklistView.tsx`), the import-provenance contract + export envelope (`provenance.ts` — browser-free, the stable `import-provenance` subpath) and its source-hash helper (`sourceHash.ts` — Web Crypto, async, called at the UI boundary), the browser-free broker-refresh/reconciliation engine (`refresh.ts` — `classifyRefresh`/`buildRefreshDelta`/`applyRefresh`, the stable `import-refresh` subpath, consumed by `UpdateBalancesPanel.tsx`), the local PDF text extractor (`documentText.ts` — `extractDocumentText`, the stable `document-text` subpath; per-page text with 1-based page numbers as citations, `imageOnly` detection for scanned pages, a result union for every failure, exported caps, worker-free pdfjs behind an **optional** `pdfjs-dist` peer reached only by dynamic import — WS5 spike, deliberately NOT wired into the wizard) and its hand-emitted PDF fixtures (`pdfFixtures.ts` — the repo commits no binary fixtures, so test PDFs are built byte by byte, with multi-line and column layout so the corpus reproduces real spacing artifacts), plus the WS5 accuracy benchmark: `documentCorpus.ts` (eight synthetic documents whose field values and page numbers are declared by hand — the oracle, since the app is never its own) and `documentBenchmark.ts` (general field detectors, precision/recall **per field**, page-citation accuracy, and every miss split into "text present — selection gap" vs "text lost — extraction gap" — `pnpm --filter @retiregolden/planner-ui benchmark:documents`, findings in [features/document-parsing-spike.md](features/document-parsing-spike.md)). The three benchmark-only modules (`pdfFixtures.ts`, `documentCorpus.ts`, `documentBenchmark.ts`) are excluded from the published tarball by `files`, the way `report/goldens` is — only `documentText.ts` ships. The wizard itself (`ImportPage.tsx`) is untouched by WS5 and still offers no PDF upload. Alongside them, the migration-source identifier (`migrationSource.ts` — `identifyMigrationDocument` / `identifyMigrationExport` / `MIGRATION_ADAPTERS` / `buildMigrationReview`, the stable `migration-source` subpath) says WHICH incumbent tool a file came from and publishes what can and cannot be brought over, mapping no fields itself: ProjectionLab is identified structurally and mapped by `projectionLab.ts` unchanged, while RightCapital/eMoney/MoneyGuide are identified only — no substantiated export format exists for them, so the limitations are published instead of a guessed mapping. The report NAMES the pages worth reading and never carries their text: only bounded name excerpts and page numbers become review items, so a caller must keep the extracted `DocumentPage[]` itself (Pro does — WS5's reader emits the per-page notes separately). Name matching is word-bounded with verbatim excerpts, page citations ride as `none` locators (the union has no page kind), and a file naming two tools is reported ambiguous rather than guessed at. |
| `learn/` | Learning Center: pages, `learningRegistry.ts` (types + selectors), `articleIndex.ts` (metadata for all 138 articles, statically imported), `articleBodies.ts` (per-article `import()` map), `glossary.ts`, `components/`, and bodies for all 138 articles in `content/` — 110 modules, since the Example Plans share `examplePlanBodies.ts` |
| `testSupport/` | `samplePlan.ts` (deprecated shim over the example library); shared fixtures moved to the engine package's `testing/`. The jsdom harness also lives here: `vitestSetup.ts` (declares the React act environment once for the package, wired through `test.setupFiles`), `settle.ts` (`waitFor`/`waitForText`/`waitForSelector` and the autosave-debounce constants — every wait is inside `act()`), and `lazyRoutes.ts` (`preloadLazyRoutes`, called from `beforeAll` by files that **wait on** a `lazy()` route's content, plus `lazyRoutes.test.ts`, which pins the loader table against the `lazy()` bindings it mirrors). A file that instead imports the module statically — `learn.test.tsx` with `LearnRoutes` — is already covered, since a top-level import is evaluated before its tests run; a file that renders a lazy route without waiting on its content (the `/learn` title case in `appShell.smoke.test.tsx`) needs neither. A cold lazy chunk takes seconds to evaluate the first time anything in a run imports it — longer than vitest's 5 s test timeout — so without the preload the file that reaches one first fails while the same file passes behind a warm suite. That is an ordering bug, not a slow test: raising the poll budget in `settle.ts` is the wrong fix. |

`import/importAvailability.ts` and `ImportAvailabilityProvider.tsx` form the host-neutral file-import gate
shared by the home card, direct `/import` route, `UpdateBalancesPanel`, mySSA XML earnings import, and
FedInvest CSV fallback. Hosts mounting route groups directly use `ImportAvailabilityProvider`; `PlannerApp`
hosts use the `importEnabled` / `importResolved` props. Omitted configuration preserves normal import behavior.

### `packages/planner-ui/src/planner/` highlights

- State/data: `PlanContext.tsx` (autosave incl. pagehide flush), `planContextCore.ts`, `useProjection.ts`.
- Home: `home/` (`useHomeData.ts`, `useHomeMode.ts`, `YourPlans.tsx`, `WelcomeHero.tsx`, getting-started cards, `DataAndPrivacyCard.tsx`).
- Example library: `examples/` (`registry.ts`, `loadExample.ts`, `ExampleLibrary.tsx`, `ExamplesPage.tsx`, `ExamplePreviewBanner.tsx`, per-example `build*.ts`).
- Entry: `PlanPickerPage.tsx`, `PlanWorkspace.tsx`, `sections.tsx` (barrel over `sections/` — one file per
  section + `sectionHelpers.ts`; `AccountFields.tsx` exhaustively dispatches account families through
  the callback contract in `AccountEditorTypes.ts` to `LiquidAccountEditors.tsx`,
  `PensionAnnuityAccountEditors.tsx`, `PropertyDebtAccountEditors.tsx`,
  `RetirementAccountEditors.tsx`, and `HsaAccountEditor.tsx`, while
  `AccountEditorSharedFields.tsx` owns the common identity, investment, contribution, and estate
  groups), `fields.tsx`,
  `SocialSecuritySection.tsx`, `LongevityModal.tsx`,
  `usStates.ts`, `householdActions.ts`.
- Results/analysis: `ResultsPage.tsx`, `ReportPage.tsx`, `SsAnalysisPage.tsx` + `ssAnalysis.ts`,
  `MonteCarloPage.tsx`, `OptimizePage.tsx`, `SpendingSolverPage.tsx`, `ScenariosPage.tsx`,
  `RelocationComparePage.tsx`, `ComparePlansPage.tsx`, `ProvenancePanel.tsx`, `insights/`
  (`InsightsPage.tsx`, `InsightCardView.tsx`).
- Year cash-flow drill-down: `yearCashFlow/` (`index.ts` selector exports, `buildYearCashFlow.ts` model, `grouping.ts`
  collapse policy, `detailCsv.ts` selected-year serializer, `YearCashFlowDialog.tsx`,
  `YearCashFlowSankey.tsx`) consumes captured `YearResult.cashFlow`; see
  [features/year-cash-flow.md](features/year-cash-flow.md).
- Retirement actions: `sections/RetirementActionsEditor.tsx` (authoring + the migrated-action manual review),
  `sections/RetirementActionQcdAuthoringSection.tsx` + `retirementActionQcdAuthoring.ts`,
  `sections/RetirementActionEligibilityFactsEditor.tsx` + `retirementActionEligibilityFacts.ts` (the IRA
  classification / SEP-SIMPLE activity / deductible-contribution facts an action needs),
  `retirementActionPromotionPanels.tsx` + `retirementActionPromotionCopy.ts` + `optimizePagePromotion.ts`
  (per-verdict optimizer promotion surfaces and the fail-closed Apply read-back).
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
| Importing from other tools / broker CSVs / a 1040 | `import/` (`ImportPage.tsx`, per-source mappers); balance refresh/reconciliation engine in `import/refresh.ts` (`import-refresh` subpath), its panel in `planner/sections/UpdateBalancesPanel.tsx`; which incumbent tool a file came from in `import/migrationSource.ts` (`migration-source` subpath) |
| Example library demos | `planner/examples/registry.ts`, `planner/examples/loadExample.ts`, `planner/examples/ExamplesPage.tsx`; `origin` on `Plan` in `engine: model/plan.ts` |
| Local engine-regression manifests | `cases/caseRunner.ts`, `cases/caseDiff.ts`, `scripts/cases.mjs` |
| Self-contained HTML reports | `report/reportHtml.ts` (renders the model), `report/downloadReport.ts`; UI buttons in `planner/ResultsPage.tsx`, `planner/ReportPage.tsx`, `planner/OptimizePage.tsx` |
| The edition-neutral report data model | `report/reportModel.ts` (`buildReportModel`, stable block ids, JSON/CSV export; published as `@retiregolden/planner-ui/report-model`); goldens in `report/goldens/` |
| Monte Carlo / optimizer entry points | `mc/pool.ts` / `optimize/runner.ts`, both onto the shared `workers/planner.worker.ts` |
| The Social Security PIA math | `engine: socialSecurity/piaFromEarnings.ts`, `socialSecurity/ssaWageData.ts` |
| Learning Center article metadata | `learn/articleIndex.ts` (selectors in `learn/learningRegistry.ts`) |
| Learning Center article bodies | `learn/content/`, loaded through `learn/articleBodies.ts` |
| Assumption sources shown in the UI | `engine: params/provenance.ts`, `planner/ProvenancePanel.tsx`, `planner/AssumptionsCardPage.tsx`, `planner/provenanceLinks.ts` |
| The in-app validation story | `planner/HowTestedPage.tsx` (`/how-tested`); invariance fixture `engine: decisions/assetLocationInvariance.test.ts` |
| The household map (topology view) | `householdMap/` (`householdGraph.ts` pure graph selector, layout, sanitized view model, page); reconciliation test in `integration/householdGraphReconciliation.test.ts` |

## Commands

Install once at the repo root with `corepack enable` then `pnpm install` (pnpm workspaces). The root `package.json` runs each of
these across all three workspace packages (engine, then planner-ui, then app); the same commands run from
`app/` or a `packages/*` directory scope to that workspace.

| Command (repo root) | Does |
|---------|------|
| `pnpm dev` | Vite dev server (app) |
| `pnpm build` | Engine `tsc -b`, planner-ui `tsc -b` (type check — the package ships source), then app `tsc -b && vite build`, the bundle budget, the CSS clamp gate (`check-css-clamp.mjs`), and sitemap generation → `app/dist/` |
| `pnpm test` | Vitest in every workspace (co-located `*.test.ts(x)`) |
| `pnpm test:coverage` | Vitest with the coverage thresholds CI enforces (per workspace) |
| `pnpm lint` | ESLint in every workspace (incl. the engine-purity rule) |
| `pnpm cases` | Emit a stable exact-ledger case manifest (default: bundled example library) |
| `pnpm cases:diff` | Compare two case manifests and exit nonzero on unexpected deltas |
| `pnpm owl-parity` | Run the Owl parity oracle harness |
| `pnpm bundle-budget` | Print `app/dist/` against the size budget without failing ([operations/bundle-budget.md](operations/bundle-budget.md)); the build runs the failing form |

Package-only: `pnpm --filter @retiregolden/planner-ui benchmark:documents` prints the WS5 PDF
text-extraction accuracy report (per-field precision/recall over a hand-built synthetic corpus; add
`-- --json` for the machine-readable form). Findings:
[features/document-parsing-spike.md](features/document-parsing-spike.md).

App-only (run from `app/`): `pnpm test:e2e` (Playwright specs in `e2e/`), `pnpm preview`
(serve the built `dist/`), `pnpm run licenses`.
