## Claim

Kind: formula. `socialSecurity/analysis/oasdiReturn.ts#oasdiReturnForPerson` compares, for a person with an earnings history and a PIA the projection can pay, the benefits they are paid (on their own record, or a former spouse's when larger) with the OASDI tax their career pays: the expected present value of their benefits from the start year (`social-security-expected-value`, single model, at the stream's claim age with its months, with the former-spouse benefits the ledger would pay, a divorced spouse's only in a single household), plus the benefits already received from the claim year to the year before the start at the start-year amount (a constant real amount), over the OASDI tax paid in so far and the tax the projected work will pay, restated in today's dollars (`oasdi-paid-in-today-dollars`), the projected work being the years the PIA's earnings projection fills, so both sides cover the same career. `#benefitsToContributionsRatio` returns (get-back)/(paid-in), or no ratio when nothing is paid in. A benefit paid as a disability benefit from its onset has no comparison: its claim age would not start it, and the page says so as the ranking does. The page prints the ratio to two decimals with "×", and "—" when there is none.

Restated 2026-09-27 (the slice's independent review, F4 and F14): the paid-in now counts the projected work the PIA counts, and a disability benefit from its onset is refused. Cases A, B and Z have no projection and are unchanged; case P is new.

New 2026-09-27 (B2-P1 slice 4, owner decision R8: "index paid-in to today's dollars, use each year's rate, include the floor"). Until then planner-ui's analysis page divided a today's-dollar present value by a nominal one-rate sum, ignored claim months and the divorced-spouse floor, printed "—" for a zero ratio and a missing one alike, and, for a person already collecting, left out the benefits already received while counting the whole career's taxes (the derivation's problem 7, decided with this slice).

## Justification

No statute defines the ratio; it has to do what its label says, "Ratio (get back ÷ paid in)", "an illustrative return on your Social Security taxes", with "what you get back" the benefits the person is paid, on their own record or a former spouse's when larger (R8's "include the floor"). A ratio of two amounts needs them over the same career, so the paid-in counts the tax on the years the earnings projection fills, as the PIA counts their earnings (the review's F4); and in the same dollars (R8): the paid-in is restated for prices, and the benefits already received are counted at the start-year amount, which is the same price-only basis, since each year's cost-of-living increase follows prices. The two sides differ in one way the record states: the paid-in carries no interest while the future benefits are discounted at the page's real rate.

## Inputs

Both cases are single men with their COLA matching 2.5% inflation, a start year of 2026 and a 2% real rate, paid as employees, with $50,000 of covered earnings each year.

| Case | Born | Earnings years | Claim |
|---|---|---|---|
| A | 1960-05-01 (66 in 2026) | 1982-2021 | 67y0m |
| B | 1956-05-01 (70 in 2026, collecting since 2023) | 1978-2017 | 67y0m |
| Z | as A, with every year's earnings 0 | 1982-2021 | 67y0m |

Case P: a person born 1981-06-15 (45 in 2026) on the average of SSA's male and female table, retiring at 65, with $60,000 of covered earnings each year 2003-2025 and an earnings projection of $60,000 a year to 65, claiming at 67y0m; COLA matching 2.5% inflation, a 2% real rate, paid as an employee.

## Arithmetic

**A.** The earnings give an AIME of 8,022 and a PIA of 2,846.40 for 2022, the year he turns 62; the increases of December 2022 to 2025 (8.7, 3.2, 2.5 and 2.8 percent, each floored to the dime) raise it to 3,364.40 in 2026 (`pia-cost-of-living-since-eligibility`). Claiming at his full retirement age pays 40,372.80 a year from 2027; its expected present value is 536,350.60. Paid in: 225,418.24 in 2026 dollars. Ratio 536,350.60 / 225,418.24 = 2.3794. The retired panel: 453,771.36 (the eligibility-year PIA) over 119,306.60 (nominal, one rate), 3.80.

**B.** With the base capped at SSA's figures before 1979, the PIA for 2018 is 2,551.90 and the increases through 2025 raise it to 3,379.20. Claimed at 67 (full retirement age 66 and 4 months, so 8 months of credits: 1.053333), he is paid 3,559.42 a month. Benefits already received, 2023 to 2025: 36 × 3,559.424 = 128,139.26. Expected present value from 2026: 528,943.83. Paid in: 230,464.32. Ratio (528,943.83 + 128,139.26) / 230,464.32 = 2.8511; without the benefits already received it would be 2.2951.

**Z.** Nothing paid in: no ratio (and no PIA from the history, so the page shows no row).

**P.** The projection fills the base years 2026 to 2042 (ages 45 to 61; the window ends at 61) with $60,000, so the PIA is computed on 40 years of $60,000 at the latest published tables: an AIME of 6,605 and a PIA of 2,859.40 (eligible 2043, no increase before the start). Claiming at 67 its expected present value is 274,580.00. Paid in so far 116,507.46 (`oasdi-paid-in-today-dollars` case P) and the projected work 63,240: ratio 274,580.00 / 179,747.46 = 1.5276. Over the history alone it would be 2.3568, a ratio of a whole career's benefits to half its taxes.

## Expected

| Quantity | Value |
|---|---:|
| A PIA 2026 | 3,364.4 |
| A get-back PV | 536,350.6014920631 |
| A received before start | 0 |
| A paid in today | 225,418.2398526663 |
| A ratio | 2.3793575969833793 |
| B PIA 2026 | 3,379.2 |
| B get-back PV | 528,943.8293113195 |
| B received before start | 128,139.26399999998 |
| B paid in today | 230,464.3163580016 |
| B ratio | 2.8511272534295995 |
| P PIA 2026 | 2,859.4 |
| P get-back PV | 274,580.00088922086 |
| P paid in today | 116,507.46237712375 |
| P projected work | 63,240 |
| P ratio | 1.5275876346622979 |

Tolerance: 1e−12 relative (the PIAs exact to the dime). The ratio helper returns no ratio for a paid-in of 0 or less.

The derivation's case B expected 1.77 on a PIA of 2,605.00, and the check found that inconsistent with the same change's cap on earnings before 1979; on the capped PIA the check gave 1.7332, or 2.1531 with the benefits received, and after the cost-of-living increases since eligibility (the Social Security law change this slice sits on, D-SS-LAW-2) A 2.3794, B 2.2951 and 2.8511 with the benefits received. The values above are those, recomputed on the base branch: the present values by the derivation's independent model on the start-year PIAs (it imports nothing from the engine; the engine's differ by at most two units in the last place), the paid-in by that model on the SSA and BLS series. Case P is the review's (F4), its values by the review's independent model (`ssmodel.py`, which imports nothing from the engine; its get-back equals the review's probe of the engine to the last digit).

## Wrong readings

- A nominal one-rate paid-in (the retired panel): A 3.80.
- The eligibility-year PIA without the cost-of-living increases since: A 453,771.36 / 225,418.24 = 2.01.
- The benefits already received left out for a person collecting: B 2.2951.
- The employer's share added to paid-in: roughly halves the ratio; the panel shows the employer's share as context only.
- The history alone over a PIA from the projected career (the slice's figure before the review): P 2.3568.
- A divorced spouse's benefit priced for a person in a couple: the ledger pays it only to a claimant who is single.

## Family

outputs: `social-security-fica-return-ratio`.

## Provenance

Derived by: claude (opus 5.5), 2026-09-27, B2-P1 slice 4 derivation, worksheet `social-security-fica-return-ratio.md`; independently checked (C3, its correction 4, and its figures after P5 and P12); the benefits already received are the derivation's problem 7, decided with this slice. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.
