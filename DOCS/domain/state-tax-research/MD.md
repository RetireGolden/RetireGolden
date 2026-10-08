# Maryland (MD) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### Maryland TY2026 pension maximum is $40,600 before the benefit offset

Record: `md-tax-10-209-pension-exclusion`. Classification: `approximated`.

For TY2026 the published maximum is $40,600 per qualifying recipient. Section 10-209 permits the lesser of included qualifying employee-plan income and the maximum less all Social Security/Railroad Retirement benefits received, including nontaxable benefits. IRAs, Roth IRAs, rollover IRAs, SEPs and ineligible deferred compensation do not qualify. Age 65, total disability, or a totally disabled spouse supplies the ordinary eligibility gate. The current coarse cap does not establish source eligibility, disability or the recipient-specific gross-benefit offset and remains approximated; $50,000 qualifying pension and $20,000 benefits require $20,600, not $40,600.

Authority: [Maryland Comptroller, Pension Exclusion, calendar 2026 maximum](https://services.marylandcomptroller.gov/taxes/en/maryland-pension-exclusion?id=kb_article_view&sysparm_article=KB0010012).

> For calendar year 2025. For calendar year 2026, the maximum pension exclusion is $40,600.

Authority: [Md. Tax-General §10-209(a)-(e)](https://mgaleg.maryland.gov/2026RS/Statute_Web/gtg/10-209.pdf).

> (a) In this section: (1) “employee retirement system” means a plan: (i) established and maintained by an employer for the benefit of its employees; and (ii) qualified under § 401(a), § 403, or § 457(b) of the Internal Revenue Code; and (2) “employee retirement system” does not include: (i) an individual retirement account or annuity under § 408 of the Internal Revenue Code; (ii) a Roth individual retirement account under § 408A of the Internal Revenue Code; (iii) a rollover individual retirement account; (iv) a simplified employee pension under Internal Revenue Code § 408(k); or (v) an ineligible deferred compensation plan under § 457(f) of the Internal Revenue Code. (b) Subject to subsections (d) and (e) of this section, to determine Maryland adjusted gross income, if, on the last day of the taxable year, a resident is at least 65 years old or is totally disabled or the resident’s spouse is totally disabled, or the resident is 55 years old and is a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, an amount is subtracted from federal adjusted gross income equal to the lesser of: (1) the cumulative or total annuity, pension, or endowment income from an employee retirement system included in federal adjusted gross income; or (2) the maximum annual benefit under the Social Security Act computed under subsection (c) of this section, less any payment received as old age, … survivors, or disability benefits under the Social Security Act, the Railroad Retirement Act, or both. (c) For purposes of subsection (b)(2) of this section, the Comptroller: (1) shall determine the maximum annual benefit under the Social Security Act allowed for an individual who retired at age 65 for the prior calendar year; and (2) may allow the subtraction to the nearest $100. (d) (1) Military retirement income that is included in the subtraction under § 10–207(q) of this subtitle may not be taken into account for purposes of the subtraction under this section. (2) Public safety employee retirement income that is included in the subtraction under § 10–207(mm) of this subtitle may not be taken into account for purposes of the subtraction under this section. (e) In the case of a retired forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State, the amount included under subsection (b)(1) of this section is limited to the first $15,000 of retirement income that is attributable to the resident’s employment as a forest ranger, park ranger, or wildlife ranger of the United States, the State, or a political subdivision of the State unless: (1) the resident is at least 65 years old or is totally disabled; or (2) the resident’s spouse is totally disabled.

### Maryland corrections and later years from the survey of 2026-09-28

The survey of 2026-09-28 ([later-years-survey-2026-09-28.md](later-years-survey-2026-09-28.md)) found three 2026 figures the pack lacked, each now with its own record:

- `md-tg-10-217-2026-indexed-standard-deduction` (`approximated`): the standard deduction is indexed from 2026 under Tax-General 10-217(c), by an adjustment "as determined by the Comptroller"; the engine carries $3,400 single, as the Comptroller's 2026 withholding guide prints it, and $6,850 joint, computed by the same rule. The Comptroller's 2026 estimated-tax worksheet (Form PV, April 2026) prints $3,350 and $6,700, the 2025 amounts, which is the record's contrary reading; the 2026 Form 502 instructions, due in January 2027, settle it. The pack carried the 2025 $3,350 / $6,700.
- `md-tg-10-105-a-3-capital-gain-surtax` (`approximated`, overstates tax): an additional 2% of the net capital gain in Maryland AGI (Tax-General 10-105(a)(3)) for a filer whose federal AGI exceeds $350,000, charged in state tax only, not county tax. A primary-residence gain on a sale under $1,500,000, which (a)(3)(ii) excludes, reaches the state calculation as ordinary capital gain and is surcharged.
- `md-tg-10-207-mm-public-safety-retirement-subtraction` (`settled`): 10-207(mm), as amended by 2026 Md. Laws ch. 686, subtracts the first $16,000 of public-safety retirement income at 55 or older for 2026, $17,000 for 2027, $18,000 for 2028, $19,000 for 2029 and $20,000 from 2030, and 10-209(d)(2) keeps that income out of the pension exclusion. It applies to a pension the plan marks as public-safety service, a marker the planner's pension editor does not yet offer.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://blog.turbotax.intuit.com/income-tax-by-state/maryland-105400/ — full 2025 single & MFJ bracket schedule (2%–6.5%, incl. new 6.25%/6.5% tiers); standard deduction $3,350 / $6,700.
- https://www.gfrlaw.com/what-we-do/insights/maryland-tax-alert-2025 — 2025 new 6.25%/6.5% brackets and 2% capital-gains surtax over $350k AGI.
- https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/Pension-Exclusion-Worksheet.pdf — 2025 pension exclusion $41,200; age-65 requirement; employer-plan qualifying income; SS offset.
- https://legalclarity.org/how-does-maryland-tax-retirement-income/ — SS fully exempt; pension exclusion mechanics.

## Part-year residents (2026-10-08)

Method (a), Form 502 marked "P" (2025 resident booklet; Tax Tip #52): the deduction and exemptions times the Maryland income factor, line 16 Maryland AGI over line 1 federal AGI; the tax on the ordinary schedule; the pension exclusion figured as for the full year, times the months resident over 12 (md-tg-10-217-2026-indexed-standard-deduction). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'incomeRatio', exemptions: 'incomeRatio', ratioBasis: 'stateOverFederalAgi', exclusionCap: 'months' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Maryland and six in Texas, owes $2,241.75 for the Maryland months, the same as before. With a $40,000 Roth conversion on top, the slice is $4,118.68 when the conversion falls in the months resident and $2,264.82 when it falls in Texas's, where the months share of the year gave $3,191.75 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
