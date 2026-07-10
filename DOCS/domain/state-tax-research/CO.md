# Colorado (CO) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 4.4%)
- Taxes Social Security benefits: **yes** in statute, but fully subtractable at 65+ and (income-tested) at 55–64 — modeled as taxed, flagged below
- Long-term capital gains: taxed as ordinary income (narrow exclusions only)
- Retirement income (pension, IRA, 401k): subtraction up to $24,000 per person at 65+ ($20,000 at 55–64)

## Proposed StateTaxParams (2025)
- code: "CO"
- name: "Colorado"
- hasIncomeTax: true
- taxesSocialSecurity: true
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.4 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.4 } ]
- retirement: { kind: "capped", capPerPerson: 24000, minAge: 65 }

## Retirement-income detail
Colorado taxes income at a flat **4.4%** (2025). It starts from federal taxable
income (i.e., the **federal** standard deduction is already baked in), so there is
**no separate Colorado standard deduction** — set to 0 to avoid double-counting.

Colorado's "pension and annuity subtraction" lets taxpayers **age 65+** subtract
up to **$24,000 per person** of combined Social Security, pension, and
retirement-account income included in federal taxable income; ages **55–64**
may subtract up to $20,000. Modeled as `kind: "capped"`, `capPerPerson: 24000`,
`minAge: 65` (the dominant retiree case).

For Social Security specifically, recent law lets taxpayers **65+** subtract the
full federally-taxable SS amount, and **55–64** subtract SS in full if AGI is
under $75,000 (single) / $95,000 (MFJ). Because the big-levers model has a single
`taxesSocialSecurity` boolean, it is set **true** (SS is taxable in statute), which
overstates tax for the many retirees who qualify for the full subtraction — flagged
below.

## Simplifications / not modeled
- SS is effectively exempt for most retirees (full subtraction at 65+; income-tested at 55–64), but `taxesSocialSecurity: true` taxes it — overstates CO tax for typical retirees. A future enhancement could treat CO SS as exempt at 65+.
- The $24,000/$20,000 cap is a **combined** cap across SS + pension + IRA; modeling it as a per-person pension cap while also taxing SS may double-count for those near the cap. Flagged as a known approximation.
- Ages 55–64 use a $20,000 cap (not modeled separately).
- No state standard deduction (federal taxable income is the base); set to 0.

## Citations
- https://tax.colorado.gov/income-tax-topics-social-security-pensions-and-annuities — pension/annuity subtraction $24,000 (65+) / $20,000 (55–64); SS subtraction rules.
- https://tax.colorado.gov/retirees — Colorado starts from federal taxable income; retiree subtractions.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025: CO flat 4.4%, no state standard deduction.
