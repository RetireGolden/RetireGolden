## Claim

Kind: formula. `projection/yearFigures.ts#netCareCost(year)` publishes the year's long-term-care cost left after the modeled LTC insurance benefit: `max(0, careCost − ltcBenefit)`, in nominal dollars of the year. The floor exists only to absorb a floating-point residue: the ledger never pays more benefit than the cost in exact arithmetic, but its sum of per-policy payments can exceed the summed cost by one unit in the last place. A difference below −$0.005 (`ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS`) is refused with an error naming the year.

## Justification

A care episode's gross cost enters `careCost`; each of the person's LTC policies then pays `min(remaining cost, cap)` and the remaining cost falls by the payment (`projection/internal/annualDebtAndLongTermCare.ts#annualLongTermCarePlan`). In exact arithmetic the payments for an episode sum to at most its gross cost, so `careCost − ltcBenefit ≥ 0`. In binary floating point, when a first policy pays less than half the cost, `remaining = gross − pay₁` is rounded, and `pay₁ + remaining` can land one unit in the last place above `gross`. `expenses.total` subtracts the benefit without a floor, so the two can differ by that residue.

## Inputs

| Case | `careCost` | `ltcBenefit` | Note |
|---|---:|---:|---|
| A | 72,000 | 54,000 | one episode, one policy paying its cap |
| B | 60,000 | 0 | care cost, no policy |
| C | 53,932.241304 | `10,756.3 + (53,932.241304 − 10,756.3)` | one episode, two policies: the first pays its cap, the second what remains |
| Refused | 1,000 | 1,000.01 | a benefit above the cost by more than half a cent |
| Ledger | 53,932.24 | the ledger's two payments | a person aged 85 in 2026 with a one-year care episode of 53,932.24 and two lifetime LTC policies with no elimination period, paying 501.68 and 10,000 a month, in plan order |

## Arithmetic

- A: `72,000 − 54,000 = 18,000`.
- B: `60,000 − 0 = 60,000`.
- C: `53,932.241304 − 10,756.3 = 43,175.941304` exactly, which binary64 stores as `43,175.94130400001`; `10,756.3 + 43,175.94130400001 = 53,932.24130400001`, one unit in the last place above the cost. So the difference is `−7.275957614183426e-12`; the floor returns 0 and `|d| < 0.005`, so nothing is refused.
- Refused: `1,000 − 1,000.01 = −0.01 < −0.005`.
- Ledger: the start year's health-inflation factor is exactly 1, so the gross cost is 53,932.24. The first policy's cap is `501.68 × 12 = 6,020.16`, under half the cost, so it pays 6,020.16 and leaves `53,932.24 − 6,020.16`, which the second policy pays in full. `ltcBenefit = 0 + 6,020.16 + (53,932.24 − 6,020.16) = 53,932.240000000005` in binary64, against `careCost = 53,932.24`: the same `−7.28e-12` residue, reached through the ledger.

## Expected

A `18,000`, B `60,000`, C `0` (`+0`, not `−7.28e-12`), all exact. The refused row throws. The ledger case publishes `careCost = 53,932.24`, `ltcBenefit = 6,020.16 + (53,932.24 − 6,020.16)`, a negative difference, and a net care cost of exactly 0.

## Wrong readings

- No floor: case C prints `−$0` and a chart area dips below its axis.
- Gross cost only: case A shows `72,000`.
- Benefit only, or cost plus benefit: `54,000` or `126,000`.
- Reversed subtraction floored at 0: case A shows `0`.
- A silent clamp at any size: a benefit that really exceeds the cost (a ledger error) would be hidden; the refusal makes it loud.

## Family

outputs: `display-net-care-cost-annual`.

feeds: none.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a`; case C's residue was found by the deriver's own search over random cents in plain JavaScript reproducing the ledger's two-policy arithmetic, and the ledger case by the implementer's search over whole-cent monthly benefits (the same residue). Checked by a second claude agent that did not derive it, which confirmed the values and asked for an invariant over the example ledgers, since a refusal from a display function would stop the whole Results table. Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
