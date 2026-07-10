# Alabama (AL) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

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
- The $6,000 IRA/401(k) exclusion rises to $12,000 in 2026 (not modeled; 2025 figure held).
- Income-based phase-down of the standard deduction and the personal/dependent exemptions ($1,500 single / $3,000 MFJ / $1,000 dependent) not modeled.
- Local occupational ("city") taxes not modeled.

## Citations
- https://www.revenue.alabama.gov/faqs/what-is-alabamas-individual-income-tax-rate/ — 2%/4%/5% brackets, single and MFJ thresholds.
- https://www.revenue.alabama.gov/faqs/how-much-is-the-alabama-standard-deduction/ — standard deduction.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 AL brackets, standard deduction ($3,000/$8,500), SS exempt cross-check.
- Kiplinger / ACTS Retirement — DB pensions fully exempt; IRA/401(k) $6,000 exclusion at 65+ (rising to $12,000 in 2026); SS exempt.
