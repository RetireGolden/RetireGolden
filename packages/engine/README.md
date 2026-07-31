# @retiregolden/engine

Pure-TypeScript retirement-planning engine — the calculation core of
[RetireGolden](https://retiregolden.app/). It projects a household's finances
year by year and models federal + state taxes, Social Security (claiming,
spousal/survivor, PIA from earnings), RMDs, Roth conversions, withdrawal
strategies, insurance, Monte Carlo, and an LP-based optimizer.

Source of truth: [github.com/RetireGolden/RetireGolden](https://github.com/RetireGolden/RetireGolden)
(`packages/engine`). Engineering docs live in the repo's `DOCS/`.

## Runtime contract

- **ESM, Node ≥ 20** (also bundles cleanly for browsers). No CommonJS build.
- **No browser globals, no ambient network, no persistence.** The engine never
  touches `fetch`, `localStorage`, `indexedDB`, or the DOM — enforced by lint.
  IO always crosses an injection seam owned by the consumer:
  - anything stochastic takes an injected seedable RNG (`montecarlo/rng`);
  - the optimizer loads the HiGHS wasm via an optional `locateFile` option
    (`strategies/optimizer`);
  - FedInvest TIPS prices: the engine only parses CSV text
    (`ladder/fedInvest`); fetching and caching are the consumer's job.
- **Deterministic.** Same plan + same options ⇒ bit-identical results.
- Structural evidence-ID hashing is package-internal. Public action boundaries
  accept evidence produced by their canonical upstream boundaries; they do not
  expose a general object hasher. JavaScript cannot reliably detect `Proxy`
  wrappers, so the internal hasher's contract is limited to freshly rebuilt,
  trusted plain data trees and is not a hostile-object validation boundary.
- The owned-IRA penalty prerequisite can accept raw annual SEPP schedule routes,
  rebuild each route's complete inventory from canonical annual character, and
  issue final `iraSeppQualified` zero-penalty decisions only after complete
  reconciliation and exact payment rejoin. Non-success routes remain pending
  and supply no negative-SEPP authority. The pure annual finalizer and
  movement-candidate coordinator now forward these raw routes, accept the
  final qualified outcome, preserve detailed route diagnostics when blocked,
  and bind compact canonical route results into annual evidence. Their public
  staged-date ID builder reproduces planning evidence only; exact coordinator
  rejoin remains the authority, and neither boundary commits movement or
  establishes actionability.
- `coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate` adds
  Plan-identity-authoritative, runtime-snapshot-bound planning evidence around
  that coordinator. It derives the complete Plan owner/year ordinary-withdrawal
  batch and owned non-Roth IRA pool, then requires complete, consistently dated
  opening, year-end, annual basis/line-7, line-8, and exact alive evidence. It
  remains pure and noncommitting: every result keeps movement uncommitted and
  actionability unestablished.
- `executePlanOwnedNonRothIraAnnualWithdrawals` is the separate pure commit
  boundary for that Plan-owned batch. It reruns the coordinator rather than
  accepting a caller-authored coordinated result, passes every blocking arm
  through unchanged, turns an all-zero batch into explicit non-actionable
  refusals, and commits exact opening-to-closing cents only when annual
  character and final penalty evidence are bound. Committed actions preserve
  scheduled versus executed dates and publish normative dispositions,
  per-allocation tax character and penalty evidence, and one collision-checked
  structural execution ID. This API is not wired into the annual simulator.
- Parameters (tax brackets, limits, SSA tables, Medicare/FPL) are versioned
  data packs under `params/`, with provenance.

## Usage

Deep subpath imports are the primary API; the root export covers the core
validate-and-project loop:

```ts
import { planSchema, simulatePlan } from '@retiregolden/engine'

const plan = planSchema.parse(JSON.parse(planJson))
const result = simulatePlan(plan, { startYear: 2026 })
```

```ts
import { runMonteCarlo } from '@retiregolden/engine/montecarlo/run'
import { packForYear } from '@retiregolden/engine/params'
```

A versioned JSON Schema for the `Plan` document is derived from `planSchema` and
shipped both as a constant and as a static file, so a non-TypeScript consumer can
learn the plan format:

```ts
import { planJsonSchema, PLAN_SCHEMA_VERSION } from '@retiregolden/engine/schema'
```

This subpath is **zod-free** — it resolves only to the generated constant and
plain metadata, so importing it pulls in neither zod nor the plan model. The same
bytes ship as `@retiregolden/engine/schema/plan.v3.json` for offline, no-import
reads; the historical v1 artifact remains available at its versioned subpath.
The schema describes the plan's *structure*; it is necessary but not
sufficient — cross-field rules (id references, funding rules, allocation weights
summing to 100%, …) live only in `parsePlan`, which stays the full validator.
Those dropped rules are summarized in the schema's `description` and carried as a
machine-readable `x-retiregolden-unrepresentableConstraints` array on the schema
itself (also exported as `PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS`). The zod-backed
generator behind the artifact is `@retiregolden/engine/schema/generate`
(`generatePlanJsonSchema`), used by the build-time `npm run generate:schema`.

The engine's own package version is available as a bare string constant, for
consumers that stamp provenance on a document they export:

```ts
import { ENGINE_VERSION } from '@retiregolden/engine/version' // or from the root
```

It is generated from `package.json` into a checked-in constant
(`npm run generate:version`, guarded by a test) rather than read at runtime,
because the engine ships into browser bundles where there is no package.json to
read. The MCP's `build_plan` accepts this value back as `engineVersion` and warns
when a document was exported under a different engine than the one running.

Test fixtures used by the RetireGolden apps' own suites ship under
`@retiregolden/engine/testing/*` — framework-free (no vitest or other
test-runner dependency), but not part of the supported runtime API.

## Layout

| Subpath | Contents |
|---------|----------|
| `model/` | Plan schema (Zod), types, migrations |
| `schema/` | Derived, versioned JSON Schema for the `Plan` document (`planJsonSchema`, `PLAN_SCHEMA_VERSION`) + shipped current `schema/plan.v3.json` and historical v1/v2 artifacts |
| `params/` | Annual parameter packs (tax brackets, limits, RMD, Medicare, SS, state) + typed accessors |
| `tax/` | Federal + state tax engine, ACA credit, Medicare/IRMAA |
| `rmd/` | Required minimum distributions (SECURE 2.0) |
| `socialSecurity/` | Claiming factors, NRA/FRA, PIA from earnings, spousal/survivor/family-maximum, disability |
| `longevity/` | SSA 2022 period life table + shared types |
| `strategies/` | Roth-conversion sizing (fill-to-target), withdrawal ordering, SEPP, inherited-IRA, the optimizer |
| `projection/` | Deterministic annual ledger + summaries/comparison |
| `montecarlo/` | Seedable RNG, market models (lognormal, historical bootstrap), path runner + aggregation, mortality/survival |
| `scenarios/` | Scenario patch apply/diff + side-by-side comparison |
| `decisions/`, `insights/` | Candidate evaluation, recommendation detectors |
| `ladder/` | TIPS ladder math, Social Security bridge, FedInvest CSV parsing |
| `allocation/`, `spending/` | Asset classes, spending shape presets |
| `testing/` | Plan fixtures and money matchers for consumer test suites |
| `version` | `ENGINE_VERSION` — this package's version, generated from `package.json` |

## License

**AGPL-3.0-only** (see [LICENSE](LICENSE)). The engine is free and un-gutted —
the full math ships in the free web app.

RetireGolden, LLC also ships a commercial desktop edition built from this same
engine under a separate commercial license, which funds the free one. That
dual-license arrangement is why contributions to the
[upstream repo](https://github.com/RetireGolden/RetireGolden) require a
one-time [Contributor License Agreement](https://github.com/RetireGolden/RetireGolden/blob/main/CLA.md)
— you keep your copyright; the CLA lets the LLC also ship your contribution in
the commercial edition. See
[CONTRIBUTING.md](https://github.com/RetireGolden/RetireGolden/blob/main/CONTRIBUTING.md).
