# South Carolina (SC) — state income tax for retirement planning

Tax year: 2026. Authority reconciliation: 2026-09-12.

> **2027 (2026-09-28):** S.C. Code 12-6-510(C)(2) (H. 4216, Act 110) cuts the top rate beginning with
> Tax Year 2027 only if the Board of Economic Advisors projects the five percent revenue increase, on the
> forecast "in effect on February fifteenth" (2027). Not loaded: 2027 prices at the 2026 rates until then.

## Current calculation contract

The following source-specific contracts supersede older aggregate assumptions. A rule record identifies the calculator boundary; it does not certify that a projection fixture or a release gate has passed. Missing eligibility, source, allocation or state-basis facts must remain visible as incomplete.

### South Carolina ordinary retirement deduction has owner, age and penalty gates

Record: `sc-code-12-6-1170-retirement-income-deduction`. Classification: `approximated`.

An original account owner may deduct up to $3,000 of qualifying included retirement income, increasing to $10,000 in the year the owner turns 65. Premature-penalty distributions do not qualify. Surviving-spouse income attributable to the decedent retains its separate statutory treatment. Ordinary nonmilitary public income belongs in this capped pool, not the full military exclusion. Legacy aggregate classification remains approximate when source and penalty facts are unavailable.

Authority: [S.C. Code §12-6-1170(A)(1)-(4)](https://www.scstatehouse.gov/code/t12c006.php).

> (A)(1) An individual taxpayer who is the original owner of a qualified retirement account is allowed an annual deduction from South Carolina taxable income of not more than three thousand dollars of retirement income received. Beginning in the year in which the taxpayer reaches age sixty-five, the taxpayer may deduct not more than ten thousand dollars of retirement income that is included in South Carolina taxable income. (2) The term "retirement income", as used in this subsection, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer's surviving spouse in a taxable year from qualified retirement plans which include those plans defined in Internal Revenue Code Sections 401, 403, 408, and 457, and all public employee retirement plans of the federal, state, and local governments, including military retirement. (3) A surviving spouse receiving retirement income that is attributable to the deceased spouse shall apply this deduction in the same manner that the deduction applied to the deceased spouse. If the surviving spouse also has another retirement income, an additional retirement exclusion is allowed.

### South Carolina fully deducts qualifying military retirement

Record: `sc-code-12-6-1171-military-retirement`. Classification: `settled`.

Qualifying included military retirement and qualifying military survivor benefits are deductible in full under §1171. Ordinary public pensions are not military retirement. Premature-distribution and survivor definitions remain operative. Inactive-duty National Guard/reserve compensation under §1120(7) is a separate rule and is not silently treated as military retirement.

Authority: [S.C. Code §12-6-1171(A)-(D)](https://www.scstatehouse.gov/code/t12c006.php).

> (A) An individual taxpayer may deduct all military retirement income that is included in South Carolina taxable income. (B) The term "retirement income", as used in this section, means the total of all otherwise taxable income not subject to a penalty for premature distribution received by the taxpayer or the taxpayer's surviving spouse in a taxable year from a qualified military retirement plan. For purposes of a surviving spouse, "retirement income" also includes a retirement benefit plan and dependent indemnity compensation related to the deceased spouse's military service. (C) A surviving spouse receiving military retirement income that is attributable to the deceased spouse shall apply this deduction in the same manner that the deduction applied to the deceased spouse. If the surviving spouse also has another retirement income, an additional retirement exclusion is allowed.

### South Carolina age-65 deduction follows each owner’s retirement deductions

Record: `sc-code-12-6-1170-b-age-65-deduction`. Classification: `settled`.

Beginning in the year a resident reaches 65, up to $15,000 of that owner’s remaining South Carolina income is deductible. Reduce the limit by that owner’s §1170(A) and §1171 deductions, except deductions claimed as a surviving spouse. Two eligible spouses have separate $15,000 limits; one owner cannot consume the other’s remaining income. Unknown owner-attributed remaining income produces incomplete results.

Authority: [S.C. Code §12-6-1170(B)-(C)](https://www.scstatehouse.gov/code/t12c006.php).

> Beginning for the taxable year during which a resident individual taxpayer attains the age of sixty-five years, the resident individual taxpayer is allowed a deduction from South Carolina taxable income received in an amount not to exceed fifteen thousand dollars reduced by any amount the taxpayer deducts pursuant to subsection (A) not including amounts deducted as a surviving spouse. If married taxpayers eligible for this deduction file a joint federal income tax return, then the maximum deduction allowed is fifteen thousand dollars in the case when only one spouse has attained the age of sixty-five years and thirty thousand dollars when both spouses have attained such age. … Notwithstanding any other provision of this section, if a taxpayer claims a deduction pursuant to Section 12-6-1171, then the deduction allowed by this section must be reduced by the amount the taxpayer deducts pursuant to Section 12-6-1171; however, this subsection does not apply if the deduction claimed pursuant to Section 12-6-1171 is claimed by a surviving spouse.

### South Carolina SCIAD replaces the federal deduction for TY2026

Record: `sc-sciad-act-110-retirement-income-deduction`. Classification: `settled`.

Act 110 establishes SCIAD of $15,000 single/MFS, $22,500 HOH, and $30,000 joint/surviving spouse. The phaseout uses federal AGI and status-specific start/width values in the 2026 pack, with zero deduction at or beyond the endpoint. It is a general return deduction, not a pension-only allowance. The rate schedule and SCIAD first apply after 2025.

Authority: [2026 Act 110, H.4216, SCIAD and effective date](https://www.scstatehouse.gov/sess126_2025-2026/bills/4216.htm).

> a South Carolina Income Adjusted Deduction (SCIAD) equal to: (i) fifteen thousand dollars for taxpayers who file as single or married filing separately; (ii) twenty-two thousand five hundred dollars for taxpayers who file as head of household; and (iii) thirty thousand dollars for taxpayers who file as married filing jointly or as a surviving spouse. … The deduction set forth in subitem (a)(i) is subject to being reduced by a fraction whereby the numerator is the amount the taxpayer's federal adjusted gross income exceeds forty thousand dollars and the denominator is fifty-five thousand. … If the fraction calculated by this subitem is equal to or exceeds one, then the deduction is not allowed. If the fraction is zero, then the deduction is not subject to being reduced. If the fraction is between zero and one, then the deduction must be reduced by the corresponding fraction. … This act takes effect upon approval by the Governor and first applies to tax years beginning after 2025.

## Validation boundary

Source records above require discriminating positive and negative fixtures through the state calculation entry point, followed by actual `simulatePlan` event/basis integration. The source record alone does not establish those results. Annual parameters and generated rule/quote ledgers must be refreshed by the integration owner.

## Additional source history
- https://dor.sc.gov/sites/dor/files/forms/SC1040Instr_2025.pdf — 2025 SC1040 instructions: brackets 0%/3%/6%, starts from federal taxable income, retirement and age-65 deductions.
- https://dor.sc.gov/sites/dor/files/Documents/Policy%20Manuals/SCTIED-2025-Chapter%203.pdf — 2025 individual income tax policy manual: top rate 6.0%, $10,000 / $15,000 deductions, 44% net capital gain deduction.
- https://law.justia.com/codes/south-carolina/title-12/chapter-6/section-12-6-1150/ — SC Code §12-6-1150, 44% net capital gain deduction.
- https://dor.sc.gov/tax-tips/retirees-lower-your-individual-income-tax-bill-these-five-tips — SS exempt; retirement-income and age-65 deductions.
- Tax Foundation, State Individual Income Tax Rates and Brackets 2025 — SC top rate 6.0%.

## A Roth conversion counts toward the retirement deduction at any age (2026-10-06)

Record: `sc-code-12-6-1170-roth-conversion-not-premature`. Classification: `settled`.

S.C. Code 12-6-1170(A)(2) counts plan and IRA income not subject to a penalty for premature distribution, and IRC 408A(d)(3)(A)(ii) says section 72(t) does not apply to a conversion. The engine counts a conversion toward the $3,000 deduction ($10,000 from 65) whatever the owner's age; until 2026-10-06 it withheld the conversion of an owner under 59 and a half on January 1 as of unknown premature status and marked the year incomplete.

## Part-year residents (2026-10-08)

Method (a), 2025 Schedule NR: line 45 divides line 31 Column B by Column A (adjusted gross income, before South Carolina's additions and subtractions), line 47 applies it to the deduction, and line 48 is taxed on the ordinary table; the retirement deduction's caps are not prorated (sc-sciad-act-110-retirement-income-deduction). The 2026 figures carry it as `partYear: { method: 'residentPeriod', standardDeduction: 'incomeRatio', exemptions: 'incomeRatio', ratioBasis: 'federalAgi', exclusionCap: 'full' }` (params/state/data/year2026.ts), priced by tax/stateTax.ts#computeSplitYearResult on the income tax/statePartYear.ts#allocateSplitYear gives the months resident: a dated distribution or QCD transfer whole in the slice of its month, Social Security by the months paid, everything else by the months.

A single filer of 50 with $100,000 of ordinary income spread over 2026, resident six months in South Carolina and six in Texas, owes $1,248.25 for the South Carolina months, the same as before. With a $40,000 Roth conversion on top, the slice is $3,064.31 when the conversion falls in the months resident and $1,359.89 when it falls in Texas's, where the months share of the year gave $2,290.25 either way.

The limits every state shares (days priced as months, undated income spread by months, nonresident-period source income, the credit for tax paid to the other state, special accrual and the full-year elections not modeled) are in `va-code-58-1-322-03-2-personal-exemptions`; the worked figures are in packages/engine/src/tax/statePartYear*.rules.test.ts.
