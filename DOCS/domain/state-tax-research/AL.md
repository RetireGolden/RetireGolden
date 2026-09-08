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
- https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40.pdf — 2025 Schedule RS: each taxpayer age 65+ is eligible for up to $6,000, capped by retirement income taxable to Alabama.
- https://www.revenue.alabama.gov/wp-content/uploads/2026/01/25f40bk.pdf — 2025 Form 40 booklet: Federal Social Security benefits and qualifying defined-benefit retirement payments are listed as income not reported; other pension and IRA distributions use Schedule RS.
