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

An employer plan qualifies when its type is 401(a), 401(k), 457(b) or an IRA. A 403(b) is not enumerated (it is not a §401 plan, a §408 IRA or a §457 plan), so it gets no subtraction whatever basis another state taxed, and neither does an employer plan of other, unknown or undeclared type. Until 2026-10-06 the engine accepted every declared employer-plan type but other and unknown, so a 403(b) with $4,000 federally included and $6,000 of basis taxed by another state had $4,000 subtracted.

Authority: [Va. Code §58.1-322.02(11)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.02/).

> Any income received during the taxable year derived from a qualified pension, profit-sharing, or stock bonus plan as described by § 401 of the Internal Revenue Code, an individual retirement account or annuity established under § 408 of the Internal Revenue Code, a deferred compensation plan as defined by § 457 of the Internal Revenue Code, or any federal government retirement program, the contributions to which were deductible from the taxpayer's federal adjusted gross income, but only to the extent the contributions to such plan or program were subject to taxation under the income tax in another state.

### Virginia personal exemptions: $930 each, plus $800 at 65

Record: `va-code-58-1-322-03-2-personal-exemptions`. Classification: `settled`.

Section 58.1-322.03(2) allows $930 for each personal exemption the filer may claim federally, and $800 more for each taxpayer who is 65 or older or blind (IRC 63(f)); blindness is not modeled. The engine counts one exemption for a single filer and two on a joint return, and the $800 for each person 65 or older. It carried neither until the survey of 2026-09-28, which overstated tax by $99.48 for a single filer at 65 and $198.95 for a couple both 65 in the 5.75% bracket.

The $800 goes to a taxpayer who was 65 "on or before January 1" of the following year, as the 2025 Form 760 instructions put it, read from the claimants' dates of birth; until 2026-10-06 the engine used the age at the end of the year, so a January 1 birthday lost the $800 for the year before it. A part-year resident's $930 and $800 are prorated with the months of residence (Form 760PY's Prorated Exemption Worksheet prorates by days resident); until 2026-10-06 the Virginia slice of a split year took the whole exemptions.

The Virginia slice of a split year is taxed on the ordinary rate schedule, unscaled: Form 760PY computes the tax on Virginia taxable income from the same Tax Rate Schedule a full-year resident uses ($720 plus 5.75% over $17,000), and prorates only the standard deduction, the exemptions and the age deduction. The pack says so with `partYearRateSchedule: 'unscaled'`. Until 2026-10-06 the engine scaled the brackets with the months as well: a single filer under 65 resident six months with $60,000 of ordinary income paid $1,317.95 for the slice where 760PY gives $1,189.20. The engine spreads the year's income evenly over the months, so it prorates by months where 760PY prorates the standard deduction by the share of federal AGI received while resident and the exemptions by days; a year whose income fell unevenly across the move is not modeled. Every other state still scales its brackets for a split year, which overstates the tax where the part-year return taxes the resident-period income on the ordinary schedule, as New Jersey's does.

### Virginia age deduction: $12,000 at 65 from income of every kind, income-tested

Record: `va-code-58-1-322-03-age-deduction-and-social-security`. Classification: `settled`.

Section 58.1-322.03(5) allows $12,000 for each taxpayer born on or before January 1, 1939, and $12,000 for each later-born taxpayer who has attained 65, reduced $1 for each $1 by which adjusted federal AGI (AFAGI) exceeds $50,000 single or $75,000 married. It is Form 760 line 4, a deduction from income of every kind, not a retirement-income exclusion; Virginia has none. The engine follows Form 760's Age 65 and Older Deduction Worksheet on the three points the subsection leaves open:

- **AFAGI** is federal AGI less the *taxable* Social Security and Tier 1 Railroad Retirement benefits in it (worksheet lines 2 to 8), the same amount line 5 subtracts. The subsection's "any benefits received" is not read as the gross benefits: an untaxed benefit is not in federal AGI to subtract, the identical words in 58.1-322.02(3) (`va-code-58-1-322-02-3-ss-tier1`) mean the included amount, and the Department's worksheet takes the taxable figure.
- **Married taxpayers** are tested on their joint AFAGI against $75,000. When both spouses are income-tested, the reduction comes once off their combined $24,000 and the result is split evenly (lines 11 to 15); a spouse born on or before January 1, 1939 takes the full $12,000 outside that computation.
- **Attained 65** means born on or before January 1 of the year 64 years before the tax year (for 2025 the instructions name January 1, 1961), so a taxpayer whose 65th birthday falls on January 1 qualifies for the year that ends the day before.

For a couple both 70 with $60,000 of pensions and no Social Security in 2026, the deduction is $24,000 and Virginia tax is $622.00. Until 2026-10-06 the pack carried the $12,000 as a retirement-income exclusion with no income test, and from #710 (2026-09-13) the projection, which always supplies characterized retirement rows, bypassed even that: the couple was charged $1,987.30.

A qualifying surviving spouse is unmarried and is held to $50,000. A part-year resident's deduction is prorated with the months of residence (Form 760PY multiplies it by a days ratio), and the slice is taxed on the unscaled schedule (above). Not modeled: Virginia conformity adjustments to federal AGI (worksheet lines 3 and 5), the disability income subtraction and the credits for low-income individuals and earned income a taxpayer may claim instead of the deduction, and separate returns for a married couple, whose combined AFAGI the subsection would test.

Authority: [Va. Code §58.1-322.03(5)](https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/); [2025 Form 760 instructions](https://www.tax.virginia.gov/sites/default/files/vatax-pdf/2025-760-instructions.pdf), line 4, Taxpayers Age 65 and Older, and the Age 65 and Older Deduction Worksheet.

### Virginia standard deduction steps from 2027

Record: `va-code-58-1-322-03-standard-deduction-steps`. Classification: `settled`.

Section 58.1-322.03(1)(b) sets the standard deduction at $9,200 single and $18,400 joint for 2027, $9,300 and $18,600 for 2028 and 2029, and $3,000 and $6,000 from 2030. The figures enacted for those years carry each step; see [later-years-survey-2026-09-28.md](later-years-survey-2026-09-28.md).

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://www.tax.virginia.gov/news/new-virginia-tax-laws-july-1-2025 — 2025 standard deduction $8,750 single / $17,500 MFJ.
- https://taxfoundation.org/data/all/state/state-income-tax-rates/ — 2025 brackets 2%/3%/5%/5.75% at 0/3,000/5,000/17,000 (same for single and MFJ).
- https://law.lis.virginia.gov/vacode/title58.1/chapter3/section58.1-322.03/ — Va. Code §58.1-322.03(5)(b): adjusted federal AGI is federal AGI minus Title II Social Security benefits and other benefits taxable solely under IRC §86; $12,000 age-65 deduction reduced above $50,000 (single) / $75,000 (MFJ) of that adjusted amount (retrieved 2026-09-08). An earlier note here read the benefits as gross; Form 760's worksheet subtracts the taxable benefits, and the age deduction section above follows it (2026-10-06).
