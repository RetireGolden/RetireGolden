# Architecture

The current, ground-truth architecture of RetireGolden. For where specific code lives see
[code-map.md](code-map.md); for the conventions new work should follow see [standards.md](standards.md).

## What it is

A **single static single-page app** — Vite + React 19 + TypeScript (strict) + Vitest — that runs entirely
in the browser and is hosted on Azure Static Web Apps. There is **no backend, no account, and no network
call for user data**; everything computes client-side and persists in the browser. The app makes exactly
**one outbound network request**, and only on an explicit click: the opt-in FedInvest TIPS price fetch
(`engine/ladder/fedInvest.ts`, day-cached, zero-network CSV import fallback) — the CSP's `connect-src` is
`'self'` plus `treasurydirect.gov` and nothing else, pinned by `staticwebapp.config.test.ts`. No user data
ever leaves the browser. All app code lives under `app/` (it is *not* an npm-workspaces monorepo — see the
note below).

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

1. **Pure engine, React shell.** The financial math lives in a pure-TypeScript engine with a hard boundary
from the UI, enforced by ESLint (`app/eslint.config.js`: `src/engine/**` may not import React, recharts,
`idb`, app-layer code, or touch `localStorage`/`indexedDB`/`document`/`window`). The engine is the
product's durable asset; the UI is replaceable around it. The original app's SS and longevity math —
roughly the highest-value third of the old codebase — ported forward into this engine; the shell, data
model, and persistence were rebuilt around a plan-centric model.
2. **Local-first, browser-only, forever.** No backend. Static hosting stays free; privacy is structural,
not a policy. JSON export/import is the portability and backup story. This is a permanent constraint,
not a v1 limitation.
3. **Deterministic first, stochastic second.** A transparent year-by-year ledger the user can audit is the
core artifact; Monte Carlo and the optimizer **wrap that same `simulate` function** — never a second,
simplified model that could diverge.
4. **Parameters are data, not code.** Tax brackets, limits, SSA tables, and Medicare/FPL numbers live in
versioned parameter packs; the annual refresh is a data change (see [maintenance-schedule.md](maintenance-schedule.md)).

> **Not a packages/ monorepo.** Earlier design docs proposed an `app/packages/{engine,params-data,ui}`
npm-workspaces layout. That was never adopted — the engine/UI boundary is enforced by **folder
discipline + ESLint** inside a single `app/src/` tree instead. This doc reflects current reality.

## Layers

### Engine (`app/src/engine/`) — pure domain math

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

Social Security math (PIA from earnings, bend points, mySSA XML, break-even, marital benefits, claim
factors, expected PV) lives in `src/socialSecurity/` — one home since the 2026-07-08 consolidation folded
the old `engine/socialsecurity/` into it — and the life-table model in `src/longevity/`. These are pure
modules consumed by the engine and planner.

### Data model and persistence (`app/src/engine/model/`, `app/src/data/`)

- A **`Plan`** is the whole household model (people, accounts, income streams, expenses, strategies,
  assumptions, scenarios). Zod schemas define it and infer the types; the same schemas validate imports and
  storage reads. `CURRENT_PLAN_SCHEMA_VERSION` is **1**.
- **Migrations** are a pure `migratePlanToCurrent` step chain (`engine/model/migrations.ts`); the harness
  exists and is tested, though no version bump has been needed yet — additive fields (`stateMoves`,
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

### Simulation core (`app/src/engine/projection/simulate.ts`)

A deterministic annual ledger from the current year to end of plan. Each year, in order: income →
contributions (limit-enforced) → spending need (phased + healthcare incl. IRMAA(MAGI[y−2]) / ACA) → RMDs →
withdrawals + Roth conversions per strategy → **taxes via fixed-point iteration** (withdrawals raise tax
which raises withdrawals; converges in a few rounds) → growth → end-of-year balances. Amounts are nominal
internally; today's-dollars display is a render-time transform. The survivor transition (filing status, SS
step-up, pension survivor %, expense change, insurance death benefit) is handled at the death year. The
engine emits a full per-year `YearResult` ledger that powers the table, charts, CSV, and report with no
recomputation.

- **Monte Carlo** drives the identical `simulate` with stochastic inputs across a **Web Worker pool**
  (`src/mc/`), seedable for reproducibility.
- **The optimizer** (`src/optimize/`) solves a MILP with **HiGHS compiled to WASM** in a worker (the ~3 MB
  wasm loads lazily), emitting a schedule that the exact ledger then re-runs. See [features/optimizer.md](features/optimizer.md).
- **The relocation sweep** (`src/relocation/`) runs the same plan once per candidate state in a Web Worker,
  again through the identical `simulate` — same-ledger discipline holds for every what-if surface (the
  survivor transition view runs `simulate` with death-age overrides on the main projection path).

### UI (`app/src/planner/`, `app/src/routes/`, `app/src/learn/`, `app/src/App.tsx`)

React with React Router. `App.tsx` declares the shell and routes (`/`, `/compare`, `/examples`, `/import`,
`/how-tested`, `/plan/*`, `/learn/*`, `/disclaimer`); plan and learn routes are lazy-loaded. The planner holds plan context, the projection hook,
the entry sections, and the result/analysis/report pages. Charts use Recharts. State is React context +
the IndexedDB store (no Redux/React Query — there is no server). The Learning Center
([features/learning-center.md](features/learning-center.md)) is content authored as structured TypeScript,
bundled for offline use with the PWA.

## Testing

Vitest unit tests co-located as `*.test.ts(x)` — exhaustive on engine edges (bracket boundaries, IRMAA
cliffs, RMD cohorts, FRA cohorts), plus property-style checks (ledger conservation, monotonicity) and an
app-shell smoke test. Owl / PolicyEngine / Open Social Security serve as **offline, dev-time oracles**, not
runtime dependencies. CI runs lint + tests + a type-checked build on every push/PR, plus Semgrep SAST and
ZAP DAST (see [operations/](operations/)).

## Deployment

`npm run build` (`tsc -b && vite build`) emits static files to `app/dist/`, which GitHub Actions uploads to
Azure Static Web Apps; SPA deep links fall back to `/index.html`. A PWA manifest + service worker make the
app installable and offline-capable. Full pipeline in [operations/ci-cd-and-deploy.md](operations/ci-cd-and-deploy.md).