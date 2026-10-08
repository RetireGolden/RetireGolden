# Connecticut (CT) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### Connecticut personal exemption uses Connecticut AGI and discrete steps

Record: `ct-personal-exemption-and-ct-agi-schedule`. Classification: `settled`.

The exemption uses Connecticut adjusted gross income, not federal AGI. Each $1,000 or fraction above the filing-status threshold removes $1,000 of exemption, floored at zero. The state schedule distinguishes single, MFS, HOH, and MFJ/qualifying surviving spouse. Unknown Connecticut AGI or status cannot establish an exemption. This record covers the personal-exemption worksheet, not rate-recapture or property-tax credits.

Authority: [§12-702(a)(2)(I), (b), (c)](https://www.cga.ct.gov/current/pub/chap_229.htm).

> For taxable years commencing on or after January 1, 2016, fifteen thousand dollars. In the case of any such taxpayer whose Connecticut adjusted gross income for the taxable year exceeds thirty thousand dollars, the exemption amount shall be reduced by one thousand dollars for each one thousand dollars, or fraction thereof, by which the taxpayer's Connecticut adjusted gross income for the taxable year exceeds thirty thousand dollars. In no event shall the reduction exceed one hundred per cent of the exemption. … Any husband and wife subject to tax under this chapter for any taxable year who file a return under the federal income tax for such taxable year as married individuals filing a joint return or any person who files a return for such taxable year as a surviving spouse ... shall be entitled to a single personal exemption of twenty-four thousand dollars... … In the case of any such taxpayer whose Connecticut adjusted gross income for the taxable year exceeds forty-eight thousand dollars, the exemption amount shall be reduced by one thousand dollars for each one thousand dollars, or fraction thereof, by which the taxpayer's Connecticut adjusted gross income for the taxable year exceeds the said amount. In no event shall the reduction exceed one hundred per cent of the exemption.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://www.incometaxpro.com/tax-rates/connecticut.htm — 2025 single and MFJ brackets (2%–6.99%); MFJ = 2× single thresholds.
- https://cga.ct.gov/2024/rpt/pdf/2024-R-0130.pdf — CT OLR "A Guide to Connecticut's Personal Income Tax" (brackets, no standard deduction).
- https://www.cga.ct.gov/2025/rpt/pdf/2025-R-0152.pdf — IRA deduction phase-in (75% in 2025, 100% in 2026); pension/annuity & SS AGI thresholds $75k/$100k.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (CT 2%–6.99%).

## IRA distributions follow the federal AGI schedule (2026-10-06)

Record: `ct-cgs-12-701-20-b-xxviii-xxix-ira-distribution-schedule`. Classification: `settled`.

From 2026 Conn. Gen. Stat. 12-701(a)(20)(B)(xxviii) and (xxix) subtract any distribution from a non-Roth IRA at a percentage of federal AGI: 100% below $75,000 ($100,000 joint), stepping through 85%, 70%, 55%, 40%, 25%, 10%, 5% and 2.5% to none at $100,000 ($150,000 joint). A Roth conversion is such a distribution. The engine applies the schedule to every IRA row except a Roth IRA's, at the year's federal AGI, a qualifying surviving spouse reading the unmarried schedule; until 2026-10-06 it subtracted every IRA dollar at any AGI. A conversion is a row of the traditional IRA it leaves, so it stays in; a Roth IRA's taxable earnings, such as an inherited Roth's before its five-year clock, get no subtraction. From 2026-10-08 a year split between states reaches the schedule: Connecticut's slice is the tax on the whole year as a resident, the schedule applied at the year's federal AGI to the year's rows, times line 6 over line 5 of the CT-1040NR/PY, Connecticut-source income with its modifications over Connecticut AGI, and the year is complete. Until then each slice was priced on the coarse inputs without the characterized rows, so the Connecticut slice took its share of the year's private retirement income off in full at any federal AGI, and the year was marked incomplete (`state-rich-split-year-adapter-required`): six months in Connecticut with $150,000 of federal AGI and a $30,000 IRA distribution, half the Connecticut tax on $150,000, $3,875.00, where the coarse slice took $15,000 off. Pensions and annuities follow the identical schedules of (xxi) and (xxii), which the engine does not yet apply (`ct-cgs-12-701-20-b-social-security-retirement`).

Authority: [Conn. Gen. Stat. 12-701](https://www.cga.ct.gov/current/pub/chap_229.htm).

## Part-year residents (2026-10-08)

Method (b), CT-1040NR/PY 2025 instructions: the tax as a resident times line 6, Connecticut-source income with its modifications, over line 5, Connecticut AGI; the retirement subtractions are percentages, with no dollar cap (ct-cgs-12-701-20-b-xxviii-xxix-ira-distribution-schedule). The 2026 figures carry it as `partYear: { method: 'incomePercentage', ratioBasis: 'stateIncome', exclusionCap: 'viaTaxRatio' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Connecticut and six in Texas, owes $2,375.00 for the Connecticut months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,596.43 when the conversion falls in the months resident and $2,553.57 when it falls in Texas's, where the months share of the year gave $3,575.00 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
