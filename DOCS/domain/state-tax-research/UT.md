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

Utah Code § 59-10-1042(2), effective January 1, 2026, permits a nonrefundable Social Security credit equal to the **percentage listed in § 59-10-104(2)** multiplied by the Social Security amount included in Utah taxable income. The §1042(4) reduction is $0.025 per dollar of statutory modified AGI above $45,000 (MFS), $54,000 (single), or $90,000 (HOH, joint, or qualifying surviving spouse). Because S.B. 60 sets §59-10-104(2) at 4.45%, the credit rate tracks the flat rate. The rich state-tax path models this credit only when Utah taxable SS, the separate statutory MAGI components, and state filing status are characterized; missing facts return an incomplete result rather than a zero credit.

## Retirement-income detail
Utah has **no standard deduction**; instead it grants a nonrefundable **Taxpayer Tax Credit** (6% of federal deductions plus personal exemptions) that phases out as income rises — set `standardDeduction: 0` and noted here.

Utah **does tax Social Security** (the federally taxable portion flows into Utah taxable income), so `taxesSocialSecurity: true`.

There is no broad pension/IRA exclusion for typical private retirees, so `retirement: { kind: "none" }`. The rich path models the $450-per-eligible-claimant general retirement credit for claimants born on or before 1952-12-31, with one return-level statutory MAGI phaseout. It elects either that retirement credit or the combined Social Security and military-retirement-credit alternative, then applies apportionment and the remaining-liability cap.

## Simplifications / not modeled
- Utah's Taxpayer Tax Credit (de facto progressive effective rate via phase-out) approximated by the flat rate with no standard deduction — overstates tax for lower-income retirees.
- The rich state-tax path supports the statutory Social Security, general-retirement, and military-retirement credit alternatives only when the Utah taxable-Social-Security, MAGI, filing-status, birth-date, election, and liability facts are known. It reports incomplete rather than treating unknown facts as a zero credit.
- The §59-10-114 Railroad Retirement Act subtraction and prior-state-taxed §401(a) distribution subtraction require characterized source and basis evidence; generic public/private pension amounts are not substitutes.
- Whole-return accuracy not claimed.

## Citations
- https://le.utah.gov/~2026/bills/sbillenr/SB0060.pdf — 2026 Utah S.B. 60 enrolled (§59-10-104 4.45% rate; retrospective to 2026-01-01).
- https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1042_2026010120250507.pdf — Utah Code § 59-10-1042 (Social Security credit rate linkage to § 59-10-104(2)).
- https://incometax.utah.gov/paying/tax-rates — Utah State Tax Commission rate history (2025 4.5% cross-check).

## Utah credits taxable military retirement at the current state rate (verified 2026-09-12)

The military credit equals 4.45% for TY2026 of qualifying military retirement, including qualifying survivor pay, included in federal AGI. Social Security, IRA/401(k) withdrawals and nonmilitary federal pensions are excluded. The return may combine military with Social Security credit, or elect general retirement credit instead. Nonrefundable liability and residency apportionment limits apply; no carryforward is created.

Registered as `ut-code-59-10-1043-military-retirement-credit`. Authority: [Utah Code 59-10-1043(1)–(3)](https://le.utah.gov/xcode/Title59/Chapter10/C59-10-S1043_2022032320220323.pdf).
