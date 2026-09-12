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

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://blog.turbotax.intuit.com/income-tax-by-state/maryland-105400/ — full 2025 single & MFJ bracket schedule (2%–6.5%, incl. new 6.25%/6.5% tiers); standard deduction $3,350 / $6,700.
- https://www.gfrlaw.com/what-we-do/insights/maryland-tax-alert-2025 — 2025 new 6.25%/6.5% brackets and 2% capital-gains surtax over $350k AGI.
- https://www.marylandcomptroller.gov/content/dam/mdcomp/tax/forms/worksheets/Pension-Exclusion-Worksheet.pdf — 2025 pension exclusion $41,200; age-65 requirement; employer-plan qualifying income; SS offset.
- https://legalclarity.org/how-does-maryland-tax-retirement-income/ — SS fully exempt; pension exclusion mechanics.
