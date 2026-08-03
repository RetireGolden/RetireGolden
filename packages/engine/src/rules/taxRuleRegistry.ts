/**
 * The tax rule registry.
 *
 * Every statutory rule this engine implements is recorded here with the
 * authority it rests on, the reading we took, and the date that reading was last
 * verified against primary sources. The registry is the single answer to "why
 * are we calculating it this way" — for a test, for a reviewer, for a report,
 * and for an advisor defending a number to a CPA.
 *
 * Three properties make that work:
 *
 * 1. It is typed and frozen, so `TaxRuleId` is a closed union and the compiler
 *    rejects a reference to a rule that does not exist. This follows the same
 *    pattern as `ACTION_REASON_REGISTRY`.
 * 2. It is data rather than prose, so tests, the planner, and reports read the
 *    same records. A generated document cannot drift from the code.
 * 3. Every `settled` rule must be covered by a fixture that discriminates
 *    between candidate readings. See `describeRule` in the test support module;
 *    conformance is asserted by `taxRuleRegistry.conformance.test.ts`.
 *
 * Adding a rule means doing the primary-source research first. A record whose
 * `authority` is thin is worse than no record, because it lends unearned
 * confidence to a guess.
 */

/** Where a rule's authority comes from, strongest first. */
export type TaxRuleAuthorityKind =
  | 'statute'
  | 'regulation'
  | 'irsPublication'
  | 'formInstruction'
  | 'irsNotice'
  | 'legislativeHistory'

export interface TaxRuleAuthority {
  readonly kind: TaxRuleAuthorityKind
  /** Citation as a practitioner would write it, e.g. 'IRC 170(b)(1)(I)(i)'. */
  readonly citation: string
  readonly url: string
  /**
   * The operative language, quoted rather than paraphrased. A paraphrase is
   * where misreadings hide; several defects in this engine's history came from
   * prose summaries that dropped a qualifier the statute turned on.
   */
  readonly quotedText: string
}

/**
 * How a rule is expected to move, which sets how often it must be re-verified.
 *
 * - `staticStatute` — settled statutory mechanics. Re-verify annually, or when
 *   legislation moves.
 * - `annuallyIndexed` — a dollar figure the IRS restates each year. Re-verify
 *   every autumn against the COLA notice.
 * - `awaitingGuidance` — no controlling authority yet. Highest re-verification
 *   value, because a regulation or publication example would settle it.
 * - `sunsetting` — has a known expiry that must be surfaced before it bites.
 */
export const TAX_RULE_VOLATILITIES = Object.freeze([
  'staticStatute',
  'annuallyIndexed',
  'awaitingGuidance',
  'sunsetting',
] as const)

export type TaxRuleVolatility = (typeof TAX_RULE_VOLATILITIES)[number]

/**
 * - `settled` — authority controls. Implement it and cover it.
 * - `unsettled` — authority is absent or conflicting. Implement the best
 *   reading, record the contrary one, and publish a disclosure field so a
 *   consumer cannot present the result as filing-grade.
 * - `outOfScope` — deliberately not modelled. The engine must fail closed with
 *   a typed refusal naming the missing rule rather than compute an answer.
 */
export type TaxRuleClassification = 'settled' | 'unsettled' | 'outOfScope'

export interface TaxRuleRecord {
  readonly title: string
  /** The rule in one sentence, stated so a fixture can be written from it. */
  readonly statement: string
  readonly classification: TaxRuleClassification
  /** Required when `classification` is `unsettled`: the reading we rejected. */
  readonly contraryReading: string | null
  /**
   * Why an engineering convention was chosen where no authority selects one.
   *
   * Distinct from `contraryReading`, which records a competing reading of an
   * authority that exists. This field is for the rarer and more dangerous case:
   * the authority is silent, so the engine must pick something to compute at
   * all. Age 70.5 attainment is the type case — the defining regulation was
   * withdrawn, no IRS or judicial source addresses a month-end or leap-day
   * birth, and the convention chosen is an engineering decision rather than a
   * legal conclusion. Anything published from such a rule must say so.
   */
  readonly conventionRationale: string | null
  readonly authority: readonly [TaxRuleAuthority, ...TaxRuleAuthority[]]
  readonly volatility: TaxRuleVolatility
  /** First tax year the rule governs. */
  readonly effectiveFrom: number
  /** Last tax year, when known. `null` means no scheduled expiry. */
  readonly effectiveThrough: number | null
  /** ISO date this rule was last checked against the authority above. */
  readonly verifiedOn: string
  /** Engine sources implementing it, repo-relative. */
  readonly implementedBy: readonly [string, ...string[]]
}

const registry = {
  'irc-170-b-1-I-floor-ordering': {
    title: 'Order of the 0.5% floor and the percentage ceiling',
    statement:
      'The 0.5% itemizer floor reduces the contribution otherwise allowable after the percentage ceiling has been applied: min(C, L) - F, never min(C - F, L).',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(I)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'Any charitable contribution otherwise allowable (without regard to this subparagraph) as a deduction under this section shall be allowed only to the extent that the aggregate of such contributions exceeds 0.5 percent of the taxpayer’s contribution base for the taxable year.',
    }, {
      kind: 'legislativeHistory',
      citation: 'JCT, General Explanation of P.L. 119-21 (JCS-1-26)',
      url: 'https://www.jct.gov/publications/2026/s-1-26/',
      quotedText:
        'Charitable contributions that exceed the applicable percentage limit generally may be carried forward for up to five years.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
  },

  'irc-170-d-1-C-floor-carryforward-gate': {
    title: 'Floor-disallowed amounts carry forward only from a year with an excess',
    statement:
      'The amount disallowed by the 0.5% floor has no independent carryover. It survives only by increasing an excess already carried forward under another carryover rule, so in a year with no percentage-limit excess it is permanently lost.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(d)(1)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of any taxable year from which an excess is carried forward (determined without regard to this subparagraph) under any carryover rule, the applicable carryover rule shall be applied by increasing the excess determined under such applicable carryover rule for the contribution year (before the application of subparagraph (B)) by the amount attributable to the charitable contributions to which such rule applies which is not allowed as a deduction for the contribution year by reason of subsection (b)(1)(I).',
    }, {
      kind: 'legislativeHistory',
      citation: 'JCT, General Explanation of P.L. 119-21 (JCS-1-26)',
      url: 'https://www.jct.gov/publications/2026/s-1-26/',
      quotedText:
        'If a taxpayer has excess contributions in a taxable year, the taxpayer is permitted to carry forward the amount disallowed by the 0.5 percent floor.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
  },

  'irc-170-b-1-I-ii-category-waterfall': {
    title: 'Category order in which the 0.5% floor is absorbed',
    statement:
      'The floor is consumed against contribution categories in the fixed order (D), (C), (B), (E), (A), (G), so 60% cash gifts to public charities absorb it last. A single-category ledger must be told the floor already consumed by earlier categories.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(I)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'The preceding sentence shall be applied— (i) first, by taking into account charitable contributions to which subparagraph (D) applies to the extent thereof, (ii) second, ... subparagraph (C) ..., (iii) third, ... subparagraph (B) ..., (iv) fourth, ... subparagraph (E) ..., (v) fifth, ... subparagraph (A) ..., and (vi) sixth, by taking into account charitable contributions to which subparagraph (G) applies to the extent thereof.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
  },

  'irc-408-d-8-D-qcd-taxable-first': {
    title: 'A QCD is drawn from pre-tax dollars first',
    statement:
      'Notwithstanding section 72, a charitable distribution is deemed to consist of otherwise-includible dollars up to the aggregate pre-tax balance across all of the owner’s IRAs. The QCD therefore leaves the Form 8606 pro-rata denominator entirely and full basis survives for the year’s other distributions; only the portion exceeding aggregate pre-tax dollars is not a QCD and does receive basis.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(D)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Notwithstanding section 72, in determining the extent to which a distribution is a qualified charitable distribution, the entire amount of the distribution shall be treated as includible in gross income without regard to subparagraph (A) to the extent that such amount does not exceed the aggregate amount which would have been so includible if all amounts in all individual retirement plans of the individual were distributed during such taxable year and all such plans were treated as 1 contract for purposes of determining under section 72 the aggregate amount which would have been so includible. Proper adjustments shall be made in applying section 72 to other distributions in such taxable year and subsequent taxable years.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 590-B (2025), Are Distributions Taxable?',
      url: 'https://www.irs.gov/publications/p590b',
      quotedText:
        'The amount of the QCD is limited to the amount of the distribution that would otherwise be included in income. If your IRA includes nondeductible contributions, the distribution is first considered to be paid out of otherwise taxable income.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 8606 (2025), Line 7',
      url: 'https://www.irs.gov/pub/irs-pdf/i8606.pdf',
      quotedText: 'Don’t include any of the following on line 7 ... Qualified charitable distributions (QCDs).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts'],
  },

  'irc-408-d-8-includible-qcd-basis': {
    title: 'Basis treatment of a QCD that is only partly excludable',
    statement:
      'The portion of a QCD not excluded — because it exceeds the annual limit or was reduced by the post-70.5 deductible-contribution offset — remains a QCD, was already deemed pre-tax by 408(d)(8)(D), stays off Form 8606 line 7, and recovers no basis.',
    classification: 'unsettled',
    contraryReading:
      'The Form 1040 instructions direct the filer to enter "the part that is not a QCD" on line 4b and treat "QCD" as the capped amount, which would route the over-limit excess to Form 8606 line 7 and give it pro-rata basis. No regulation, ruling, or IRS example addresses a partly-excludable QCD from an IRA that also carries basis. The readings differ in current-year taxable income and in whether basis is consumed or preserved; the engine takes the statutory reading, which is also the conservative one.',
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(E)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Qualified charitable distributions which are not includible in gross income pursuant to subparagraph (A) shall not be taken into account in determining the deduction under section 170.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 1040 (2025), line 4a/4b Exception 3',
      url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf',
      quotedText:
        'If only part of the distribution is a QCD, enter the part that is not a QCD on line 4b unless Exception 2 applies to that part.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts'],
  },

  'irc-170-p-standard-deduction-carryover': {
    title: 'Carryover generated in a standard-deduction year',
    statement:
      'A year in which the taxpayer claims the 170(p) nonitemizer deduction still generates a five-year carryover, but only for contributions exceeding the percentage-of-contribution-base ceiling. The 170(p) dollar cap is not a carryover-generating limitation, so the slice between the cap and the ceiling is permanently lost.',
    classification: 'unsettled',
    contraryReading:
      'Practitioner literature states without qualification that unused 170(p) amounts do not carry forward, which read literally would deny a carryover even above the ceiling. That shorthand describes the 170(p) allowance itself rather than 170(d)(1), and no published source addresses the question either way. The supporting regulation still cites section 144, repealed in 1976, and no post-OBBBA authority applies it.',
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(d)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'In the case of an individual, if the amount of charitable contributions described in subsection (b)(1)(A) payment of which is made within a taxable year ... exceeds 50 percent of the taxpayer’s contribution base for such year, such excess shall be treated as a charitable contribution described in subsection (b)(1)(A) paid in each of the 5 succeeding taxable years in order of time.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.170A-10(a)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.170A-10',
      quotedText:
        'The carryover provisions apply with respect to contributions made during a taxable year in excess of the applicable percentage limitation even though the taxpayer elects under section 144 to take the standard deduction in that year instead of itemizing the deduction allowable in computing taxable income for that year.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(d)(1)(C)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'For purposes of this subparagraph, the term “carryover rule” means— (I) subparagraph (A) of this paragraph, (II) subparagraphs (C)(ii), (D)(ii), (E)(ii), and (G)(ii) of subsection (b)(1), and (III) the second sentence of subsection (b)(1)(B).',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/actions/annualQcdStandardSection170pLedger.ts'],
  },

  'irc-408-d-8-A-annual-qcd-limit': {
    title: 'Annual QCD exclusion limit',
    statement:
      'The aggregate amount of qualified charitable distributions excludable from gross income is $111,000 per taxpayer for 2026, indexed annually.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The aggregate amount of qualified charitable distributions that are not includible in gross income under section 408(d)(8)(A) is increased from $108,000 to $111,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-02',
    implementedBy: ['packages/engine/src/params/data/year2026.ts'],
  },
  // --- Registered 2026-08-03 from the WS1 rule-matrix audit ---------------

  'irc-408-d-8-B-ii-age-70-half': {
    title: 'Date a donor attains age 70.5 for QCD eligibility',
    statement:
      'QCD eligibility begins on the date six calendar months after the 70th anniversary of birth. The engine computes it as 846 calendar months from the birth date and clamps a nonexistent target day to the last day of that month.',
    classification: 'unsettled',
    contraryReading:
      'A two-step computation (70th anniversary, then six months) diverges from the one-step 846-month form for a 29 February birth, because the 70th anniversary of a leap-day birth never falls in a leap year. For a 1956-02-29 birth the defensible answers are 2026-08-28 (clamped anniversary plus six months), 2026-08-29 (one step), and 2026-09-01 (rolled anniversary plus six months): five days apart, with nothing selecting among them.',
    conventionRationale:
      'The six-calendar-months sentence survives, but only in a provision written for something else: T.D. 10001 removed it from Treas. Reg. 1.401(a)(9)-2 and it now sits in 1.401(a)(9)-6(g)(1)(iv), a defined-benefit actuarial-increase rule. It has also been dropped from current IRS publications and survives there only in Publication 575 (2019). So the convention is sourced, but not from any provision addressed to IRC 408(d)(8)(B)(ii). What no source resolves at any level is a month-end or leap-day birth: no IRS guidance, ruling, case, publication example, or practitioner source addresses what "six calendar months after" means when the target day does not exist. The month-end clamp is chosen because it matches 29 CFR 4000.43, the one federal regulation resolving this class of problem, and because it is the prevailing practitioner convention. That regulation governs PBGC filings under ERISA Title IV and the IRS has never adopted it here, so the clamp is an engineering convention and not a legal conclusion. It errs permissive: for an August 31 birth it falls up to three days before a roll-forward reading, and a QCD taken in that window would not be a QCD at all. The date is load-bearing twice, because the SECURE 1.0 offset in 408(d)(8)(A) also keys the sweep of section 219 deductions to it.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70 1/2.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(g)(1)(iv) (relocated from 1.401(a)(9)-2 A-3 by T.D. 10001)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-6',
      quotedText:
        'An employee attains age 70 1/2 as of the date six calendar months after the 70th anniversary of the employee’s birth.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS Publication 575 (2019)',
      url: 'https://www.irs.gov/pub/irs-prior/p575--2019.pdf',
      quotedText:
        'You reach age 70 1/2 on the date that is 6 calendar months after the date of your 70th birthday.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualQcdActionExecutionEvidence.ts'],
  },

  'irc-72-t-2-A-v-rule-of-55': {
    title: 'Rule of 55 separation test',
    statement:
      'The early-distribution penalty does not apply to an employer-plan distribution after separation from service, where the separation occurs in or after the calendar year the participant attains age 55, from the employer maintaining that plan, and the distribution follows the separation. It never applies to an IRA.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The calendar-year form of the test is IRS administrative position rather than statutory text: 72(t)(2)(A)(v) says only "after attainment of age 55", which read literally would require the participant to have turned 55 before separating. The calendar-year gloss comes from Notice 87-13 Q&A-20 and is restated in Publication 575, the Form 5329 instructions, and the IRS exceptions chart. The engine follows the IRS position.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(v)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'made to an employee after separation from service after attainment of age 55',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Subparagraphs (A)(v) and (C) of paragraph (2) shall not apply to distributions from an individual retirement plan.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 5329, exception 01',
      url: 'https://www.irs.gov/instructions/i5329',
      quotedText:
        'Qualified retirement plan distributions (does not apply to IRAs) you received after separation from service when the separation from service occurs in or after the year you reach age 55.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
  },

  'irc-72-t-6-simple-two-year-rate': {
    title: 'SIMPLE IRA 25 percent rate during the initial two-year period',
    statement:
      'A distribution from a SIMPLE IRA during the two-year period beginning when the individual first participated substitutes a 25 percent rate for the 10 percent rate in IRC 72(t)(1). It is a rate substitution and not an independent penalty gate, so every 72(t)(2) exception still applies first and zeroes the tax entirely.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(6)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'In the case of any amount received from a simple retirement account (within the meaning of section 408(p)) during the 2-year period beginning on the date such individual first participated in any qualified salary reduction arrangement maintained by the individual employer under section 408(p)(2), paragraph (1) shall be applied by substituting 25 percent for 10 percent.',
    }, {
      kind: 'irsPublication',
      citation: 'IRS SIMPLE IRA plan FAQs',
      url: 'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-simple-ira-plans',
      quotedText:
        'The 2-year period begins on the first day on which your employer deposits contributions in your SIMPLE IRA.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts'],
  },

  'irc-72-t-3-B-sepp-separation': {
    title: 'Employer-plan SEPP must begin after separation from service',
    statement:
      'A substantially equal periodic payment series from a 401(a) trust, 403(a) annuity plan, or 403(b) contract qualifies for the 72(t)(2)(A)(iv) exception only if it begins after the employee separates from service. The requirement does not reach IRAs, so an IRA SEPP may begin while the owner is still employed.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(3)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Paragraph (2)(A)(iv) shall not apply to any amount paid from a trust described in section 401(a) which is exempt from tax under section 501(a) or from a contract described in section 72(e)(5)(D)(ii) unless the series of payments begins after the employee separates from service.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
  },

  // --- Registered 2026-08-03 from the second research batch ---------------

  'irc-68-overall-itemized-limitation': {
    title: 'Overall limitation on itemized deductions',
    statement:
      'Itemized deductions otherwise allowable are reduced by exactly 2/37 of the lesser of those deductions or the excess of taxable income, computed without regard to section 68 and increased by those deductions, over the dollar amount at which the 37 percent bracket begins. It applies after every other limitation on an itemized deduction.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Publication 505 states the rate as 5.4 percent, which is a truncation of 2/37 (0.0540540...), not the rule. The engine computes the exact rational because the difference is roughly $5.41 per $100,000 of limitation base and this provision only bites at incomes where that is real money. Note also that the amended section has no exempt categories and no 80 percent cap, both features of the pre-2018 Pease rule, so logic ported from that era would carry forward carve-outs that no longer exist.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 68(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section68&num=0&edition=prelim',
      quotedText:
        'the amount of the itemized deductions otherwise allowable for the taxable year (determined without regard to this section) shall be reduced by 2/37 of the lesser of- (1) such amount of itemized deductions, or (2) so much of the taxable income of the taxpayer for the taxable year (determined without regard to this section and increased by such amount of itemized deductions) as exceeds the dollar amount at which the 37 percent rate bracket under section 1 begins with respect to the taxpayer.',
    }, {
      kind: 'statute',
      citation: 'IRC 68(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section68&num=0&edition=prelim',
      quotedText:
        'This section shall be applied after the application of any other limitation on the allowance of any itemized deduction.',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.01',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'For taxable years beginning in 2026 the 37 percent rate bracket begins at taxable income over $768,700 for married individuals filing joint returns and surviving spouses, $640,600 for heads of households and for unmarried individuals, and $384,350 for married individuals filing separate returns.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualSection68ItemizedDeduction.ts'],
  },

  'irc-170-b-1-G-cash-percentage-ceiling': {
    title: 'Sixty percent ceiling for cash gifts to public charities',
    statement:
      'Cash contributions to public charities are allowed up to 60 percent of the contribution base reduced by contributions already taken into account under 170(b)(1)(A), with the excess carried forward five years. It is a combined ceiling, not an independent bucket stacked on the 50 percent limit.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 170(b)(1)(G)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'any contribution of cash to an organization described in subparagraph (A) shall be allowed as a deduction under subsection (a) to the extent that the aggregate of such contributions does not exceed the excess of- (I) 60 percent of the taxpayer contribution base for the taxable year, over (II) the aggregate amount of contributions taken into account under subparagraph (A) for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 170(b)(1)(G)(iii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section170&num=0&edition=prelim',
      quotedText:
        'Contributions taken into account under this subparagraph shall not be taken into account under subparagraph (A). ... subparagraph (A) shall be applied by reducing (but not below zero) the contribution limitation allowed for the taxable year under such subparagraph by the aggregate contributions allowed under this subparagraph for such taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualQcdItemizedSection170Ledger.ts'],
  },

  'irc-72-t-2-A-i-age-59-half': {
    title: 'Age 59.5 exception to the early-distribution tax',
    statement:
      'The 10 percent additional tax does not apply to a distribution made on or after the date the individual attains age 59.5. The test is inclusive of that date and reaches both IRAs and employer plans, unlike the Rule of 55.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'No authority at any level defines when age 59.5 is attained: there is no section 1.72(t) regulation series, and the threshold appears throughout the regulations without ever being defined. The engine applies the six-calendar-months convention by analogy to Treas. Reg. 1.401(a)(9)-6(g)(1)(iv), which defines it for age 70.5 inside a defined-benefit provision addressed to something else. That analogy is universal industry practice but the IRS has never stated it for 59.5, and it carries the same unresolved month-end and leap-day edge as the age-70.5 rule - here against a 10 percent penalty rather than QCD eligibility.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'Distributions which are- (i) made on or after the date on which the employee attains age 59 1/2,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term employee includes any participant, and in the case of an individual retirement plan, the individual for whose benefit such plan was established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts'],
  },

  'irc-223-f-4-hsa-age-65-boundary': {
    title: 'Age-65 waiver of the HSA 20 percent additional tax',
    statement:
      'The 20 percent additional tax on a nonqualified HSA distribution is waived only for a distribution made after the date the account beneficiary attains age 65, so the exception begins the day after the 65th birthday and a distribution on the birthday itself still bears the tax. The waiver reaches only the additional tax; ordinary income inclusion under 223(f)(2) survives at any age.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
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
  },

  'irc-223-f-1-hsa-qualified-medical-exclusion': {
    title: 'Qualified medical HSA distributions are excluded from income',
    statement:
      'A distribution used exclusively to pay qualified medical expenses of an account beneficiary is not includible in gross income at all, so it is neither taxable nor exposed to the 20 percent additional tax. Only the nonqualified portion is includible.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
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
        'You will pay an additional 20% tax on distributions from your HSA that are not used for qualified medical expenses.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualHsaPenaltyEvaluation.ts'],
  },
  'irc-408-d-2-annual-pro-rata-basis': {
    title: 'Annual pro-rata basis recovery across all owned non-Roth IRAs',
    statement:
      'All of an individual owned traditional, SEP, and SIMPLE IRAs are treated as one contract and all distributions in a year as one distribution, so the nontaxable fraction is that year remaining basis over the December 31 value plus outstanding rollovers plus the year distributions plus conversions. It is computed once per year, not per distribution.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The exclusion of inherited IRAs from the owner pool has no authority above publication level. IRC 408(d)(2)(A) says "all individual retirement plans" without qualification, and an inherited IRA is one from which the beneficiary takes distributions; the separation rests on Publication 590-B and the Form 8606 instructions, neither of which binds. Roth separation, by contrast, is statutory under 408A(d)(4)(A). The engine follows the IRS position because it is uniform administrative practice and the literal reading has no practitioner following, but the asymmetry in authority is worth knowing. Note the pooling is per decedent, not merely owned versus inherited.',
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
        'Unless you are the decedent spouse and choose to treat the IRA as your own, you cannot combine this basis with any basis you have in your own traditional IRA(s).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraWithdrawalCharacter.ts'],
  },

  'treas-reg-1-408-8-b-3-rmd-first-dollars-out': {
    title: 'Distributions satisfy the RMD in the order they occur',
    statement:
      'Any amount distributed from an IRA during a year for which an RMD is required is treated as a required minimum distribution to the extent the year total has not already been satisfied. A QCD counts toward the RMD, but only against what remains unsatisfied when it occurs.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The consequence the engine must honour is derived rather than stated: because the RMD is satisfied in the order distributions actually occur, an ordinary withdrawal taken before a QCD in the same year irrevocably consumes RMD dollars, and the later QCD cannot retroactively displace it or make it nontaxable. No IRS pronouncement states that negative proposition directly; it follows from combining 1.408-8(b)(3) with 1.408-8(g)(1), and is uniform practitioner understanding. Note the annual-aggregation rule of 408(d)(2) does not extend here - that provision governs basis recovery under section 72, not RMD satisfaction, and an engine reasoning from it alone would wrongly conclude the ordering is irrelevant.',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'any amount distributed during a calendar year from an IRA of that IRA owner is treated as a required minimum distribution under section 401(a)(9) to the extent that the total required minimum distribution for the year under section 401(a)(9) from all of that IRA owner IRAs has not been satisfied.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(g)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'all amounts distributed from an IRA are taken into account in determining whether section 401(a)(9) is satisfied, regardless of whether the amount is includible in income. Thus, for example, a qualified charitable distribution made pursuant to section 408(d)(8) is taken into account.',
    }, {
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-42',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'The amount distributed in a qualified charitable distribution is an amount distributed from the IRA for purposes of sections 408(a)(6), 408(b)(3), and 408A(c)(5).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualQcdPhysicalExecution.ts'],
  },

  // --- Deliberately not modelled; the engine must fail closed -------------

  'irc-223-f-4-B-hsa-death-exception': {
    title: 'Death waives the HSA 20 percent additional tax',
    statement:
      'The 20 percent additional tax does not apply to a distribution made after the account beneficiary becomes disabled or dies. Not modelled: the engine carries disability evidence but holds no death fact, and death also ends the account HSA status under 223(f)(8), so treating it as merely waiving the 20 percent would understate the event.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
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
  },

  'irc-72-t-10-public-safety-early-age': {
    title: 'Age 50 or 25 years of service for qualified public safety employees',
    statement:
      'For a qualified public safety employee taking a governmental-plan distribution, and for an employee providing firefighting services from a 401(a) trust, 403(a) annuity plan, or 403(b) contract, the Rule of 55 substitutes age 50 or 25 years of service under the plan, whichever is earlier. Not modelled: the engine holds no public-safety or years-of-service fact, so such a distribution must fail closed through the other-exception attestation rather than be assessed against the age-55 threshold.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(10)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'In the case of a distribution to a qualified public safety employee from a governmental plan (within the meaning of section 414(d)) or a distribution from a plan described in clause (iii), (iv), or (vi) of section 402(c)(8)(B) to an employee who provides firefighting services, paragraph (2)(A)(v) shall be applied by substituting age 50 or 25 years of service under the plan, whichever is earlier, for age 55.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
  },

  'irc-72-t-4-sepp-modification-recapture': {
    title: 'Retroactive recapture when a SEPP series is modified',
    statement:
      'Modifying a SEPP series before the later of five years from the first payment or age 59.5 increases tax in the modification year by the tax that would have applied to every prior payment, plus interest for the deferral period. Not modelled: the engine reports a final penalty of zero for qualified SEPP payments and has no path to revise them, so a modification is outside the supported model rather than costless.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(4)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'the taxpayer tax for the 1st taxable year in which such modification occurs shall be increased by an amount, determined under regulations, equal to the tax which (but for paragraph (2)(A)(iv)) would have been imposed, plus interest for the deferral period.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/traditionalEmployerPlanPenaltyPrerequisite.ts'],
  },

  'irc-408-d-8-beneficiary-ira-source': {
    title: 'Inherited IRA as a QCD source',
    statement:
      'A beneficiary who has personally attained age 70.5 may make a QCD from an inherited IRA; the controlling fact is the beneficiary’s own age, not the decedent’s. Not modelled in v1: separate beneficiary basis history is required and is never borrowed from the donor’s own pool, so an inherited source is classification-only and non-actionable.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-37',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'The exclusion from gross income for qualified charitable distributions is available for distributions from an IRA maintained for the benefit of a beneficiary after the death of the IRA owner if the beneficiary has attained age 70 1/2 before the distribution is made.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(2)(i)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'IRAs for which the individual is the IRA owner are not aggregated with IRAs for which the individual is a beneficiary.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualQcdExecutionPrerequisite.ts'],
  },

  'irc-408-d-8-roth-ira-source': {
    title: 'Roth IRA as a QCD source',
    statement:
      'A QCD may legally be made from a Roth IRA, but only to the extent the distribution would otherwise be includible in gross income. Not modelled in v1: the engine cannot prove the Roth tax character that would make any part otherwise includible, so a Roth source is unsupported rather than refused.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2007-7, Q&A-36',
      url: 'https://www.irs.gov/pub/irs-drop/n-07-07.pdf',
      quotedText:
        'Generally, the exclusion for qualified charitable distributions is available for distributions from any type of IRA (including a Roth IRA described in section 408A and a deemed IRA described in section 408(q)) that is neither an ongoing SEP IRA described in section 408(k) nor an ongoing SIMPLE IRA described in section 408(p).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualQcdExecutionPrerequisite.ts'],
  },

  'irc-408-d-8-F-split-interest-sublimit': {
    title: 'One-time split-interest entity QCD sublimit',
    statement:
      'A one-time election permits QCDs to a split-interest entity up to $55,000 for 2026, counted within the $111,000 overall annual limit. Not modelled: the engine requires an affirmative attestation that the destination is not a split-interest entity and treats a known split-interest destination as unsupported.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'irsNotice',
      citation: 'IRS Notice 2025-67',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The amount of qualified charitable distributions made directly to a split-interest entity that are not includible in gross income under section 408(d)(8)(F)(i)(II) pursuant to a one-time election is increased from $54,000 to $55,000.',
    }, {
      kind: 'formInstruction',
      citation: 'Instructions for Form 1040 (2025), line 4a/4b Exception 3',
      url: 'https://www.irs.gov/pub/irs-pdf/i1040gi.pdf',
      quotedText:
        'Generally, your total QCDs for the year cannot be more than $108,000. This includes any amount (up to $54,000) of a one-time QCD to a split-interest entity (SIE).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/annualQcdExecutionPrerequisite.ts'],
  },

  'irc-408-d-3-C-ii-surviving-spouse-not-inherited': {
    title: 'A surviving spouse does not hold an inherited IRA',
    statement:
      'An IRA acquired by reason of death is treated as inherited only where the acquiring individual was not the surviving spouse of the decedent. A surviving spouse is therefore outside the inherited-IRA rules: the rollover and conversion bar of 408(d)(3)(C)(i) does not reach them, so Form 8606 line 8 can be non-zero for a spousal pool.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
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
  },

  'treas-reg-1-408-8-c-2-spousal-deemed-election': {
    title: 'Spousal deemed election on an undistributed post-death-year amount',
    statement:
      'A surviving spouse is deemed to have elected to treat the IRA as their own if an amount required to be distributed to them as beneficiary for a calendar year following the year of death is not distributed within the required time, or if a non-rollover contribution is made to the IRA. The election is not an act the spouse takes; it happens to them.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The regulation measures the trigger per calendar year, so an unobserved year is refused rather than assumed satisfied: an unobserved year is exactly the year in which the deemed election would have occurred.',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(c)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'Any amount in the IRA that would be required to be distributed to the surviving spouse as beneficiary under section 401(a)(9)(B) for a calendar year following the calendar year of the IRA owner’s death is not distributed within the time period required.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/beneficiarySpousalElectionStatus.ts'],
  },

  'treas-reg-1-408-8-c-3-spouse-treated-as-owner': {
    title: 'After the election the spouse is the owner for all Code purposes',
    statement:
      'Following an election under 1.408-8(c)(1) or a deemed election under (c)(2), the surviving spouse is the IRA owner for all purposes under the Code, section 72(t) expressly included. The zero additional-tax rate that IRC 72(t)(2)(A)(ii) gives a death beneficiary no longer applies, and the balance folds into the spouse’s own 408(d)(2) aggregation pool.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(c)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'Following an election described in paragraph (c)(1) of this section, the surviving spouse is considered the IRA owner for whose benefit the trust is maintained for all purposes under the Internal Revenue Code (including section 72(t)).',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'made to a beneficiary (or to the estate of the employee) on or after the death of the employee',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/actions/beneficiarySpousalElectionStatus.ts',
      'packages/engine/src/actions/beneficiaryTraditionalIraDeathPenalty.ts',
    ],
  },

  'rev-proc-2025-25-aca-applicable-percentage-2026': {
    title: 'ACA applicable percentage table for 2026',
    statement:
      'The premium tax credit applicable percentage runs 2.10 percent below 133 percent of the federal poverty line, then in bands opening at 3.14, 4.19, 6.60, 8.44 and 9.96 percent. The bands are stated as "at least X but less than Y", so 133 percent is a real step rather than a continuation of the 2.10 percent floor, and the schedule ends at "not more than 400 percent", making 400 inclusive.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine interpolates linearly between the published breakpoints. The revenue procedure gives an initial and a final percentage per band rather than a formula, and linear interpolation is the construction that reproduces both endpoints of every band.',
    authority: [{
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-25, section 3.01',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-25.pdf',
      quotedText:
        'Applicable Percentage Table for 2026. For taxable years beginning in calendar year 2026, the Applicable Percentage Table for purposes of section 36B(b)(3)(A)(i) and section 1.36B-3(g) is: Less than 133% -- 2.10% initial, 2.10% final; At least 133% but less than 150% -- 3.14% initial, 4.19% final; At least 150% but less than 200% -- 4.19% initial, 6.60% final; At least 200% but less than 250% -- 6.60% initial, 8.44% final; At least 250% but less than 300% -- 8.44% initial, 9.96% final; At least 300% but not more than 400% -- 9.96% initial, 9.96% final.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: 2026,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/aca.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'treas-reg-1-401-a-9-5-joint-life-spouse-sole-beneficiary': {
    title: 'Joint and Last Survivor Table needs a spouse more than 10 years younger',
    statement:
      'An owner lifetime RMD uses the Uniform Lifetime Table unless the sole beneficiary is a spouse more than 10 years younger, in which case the Joint and Last Survivor Table gives the applicable denominator. Exactly ten years younger is not enough: the test is strict, so that case stays on the Uniform table.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The regulation measures the age gap between individuals; the engine compares ages attained in the calendar year, which is the granularity the projection runs at and can differ from the exact gap by under a year around a birthday.',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If the employee’s surviving spouse who is more than 10 years younger than the employee is the employee’s sole beneficiary, then the applicable denominator is the joint and last survivor life expectancy for the employee and spouse determined using the Joint and Last Survivor Table in section 1.401(a)(9)-9(d).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/rmd/jointLifeTable.ts',
    ],
  },

  'treas-reg-1-408-8-e-4-i-year-of-death-proportionate-shortfall': {
    title: 'Year-of-death RMD shortfall is shared proportionately',
    statement:
      'Where the owner died before taking the calendar year total and the aggregated IRAs did not all carry identical beneficiary designations, each IRA must distribute a proportionate share of the shortfall based on its account balance. Draining one account before touching the next satisfies only the free-choice branch of (e)(1).',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine never models other beneficiaries designations, so it cannot observe whether (e)(4)(i) binds in a given year. It allocates proportionately unconditionally instead: where designations are identical, (e)(1) free choice permits any split including the proportionate one, so the proportionate split is correct under both branches while an account-order drain is correct under only one.',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(4)(i)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.408-8',
      quotedText:
        'each of the owner’s IRAs is subject to a requirement to distribute a proportionate share of the shortfall for the calendar year to a beneficiary of that IRA, with the proportions based on the account balances determined under paragraph (b)(2) of this section.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/beneficiaryTraditionalIraResidualRmdAllocation.ts'],
  },
  'irc-86-a-taxable-social-security-two-tier': {
    title: 'Social Security inclusion is two tiers with a capped carry',
    statement:
      'Below the base amount no benefit is included. Between the base and adjusted base amounts the inclusion is the lesser of half the benefits or half the excess over the base. Above the adjusted base amount it is the lesser of 85 percent of the benefits or 85 percent of the excess over the adjusted base plus the tier-one amount, and that carried tier-one amount is itself capped.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statute caps the carried amount at 4,500 dollars single and 6,000 joint. The engine computes half the spread between the base and adjusted base amounts instead, which equals those figures exactly -- 0.5 x (34,000 - 25,000) and 0.5 x (44,000 - 32,000) -- so the cap stays correct if the thresholds are ever re-indexed, rather than drifting from two hard-coded constants.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 86(a)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/86',
      quotedText:
        'the amount included in gross income under this section shall be equal to the lesser of - (A) the sum of - (i) 85 percent of such excess, plus (ii) the lesser of the amount determined under paragraph (1) or an amount equal to one-half of the difference between the adjusted base amount and the base amount of the taxpayer, or (B) 85 percent of the social security benefits received during the taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 86(b)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/86',
      quotedText:
        'adjusted gross income - (A) determined without regard to this section and sections 85(c), 135, 137, 221, 911, 931, and 933, and (B) increased by the amount of interest received or accrued by the taxpayer during the taxable year which is exempt from tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },

  'irc-1411-a-net-investment-income-tax': {
    title: 'Net investment income tax is the lesser of two amounts',
    statement:
      'The 3.8 percent tax applies to the lesser of net investment income for the year or the excess of modified adjusted gross income over the threshold amount. A taxpayer with large investment income but modified adjusted gross income barely over the threshold is taxed on the small excess, not on the investment income.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The thresholds are not indexed, so the record is static rather than annually indexed. The engine takes modified adjusted gross income to equal adjusted gross income here, which departs from 1411(d) where a taxpayer has excluded foreign earned income; that case is not modelled.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1411(a)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1411',
      quotedText:
        'In the case of an individual, there is hereby imposed (in addition to any other tax imposed by this subtitle) for each taxable year a tax equal to 3.8 percent of the lesser of - (A) net investment income for such taxable year, or (B) the excess (if any) of - (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 1411(b)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1411',
      quotedText:
        'The term threshold amount means - (1) in the case of a taxpayer making a joint return under section 6013 or a surviving spouse (as defined in section 2(a)), 250,000 dollars, (2) in the case of a married taxpayer (as defined in section 7703) filing a separate return, 1/2 of the dollar amount determined under paragraph (1), and (3) in any other case, 200,000 dollars.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-1211-b-capital-loss-ordinary-offset': {
    title: 'A net capital loss offsets ordinary income only up to 3,000 dollars',
    statement:
      'Losses from sales of capital assets are allowed against gains, plus the lower of 3,000 dollars or the excess of losses over gains. The rest is not lost; it carries forward under section 1212(b), so a large loss is deducted a little at a time rather than all at once.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statute sets 1,500 dollars for a married individual filing separately. The projection collapses every filing status to single or married-filing-jointly, so that case is out of scope rather than handled at half the cap. The 3,000 dollar figure has never been indexed since 1978.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1211(b)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1211',
      quotedText:
        'In the case of a taxpayer other than a corporation, losses from sales or exchanges of capital assets shall be allowed only to the extent of the gains from such sales or exchanges, plus (if such losses exceed such gains) the lower of - (1) 3,000 dollars (1,500 dollars in the case of a married individual filing a separate return), or (2) the excess of such losses over such gains.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

} as const satisfies Record<string, TaxRuleRecord>

export const TAX_RULE_REGISTRY = Object.freeze(registry)

export type TaxRuleId = keyof typeof TAX_RULE_REGISTRY

export const taxRuleIds = Object.freeze(
  Object.keys(TAX_RULE_REGISTRY).sort() as readonly TaxRuleId[],
)

export function taxRule(ruleId: TaxRuleId): Readonly<TaxRuleRecord> {
  return TAX_RULE_REGISTRY[ruleId]
}

/**
 * Rules due for re-verification, for the periodic research pass. `asOfIsoDate`
 * is supplied by the caller rather than read from the clock so the result is
 * deterministic and testable.
 */
export function taxRulesDueForVerification(
  asOfIsoDate: string,
  maximumAgeDaysByVolatility: Readonly<Record<TaxRuleVolatility, number>> = DEFAULT_REVERIFICATION_INTERVAL_DAYS,
): readonly TaxRuleId[] {
  // Validate the shape before parsing. Date.parse accepts implementation-defined
  // formats, so checking only for NaN would let a runtime-specific string
  // through and make the result depend on the host rather than the input.
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(asOfIsoDate)) {
    throw new RangeError('As-of date must be an ISO calendar date')
  }
  const asOf = Date.parse(`${asOfIsoDate}T00:00:00Z`)
  if (Number.isNaN(asOf)) throw new RangeError('As-of date must be an ISO calendar date')
  // A missing or non-finite interval would make every comparison false and
  // silently report the rule as never due, which is the one failure mode this
  // function must not have.
  for (const volatility of TAX_RULE_VOLATILITIES) {
    const interval = maximumAgeDaysByVolatility[volatility]
    if (!Number.isFinite(interval) || interval < 0) {
      throw new RangeError(`Re-verification interval for ${volatility} must be a non-negative number of days`)
    }
  }
  return taxRuleIds.filter((ruleId) => {
    // ruleId comes from taxRuleIds, which is derived from the registry keys,
    // so the lookup cannot miss.
    const rule = TAX_RULE_REGISTRY[ruleId]
    const verified = Date.parse(`${rule.verifiedOn}T00:00:00Z`)
    const ageDays = Math.floor((asOf - verified) / 86_400_000)
    return ageDays >= maximumAgeDaysByVolatility[rule.volatility]
  })
}

/**
 * How stale a rule may become before it must be re-researched. Rules awaiting
 * guidance move fastest because a single regulation would settle them; indexed
 * figures are checked each autumn against the COLA notice.
 */
export const DEFAULT_REVERIFICATION_INTERVAL_DAYS: Readonly<Record<TaxRuleVolatility, number>> =
  Object.freeze({
    awaitingGuidance: 90,
    annuallyIndexed: 120,
    sunsetting: 150,
    staticStatute: 365,
  })
