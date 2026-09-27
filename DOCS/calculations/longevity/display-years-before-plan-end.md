## Claim

Kind: formula. `projection/moneyLasts.ts#moneyLasts(result)` publishes one "money lasts" convention (owner decision R15, fix, 2026-09-25): the **last fully funded year** `L = depletionYear − 1`, or `endYear` when the projection never depletes, and the number of plan years the money falls short of the plan's end, `N = endYear − L`: `endYear − depletionYear + 1` when the plan depletes, `0` when it does not. `lastFundedYear(result)` returns `L` alone; the decision and optimizer money-lasts deltas are differences of it. The Results sentence reads "Money lasts through L, N years short of the plan's end in E", which can no longer read "0 years".

## Justification

`depletionYear` is the first year the portfolio could not fund, after any HECM backstop (`ProjectionResult.depletionYear`), so every year before it was funded and it was not: the money lasts through `D − 1`. The plan asks the money to last through `E` inclusive, so the years it falls short are `D, D + 1, …, E`, which is `E − D + 1` years; when `D = E` that is one year, the plan's last. The retired sentence's `E − D` counts calendar labels between the two years, one fewer, and read "0 years" for a plan short only in its final year. "Short of the plan's end" is a distance, true whether or not a later year recovers.

Before this change the app named the year three ways: the Results sentence (`E − D`), the KPI bar and printed report ("until/to D", a year with a shortfall), and the decision code, which counted a non-depleting result as lasting through `E + 1`, a year outside the plan. Both `lastFundedYear` and the retired `D`-or-`E + 1` count shift every result by exactly one year, so every difference between two results (`moneyLastsYears`, `moneyLastsYearsDelta`, the optimizer's comparisons) is unchanged.

## Inputs

The first plan is the one in `longevity-depletion-year.md`: a 25,000 cash account, 10,000 a year of spending, no returns, inflation, income or tax, from 2026, depleting in 2028.

| Case | startYear | endYear | depletionYear |
|---|---:|---:|---:|
| A (that plan to 2028) | 2026 | 2028 | 2028 |
| B (the same plan to 2030) | 2026 | 2030 | 2028 |
| C (that worksheet's null case, 5,000 a year) | 2026 | 2028 | null |
| D (short from the first year) | 2026 | 2060 | 2026 |
| E (not a ledger year) | 2026 | 2030 | 2031 |

## Arithmetic

- A: `L = 2027`, `N = 2028 − 2027 = 1`. Retired sentence: `2028 − 2028 = 0`.
- B: the 2028 shortfall is unchanged by extending the horizon (no later income): `L = 2027`, `N = 2030 − 2027 = 3` (2028, 2029, 2030). Retired: `2`.
- C: `L = 2028`, `N = 0`. The retired decision count said 2029.
- D: `L = 2025`, `N = 2060 − 2025 = 35` (every plan year). Retired: `34`.
- E: depletion after the horizon cannot come from the ledger: refused.

## Expected

A `{ depletionYear: 2028, lastFundedYear: 2027, endYear: 2028, yearsShortOfPlanEnd: 1 }`; B `{ 2028, 2027, 2030, 3 }`; C `{ null, 2028, 2028, 0 }`; D `{ 2026, 2025, 2060, 35 }`; E throws, as does a depletion year before the start year. A to C also hold on the ledger's own results for the plan above. For any two results, `lastFundedYear(a) − lastFundedYear(b)` equals the retired count's difference. All exact (integers).

## Wrong readings

- `E − D` (the retired sentence): A `0`, B `2`, D `34`.
- The depletion year read as the last year the money lasts: says the money lasts through 2028 in A, a year it ran short; `E + 1 = 2029` in C, a year outside the plan.
- Counting shortfall years instead of the distance: equal here, but wrong for a plan whose income resumes after depletion.
- `N = E − D + 1` for a plan that never depletes: C has no `D`; the count is `0`.

## Family

outputs: `display-years-before-plan-end`, `longevity-last-funded-year`.

feeds: `compare-plan-deltas` (since B2-P1 slice 3, the Compare page's Money lasts row is the difference of two published last funded years; see `../optimizer-and-comparisons/compare-plan-deltas.md`). Reads `longevity-depletion-year`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-26, from the source at RetireGolden `aeb2861a`; cases A and C reuse the plan of the existing worksheet `longevity-depletion-year.md`, whose depletion year is hand-derived there. Checked by a second claude agent that did not derive it, which confirmed every value and named the restatements the change needs (the simple candidate comparison record and its worksheet, and the first-year case of the KPI wording). Reviewed by: pending; the catalog asks for a reviewer of a different agent family.
