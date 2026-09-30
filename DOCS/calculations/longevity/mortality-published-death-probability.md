## Claim

Kind: formula. `montecarlo/deathProbability.ts#annualMortality(age, sex)` (re-exported by `montecarlo/mortality.ts`, and read by the survival curve), for a man or a woman of age a with x = floor(a), returns the death probability SSA publishes for that sex and exact age x in Table 4C6 (`ssa-period-life-table`) for x from 0 to 118; 1 at 119 and above, where the table's last row is closed although SSA prints 0.926604; and 0 below 0. It refuses 'average', which has no single death probability.

New 2026-09-27 (decision D-LIFE-TABLE-2023). It replaces `mortality-ex-to-qx-identity`, which rebuilt q(x) from the printed two-decimal e(x) of the 2022 period table by the half-year identity q(x) = 1 − (e(x) − 0.5)/(e(x + 1) + 0.5), with 'average' as the identity on the mean of the two e rows.

## Justification

SSA's table prints q(x), "Probability of dying within one year", for each sex and exact age from 0 to 119 (`ssa-period-life-table`, its Justification). The governing source for the engine's death probability is that column; nothing needs to be derived. Two conventions surround it, each stated:

- **The age.** A fractional age reads the row of its whole years: SSA's q(x) is for "a person at that exact age", and the engine interpolates nothing within a year.
- **The table end.** The engine's horizons (the Monte Carlo horizon, the expected-value loops, the percentile ages) assume nobody is alive at 120, so the last row is closed: q = 1 from 119 on. SSA prints q(119) = 0.926604 for both sexes and e(119) = 0.58, so SSA's table counts some life past 120 and prints no row for it. Reading 0.926604 and closing the table at 120 instead would change the chance of being alive at 120 from 0 to 6.8e-12 for a man and 2.3e-11 for a woman of 65, 1.5e-11 and 4.1e-11 at 85, 5.4e-10 and 7.4e-10 at 100, 2.8e-7 at 110, 6.5e-5 at 115, 0.00138 at 117 and 0.0734 for someone already 119 (the two sexes share q from 109), and no survival probability to an age below 120 (the derivation's section C in exact rational arithmetic, reproduced by the independent check). Immaterial below about 110, and a stated cut for the very old.

'average' is not a column: SSA publishes none. The survival curve builds it as the 50/50 mixture of the two sexes' curves (`survival-probability-product`), whose one-year death probability depends on the age the mixture starts from, so there is no single q(x) to return.

## Inputs

| Input | Value | Unit |
|---|---:|---|
| Ages | 65.9, 65, 118, 119, 130, −1 | years |
| Sexes | male, female | category |
| SSA's row 65 | men 0.016455, women 0.010188 | probability |
| SSA's row 118 | 0.882480 (both sexes) | probability |
| SSA's row 119 | 0.926604 (both sexes) | probability |

## Arithmetic

A man of 65.9: x = floor(65.9) = 65, so q = the male q(65) = 0.016455. A woman of 65: 0.010188. A man of 118: 0.882480. At 119 and 130: x >= 119, so 1. At −1: x < 0, so 0. For every x from 0 to 118 and each sex the function returns the worksheet row of `ssa-period-life-table` exactly, with no arithmetic.

## Expected

| Case | Value |
|---|---:|
| Male, age 65.9 | 0.016455 |
| Female, age 65 | 0.010188 |
| Male, age 118 | 0.88248 |
| Either sex, age 119 | 1 |
| Either sex, age 130 | 1 |
| Either sex, age −1 | 0 |
| Printed q(119), carried and not read | 0.926604 |

Tolerance: exact. Every x from 0 to 118, for each sex, equals the `ssa-period-life-table` worksheet's row exactly.

## Wrong readings

- The half-year identity on the printed e (the retired record): 0.0161921 for a man of 65 and 0.0103093 for a woman, and on this table q = 0 at a woman's age 9 and a man's age 10.
- The published q(119) read as printed: 0.926604 at 119, so 7.3 percent of those alive at 119 would be alive at 120, past every horizon the engine has.
- The age rounded rather than floored: a man of 65.9 would read q(66) = 0.017574.
- 'average' as the mean of the two q: 0.0133215 at 65, where it equals the mixture's, and at later ages at or above the mixture's probability of dying, since the mixture's survivors become more female (at 90, 0.144317 against 0.14155 for a mixture formed at 65).

## Family

outputs: none.

feeds: `longevity-survival-percentile-age`, `monte-carlo-success-rate`, `monte-carlo-ending-investable-histogram`, `social-security-expected-present-value`, `social-security-survivor-switch-pv`, `social-security-fica-return-ratio`, `income-annuity-annual`, `spending-base-annual` (the amortization-based spending policy's survival-percentile horizon, worked out again on every projection) (every reader goes through the survival curve).

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, D-LIFE-TABLE-2023 derivation (sections 2, 4 and 6 item 2; the table-end figures in exact rational arithmetic from the printed columns); independently checked (F4: the table-end figures reproduced; F6 item 2) (both in RetireGolden-Docs, `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-derivation.md` and `calculations/bidirectional-validation-plan-2026-09-13/evidence/life-table-2023-check.md`, at commit `75e1cf87`). Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Reviewed by: Codex (GPT-6-Sol), 2026-09-29, `DOCS/calculations/reviews/REVIEW-2026-09-29-codex-3-longevity-ladders-taxes.md`.
