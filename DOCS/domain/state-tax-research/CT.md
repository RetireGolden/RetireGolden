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
