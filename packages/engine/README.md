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

Test fixtures used by the RetireGolden apps' own suites ship under
`@retiregolden/engine/testing/*` (they import `vitest`; not part of the
supported runtime API).

## Layout

| Subpath | Contents |
|---------|----------|
| `model/` | Plan schema (Zod), types, migrations |
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
