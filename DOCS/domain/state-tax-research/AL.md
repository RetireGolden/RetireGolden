# Alabama (AL) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13; age-65 exclusion source corrected 2026-09-08.

## Summary
- Broad individual income tax: **yes** (graduated, 2%–5%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): defined-benefit pensions fully exempt; IRA/401(k) distributions excluded only $6,000 per person at age 65+

## Proposed StateTaxParams (2025)
- code: "AL"
- name: "Alabama"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 3000, marriedFilingJointly: 8500 }
- brackets.single:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 500, ratePct: 4.0 }
  - { lowerBound: 3000, ratePct: 5.0 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 2.0 }
  - { lowerBound: 1000, ratePct: 4.0 }
  - { lowerBound: 6000, ratePct: 5.0 }
- retirement: { kind: "capped", capPerPerson: 6000, minAge: 65 }

## Retirement-income detail
Alabama fully exempts Social Security benefits. It also fully exempts **defined-
benefit pension** payments (private and public) with no dollar cap. However,
distributions from **defined-contribution** accounts (traditional IRA, 401(k),
403(b)) are taxable, with only the first **$6,000 per person excluded for those
age 65 and older** (2025). Because the planner models the common IRA/401(k)
drawdown case, this is mapped to `kind: "capped"`, `capPerPerson: 6000`,
`minAge: 65`. This understates the benefit for retirees living primarily on a
traditional DB pension (which is actually fully exempt) — flagged below.

Alabama's standard deduction is income-based and phases down as AGI rises
(maximums ~$3,000 single / ~$8,500 MFJ at low income). We use the statutory
maximums per the Tax Foundation cross-check.

## Simplifications / not modeled
- DB pensions are *fully* exempt but modeled via the $6,000 IRA/401(k) cap — conservative (overstates tax) for pension-heavy retirees.
- Enrolled 2026 H.B. 341 retains Ala. Code § 40-18-19(a)(13)'s $6,000 age-65 retirement-income exemption; 2025 Schedule RS likewise caps each qualifying taxpayer at $6,000. Exact age measurement and mixed-source ordering are not modeled.
- Income-based phase-down of the standard deduction and the personal/dependent exemptions ($1,500 single / $3,000 MFJ / $1,000 dependent) not modeled.
- Local occupational ("city") taxes not modeled.

## Citations
- https://www.revenue.alabama.gov/faqs/what-is-alabamas-individual-income-tax-rate/ — 2%/4%/5% brackets, single and MFJ thresholds.
- https://www.revenue.alabama.gov/faqs/how-much-is-the-alabama-standard-deduction/ — standard deduction.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 AL brackets, standard deduction ($3,000/$8,500), SS exempt cross-check.
- https://alison.legislature.state.al.us/files/pdf/SearchableInstruments/2026RS/HB341-enr.pdf — enrolled 2026 H.B. 341, § 40-18-19(a)(13): first $6,000 of taxable retirement income, for individual taxpayers age 65+.
- https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40.pdf — 2025 Schedule RS: each taxpayer is eligible for up to $6,000, bounded by retirement income taxable to Alabama.
- https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf — 2025 Form 40 booklet: Federal Social Security benefits and qualifying defined-benefit retirement payments are listed as income not reported; other pension and IRA distributions use Schedule RS.

## Part-year residents (2026-10-08)

Method (a): a part-year resident files Form 40 on the resident-period income, with the whole standard deduction and exemptions (2025 Form 40 and Form 40NR booklets); the $6,000 exclusion applies to the retirement income taxable to Alabama, uncut (al-dor-individual-income-tax-rate-schedule). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'full', exemptions: 'full', ratioBasis: 'federalAgi', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Alabama and six in Texas, owes $2,310.00 for the Alabama months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,310.00 when the conversion falls in the months resident and $2,310.00 when it falls in Texas's, where the months share of the year gave $3,310.00 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
