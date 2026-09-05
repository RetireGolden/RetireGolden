/**
 * IRA basis and rollover records: the section 408(d) pro-rata basis fraction, the
 * Form 8606 staging that implements it, the inherited-IRA rollover bar, and the
 * IRA annuity contract carve-outs.
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
export const iraBasisAndRolloverRecords = {
  'irc-408-d-2-annual-pro-rata-basis': {
    title: 'Annual pro-rata basis recovery across all owned non-Roth IRAs',
    statement:
      'All of an individual owned traditional, SEP, and SIMPLE IRAs are treated as one contract and all distributions in a year as one distribution, so the nontaxable fraction is that year remaining basis over the December 31 value plus outstanding rollovers plus the year distributions plus conversions. It is computed once per year, not per distribution.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The exclusion of inherited IRAs from the owner pool has no authority above publication level. IRC 408(d)(2)(A) says "all individual retirement plans" without qualification, and an inherited IRA is one from which the beneficiary takes distributions; the separation rests on Publication 590-B and the Form 8606 instructions, neither of which binds. Roth separation, by contrast, is statutory under 408A(d)(4)(A). The engine follows the IRS position because it is uniform administrative practice and the literal reading has no practitioner following, but the asymmetry in authority is worth knowing. Note the pooling is per decedent, not merely owned versus inherited.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of applying section 72 to any amount described in paragraph (1)- (A) all individual retirement plans shall be treated as 1 contract, (B) all distributions during any taxable year shall be treated as 1 distribution, and (C) the value of the contract, income on the contract, and investment in the contract shall be computed as of the close of the calendar year in which the taxable year begins.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(4)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'Section 408(d)(2) shall be applied separately with respect to Roth IRAs and other individual retirement plans.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B, inherited IRA basis',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'Unless you are the decedent\'s spouse and choose to treat the IRA as your own, you can\'t combine this basis with any basis you have in your own traditional IRA(s) or any basis in traditional IRA(s) you inherited from other decedents.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraWithdrawalCharacter.ts',
      'packages/engine/src/actions/annualIraBasisAllocation.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualIraBasisAllocation.ts#allocateAnnualIraBasis',
      'packages/engine/src/actions/beneficiaryTraditionalIraWithdrawalCharacter.ts#classifyBeneficiaryTraditionalIraWithdrawal',
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts#classifyOwnedNonRothIraAnnualWithdrawals',
    ],
  },

  'form-8606-line-4-post-year-contribution-exclusion': {
    title: 'A following-calendar-year contribution is excluded from the current distribution fraction',
    statement:
      'A nondeductible traditional-IRA contribution designated for a tax year but made in the following calendar year remains reportable as nondeductible, yet Form 8606 excludes it from the nontaxable part of distributions received in that tax year. The engine therefore carries the line-4 contribution-window amount separately and subtracts it from the current year’s basis numerator before it allocates basis to that year’s positive distributions and conversions.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 4',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'Although the contributions to traditional IRAs for 2025 … can be treated as nondeductible, they aren’t included in figuring the nontaxable part of any distributions you received in 2025.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingEvidence.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualPostCandidateEvidence.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingEvidence.ts#buildPlanOwnedNonRothIraAnnualFilingEvidence',
      'packages/engine/src/actions/ownedNonRothIraAnnualPostCandidateEvidence.ts#buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput',
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts#classifyOwnedNonRothIraAnnualWithdrawals',
    ],
  },

  'form-8606-lines-7-and-8-distinct-distribution-staging': {
    title: 'Form 8606 keeps ordinary distributions and Roth conversions in separate totals',
    statement:
      'Form 8606 excludes distributions converted to a Roth IRA from line 7 and directs the filer to enter the net converted amount on line 8. The engine therefore supplies line-7 distributions and line-8 conversions as separate annual totals before the common pro-rata allocation, rather than combining a conversion into ordinary distributions.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 7',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'Don’t include any of the following on line 7 … Distributions that you converted to a Roth IRA.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 8',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'If, in 2025, you converted any amounts from traditional IRAs to a Roth IRA, enter on line 8 the net amount you converted.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraAnnualPhysicalTransaction.ts',
      'packages/engine/src/actions/annualRetirementPhysicalEventInventory.ts',
      'packages/engine/src/actions/annualQcdResidualForm8606.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAnnualRefinalization.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/annualRetirementPhysicalEventInventory.ts#buildAnnualRetirementPhysicalEventInventory',
      'packages/engine/src/actions/ownedNonRothIraAnnualPhysicalTransaction.ts#preparePlanOwnedNonRothIraAnnualPhysicalTransaction',
      'packages/engine/src/actions/annualQcdResidualForm8606.ts#stageAnnualQcdResidualForm8606',
      'packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAnnualRefinalization.ts#prepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalization',
    ],
  },
  'form-8606-line-7-owned-ira-movement-staging': {
    title: 'Owned IRA ordinary distributions stage on Form 8606 line 7',
    statement:
      'A positive ordinary withdrawal executed from the owner\'s non-Roth IRA pool is staged as a Form 8606 line 7 distribution candidate for annual basis characterization. Which staged movements are excluded from line 7 (conversions among them) is the separately registered line-7-versus-line-8 staging split.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'formInstruction',
      citation: 'Form 8606 (2025), line 7',
      url: 'https://www.irs.gov/pub/irs-pdf/f8606.pdf',
      quotedText:
        'Enter your distributions from traditional IRAs in 2025. Do not include rollovers (but do include certain 2025 retirement plan distribution repayments treated as rollovers (see instructions)). Also, do not include qualified charitable distributions; a one-time distribution to fund an HSA; conversions to a Roth IRA; certain returned contributions; or recharacterizations of traditional IRA contributions.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraMovementCandidate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraMovementCandidate.ts#stageOwnedNonRothIraOrdinaryWithdrawalMovements',
    ],
  },
  'irc-408-d-2-A-owner-wide-non-inherited-ira-pool': {
    title: 'The annual basis pool is all of the owner\'s own IRAs, and only those',
    statement:
      'For the annual pro-rata basis computation, all of an individual\'s individual retirement plans are treated as one contract and all of a year\'s distributions as one distribution, so the engine builds one basis pool per person. The pool\'s boundaries follow the Form 8606 filing unit as the IRS administers it: a spouse\'s IRAs are a separate pool with a separate form, and inherited IRAs are excluded from the owned pool, their basis handled under the separately registered inherited regime.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The one-contract aggregation is statutory. The exclusions are not: as the sibling 408(d)(2) fraction record already records, 408(d)(2)(A) says "all individual retirement plans" without qualification, and the spousal and inherited separations rest on the Form 8606 instructions and Publication 590-B - uniform administrative practice, publication-level authority. The engine follows the IRS position; the pinned gates are where that composition is enforced.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(2)(A)-(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of applying section 72 to any amount described in paragraph (1)- (A) all individual retirement plans shall be treated as 1 contract, (B) all distributions during any taxable year shall be treated as 1 distribution \u2026',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025)',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'If both you and your spouse are required to file 2025 Form 8606, file a separate 2025 Form 8606 for each of you. If you are required to file 2025 Form 8606 for IRAs inherited from more than one decedent, file a separate 2025 Form 8606 for the IRA from each decedent.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-29',
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraMovementCandidate.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualPlanCoordinator.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualPostCandidateEvidence.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualCandidateTransaction.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingSourceResolver.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingEvidence.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraMovementCandidate.ts#stageOwnedNonRothIraOrdinaryWithdrawalMovements',
      'packages/engine/src/actions/ownedNonRothIraAnnualPlanCoordinator.ts#coordinatePlanOwnedNonRothIraAnnualWithdrawalCandidate',
      'packages/engine/src/actions/ownedNonRothIraAnnualPostCandidateEvidence.ts#buildPlanOwnedNonRothIraAnnualPostCandidateClassificationInput',
      'packages/engine/src/actions/ownedNonRothIraAnnualCandidateTransaction.ts#preparePlanOwnedNonRothIraAnnualCandidateTransaction',
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingSourceResolver.ts#resolvePlanOwnedNonRothIraAnnualFilingSources',
      'packages/engine/src/actions/ownedNonRothIraAnnualFilingEvidence.ts#buildPlanOwnedNonRothIraAnnualFilingEvidence',
    ],
  },

  'irc-408-d-2-estate-household-basis-allocation': {
    title: 'Terminal estate basis is spread across the household traditional pool',
    statement:
      'Section 408(d)(1) includes in gross income any amount paid or distributed out of an individual retirement plan, in the manner provided under section 72. Section 408(d)(2) applies only for purposes of applying section 72 to any amount described in paragraph (1): all individual retirement plans are treated as one contract and all distributions during a taxable year as one distribution. An individual retirement plan is an individual retirement account or an individual retirement annuity under section 7701(a)(37), so an employer plan is outside that contract. 408(d)(2) itself does not state the spousal separation; that rests on the Form 8606 instructions, which require a separate form for each spouse. Inheritance of an IRA is not itself an amount paid or distributed: Publication 590-B states that a beneficiary generally will not owe tax on the assets until receiving distributions. The engine\'s terminal after-tax estate metric is not a death-year section 72 computation. It is a planning figure of assumed future income-tax exposure. At runtime, compare calls estateTraditionalTaxableBase for every traditional gross, including inherited balances, with the household traditional total as denominator. The helper itself is a pure formula: each account\'s taxable pretax base is its gross minus the household remaining-basis scalar times that gross over the supplied traditional total. This record registers only the cross-owner owned-IRA and IRA/employer misallocation that formula produces when owner and vehicle boundaries are ignored. Inherited-pool separation and unavailable inherited nondeductible basis remain residual on compare, not here.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'The referent is assumed future income-tax exposure allocated per account, not a death-year filing tax. Inheritance is not a section 408(d)(1) distribution, so this terminal metric is a planning stand-in for later section 72 recovery, not Form 8606 in the year of death. Compare applies the helper\'s household-basis fraction to every traditional gross, inherited included; this rationale fixture isolates the owned-account slice by carrying no inherited traditional balances, so the all-traditional formula reduces to owned gross only. On that public-path three-account couple fixture (one year 2026, both age 60, zero growth and spending, 25 percent heir rate, three 120,000 non-spouse traditional accounts, 90,000 of basis on p1\'s IRA only) the authority worksheet is taxable bases 30,000 / 120,000 / 120,000 and haircuts 7,500 / 30,000 / 30,000. The helper returns 90,000 / 90,000 / 90,000 and haircuts 22,500 / 22,500 / 22,500. p1\'s IRA overstates assumed future exposure; the spouse IRA and the 401(k) understate it. The three haircuts sum to 67,500 under both readings because the rate and destination are common; that cancellation is a fact of this fixture only. On the mixed-destination two-IRA cells in the same fixture (p1 non-spouse, p2 spouse, 25 percent heir rate, 90,000 basis on p1 only or p2 only) the authority aggregate haircuts are 7,500 and 30,000 while the helper returns 18,750 in both cells, so the household aggregate can overstate or understate assumed future exposure depending on which owner holds the basis; a spouse destination\'s zero haircut is the terminal metric\'s existing valuation convention, not an automatic statutory rollover or tax exemption. An IRA-only cross-owner reading (75,000 / 75,000 / 120,000) and an ignore-basis reading (120,000 / 120,000 / 120,000) are the other candidate allocations the three-account cell rejects. The exclusions 408(d)(2) does not state in its own words — spouses file separate Forms 8606; an employer plan is not an individual retirement plan under 7701(a)(37) — are the publication-level and definitional boundaries the helper ignores, not a second reading of 408(d)(2) alone.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in this subsection, any amount paid or distributed out of an individual retirement plan shall be included in gross income by the payee or distributee, as the case may be, in the manner provided under section 72.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of applying section 72 to any amount described in paragraph (1)- (A) all individual retirement plans shall be treated as 1 contract, (B) all distributions during any taxable year shall be treated as 1 distribution, and (C) the value of the contract, income on the contract, and investment in the contract shall be computed as of the close of the calendar year in which the taxable year begins.',
    }, {
      kind: 'statute',
      citation: 'IRC 7701(a)(37)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleF-chap79-sec7701.htm',
      quotedText:
        'The term "individual retirement plan" means\u2014 (A) an individual retirement account described in section 408(a), and (B) an individual retirement annuity described in section 408(b).',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), More than one Form 8606 required',
      url: 'https://www.irs.gov/instructions/i8606',
      quotedText:
        'If both you and your spouse are required to file 2025 Form 8606, file a separate 2025 Form 8606 for each of you. If you are required to file 2025 Form 8606 for IRAs inherited from more than one decedent, file a separate 2025 Form 8606 for the IRA from each decedent.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B (2025), Inherited from someone other than spouse',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'Like the original owner, you generally won\'t owe tax on the assets in the IRA until you receive distributions from it.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-09-04',
    implementedBy: [
      'packages/engine/src/projection/estateTraditionalBasis.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/projection/estateTraditionalBasis.ts#estateTraditionalTaxableBase',
    ],
  },

  'irc-408-d-3-C-i-inherited-ira-rollover-bar': {
    title: 'A nonspouse inherited IRA cannot be rolled over or converted',
    statement:
      'A nonspouse account acquired by reason of death is an inherited IRA. Section 408(d)(3) does not apply to an amount received from it, and a transfer from it is not excluded from gross income as a rollover. Because a Roth conversion from an IRA must be a qualified rollover contribution that meets section 408(d)(3), the engine has no conversion calculation for this source: it refuses the action with conversion-inherited-source, moves no dollars, and leaves both source and destination balances unchanged.',
    classification: 'outOfScope',
    outOfScope: { shape: 'typedRefusal' },
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(3)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'In the case of an inherited individual retirement account or individual retirement annuity- (I) this paragraph shall not apply to any amount received by an individual from such an account or annuity (and no amount transferred from such account or annuity to another individual retirement account or annuity shall be excluded from gross income by reason of such transfer), and (II) such inherited account or annuity shall not be treated as an individual retirement account or annuity for purposes of determining whether any other amount is a rollover contribution.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(3)(C)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'An individual retirement account or individual retirement annuity shall be treated as inherited if- (I) the individual for whose benefit the account or annuity is maintained acquired such account by reason of the death of another individual, and (II) such individual was not the surviving spouse of such other individual.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(e)(1), clause (B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408A&num=0&edition=prelim',
      quotedText:
        'The term "qualified rollover contribution" means a rollover contribution- (A) to a Roth IRA from another such account, (B) from an eligible retirement plan, but only if- (i) in the case of an individual retirement plan, such rollover contribution meets the requirements of section 408(d)(3),',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-25',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/actions/rothConversionExecution.ts',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAnnualRefinalization.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/rothConversionExecution.ts#executeRothConversions',
      'packages/engine/src/strategies/accountEligibility.ts#evaluateConversion',
      'packages/engine/src/strategies/accountEligibility.ts#isConvertibleToRoth',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts#conversionSourceIssue',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAnnualRefinalization.ts#prepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalization',
    ],
  },

  'irc-408-d-3-C-ii-surviving-spouse-not-inherited': {
    title: 'A surviving spouse does not hold an inherited IRA',
    statement:
      'An IRA acquired by reason of death is treated as inherited only where the acquiring individual was not the surviving spouse of the decedent. A surviving spouse is therefore outside the inherited-IRA rules: the rollover and conversion bar of 408(d)(3)(C)(i) does not reach them, so Form 8606 line 8 can be non-zero for a spousal pool.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale: null,
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(3)(C)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408',
      quotedText:
        'An individual retirement account or individual retirement annuity shall be treated as inherited if - (I) the individual for whose benefit the account or annuity is maintained acquired such account by reason of the death of another individual, and (II) such individual was not the surviving spouse of such other individual.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/beneficiarySpousalElectionStatus.ts'],
    implementedByFunctions: [
      'packages/engine/src/actions/beneficiarySpousalElectionStatus.ts#evaluateBeneficiarySpousalElection',
    ],
  },

  // --- Registered 2026-08-03: account-eligibility rules and their proxies -----

  'irc-408-d-3-G-simple-two-year-rollover-bar': {
    title: 'SIMPLE IRA two-year bar on rollover and Roth conversion',
    statement:
      'A payment out of a SIMPLE IRA during the two-year period to which section 72(t)(6)(A) applies is denied rollover treatment unless it is paid into another SIMPLE IRA. A qualified rollover contribution to a Roth IRA must meet the requirements of section 408(d)(3), so inside that period a Roth conversion out of a SIMPLE IRA is barred outright rather than merely repriced, and the engine refuses the action instead of computing one.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'This is not the rule already registered as irc-72-t-6-simple-two-year-rate, and neither record covers the other. That one is the rate substitution in 72(t)(6)(A): it prices a distribution the taxpayer is nonetheless permitted to take, and every 72(t)(2) exception still zeroes it. This one is the eligibility bar in 408(d)(3)(G): it makes the movement unavailable at all. They share a period and nothing else, so a distribution can sit inside the period, carry no additional tax because an exception applies, and still be ineligible for rollover or conversion. Reading either record as coverage of the other would leave a conversion the statute forbids being merely repriced at 25 percent. The period itself is measured as 24 calendar months from the participation start date using the month-end clamp in actions/civilDate.ts, and the comparison is strict, so a conversion dated on the 24-month anniversary is permitted and one dated the day before is refused. That follows from a 2-year period beginning on the participation date, which runs through the day before the anniversary.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(3)(G)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'In the case of any payment or distribution out of a simple retirement account (as defined in subsection (p)) to which section 72(t)(6)(A) applies, this paragraph shall not apply unless such payment or distribution is paid into another simple retirement account.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(e)(1)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The term “qualified rollover contribution” means a rollover contribution- (A) to a Roth IRA from another such account, (B) from an eligible retirement plan, but only if- (i) in the case of an individual retirement plan, such rollover contribution meets the requirements of section 408(d)(3), ...',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(6)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'In the case of any amount received from a simple retirement account (within the meaning of section 408(p)) during the 2-year period beginning on the date such individual first participated in any qualified salary reduction arrangement maintained by the individual’s employer under section 408(p)(2), paragraph (1) shall be applied by substituting "25 percent" for "10 percent".',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
    implementedByFunctions: [
      'packages/engine/src/strategies/accountEligibility.ts#evaluateConversion',
    ],
  },
  // The distributee half of the old single conversion-identity record, which
  // asserted the owner boundary and the destination vehicle together and was
  // classified `approximated` for both. The owner boundary is now modelled, so
  // holding the two in one record would leave the closed half carrying an
  // accusation and an `errorDirection` that no longer describe anything -- the
  // exact rot the approximated-coverage guard exists to catch. Split, each half
  // gets the classification that is true of it, and the fixture that pins it:
  // a discriminating one here, a `produced` one on the vehicle record below.
  'irc-408-d-3-A-i-conversion-benefits-the-distributee': {
    title: 'A conversion must come out of and go into the same individual’s own accounts',
    statement:
      'A Roth conversion is a rollover inside one individual’s own accounts. Section 408A(e)(1) defines a qualified rollover contribution, and clause (B)(i) admits one from an individual retirement plan only if it meets the requirements of section 408(d)(3). Section 408(d)(3)(A) admits two destinations and attaches the same person to both: an individual retirement account or annuity for the benefit of such individual under clause (i), or an eligible retirement plan for the benefit of such individual under clause (ii). Section 408A(d)(3)(B) imposes that identity requirement on the conversion itself, applying the conversion paragraph to a distribution from a plan maintained for the benefit of an individual which is contributed to a Roth IRA maintained for the benefit of such individual. Dollars distributed from one spouse’s traditional IRA therefore cannot be converted into the other spouse’s Roth, on a joint return or any other. The projection observes that boundary: after the RMD block it snapshots each owner’s gross convertible balance, splits the sized household amount between owners pro rata by exact-cent largest remainder, drains only that owner’s own convertible accounts, credits only a Roth account that owner owns, and trims the slice of an owner who holds no Roth of their own -- naming that person in a warning that says the share was skipped and that opening a Roth IRA for them would let it convert. What the destination search does not check is which KIND of Roth account the dollars land in; that residual is registered separately as irc-408A-d-3-B-conversion-destination-must-be-a-roth-ira and is not asserted here.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'The authority fixes whose dollars may move and whose account may receive them. It selects nothing about how a household-level conversion request is divided between two people who each hold convertible balances, and nothing about which of one person’s several Roth accounts receives their share, so both are engine conventions. The split is pro rata on each owner’s GROSS convertible balance, not on the taxable fraction of it, because what an owner may convert is limited by what they hold and not by how much of it is pre-tax; the weight is snapshotted after the RMD block, which Treas. Reg. 1.408A-4 A-6(b) requires the forced distribution to precede, and before the drain loop reduces any balance, because reading it mid-loop would weight each owner by whatever the earlier owners happened to leave behind. A genuine split is allocated in exact cents by largest remainder so the parts sum to the whole with no floating-point residue deciding whose dollars move; a household with one convertible owner is deliberately NOT routed through cents, because quantizing a target the sizer produced in raw Plan dollars would change an answer the owner boundary has no quarrel with. The receiving account is that owner’s first Roth account in Plan order, which is arbitrary between two accounts of the same kind and is not arbitrary between kinds -- see the vehicle record. An owner whose slice is trimmed for want of a destination is excluded from the shortfall total the year reports, because an owner who cannot convert is not a shortfall against anyone’s balance and saying so would answer the wrong question with the wrong fix.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(e)(1), through clause (B)(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'The term "qualified rollover contribution" means a rollover contribution— (A) to a Roth IRA from another such account, (B) from an eligible retirement plan, but only if— (i) in the case of an individual retirement plan, such rollover contribution meets the requirements of section 408(d)(3), and (ii) in the case of any eligible retirement plan (as defined in section 402(c)(8)(B) other than clauses (i) and (ii) thereof), such rollover contribution meets the requirements of section 402(c), 403(b)(8), or 457(e)(16), as applicable, and',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(3)(A), complete',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Paragraph (1) does not apply to any amount paid or distributed out of an individual retirement account or individual retirement annuity to the individual for whose benefit the account or annuity is maintained if— (i) the entire amount received (including money and any other property) is paid into an individual retirement account or individual retirement annuity (other than an endowment contract) for the benefit of such individual not later than the 60th day after the day on which he receives the payment or distribution; or (ii) the entire amount received (including money and any other property) is paid into an eligible retirement plan for the benefit of such individual not later than the 60th day after the date on which the payment or distribution is received, except that the maximum amount which may be paid into such plan may not exceed the portion of the amount received which is includible in gross income (determined without regard to this paragraph). For purposes of clause (ii), the term "eligible retirement plan" means an eligible retirement plan described in clause (iii), (iv), (v), or (vi) of section 402(c)(8)(B).',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(B), complete',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408A.htm',
      quotedText:
        'This paragraph shall apply to a distribution from an eligible retirement plan (as defined by section 402(c)(8)(B)) maintained for the benefit of an individual which is contributed to a Roth IRA maintained for the benefit of such individual in a qualified rollover contribution. This paragraph shall not apply to a distribution which is a qualified rollover contribution from a Roth IRA or a qualified rollover contribution from a designated Roth account which is a rollover contribution described in section 402A(c)(3)(A).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-1(a), second requirement',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'Second, the amount contributed to the Roth IRA must satisfy the definition of a qualified rollover contribution in section 408A(e) (i.e., it must satisfy the requirements for a rollover contribution as defined in section 408(d)(3), except that the one-rollover-per-year limitation in section 408(d)(3)(B) does not apply).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts',
      'packages/engine/src/actions/retirementActionManualReview.ts',
      'packages/engine/src/decisions/rothConversionCandidateAdapter.ts',
      'packages/engine/src/projection/optimizerAggregateConversionPromotion.ts',
      'packages/engine/src/actions/ownedNonRothIraAnnualPhysicalTransaction.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/aggregateRothConversionOwnerAllocation.ts#allocateAggregateRothConversionByOwner',
      'packages/engine/src/projection/internal/annualAggregateRothConversionPlan.ts#annualAggregateRothConversionPlan',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts#conversionSourceIssue',
      'packages/engine/src/actions/retirementActionCandidateIdentityAllocator.ts#conversionDestinationIssue',
      'packages/engine/src/actions/retirementActionManualReview.ts#targetIdentitySemanticsIssue',
      'packages/engine/src/decisions/rothConversionCandidateAdapter.ts#adaptFillTargetRothConversionGeneratorCandidate',
      'packages/engine/src/projection/optimizerAggregateConversionPromotion.ts#promoteOneYear',
      'packages/engine/src/actions/ownedNonRothIraAnnualPhysicalTransaction.ts#preparePlanOwnedNonRothIraAnnualPhysicalTransaction',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
    ],
  },

  'irc-408-d-2-C-projection-pro-rata-measurement-instant': {
    title: 'The instant the Form 8606 pro-rata denominator is measured',
    statement:
      'Section 408(d)(2)(C) fixes the section 72 contract value at the CLOSE of the calendar year and then adds the year\u2019s distributions back to it, which is what Form 8606 line 6 asks for \u2014 the December 31 value of the traditional IRAs, after a full year of investment return on whatever the account retained. The engine takes that instant wherever the owned-non-Roth-IRA annual settlement governs the year: the settlement builds its denominator as the post-growth December 31 pool balance, plus the December 31 value of any annuity contract that pool bought, plus lines 7 and 8, and the attempt driver re-runs the whole annual pass until the characters it assumed are the ones the run produced. THE LEGACY FALLBACK LEDGER does not, and it governs every year the settlement produces no usable characters for: it measures the aggregated balance immediately after contributions and immediately BEFORE the year\u2019s first distribution. Those two instants agree on the dollars that were distributed, because the ledger credits growth after distributions, and they DISAGREE by exactly the growth earned on the balance that stayed in the account. The fallback measure is therefore year-end-BEFORE-growth plus distributions, not line 6 plus distributions, and it is invariant to the return assumption where the statutory one is not.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'THE ONE SHAPE STILL REACHING THE FALLBACK IS A MAGNITUDE, not an event, and that is the whole of what has changed. Every refusal that used to route an ordinary year here has been closed by making the refusing arm source-allocatable, which is the remedy this record has prescribed since it was written: the charitable one closed when the nonmoving overlay learned to carry its per-owner 408(d)(8)(D) attribution, the exact-action one when the source series bound itself to the executor\u2019s own evidence instead of to the mere presence of a declaration, and the annuity one when the contract a premium buys was given a value channel the replay carries. What remains is sourceAmountInvalid: a figure too large to cross the exact-cent boundary refuses the year, the year prices on the fallback, and the departure is fully visible there. A HUNDRED-TRILLION-DOLLAR IRA IS ABSURD AND IS STATED ANYWAY. The boundary is the exact-cent ledger\u2019s own: cents are held as safe integers, so a Plan-dollar figure above about 90.07 trillion cannot be represented and the year refuses. A 76-year-old with a 100,000,000,000,000 dollar IRA carrying 20 percent basis, taking the 4,219,409,282,700.42 requirement and converting 10,000,000,000,000, reports 11,375,527,426,160.34 of ordinary income at a 0 percent return, at a 5 percent return, and at a negative 5 percent return alike \u2014 the invariance IS the defect, because a denominator measured before the year\u2019s growth cannot move when the growth does. The statutory measure at 5 percent is 11,492,485,972,361.12. The same household one order of magnitude smaller settles and moves with the return. No user has this balance; the record is not about the user, it is about whether the fallback is reachable, and it is. THE INVENTORY THIS RECORD PUBLISHED EARLIER ON 2026-08-07 WAS WRONG, and the correction is why the paragraph above states a boundary rather than a list. It claimed eight probed shapes had all settled and concluded that no valid Plan reached the fallback \u2014 true of the eight, and the largest balance among them was 90 trillion, one notch BELOW the exact-cent ceiling. A record that reasons from a probe set to a universal has to say which universe the probe covered, and that one did not. DIRECTION OF ERROR: the sign is the sign of the year\u2019s return on the retained balance. In a gain year the statutory denominator is larger, the basis fraction smaller, and the fallback returns MORE basis than the form does \u2014 understating that year\u2019s income and spending basis that later years then do not have. In a loss year the denominator shrinks below the fallback\u2019s, the fraction rises, and the fallback returns LESS basis, overstating income. Neither is a timing wash within the year and the two do not cancel across a lifetime unless returns do. MAGNITUDE: the departure is (line 7 + line 8) \u00d7 growth-on-the-retained-balance \u00f7 denominator, so it is negligible on a household whose only IRA activity is a required distribution and material on a conversion year, where line 8 can be many times line 7. PINNED ON BOTH SIDES OF THE BOUNDARY. The fallback: the overflow household above. The settled path, twice: a 76-year-old with a 1,000,000 dollar IRA carrying 200,000 of basis, a 42,194.09 required distribution and a 100,000 dollar Roth conversion reports 113,755.27 at a 0 percent return and 114,924.86 at a 5 percent one, and the same household with a 40,000 dollar aggregate charitable gift instead reports 80,903.66 and 81,814.18. A third settled fixture pins the annuity shape, which used to be this record\u2019s produced arm and now reports 114,859.33 at 5 percent where it once reported 112,258.49 at every return alike. NOT CORRECTED HERE, and the reason has not changed. Giving the fallback the statutory denominator means giving it the same multi-pass fixed point the settlement already runs, because the denominator needs the year\u2019s total distributions and those are decided after the fraction is needed and depend on it \u2014 there is no closed form available at distribution time. The remedy runs the other way, one refusal at a time, and it has now run out of refusals that describe events rather than magnitudes. CORRECTION HISTORY. As first written on 2026-08-05 this record said \u201cthe annual ledger measures the denominator at a different instant\u201d and \u201cthe engine denominator is invariant to the return assumption; the statutory one is not\u201d, and it named only simulate.ts and strategies/iraBasis.ts as implementing the rule. Both sentences generalized a one-shape observation to the whole engine. It was re-scoped to the fallback, with a settled-path fixture added so the boundary was pinned rather than asserted. Re-scoped AGAIN later that day: the version then claimed \u201cthe single refusal reachable today is qcdStageRequired\u201d, wrong twice over, since the annuity and exact-action refusals were reachable when it was written and the charitable one had stopped being. It then named the annuity purchase as the one shape its departure was measured on and predicted its own end in terms \u2014 \u201cif the annuity premium ever stops leaving the captured pool this shape settles, and then it is this suite, not only the record, that has to be revisited.\u201d It did, and it was; the record was briefly reclassified settled on that basis and is approximated again here, on the shape the reclassification had not probed.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'the value of the contract, income on the contract, and investment in the contract shall be computed as of the close of the calendar year in which the taxable year begins. For purposes of subparagraph (C), the value of the contract shall be increased by the amount of any distributions during the calendar year.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 6',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'Enter the total value of all your traditional IRAs as of December 31, 2025, plus any outstanding rollovers.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    // Both arms, because `implementedBy` is documented as the engine sources
    // implementing the RULE and not as the sites of the departure. Naming only
    // the fallback is how this record came to read as a claim about the whole
    // engine: a reader who followed the trail found the one measure that is
    // wrong and no route to the files that get it right.
    implementedBy: [
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts',
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts',
      'packages/engine/src/projection/internal/annualOwnedNonRothIraSettlementPhase.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/iraBasis.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts#classifyOwnedNonRothIraAnnualWithdrawals',
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts#replayOwnedNonRothIraContiguousYears',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/projection/internal/annualFundingApplicationAndClosePhase.ts#annualFundingApplicationAndClosePhase',
      'packages/engine/src/projection/internal/annualOwnedNonRothIraSettlementPhase.ts#annualOwnedNonRothIraSettlementPhase',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/iraBasis.ts#openIraProRataYear',
    ],
  },

  'irc-408-d-2-C-annuity-contract-close-of-year-value': {
    title: 'What the engine says an IRA-owned annuity contract is worth on December 31',
    statement:
      'Section 408(d)(2)(C) computes the value of the contract as of the close of the calendar year, and Form 8606 line 6 asks for the total VALUE of the traditional IRAs on December 31; the Form 5498 instructions put the duty to supply that value on the custodian even for an asset with no readily determinable market. For an annuity contract bought with IRA dollars the engine has no such value to read. A Plan annuity account records a start age, a monthly amount, a COLA, a payout form and a premium, and nothing that answers what the contract is worth at the end of a year; the fair market value of an annuitized contract is an actuarial quantity, and the Form 1099-R instructions for 2026 stop requiring even the issuer to report the year-end value of an annuitized commercial contract. So the engine supplies a convention in its place: the premium paid in, less every payment taken out, floored at zero, with no growth credited and none debited. That figure is what enters line 6. A contract bought BEFORE the projection starts is seeded the same way from the Plan\u2019s quoted premium, held to the QLAC cap for its purchase year, less the payments it made in the years the ledger never ran.',
    classification: 'approximated',
    contraryReading: null,
    errorDirection: 'bothDirections',
    conventionRationale:
      'WHY NOT GROWTH, since the obvious alternative is one line of code. A Plan annuity account inherits `annualReturnPct` from the shared account shape, and it defaults to the household\u2019s own portfolio assumption when null. Reading it would make the contract compound at whatever a user set for their brokerage, which is a larger assertion about an insurer\u2019s general account than the silence it would replace, and it would do it invisibly. The convention errs in a direction a reader can reason about; a borrowed return rate errs in whatever direction the user\u2019s unrelated assumption happens to point. WHY A ZERO FLOOR. A contract value cannot be negative and a denominator must not be reduced by one, so a contract that has paid out more than its premium contributes nothing further to line 6 while the whole of each payment still reports on line 7. That is deliberate and it is one of the two directions below. DIRECTION, MEASURED RATHER THAN ARGUED. Take the 76-year-old with a 1,000,000 dollar IRA carrying 200,000 of basis, a 42,194.09 required distribution and a 100,000 dollar Roth conversion, and give them a 50,000 dollar qualified premium paid out of that same IRA. At a 5 percent return the household reports 114,859.33 where the identical household that bought no contract reports 114,924.86 — 65.53 LESS, because line 9 is 1,040,390.30 against 1,042,890.30, and the 2,500 between them is exactly 5 percent of the premium the convention did not credit. At a negative 5 percent return the same pair parts by 77.41 in the other direction, because the convention did not debit the loss either. The gap grows with the premium and with the return and depends on nothing else, but NOT linearly in either: at a 200,000 dollar premium and the same 5 percent it is 264.01, where four times 65.53 would be 262.12. The withheld growth is linear in the premium; the income it moves is not, because the same withheld growth is also missing from the denominator it is divided by. UNDERSTATES TAX IN A GAIN YEAR AND OVERSTATES IT IN A LOSS YEAR, and the two do not cancel across a lifetime unless returns do. The zero floor runs the same way as the gain case: a still-paying contract held at zero understates the denominator, raises the basis fraction, and returns basis to the residual IRA faster than the form allows. MAGNITUDE is the year\u2019s lines 7 and 8 multiplied by the difference between the two fractions, so it scales with the premium as a share of the aggregate and vanishes for a household with no basis, where the fraction is 1 whatever the denominator. THE ACCEPTED READING IS ITSELF A STAND-IN, and this is the part to argue with. What the authority requires is a fair market value, and neither figure above is one; the accepted figure is read off the household that bought no contract, which is the reading section 408(d)(2)(A) supports as far as it goes \u2014 the aggregation treats the plans as one contract, so a movement between two of them is not an event section 72 measures, and a valuation that made the purchase visible to line 9 would defeat what the aggregation is for. What it assumes beyond that is that the contract earns what the account would have, which is true of no particular contract. A deferred annuity crediting interest may beat it; an annuitized life contract held by a short-lived annuitant is worth far less than its undistributed premium. The record does not claim the counterfactual figure is right. It claims the engine\u2019s figure is not a valuation at all, and uses the one determinable December 31 figure the model can produce to say which way and by how much. A SECOND CONVENTION RIDES ON THE FIRST, and it has its own direction. A contract bought before the projection started opens from the Plan\u2019s QUOTED premium, and the quoted premium is not always what the contract received: a purchase inside the projection funds min(premium, spendable), so a premium larger than its funding account leaves the contract short, and a purchase before the projection has no balance left to have been short of. Nothing in the Plan records the shortfall, so the seed cannot know it. The result is that ONE contract has two values decided by nothing but which year the projection starts in: a 90,000 dollar premium quoted against a 30,000 dollar IRA gives a contract holding 18,000 at the end of 2027 in the projection that watched the purchase happen, and 78,000 in the same household reopened a year later. DIRECTION, and unlike the growth question above it is one-sided: funding is a minimum, so the quote is an upper bound on what moved and the seed can only be too high. Too high a contract value is too large a line 6, a smaller basis fraction, less basis recovered, and MORE tax. It is bounded by the premium and by nothing else, and it is zero for every contract the projection funds itself, which is every contract a plan built in the app will contain. THE QLAC CAP IS APPLIED TO THE SEED and was not until 2026-08-07: Treas. Reg. 1.401(a)(9)-6(q)(2) is a rule about the contract rather than about which year a projection starts in, so a 400,000 dollar QLAC seeded at 400,000 pre-start where the same purchase inside the projection was reduced to the cap. That half is closed; the funded-versus-quoted half is not closeable from the Plan and is registered here instead. WHAT WOULD CLOSE THE WHOLE OF IT is a contract value the Plan actually carries \u2014 an account value for a deferred contract, or a mortality-and-interest reserve for an annuitized one \u2014 and either is a modelling decision with its own authority question rather than an arithmetic fix.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'the value of the contract, income on the contract, and investment in the contract shall be computed as of the close of the calendar year in which the taxable year begins. For purposes of subparagraph (C), the value of the contract shall be increased by the amount of any distributions during the calendar year.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 6',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'Enter the total value of all your traditional IRAs as of December 31, 2025, plus any outstanding rollovers.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Forms 1099-R and 5498 (2026), Form 5498 Box 5',
      url: 'https://www.irs.gov/pub/irs-pdf/i1099r.pdf',
      quotedText:
        'Enter the FMV of the account on December 31, 2026. ... Trustees and custodians are responsible for ensuring that all IRA assets (including those not traded on established markets or not having a readily determinable market value) are valued annually at their FMV.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/internal/iraAnnuityContractValue.ts',
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/internal/iraAnnuityContractValue.ts#openingAnnuityContractValuePlanDollars',
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts#replayOwnedNonRothIraContiguousYears',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/projection/internal/annualAnnuityPurchaseFunding.ts#annualAnnuityPurchaseFunding',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-408-d-1-ira-annuity-premium-is-not-a-distribution': {
    title: 'Buying an annuity contract with IRA dollars is not a distribution',
    statement:
      'Section 408(d)(1) reaches only an amount "paid or distributed out of an individual retirement plan". Directing the trustee of a traditional IRA to spend the account on an annuity contract pays nothing out to the owner: the contract is either an individual retirement annuity described in section 408(b), which section 7701(a)(37)(B) makes an individual retirement plan in its own right, or an annuity contract held as an asset of the section 408(a) trust, which never leaves the account at all. The IRS names both structures and taxes neither at purchase. There is no Form 8606 line 7 entry, no section 72 pro-rata recovery, and no basis attaches to the contract as a separate investment; tax arrives when payments begin. The engine agrees, and its accepted-input model cannot express the contrary reading at all: a purchase drawing on a traditional account must be declared "qualified", and a "nonQualified" purchase — the distribution-and-purchase shape, where the owner takes a taxable distribution and buys a commercial annuity with the proceeds — is refused by plan validation unless it is funded from cash, taxable, or equity-compensation savings, which are dollars section 408 never governed.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'WHY THE TWO STRUCTURES DO NOT HAVE TO BE DISTINGUISHED, which is the question the Plan schema raises by carrying neither. A Plan annuity purchase records a premium, a funding account, a tax qualification and a QLAC flag; it does not record who issues the contract, and it therefore cannot say whether the result is a section 408(b) individual retirement annuity or an annuity contract sitting inside a section 408(a) trust. That silence is harmless here because the two roads arrive at the same place. On the first, the contract is itself an individual retirement plan and the movement into it is a trustee-to-trustee transfer, which Treas. Reg. 1.408-8(d)(4) states is not a distribution and which the Form 1099-R instructions direct the issuer not to report. On the second, nothing moved between plans at all — the trust exchanged cash for a contract, the way it would exchange cash for a bond. Section 408(a)(3) forbids the trust to invest in life insurance contracts and says nothing against an annuity contract, and the Form 1099-R instructions name the shape explicitly when they extend the Roth-conversion valuation rule to "a traditional IRA holds an annuity contract as an account asset". So the schema is not missing a fact the answer turns on. IT WOULD MATTER FOR A DIFFERENT QUESTION, and this is worth recording because the temptation to derive it here is real. Section 408(b)(2)(B) caps the annual premium of an individual retirement annuity at the section 219(b)(1)(A) dollar amount, and unlike section 408(a)(1) — which carves rollover contributions out of the parallel cap on an account — subsection (b) states no such exception in its text. A large single premium therefore sits uneasily with the first structure and not at all with the second. That asymmetry is not resolved here, because nothing this engine computes turns on it: the character of the purchase, the aggregation of the contract, and the taxation of the payments are the same either way. It is registered so that a later reader who needs the distinction knows it was seen and set aside rather than missed. ONE ROUTE TO THE CONTRARY READING IS NOT CLOSED, and the statement above should be read against it. The schema refuses a `nonQualified` premium drawn on a traditional account, which is the distribution-and-purchase shape said in so many words, but an annuity account’s `ownerPersonId` is independent of its funding account’s, so a Plan may name ONE spouse’s contract and pay for it out of the OTHER’s IRA. On the reading this record takes that is still not a distribution -- nothing was paid out to anybody -- and the engine treats it that way: the contract enters the funding owner’s section 408(d)(2) aggregate, its payments are that owner’s line-7 distributions AND are priced at that owner’s annual basis fraction \u2014 the two travel together, and separating them is a defect this engine wrote and caught: the gross joined the pool owner’s line 7 while the character was looked up under the contract’s owner, so the payment was charged in full and the basis its own allocation had already spent was never applied. Its `startAge` goes on being measured against the person the Plan named, which is the one question that field does answer. The competing reading is that a contract belonging to somebody else could only have been reached by distributing to the IRA owner first and gifting the proceeds, which would put the whole premium on that owner’s line 7 and raise a transfer question the model has no field for. Nothing here decides between them. What is recorded is that the engine takes the first, that the second would produce a materially larger tax in the purchase year, and that a shape a saved plan file already contains is a poor place to discover the question -- refusing it would only have sent the year to a ledger that drops the contract from line 6 altogether, which neither reading supports.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in this subsection, any amount paid or distributed out of an individual retirement plan shall be included in gross income by the payee or distributee, as the case may be, in the manner provided under section 72.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "individual retirement annuity" means an annuity contract, or an endowment contract (as determined under regulations prescribed by the Secretary), issued by an insurance company which meets the following requirements:',
    }, {
      kind: 'statute',
      citation: 'IRC 7701(a)(37)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section7701&num=0&edition=prelim',
      quotedText:
        'The term "individual retirement plan" means- (A) an individual retirement account described in section 408(a), and (B) an individual retirement annuity described in section 408(b).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(d)(4)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'In the case of a trustee-to-trustee transfer from one IRA to another IRA that is not a distribution and rollover, the transfer is not treated as a distribution by the transferor IRA for purposes of section 401(a)(9). Accordingly, the minimum distribution requirement with respect to the transferor IRA must still be satisfied.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B, Distribution of an annuity contract from your IRA account',
      url: 'https://www.irs.gov/pub/irs-pdf/p590b.pdf',
      quotedText:
        'You can tell the trustee or custodian of your traditional IRA account to use the amount in the account to buy an annuity contract for you. You aren\'t taxed when you receive the annuity contract (unless the annuity contract is being converted to an annuity held by a Roth IRA). You are taxed when you start receiving payments under that annuity contract.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Forms 1099-R and 5498 (2026), Transfers; Roth IRA conversions',
      url: 'https://www.irs.gov/pub/irs-pdf/i1099r.pdf',
      quotedText:
        'Generally, do not report a transfer between trustees or issuers that involves no payment or distribution of funds to the participant, including a trustee-to-trustee transfer from one IRA to another IRA ... When an individual retirement annuity described in section 408(b) is converted to a Roth IRA, the amount that is treated as distributed is the FMV of the annuity contract on the date the annuity contract is converted. This rule also applies when a traditional IRA holds an annuity contract as an account asset and the traditional IRA is converted to a Roth IRA.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/internal/iraAnnuityContractValue.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/model/plan.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/internal/iraAnnuityContractValue.ts#ownedIraFundedAnnuityContracts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/model/plan.ts#annuitySchema',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },

  'irc-408-d-2-A-annuity-contract-outside-the-form-8606-aggregate': {
    title: 'An annuity contract an IRA bought stays inside the Form 8606 aggregate',
    statement:
      'Section 408(d)(2)(A) treats all individual retirement plans as one contract for section 72, and an individual retirement annuity described in section 408(b) is an individual retirement plan under section 7701(a)(37)(B). An annuity contract held as an asset of a section 408(a) account is inside the same aggregate by an even shorter route: it never left the account, and Form 8606 line 6 asks for the total VALUE of the traditional IRAs, which the Form 5498 instructions require the custodian to report at fair market value even for assets with no readily determinable one. Either way the contract belongs in the line 6 denominator for the purchase year and every year after it. THE ENGINE NOW CARRIES IT. A Plan annuity account still has no balance and is still outside the projection ledger — the contract is not an account with a balance, and making it one would put a non-account into the pool the annual observation validates. What carries it instead is a contract-value channel published beside the December 31 pool and added to line 6 by the annual replay: the premium credits it at the same mutation ordinal the funding IRA is debited at, the contract\u2019s own payments debit it, and the replay refuses any year whose published value does not rejoin its own reconstruction of that chain in exact cents. A purchase is therefore invisible to the form, which is what the aggregation makes it.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'WHAT THE PROBE SHOWED, kept because it is the proof and not the history. Take a 76-year-old with a 1,000,000 dollar traditional IRA carrying 200,000 of nondeductible basis, a 42,194.09 required distribution, a 100,000 dollar Roth conversion, and a 0 percent return assumption. Run that household twice, once as it stands and once with a 200,000 dollar qualified annuity premium paid out of the same IRA in the same year. Under the compelled reading the two households report the SAME ordinary income, to the cent, because the premium moves value from one line-6 asset to another and line 9 is 1,000,000 either way: 142,194.09 of lines 7 and 8 at a basis fraction of 0.2 is 113,755.27. The engine reports 113,755.27 for both of them. It used to report 106,645.57 for the household with the premium — 7,109.70 less, in one year, for a transaction that changed nothing the statute measures — and the fixture that pinned that gap now pins its absence. THE ZERO PERCENT RETURN IS STILL DELIBERATE and still does the same work: it makes the contract\u2019s December 31 value exactly the premium, so the figure needs no valuation convention and the fixture measures aggregation rather than valuation. WHAT IS NOT CLOSED HERE, and must not be read as closed. This record is about WHETHER the contract is in the denominator, not about what number goes in. The engine supplies premium accumulated less payments, floored at zero, with no growth, because no authority supplies an actuarial fair market value and the Plan carries no contract growth rate; that convention is registered separately, with both of its directions and their magnitudes, as irc-408-d-2-C-annuity-contract-close-of-year-value. At a 0 percent return the two questions do not interact at all, which is why the figures above are unaffected by it. SETTLED ON 2026-08-07, having been approximated since 2026-08-05. The record as written then said the fix "cannot be" made "without a contract value the model does not carry", and that the value "belongs to the slice that adds the field, not to the slice that found the gap". Both sentences were right about the sequencing and wrong about the difficulty: the field is a channel rather than a balance, and the reason the gap survived was not that the value was unavailable but that no arm of the engine had been asked to carry one. The old entry also predicted its own end correctly — "the day a contract value enters the denominator the pin fails and names this entry" — and that is how this reclassification was found.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(2)(A), (B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of applying section 72 to any amount described in paragraph (1)- (A) all individual retirement plans shall be treated as 1 contract, (B) all distributions during any taxable year shall be treated as 1 distribution,',
    }, {
      kind: 'statute',
      citation: 'IRC 7701(a)(37)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section7701&num=0&edition=prelim',
      quotedText:
        'The term "individual retirement plan" means- (A) an individual retirement account described in section 408(a), and (B) an individual retirement annuity described in section 408(b).',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), IRAs Generally; Line 6',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText:
        'An IRA is an individual retirement account or an individual retirement annuity. ... Enter the total value of all your traditional IRAs as of December 31, 2025, plus any outstanding rollovers.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Forms 1099-R and 5498 (2026), Form 5498 Box 5',
      url: 'https://www.irs.gov/pub/irs-pdf/i1099r.pdf',
      quotedText:
        'Enter the FMV of the account on December 31, 2026. ... Trustees and custodians are responsible for ensuring that all IRA assets (including those not traded on established markets or not having a readily determinable market value) are valued annually at their FMV.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/internal/iraAnnuityContractValue.ts',
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/internal/iraAnnuityContractValue.ts#openingAnnuityContractValuePlanDollars',
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts#replayOwnedNonRothIraContiguousYears',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
      'packages/engine/src/strategies/accountEligibility.ts#isAggregatedIra',
    ],
  },

  'irc-408-d-2-B-annuity-payment-outside-the-annual-basis-fraction': {
    title: 'An IRA annuity payment takes the year\u2019s share of basis like any other distribution',
    statement:
      'Section 408(d)(2)(B) treats all distributions during a taxable year as one distribution, so a payment under an annuity contract bought with IRA dollars is not a separate transaction with its own character: it joins the year\u2019s other IRA distributions and takes the same fraction of basis. Publication 590-B says so directly \u2014 the payments are fully taxable only if the traditional IRAs hold nothing but deductible contributions, and where they hold both, the payments are taxed under the same fully-or-partly-taxable rules the pro-rata computation implements. The engine now prices them that way. The payment is minted as its own runtime occurrence whose source account is the CONTRACT, it carries Form 8606 line 7, and the annual settlement allocates the year\u2019s basis across it and every other line-7 distribution at one fraction. The projection\u2019s income block still adds the whole payment to ordinary income, because the year\u2019s fraction is not known where the payment is credited; the settled basis share is subtracted in the annual pass, exactly as a required distribution\u2019s is.',
    classification: 'settled',
    contraryReading: null,
    errorDirection: null,
    conventionRationale:
      'THE FIXTURE NO LONGER HOLDS THE DENOMINATOR FIXED, and that change is the measure of what closed. While the contract sat outside line 6 this fixture had to price both of its readings over the ENGINE\u2019S pool, or it would have become a second measurement of the companion defect rather than a measurement of this one. Both defects are closed, so the figures below are the statute\u2019s throughout. An 80-year-old with a 1,000,000 dollar IRA carrying 200,000 of basis pays a 200,000 dollar qualified premium in 2026 and receives 12,000 from the contract in the same year, at a 0 percent return. Line 7 is the 49,504.95 required distribution plus the 12,000 payment, 61,504.95. Line 6 is the 750,495.05 the account kept plus the 188,000 the contract still holds, 938,495.05; line 9 is 1,000,000 exactly, the fraction is 0.2, and the year\u2019s ordinary income is 49,203.96. Turning the contract\u2019s payments on moves that figure by 9,600, which is 12,000 at the year\u2019s own 0.8 \u2014 the payment taking its share, which is what this record exists to say. WHAT THE OLD ENTRY CLAIMED AND WHERE IT LANDED. It pinned 49,128.71 produced against 46,128.71 accepted and called the 3,000 between them the basis the payment was refused, while saying in terms that "the true statutory figure is larger than 3,000 and is deliberately not claimed" because the correct denominator was unavailable. It is available now, and the true figure is 49,203.96 \u2014 75.25 ABOVE the old produced figure rather than 3,000 below it. That is not a contradiction: this record\u2019s overstatement and its companion\u2019s understatement ran in opposite directions on the same household, and the companion\u2019s was the larger of the two here. A reader who expected the fix to lower this household\u2019s tax should read that as the reason a pair of opposed approximations must never be netted in prose. WHAT WOULD CLOSE IT, said the old entry, \u201cis a single change with a wide blast radius: routing an IRA-funded annuity payment through the owned-non-Roth-IRA withdrawal character path instead of the fully-ordinary branch.\u201d That is what was done. WHERE THE FULLY-ORDINARY BRANCH SURVIVES, enumerated rather than gestured at, because the first version of this paragraph said \u201cone shape\u201d and was wrong. It survives in two places and both are correct. First, a contract outside the section 408(d)(2) aggregate altogether: Plan validation requires a qualified purchase to be funded from an owned traditional ACCOUNT and does not require an IRA, so an employer plan can pay a premium, and a contract its pre-tax dollars bought is not in this aggregation and its payments carry no Form 8606 basis to share. Second, a year the settlement does not commit, where the payment keeps the legacy treatment rather than being split against a pro-rata state opened on a pool the contract is not in \u2014 a second approximation invented to paper over the first. A THIRD SHAPE WAS FOUND AND CLOSED while verifying this sentence: a qualified purchase quoting a ZERO premium was excluded from staging, so a contract that paid without having been paid for had no occurrence and charged its payments in full while the year\u2019s other distributions shared the basis \u2014 2,400 a year on the fixture household. Nothing in 408(d)(2)(B) turns on how a contract was acquired, so it is staged like any other, contributing nothing to line 6 because it holds nothing. A CROSS-OWNER PURCHASE IS NOT ON THE LIST EITHER, and for one revision it silently was: the character was looked up under the contract\u2019s own owner while the settlement published it under the pool owner, so a Plan naming one spouse\u2019s contract against the other\u2019s IRA charged the payment in full AND spent the basis the settlement had already allocated \u2014 tax charged, basis gone, every paying year, and nothing recording that it had happened. The lookup asks under the pool owner now, and the two households report the same figure to the cent.',
    jurisdiction: 'federal',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(2)(A), (B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'For purposes of applying section 72 to any amount described in paragraph (1)- (A) all individual retirement plans shall be treated as 1 contract, (B) all distributions during any taxable year shall be treated as 1 distribution,',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B, Distribution of an annuity contract from your IRA account, Tax treatment',
      url: 'https://www.irs.gov/pub/irs-pdf/p590b.pdf',
      quotedText:
        'If any of your traditional IRAs include both deductible and nondeductible contributions, the annuity payments are taxed as explained earlier under Distributions Fully or Partly Taxable.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B, Distribution of an annuity contract from your IRA account',
      url: 'https://www.irs.gov/pub/irs-pdf/p590b.pdf',
      quotedText:
        'You are taxed when you start receiving payments under that annuity contract.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-07',
    implementedBy: [
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
    implementedByFunctions: [
      'packages/engine/src/internal/ownedNonRothIraContiguousReplay.ts#replayOwnedNonRothIraContiguousYears',
      'packages/engine/src/internal/ownedNonRothIraRuntimeSourceSeries.ts#validateOwnedNonRothIraRuntimeSourceSeries',
      'packages/engine/src/projection/internal/annualPensionAndAnnuityIncome.ts#annualPensionAndAnnuityIncome',
      'packages/engine/src/projection/simulate.ts#simulatePlan',
    ],
  },
} satisfies Record<string, TaxRuleRecord>
