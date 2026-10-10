## Claim

Kind: model. `strategies/optimizer.ts#optimizeSchedule` solves the multi-year conversion and withdrawal model that `#buildOptimizerModel` writes, with HiGHS, and publishes `OptimizedSchedule.schedule`: one `OptimizedYear` per plan year, in order. RetireGolden-MCP returns it whole (`run_optimizer.schedule.schedule[]`).

- `year` is the plan year.
- `conversion`, `withdrawTraditional`, `withdrawInheritedTraditional`, `withdrawOther`, `withdrawTaxable` and `taxableOrdinary` are the solution's values of the year's columns `conv`, `wt` (traditional withdrawal, the required-distribution floor included), `wi` (inherited traditional withdrawal), `wo` (withdrawal from the tax-free bucket of Roth, cash and HSA), `wtax` (sale from the taxable bucket) and `ti` (taxable ordinary income).
- `endTrad`, `endInheritedTrad`, `endOther` and `endTaxable` are the four buckets' balances at the start of the next year, after the year's flows and its growth: the columns `trad`, `inh`, `other` and `taxable` of year t + 1. A plan with no taxable balance or inflow has no taxable bucket, and `endTaxable` is 0.
- `taxableGainRealized` is the published `withdrawTaxable` times the gain fraction `gf = min(1, max(0, 1 − taxableBasisRatio))`.
- `irmaaTier` is the highest tier whose binary is above one half, 0 for none.

The highs package reads each column back from the solution HiGHS prints, which carries six significant digits; every amount is then rounded to cents (`Math.round(100x) / 100`), and a column the solution does not carry reads 0. `OptimizedSchedule.conversions` lists each year whose `conversion` is above $0.50, with the same amount. Units: each year's nominal dollars; the balances at the end of the year.

## Justification

This is the solver's own model, read from `buildOptimizerModel`, not a statute's formula. In it, for each year t with growth factor `g = 1 + growth`:

- `ti ≥ base − deduction + c·conv + w·wt + wi` and `ti ≥ 0`, where `base` is the year's ordinary income before any conversion or discretionary withdrawal, `deduction` the standard deduction with the age-65 addition, and `c` and `w` the taxable fractions of a conversion and a traditional withdrawal (1 here). Every tax term rises with `ti`, so the solution holds `ti` at that floor.
- `ti` is split into the federal brackets' widths, filled from the lowest rate, and the year's tax is `Σ rate × segment` plus the flat state rate times `ti`, plus `surcharge_k` for each IRMAA tier binary that is on.
- Cash: `wt + wi + wo + (1 − ltcgRate × gf) × wtax − tax − save = spendingNeed − exogenousCash`.
- Floors: `wt ≥ trad_t × (1 / rmdDivisor)`, with `1 / rmdDivisor` written to eight decimal places, and `wi ≥ inheritedDistribution`.
- Balances: `trad_{t+1} = g(trad_t − conv − wt)`, `inh_{t+1} = g(inh_t − wi)`, `other_{t+1} = g(other_t + conv − wo + save)`, `taxable_{t+1} = g(taxable_t − wtax)`, inflows aside.
- IRMAA: the year's binary for tier k must be on when its MAGI, `base + conv + wt + wi + gf × wtax`, is over the tier's threshold (the same year's MAGI when the input asks for no lookback, two years before when it does).
- Objective: maximize `c_D × (other_n + taxable_n) + c_DL × (trad_n + inh_n) + 0.000001 × Σ conv`, with `c_D` and `c_DL` the deflator and the deflator times one minus the heir rate, each written to eight decimal places (worksheet `optimizer-schedule-objective-and-lifetime-tax`).

`wo` and `save` enter only as `save − wo`, with opposite columns, so a solution HiGHS returns sets one of them to 0: `withdrawOther` is the net draw on the tax-free bucket when the year needs one and 0 when the year saves, and the saving shows only in the next year's balance. A conversion and a withdrawal saved to the tax-free bucket move the same dollars, so the `0.000001` reward on `conv` makes the solution report that drainage as a conversion and keep `wt` at its floor.

## Inputs

The library example `rmd-irmaa` ("High balances: RMDs & IRMAA", `packages/planner-ui/src/planner/examples/buildRmdIrmaa.ts`): Dana, born 1953, single, 73 in 2026, in Florida (no state income tax); a $1,850,000 traditional IRA, $50,000 of cash and a $400,000 brokerage at a $280,000 cost basis; Social Security at a $3,200 primary insurance amount claimed at 70; base spending of $110,000 and $350 a month of Medicare extras; a 28% heir rate, a 5% return and 2.5% inflation. Each case is an `OptimizerInput` entered by hand from those facts, in the shape `projection/optimizePlan.ts#buildOptimizerInput` builds, short enough for the solution to be derived by hand. Both use the 2026 federal brackets, standard deduction and Medicare amounts (an inflation scale of 1), one person 65 or older, no state tax, no taxable Social Security phase-in and no senior deduction in the solve. Neither carries the example's qualified charitable distribution, $15,000 a year from the IRA: the plan-built input would carry it as an exclusion from the year's ordinary income and a diversion of its required distribution's cash, and it would change the one-year case's figures.

| Input | Case 1 (one year) | Case 2 (varied, two years) |
|---|---:|---:|
| Years | 2026 | 2026, 2027 |
| `base` (taxable Social Security: 85% of `12 × 3,200 × 1.32 = 50,688`) | 43,084.80 | 43,084.80 each year |
| `exogenousCash` (the benefit, entered without cost-of-living increases) | 50,688 | 50,688 each year |
| `spendingNeed` (110,000 + 12 × 350) | 114,200 | 174,200 in 2026 (a $60,000 one-off cost added), 114,200 in 2027 |
| Opening traditional, divisor | 1,850,000, 26.5 | 1,325,000; 26.5 in 2026, 25.5 in 2027 |
| Opening inherited traditional, yearly distribution | 0 | 400,000, 40,000 |
| Opening tax-free bucket (cash) | 50,000 | 0 |
| Opening taxable, basis ratio, gain rate | 400,000, 0.7, 0.15 | 400,000, 0.7, 0.15 |
| Heir rate `L` | 0.28 | 0.10 |
| Growth, deflator | 0.05, 1 / 1.025 | 0.05, 1 / 1.025² |
| IRMAA | priced two years later (none in a one-year plan) | priced on the same year's MAGI |

The divisors are the Uniform Lifetime Table's for 73 and 74. Case 2 varies the example to reach the branches case 1 does not: an inherited IRA drawn $40,000 a year, a sale from the brokerage, an IRMAA tier, a year that saves, and a heir rate low enough that converting does not pay.

Written into the model: `deduction = 16,100 + 2,050 = 18,150`, so `base − deduction = 24,934.8`; `1 / 26.5` as 0.03773585 and `1 / 25.5` as 0.03921569; `gf = 1 − 0.7 = 0.3` and a sale nets `1 − 0.15 × 0.3 = 0.955` per dollar. Single 2026 brackets: 10% to 12,400, 12% to 50,400, 22% to 105,700, 24% to 201,775, 32% to 256,225. IRMAA thresholds 109,000, 137,000 and 171,000; increments `(284.1 − 202.9) × 12 + 14.5 × 12 = 1,148.40` for tier 1 and `(405.8 − 284.1) × 12 + (37.5 − 14.5) × 12 = 1,736.40` for tier 2. The objective weights (worksheet `optimizer-schedule-objective-and-lifetime-tax`): case 1 `c_D = 0.97560976`, `c_DL = 0.70243902`; case 2 `c_D = 0.9518144`, `c_DL = 0.85663296`.

## Arithmetic

Case 1, 2026. A converted dollar moves 1.05 from the traditional bucket to the tax-free one at year end, worth `1.05 × (0.97560976 − 0.70243902) = 0.28682928` in the objective, plus the 0.000001 reward. Its tax `r` is cash, and the cheapest cash is the tax-free bucket, costing `1.05 × 0.97560976 = 1.02439025` per dollar (a sale costs `1.02439025 / 0.955 = 1.07265995`). So converting pays while `0.28682928 > 1.02439025 × r`, that is while `r < 0.28`: through the 24% bracket, not into the 32% one. The floor holds `wt` at `0.03773585 × 1,850,000 = 69,811.3225`, and the reward puts the rest of the drainage in `conv`:

- `ti = 201,775`, so `conv + wt = 201,775 − 24,934.8 = 176,840.2` and `conv = 176,840.2 − 69,811.3225 = 107,028.8775`.
- Tax: `1,240 + 4,560 + 12,166 + 0.24 × 96,075 = 41,024`.
- Cash: `save − wo = 69,811.3225 − 41,024 − (114,200 − 50,688) = −34,724.6775`, so `wo = 34,724.6775` and `save = 0`; nothing is sold and nothing is inherited.
- `other = 1.05 × (50,000 + 107,028.8775 − 34,724.6775) = 1.05 × 122,304.2 = 128,419.41`.
- `trad = 1.05 × (1,850,000 − 176,840.2) = 1.05 × 1,673,159.8 = 1,756,817.79`; `taxable = 1.05 × 400,000 = 420,000`; `inh = 0`.

Case 2. With `L = 0.10` nothing is converted and both floors bind. A traditional dollar kept through 2026 ends worth `1.05 × (0.03921569 × 0.76 × 1.05 × 0.9518144 + 0.96078431 × 1.05 × 0.85663296) = 0.93868`; converting it in 2026 at 24% nets 76 cents, which spares `0.76 / 0.955` of a sale, worth `0.76 / 0.955 × 1.05² × 0.9518144 = 0.83511`. In 2027 a converted dollar's 76 cents are saved, worth `0.76 × 1.05 × 0.9518144 = 0.75955`, against `1.05 × 0.85663296 = 0.89946` kept; an inherited dollar beyond the floor compares the same way (0.83511 against `1.05² × 0.85663296 = 0.94444` in 2026). Any of these would also lift MAGI. The 2026 shortfall is funded by a sale, at `1.05² × 0.9518144 / 0.955 = 1.09882` per net dollar, against `0.93868 / 0.76 = 1.23510` for a traditional dollar drawn beyond the floor; the tax-free bucket is empty.

2026:

- `wt = 0.03773585 × 1,325,000 = 50,000.00125`; `wi = 40,000`; `ti = 24,934.8 + 50,000.00125 + 40,000 = 114,934.80125`.
- Federal tax: `17,966 + 0.24 × (114,934.80125 − 105,700) = 17,966 + 2,216.3523 = 20,182.3523`.
- MAGI `= 43,084.8 + 90,000.00125 + 0.3 × wtax`. With the sale below it is 150,858.36, over 137,000 and not over 171,000: tier 2, surcharges `1,148.40 + 1,736.40 = 2,884.80`. Getting under 137,000 would need about $46,000 less sale, replaced by traditional or inherited dollars that count in MAGI in full, so the tier stands.
- Cash: `0.955 × wtax = 174,200 − 50,688 − 90,000.00125 + 20,182.3523 + 2,884.80 = 56,579.15105`, so `wtax = 59,245.18435`, and `0.3 × wtax = 17,773.55530`.
- `trad = 1.05 × (1,325,000 − 50,000.00125) = 1,338,749.99869`; `inh = 1.05 × 360,000 = 378,000`; `taxable = 1.05 × (400,000 − 59,245.18435) = 357,792.55644`; `other = 0`.

2027:

- `wt = 0.03921569 × 1,338,749.99869 = 52,500.00494`; `wi = 40,000`; `ti = 24,934.8 + 92,500.00494 = 117,434.80494`.
- Federal tax: `17,966 + 0.24 × 11,734.80494 = 20,782.35318`.
- MAGI `= 43,084.8 + 92,500.00494 = 135,584.80494`: over 109,000, not over 137,000, so tier 1, `1,148.40`; the floors fix it.
- Cash: `save = 92,500.00494 − 20,782.35318 − 1,148.40 − (114,200 − 50,688) = 7,057.25175`; `wo = 0`; nothing is sold.
- `other = 1.05 × 7,057.25175 = 7,410.11434`; `trad = 1.05 × (1,338,749.99869 − 52,500.00494) = 1,350,562.49344`; `inh = 1.05 × 338,000 = 354,900`; `taxable = 1.05 × 357,792.55644 = 375,682.18426`.

Published to six significant digits, then cents: case 1's `conv` 107,028.8775 becomes 107,029, `wt` 69,811.3225 becomes 69,811.3, `wo` 34,724.6775 becomes 34,724.7, `other` 128,419.41 becomes 128,419 and `trad` 1,756,817.79 becomes 1,756,820; case 2's 50,000.00125 becomes 50,000, 59,245.18435 becomes 59,245.2, 114,934.80125 becomes 114,935, 357,792.55644 becomes 357,793, 1,338,749.99869 becomes 1,338,750, 52,500.00494 becomes 52,500, 117,434.80494 becomes 117,435, 1,350,562.49344 becomes 1,350,560, 7,410.11434 becomes 7,410.11 and 375,682.18426 becomes 375,682. The 2026 gain is read from the published sale: `59,245.2 × 0.3 = 17,773.56`.

## Expected

| Row | conversion | withdrawTraditional | withdrawInheritedTraditional | withdrawOther | withdrawTaxable | taxableGainRealized | taxableOrdinary | irmaaTier | endTrad | endInheritedTrad | endOther | endTaxable |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Case 1, 2026 | 107,029 | 69,811.3 | 0 | 34,724.7 | 0 | 0 | 201,775 | 0 | 1,756,820 | 0 | 128,419 | 420,000 |
| Case 2, 2026 | 0 | 50,000 | 40,000 | 0 | 59,245.2 | 17,773.56 | 114,935 | 2 | 1,338,750 | 378,000 | 0 | 357,793 |
| Case 2, 2027 | 0 | 52,500 | 40,000 | 0 | 0 | 0 | 117,435 | 1 | 1,350,560 | 354,900 | 7,410.11 | 375,682 |

One row per plan year, in this order. `conversions` is `[{ 2026, 107,029 }]` in case 1 and empty in case 2. Every amount to an absolute tolerance of 0.005: each is a six-significant-digit reading rounded to cents, and none of the solution's values above lies within a few cents of a rounding boundary. The figures are the solution of the highs package the engine pins; an upgrade that puts any of them more than half a cent from the value stated here fails the evidence.

## Wrong readings

- Publishing the solution in cents gives case 1 `conversion` 107,028.88 and `endTrad` 1,756,817.79, and case 2's 2026 `endTaxable` 357,792.56.
- Publishing the year's opening balances gives case 1 `endTrad` 1,850,000 and `endTaxable` 400,000.
- Reporting all of case 1's traditional drainage as a withdrawal, or adding the floor into the conversion, gives `conversion` 0 or 176,840.2.
- Publishing taxable income before the deduction gives case 1 `taxableOrdinary` 219,925.
- Publishing the surplus as a negative draw gives case 2's 2027 `withdrawOther` −7,057.25.
- Taking the gain on the whole sale, not its gain fraction, gives 59,245.2.

## Family

outputs: `optimizer-recommended-conversion-annual` (the solver schedule's per-year amount, which `schedule.conversions[].amount` also publishes), `optimizer-schedule-withdrawal-by-bucket-annual`, `optimizer-schedule-taxable-gain-realized-annual`, `optimizer-schedule-taxable-ordinary-income-annual`, `optimizer-schedule-ending-balance-by-bucket-annual`.

feeds: `optimizer-schedule-lifetime-tax` (taxable income, tier and gain are its inputs), `optimizer-schedule-ending-after-tax-objective` (the last year's balances are what it weighs), `optimizer-schedule-conversion-total` (the sum of `conversions`).

`year` is a coordinate and `irmaaTier` a classification, both census exclusions.

## Provenance

Derived by: claude (Opus 5.5), 2026-10-10, for D-MCP-OPTIMIZER-SCHEDULE, from `strategies/optimizer.ts#buildOptimizerModel`, `#optimizeSchedule` and `projection/optimizePlan.ts#buildOptimizerInput` at RetireGolden main `43876e8d`, and the highs package's solution reader. The arithmetic above was done by hand from the code (a decimal calculator for the products). Two facts it uses were found by running the engine and then read in the code that produces them: the six significant digits of the highs package's solution reader, and the eight-decimal coefficients of the model text (worksheet `optimizer-schedule-objective-and-lifetime-tax`). No expected figure was copied from an engine run; the evidence reads them from the table above. Implemented by the same session. Reviewed by: unreviewed when written; the independent review is recorded below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, by independent recomputation, `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-codex.md` (approved).

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, the sentences added after RetireGolden#792's first review (the example's charitable distribution, the time limit with no incumbent, and what the evidence holds the figures to), `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-recheck-codex.md` (approved in the third round, after two rejections of the solver-coupling sentence).
