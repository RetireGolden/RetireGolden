# New Hampshire (NH) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **no** (never taxed wages/retirement; interest & dividends tax repealed effective 2025)
- Taxes Social Security benefits: no
- Long-term capital gains: not taxed
- Retirement income (pension, IRA, 401k): not taxed

## Proposed StateTaxParams (2025)
- code: "NH"
- name: "New Hampshire"
- hasIncomeTax: false
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: false
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: []
- brackets.marriedFilingJointly: []
- retirement: { kind: "none" }

## Retirement-income detail
New Hampshire has **never** taxed wages, salaries, self-employment income,
pensions, IRA/401(k) distributions, or capital gains. Its only individual income
tax was the Interest & Dividends (I&D) Tax, which was **repealed effective for
tax periods beginning on or after January 1, 2025** (rate is 0% for 2025). For a
retirement planner, NH is now a true no-income-tax state, so
`hasIncomeTax: false` and all other fields are inert.

## Simplifications / not modeled
- Before 2025 the I&D tax was 3% (2024) on interest/dividends above $2,400 single
  / $4,800 joint, and never touched wages or retirement-plan distributions. We
  treat 2025 onward as no income tax. If the repeal is ever reversed (it has been
  discussed politically), this would need revisiting.

## Citations
- https://www.revenue.nh.gov/news-and-media/repeal-nh-interest-and-dividends-tax-now-effect — I&D tax repealed effective Jan 1, 2025.
- https://www.revenue.nh.gov/taxes-glance/interest-dividends-tax — prior 3% rate; applies only to interest/dividends, not wages/retirement.
