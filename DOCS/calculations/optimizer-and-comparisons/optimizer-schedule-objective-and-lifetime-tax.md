## Claim

Kind: model. `strategies/optimizer.ts#optimizeSchedule` publishes two figures with the schedule it solves, both the solver's own; RetireGolden-MCP returns them as `run_optimizer.schedule.endingAfterTax` and `.lifetimeTax` without running the projection of that schedule.

- `endingAfterTax` is the objective value HiGHS reports at the solution it returns, rounded to cents. The objective `#buildOptimizerModel` writes is `c_D × (O_n + X_n) + c_DL × (T_n + I_n) + 0.000001 × Σ_t conv_t`: the tax-free bucket (Roth, cash and HSA) `O_n` and the taxable bucket `X_n` at the end of the last year in full, the traditional bucket `T_n` and the inherited traditional bucket `I_n` net of the heir rate, and a reward of one millionth of a dollar per converted dollar. `c_D` is the deflator `D = 1 / (1 + i)^n` over the plan's `n` years (`projection/optimizePlan.ts#buildOptimizerInput`, `realDollarFactor`) and `c_DL = D × (1 − L)`, `L` the plan's heir tax rate over 100 unless a caller passes `liquidationRatePct`, each written into the model text to at most eight decimal places. It is in today's dollars at the start of the plan, deflated over `n` years.
- `lifetimeTax` is, rounded to cents, the sum over the plan's years, in each year's nominal dollars, of the readout tax: the federal bracket tax on the year's published `taxableOrdinary`, plus that income times the year's flat state rate, plus the state bracket tax on it when the year has state brackets, plus the cumulative IRMAA surcharges of the year's published tier (each tier's Part B increase over the tier below and its Part D increase, times 12, summed up to the tier), plus the published `taxableGainRealized` times the solver's gain rate (0.15 when the plan has a taxable balance).

## Justification

This is the solver's own model, read from `buildOptimizerModel`, `optimizeSchedule` and `buildOptimizerInput`, not a statute's formula, and nothing in it runs the projection. The objective is the solver's stand-in for the after-tax estate: traditional dollars are haircut at the heir rate because heirs pay income tax on them, the taxable bucket counts in full because of the step-up at death, and the reward breaks the tie between a conversion and a traditional withdrawal saved to the tax-free bucket, which move the same dollars, so the drainage is reported as a conversion. The deflator moves the end of the last year, `n` years after the start, to the start; the engine's own today's-dollar basis (`projection/dollarBasis.ts`) deflates the last year's figures over `n − 1` years. The lifetime tax repeats the tax terms of the model's cash constraint (the federal bracket tax, the state tax and the IRMAA surcharges) and adds the gain tax the constraint nets into a sale's cash (`1 − ltcgRate × gf` per dollar sold), all recomputed from the published per-year values, which the highs package reads from HiGHS's printed solution to six significant digits; the objective value HiGHS prints keeps full precision.

The two figures differ from the projection of the same schedule by construction. The solver's buckets hold only the investable accounts and grow at one blended rate a year; its tax is linear in its variables (one gain rate, and the registered approximations `irc-1-h-optimizer-flat-fifteen-percent-preferential-rate`, `irc-86-a-optimizer-taxable-social-security-linearization`, `usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure` and `usc-42-1395r-i-5-optimizer-uniform-threshold-indexing`); its heir rate falls on every traditional dollar; and it counts IRMAA surcharges as tax, where the projection books them as Medicare premiums.

## Inputs

The two hand-solvable cases of worksheet `optimizer-schedule-year-solution`, built from the library example `rmd-irmaa` (Dana, 73, single: a $1,850,000 traditional IRA, $50,000 of cash, a $400,000 brokerage at a $280,000 basis, Social Security of `12 × 3,200 × 1.32 = 50,688` with 85% taxable, spending of $110,000 plus $4,200 of Medicare extras, a 28% heir rate, 5% growth, 2.5% inflation), whose solutions that worksheet derives:

- Case 1, the example's facts without its qualified charitable distribution, one year (2026), `n = 1`, `L = 0.28`: the deflator `1 / 1.025 = 0.975609756…` is written `c_D = 0.97560976`, and `0.975609756… × 0.72 = 0.702439024…` is written `c_DL = 0.70243902`.
- Case 2, varied, two years (2026 and 2027), `n = 2`, `L = 0.10`: `1 / 1.025² = 0.951814396…` is written `c_D = 0.9518144`, and `0.951814396… × 0.9 = 0.856632956…` is written `c_DL = 0.85663296`.
- Case 3, three years (2026 to 2028) whose spending ($100,000 a year) nothing can fund: no balance, no income, and IRMAA priced two years later, as the plan-built input prices it, so the third year carries tier binaries.
- Case 4, the same over one year, 2026, which carries none.

The 2026 single federal brackets: 10% to 12,400, 12% to 50,400, 22% to 105,700, 24% to 201,775. No state tax. IRMAA increments: tier 1 `1,148.40`, tier 2 `1,736.40`.

## Arithmetic

Case 1. From the solution: `O_1 = 128,419.41`, `X_1 = 420,000`, `T_1 = 1,756,817.79`, `I_1 = 0`, `conv = 107,028.8775`.

- `0.97560976 × (128,419.41 + 420,000) = 0.97560976 × 548,419.41 = 535,043.32897`.
- `0.70243902 × 1,756,817.79 = 1,234,057.36673`.
- Reward: `0.000001 × 107,028.8775 = 0.10703`.
- Objective `= 535,043.32897 + 1,234,057.36673 + 0.10703 = 1,769,100.80272`, so `endingAfterTax = 1,769,100.80`.
- Lifetime tax: the published `taxableOrdinary` is 201,775: `1,240 + 4,560 + 12,166 + 0.24 × 96,075 = 41,024.00`; tier 0, no gain, no state tax.

Case 2. From the solution: `O_2 = 7,410.11434`, `X_2 = 375,682.18426`, `T_2 = 1,350,562.49344`, `I_2 = 354,900`, no conversion.

- `0.9518144 × (7,410.11434 + 375,682.18426) = 0.9518144 × 383,092.29860 = 364,632.76634`.
- `0.85663296 × (1,350,562.49344 + 354,900) = 0.85663296 × 1,705,462.49344 = 1,460,955.38392`.
- Objective `= 1,825,588.15026`, so `endingAfterTax = 1,825,588.15`.
- Lifetime tax, from the published values:
  - 2026: `taxableOrdinary` 114,935, federal `17,966 + 0.24 × 9,235 = 20,182.40`; tier 2, `1,148.40 + 1,736.40 = 2,884.80`; gain 17,773.56 at 0.15, `2,666.034`. Year: `25,733.234`.
  - 2027: `taxableOrdinary` 117,435, federal `17,966 + 0.24 × 11,735 = 20,782.40`; tier 1, `1,148.40`; no gain. Year: `21,930.80`.
  - Sum `= 47,664.034`, so `lifetimeTax = 47,664.03`.

Cases 3 and 4. No column can fund the spending, so HiGHS finds the model infeasible, and the status is `infeasible`. `optimizeSchedule` publishes whatever objective HiGHS reports, rounded: with tier binaries the model is a mixed-integer one, for which HiGHS reports the objective of an infeasible model as positive infinity, which the highs package reads as `Infinity`, and `Math.round(Infinity × 100) / 100` is `Infinity`, which JSON writes as `null`; with none it is a linear one, for which HiGHS reports 0. Which of the two HiGHS reports is its own behaviour, measured on these two inputs, not something the engine's code decides. The solution carries no column values, so every published year reads 0, the tier is 0 and `lifetimeTax = 0`. A solve stopped at the time limit with no incumbent publishes the same way: the objective HiGHS reports, or 0 when it reports none (`optimizeSchedule` reads a missing objective as 0), every year 0, with status `timeout`.

## Expected

| Case | status | endingAfterTax | lifetimeTax |
|---|---|---:|---:|
| Case 1 | optimal | 1,769,100.80 | 41,024.00 |
| Case 2 | optimal | 1,825,588.15 | 47,664.03 |
| Case 3 | infeasible | infinite | 0.00 |
| Case 4 | infeasible | 0.00 | 0.00 |

Dollars to an absolute tolerance of 0.005: each figure is rounded to cents, and neither objective lies within half a mill of a rounding boundary (1,769,100.80272 and 1,825,588.15026). The figures are the solution of the highs package the engine pins; an upgrade that puts any of them more than half a cent from the value stated here fails the evidence. Case 3's `endingAfterTax` is exactly `Infinity`, and case 4's exactly 0.

## Wrong readings

- Reading the deflator and haircut at full precision, not as the model text writes them, gives case 1 `1,769,100.70127 + 0.10703 = 1,769,100.81`.
- Leaving out the conversion reward gives case 1 `1,769,100.70`.
- Not deflating gives case 1 `548,419.41 + 0.72 × 1,756,817.79 + 0.10703 = 1,813,328.33`.
- Deflating over `n − 1` years, the engine's basis for the last year's figures, gives case 2 `(383,092.29860 + 0.9 × 1,705,462.49344) / 1.025 = 1,871,227.85`.
- Counting the inherited bucket in full gives case 2 `1,825,588.15 + 0.09518144 × 354,900 = 1,859,368.04`.
- Charging the solver's own, unrounded taxable income gives case 2 `20,182.35230 + 20,782.35318 + 2,884.80 + 1,148.40 + 2,666.034 = 47,663.94`.
- Leaving out the IRMAA surcharges gives case 2 `43,630.83`; charging only the tier's own increment gives `46,515.63`; leaving out the gain's tax gives `44,998.00`; taxing the whole sale at 0.15 gives `53,884.78`.
- Reading an infeasible solve's objective as always 0, or always infinite, gets one of cases 3 and 4 wrong.

## Measured on a library example

The library example `bracket-fill-roth` (Morgan and Riley, married, 2026 to 2049, $1,100,000 in two IRAs, a 25% heir rate), run as RetireGolden-MCP runs it (`optimizePlan(plan, { startYear: 2026, taxCalculator })` with the federal and state calculators), solves to optimality in milliseconds. Measured on 2026-10-10 at RetireGolden `43876e8d`'s code, not derived:

- `endingAfterTax` is $275,381.73. Installing the same schedule's conversions in the plan and projecting it gives an ending after-tax estate of $470,194.82 in 2049: $266,458.11 in today's dollars on the engine's basis, or $259,959.13 deflated over the solver's 24 years. The solver's figure is $8,923.62 higher on the engine's basis.
- `lifetimeTax` is $181,976.49; the projection's lifetime taxes and penalties are $251,819.58, $69,843.09 more.
- `endingAfterTax` agrees with the objective recomputed from the published last row (`c_D = 0.55287535`, `c_DL = 0.41465652`) within the six-significant-digit reading of that row.

The evidence asserts the agreement, the two written weights exactly, and each of the six measured dollars above to within half a cent of the figure stated (so the two gaps, their differences, to within a cent), and fails otherwise, so a change to the example, the engine or the solver cannot leave them stale; they remain measured, not derived. Of the 29 library examples run the same way, 10 solve infeasible, every one with an infinite `endingAfterTax` (each plan runs longer than two years), and `rmd-irmaa` stopped at the 10-second time limit (status `timeout`), so its figures describe the incumbent HiGHS held when it stopped.

## Family

outputs: `optimizer-schedule-ending-after-tax-objective`, `optimizer-schedule-lifetime-tax`.

## Provenance

Derived by: claude (Opus 5.5), 2026-10-10, for D-MCP-OPTIMIZER-SCHEDULE, from `strategies/optimizer.ts#buildOptimizerModel`, `#optimizeSchedule` and `projection/optimizePlan.ts#buildOptimizerInput` at RetireGolden main `43876e8d`, and the highs package's solution reader. The arithmetic above was done by hand from the code (a decimal calculator for the products). A first engine run on case 1 reported 1,769,100.80 where the hand figure was 1,769,100.81; the cent traced to `fmt` in `optimizer.ts`, which writes every coefficient to at most eight decimal places, and the derivation was redone from that code, not from the output. No expected figure was copied from an engine run; the evidence reads them from the table above. The figures under "Measured on a library example" are measured, as that section says. Implemented by the same session. Reviewed by: unreviewed when written; the independent review is recorded below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, by independent recomputation, `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-codex.md` (approved).

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, the sentences added after RetireGolden#792's first review (the example's charitable distribution, the time limit with no incumbent, and what the evidence holds the figures to), `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-recheck-codex.md` (approved in the third round, after two rejections of the solver-coupling sentence).
