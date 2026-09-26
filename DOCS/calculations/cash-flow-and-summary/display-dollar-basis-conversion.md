## Claim

Kind: formula. `projection/dollarBasis.ts` converts a nominal amount `x` of projection year `y` to start-year ("today's") dollars as `x / f(y)`, and a start-year amount to year-`y` dollars as `x × f(y)`, where `f(y)` is the ledger's own cumulative general-inflation factor `YearResult.inflationScale`: the left-to-right product of `(1 + inflationPct/100)` taken `y − startYear` times from 1. The FI target line (`display-fi-target-annual`) is `ProjectionSummary.fiNumber` placed through the same basis: `todayForDisplay(basis, mode, y, fiNumber)`, which is `fiNumber` itself in today's-dollar mode and `fiNumber × f(y)` in nominal mode.

Constructors: `projectionDollarBasis(result)` reads `result.years[k].inflationScale`; `planDollarBasis(inflationPct, startYear, endYear)` runs the ledger's recurrence for a page that holds no projection rows (the relocation and spending-solver pages). Conversions: `inflationFactor`, `toTodayDollars`, `toNominalDollars`, `nominalForDisplay`, `todayForDisplay`; and `insights/detectorProjection.ts#detectorProjection`, whose `deflate` is `toTodayDollars` on the run's own basis.

## Justification

The ledger runs in nominal dollars and publishes on every row the factor it grew that year's inflation-linked amounts by (`projection/simulate.ts`: `cumInfl[i + 1] = cumInfl[i] × (1 + r)` from `cumInfl[0] = 1`, with `r = inflationPct / 100` in a deterministic run; the published factor is `cumInfl[y − s] / cumInfl[0]`, and `cumInfl[0] = 1`). Dividing a year's nominal amount by that factor states it in the dollars of the ledger's first year, the only year whose factor is exactly 1. Using the ledger's factor rather than a second formula makes "today's dollars" mean the same thing on every page (owner decision R19, 2026-09-25). A start-year figure such as `fiNumber` is already in the basis a today's-dollar page shows, so no conversion applies to it there.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| General inflation `i` | 2.5 | percent per year |
| Start year `s` | 2026 | calendar year |
| Horizon end `E` (worked plan) | 2066 | calendar year |
| Amount `A` | 1,000,000 | nominal USD in the year named |
| `fiNumber` | 1,234,567.89 | start-year USD |
| Chart year for the FI target | 2036 | calendar year |

Worked plan for the ledger identity: a single filer born 1963-01-01 (planning age 95) with one 1,000 cash account and `inflationPct = 2.5`, simulated 2026 to 2066 (41 rows).

## Arithmetic

Exact factors are powers of `41/40`:

- `f(2027) = 1.025`; `f(2031) = 41⁵/40⁵ = 1.131408212890625` exactly.
- `f(2036) = 41¹⁰/40¹⁰ = 1.28008454419635782241…`; `f(2066) = (41/40)⁴⁰ = 2.68506383838997273151…`.

Binary64, by the recurrence (what the ledger publishes and `planDollarBasis` computes): `f(2031) = 1.1314082128906247`, `f(2036) = 1.2800845441963566`, `f(2066) = 2.685063838389963`. The retired page formula `Math.pow(1.025, n)` gives `1.1314082128906244` for `n = 5`; over `n = 0..40` the two differ in 21 of 41 years, first at `n = 3` (`1.0768906249999999` against `1.0768906249999997`), always by one unit in the last place.

Conversions of `A`: from 2036, `1,000,000 / 1.28008454419635782241… = 781,198.401725726627…`; from 2031, `883,854.287609516904…`.

FI target, nominal mode, 2036: `1,234,567.89 × 1.28008454419635782241… = 1,580,351.2747501092…`. Today mode: `1,234,567.89` in every year.

## Expected

1. `planDollarBasis(2.5, 2026, 2066).factors[k]` and `projectionDollarBasis(result).factors[k]` equal `result.years[k].inflationScale` bit for bit for every `k = 0..40` of the worked plan.
2. `inflationFactor(basis, 2026) = 1` exactly.
3. `f(2036)` and `f(2066)` within relative `1e-12` of the exact powers (40 multiplications add at most `40 × 2⁻⁵³ ≈ 4.4e-15` relative error).
4. `toTodayDollars(basis, 2036, 1,000,000)` within `$0.000001` of `781,198.401725726627`; from 2031 within `$0.000001` of `883,854.287609516904`; back to nominal within one unit in the last place of 1,000,000.
5. `nominalForDisplay(basis, 'nominal', 2036, 1,000,000)` is exactly 1,000,000; `todayForDisplay(basis, 'today', y, 1,234,567.89)` is exactly 1,234,567.89 for every `y` in 2026 to 2066.
6. FI target in nominal mode, 2036: `1,580,351.27475011` within `$0.000001`.
7. Refusals: years 2025, 2067 and 2030.5 throw `RangeError`; a projection whose row 3 has no `inflationScale` throws; an inflation rate of −100 is refused; a projection with no rows gives an empty basis in which every year throws.

## Wrong readings

- The healthcare rate as the basis (`inflationPct + healthcareExtraInflationPct`, 4.5%): the 2036 factor is `1.045¹⁰ = 1.5530`, not `1.2801`.
- Exponent `y − s + 1`: `f(2026) = 1.025` and 1,000,000 of 2036 deflates to `762,144.78` instead of `781,198.40`.
- Anchoring on the render-time clock instead of the projection's start year: one year's factor off across a New Year.
- Extrapolating past `E`: a surface asking for 2067 must fail, not receive `1.025⁴¹`.
- Converting the FI target in the wrong direction in nominal mode: `1,234,567.89 / 1.2800845 = 964,442.46`.
- Round-tripping a start-year figure (`x × f / f`) in today's mode: equal to `x` in about 91% of amounts and one unit in the last place off otherwise.

## Family

outputs: `display-dollar-basis-conversion`, `display-fi-target-annual`.

feeds: the display families that pass through the basis: `display-balance-by-category-annual`, `display-net-care-cost-annual`, `display-tax-free-gains-room-annual`, `display-tax-plus-penalties-annual`, `display-total-spending-annual`, `display-upside-shortfall-annual`, `display-upside-spending-annual`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a` and exact rational arithmetic (`(41/40)ⁿ` with BigInt), without taking any expected value from the engine. Checked by a second claude agent that did not derive it, which confirmed every value and asked that the Pro app's two readers of the page's `deflate` be kept working (they are: `deflate` stays as a delegation). Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
