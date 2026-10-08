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
- standardDeduction: { single: 3360, marriedFilingJointly: 3360 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.5 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.5 } ]
- retirement: { kind: "capped", capPerPerson: 31110 }

## Retirement-income detail

Kentucky taxes income at a flat 3.5% for tax years beginning January 1, 2026. Social Security is fully exempt.
Pension and other retirement income, including IRA/401(k) distributions, is excluded up to **$31,110 per person**
per year; amounts above that are taxed. Modeled as `kind: "capped"`, `capPerPerson: 31110`, no age gate.
KY's standard deduction is **$3,360 once per return**. An MFJ production scenario computes one joint return and
receives one $3,360 deduction — not a doubled spouse-count amount.

## Simplifications / not modeled

- The $31,110 exclusion has ordering rules for pre-1998 service; ignored.
- Local occupational taxes not modeled.

## Citations

- https://revenue.ky.gov/News/Pages/Kentucky-DOR-Announces-2026-Standard-Deduction.aspx - 2026 standard deduction.
- https://revenue.ky.gov/Forms/2026%20Withholding%20Formula.pdf - 2026 withholding formula with 3.5% rate and standard deduction.
- https://apps.legislature.ky.gov/record/25rs/hb1.html - HB 1 rate reduction from 4% to 3.5%.
- KY Schedule P pension income exclusion instructions.


Source availability correction (2026-09-12): the historical Form 740 instruction URL containing `(2025)` returns HTTP 404. The official-site search index preserves the quoted $3,160 instruction and its one-deduction joint-return pattern, but $3,160 is the TY2024 amount, not TY2025. This record uses that historical passage only for the filing-status pattern. TY2026 $3,360 comes independently from the current DOR announcement; confirm the return instructions when published. No cache response was modified.

## Part-year residents (2026-10-08)

Method (a): 2025 Form 740-NP Schedule A instructions, the standard deduction "does not have to be prorated"; personal tax credits times the line 34 Kentucky percentage, Kentucky AGI after the pension exclusion over federal AGI. 2025 Schedule P: a 740-NP filer reports only the pension income received while a Kentucky resident, and Part III line 3 excludes the lesser of it and the whole $31,110 (ky-dor-2026-standard-deduction-once-per-return). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'full', exemptions: 'incomeRatio', ratioBasis: 'stateOverFederalAgi', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Kentucky and six in Texas, owes $1,632.40 for the Kentucky months, the same as before. With a $40,000 Roth conversion on top, the slice is $1,943.55 when the conversion falls in the months resident, the conversion meeting the pension exclusion up to the whole $31,110, and $1,632.40 when it falls in Texas's, where the months share of the year gave $2,332.40 either way. A pensioner of 66 with a $40,000 pension and $20,000 of other income, six months resident, owes $232.40: the resident period's $20,000 of pension is all excluded (packages/engine/src/tax/statePartYear.caps.rules.test.ts). Before 2026-10-08 the slice prorated the cap by the months.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
