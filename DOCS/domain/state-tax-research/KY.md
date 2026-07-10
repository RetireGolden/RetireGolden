# Kentucky (KY) - state income tax for retirement planning

Tax year: 2026. Completed example; implemented in `year2026.ts`.

## Summary

- Broad individual income tax: **yes** (flat 3.5%)
- Taxes Social Security benefits: no
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): excluded up to $31,110 per person

## Proposed StateTaxParams (2026)

- code: "KY"
- name: "Kentucky"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 3360, marriedFilingJointly: 6720 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.5 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.5 } ]
- retirement: { kind: "capped", capPerPerson: 31110 }

## Retirement-income detail

Kentucky taxes income at a flat 3.5% for tax years beginning January 1, 2026. Social Security is fully exempt.
Pension and other retirement income, including IRA/401(k) distributions, is excluded up to **$31,110 per person**
per year; amounts above that are taxed. Modeled as `kind: "capped"`, `capPerPerson: 31110`, no age gate.
KY's standard deduction is $3,360 (single); MFJ is treated as 2x ($6,720) since each spouse files with the
deduction on a combined return.

## Simplifications / not modeled

- The $31,110 exclusion has ordering rules for pre-1998 service; ignored.
- Local occupational taxes not modeled.

## Citations

- https://revenue.ky.gov/News/Pages/Kentucky-DOR-Announces-2026-Standard-Deduction.aspx - 2026 standard deduction.
- https://revenue.ky.gov/Forms/2026%20Withholding%20Formula.pdf - 2026 withholding formula with 3.5% rate and standard deduction.
- https://apps.legislature.ky.gov/record/25rs/hb1.html - HB 1 rate reduction from 4% to 3.5%.
- KY Schedule P pension income exclusion instructions.
