# Architecture

The current, ground-truth architecture of RetireGolden. For where specific code lives see
[code-map.md](code-map.md); for the conventions new work should follow see [standards.md](standards.md).

## What it is

A **single static single-page app** — Vite + React 19 + TypeScript (strict) + Vitest — that runs entirely
in the browser and is hosted on Azure Static Web Apps. There is **no backend and no account**; everything
computes client-side and persists in the browser, and **no user data leaves the browser**. At startup the
web host fetches one tiny same-origin, no-store import-availability document; it contains no user data and
fails closed. On an explicit click only, `packages/planner-ui/src/data/fedInvestClient.ts` owns the opt-in
cross-origin FedInvest TIPS price request (day-cached, with a zero-network CSV-import fallback). That public
Treasury request carries only a price date, never plan data. The CSP's `connect-src` is `'self'` plus
`treasurydirect.gov` and nothing else, pinned by `staticwebapp.config.test.ts`.

```
Browser
├── UI layer        React: planner forms, charts, report, Learning Center
│     │  (never computes money math directly)
│     ▼
├── Engine layer    Pure TypeScript: the product's core asset
│     │  deterministic, unit-tested, no React/DOM/storage imports
│     ▼
├── Workers         Monte Carlo pool + optimizer (HiGHS-WASM), off the main thread
└── Persistence     IndexedDB (plans) + JSON backup/restore; UI prefs in localStorage
```

## Headline decisions (and why)

1. **Pure engine, React shell.** The financial math lives in a pure-TypeScript engine
(`packages/engine`, published as `@retiregolden/engine`) with a hard boundary from the UI, enforced by
ESLint (`packages/engine/eslint.config.js`: the engine may not import React, recharts, `idb`, app-layer
code, or touch `localStorage`/`indexedDB`/`document`/`window`/`fetch`). The engine is the product's
durable asset; the UI is replaceable around it. The original app's SS and longevity math — roughly the
highest-value third of the old codebase — ported forward into this engine; the shell, data model, and
persistence were rebuilt around a plan-centric model.
2. **Local-first, browser-only, forever.** No backend. Static hosting stays free; privacy is structural,
not a policy. JSON export/import is the portability and backup story. This is a permanent constraint,
not a v1 limitation.
3. **Deterministic first, stochastic second.** A transparent year-by-year ledger the user can audit is the
core artifact; Monte Carlo and the optimizer **wrap that same `simulate` function** — never a second,
simplified model that could diverge.
4. **Parameters are data, not code.** Tax brackets, limits, SSA tables, and Medicare/FPL numbers live in
versioned parameter packs; the annual refresh is a data change (see [maintenance-schedule.md](maintenance-schedule.md)).

> **Workspace layout.** The repo is a pnpm workspace: the engine lives in `packages/engine`
(published as **`@retiregolden/engine`**) and the planner UI in `packages/planner-ui` (published as
**`@retiregolden/planner-ui`**), so downstream products (the commercial desktop edition) consume the
identical code as pinned dependencies — fix once, ship twice. `app/` is a thin host: entry +
router, PWA/SEO, the cases/e2e harnesses. The web app depends on the packages (Vite aliases both to
their TypeScript source for dev/tests; `tsc -b` type-checks the engine against its built `dist/`
via a project reference, while planner-ui ships TypeScript source as its published form and
requires a Vite-class bundler — see its README). The engine purity boundary is enforced by that
package's own ESLint config. The planner-ui package has **no edition or product awareness**: hosts
compose `<PlannerApp/>` and theme via CSS tokens; anything product-specific lives in the host.

## Layers

### Engine (`packages/engine/src/`) — pure domain math

Deterministic, unit-tested, no UI/DOM/storage imports. Subfolders:

| Folder | Contents |
|--------|----------|
| `model/` | Plan schema (Zod), inferred types, and migrations |
| `params/` | Annual parameter packs (federal `data/`, per-state `state/`) + typed accessors + provenance |
| `tax/` | Federal tax engine, ACA premium credit, Medicare/IRMAA (incl. SSA-44 relief), state tax |
| `rmd/` | Required minimum distributions (SECURE 2.0) |
| `strategies/` | Roth-conversion sizing, withdrawal ordering, SEPP, inherited-IRA, the optimizer |
| `projection/` | The deterministic annual ledger (`simulate.ts`) + annuity payout forms, HECM, relocation sweep, summaries/comparison |
| `montecarlo/` | Seedable RNG, the 15-model market library, mortality, survival percentiles, LTC shock, risk-based guardrail solver, path runner + aggregation |
| `spending/` | Spending layers, Guyton-Klinger guardrails, flexible goals, shape presets, ABW amortized spending |
| `ladder/` | TIPS ladder math, SS bridge sizing, funded ratio, FedInvest quotes |
| `decisions/` | Exact-ledger tournament: candidate generators, evaluation, objectives, annuitization sweep, pension election, SWR comparator, spending solver |
| `insights/` | Detector registry (guardrails, bridge gap, annuitization headroom, widow's penalty, relocation, …) |
| `scenarios/` | Scenario patch apply/diff + side-by-side comparison |

The ledger-consumed Social Security math (PIA from earnings, bend points, claim factors, marital/
survivor benefits, family maximum, disability) lives in the package's `socialSecurity/`, and the SSA
period life table + shared types in its `longevity/`. The app-side analysis features built on top of
them (break-even, expected PV, explain, mySSA XML import) stay in the planner-ui package's
`socialSecurity/`, and the longevity wizard UI in its `longevity/`.

### Data model and persistence (engine `model/`, planner-ui `data/`)

- A **`Plan`** is the whole household model (people, accounts, income streams, expenses, strategies,
  assumptions, scenarios). Zod schemas define it and infer the types; the same schemas validate imports and
  storage reads. `CURRENT_PLAN_SCHEMA_VERSION` is **5**.
- **Migrations** are a pure `migratePlanToCurrent` step chain (`engine/model/migrations.ts`); the harness
  exists and is tested. The v1 -> v2 step adds the retirement-action schedule and deterministic IDs to
  already-present typed legacy actions. The v2 -> v3 step advances to the optional durable IRA
  classification, per-year SEP/SIMPLE activity, and per-donor/year deductible-contribution facts;
  it never infers or promotes them, and explicitly discards a same-named root smuggled into a v1/v2
  input. The v3 -> v4 migration strips any same-named root rather than inventing protected annual tax facts;
  v4 -> v5 writes
  `inflationAdjusted: false` for legacy one-time income (their historical behavior). Earlier additive fields (`stateMoves`,
  `insurance`, `capitalLossCarryforward`, and the July 2026 wave: `incomeFloor`, `spendingPolicy`,
  `expenses.healthcare.ssa44`, annuity payout forms, pension `lumpSumOffer`, HECM) shipped via Zod defaults
  rather than migrations. The plan backup JSON is a documented contract
  ([features/plan-file-format.md](features/plan-file-format.md)) with a pinned v1 export that must stay
  importable forever (CI-enforced).
- **Persistence** is IndexedDB via `idb` (`data/planStore.ts`, DB `retiregolden.v2`, store `plans`); every
  read passes through migration + validation, so corrupt records surface rather than load silently. User plans
  and library **demos** share the same store; demos carry `origin: 'example'` and are excluded from **Your
  plans**, backup export, and Compare via `listUserPlanSummaries()` (missing `origin` is treated as
  `'user'`). JSON backup/restore (`data/v2Backup.ts`) is the export envelope; import rekeys reserved
  `example:*` ids. `localStorage` is used only for UI prefs.

### Simulation core (`packages/engine/src/projection/simulate.ts`)

A deterministic annual ledger from the current year to end of plan. Each year, in order: income →
contributions (limit-enforced) → spending need (phased + healthcare incl. IRMAA(MAGI[y−2]) / ACA) → RMDs →
withdrawals + Roth conversions per strategy → **taxes via fixed-point iteration** (withdrawals raise tax
which raises withdrawals; converges in a few rounds) → growth → end-of-year balances. Amounts are nominal
internally; today's-dollars display is a render-time transform. The survivor transition (filing status, SS
step-up, pension survivor %, expense change, insurance death benefit) is handled at the death year. The
engine emits a full per-year `YearResult` ledger that powers the table, charts, CSV, and report with no
recomputation.

Annual cash-flow reporting is an opt-in extension of that ledger. `SimulateOptions.captureAnnualCashFlow`
defaults off; only the live deterministic Results projection enables it. The committed annual pass publishes
identity-bearing `YearResult.cashFlow` after the year's economic commit, while staging, counterfactual, and
repeated-sweep passes do not publish it. Capture is therefore observational: it must not change balances, tax,
withdrawals, shortfalls, warnings, or any other economic output. The `YearCashFlowReconciliation` block reconciles
sources, funded and unfunded uses, and transfers at native precision; a `notReconciled` year remains
published with machine-readable diagnostics rather than a synthetic plug. The full reporting contract is in
[features/year-cash-flow.md](features/year-cash-flow.md).

The planner-ui projection requests the capture for Results, and its per-year Flow selector opens a dialog backed
by `planner/yearCashFlow/`: cash-flow and transfer Sankeys, a complete accessible detail table, and selected-year
detail CSV. It consumes `YearResult.cashFlow` and applies only the existing display transform; it never
recomputes money math.

All three off-thread surfaces share **one** worker entry, `src/workers/planner.worker.ts`, routing on a
`channel` tag: a bundler builds each worker entry in its own pass, so separate entries would each carry
their own copy of the engine simulation core ([operations/bundle-budget.md](operations/bundle-budget.md)).

- **Monte Carlo** drives the identical `simulate` with stochastic inputs across a **Web Worker pool**
  (`src/mc/`, `monteCarlo` channel), seedable for reproducibility.
- **The optimizer** (`src/optimize/`, `optimize` channel) solves a MILP with **HiGHS compiled to WASM** (the
  ~3 MB wasm loads only when Optimize runs), emitting a schedule that the exact ledger then re-runs. See
  [features/optimizer.md](features/optimizer.md).
- **The relocation sweep** (planner-ui `relocation/`, `relocation` channel) runs the same plan once per candidate state,
  again through the identical `simulate` — same-ledger discipline holds for every what-if surface (the
  survivor transition view runs `simulate` with death-age overrides on the main projection path).

### UI (`packages/planner-ui/src/` — published as `@retiregolden/planner-ui`)

React with React Router; the host owns the router and mounts the exported `<PlannerApp/>`
(`app/src/main.tsx` for the web). `App.tsx` declares the shell and routes (`/`, `/compare`, `/examples`, `/import`,
`/how-tested`, `/plan/*`, `/learn/*`, `/disclaimer`); plan and learn routes are lazy-loaded. The planner holds plan context, the projection hook,
the entry sections, and the result/analysis/report pages. Charts use Recharts. State is React context +
the IndexedDB store (no Redux/React Query — there is no server). The Learning Center
([features/learning-center.md](features/learning-center.md)) is content authored as structured TypeScript,
bundled for offline use with the PWA.

The web host mounts the recovery-capable shell immediately, starts `app/public/import-feature.json` once,
and passes its pending/resolved state through the edition-neutral `PlannerApp.importEnabled` and
`PlannerApp.importResolved` capabilities. File inputs remain unmounted while the request is pending, with
neutral checking copy rather than an incident notice. Invalid, missing, oversized, or non-200 config then
disables every file-backed import surface—the `/import` wizard, existing-plan broker CSV refresh, mySSA XML
earnings import, and FedInvest CSV fallback—before its file input is rendered.
The config is deliberately excluded from the service-worker precache and served `no-store`, so a static
redeploy can change it for the next online refresh/restart. It is not a remote kill switch for a tab that is
already loaded or for an offline desktop package. Manual entry, existing-plan reads, exports, and RetireGolden
backup restore do not use this gate.

## Testing

Vitest unit tests co-located as `*.test.ts(x)` — exhaustive on engine edges (bracket boundaries, IRMAA
cliffs, RMD cohorts, FRA cohorts), plus property-style checks (ledger conservation, monotonicity) and an
app-shell smoke test. Owl / PolicyEngine / Open Social Security serve as **offline, dev-time oracles**, not
runtime dependencies. CI runs lint + tests + a type-checked build on every push/PR, plus Semgrep SAST and
ZAP DAST (see [operations/](operations/)).

## Deployment

`pnpm build` (`tsc -b && vite build`) emits static files to `app/dist/`, which GitHub Actions uploads to
Azure Static Web Apps; SPA deep links fall back to `/index.html`. A PWA manifest + service worker make the
app installable and offline-capable. Full pipeline in [operations/ci-cd-and-deploy.md](operations/ci-cd-and-deploy.md).
