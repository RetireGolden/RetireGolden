# @retiregolden/engine

Pure-TypeScript retirement-planning engine — the calculation core of
[RetireGolden](https://retiregolden.app/). It projects a household's finances
year by year and models federal + state taxes, Social Security (claiming,
spousal/survivor, PIA from earnings), RMDs, Roth conversions, withdrawal
strategies, insurance, Monte Carlo, and an LP-based optimizer.

Source of truth: [github.com/RetireGolden/RetireGolden](https://github.com/RetireGolden/RetireGolden)
(`packages/engine`). Engineering docs live in the repo's `DOCS/`.

## Runtime contract

- **ESM, Node >=24** (also bundles cleanly for browsers). No CommonJS build.
- **No browser globals, no ambient network, no persistence.** The engine never
  touches `fetch`, `localStorage`, `indexedDB`, or the DOM — enforced by lint.
  IO always crosses an injection seam owned by the consumer:
  - anything stochastic takes an injected seedable RNG (`montecarlo/rng`);
  - the optimizer loads the HiGHS wasm via an optional `locateFile` option
    (`strategies/optimizer`);
  - FedInvest TIPS prices: the engine only parses CSV text
    (`ladder/fedInvest`); fetching and caching are the consumer's job.
- **Deterministic.** Same plan + same options ⇒ bit-identical results.
- **Optional annual cash-flow detail.** Pass `captureAnnualCashFlow: true` to
  `simulatePlan` on a committed deterministic run to publish identity-bearing
  `YearResult.cashFlow` with native-precision reconciliation. It defaults off and
  has no economic effect; see
  [DOCS/features/year-cash-flow.md](../../DOCS/features/year-cash-flow.md).
- Structural evidence-ID hashing is package-internal. Public action boundaries
  accept evidence produced by their canonical upstream boundaries; they do not
  expose a general object hasher. JavaScript cannot reliably detect `Proxy`
  wrappers, so the internal hasher's contract is limited to freshly rebuilt,
  trusted plain data trees and is not a hostile-object validation boundary.
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

`@retiregolden/engine/rules` answers "why is it calculated this way" from the
same records the engine's own tests assert against, so an explanation cannot
drift from the behaviour it explains:

```ts
import { TAX_RULE_REGISTRY } from '@retiregolden/engine/rules'

const { statement, authority, verifiedOn } = TAX_RULE_REGISTRY['irc-408-d-2-annual-pro-rata-basis']
```

The same subpath exports `taxRule(id)`, the sorted `taxRuleIds` array, and
`taxRulesDueForVerification(asOfIsoDate)`.

A versioned JSON Schema for the `Plan` document is derived from `planSchema` and
shipped both as a constant and as a static file, so a non-TypeScript consumer can
learn the plan format:

```ts
import { planJsonSchema, PLAN_SCHEMA_VERSION } from '@retiregolden/engine/schema/current'
```

This current-only subpath is **zod-free** and resolves only to the current
generated constant and plain metadata. Importing it pulls in neither zod, the
plan model, nor any historical generated schema module. The same bytes ship as
`@retiregolden/engine/schema/plan.v5.json` for offline, no-import reads.

Historical schemas have explicit module and JSON entry points:

```ts
import { planJsonSchema as planV4JsonSchema } from '@retiregolden/engine/schema/v4'
```

The module subpaths are `schema/v1` through `schema/v5`; the static artifacts
are `schema/plan.v1.json` through `schema/plan.v5.json`. Existing named imports
from `@retiregolden/engine/schema` remain compatible, including
`planV1JsonSchema` through `planV4JsonSchema`, but that legacy barrel necessarily
loads every historical generated module. New code should use `schema/current`
or one explicit version. The legacy barrel will not be removed before a
semver-major release.

The schema describes the plan's *structure*; it is necessary but not
sufficient — cross-field rules (id references, funding rules, allocation weights
summing to 100%, …) live only in `parsePlan`, which stays the full validator.
Those dropped rules are summarized in the schema's `description` and carried as a
machine-readable `x-retiregolden-unrepresentableConstraints` array on the schema
itself (also exported as `PLAN_SCHEMA_UNREPRESENTABLE_CONSTRAINTS`). The zod-backed
generator behind the artifact is `@retiregolden/engine/schema/generate`
(`generatePlanJsonSchema`), used by the build-time `pnpm generate:schema`.

The engine's own package version is available as a bare string constant, for
consumers that stamp provenance on a document they export:

```ts
import { ENGINE_VERSION } from '@retiregolden/engine/version' // or from the root
```

It is generated from `package.json` into a checked-in constant
(`pnpm generate:version`, guarded by a test) rather than read at runtime,
because the engine ships into browser bundles where there is no package.json to
read. The MCP's `build_plan` accepts this value back as `engineVersion` and warns
when a document was exported under a different engine than the one running.

Test fixtures and deterministic test doubles used by the engine's own suites, and
by those of the planner-UI package, ship under `@retiregolden/engine/testing/*` —
framework-free (no vitest or other test-runner dependency), but not part of the
supported runtime API.

## Layout

| Subpath | Contents |
|---------|----------|
| `model/` | Plan schema (Zod), types, migrations |
| `schema/` | Derived, versioned JSON Schema for the `Plan` document: lightweight `schema/current`, explicit `schema/v1`…`schema/v5` modules, legacy-compatible `schema`, and static `schema/plan.v1.json`…`plan.v5.json` artifacts |
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
| `rules/` | `TAX_RULE_REGISTRY` — every statutory rule the engine implements, as data: the authority it rests on, the reading taken, the contrary reading where one exists, and the date it was last verified against primary sources. Its own subpath, not the root export, because the records carry quoted statutory text |
| `actions/` | Typed retirement-action boundaries — QCD, Roth conversion, HSA, SEPP, owned and inherited IRA execution — plus their exact-cent money and structural-identity primitives. Also published per module (`actions/execution`, `actions/money`, …) |
| `ladder/` | TIPS ladder math, Social Security bridge, FedInvest CSV parsing |
| `allocation/`, `spending/` | Asset classes, spending shape presets |
| `testing/` | Plan fixtures, money matchers, and deterministic tax doubles for consumer test suites |
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
