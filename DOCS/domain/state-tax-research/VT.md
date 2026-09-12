# Vermont (VT) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### Vermont TY2026 indexed rates and deduction inputs derive from enacted CPI formulas

Record: `vt-2026-rates-standard-deduction-minimum-tax`. Classification: `settled`.

The enacted CPI-U adjustment and completed September 2024–August 2025 window establish 2026 amounts; the final return booklet is corroboration, not a prerequisite. Standard deductions are $7,850 single/MFS, $11,800 HOH and $15,700 joint/QSS, with $5,400 per personal exemption and $1,300 per §63(f) qualification. Four full filing-status schedules retain rates 3.35%, 6.60%, 7.60% and 8.75%. Use continuous marginal arithmetic, including $18,915.55 at the MFJ top threshold. IN-114 remains explicitly preliminary. The minimum-tax comparison has its own sibling record.

Authority: [32 V.S.A. section 5811(21)(C)(i)-(iii), (D)](https://legislature.vermont.gov/statutes/section/32/151/05811).

> shall be adjusted annually for inflation ... using the Consumer Price Index and the same methodology as ... 26 U.S.C. section 1(f)(3)

Authority: [32 V.S.A. section 5822(a)(1)-(4), (b)(2)](https://legislature.vermont.gov/statutes/section/32/151/05822).

> The amounts of taxable income shown in the tables ... shall be adjusted annually for inflation by the Commissioner of Taxes

Authority: [26 U.S.C. section 1(f)(3)-(7)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim).

> average ... as of the close of the 12-month period ending on August 31

### Vermont minimum tax compares ordinary tax with the adjusted 3% floor

Record: `vt-32-5822-a-6-minimum-tax`. Classification: `settled`.

Only when federal AGI exceeds $150,000, compare ordinary income tax with 3% of federal AGI after the statutory U.S.-obligation adjustment. Exactly $150,000 does not trigger the floor. Unknown U.S.-obligation adjustment cannot be replaced by zero. Consume the year pack threshold and rate.

Authority: [32 V.S.A. §5822(a)(6)](https://legislature.vermont.gov/statutes/section/32/151/05822).

> If the federal adjusted gross income of the taxpayer exceeds $150,000.00, then the tax calculated under this subsection shall be the greater of the tax calculated under subdivisions (1)-(5) of this subsection or three percent of the taxpayer’s federal adjusted gross income.

### Vermont civil-service and contributory exclusion is elected against Social Security

Record: `vt-32-5830e-retirement-election`. Classification: `settled`.

Eligible civil-service/contributory income receives up to $10,000, phased out over AGI $55,000–$65,000 single or $70,000–$80,000 joint. Other contributory public systems must be based on earnings not covered by Social Security. Elect only one of §5830e(a), (b), or (c). Military exclusion under (d) may coexist. Missing election or qualifying-system facts are incomplete, not an automatic best-of grant.

Authority: [32 V.S.A. §5830e(b),(c),(e)](https://legislature.vermont.gov/statutes/section/32/151/05830e).

> If the federal adjusted gross income of the taxpayer is less than or equal to $55,000.00, the first $10,000.00 of income received from the Civil Service Retirement System shall be excluded. … If the federal adjusted gross income of the taxpayer is less than or equal to $70,000.00, the first $10,000.00 of income received from the Civil Service Retirement System shall be excluded. … Other retirement income, except U.S. military retirement income pursuant to subsection (d) of this section, received by a taxpayer of this State shall be excluded pursuant to subsection (b) of this section as though the income were received from the Civil Service Retirement System and shall be subject to the limitations under subsection (e) of this section, provided that: … the income is received from a contributory annuity, pension, endowment, or retirement system of the U.S. government or a political subdivision or instrumentality of the U.S. government; this State or a political subdivision or instrumentality of this State; or another state or a political subdivision or instrumentality of another state; and the contributory system from which the income is received was based on earnings that were not covered by the Social Security Act. … A taxpayer of this State who is eligible during the taxable year for more than one of the exclusions under subsections (a), (b), and (c) of this section shall elect only one of the exclusions for which the taxpayer is eligible.

### Vermont military and survivor exclusion can coexist with the civil/SS election

Record: `vt-32-5830e-d-military-survivor`. Classification: `settled`.

For every filing status, included U.S. military retirement/survivor benefits are fully excluded at AGI up to $125,000, proportionally reduced over $125,000–$175,000, and zero at $175,000 or more. This exclusion may coexist with the chosen Social Security or civil-service exclusion. Unknown military source is not qualifying income.

Authority: [32 V.S.A. §5830e(d),(e)](https://legislature.vermont.gov/statutes/section/32/151/05830e).

> If the federal adjusted gross income of the taxpayer is less than or equal to $125,000.00, all federally taxable U.S. military retirement income and survivor benefit income shall be excluded. … If the federal adjusted gross income of the taxpayer is greater than $125,000.00 but less than $175,000.00, the percentage of federally taxable U.S. military retirement income and survivor benefit income to be excluded shall be proportional to the amount of the taxpayer’s federal adjusted gross income over $125,000.00. … If the federal adjusted gross income of the taxpayer is equal to or greater than $175,000.00, no amount of the federally taxable U.S. military retirement income and survivor benefit income received shall be excluded under this section. … A taxpayer of this State who is eligible during the taxable year for the military retirement and survivor benefit exclusion under subsection (d) of this section may elect that exclusion regardless of whether the taxpayer also elects an exclusion under subsections (a)–(c) of this section.

### Vermont excludes federally protected railroad income once

Record: `vt-32-5823-railroad-exclusion`. Classification: `settled`.

Tier I and Tier II Railroad Retirement included in the federal base are excluded from Vermont income. Remove only the federally included amount and do not duplicate a subtraction already taken elsewhere. Ordinary nonrailroad pensions do not qualify.

Authority: [32 V.S.A. §5823(a)(1)](https://legislature.vermont.gov/statutes/section/32/151/05823).

> (1) income exempted from State taxation under the laws of the United States and not subtracted under subdivision 5811(21)(B)(i) of this chapter;

Authority: [2025 Schedule IN-112 instructions, page 4, line 14, railroad retirement](https://tax.vermont.gov/sites/tax/files/documents/IN-112-Instr-2025.pdf).

> Railroad Retirement. Enter the amount you received in 2025 for Regular Railroad Retirement Benefits (Tier 1) and Supplemental Railroad Annuity Payments (Tier 2). This income is taxable at the federal level, but exempt from Vermont income tax. If you receive Social Security that includes Tier 1 or Tier 2 benefits, enter only the portion included in your federal Adjusted Gross Income.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 Vermont brackets (single 0/47,900/116,000/242,000; MFJ 0/79,950/193,300/294,600) and standard deduction $7,400/$14,850.
- https://legislature.vermont.gov/statutes/section/32/151/05830e — § 5830e(a), exact filing-status thresholds and the $10,000 proportional phaseout bands.
- https://ljfo.vermont.gov/assets/Publications/Issue-Briefs/GENERAL-379202-v2-How_Vermont_Taxes_Social_Security_Benefits-v2.pdf — income-based SS exemption mechanics.
