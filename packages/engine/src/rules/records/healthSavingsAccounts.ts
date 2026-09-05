/**
 * Health savings account records: the section 223 contribution limits and proration,
 * the qualified-medical exclusion and its reimbursement conditions, the age-65 and
 * Medicare boundaries, the section 4973 excise on excess contributions, and the
 * terminal-estate inclusion approximation.
 *
 * One slice of the tax rule registry. `../taxRuleRegistry.ts` composes every
 * slice into `TAX_RULE_REGISTRY`; read it for what a record must carry and why.
 * Records and the commentary attached to them were moved here verbatim, so a
 * block that says "above" or "below" may now point across a module boundary.
 */
import type { TaxRuleRecord } from '../taxRuleRegistry.js'

// `satisfies` without `as const`, matching the composed registry: keys and the
// union-typed fields (classification, kind, volatility) stay literal for
// describeRule's conditional typing, while the prose strings widen to `string`.
export const healthSavingsAccountRecords = {
  'irc-223-b-2-hsa-base-limits-2026': {
    title: 'The 2026 HSA base limits are 4,400 self-only and 8,750 family',
    statement:
      'For calendar year 2026, the annual HSA contribution limitation is 4,400 dollars for self-only coverage and 8,750 dollars for family coverage. These are the subsection (b)(2) base limits before any age-55 catch-up, married-spouse division, or monthly eligibility proration.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Section 223(b)(2) supplies the self-only and family coverage categories, while Rev. Proc. 2025-19 publishes the inflation-adjusted 2026 dollar amounts. The projection reads those values from the versioned parameter pack; the age-55 catch-up and the monthly/Medicare limits are separate records.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        '(A) in the case of an eligible individual who has self-only coverage under a high deductible health plan as of the first day of such month, $2,250.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(b)(2)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        '(B) in the case of an eligible individual who has family coverage under a high deductible health plan as of the first day of such month, $4,500.',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-19, section 2.01(1)',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-19.pdf',
      quotedText:
        'For calendar year 2026, the annual limitation on deductions under \u00a7 223(b)(2)(A) for an individual with self-only coverage \u2026 is $4,400. For calendar year 2026, the annual limitation on deductions under \u00a7 223(b)(2)(B) for an individual with family coverage \u2026 is $8,750.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },

  'irc-223-b-5-hsa-family-limit-divided-between-spouses': {
    title: 'Spouses share one family HSA limit but keep whole catch-ups',
    statement:
      'Where either spouse has family coverage, both spouses are treated as having that family coverage and the resulting family limit is divided equally between them unless they agree on a different division. Paragraph (5)(B) computes the amount to be divided without regard to the age-55 additional contribution amount, so the halving reaches only the base: each spouse adds a whole catch-up on top of half the family limit, not half a catch-up.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'Two facts the statute turns on are absent from the plan model, and each is resolved toward the statutory default. The division by agreement under (5)(B)(ii) cannot be observed, so the engine takes the equal division the statute applies in its absence. Coverage election is likewise unmodelled: a two-person household is treated as having family coverage, which is already what selects the family base, and paragraph (5)(A) then makes that coverage apply to both spouses. Paragraph (5) opens on individuals who are married to each other, so the division is applied only where the two-person household is also a married one with both spouses living. Household size does not carry that fact by itself: the plan schema requires two people for a joint return but does not require a joint return of a two-person household, so an unmarried pair is representable. Each of them is then simply an eligible individual with family coverage under (b)(2)(B) whom paragraph (5) never reaches, and each keeps a whole family limit. A sole survivor keeps the undivided base for the same reason, having nobody left to divide with. The per-person contribution group key is retained rather than replaced by a household one precisely so the (b)(3) catch-up stays attached to the spouse who earned it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'In the case of individuals who are married to each other, if either spouse has family coverage- (A) both spouses shall be treated as having only such family coverage (and if such spouses each have family coverage under different plans, as having the family coverage with the lowest annual deductible), and (B) the limitation under paragraph (1) (after the application of subparagraph (A) and without regard to any additional contribution amount under paragraph (3))- (i) shall be reduced by the aggregate amount paid to Archer MSAs of such spouses for the taxable year, and (ii) after such reduction, shall be divided equally between them unless they agree on a different division.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(b)(2)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'The monthly limitation for any month is 1/12 of- ... (B) in the case of an eligible individual who has family coverage under a high deductible health plan as of the first day of such month, $4,500.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },

  'irc-223-f-4-hsa-age-65-boundary': {
    title: 'Age-65 waiver of the HSA 20 percent additional tax',
    statement:
      'The 20 percent additional tax on a nonqualified HSA distribution is waived only for a distribution made after the date the account beneficiary attains age 65, so the exception begins the day after the 65th birthday and a distribution on the birthday itself still bears the tax. The waiver reaches only the additional tax; ordinary income inclusion under 223(f)(2) survives at any age.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(f)(4)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'Subparagraph (A) shall not apply to any payment or distribution after the date on which the account beneficiary attains the age specified in section 1811 of the Social Security Act.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(i), drafting contrast',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'made on or after the date on which the employee attains age 59 1/2',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8889, line 17b',
      url: 'https://www.irs.gov/instructions/i8889',
      quotedText:
        'The additional 20% tax does not apply to distributions made after the account beneficiary: Dies, Becomes disabled or Turns age 65.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualHsaPenaltyEvaluation.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaPenaltyEvaluation.ts#evaluateAnnualHsaPenalty',
    ],
  },

  'irc-223-f-1-hsa-qualified-medical-exclusion': {
    title: 'Qualified medical HSA distributions are excluded from income',
    statement:
      'A distribution used exclusively to pay qualified medical expenses of an account beneficiary is not includible in gross income at all, so it is neither taxable nor exposed to the 20 percent additional tax. Only the nonqualified portion is includible.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'Any amount paid or distributed out of a health savings account which is used exclusively to pay qualified medical expenses of any account beneficiary shall not be includible in gross income.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 969',
      url: 'https://www.irs.gov/publications/p969',
      quotedText:
        'There is an additional 20% tax on the part of your distributions not used for qualified medical expenses. Figure the tax on Form 8889 and file it with your Form 1040, 1040-SR, or 1040-NR.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: ['packages/engine/src/actions/annualHsaPenaltyEvaluation.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaPenaltyEvaluation.ts#evaluateAnnualHsaPenalty',
    ],
  },

  // --- Deliberately not modelled; the engine must fail closed -------------

  'irc-223-f-4-B-hsa-death-exception': {
    title: 'Death waives the HSA 20 percent additional tax',
    statement:
      'The 20 percent additional tax does not apply to a distribution made after the account beneficiary becomes disabled or dies. Not modelled: the engine carries disability evidence but holds no death fact, and death also ends the account HSA status under 223(f)(8), so treating it as merely waiving the 20 percent would understate the event.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'a death fact in the HSA distribution facts: evaluateAnnualHsaPenalty carries disability evidence and nothing for death',
      'the section 223(f)(8) loss of HSA account status at death, without which waiving the 20 percent alone would understate the event',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(f)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'Subparagraph (A) shall not apply if the payment or distribution is made after the account beneficiary becomes disabled within the meaning of section 72(m)(7) or dies.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualHsaPenaltyEvaluation.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaPenaltyEvaluation.ts#evaluateAnnualHsaPenalty',
    ],
  },

  'irc-223-f-4-B-hsa-disability-exception': {
    title: 'HSA disability waives the additional tax, not the inclusion',
    statement:
      'A distribution made after the account beneficiary becomes disabled within the meaning of section 72(m)(7) is not subject to the 20 percent additional tax. The distribution stays includible in gross income: subparagraph (A) increases the tax by 20 percent of the amount which is so includible, and the exception switches off that increase without touching the inclusion itself.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The section 223(f)(1) qualified-medical exclusion sits in the same subsection and does remove inclusion, which makes the two easy to conflate. Section 72(m)(7) also requires the individual to furnish proof in such form and manner as the Secretary may require, which is why the engine models this as dated attestation evidence rather than inferring disability from plan data.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(f)(4)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/223',
      quotedText:
        'The tax imposed by this chapter on the account beneficiary for any taxable year in which there is a payment or distribution from a health savings account of such beneficiary which is includible in gross income under paragraph (2) shall be increased by 20 percent of the amount which is so includible.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(4)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/223',
      quotedText:
        'Subparagraph (A) shall not apply if the payment or distribution is made after the account beneficiary becomes disabled within the meaning of section 72(m)(7) or dies.',
    }, {
      kind: 'statute',
      citation: 'IRC 72(m)(7)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'an individual shall be considered to be disabled if he is unable to engage in any substantial gainful activity by reason of any medically determinable physical or mental impairment which can be expected to result in death or to be of long-continued and indefinite duration.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualHsaPenaltyEvaluation.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaPenaltyEvaluation.ts#evaluateSegment',
    ],
  },

  'irc-223-b-3-hsa-catch-up-not-indexed': {
    title: 'The age-55 HSA catch-up is a flat 1,000 dollars and is not indexed',
    statement:
      'An eligible individual who has attained age 55 before the close of the taxable year may contribute an additional amount, which has been 1,000 dollars for 2009 and every year since. Section 223(g) indexes the subsection (b)(2) contribution limits and does not reach this amount, so it stays flat while the base limits grow.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The qualifying age is 55, which differs from the 50 used for elective deferrals and individual retirement accounts and from the 65 that ends the HSA additional tax. Nothing in the engine derives one from another, and the record exists partly so nobody later aligns them.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(3)(A), (b)(3)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/223',
      quotedText:
        'In the case of an individual who has attained age 55 before the close of the taxable year, the applicable limitation under subparagraphs (A) and (B) of paragraph (2) shall be increased by the additional contribution amount. ... the additional contribution amount is the amount determined in accordance with the following table: ... 2009 and thereafter $1,000.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(g)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/223',
      quotedText:
        'Each dollar amount in subsections (b)(2), (c)(2)(A), and in the case of taxable years beginning after 2026, (c)(1)(E)(ii)(II) shall be increased by an amount equal to\u2014 (A) such dollar amount, multiplied by (B) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which such taxable year begins ...',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/params/data/year2026.ts#year2026',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },

  'irc-223-a-hsa-contribution-deduction-reduces-agi': {
    title: 'Allowed HSA contributions reduce adjusted gross income',
    statement:
      'For an eligible individual, cash paid by or on behalf of that individual to the individual’s HSA is allowed as a deduction for the taxable year, subject to the section 223(b) limits. The engine subtracts allowed HSA deposits from ordinary income before computing federal AGI, so the deduction also lowers the MAGI figures subsequently used for ACA and IRMAA.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The plan model has one HSA contribution stream and does not carry a separate employer-salary-reduction fact under section 106(d); the contribution allocator therefore applies the section 223(a) above-the-line treatment to the modeled HSA deposit. The contribution cap and the catch-up are registered separately. After this subtraction, annualFundingApplicationAndClosePhase commits the accepted realized MAGI entry that supplies the IRMAA lookback and passes the same reduced federal AGI into ACA MAGI assembly; simulatePlan owns and threads the longitudinal history. The independent MAGI add-back composition is registered at irc-36B-d-2-B-aca-household-magi-composition and usc-42-1395r-i-4-a-magi-agi-plus-tax-exempt-interest.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who is an eligible individual for any month during the taxable year, there shall be allowed as a deduction for the taxable year an amount equal to the aggregate amount paid in cash during such taxable year by or on behalf of such individual to a health savings account of such individual.',
    }, {
      kind: 'statute',
      citation: 'IRC 62(a), (a)(19)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section62&num=0&edition=prelim',
      quotedText:
        'For purposes of this subtitle, the term "adjusted gross income" means, in the case of an individual, gross income minus the following deductions: … (19) Health savings accounts The deduction allowed by section 223.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-27',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
    ],
  },

  'irc-223-f-4-C-hsa-age-65-annual-proxy': {
    title: 'HSA age-65 waiver modelled as a whole attained-age year',
    statement:
      'Section 223(f)(4)(C) removes the 20 percent additional tax only for a payment or distribution after the date the account beneficiary attains age 65. The annual HSA path in strategies/accountEligibility.ts removes it for every distribution in the calendar year of attainment, including distributions taken months before the 65th birthday.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'This proxy errs in one direction only, which is the reason it is worth setting beside the age-59.5 proxy rather than dismissing the two together as a single rounding habit. Attained age here is the calendar-year age, the projection year minus the birth year, so the waiver switches on at January 1 of the year the account beneficiary turns 65 while the statute switches it on the day after the 65th birthday. The proxy is therefore never late and always early, so it under-penalizes: by one day at a January 1 birth, and by nearly a full year at a December 31 birth, where a non-qualified distribution taken in January bears nothing under the proxy and 20 percent of the includible amount under the statute. The age-59.5 proxy registered as irc-72-t-2-A-i-age-59-half-annual-proxy does not behave this way. The half-year offset there puts the statutory boundary on either side of the calendar boundary depending on the birth month, so that one errs both ways and is bounded by about six months each way, and assuming the two proxies share a sign gets the HSA exposure wrong. The exact-date reading is registered as irc-223-f-4-hsa-age-65-boundary and implemented in actions/annualHsaPenaltyEvaluation.ts, so here too two reachable paths disagree about the same account beneficiary and only the exact-date path is filing-relevant.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(f)(4)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'Subparagraph (A) shall not apply to any payment or distribution after the date on which the account beneficiary attains the age specified in section 1811 of the Social Security Act.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'The tax imposed by this chapter on the account beneficiary for any taxable year in which there is a payment or distribution from a health savings account of such beneficiary which is includible in gross income under paragraph (2) shall be increased by 20 percent of the amount which is so includible.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/accountEligibility.ts#hsaNonQualifiedPenaltyRate',
    ],
  },
  'irc-223-b-2-7-projection-coverage-proration-and-medicare': {
    title: 'HSA coverage tier, monthly proration, and Medicare entitlement',
    statement:
      'The HSA limitation is monthly: 1/12 of the annual amount for each month the taxpayer is an eligible individual, at the self-only or family tier according to the coverage actually held on the first day of that month, and zero for the first month of entitlement to Medicare and every month after. Not modelled: the annual ledger reads the coverage tier from household size, giving any two-person household the family base whether or not family coverage exists, and applies a whole annual limit regardless of how many months the taxpayer was eligible or whether they are on Medicare.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Direction of error: permissive on all three counts, and they compound. A two-person household holding self-only coverage is given the family base, a taxpayer eligible for part of the year is given the whole of it, and a taxpayer already on Medicare is given a limit the statute sets at zero. Each excess is deducted rather than taxed and charged the section 4973 excise, so the error reaches both the income and the penalty. The coverage substitution is the one the plan model forces: a plan carries no coverage election, so household size is the only signal available, and the same substitution is what selects the family base for the 223(b)(5) division that is correctly applied. The other two are not forced. Eligibility months and Medicare entitlement are both derivable from the dates the engine already holds, and the annual granularity of the projection is the reason they are not applied rather than a missing fact. Superseded claim: this record previously said the ledger gives every owner in a two-person household a full family limit. It no longer does; 223(b)(5) division is implemented and covered by irc-223-b-5-hsa-family-limit-divided-between-spouses.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(2)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'The monthly limitation for any month is 1/12 of- ... (B) in the case of an eligible individual who has family coverage under a high deductible health plan as of the first day of such month, $4,500.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(b)(7)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm',
      quotedText:
        'The limitation under this subsection for any month with respect to an individual shall be zero for the first month such individual is entitled to benefits under title XVIII of the Social Security Act and for each month thereafter.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#hsaAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
      ],
  },

  'irc-223-d-2-A-qualified-expense-related-persons': {
    title: 'An HSA may reimburse the expenses of the beneficiary, spouse, and dependents',
    statement:
      'Qualified medical expenses are amounts paid by the account beneficiary for section 213(d) medical care of that individual, that individual spouse, and any dependent. The reimbursable set therefore turns on the relationship of the patient to the owner of the account the distribution came out of, not on whose name is on the expense: one spouse HSA may reimburse the other spouse expense in full and tax free, and an expense of a person outside those three relationships is not qualified however genuine the medical care was.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(d)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'The term "qualified medical expenses" means, with respect to an account beneficiary, amounts paid by such beneficiary for medical care (as defined in section 213(d)) for such individual, the spouse of such individual, and any dependent (as defined in section 152, determined without regard to subsections (b)(1), (b)(2), and (d)(1)(B) thereof) of such individual, but only to the extent such amounts are not compensated for by insurance or otherwise.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2004-2, A-26',
      url: 'https://www.irs.gov/irb/2004-02_IRB',
      quotedText:
        'The term "qualified medical expenses" are expenses paid by the account beneficiary, his or her spouse or dependents for medical care as defined in section 213(d) (including nonprescription drugs as described in Rev. Rul. 2003-102, 2003-38 I.R.B. 559), but only to the extent the expenses are not covered by insurance or otherwise.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts#evaluateAnnualHsaReimbursementLedger',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts#classifyAnnualHsaWithdrawalCharacter',
    ],
  },

  'notice-2004-2-a-26-expense-incurred-after-hsa-established': {
    title: 'An expense incurred before the HSA existed is never reimbursable',
    statement:
      'A qualified medical expense must be incurred after the HSA has been established. The establishment date is a hard floor on the reimbursable set rather than a preference: an expense incurred one day before the account was established can never be reimbursed tax free, no matter how long the account is later held or how much it later holds.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2004-2, A-26',
      url: 'https://www.irs.gov/irb/2004-02_IRB',
      quotedText:
        'The qualified medical expenses must be incurred only after the HSA has been established.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2008-59, A-38',
      url: 'https://www.irs.gov/irb/2008-29_IRB',
      quotedText:
        'An HSA is an exempt trust established through a written governing instrument under state law. Section 223(d)(1). State trust law determines when an HSA is established. Most state trust laws require that for a trust to exist, an asset must be held in trust; thus, most state trust laws require that a trust must be funded to be established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts#evaluateAnnualHsaReimbursementLedger',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts#classifyAnnualHsaWithdrawalCharacter',
    ],
  },

  'notice-2004-50-a-39-deferred-reimbursement-no-deadline': {
    title: 'There is no deadline for reimbursing a qualified medical expense',
    statement:
      'A distribution taken in the current year may reimburse a qualified medical expense incurred in any prior year, so long as the expense was incurred after the HSA was established. The reimbursable set is therefore cumulative and carries across tax years: it is not closed by the year the expense was incurred, and a distribution is not disqualified merely because the care it pays for was received years earlier.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2004-50, A-39',
      url: 'https://www.irs.gov/irb/2004-33_IRB',
      quotedText:
        'Similarly, a distribution from an HSA in the current year can be used to pay or reimburse expenses incurred in any prior year as long as the expenses were incurred after the HSA was established. Thus, there is no time limit on when the distribution must occur.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'Any amount paid or distributed out of a health savings account which is used exclusively to pay qualified medical expenses of any account beneficiary shall not be includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts#evaluateAnnualHsaReimbursementLedger',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts#classifyAnnualHsaWithdrawalCharacter',
    ],
  },

  'irc-223-d-2-A-expense-reimbursable-once': {
    title: 'An expense is qualified only to the extent it is not already compensated',
    statement:
      'An amount is a qualified medical expense only to the extent it is not compensated for by insurance or otherwise, so each dollar of an expense supports a tax-free reimbursement exactly once. The remaining reimbursable amount of an expense is its eligible amount less everything already reimbursed against it, counting reimbursements taken in earlier years and from every account in the household, and a claim exceeding that remainder is refused rather than trimmed to it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(d)(2)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'amounts paid by such beneficiary for medical care (as defined in section 213(d)) for such individual, the spouse of such individual, and any dependent (as defined in section 152, determined without regard to subsections (b)(1), (b)(2), and (d)(1)(B) thereof) of such individual, but only to the extent such amounts are not compensated for by insurance or otherwise.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2004-50, A-39',
      url: 'https://www.irs.gov/irb/2004-33_IRB',
      quotedText:
        'he or she must keep records sufficient to later show that the distributions were exclusively to pay or reimburse qualified medical expenses, that the qualified medical expenses have not been previously paid or reimbursed from another source and that the medical expenses have not been taken as an itemized deduction in any prior taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts#evaluateAnnualHsaReimbursementLedger',
      'packages/engine/src/actions/annualHsaWithdrawalCharacter.ts#classifyAnnualHsaWithdrawalCharacter',
    ],
  },

  'notice-2004-50-a-39-prior-section-213-deduction': {
    title: 'An expense already deducted under section 213 cannot also be reimbursed',
    statement:
      'A distribution is excludable only if the expense it reimburses was not taken as an itemized deduction under section 213 in any prior taxable year; section 223(f)(6) closes the same door from the other side by keeping an HSA-reimbursed expense out of the section 213 computation. Not modelled: the household expense inventory carries an asserted qualified flag and an eligibility evidence identifier but no field recording whether the expense was ever deducted, so the engine cannot detect the double benefit. The error runs one way only, toward understating tax: an expense deducted in an earlier year and reimbursed now is reported as a fully qualified, fully excluded distribution, when the correct treatment includes it in gross income and, outside the age-65 and disability exceptions, adds the 20 percent additional tax on top.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Approximated rather than out of scope because the engine does not refuse here; it returns a figure computed on the assumption that the expense was never deducted, which is precisely the assumption that flatters the taxpayer. There is no better convention available: assuming the expense was deducted would disqualify every reimbursement in a household that itemizes and would be wrong far more often. The missing input is a per-expense prior-deduction flag, which is a data question rather than a modelling one, and the engine should carry the flag before it carries an answer.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2004-50, A-39',
      url: 'https://www.irs.gov/irb/2004-33_IRB',
      quotedText:
        'he or she must keep records sufficient to later show that the distributions were exclusively to pay or reimburse qualified medical expenses, that the qualified medical expenses have not been previously paid or reimbursed from another source and that the medical expenses have not been taken as an itemized deduction in any prior taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(6)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'For purposes of determining the amount of the deduction under section 213, any payment or distribution out of a health savings account for qualified medical expenses shall not be treated as an expense paid for medical care.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts#evaluateAnnualHsaReimbursementLedger',
    ],
  },

  'notice-2008-59-a-41-hsa-establishment-date-per-account': {
    title: 'The HSA establishment date is per account, and relates back only on a test',
    statement:
      'Each HSA has its own establishment date, and a later HSA is deemed established when the first one was only if the beneficiary held an HSA with a balance greater than zero at some point in the 18-month period ending on the day the later account was established. An account funded by rollover or transfer instead takes the establishment date of the account it came from. Not modelled: the household evidence carries one authoritative establishment date per person and applies it to every covered HSA of that person, so the relate-back test is never evaluated. Where that test would fail, the error runs toward understating tax, because an expense incurred between the two establishment dates is reimbursable only from the older account, and the engine will treat a distribution from the newer one as qualified and fully excluded.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'Approximated rather than out of scope because the relate-back test is not refused, it is skipped: the engine computes a qualified amount from the owner-level date and returns it. The per-person shape is right for the common case and wrong for a narrow one, which is what makes it worth recording rather than fixing in passing. Most households with two HSAs opened the second while still holding the first, or funded it by transfer, and in both of those cases the single owner-level date is exactly correct. The shape cannot express the failing case at all: the establishment record is keyed by person, the allocation names a source account, and nothing joins the two, so no caller can supply account-level dates even where they have them. Repairing it is a change to the evidence contract rather than to a calculation, which is why it is recorded here instead of patched.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2008-59, A-41',
      url: 'https://www.irs.gov/irb/2008-29_IRB',
      quotedText:
        'If an account beneficiary establishes an HSA, and later establishes another HSA, any later HSA is deemed to be established when the first HSA was established if the account beneficiary has an HSA with a balance greater than zero at any time during the 18-month period ending on the date the later HSA is established.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2008-59, A-40',
      url: 'https://www.irs.gov/irb/2008-29_IRB',
      quotedText:
        'An HSA that is funded by amounts rolled over or transferred from an Archer MSA or another HSA is established as of the date the prior account was established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualHsaReimbursementLedger.ts#evaluateAnnualHsaReimbursementLedger',
    ],
  },

  'irc-223-b-7-medicare-part-a-retroactive-entitlement': {
    title: 'Retroactive Medicare enrollment can make HSA contributions excess',
    statement:
      'Section 223(b)(7) reduces the HSA limitation to zero from the first month an individual is entitled to title XVIII benefits. Publication 969 says that rule applies to retroactive Medicare coverage, so a delayed enrollment that is backdated makes contributions during the retroactive period excess. Not modelled: the Plan has no Medicare Part A enrollment, entitlement start date, retroactive period, or HSA-coverage-by-month fact; the projection uses age 65 only to price healthcare premiums and does not feed Medicare entitlement into HSA eligibility.',
    classification: 'outOfScope',
    outOfScope: {
      shape: 'inexpressibleInput',
      missingInputFacts: [
      'Medicare Part A enrollment on hsaAccountSchema or healthcareConfigSchema',
      'the entitlement start date and any retroactive period',
      'HSA coverage stated by month rather than by year',
      ],
    },
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is narrower than, and not a duplicate of, irc-223-b-2-7-projection-coverage-proration-and-medicare: that approximated record documents the annual HSA coverage shortcut. The Part A entitlement/backdating fact itself is absent and cannot be inferred from age. model/plan.test.ts gates those missing HSA fields.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(7)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section223&num=0&edition=prelim',
      quotedText:
        'The limitation under this subsection for any month with respect to an individual shall be zero for the first month such individual is entitled to benefits under title XVIII of the Social Security Act and for each month thereafter.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 969, Enrolled in Medicare',
      url: 'https://www.irs.gov/publications/p969',
      quotedText:
        'Beginning with the first month you are enrolled in Medicare, your contribution limit is zero. This rule applies to periods of retroactive Medicare coverage. So if you delayed applying for Medicare and later your enrollment is backdated, any contributions to your HSA made during the period of retroactive coverage are considered excess.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#hsaAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },

  'irc-4973-a-g-hsa-excess-contribution-excise': {
    title: 'Uncorrected HSA excess contributions incur the section 4973 excise',
    statement:
      'Section 4973(a) imposes a 6-percent year-end excise on excess contributions, and section 4973(g) defines an HSA excess as a contributed amount neither excludable from gross income nor deductible under section 223. Form 5329 Part VII prices 6 percent of the lesser of the HSA excess and the December 31 HSA value; Publication 969 says the excise applies for each tax year the excess remains. The engine calculates HSA contribution caps but does not include a section 4973 HSA excess excise in YearResult.penalties, understating tax when an excess occurs.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'understatesTax',
    conventionRationale:
      'DEFECT — no behavior change in this registration slice. The penalties sum in projection/simulate.ts includes early-withdrawal, Roth, HSA withdrawal, and RMD-shortfall terms but no 4973 HSA contribution term. The fixture posits a 1,000-dollar HSA contribution made while entitled to Medicare, derives 60 dollars as 1,000 × 0.06 with a year-end value of at least 1,000, and the observed engine penalty is 0 — no 4973 HSA term exists — pinned until a separately authorized implementation fix changes it.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 4973(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        'there is imposed for each taxable year a tax in an amount equal to 6 percent of the amount of the excess contributions to such individual\'s accounts or annuities (determined as of the close of the taxable year). The amount of such tax for any taxable year shall not exceed 6 percent of the value of the account or annuity (determined as of the close of the taxable year).',
    }, {
      kind: 'statute',
      citation: 'IRC 4973(g)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section4973&num=0&edition=prelim',
      quotedText:
        'the aggregate amount contributed for the taxable year to the accounts (other than a rollover contribution described in section 220(f)(5) or 223(f)(5)) which is neither excludable from gross income under section 106(d) nor allowable as a deduction under section 223 for such year, and',
    }, {
      kind: 'formInstruction',
      citation: '2025 Form 5329, Part VII, line 49',
      url: 'https://www.irs.gov/pub/irs-pdf/f5329.pdf',
      quotedText:
        'Additional tax. Enter 6% (0.06) of the smaller of line 48 or the value of your HSAs on December 31, 2025 (including 2025 contributions made in 2026). Include this amount on Schedule 2 (Form 1040), line 8',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 969, Excess contributions',
      url: 'https://www.irs.gov/publications/p969',
      quotedText:
        'Generally, you must pay a 6% excise tax on excess contributions. See Form 5329, Additional Taxes on Qualified Plans (Including IRAs) and Other Tax-Favored Accounts, to figure the excise tax. The excise tax applies to each tax year the excess contribution remains in the account.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-26',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts',
      'packages/engine/src/model/plan.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/model/plan.ts#hsaAccountSchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/projection/internal/annualContributionsAndEmployerMatch.ts#annualContributionsAndEmployerMatch',
    ],
  },

  'irc-223-f-8-B-estate-predeath-expense-reduction': {
    title: 'Terminal HSA inclusion omits the 223(f)(8)(B)(ii)(I) predeath-expense reduction',
    statement:
      'When the designated beneficiary of an HSA is the account beneficiary\'s surviving spouse, section 223(f)(8)(A) treats that health savings account as if the spouse were the account beneficiary, so the helper\'s spouse destination is a zero inclusion rather than a death-year distribution. In a case to which subparagraph (A) does not apply, section 223(f)(8)(B)(i) provides that the account ceases to be a health savings account as of the date of death and that an amount equal to the fair market value of the assets on that date is includible: in the acquiring person\'s gross income for the taxable year that includes that date if that person is not the decedent\'s estate, or in the decedent\'s gross income for the decedent\'s last taxable year if that person is the estate. For an acquiring person other than the estate, section 223(f)(8)(B)(ii)(I) then reduces that inclusion by the amount of qualified medical expenses incurred by the decedent before the date of death and paid by that person within 1 year after that date. Section 223(f)(8)(B)(ii)(II) allows an appropriate section 691(c) deduction to a person other than the decedent or the decedent\'s spouse with respect to amounts included in gross income under clause (i) by such person. estateHsaIncomeBase is assumed terminal income-tax exposure at a stipulated death-horizon value and a fixed comparison heir rate; it is not an annual tax computation and not a return adjudication. For a designated non-spouse natural-person destination it returns the ending gross balance without the (B)(ii)(I) reduction, which overstates that assumed exposure when qualifying predeath expenses were incurred and paid in time. The Plan cannot express legal beneficiary class, death date or date-of-death value, or qualifying predeath expense and payment facts, so those remain disclosed; the nonSpouse destination also covers unmodeled legal classes, and a charitable bequest haircut is applied outside this helper. This record does not claim that every HSA death is a fully taxable distribution, and it does not claim overstatement for every account, recipient, or default.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'overstatesTax',
    conventionRationale:
      'The helper preserves the existing spouse-zero versus gross-for-other decision. Overstatement is claimed only for the omitted (B)(ii)(I) expense reduction at a stipulated death value, a fixed comparison heir rate, and a designated non-spouse natural-person case. A spouse destination follows (A) and is a zero inclusion. Charity exemption, generic default destination, and Form 8606 basis remain outside this helper. The nonSpouse enum also stands in for unmodeled legal classes, including an estate, for which (B)(ii)(I) does not reduce the inclusion. Missing legal beneficiary class, death date or value, and qualifying predeath expense and payment facts stay disclosed rather than inferred from healthcare spending or reimburseLater, which debit a different household cost. The companion fixture stipulates no relevant estate tax, so the (B)(ii)(II) section 691(c) deduction is zero and does not move the delta. The 223(f)(4)(B) additional-tax death exception remains a separate out-of-scope record; this metric is not that waiver.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(f)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm',
      quotedText:
        'If the account beneficiary\'s surviving spouse acquires such beneficiary\'s interest in a health savings account by reason of being the designated beneficiary of such account at the death of the account beneficiary, such health savings account shall be treated as if the spouse were the account beneficiary.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(8)(B)(i)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm',
      quotedText:
        'If, by reason of the death of the account beneficiary, any person acquires the account beneficiary\'s interest in a health savings account in a case to which subparagraph (A) does not apply— (I) such account shall cease to be a health savings account as of the date of death, and (II) an amount equal to the fair market value of the assets in such account on such date shall be includible if such person is not the estate of such beneficiary, in such person\'s gross income for the taxable year which includes such date, or if such person is the estate of such beneficiary, in such beneficiary\'s gross income for the last taxable year of such beneficiary.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(8)(B)(ii)(I)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm',
      quotedText:
        'The amount includible in gross income under clause (i) by any person (other than the estate) shall be reduced by the amount of qualified medical expenses which were incurred by the decedent before the date of the decedent\'s death and paid by such person within 1 year after such date.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(f)(8)(B)(ii)(II)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm',
      quotedText:
        'An appropriate deduction shall be allowed under section 691(c) to any person (other than the decedent or the decedent\'s spouse) with respect to amounts included in gross income under clause (i) by such person.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: ['packages/engine/src/projection/estateHsaIncome.ts'],
    implementedByFunctions: [
      'packages/engine/src/projection/estateHsaIncome.ts#estateHsaIncomeBase',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
