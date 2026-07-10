# District of Columbia (DC) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (graduated, 4%–10.75%; same brackets for all filing statuses)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income
- Retirement income (pension, IRA, 401k): generally taxed; only a small $3,000 exclusion for government-pension retirees age 62+

## Proposed StateTaxParams (2025)
- code: "DC"
- name: "District of Columbia"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 15000, marriedFilingJointly: 30000 }
- brackets.single:
  - { lowerBound: 0, ratePct: 4.0 }
  - { lowerBound: 10000, ratePct: 6.0 }
  - { lowerBound: 40000, ratePct: 6.5 }
  - { lowerBound: 60000, ratePct: 8.5 }
  - { lowerBound: 250000, ratePct: 9.25 }
  - { lowerBound: 500000, ratePct: 9.75 }
  - { lowerBound: 1000000, ratePct: 10.75 }
- brackets.marriedFilingJointly:
  - { lowerBound: 0, ratePct: 4.0 }
  - { lowerBound: 10000, ratePct: 6.0 }
  - { lowerBound: 40000, ratePct: 6.5 }
  - { lowerBound: 60000, ratePct: 8.5 }
  - { lowerBound: 250000, ratePct: 9.25 }
  - { lowerBound: 500000, ratePct: 9.75 }
  - { lowerBound: 1000000, ratePct: 10.75 }
- retirement: { kind: "none" }

## Retirement-income detail
DC has a graduated tax from 4% to 10.75%. Bracket **thresholds are the same for
all filing statuses** (DC does not double them for joint filers). The standard
deduction conforms to the federal amount: **$15,000 (single) / $30,000 (MFJ)** for
2025.

DC fully exempts Social Security. Private pensions and traditional IRA/401(k)
distributions are **fully taxable**; DC offers only a narrow exclusion of up to
**$3,000** of military or DC/federal government pension income for retirees age
62+. Because there is no broad private-pension/IRA exclusion, this maps to
`retirement: { kind: "none" }`.

## Simplifications / not modeled
- The small $3,000 government-pension exclusion (age 62+) is not modeled — `none` slightly overstates tax for government retirees.
- DC's $1,675 personal exemption (phasing out at high income) not modeled.
- Brackets shown are the schedule effective for tax years after 12/31/2021; DC's published rates have not changed for 2025.

## Citations
- https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates — DC individual income tax brackets 4%–10.75% (current schedule).
- https://smartasset.com/retirement/district-of-columbia-retirement-taxes — SS exempt; private pension/IRA/401(k) taxable; standard deduction $15,000/$30,000.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (DC 4%–10.75%, std deduction $15,000/$30,000).
