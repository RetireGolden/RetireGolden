# District of Columbia (DC) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### District government survivor exclusion remains after the old pension exclusion expires

Record: `dc-code-47-1803-03-government-survivor-exclusion`. Classification: `settled`.

Section 47-1803.02(a)(2)(N)(ii) excludes District or federal government survivor benefits received by a person age 62 or older at year end. It is separate from the $3,000 government-pension provision in (N)(i), which applies only before 2015. The eligible amount must be included in the federal base; ordinary pensions, nonqualifying issuers, Social Security survivor benefits and unknown issuer/age cannot establish this subtraction.

Authority: [D.C. Code §47-1803.02(a)(2)(N)(ii)](https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.02).

> Survivor benefits received from the District of Columbia or the federal government by persons who are 62 years of age or older by the end of the taxable year.

### The District's own standard deduction, 2026 to 2029

Record: `dc-code-47-1801-04-3a-standard-deduction-2026-2029`. Classification: `settled`. Reconciled 2026-10-08.

D.C. Law 26-189, the Fiscal Year 2027 Budget Support Act of 2026 (D.C. Act 26-418, Bill 26-661), took effect October 2, 2026, when its congressional review ended. It adds 47-1801.04(3A), a basic standard deduction of $15,000 single or married filing separately, $22,500 head of household and $30,000 joint for taxable years 2026 to 2029, indexed from a 2025 base year and rounded down to $50, and amends (44): the basic amount plus the IRC 63(c)(3) additional amount for 2025 to 2029, the federal deduction from 2030. Its subtitle I applies as of January 1, 2025 (sec. 7113), so it governs tax year 2026 whatever the status of the earlier acts.

History: the same amounts were enacted by D.C. Act 26-214 (emergency, December 3, 2025 to March 3, 2026), by D.C. Act 26-217 (temporary; the code site lists it as D.C. Law 26-89 from February 12, 2026, due to expire September 25, 2026) and by D.C. Act 26-416 (emergency, from August 13, 2026 for no more than 90 days). The temporary act's status is contested. Congress disapproved it by [Pub. L. 119-78](https://www.govinfo.gov/content/pkg/PLAW-119publ78/html/PLAW-119publ78.htm) (H.J. Res. 142), signed February 18, 2026, and the [White House statement](https://www.whitehouse.gov/briefings-statements/2026/02/congressional-bills-h-j-res-142-and-s-3705-signed-into-law/) of that day says the resolution nullifies it; the District's Attorney General, in an [opinion of February 24, 2026](https://oag.dc.gov/sites/default/files/2026-02/AG-Opinion-Decoupling-Retroactivity-and-Validity-.pdf), concluded that the resolution was enacted after the Home Rule Act's 30-day review period ended on February 11, did not repeal the temporary act, and did not change 2025 liabilities. The record takes no side; neither reading reaches the permanent law's application to 2026.

Part-year residents: (44)(D) prorates the deduction by months; the 2025 D-40 booklet's Calculation C by days.

Sources: the enrolled original on the Council's [Legislative Information Management System](https://lims.dccouncil.gov/Legislation/B26-0661) (code.dccouncil.gov had not codified Law 26-189 on 2026-10-08 and still printed the federal deduction in (44)(A)(iv)); [D.C. Act 26-416](https://code.dccouncil.gov/us/dc/council/acts/26-416), the emergency act with the same text. The Office of Tax and Revenue's 2026 D-40ES (Rev. 03/2026), written before the act, enters the federal $16,100 / $24,150 / $32,200 on its estimate worksheet; its 2026 D-40 booklet, about January 2027, is the check (`DOCS/maintenance-schedule.md`, Dated state tax decisions).

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates — DC individual income tax brackets 4%–10.75% (current schedule).
- https://smartasset.com/retirement/district-of-columbia-retirement-taxes — SS exempt; private pension/IRA/401(k) taxable; standard deduction $15,000/$30,000.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (DC 4%–10.75%, std deduction $15,000/$30,000).

## Part-year residents (2026-10-08)

Method (a), 2025 D-40 booklet: the income of the period domiciled in DC; the deduction, exemptions and subtractions by days (Calculation C), here by months (dc-code-47-1801-04-3a-standard-deduction-2026-2029). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'months', exemptions: 'months', ratioBasis: 'federalAgi', exclusionCap: 'months' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in the District and six in Texas, owes $2,362.50 for the the District months, the same as before. With a $40,000 Roth conversion on top, the slice is $5,412.50 when the conversion falls in the months resident and $2,362.50 when it falls in Texas's, where the months share of the year gave $3,712.50 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
