# New Jersey (NJ) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### New Jersey excludes U.S. military pension and survivor payments

Record: `nj-stat-54a-6-26-military-pension-exclusion`. Classification: `settled`.

Qualifying U.S. military pension and military survivor benefits are excluded without an age or income cap. OPM civil-service pensions remain taxable even when military service earns pension credit. This military exclusion is separate from the income-tested ordinary pension exclusion, and the same payment must not consume both pools.

Authority: [N.J.S.A.54A:6-26; P.L.2001 c.84 §1](https://pub.njleg.gov/bills/2000/PL01/84_.PDF).

> Gross income shall not include military pension payments or military survivor's benefit payments paid to individuals by the United States with respect to service in the Armed Forces of the United States.

Authority: [NJ Division of Taxation, military pension and survivor payments](https://www.nj.gov/treasury/taxation/military/taxinformation.shtml).

> Federal civil service pensions or annuities issued by the U.S. Office of Personnel Management are taxable in New Jersey, even if the pension or annuity is based on credit for military service.

### New Jersey HSA contributions and ordinary account categories require separate state accounting

Record: `nj-hsa-state-basis-nonconformity`. Classification: `unsettled`.

IRC §223 HSA contributions have no New Jersey deduction. Employer/employee contribution inclusions must not duplicate amounts already in state wages. Under the explicit ordinary-category design assumption, recognize interest, dividends and realized gains with New Jersey lot basis; unrealized appreciation is not a realized gain. A cash distribution is not automatically a second income event. Unknown cash/in-kind characterization, annual activity or basis produces incomplete results. The archived 2010 agency HSA answer settles contributions, but does not settle every distribution lifecycle; A2634 is proposed, not enacted.

Authority: [New Jersey State Tax News, Summer 2010, p.4, Contributions to Health Savings Accounts; official archive index authenticates the preserved publication](https://www.nj.gov/treasury/taxation/pdf/pubs/stn/summer10.pdf).

> The Division replied that the New Jersey Gross Income Tax Act does not allow any deduction for contributions made to a health savings account, which refers to an account established under IRC §223.

Authority: [NJ Division of Taxation, OBBBA and the New Jersey Gross Income Tax](https://www.nj.gov/treasury/taxation/individuals/obbba.shtml).

> the New Jersey Gross Income Tax (GIT) has defined categories of income and deductions and is not computed based on federal adjusted gross income.

Archival authentication only (not operative tax authority): [NJ Division of Taxation, August 19, 2010 archive publication entry](https://www.nj.gov/treasury/taxation/enewsarc/august2010.shtml) (the index moved from the `whatsnewarc` path, which returns 404 as of 2026-09-23).

> New Jersey State Tax News

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 single & MFJ brackets (1.4%–10.75%, MFJ 2.45% bracket); no standard deduction.
- https://www.nj.gov/treasury/taxation/njit7.shtml — Retirement Income Exclusion: $100k MFJ / $75k single / $50k MFS, age 62+, income ≤ $150,000 with phase-down; SS exempt.
- https://www.nj.gov/treasury/taxation/pdf/pubs/stn/summer10.pdf — Summer 2010 New Jersey State Tax News (HSA employer/employee contribution treatment).
- https://www.nj.gov/treasury/taxation/pdf/pubs/tgi-ee/git1%262.pdf — January 2026 GIT-1 and 2, Worksheet C.

## Direct charitable IRA transfer and state basis

Record: `nj-direct-qcd-ira-basis-treatment`. New Jersey independently computes the taxable portion of a traditional IRA distribution. A federal QCD exclusion is not a blanket New Jersey subtraction; the taxable transfer is determined using Worksheet C with the owner annual distribution denominator and unrecovered New Jersey contributions. Prior recoveries and all annual withdrawals must be counted once. Unknown owner basis or incomplete annual totals produce incomplete results. A1290 is proposed legislation, not a current charitable carve-out.

Authority: [January 2026 GIT-1 & 2, Worksheet C](https://www.nj.gov/treasury/taxation/pdf/pubs/tgi-ee/git1%262.pdf).

The preserved Summer 2010 HSA answer is historical agency evidence. Its original `summer10.pdf` URL returned HTTP 404 in the September 12, 2026 research check and again on September 23, 2026, when the whole State Tax News PDF folder was gone from nj.gov with no official copy elsewhere; the official archive authenticates the publication but does not itself supply an operative HSA rule.

## The pension exclusion is income-tested and per return (2026-10-06)

Record: `nj-stat-54a-6-10-retirement-income-exclusion`. Classification: `settled`.

N.J.S.A. 54A:6-10(b) and NJ-1040 line 28a: for a taxpayer 62 or older (or disabled) on the last day of the year, and only when New Jersey gross income is $150,000 or less, the exclusion is the lesser of the qualifying spouse's pension, annuity and IRA payments and, at gross income up to $100,000, $100,000 joint or $75,000 otherwise; above $100,000 it is 50% (joint) or 37.5% of all payments to $125,000 and 25% or 18.75% to $150,000. The engine computes it after every other New Jersey adjustment, testing the base at that point as gross income, and counts a Roth conversion like any IRA distribution. Until 2026-10-06 it gave $50,000 for each household member 62 or older with no income test. Not modeled: line 28b's unclaimed exclusion, the special exclusion, the New Jersey basis of a distribution, and a QCD New Jersey taxes.

A year split between states prorates the exclusion's maximum and scales its income bounds with the slice. The slice's brackets are scaled with the months too, which taxes the year's income as a full-year resident and keeps the resident share; NJ-1040 taxes a part-year resident's resident-period income on the ordinary tax table, so the engine overstates New Jersey tax on a split year with income above the lowest band. Virginia is the only state whose brackets the split-year path leaves unscaled (`va-code-58-1-322-03-2-personal-exemptions`).
