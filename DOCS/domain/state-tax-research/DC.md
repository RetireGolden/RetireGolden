# District of Columbia (DC) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### District government survivor exclusion remains after the old pension exclusion expires

Record: `dc-code-47-1803-03-government-survivor-exclusion`. Classification: `settled`.

Section 47-1803.02(a)(2)(N)(ii) excludes District or federal government survivor benefits received by a person age 62 or older at year end. It is separate from the $3,000 government-pension provision in (N)(i), which applies only before 2015. The eligible amount must be included in the federal base; ordinary pensions, nonqualifying issuers, Social Security survivor benefits and unknown issuer/age cannot establish this subtraction.

Authority: [D.C. Code §47-1803.02(a)(2)(N)(ii)](https://code.dccouncil.gov/us/dc/council/code/sections/47-1803.02).

> Survivor benefits received from the District of Columbia or the federal government by persons who are 62 years of age or older by the end of the taxable year.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://otr.cfo.dc.gov/page/dc-individual-and-fiduciary-income-tax-rates — DC individual income tax brackets 4%–10.75% (current schedule).
- https://smartasset.com/retirement/district-of-columbia-retirement-taxes — SS exempt; private pension/IRA/401(k) taxable; standard deduction $15,000/$30,000.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — Tax Foundation 2025 cross-check (DC 4%–10.75%, std deduction $15,000/$30,000).
