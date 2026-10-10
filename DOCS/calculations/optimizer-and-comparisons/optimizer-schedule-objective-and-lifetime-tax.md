## Claim

Kind: model. `strategies/optimizer.ts#optimizeSchedule` publishes two figures with the schedule it solves, both the solver's own; RetireGolden-MCP returns them as `run_optimizer.schedule.endingAfterTax` and `.lifetimeTax` without running the projection of that schedule. Both are published when the solve has a solution, which HiGHS's raw solution says by its primal solution status (`Feasible`): an optimum, or the incumbent a node or time limit stopped at, and then both describe that solution whatever the status. A solve with no solution (an infeasible model, or a limit reached before any incumbent) publishes both as null, with an empty schedule.

- `endingAfterTax` is the objective value in HiGHS's raw solution, rounded to cents. The objective `#buildOptimizerModel` writes is `c_D × (O_n + X_n) + c_DL × (T_n + I_n) + 0.000001 × Σ_t conv_t`: the tax-free bucket (Roth, cash and HSA) `O_n` and the taxable bucket `X_n` at the end of the last year in full, the traditional bucket `T_n` and the inherited traditional bucket `I_n` net of the heir rate, and a reward of one millionth of a dollar per converted dollar. `c_D` is the deflator `D = 1 / f`, `f` the plan's general-inflation factor for its last year on the engine's dollar basis (`projection/optimizePlan.ts#buildOptimizerInput`, `realDollarFactor`, through `projection/dollarBasis.ts#planDollarBasis`): `(1 + i)` compounded left to right over the `n − 1` years from the first plan year to the last, so 1 for a one-year plan. `c_DL = D × (1 − L)`, `L` the plan's heir tax rate over 100 unless a caller passes `liquidationRatePct`; each weight is written into the model text to at most eight decimal places. It is in today's dollars at the start of the plan on the engine's basis: the projection divides its last year's figures by the same `f`.
- `lifetimeTax` is, rounded to cents, the sum over the plan's years, in each year's nominal dollars, of the readout tax: the federal bracket tax on the year's published `taxableOrdinary`, plus that income times the year's flat state rate, plus the state bracket tax on it when the year has state brackets, plus the cumulative IRMAA surcharges of the year's published tier (each tier's Part B increase over the tier below and its Part D increase, times 12, summed up to the tier), plus the published `taxableGainRealized` times the solver's gain rate (0.15 when the plan has a taxable balance).

## Justification

This is the solver's own model, read from `buildOptimizerModel`, `optimizeSchedule` and `buildOptimizerInput`, not a statute's formula, and nothing in it runs the projection. The objective is the solver's stand-in for the after-tax estate: traditional dollars are haircut at the heir rate because heirs pay income tax on them, the taxable bucket counts in full because of the step-up at death, and the reward breaks the tie between a conversion and a traditional withdrawal saved to the tax-free bucket, which move the same dollars, so the drainage is reported as a conversion. The deflator moves the end of the last year to the start by the factor the engine's own today's-dollar basis (`projection/dollarBasis.ts`) gives that year, `n − 1` years of inflation, the same double the projection publishes as the last year's `inflationScale`. The lifetime tax repeats the tax terms of the model's cash constraint (the federal bracket tax, the state tax and the IRMAA surcharges) and adds the gain tax the constraint nets into a sale's cash (`1 − ltcgRate × gf` per dollar sold), all recomputed from the published per-year values. Every value the engine reads, the objective included, comes from HiGHS's raw solution, which HiGHS writes to 16 significant digits (to the thirteenth decimal place below 1,000); the engine reads it through a wrapper around the highs package's solution writer, and publishes nothing from the package's own parse of the pretty print, which carries six.

What a solve with no solution publishes follows from what it has. HiGHS's raw solution then carries no primal point: no column values, so no schedule, and no figure that describes one. HiGHS still reports an objective for some such solves (positive infinity for an infeasible mixed-integer model), but it describes no schedule, so neither figure is published; the status says why, and `projection/optimizePlan.ts#optimizePlan` adds the plan's own projection's depletion year beside a first solve with no solution (`projectionDepletionYear`).

The two figures differ from the projection of the same schedule by construction. The solver's buckets hold only the investable accounts and grow at one blended rate a year; its tax is linear in its variables (one gain rate, and the registered approximations `irc-1-h-optimizer-flat-fifteen-percent-preferential-rate`, `irc-86-a-optimizer-taxable-social-security-linearization`, `usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure` and `usc-42-1395r-i-5-optimizer-uniform-threshold-indexing`); its heir rate falls on every traditional dollar; and it counts IRMAA surcharges as tax, where the projection books them as Medicare premiums.

## Inputs

The two hand-solvable cases of worksheet `optimizer-schedule-year-solution`, built from the library example `rmd-irmaa` (Dana, 73, single: a $1,850,000 traditional IRA, $50,000 of cash, a $400,000 brokerage at a $280,000 basis, Social Security of `12 × 3,200 × 1.32 = 50,688` with 85% taxable, spending of $110,000 plus $4,200 of Medicare extras, a 28% heir rate, 5% growth, 2.5% inflation), whose solutions that worksheet derives:

- Case 1, the example's facts without its qualified charitable distribution, one year (2026), `n = 1`, `L = 0.28`: the last year is the first, `f = 1`, so `c_D = 1`, written `1`, and `c_DL = 0.72`, written `0.72`.
- Case 2, varied, two years (2026 and 2027), `n = 2`, `L = 0.10`: `f = 1.025`, and `1 / 1.025 = 0.975609756…` is written `c_D = 0.97560976`, and `0.975609756… × 0.9 = 0.878048780…` is written `c_DL = 0.87804878`.
- Case 3, three years (2026 to 2028) whose spending ($100,000 a year) nothing can fund: no balance, no income, and IRMAA priced two years later, as the plan-built input prices it, so the third year carries tier binaries.
- Case 4, the same over one year, 2026, which carries none.

The 2026 single federal brackets: 10% to 12,400, 12% to 50,400, 22% to 105,700, 24% to 201,775. No state tax. IRMAA increments: tier 1 `1,148.40`, tier 2 `1,736.40`.

## Arithmetic

Case 1. From the solution: `O_1 = 128,419.41`, `X_1 = 420,000`, `T_1 = 1,756,817.79`, `I_1 = 0`, `conv = 107,028.8775`.

- `1 × (128,419.41 + 420,000) = 548,419.41`.
- `0.72 × 1,756,817.79 = 1,264,908.80880`.
- Reward: `0.000001 × 107,028.8775 = 0.10703`.
- Objective `= 548,419.41 + 1,264,908.80880 + 0.10703 = 1,813,328.32583`, so `endingAfterTax = 1,813,328.33`.
- Lifetime tax: the published `taxableOrdinary` is 201,775: `1,240 + 4,560 + 12,166 + 0.24 × 96,075 = 41,024.00`; tier 0, no gain, no state tax.

Case 2. From the solution: `O_2 = 7,410.11434`, `X_2 = 375,682.18426`, `T_2 = 1,350,562.49344`, `I_2 = 354,900`, no conversion.

- `0.97560976 × (7,410.11434 + 375,682.18426) = 0.97560976 × 383,092.29860 = 373,748.58549`.
- `0.87804878 × (1,350,562.49344 + 354,900) = 0.87804878 × 1,705,462.49344 = 1,497,479.26170`.
- Objective `= 1,871,227.84719`, so `endingAfterTax = 1,871,227.85`.
- Lifetime tax, from the published values (worksheet `optimizer-schedule-year-solution`, in cents):
  - 2026: `taxableOrdinary` 114,934.80, federal `17,966 + 0.24 × 9,234.80 = 20,182.352`; tier 2, `1,148.40 + 1,736.40 = 2,884.80`; gain 17,773.55 at 0.15, `2,666.0325`. Year: `25,733.1845`.
  - 2027: `taxableOrdinary` 117,434.80, federal `17,966 + 0.24 × 11,734.80 = 20,782.352`; tier 1, `1,148.40`; no gain. Year: `21,930.752`.
  - Sum `= 47,663.9365`, so `lifetimeTax = 47,663.94`.

Cases 3 and 4. No column can fund the spending, so HiGHS finds the model infeasible: its raw solution's model status is `Infeasible` and its primal solution status `None`. The status is `infeasible`, the solve has no solution, and `optimizeSchedule` publishes `endingAfterTax` and `lifetimeTax` as null, an empty schedule and no conversions. HiGHS's own objective for these models (positive infinity with case 3's tier binaries, 0 for case 4's linear model) is not read. A solve stopped at the node limit or the time limit before any incumbent publishes the same, with status `node-limit` or `timeout`.

## Expected

| Case | status | endingAfterTax | lifetimeTax |
|---|---|---:|---:|
| Case 1 | optimal | 1,813,328.33 | 41,024.00 |
| Case 2 | optimal | 1,871,227.85 | 47,663.94 |
| Case 3 | infeasible | none | none |
| Case 4 | infeasible | none | none |

"none" is a null figure; cases 3 and 4 also publish an empty schedule and a conversion total of 0. Dollars to an absolute tolerance of 0.005: each figure is rounded to cents, and neither objective lies within half a mill of a rounding boundary (1,813,328.32583 is 0.83 mills above one, and 1,871,227.84719 is 2.19 mills above one), nor the lifetime tax (47,663.9365, 1.5 mills above one). The figures are the solution of the highs package the engine pins; a figure more than half a cent from the value stated here fails the evidence.

## Wrong readings

- Deflating over `n` years, as the engine did before decision D-OPTIMIZER-SOLVER-OUTPUT (case 1's weights written `0.97560976` and `0.70243902`, case 2's `0.9518144` and `0.85663296`), gives case 1 `1,769,100.80` and case 2 `1,825,588.15`.
- Not deflating at all gives case 2 `(383,092.29860 + 0.9 × 1,705,462.49344) = 1,918,008.54`; case 1 is not deflated either way.
- Leaving out the conversion reward gives case 1 `1,813,328.22`.
- Counting the inherited bucket in full gives case 2 `1,871,227.85 + (0.97560976 − 0.87804878) × 354,900 = 1,905,852.24`.
- Charging the six-significant-digit readings of the taxable income and gain (the highs package's own parse, the engine's readout before the decision: 114,935, 117,435 and 17,773.56) gives case 2 `47,664.03`.
- Leaving out the IRMAA surcharges gives case 2 `43,630.74`; charging only the tier's own increment gives `46,515.54`; leaving out the gain's tax gives `44,997.90`; taxing the whole sale at 0.15 gives `53,884.68`.
- Publishing the objective HiGHS reports for an infeasible model, and a lifetime tax of 0, as the engine did before the decision, gives case 3 an `endingAfterTax` of positive infinity and case 4 one of 0, each labelled as an ending after-tax wealth that no schedule has.

## Measured on a library example

The library example `bracket-fill-roth` (Morgan and Riley, married, 2026 to 2049, $1,100,000 in two IRAs, a 25% heir rate), run as RetireGolden-MCP runs it (`optimizePlan(plan, { startYear: 2026, taxCalculator })` with the federal and state calculators), solves to optimality in milliseconds. Measured on 2026-10-10 on RetireGolden `a4002c6b` with this decision's changes, not derived:

- `endingAfterTax` is $282,266.26. Installing the same schedule's conversions in the plan and projecting it gives an ending after-tax estate of $470,194.78 in 2049, or $266,458.08 in today's dollars on the engine's basis, which is now the solver's basis too: the evidence asserts that the solver's deflator is 1 / the projection's own last-year factor. The solver's figure is $15,808.18 higher.
- `lifetimeTax` is $181,976.47; the projection's lifetime taxes and penalties are $251,819.64, $69,843.17 more.
- `endingAfterTax` agrees with the objective recomputed from the published last row (`c_D = 0.56669724`, `c_DL = 0.42502293`, for 23 years of 2.5% inflation) within the cent that row is published in.

The evidence asserts the agreement, the two written weights exactly, and each of the five measured dollars above, and a figure more than half a cent from the stated value fails it (so the two gaps, their differences, are held to within a cent); they remain measured, not derived. Before the decision they were $275,381.73, $470,194.82, $266,458.11, $181,976.49 and $251,819.58: the objective moved by the deflator (23 years in place of 24, a factor of 1.025) and by cents, the rest by cents, because the schedule's conversions are now published in cents of the solution where they were six-significant-digit readings.

Of the 29 library examples run the same way (measured on 2026-10-10 with this decision's changes), 10 have no solution, each with status `infeasible`, null figures and the projection's depletion year beside them; `rmd-irmaa` stops at the 5,000-node limit (status `node-limit`) in about 8 seconds on the deriver's machine, and every other example solves to optimality. The planner-ui guard `examples.optimizerFeasibility.test.ts` holds each example's status and that the first solve has no solution exactly when the projection depletes, which is observed on these examples, not assumed by the engine.

The node limit, measured on 2026-10-10 on rmd-irmaa's model as this decision's code builds it, solved directly with highs 1.15.2 on the deriver's machine, not derived: 5,000 nodes stop at an incumbent objective of 744,755.92 (twice, in 8.2 and 8.9 seconds), and 20,000 nodes stop at the same incumbent. A 120-second limit reached 744,778.64, and a run asking for a 0.01% relative gap stopped at its 300-second limit at 744,815.16 without proving an optimum. The published incumbent is $59.24 (0.008%) below the best objective found in five minutes. Only the node-limit figure is reproducible on another machine; the time-limited ones are this machine's.

## Family

outputs: `optimizer-schedule-ending-after-tax-objective`, `optimizer-schedule-lifetime-tax`.

## Provenance

Derived by: claude (Opus 5.5), 2026-10-10, for D-MCP-OPTIMIZER-SCHEDULE, from `strategies/optimizer.ts#buildOptimizerModel`, `#optimizeSchedule` and `projection/optimizePlan.ts#buildOptimizerInput` at RetireGolden main `43876e8d`, and the highs package's solution reader. The arithmetic above was done by hand from the code (a decimal calculator for the products). A first engine run on case 1 reported 1,769,100.80 where the hand figure was 1,769,100.81; the cent traced to `fmt` in `optimizer.ts`, which writes every coefficient to at most eight decimal places, and the derivation was redone from that code, not from the output. No expected figure was copied from an engine run; the evidence reads them from the table above. The figures under "Measured on a library example" are measured, as that section says. Implemented by the same session. Reviewed by: unreviewed when written; the independent review is recorded below.

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, by independent recomputation, `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-codex.md` (approved).

Reviewed by: Codex (GPT-6-Sol), 2026-10-10, the sentences added after RetireGolden#792's first review (the example's charitable distribution, the time limit with no incumbent, and what the evidence holds the figures to), `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-schedule-recheck-codex.md` (approved in the third round, after two rejections of the solver-coupling sentence).

Restated 2026-10-10 by claude (Opus 5.5) for D-OPTIMIZER-SOLVER-OUTPUT, from `strategies/optimizer.ts#optimizeSchedule`, `#buildOptimizerModel` and `projection/optimizePlan.ts#buildOptimizerInput` at RetireGolden `a4002c6b` with the decision's changes: the engine reads HiGHS's raw solution at full precision, not the highs package's six-digit parse; the deflator is 1 / the last plan year's general-inflation factor on the engine's basis, so case 1 is not deflated and case 2 is deflated over one year; and a solve with no solution publishes null figures and an empty schedule (cases 3 and 4). Every worked figure above was re-derived by hand from the model as the code now writes it (a decimal calculator for the products), from the solutions worksheet `optimizer-schedule-year-solution` derives; none was copied from an engine run. The library figures were re-measured and are labelled as measured. The provenance above is kept as it was; the restated text is unreviewed until Codex's review of the restatement.

Restatement reviewed by: Codex (GPT-6-Sol), 2026-10-10, by independent recomputation of every worked figure, `DOCS/calculations/reviews/REVIEW-2026-10-10-optimizer-solver-output-codex.md` (approved).
