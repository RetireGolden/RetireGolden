# Iowa (IA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 3.8%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (with limited exclusions — see Simplifications)
- Retirement income (pension, IRA, 401k): **fully exempt** for taxpayers age 55+ (also disabled / surviving spouses)

## Proposed StateTaxParams (2025)
- code: "IA"
- name: "Iowa"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.8 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.8 } ]
- retirement: { kind: "full", minAge: 55 }

## Retirement-income detail
Iowa moved to a flat **3.8%** individual income tax for 2025 (SF 2442),
eliminating its prior graduated brackets. Iowa also dropped its own standard
deduction and now conforms to the **federal** standard deduction ($15,000 single
/ $30,000 MFJ for 2025). Social Security benefits are fully exempt.

For tax years beginning 2023 and later, Iowa fully excludes retirement income —
pensions (defined benefit and defined contribution), annuities, IRA
distributions, and deferred-compensation distributions — for individuals who are
**age 55 or older** on December 31 of the tax year (also for disabled
individuals, surviving spouses, and qualifying survivors). Mapped to
The characterized calculation tests age, disability, surviving-spouse and insurable-interest survivor eligibility per distribution; unknown eligibility is incomplete. The age-only pack describes the legacy aggregate input, not the rich result.

## Simplifications / not modeled
- Characterized retirement facts can express the age, disability, survivor, military, and railroad eligibility limbs. Aggregate retirement income alone cannot establish which statutory limb applies and is incomplete where that distinction is material.
- Iowa's elimination of its separate standard/itemized deductions in favor of the federal amount means federal-conforming figures are used; high-earner federal phase-outs not modeled.
- Iowa capital-gain exclusions (e.g., qualifying ESOP/farm/business-asset gains) not modeled; `capitalGainsAsOrdinary: true` overstates tax for those gains.

## Citations
- https://revenue.iowa.gov/taxes/tax-guidance/individual-income-tax/individual-income-tax-provisions — flat 3.8% 2025; retirement income exclusion age 55+; SS exempt.
- https://www.law.cornell.edu/regulations/iowa/Iowa-Admin-Code-r-701-302-47 — exclusion of pensions/IRA/annuity for age 55+, disabled, surviving spouses, survivors (tax years 2023+).
- https://nationaltaxreports.com/iowa-standard-deduction-2025-2026-guide/ — Iowa now follows the federal standard deduction.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — IA flat 3.8%.

## Iowa tests minimum income and alternate tax separately from taxable income (verified 2026-09-12)

Iowa applies the $9,000/$13,500 minimum-income thresholds, raised to $24,000/$32,000 for the age-65 provision. The test adds back federal standard/itemized, personal-exemption and QBI deductions, including the enhanced senior deduction. Eligible joint/HOH/surviving-spouse returns compare regular tax with 4.3% of test net income above the applicable joint threshold; MFS requires combined spousal income and NOL restrictions. Unknown worksheet facts are incomplete. The test net-income base must not replace Iowa taxable income.

Registered as `iowa-code-422-5-alternate-minimum-tax`. Authority: [Iowa Code 422.5(2)–(3)](https://www.legis.iowa.gov/docs/code/422.5.pdf).

## Characterized retirement and evidence scope (2026-09-12)

The characterized retirement selector applies every Iowa Code 422.7(19)(a) recipient limb: age 55, disability, surviving spouse, or insurable-interest survivor of a qualifying decedent. Military and RRA source exclusions remain distinct. Unknown source or eligibility is incomplete.
