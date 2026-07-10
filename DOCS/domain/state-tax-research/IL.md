# Illinois (IL) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 4.95%)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 4.95%)
- Retirement income (pension, IRA, 401k): **fully exempt** (qualified plans, IRAs, 401(k), government/military pensions, SS)

## Proposed StateTaxParams (2025)
- code: "IL"
- name: "Illinois"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 0, marriedFilingJointly: 0 }
- brackets.single: [ { lowerBound: 0, ratePct: 4.95 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 4.95 } ]
- retirement: { kind: "full" }

## Retirement-income detail
Illinois taxes income at a flat **4.95%** (unchanged since 2017) and has **no
standard deduction** (it uses a personal exemption instead — see below). Capital
gains, dividends, and interest are taxed at the same flat 4.95%.

Illinois fully exempts essentially all retirement income: Social Security
benefits, qualified employer pensions, IRA distributions (including Roth
conversions), 401(k)/403(b) distributions, railroad retirement, and
government/military pensions are all subtracted from Illinois base income.
Mapped to `retirement: { kind: "full" }` with no age gate (Illinois does not
condition the subtraction on age — eligibility turns on the income being from a
qualifying retirement source).

## Simplifications / not modeled
- No standard deduction; Illinois instead grants a personal exemption of $2,850 per person (2025), phased out at high AGI. Not modeled — set standardDeduction 0.
- `kind: "full"` already exempts pension/IRA/401(k); SS is independently exempt via `taxesSocialSecurity: false`.
- Non-qualified deferred comp and certain early/non-retirement distributions may not qualify for the subtraction; treated as fully exempt here.

## Citations
- https://www.visaverge.com/taxes/illinois-state-income-tax-rate-and-structure-for-2025-explained/ — 4.95% flat retained for 2025; retirement income exempt.
- https://tax.illinois.gov/research/publications/bulletins/fy-2025-16.html — Illinois DOR "What's New for Illinois Income Taxes" (rate, exemption).
- https://tax.illinois.gov/questionsandanswers/answer.851.html — $2,850 personal exemption 2025; no standard deduction.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — IL flat 4.95%.
