## Claim

Kind: formula. `socialSecurity/piaFromEarnings.ts#piaWithCostOfLivingIncreases` raises the PIA an earnings history gives for its eligibility year (the year the worker turns 62) by each year's cost-of-living increase from that year through the year before the projection's first year, flooring to the dime after each step; `projection/simulate.ts#simulatePlan` applies it to every PIA derived from earnings before the ledger's own COLA factor takes over. The increases are SSA's, `socialSecurity/ssaWageData.ts#COLA_PCT_BY_YEAR`; a year SSA has not announced uses the plan's COLA assumption (`#socialSecurityColaAssumptionPct`) and the projection warns.

New 2026-09-27 (decision D-SS-LAW-2, problem P12, found by the independent check of the B2-P1 slice 4 derivation). Until then the projection used the eligibility-year PIA as if it were in the first year's dollars.

## Justification

42 U.S.C. 415(i)(2)(A)(ii): when a year's base quarter is a cost-of-living computation quarter, the Commissioner shall, "effective with the month of December of that year", increase "(II) the primary insurance amount of each other individual on which benefit entitlement is based under this subchapter", and "The increase shall be derived by multiplying each of the amounts described in subdivisions (I), (II), and (III) (including each of those amounts as previously increased under this subparagraph) by the applicable increase percentage; and any amount so increased that is not a multiple of $0.10 shall be decreased to the next lower multiple of $0.10."

42 U.S.C. 415(i)(2)(A)(iii): "In the case of an individual who becomes eligible for an old-age or disability insurance benefit ... in a year in which there occurs an increase provided under clause (ii), the individual's primary insurance amount (without regard to the time of entitlement to that benefit) shall be increased ... by the amount of that increase and subsequent applicable increases, but only with respect to benefits payable for months after November of that year."

So a worker eligible in year \(e\) whose PIA the bend-point formula gives as \(P_{e-1}\) has, for benefits payable from January of the projection's first year \(s\), \(P_y=\lfloor 10\,P_{y-1}(1+c_y/100)\rfloor/10\) for \(y=e,\dots,s-1\). The increases \(c_y\) are SSA's "Cost-Of-Living Adjustments" series (ssa.gov/oact/cola/colaseries.html, Internet Archive capture of 2026-09-18): 2018 2.8, 2019 1.6, 2020 1.3, 2021 5.9, 2022 8.7, 2023 3.2, 2024 2.5, 2025 2.8, and back to 1975. From 1983 each is effective for December and paid from January; the independent check read the 2018-2025 figures live.

## Inputs

| Case | Worker | Eligibility-year PIA | Start year | COLA assumption |
|---|---|---|---|---|
| A (the check's case) | single man born 1960-05-01, $50,000 of covered earnings in each year 1982 through 2021, claims at 67y0m | 2,846.40 (2022; AIME 8,022) | 2026 | matches inflation, 0% |
| B | born 1956 (the aime-covered-earnings-cap case) | 2,551.90 (2018) | 2026 | (the chain only) |
| C | as A | 2,846.40 (2022) | 2028 | fixed 2% |

## Arithmetic

Case A. Eligible 2022, first year 2026, so the December 2022 to 2025 increases apply: \(2846.40\times1.087=3094.04\to3{,}094.00\); \(\times1.032=3193.008\to3{,}193.00\); \(\times1.025=3272.825\to3{,}272.80\); \(\times1.028=3364.44\to\) **3,364.40**. He attains 67 in April 2027 (a birthday on the 1st), so 2027 is his claim year and pays 12 months: \(3364.40\times12=\) **$40,372.80**, where the eligibility-year PIA paid \(2846.40\times12=\$34{,}156.80\).

Case B. Eight increases, 2018 to 2025: 2,623.30, 2,665.20, 2,699.80, 2,859.00, 3,107.70, 3,207.10, 3,287.20, **3,379.20**.

Case C. The first year is 2028, so 2026 and 2027 are needed and not announced: the plan's 2% stands in, \(3364.40\times1.02=3431.69\to3{,}431.60\), \(\times1.02=3500.23\to\) **3,500.20**, and 2028 pays \(3500.20\times12=\) **$42,002.40** with the warning that unannounced increases use the plan's COLA assumption.

## Expected

| Case | Before (engine to 2026-09-26) | After |
|---|---:|---:|
| A, start-year PIA | 2,846.40 | **3,364.40** |
| A, 2027 | 34,156.80 | **40,372.80** |
| B, start-year PIA | 2,551.90 | **3,379.20** |
| C, start-year PIA | 2,846.40 | **3,500.20** |
| C, 2028 | 34,156.80 | **42,002.40** |

`YearResult.incomes.socialSecurity` for the years named; the start-year PIAs are the helper's result. Fixture tolerance: absolute $0.005.

## Wrong readings

- No increase at all (the engine before 2026-09-27): A 34,156.80.
- Increases without the dime floor at each step: A \(2846.40\times1.087\times1.032\times1.025\times1.028=3364.51\), 40,374.15 a year.
- Increases from the year after eligibility (missing the 8.7 percent of December 2022, the year he turned 62, which (iii) includes): \(2846.40\to2937.40\to3010.80\to3095.10\), 37,141.20 a year.
- Increases through the first year itself: the ledger's own COLA factor would count the first year's increase a second time.

## Family

outputs: none.

feeds: `social-security-benefit-annual`.

## Provenance

The defect and case A (34,156.80 against 40,372.80) are from the independent check of the B2-P1 slice 4 derivation (A5, P12), RetireGolden-Docs `calculations/bidirectional-validation-plan-2026-09-13/evidence/b2p1-slice4-check.md`, which quotes 42 U.S.C. 415(i) from uscode.house.gov and read SSA's COLA series live; case B's chain is that check's "2,551.90 becomes 3,379.20". The full 1975-2025 series was taken from an Internet Archive capture of SSA's page (2026-09-18). Case C was added for the stand-in. Every figure was recomputed with exact fractions by a script that does not import the engine. Implemented by: claude (opus 5.5), 2026-09-27. Reviewed by: not yet reviewed.

Revision 2026-09-27 (B2-P1 slice 4): the planner no longer resolves the PIA itself. The projection, the claim-milestone insight and the Social Security pages call `socialSecurity/piaFromEarnings.ts#resolveStreamPiaMonthly` (`social-security-pia-resolution`), which applies this increase; the record's limit is restated to say so. No value changes.
