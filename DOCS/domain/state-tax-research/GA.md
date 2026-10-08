# Georgia (GA) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; re-verified against the GA DOR 2026 updates page 2026-07-15
(PR #22 review caught the 2025 vintage going stale — the rate ramp moved faster than the hold-forward
convention assumed).

> **2027 (2026-09-28):** HB 463 (2026, signed 2026-05-11) cuts the rate 0.125 point a year from
> January 1, 2027 (4.865% for 2027) unless the Office of Planning and Budget's test "as of December 1"
> delays it (O.C.G.A. 48-7-20(a.1)(2)). Not loaded: 2027 prices at 4.99% until the December 1, 2026
> determination is published.

## Summary
- Broad individual income tax: **yes** (flat 4.99% for 2026)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): large age-based exclusion — $35,000 per person at 62–64, $65,000 per person at 65+

## Proposed StateTaxParams (2026)
- code: "GA"
- name: "Georgia"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.99 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.99 } ]
- retirement: { kind: "capped", capPerPerson: 65000, minAge: 65 }

## Retirement-income detail
Georgia's flat rate is on a legislated ramp and has moved quickly: **5.39%** for 2024, cut
**retroactively to 5.19%** for tax years beginning January 1, 2025 (per the DOR's updated 2025
employer guide), and published at **4.99%** for 2026 with standard deductions raised to **$15,000
(single) / $30,000 (MFJ)** — the values encoded in the 2026 pack. Social Security is fully exempt.

Georgia's **Retirement Income Exclusion** is large and age-based: taxpayers
**65+** may exclude up to **$65,000 per person** of retirement income (pensions,
IRA/401(k) distributions, interest, dividends, capital gains, plus up to $4,000 of
earned income); taxpayers **62–64** (or under 62 and permanently disabled) may
exclude up to **$35,000 per person**. Modeled as `kind: "capped"`,
`capPerPerson: 65000`, `minAge: 65` (the dominant retiree case).

## Simplifications / not modeled
The characterized retirement calculation applies the modeled cap and age gate
to each recipient's distributions separately. A spouse's unused cap or older
age cannot establish the other recipient's exclusion. Missing ownership or
missing or conflicting age eligibility produces an incomplete disclosure and
no exclusion for the affected recipient. Legacy aggregate inputs do not prove
recipient attribution. This repair does not expand the modeled income scope or
add the omitted eligibility tiers below.

- The 62–64 tier ($35,000 per person) is not modeled separately; only the 65+ ($65,000) tier is captured via `minAge: 65`.
- The exclusion covers broad investment income and up to $4,000 of earned income, not just pension/IRA; modeled narrowly as the pension/IRA cap.
- GA's flat rate is on a legislated annual ramp — do **not** hold it forward at refresh time; re-read the DOR updates page each year (the 2025→2026 hold-forward went stale mid-year).

## Citations
- https://dor.georgia.gov/taxes/important-tax-updates — "2026 Income Tax Changes": flat 4.99%; standard deduction $15,000 single / $30,000 MFJ. Accessed 2026-07-15.
- https://dor.georgia.gov/document/document-document/2025-employers-tax-guide-updated-june-2025/download — 2025 rate reduced retroactively from 5.39% to 5.19% (tax years beginning 2025-01-01).
- https://dor.georgia.gov/retirement-income-exclusion — Retirement Income Exclusion: $35,000 (62–64) / $65,000 (65+) per person; worksheet amounts in Form IT-511.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation cross-check.

## Part-year residents (2026-10-08)

Method (a), 2025 IT-511 Schedule 3: line 9 divides line 8 Column C by Column A, both after the Georgia adjustments, and prorates the standard deduction and dependents; the retirement exclusion is prorated by the Georgia share of the retirement income (ga-code-48-7-27-a-5-1-military-retirement-exclusion). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'incomeRatio', exemptions: 'incomeRatio', ratioBasis: 'stateIncome', exclusionCap: 'retirementShare' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Georgia and six in Texas, owes $2,120.75 for the Georgia months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,009.82 when the conversion falls in the months resident and $2,227.68 when it falls in Texas's, where the months share of the year gave $3,118.75 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
