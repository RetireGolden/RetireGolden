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
      'The thresholds are not indexed, so the record is static rather than annually indexed. Modified adjusted gross income is built under 1411(d) rather than read off the adjusted gross income line; see irc-1411-d-modified-agi-foreign-exclusion-addback.',
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

  'irc-1-h-capital-gain-stacked-on-ordinary': {
    title: 'Net capital gain stacks on top of ordinary taxable income',
    statement:
      'The preferential rates apply to bands measured from where ordinary taxable income ends, not from zero. Ordinary income fills the lower brackets first and the net capital gain sits on top of it, so the same gain can be taxed at 0, 15 or 20 percent depending only on how much ordinary income precedes it.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statute frames the result as a ceiling -- the tax "shall not exceed" the sum of its components -- and enumerates the bands as offsets from the amount of taxable income otherwise taxed below 25 percent. The engine computes the bands directly from the ordinary taxable amount, which reaches the same figure for the rate schedule it models and is the reason the code carries no explicit 25 percent reference.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'If a taxpayer has a net capital gain for any taxable year, the tax imposed by this section for such taxable year shall not exceed the sum of - (A) a tax computed at the rates and in the same manner as if this subsection had not been enacted on the greater of - (i) taxable income reduced by the net capital gain; or (ii) the lesser of - (I) the amount of taxable income taxed at a rate below 25 percent; or (II) taxable income reduced by the adjusted net capital gain, (B) 0 percent of so much of the adjusted net capital gain (or, if less, taxable income) as does not exceed the excess (if any) of - (i) the amount of taxable income which would (without regard to this paragraph) be taxed at a rate below 25 percent, over (ii) the taxable income reduced by the adjusted net capital gain.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-55-a-amt-is-the-excess-over-regular-tax': {
    title: 'AMT is the excess of tentative minimum tax over regular tax',
    statement:
      'The tentative minimum tax is a two-layer schedule on the taxable excess, 26 percent to the breakpoint and 28 percent above it. What is actually owed is only the amount by which that exceeds the regular tax, so a taxpayer whose regular tax already exceeds the tentative amount owes no additional minimum tax at all.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Section 55(b)(1) states the breakpoint as 175,000 dollars and it is inflation-adjusted; the 2026 pack carries 244,500. The record is annually indexed for that reason, and the statutory figure should not be read as the current one.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 55(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/55',
      quotedText:
        'There is hereby imposed (in addition to any other tax imposed by this subtitle) a tax equal to the excess (if any) of - (1) the tentative minimum tax for the taxable year, over (2) the regular tax for the taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 55(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/55',
      quotedText:
        'the tentative minimum tax for the taxable year is the sum of - (I) 26 percent of so much of the taxable excess as does not exceed 175,000 dollars, plus (II) 28 percent of so much of the taxable excess as exceeds 175,000 dollars.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-55-d-exemption-phase-out-rate': {
    title: 'The AMT exemption phases out at 50 percent from 2026',
    statement:
      'The exemption is reduced, but not below zero, by 50 percent of the amount by which alternative minimum taxable income exceeds the phase-out threshold. The threshold is 500,000 dollars for an unmarried taxpayer and 1,000,000 dollars on a joint return, both indexed.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The 25 percent rate in the base text of section 55(d) is pre-2026 law. Pub. L. 119-21 substitutes 50 percent for taxable years beginning after 2025, which is why the pack carries a rate that disagrees with the unamended statute. Recording that substitution is the point of this rule: a reader checking the base text alone will conclude the pack is wrong.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 55(d)(4), as amended by Pub. L. 119-21',
      url: 'https://www.law.cornell.edu/uscode/text/26/55',
      quotedText:
        'In the case of any taxable year beginning after December 31, 2025, subparagraph (A) shall be applied by substituting 50 percent for 25 percent, and the threshold amount shall be 500,000 dollars (1,000,000 dollars in the case of a joint return), adjusted for inflation.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-223-f-4-B-hsa-disability-exception': {
    title: 'HSA disability waives the additional tax, not the inclusion',
    statement:
      'A distribution made after the account beneficiary becomes disabled within the meaning of section 72(m)(7) is not subject to the 20 percent additional tax. The distribution stays includible in gross income: subparagraph (A) increases the tax by 20 percent of the amount which is so includible, and the exception switches off that increase without touching the inclusion itself.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The section 223(f)(1) qualified-medical exclusion sits in the same subsection and does remove inclusion, which makes the two easy to conflate. Section 72(m)(7) also requires the individual to furnish proof in such form and manner as the Secretary may require, which is why the engine models this as dated attestation evidence rather than inferring disability from plan data.',
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
  },

  'irc-72-t-2-A-iii-disability-exception': {
    title: 'Disability waives the 10 percent additional tax, not the income',
    statement:
      'A distribution attributable to the individual being disabled is not subject to the 10 percent additional tax. Disabled means unable to engage in any substantial gainful activity by reason of a medically determinable impairment expected to result in death or to be of long-continued and indefinite duration. The distribution remains ordinary income; only the additional tax is waived.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statutory test is any substantial gainful activity, which is materially stricter than an occupation-specific disability determination of the kind a private policy uses. Section 72(m)(7) also requires the individual to furnish proof in such form and manner as the Secretary may require, which is why the engine takes a dated attestation with an evidence id rather than inferring disability from plan data.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(iii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'Paragraph (1) shall not apply to any of the following distributions: ... attributable to the employee\u2019s being disabled within the meaning of subsection (m)(7).',
    }, {
      kind: 'statute',
      citation: 'IRC 72(m)(7)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'an individual shall be considered to be disabled if he is unable to engage in any substantial gainful activity by reason of any medically determinable physical or mental impairment which can be expected to result in death or to be of long-continued and indefinite duration. An individual shall not be considered to be disabled unless he furnishes proof of the existence thereof in such form and manner as the Secretary may require.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts'],
  },

  'irc-408-d-8-A-post-70-half-deduction-offset': {
    title: 'Post-70.5 deductible IRA contributions reduce the excludable QCD',
    statement:
      'The excludable amount is reduced by the excess of the taxpayer aggregate section 219 deductions for all years ending on or after the date they attained age 70.5, over the aggregate reductions already made in earlier years. Netting off the prior reductions is what makes a given deduction dollar offset a QCD exactly once across a lifetime rather than in every subsequent year.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statute measures the offset against deductions allowed to the taxpayer, so it is an individual-level figure even on a joint return, and the engine tracks it per donor for that reason. The registered annual limit is likewise per taxpayer, which can read as though the two use different bases; they do not.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A), flush sentence',
      url: 'https://www.law.cornell.edu/uscode/text/26/408',
      quotedText:
        'The amount of distributions not includible in gross income by reason of the preceding sentence for a taxable year (determined without regard to this sentence) shall be reduced (but not below zero) by an amount equal to the excess of - (i) the aggregate amount of deductions allowed to the taxpayer under section 219 for all taxable years ending on or after the date the taxpayer attains age 70 1/2, over (ii) the aggregate amount of reductions under this sentence for all taxable years preceding the current taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/actions/annualQcdTaxCharacterPostPass.ts',
      'packages/engine/src/actions/annualQcdActionExecutionEvidence.ts',
    ],
  },

  'irc-401-a-9-C-v-applicable-age': {
    title: 'The RMD applicable age steps 72 to 73 to 75, never 74',
    statement:
      'An individual who attains age 72 after 2022 and age 73 before 2033 has an applicable age of 73. An individual who attains age 74 after 2032 has an applicable age of 75. Nobody has an applicable age of 74: the statute is written on attainment windows rather than a rising sequence, and 74 is skipped entirely.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine maps birth year to applicable age rather than restating the attainment windows, which is equivalent: a 1959 birth attains 73 in 2032, inside the window, while a 1960 birth attains 73 in 2033 and 74 in 2034, landing in the later rule. Expressing it by birth year is why no 74 appears anywhere in the code, and that absence is correct rather than a missing case.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(v)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'In the case of an individual who attains age 72 after December 31, 2022, and age 73 before January 1, 2033, the applicable age is 73. In the case of an individual who attains age 74 after December 31, 2032, the applicable age is 75.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/params/index.ts'],
  },

  'irc-63-f-additional-standard-deduction-aged': {
    title: 'The age-65 standard deduction addition is per qualifying person',
    statement:
      'A taxpayer is entitled to an additional amount for himself if he has attained age 65 before the close of the taxable year, and to a further additional amount for a spouse who has done the same. On a joint return with two qualifying people the addition is taken twice, not once for the household.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statute states 600 dollars, and 750 dollars for an unmarried individual who is not a surviving spouse; both are inflation-adjusted, and the 2026 pack carries 1,650 and 2,050. The test is attainment before the close of the taxable year, which the engine models as age attained in the calendar year -- equivalent except for a taxpayer born on January 1, whom the IRS treats as attaining age on the preceding December 31.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(f)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'The taxpayer shall be entitled to an additional amount of 600 dollars - (A) for himself if he has attained age 65 before the close of his taxable year, and (B) for the spouse of the taxpayer if the spouse has attained age 65 before the close of such taxable year and an additional exemption would be allowable to the taxpayer for such spouse.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(f)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'In the case of an individual who is not married and is not a surviving spouse, paragraphs (1) and (2) shall be applied by substituting 750 dollars for 600 dollars.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-72-t-1-additional-tax-on-includible-portion': {
    title: 'The 10 percent additional tax falls on the includible portion',
    statement:
      'The tax is increased by 10 percent of the portion of the distribution which is includible in gross income, not 10 percent of the amount distributed. Where nondeductible basis comes back with the distribution, the returned basis carries no additional tax because it is not includible.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The includible portion is whatever the annual section 408(d)(2) pro-rata calculation produces, so this rule sits downstream of the basis-recovery rule rather than restating it. That is also why the additional tax cannot be computed from the distribution alone.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer\u2019s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/actions/ownedNonRothIraPenaltyPrerequisite.ts'],
  },

  'usc-42-415-a-1-pia-bend-point-formula': {
    title: 'The PIA formula is marginal across two bend points',
    statement:
      'The primary insurance amount is 90 percent of average indexed monthly earnings up to the first bend point, plus 32 percent of the part between the first and second, plus 15 percent of the part above the second, rounded down to the nearest 10 cents. Each rate reaches only the earnings inside its own band.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The bend points are not fixed dollar figures. Section 415(a)(1)(B) sets them at 180 and 1,085 dollars for 1979 eligibility and re-derives them for every later year from the ratio of the national average wage index two years prior to the 1977 index, which is why the engine carries a table by eligibility year rather than a constant.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 415(a)(1)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/42/415',
      quotedText:
        '90 percent of the individual\u2019s average indexed monthly earnings to the extent that such earnings do not exceed the amount established for purposes of this clause by subparagraph (B), plus 32 percent of the individual\u2019s average indexed monthly earnings to the extent that such earnings exceed the amount established for purposes of the preceding clause and do not exceed the amount established for purposes of this clause by subparagraph (B), plus 15 percent of the individual\u2019s average indexed monthly earnings to the extent that such earnings exceed the amount established for purposes of the preceding clause.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/socialSecurity/piaFromEarnings.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
  },

  'cfr-20-404-410-early-retirement-reduction': {
    title: 'The early-claim reduction changes rate after 36 months',
    statement:
      'A retirement benefit claimed before full retirement age is reduced by 5/9 of 1 percent for each of the first 36 months of early entitlement and by 5/12 of 1 percent for each month beyond 36. The second rate is smaller, so the reduction slows rather than continuing at the initial pace.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine works in whole months before full retirement age and does not model the special rules for a benefit that is later recomputed, so the factor is a pure function of the month count.',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.410(a)',
      url: 'https://www.law.cornell.edu/cfr/text/20/404.410',
      quotedText:
        'The reduction is 5/9 of 1 percent for each of the first 36 months and 5/12 of 1 percent for each month in excess of 36.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/socialSecurity/benefitFactor.ts'],
  },

  'cfr-20-404-313-delayed-retirement-credit': {
    title: 'Delayed retirement credits accrue at 2/3 of 1 percent and stop at 70',
    statement:
      'A retirement benefit claimed after full retirement age is increased by 2/3 of 1 percent for each month of delay, beginning with the month full retirement age is attained and ending with the month age 70 is attained. Delaying past 70 earns nothing further.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The 2/3 of 1 percent rate applies to individuals born after 1 January 1943; earlier cohorts have lower rates that the engine does not model, because a person reaching full retirement age in a projected year is necessarily in the later group.',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.313',
      url: 'https://www.law.cornell.edu/cfr/text/20/404.313',
      quotedText:
        'You may earn delayed retirement credits beginning with the month you attain full retirement age and ending with the month you attain age 70. For individuals born after January 1, 1943, the credit is 2/3 of 1 percent for each month of delayed retirement.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/socialSecurity/benefitFactor.ts'],
  },

  'usc-42-416-l-retirement-age-schedule': {
    title: 'Retirement age keys on attaining age 62, not on birth year',
    statement:
      'Retirement age is 66 for an individual attaining early retirement age after 2004 and before 2017, 66 plus an age increase factor for one attaining it after 2016 and before 2022, and 67 for one attaining it after 2021. Early retirement age is 62 for an old-age benefit and 60 for a widow benefit, which is why survivors run a separate and earlier schedule.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Because the statute turns on attaining age 62 rather than on a birth year, the boundary moves for anyone born on 1 January: the Social Security Administration treats a person as attaining an age on the day before their birthday, so a 1 January 1960 birth attains 62 in 2021 and falls under the 66-plus-factor branch rather than the flat 67. The engine expresses this as an effective birth year of the prior calendar year.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/42/416',
      quotedText:
        '(C) with respect to an individual who attains early retirement age after December 31, 2004, and before January 1, 2017, 66 years of age, (D) with respect to an individual who attains early retirement age after December 31, 2016, and before January 1, 2022, 66 years of age plus the number of months in the age increase factor, (E) with respect to an individual who attains early retirement age after December 31, 2021, 67 years of age.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 416(l)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/42/416',
      quotedText:
        'The term early retirement age means age 62 in the case of an old-age, wife\u2019s, or husband\u2019s insurance benefit, and age 60 in the case of a widow\u2019s or widower\u2019s insurance benefit.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/socialSecurity/nra.ts'],
  },

  'usc-42-403-a-2-family-maximum-formula': {
    title: 'The family maximum is marginal across three bend points',
    statement:
      'The maximum family benefit is 150 percent of the primary insurance amount up to the first bend point, plus 272 percent of the part between the first and second, plus 134 percent of the part between the second and third, plus 175 percent of the part above the third, decreased to the next lower multiple of ten cents. Each rate reaches only the amount inside its own band.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The bend points here are not the ones used for the primary insurance amount itself; section 403(a)(2) has its own set, indexed separately, which is why the engine carries a second table rather than reusing the PIA bend points.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(a)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/42/403',
      quotedText:
        '150 percent of such individual\u2019s primary insurance amount to the extent that it does not exceed the amount established with respect to this subparagraph, plus 272 percent of such individual\u2019s primary insurance amount to the extent that it exceeds the amount established with respect to the preceding subparagraph but does not exceed the amount established with respect to this subparagraph, plus 134 percent of such individual\u2019s primary insurance amount to the extent that it exceeds the amount established with respect to the preceding subparagraph but does not exceed the amount established with respect to this subparagraph, plus 175 percent of such individual\u2019s primary insurance amount to the extent that it exceeds the amount established with respect to the preceding subparagraph. Any such amount that is not a multiple of 0.10 dollars shall be decreased to the next lower multiple of 0.10 dollars.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/socialSecurity/familyMaximum.ts',
      'packages/engine/src/socialSecurity/ssaWageData.ts',
    ],
  },

  'usc-42-403-f-3-retirement-earnings-test': {
    title: 'The earnings test withholds half the excess, a third in the FRA year',
    statement:
      'Benefits are reduced by 50 percent of earnings above the exempt amount for a beneficiary who is under full retirement age throughout the year, and by 33 and one-third percent of earnings above a higher exempt amount in the year full retirement age is attained. Both the rate and the exempt amount change in that year, so the two cases cannot be collapsed. The rate fixes the size of the deduction, not the amount paid out: section 403(b) makes the deduction from the payments the beneficiary is entitled to, so it stops at the benefits payable and never runs negative or reaches beyond the year’s benefit.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Withholding is applied annually against annual wages rather than month by month, and the withheld months are credited back at full retirement age through an adjustment-reduction-factor approximation. The statute operates on monthly benefits payable, so this is an annual-granularity convention rather than a reading of section 403(f). The cap at benefits payable is not part of that convention -- it is section 403(b) -- but it is worth naming here because it means a fixture whose wages are high enough for the cap to bind tests the cap rather than the 403(f)(3) rate.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 403(f)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/42/403',
      quotedText:
        'the deductions shall be equal to 33 1/3 percent of his earnings for such year in excess of the product in the case of an individual who has attained retirement age during such taxable year, and 50 percent of his earnings for such year in excess of such product in the case of any other individual.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 403(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/42/403',
      quotedText:
        'Deductions, in such amounts and at such time or times as the Commissioner of Social Security shall determine, shall be made from any payment or payments under this subchapter to which an individual is entitled, and from any payment or payments to which any other persons are entitled on the basis of such individual’s wages and self-employment income, until the total of such deductions equals such individual’s benefit or benefits under section 402 of this title for any month.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'usc-42-402-b-2-spousal-half-of-pia': {
    title: 'A spousal benefit is half the PIA and earns no delayed credits',
    statement:
      'The wife or husband insurance benefit is one-half of the worker primary insurance amount. Because it is measured against the PIA rather than against what the worker actually receives, a worker who delays past full retirement age raises their own benefit but not the spousal one, and the spouse gains nothing by claiming after their own full retirement age.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Section 402(b)(2) is expressly subject to subsection (q), which supplies the early-claim reduction. The engine applies a steeper schedule for the spousal case than for a retirement benefit -- 25/36 of 1 percent for the first 36 months rather than 5/9 -- and models the deemed-filing era only, assuming the worker has already filed so the spouse is eligible.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(b)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/42/402',
      quotedText:
        'such wife\u2019s insurance benefit for each month shall be equal to one-half of the primary insurance amount of her husband (or, in the case of a divorced wife, her former husband) for such month.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/socialSecurity/claimFactor.ts'],
  },

  'usc-42-402-e-2-widow-full-pia': {
    title: 'A widow benefit is the whole PIA, not half of it',
    statement:
      'The widow or widower insurance benefit is equal to the primary insurance amount of the deceased individual, that amount being the one determined after the subsection\u2019s own subparagraphs (B) and (C) have been applied. It is not the one-half fraction that applies to a spouse of a living worker, so the amount payable roughly doubles at the moment the relationship changes from spousal to survivor. The whole primary insurance amount is a floor on the survivor base rather than a ceiling on it: subparagraph (C) deems that amount to equal the delayed-retirement-increased old-age benefit the deceased was receiving where that benefit is larger, so a deceased who claimed late raises the survivor above the bare figure.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine computes the survivor base as the greater of what the deceased actually received and 82.5 percent of their primary insurance amount, then applies the survivor\u2019s own early-claim reduction to that base. Both halves of that maximum are statutory rather than invented: the first is the subparagraph (C) deeming, which carries the deceased\u2019s delayed retirement credits through, and the second is the widow limit of subparagraph (D), which binds only where the deceased had claimed early and been reduced under subsection (q). The ordering is the convention. Subparagraph (D) is drafted as a ceiling tested after the survivor\u2019s own subsection (q) reduction has been applied, whereas the engine takes the maximum first and reduces afterwards. The two agree wherever the survivor is unreduced; where the deceased and the survivor both claimed early the engine is the more conservative of the two.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/42/402',
      quotedText:
        'such widow\u2019s insurance benefit for each month shall be equal to the primary insurance amount (as determined for purposes of this subsection after application of subparagraphs (B) and (C)) of such deceased individual.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(C)',
      url: 'https://www.law.cornell.edu/uscode/text/42/402',
      quotedText:
        'If such deceased individual was (or upon application would have been) entitled to an old-age insurance benefit which was increased (or subject to being increased) on account of delayed retirement under the provisions of subsection (w), then, for purposes of this subsection, such individual\u2019s primary insurance amount, if less than the old-age insurance benefit (increased, where applicable, under paragraph (5) or (6) of section 415(f) of this title and under section 415(i) of this title as if such individual were still alive in the case of an individual who has died) which he was receiving (or would upon application have received) for the month prior to the month in which he died, shall be deemed to be equal to such old-age insurance benefit.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 402(e)(2)(D)',
      url: 'https://www.law.cornell.edu/uscode/text/42/402',
      quotedText:
        'If the deceased individual ... was, at any time, entitled to an old-age insurance benefit which was reduced by reason of the application of subsection (q), the widow\u2019s insurance benefit of such widow or surviving divorced wife for any month shall, if the amount of the widow\u2019s insurance benefit of such widow or surviving divorced wife (as determined under subparagraph (A) and after application of subsection (q)) is greater than\u2014(i) the amount of the old-age insurance benefit to which such deceased individual would have been entitled (after application of subsection (q)) for such month if such individual were still living ..., and (ii) 82\u00bd percent of the primary insurance amount (as determined without regard to subparagraph (C)) of such deceased individual; be reduced to the amount referred to in clause (i), or (if greater) the amount referred to in clause (ii).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/socialSecurity/survivorBenefit.ts'],
  },

  'usc-42-1395r-i-irmaa-applicable-percentage': {
    title: 'IRMAA raises the beneficiary share of cost from 25 percent',
    statement:
      'The standard Part B premium covers 25 percent of program cost. A high-income beneficiary pays 35, 50, 65, 80 or 85 percent of that cost instead, so the premium is the standard one scaled by the applicable percentage over 25 rather than the standard one plus that percentage. Income is taken from the second calendar year preceding the premium year.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statute expresses the result as an adjustment amount, the applicable percentage minus 25 percentage points; the engine computes the whole premium as the standard one times the applicable percentage over 25. Those are the same quantity written from different ends, which is why no explicit 25-point subtraction appears in the code.',
    authority: [{
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'the monthly adjustment amount specified in this paragraph for an individual for a month in a year is equal to the product of the following: (i) the applicable percentage minus 25 percentage points.',
    }, {
      kind: 'statute',
      citation: '42 U.S.C. 1395r(i)(4)',
      url: 'https://www.law.cornell.edu/uscode/text/42/1395r',
      quotedText:
        'the individual\u2019s modified adjusted gross income shall be such income determined for the individual\u2019s last taxable year beginning in the second calendar year preceding the year involved.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/medicare.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-36B-c-1-A-applicable-taxpayer-range': {
    title: 'The premium credit band includes both 100 and 400 percent',
    statement:
      'An applicable taxpayer is one whose household income equals or exceeds 100 percent of the federal poverty line and does not exceed 400 percent of it. Both ends are inclusive, so a household sitting exactly on 400 percent is still eligible and the cliff falls on the first dollar past it.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The enhanced credits that suspended the 400 percent ceiling expired at the end of 2025, so the cliff is live again for 2026. The engine also treats the below-100-percent exception pathways as out of scope rather than modelling them, which is why the floor is a hard cutoff here.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 36B(c)(1)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/36B',
      quotedText:
        'The term applicable taxpayer means, with respect to any taxable year, a taxpayer whose household income for the taxable year equals or exceeds 100 percent but does not exceed 400 percent of an amount equal to the poverty line for a family of the size involved.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/aca.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-223-b-3-hsa-catch-up-not-indexed': {
    title: 'The age-55 HSA catch-up is a flat 1,000 dollars and is not indexed',
    statement:
      'An eligible individual who has attained age 55 before the close of the taxable year may contribute an additional amount, which has been 1,000 dollars for 2009 and every year since. Section 223(g) indexes the subsection (b)(2) contribution limits and does not reach this amount, so it stays flat while the base limits grow.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The qualifying age is 55, which differs from the 50 used for elective deferrals and individual retirement accounts and from the 65 that ends the HSA additional tax. Nothing in the engine derives one from another, and the record exists partly so nobody later aligns them.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/26/223',
      quotedText:
        'In the case of an individual who has attained age 55 before the close of the taxable year, the applicable limitation under subparagraphs (A) and (B) of paragraph (2) shall be increased by 1,000 dollars for taxable years beginning in 2009 and thereafter.',
    }, {
      kind: 'statute',
      citation: 'IRC 223(g)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/223',
      quotedText:
        'Each dollar amount in subsections (b)(2), (c)(2)(A), and in the case of taxable years beginning after 2026, (c)(1)(E)(ii)(II) shall be increased by an amount equal to such dollar amount multiplied by the cost-of-living adjustment determined under section 1(f)(3).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-414-v-2-E-super-catch-up-window': {
    title: 'The higher catch-up covers ages 60 to 63 and stops at 64',
    statement:
      'A participant who would attain age 60 but would not attain age 64 before the close of the taxable year takes the adjusted dollar amount in place of the ordinary catch-up. The window closes at 64: a participant that age reverts to the ordinary age-50 catch-up rather than keeping the higher one. The adjusted dollar amount is the greater of 10,000 dollars and 150 percent of the catch-up in effect for 2024 — not 150 percent of the current year figure.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The two legs of 414(v)(2)(E)(i) are a 10,000 dollar amount and 150 percent of the 2024 amount, and the greater of them governs. That is why the 2026 figure is 11,250 rather than 150 percent of the current 8,000 catch-up, as IRS Notice 2025-67 confirms. Only the first leg moves: 414(v)(2)(C)(i) adjusts the (E) amounts for years after 2025 off a July 1 2024 base quarter, while the second leg is computed off a 2024 figure that will never change, so it is 11,250 forever. The engine therefore projects the indexed leg and takes the greater of it and the pack-year amount, rather than carrying the inflation factor onto the operative figure — Notice 2025-67 is the discriminating evidence, since it held the ages 60-63 amount flat for 2026 in the same year the ordinary catch-up rose from 7,500 to 8,000. Two simplifications remain. The engine projects the indexed leg on the smooth plan inflation path and does not apply the statutory rounding down to a multiple of 500, so the year the leg overtakes 11,250 can land early by up to a step. And the pack carries that leg at 10,000 for 2026, which is a derivation rather than a published figure: the IRS notices state only the operative amount, and one year of cost-of-living from the July 2024 base quarter falls well short of the 10,500 step. The age-55 HSA addition is registered separately because section 223(g) omits it from indexing entirely — the same shape of rule with a third answer again.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(2)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/414',
      quotedText:
        'In the case of an applicable employer plan other than a plan described in section 401(k)(11) or 408(p), the applicable dollar amount is $5,000 (the adjusted dollar amount, in the case of an eligible participant who would attain age 60 but would not attain age 64 before the close of the taxable year).',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(2)(E)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/414',
      quotedText:
        'For purposes of subparagraph (B), the adjusted dollar amount is - (i) in the case of clause (i) of subparagraph (B), the greater of - (I) $10,000, or (II) an amount equal to 150 percent of the dollar amount which would be in effect under such clause for 2024 for eligible participants not described in the parenthetical in such clause.',
    }, {
      kind: 'statute',
      citation: 'IRC 414(v)(2)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/414',
      quotedText:
        'In the case of a year beginning after December 31, 2025, the Secretary shall adjust annually the adjusted dollar amounts applicable under clauses (i) and (ii) of subparagraph (E) for increases in the cost-of-living at the same time and in the same manner as adjustments under the preceding sentence; except that the base period taken into account shall be the calendar quarter beginning July 1, 2024.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-415-c-1-annual-additions-lesser-of': {
    title: 'Annual additions are capped by pay as well as by the dollar limit',
    statement:
      'Contributions and other additions to a participant account may not exceed the lesser of the indexed dollar amount or 100 percent of the participant compensation. A participant paid less than the dollar limit is bound by their pay, so a generous match cannot push total additions above what they earned.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Section 415(c)(3) compensation is broader than wages, and the engine uses wages as the stand-in, so the pay prong binds slightly earlier here than under the statute. Annual additions under 415(c)(2) are employer contributions, employee contributions and forfeitures; the engine models the first two and has no concept of forfeitures.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 415(c)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/415',
      quotedText:
        'Contributions and other additions with respect to a participant exceed the limitation of this subsection if, when expressed as an annual addition to the participant\u2019s account, such annual addition is greater than the lesser of - (A) 40,000 dollars, or (B) 100 percent of the participant\u2019s compensation.',
    }, {
      kind: 'statute',
      citation: 'IRC 415(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/415',
      quotedText:
        'the term annual addition means the sum for any year of - (A) employer contributions, (B) the employee contributions, and (C) forfeitures.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-121-d-6-exclusion-cannot-reach-recapture': {
    title: 'The residence exclusion cannot reach depreciation recapture',
    statement:
      'Gain on a principal residence owned and used as such for two of the preceding five years is excluded up to 250,000 dollars, or 500,000 on a joint return. The exclusion does not apply to gain up to the depreciation adjustments attributable to periods after 6 May 1997, so recapture is carved out first and the cap then applies only to what remains.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine takes recapture as an input rather than deriving it from a depreciation schedule, and prices it at ordinary rates rather than the section 1250 25 percent maximum. Both are planning-grade stand-ins; the ordering that this rule fixes is not.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 121(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Gross income shall not include gain from the sale or exchange of property if, during the 5-year period ending on the date of the sale or exchange, such property has been owned and used by the taxpayer as the taxpayer\u2019s principal residence for periods aggregating 2 years or more.',
    }, {
      kind: 'statute',
      citation: 'IRC 121(d)(6)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Subsection (a) shall not apply to so much of the gain from the sale of any property as does not exceed the portion of the depreciation adjustments (as defined in section 1250(b)(3)) attributable to periods after May 6, 1997, in respect of such property.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'usc-31-3124-a-federal-obligations-state-exempt': {
    title: 'Interest on federal obligations is outside every state income tax base',
    statement:
      'Stocks and obligations of the United States Government are exempt from taxation by a State or its subdivisions, and the exemption reaches any form of taxation that would require the interest to be counted in computing a tax. Only a nondiscriminatory corporate franchise tax and an estate or inheritance tax are excepted, neither of which is a state income tax on an individual.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This is why the exemption is applied uniformly rather than per state pack: it is federal law binding every state, so no state entry can opt into taxing it. The engine subtracts the interest from the state base because it arrives inside ordinary income.',
    authority: [{
      kind: 'statute',
      citation: '31 U.S.C. 3124(a)',
      url: 'https://www.law.cornell.edu/uscode/text/31/3124',
      quotedText:
        'Stocks and obligations of the United States Government are exempt from taxation by a State or political subdivision of a State. The exemption applies to each form of taxation that would require the obligation, the interest on the obligation, or both, to be considered in computing a tax, except - (1) a nondiscriminatory franchise tax or another nonproperty tax instead of a franchise tax, imposed on a corporation; and (2) an estate or inheritance tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/stateTax.ts'],
  },

  'irc-402-g-1-elective-deferral-aggregate': {
    title: 'The elective deferral limit is per individual, not per plan',
    statement:
      'Elective deferrals of any individual for a taxable year are included in gross income to the extent they exceed the applicable dollar amount. The limit attaches to the individual and aggregates every arrangement they participate in, so holding two employer plans does not double the room.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Section 402(g)(3) counts 401(k), 403(b), SARSEP and SIMPLE deferrals in the same total. The engine groups by owner rather than by plan for exactly this reason, and does not model the separate 457(b) limit, which genuinely does sit alongside rather than inside this one.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 402(g)(1)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/402',
      quotedText:
        'Notwithstanding subsections (e)(3) and (h)(1)(B), the elective deferrals of any individual for any taxable year shall be included in such individual’s gross income to the extent the amount of such deferrals for the taxable year exceeds the applicable dollar amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 402(g)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/26/402',
      quotedText:
        'the term elective deferrals means, with respect to any taxable year, the sum of - (A) any employer contribution under a qualified cash or deferred arrangement (as defined in section 401(k)) to the extent not includible in gross income for the taxable year under subsection (e)(3).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },

  'irc-164-b-7-salt-cap-schedule': {
    title: 'The SALT cap is a schedule and reverts to 10,000 in 2030',
    statement:
      'The applicable limitation amount is 40,000 dollars for 2025 and 40,400 for 2026, then 101 percent of the preceding year through 2029, and 10,000 dollars for taxable years beginning in 2030 and after. It is a schedule written into the statute, not an inflation-indexed figure, and the 2030 step is a reversion rather than a continuation.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The cap is halved for a married individual filing separately, which the projection cannot express because it collapses every filing status to single or married-filing-jointly. The high-income phase-out that OBBBA also added is not modelled either, so the cap here binds later than it would for a taxpayer above that threshold.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 164(b)(6)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/164',
      quotedText:
        'the aggregate amount of taxes taken into account under paragraphs (1), (2), and (3) of subsection (a) and paragraph (5) of this subsection for any taxable year shall not exceed the applicable limitation amount (half the applicable limitation amount in the case of a married individual filing a separate return).',
    }, {
      kind: 'statute',
      citation: 'IRC 164(b)(7)',
      url: 'https://www.law.cornell.edu/uscode/text/26/164',
      quotedText:
        'the applicable limitation amount is 40,000 dollars for taxable years beginning in 2025, 40,400 dollars for taxable years beginning in 2026, 101 percent of the dollar amount in effect under this subparagraph for taxable years beginning in the preceding calendar year for taxable years beginning after 2026 and before 2030, and 10,000 dollars for taxable years beginning after 2029.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2025,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'irc-63-c-2-joint-standard-deduction-doubles': {
    title: 'The joint standard deduction is 200 percent of the unmarried one',
    statement:
      'The basic standard deduction for a joint return or a surviving spouse is 200 percent of the amount for any other case. The two figures are not independently set: the joint amount is defined in terms of the unmarried one, so they move together and the ratio between them is fixed at two.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Section 63(c)(2)(B) gives a head of household its own figure -- 23,625 dollars as substituted by (c)(7) -- which is neither the unmarried amount nor twice it. The projection collapses every filing status to single or married-filing-jointly, so that third figure is unreachable and the doubling holds across everything the engine can express.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'the basic standard deduction is - (A) 200 percent of the dollar amount in effect under subparagraph (C) for the taxable year in the case of - (i) a joint return, or (ii) a surviving spouse, (B) 4,400 dollars in the case of a head of household, or (C) 3,000 dollars in any other case.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(7)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'by substituting 23,625 dollars for 4,400 dollars in subparagraph (B), and by substituting 15,750 dollars for 3,000 dollars in subparagraph (C).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'irc-219-b-1-ira-limit-lesser-of-compensation': {
    title: 'An IRA contribution is capped by compensation, not only by the dollar limit',
    statement:
      'Section 219(b)(1) caps the amount for a taxable year at the lesser of the deductible amount or the compensation includible in the individual gross income for that year. A participant whose compensation is below the dollar limit is held to compensation, so the dollar limit alone is not the ceiling.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This is the same shape as the section 415(c) annual additions cap: a two prong lesser of where applying only the dollar prong silently overstates. The engine previously applied only the dollar prong here. Wages are the engine only compensation source, so the compensation prong reads from projected wages for the year.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      quotedText:
        'shall not exceed the lesser of - (A) the deductible amount, or (B) an amount equal to the compensation includible in the individual’s gross income for such taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-219-c-1-spousal-ira-combined-compensation': {
    title: 'A jointly filing couple funds both IRAs from combined compensation',
    statement:
      'Section 219(c) lets a married individual who files jointly, and whose own compensation is the lesser of the two, measure the limit against the combined compensation of both spouses, reduced by the contributions already made by the other spouse. The household ceiling is therefore combined compensation, while each spouse remains separately held to the dollar limit.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Two prongs pull in opposite directions and both must hold. Capping each spouse at their own wages alone would deny a non-earning spouse an IRA the statute plainly allows; pooling without a per-person dollar limit would let one spouse absorb the whole household ceiling. The engine models the pool only when the projected filing status is married filing jointly and both spouses are alive, since section 219(c)(2) conditions the rule on a joint return.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(c)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      quotedText:
        'shall be equal to the lesser of - (A) the dollar amount in effect under subsection (b)(1)(A) for the taxable year, or (B) the sum of - (i) the compensation includible in such individual’s gross income for the taxable year, plus (ii) the compensation includible in the gross income of such individual’s spouse for the taxable year reduced by ...',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-219-b-5-C-iii-ira-catch-up-indexed': {
    title: 'The age-50 IRA catch-up is indexed, unlike the HSA catch-up',
    statement:
      'Section 219(b)(5)(B) increases the deductible amount by 1,000 dollars for an individual who has attained age 50 before the close of the taxable year, and section 219(b)(5)(C)(iii) subjects that 1,000 dollars to a cost of living adjustment for taxable years beginning after 2023, with calendar year 2022 as the base.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Worth a record precisely because the neighbouring HSA catch-up under section 223(b)(3) is not indexed and must stay flat. The two look alike and behave differently, so the engine projects this one and holds the other. The indexing here was added by SECURE 2.0 section 108; before 2024 this amount was flat as well, which is why older secondary sources describe it that way.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(b)(5)(C)(iii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      quotedText:
        'In the case of any taxable year beginning in a calendar year after 2023, the 1,000 dollar amount under subparagraph (B)(ii) shall be increased by an amount equal to such dollar amount multiplied by the cost-of-living adjustment, determined by substituting calendar year 2022.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'irc-219-f-1-compensation-excludes-deferred-income': {
    title: 'Pension, annuity and deferred income are not compensation for IRA purposes',
    statement:
      'Section 219(f)(1) defines compensation to include earned income and to exclude any amount received as a pension or annuity or as deferred compensation. Retirement income therefore does not create IRA contribution room, so a person whose only income is a pension or Social Security has a compensation ceiling of zero.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This is what makes the compensation prong bite in a retirement projection. Most years in a plan have no wages at all, and a reading that counted any income as compensation would leave the section 219(b)(1) cap inert for exactly the span the projection is about.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 219(f)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/219',
      quotedText:
        'For purposes of this section, the term compensation includes earned income (as defined in section 401(c)(2)). The term compensation does not include any amount received as a pension or annuity and does not include any amount received as deferred compensation.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-408A-c-2-roth-shares-the-section-219-ceiling': {
    title: 'Roth and traditional IRA contributions share one annual ceiling',
    statement:
      'Section 408A(c)(2) limits aggregate contributions to all Roth IRAs to the maximum amount allowable as a deduction under section 219 reduced by contributions made for the same year to all other individual retirement plans. Holding both a traditional and a Roth IRA does not create a second ceiling.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine expresses this by putting traditional and Roth IRAs owned by the same person into a single annual limit group rather than by ordering one before the other. Ordering would matter if the two ceilings differed, and under this section they do not.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The aggregate amount of contributions for any taxable year to all Roth IRAs maintained for the benefit of an individual shall not exceed the excess (if any) of - (A) the maximum amount allowable as a deduction under section 219 with respect to such individual for such taxable year (computed without regard to subsection (g) of such section), over (B) the aggregate amount of contributions for such taxable year to all other individual retirement plans (other than Roth IRAs) maintained for the benefit of the individual.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-408A-c-3-roth-contribution-agi-phase-out': {
    title: 'The Roth contribution income phase-out is not modeled',
    statement:
      'Section 408A(c)(3) reduces the Roth contribution limit ratably once adjusted gross income, determined under 408A(c)(3)(B), exceeds an applicable dollar amount. The band is 15,000 dollars, but 10,000 dollars on a joint return or for a married individual filing separately, so a couple loses the contribution over a shorter run of income than a single filer does. The engine does not apply this reduction, so a projected Roth IRA contribution is allowed at any income level.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Recorded as an explicit gap rather than left silent, because the direction of the error is knowable: a high income household will show Roth contributions it could not actually make, and the overstatement grows with income. It is out of scope rather than settled because the reduction runs off adjusted gross income, which the projection computes after the contribution loop has already run.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(c)(3)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'shall not exceed an amount equal to the amount determined under paragraph (2)(A) for such taxable year, reduced (but not below zero) by the amount which bears the same ratio to such amount as - (i) the excess of - (I) the taxpayer’s adjusted gross income for such taxable year, over (II) the applicable dollar amount, bears to (ii) 15,000 dollars (10,000 dollars in the case of a joint return or a married individual filing a separate return).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-401-c-2-earned-income-not-modeled': {
    title: 'Self-employment earned income is not a modeled compensation source',
    statement:
      'Compensation under section 219(f)(1) includes earned income as defined in section 401(c)(2), which is net earnings from self-employment in a trade or business in which personal services are a material income producing factor. The engine models wages only, so a self-employed plan has no compensation and therefore no IRA contribution room.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'The direction of this gap is the opposite of the Roth phase-out gap: it understates rather than overstates, denying contribution room to a self-employed household that is entitled to it. It is recorded here so the section 219(b)(1) compensation prong is not read as complete. The engine income model has no self-employment stream to read from, so closing this needs a model change and not a calculation change.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(c)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term earned income means the net earnings from self-employment (as defined in section 1402(a)), but such net earnings shall be determined only with respect to a trade or business in which personal services of the taxpayer are a material income-producing factor.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-151-d-5-C-iii-I-senior-deduction-per-individual-phase-out': {
    title: 'The senior deduction phase-out reduces the per-individual amount',
    statement:
      'Clause (i) allows 6,000 dollars for each qualified individual, and clause (iii)(I) reduces the 6,000 dollar amount in clause (i) by 6 percent of modified adjusted gross income over 75,000 dollars, or 150,000 dollars on a joint return. The reduction lands on the per-individual amount, so it is taken once for each qualified individual rather than once against the combined total. A joint return with two spouses aged 65 or over therefore exhausts the deduction at 250,000 dollars of modified adjusted gross income, the same point a one-person joint return exhausts it, and not at 350,000 dollars.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning before January 1, 2029, there shall be allowed a deduction in an amount equal to 6,000 dollars for each qualified individual with respect to the taxpayer.',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(iii)(I)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'In the case of any taxpayer for any taxable year, the 6,000 dollar amount in clause (i) shall be reduced (but not below zero) by 6 percent of so much of the taxpayer’s modified adjusted gross income as exceeds 75,000 dollars (150,000 dollars in the case of a joint return).',
    }, {
      kind: 'formInstruction',
      citation: 'Schedule 1-A (Form 1040) (2025), Part V, lines 35 to 37',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf',
      quotedText:
        'Subtract line 34 from 6,000. If zero or less, enter -0- [line 35]. If you have a valid social security number and were born before January 2, 1961, enter the amount from line 35 [line 36a]. If you are married filing jointly, your spouse has a valid social security number, and your spouse was born before January 2, 1961, enter the amount from line 35 [line 36b]. Enhanced deduction for seniors. Add lines 36a and 36b [line 37].',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2026,
    effectiveThrough: 2028,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/strategies/optimizer.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'irc-56-b-1-D-section-151-deduction-disallowed-for-amt': {
    title: 'The senior deduction is a section 151 deduction disallowed for AMT',
    statement:
      'Section 56(b)(1)(D) disallows the standard deduction under section 63(c), the deduction for personal exemptions under section 151, and the deduction under section 642(b) in computing alternative minimum taxable income. The senior deduction is allowed by section 151(d)(5)(C), so it is added back whether or not the return elects to itemize. Only the section 63(c) standard deduction turns on that election.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Section 63(b) was never amended to give the senior deduction a paragraph of its own, so a taxpayer who does not itemize can reach it only through 63(b)(2), the deduction for personal exemptions provided in section 151. A reading under which that phrase does not carry the senior deduction would deny the deduction to every non-itemizer, so the parallel phrase in 56(b)(1)(D) has to carry it as well. Form 6251 line 1a confirms both the result and its unconditional scope: it removes Schedule 1-A line 37, the senior deduction alone and not the rest of that schedule, from total deductions with no itemized-or-standard branch.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 56(b)(1)(D)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section56&num=0&edition=prelim',
      quotedText:
        'Standard deduction and deduction for personal exemptions not allowed. The standard deduction under section 63(c), the deduction for personal exemptions under section 151, and the deduction under section 642(b) shall not be allowed.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(b)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who does not elect to itemize his deductions for the taxable year, for purposes of this subtitle, the term taxable income means adjusted gross income, minus - (1) the standard deduction, (2) the deduction for personal exemptions provided in section 151,',
    }, {
      kind: 'formInstruction',
      citation: 'Form 6251 (2025), lines 1a and 1b',
      url: 'https://www.irs.gov/pub/irs-pdf/f6251.pdf',
      quotedText:
        'Subtract Schedule 1-A (Form 1040), line 37, from Form 1040, 1040-SR, or 1040-NR, line 14 [line 1a]. Subtract line 1a from Form 1040, 1040-SR, or 1040-NR, line 11b (if less than zero, enter as a negative amount) [line 1b].',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-1411-d-modified-agi-foreign-exclusion-addback': {
    title: 'Modified adjusted gross income adds back excluded foreign income',
    statement:
      'Two limits in this engine run off modified adjusted gross income rather than adjusted gross income, and both define it as adjusted gross income increased by income the taxpayer excluded from gross income abroad. Section 1411(d) adds the section 911(a)(1) foreign earned income exclusion, net of the deductions section 911(d)(6) disallows, for the net investment income tax. Section 151(d)(5)(C)(iii)(II) adds any amount excluded under section 911, 931, or 933 for the senior deduction phase-out. Reading modified adjusted gross income as plain adjusted gross income understates the tax and overstates the deduction at the same time.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The two definitions are not identical: 1411(d) reaches only section 911 and nets out the deductions 911(d)(6) disallows, while 151(d)(5)(C)(iii)(II) reaches sections 911, 931, and 933 with no netting. The engine carries one excluded-foreign-income figure and applies it to both, which is the broader definition in both places. That same figure already feeds section 86 provisional income, where 86(b)(2)(A) likewise reaches 911, 931, and 933, so splitting the two would mean splitting an input the household reports as one number.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1411(d)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'For purposes of this chapter, the term modified adjusted gross income means adjusted gross income increased by the excess of - (1) the amount excluded from gross income under section 911(a)(1), over (2) the amount of any deductions (taken into account in computing adjusted gross income) or exclusions disallowed under section 911(d)(6) with respect to the amounts described in paragraph (1).',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(iii)(II)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section151&num=0&edition=prelim',
      quotedText:
        'For purposes of this clause, the term modified adjusted gross income means the adjusted gross income of the taxpayer for the taxable year increased by any amount excluded from gross income under section 911, 931, or 933.',
    }, {
      kind: 'formInstruction',
      citation: 'Schedule 1-A (Form 1040) (2025), Part I, lines 1 to 3',
      url: 'https://www.irs.gov/pub/irs-pdf/f1040s1a.pdf',
      quotedText:
        'Modified Adjusted Gross Income (MAGI) Amount. Enter the amount from Form 1040, 1040-SR, or 1040-NR, line 11b [line 1]. Enter any income from Puerto Rico that you excluded [line 2a]. Enter the amount from Form 2555, line 45 [line 2b]. Enter the amount from Form 2555, line 50 [line 2c]. Enter the amount from Form 4563, line 15 [line 2d]. Add lines 2a, 2b, 2c, and 2d [line 2e]. Add lines 1 and 2e [line 3].',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
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
