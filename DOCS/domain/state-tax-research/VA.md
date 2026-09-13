# Virginia (VA) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### Virginia military subtraction is $40,000 per recipient from TY2025

Record: `va-code-58-1-322-02-28-military-retirement-subtraction`. Classification: `settled`.

Section 58.1-322.02(18)(c) permits up to $40,000 of qualifying military benefits for TY2025 and later, at any age. Qualifying survivor benefits are included. OPM civil-service income and amounts already excluded or deducted under another provision do not enter this pool. Each recipient has a separate cap. The stable record ID retains its earlier suffix; the operative current paragraph is (18), not (28).

Authority: [Va. Code §58.1-322.02(18)(c)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/).

> For taxable years beginning on and after January 1, 2024, but before January 1, 2025, up to $30,000 of military benefits; and for taxable years beginning on and after January 1, 2025, up to $40,000 of military benefits. … For purposes of subdivisions b and c, "military benefits" means any (i) military retirement income received for service in the Armed Forces of the United States, (ii) qualified military benefits received pursuant to § 134 of the Internal Revenue Code, (iii) benefits paid to the surviving spouse of a veteran of the Armed Forces of the United States under the Survivor Benefit Plan program established by the U.S. Department of Defense, and (iv) military benefits paid to the surviving spouse of a veteran of the Armed Forces of the United States. The subtraction allowed by subdivision b shall be allowed only for military benefits received by an individual age 55 or older. The subtraction allowed by subdivision c shall be allowed for military benefits received by an individual of any age. No subtraction shall be allowed pursuant to subdivisions b and c if a credit, exemption, subtraction, or deduction is claimed for the same income pursuant to subdivision a or any other provision of Virginia or federal law.

### Virginia paragraph (3) subtracts included Social Security and Tier I

Record: `va-code-58-1-322-02-3-ss-tier1`. Classification: `settled`.

Paragraph (3) subtracts benefits taxable solely under IRC §86, including included Social Security and Tier I Railroad Retirement. Do not subtract Social Security again when already removed from the state base. Tier II and ordinary annuities are outside this paragraph; separate federal-protection authority may govern other railroad benefits.

Authority: [Va. Code §58.1-322.02(3)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/).

> Benefits received under Title II of the Social Security Act and other benefits subject to federal income taxation solely pursuant to § 86 of the Internal Revenue Code.

### Virginia recovers contributions previously taxed by another state

Record: `va-code-58-1-322-02-11-basis`. Classification: `settled`.

The subtraction covers included distributions from the enumerated §401, §408, §457 and federal retirement arrangements only to the extent contributions were federally deductible but taxed by another state. A Virginia-only contribution history is not sufficient. Require the prior taxing jurisdiction, qualifying plan and remaining unrecovered contribution basis; reduce the basis ledger only by accepted recovery.

Authority: [Va. Code §58.1-322.02(11)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/).

> Any income received during the taxable year derived from a qualified pension, profit-sharing, or stock bonus plan as described by § 401 of the Internal Revenue Code, an individual retirement account or annuity established under § 408 of the Internal Revenue Code, a deferred compensation plan as defined by § 457 of the Internal Revenue Code, or any federal government retirement program, the contributions to which were deductible from the taxpayer's federal adjusted gross income, but only to the extent the contributions to such plan or program were subject to taxation under the income tax in another state.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://www.tax.virginia.gov/news/new-virginia-tax-laws-july-1-2025 — 2025 standard deduction $8,750 single / $17,500 MFJ.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 brackets 2%/3%/5%/5.75% at 0/3,000/5,000/17,000 (same for single and MFJ).
- https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/ — Va. Code §58.1-322.03(5)(b): adjusted federal AGI is federal AGI minus gross Title II Social Security benefits and other benefits taxable solely under IRC §86; $12,000 age-65 deduction reduced above $50,000 (single) / $75,000 (MFJ) of that adjusted amount (retrieved 2026-09-08).
