# Louisiana (LA) — state income tax for retirement planning

Tax year: 2025. Researched 2026-06-13.

## Summary
- Broad individual income tax: **yes** (flat 3.0%, new for 2025)
- Taxes Social Security benefits: no (fully exempt)
- Long-term capital gains: taxed as ordinary income (flat 3.0%)
- Retirement income (pension, IRA, 401k): up to $12,000 per person excluded at age 65+ (certain government/state pensions fully exempt)

## Historical baseline (2025; retirement cap updated to TY2026)
- code: "LA"
- name: "Louisiana"
- hasIncomeTax: true
- taxesSocialSecurity: false
- capitalGainsAsOrdinary: true
- standardDeduction: { single: 12500, marriedFilingJointly: 25000 }
- brackets.single: [ { lowerBound: 0, ratePct: 3.0 } ]
- brackets.marriedFilingJointly: [ { lowerBound: 0, ratePct: 3.0 } ]
- retirement: { kind: "capped", capPerPerson: 12324, minAge: 65 }

## Retirement-income detail
For tax periods beginning on/after January 1, 2025, Louisiana replaced its
graduated rates with a flat **3.0%** individual income tax (2024 reform). The
standard deduction was raised substantially to **$12,500** single / **$25,000**
MFJ (inflation-adjusted from 2026). Social Security benefits are not taxed.

Louisiana allows persons **age 65 or older** to exclude up to **$12,000 of
annual retirement income** (pension and annuity income otherwise included in
federal income) per person — both spouses 65+ on a joint return may each exclude
up to $12,000. Mapped to `retirement: { kind: "capped", capPerPerson: 12324,
minAge: 65 }`. Certain federal and Louisiana state/local government retirement
benefits (and federal railroad/SS) are fully exempt separately.

## Simplifications / not modeled
- Full exemption of qualifying federal/Louisiana state/local government pensions approximated by the ordinary age cap on legacy aggregate input. The characterized path separately applies §47:44.2 to US-government and RRA sources; unknown source/age is incomplete.
- The $12,000 exclusion is CPI-adjusted from 2025; the 2025 nominal $12,000 is held forward.
- Standard deduction is also CPI-adjusted starting 2026; 2025 nominal amounts used.

## 2026 correction (pack update; historical 2025 figures above unchanged)

La. R.S. 47:294(B) CPI-U adjustment beginning January 1, 2026 yields TY2026 standard
deduction **$12,875** single and **$25,750** MFJ per LDR 2026 Form IT-540ESi
(`la-ldr-it540es-2026-standard-deduction`).

La. R.S. 47:44.1(A) indexes the age-65 retirement exemption by the prior-calendar-year
CPI-U increase. For TY2026 the previous calendar year is 2025; BLS reports the
U.S.-city-average all-items CPI-U twelve-month increase through December 2025 as
**2.7%**, so the exemption is **$12,000 + ($12,000 × 0.027) = $12,324**. The pack
encodes `capPerPerson: 12324` (`la-rs-47-44-1-retirement-exemption`).

La. R.S. 47:44.2 fully excludes federal civil-service and Railroad Retirement income.
The coarse `PUBLIC_PENSION_OVERRIDES.LA` `{ kind: 'full' }` path still over-reaches onto
municipal public pensions; characterized source facts route only federal/railroad through
§47:44.2 (`la-rs-47-44-2-public-bucket-overreach`).

## Citations
- https://revenue.louisiana.gov/tax-education-and-faqs/faqs/income-tax-reform/what-are-the-individual-income-tax-rates-and-brackets/ — flat 3% for periods on/after 1/1/2025.
- https://www.mgocpa.com/perspective/louisiana-enacts-significant-tax-changes/ — standard deduction $12,500 single / $25,000 MFJ; retirement exemption raised to $12,000.
- https://www.law.cornell.edu/regulations/louisiana/La-Admin-Code-tit-61-SS-I-1311 — annual retirement income exemption, age 65+, up to $12,000 per person.
- https://dam.ldr.la.gov/taxforms/IT540ESi-2026.pdf — TY2026 estimated-tax worksheet: Single $12,875, Married Filing Joint $25,750.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — LA flat 3.0%.

## TY2026 characterized retirement rule

La. R.S. 47:44.1(A) indexes the $12,000 starting amount by the previous calendar-year CPI-U change. The 2025 change of 2.7% produces $12,324 for 2026. Apply per eligible age-65 recipient after separately exempt federal/RRA benefits; unknown age is incomplete. [La. R.S. 47:44.1](https://www.legis.la.gov/legis/Law.aspx?d=102133) and [47:44.2](https://www.legis.la.gov/legis/Law.aspx?d=102134).

## Part-year residents (2026-10-08)

Method (a), 2025 Form IT-540B: line 10 enters the whole standard deduction, line 11E prorates only the itemized excess, line 13 taxes at 3%; the age-65 exclusion's cap is not prorated (la-ldr-it540es-2026-standard-deduction). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'full', exemptions: 'full', ratioBasis: 'federalAgi', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in Louisiana and six in Texas, owes $1,113.75 for the Louisiana months, the same as before. With a $40,000 Roth conversion on top, the slice is $2,313.75 when the conversion falls in the months resident and $1,113.75 when it falls in Texas's, where the months share of the year gave $1,713.75 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
