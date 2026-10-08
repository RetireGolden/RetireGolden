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

## Illinois applies the 2026 exemption and AGI eligibility limits (verified 2026-09-12)

The TY2026 basic allowance is $2,925 per eligible exemption, with a separate $1,000 age-65 addition. The allowance is unavailable above $250,000 federal AGI for nonjoint returns or $500,000 joint. Return exemption/dependency and age counts are required independently of retirement subtraction eligibility.

Registered as `il-personal-exemption-2026`. Authority: [Illinois FY 2026-15, 2026 personal exemption](https://tax.illinois.gov/research/publications/bulletins/fy-2026-15.html), [35 ILCS 5/204(b), (d)](https://www.ilga.gov/documents/legislation/ilcs/documents/003500050K204.htm).

## Part-year residents (2026-10-08)

Method (a), 2025 Schedule NR: line 48 divides line 46, the Illinois portion of base income, by line 47, base income, and line 50 applies it to the exemption; the retirement subtraction reaches the income received as a resident, with no cap (il-personal-exemption-2026). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'full', exemptions: 'incomeRatio', ratioBasis: 'stateIncome', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Illinois and six in Texas, owes $2,475.00 for the Illinois months, the same as before. With a $40,000 Roth conversion on top, the slice is $2,475.00 when the conversion falls in the months resident and $2,475.00 when it falls in Texas's, where the months share of the year gave $3,465.00 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
