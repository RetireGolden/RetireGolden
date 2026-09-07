# Utah (UT) — state income tax for retirement planning

Tax year: 2026. Researched 2026-06-13; flat rate corrected 2026-09-07.

## Summary
- Broad individual income tax: **yes** (flat 4.45% for tax years beginning in 2026)
- Taxes Social Security benefits: **yes** (federally taxable amount included; offset by an income-phased-out taxpayer credit) — see detail
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed (no broad exclusion; small retirement credit instead)

## Proposed StateTaxParams (2026)
- code: "UT"
- name: "Utah"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.45 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.45 } ]
- retirement: { kind: "none" }

## Flat rate — operative law (2026)

[2026 Utah S.B. 60](https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf) (enrolled) amends Utah Code § 59-10-104 to impose resident-individual tax as the product of state taxable income and **4.45%**. Sections 4–5 set a May 6, 2026 effective date with retrospective operation for taxable years beginning on or after January 1, 2026.

The 2025 pack carried **4.5%** (the rate that applied for tax year 2025). The 2026 pack now carries 4.45%.

### Historical context

Utah reduced its flat rate from 4.55% to 4.5% for tax year 2025. S.B. 60 further reduces the rate to 4.45% for 2026 and later.

## Social Security credit linkage

Utah Code § 59-10-1042(2), effective January 1, 2026, permits a nonrefundable Social Security credit equal to the **percentage listed in § 59-10-104(2)** multiplied by the federally taxable Social Security benefit included in state taxable income, reduced under § 59-10-1042(4) by $0.025 per dollar of modified adjusted gross income above $54,000 (single) or $90,000 (joint). Because S.B. 60 sets § 59-10-104(2) at 4.45%, the credit rate tracks the flat rate. The pack includes federally taxable Social Security in the base but **models no credit**, so it overstates tax for income-eligible retirees. The taxpayer tax credit, retirement credit, and military credit also remain unmodeled.

## Retirement-income detail
Utah has **no standard deduction**; instead it grants a nonrefundable **Taxpayer Tax Credit** (6% of federal deductions plus personal exemptions) that phases out as income rises — set `standardDeduction: 0` and noted here.

Utah **does tax Social Security** (the federally taxable portion flows into Utah taxable income), so `taxesSocialSecurity: true`.

There is no broad pension/IRA exclusion for typical private retirees, so `retirement: { kind: "none" }`. (A small retirement tax credit of up to $450 per person exists with the same income phase-outs; not modeled.)

## Simplifications / not modeled
- Utah's Taxpayer Tax Credit (de facto progressive effective rate via phase-out) approximated by the flat rate with no standard deduction — overstates tax for lower-income retirees.
- Social Security credit under § 59-10-1042 (now linked to 4.45% via § 59-10-104(2)) not modeled — overstates tax for income-eligible retirees.
- Up-to-$450 retirement tax credit not modeled.
- Qualifying-surviving-spouse and other filing-status credit thresholds not fully modeled.
- Whole-return accuracy not claimed.

## Citations
- https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf — 2026 Utah S.B. 60 enrolled (§59-10-104 4.45% rate; retrospective to 2026-01-01).
- https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1042_2026010120250507.pdf — Utah Code § 59-10-1042 (Social Security credit rate linkage to § 59-10-104(2)).
- https://incometax.utah.gov/paying/tax-rates — Utah State Tax Commission rate history (2025 4.5% cross-check).
