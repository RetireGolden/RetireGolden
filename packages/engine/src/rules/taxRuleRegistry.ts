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
  'irc-223-b-5-hsa-family-limit-divided-between-spouses': {
    title: 'Spouses share one family HSA limit but keep whole catch-ups',
    statement:
      'Where either spouse has family coverage, both spouses are treated as having that family coverage and the resulting family limit is divided equally between them unless they agree on a different division. Paragraph (5)(B) computes the amount to be divided without regard to the age-55 additional contribution amount, so the halving reaches only the base: each spouse adds a whole catch-up on top of half the family limit, not half a catch-up.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Two facts the statute turns on are absent from the plan model, and each is resolved toward the statutory default. The division by agreement under (5)(B)(ii) cannot be observed, so the engine takes the equal division the statute applies in its absence. Coverage election is likewise unmodelled: a two-person household is treated as having family coverage, which is already what selects the family base, and paragraph (5)(A) then makes that coverage apply to both spouses. Paragraph (5) opens on individuals who are married to each other, so the division is applied only where the two-person household is also a married one with both spouses living. Household size does not carry that fact by itself: the plan schema requires two people for a joint return but does not require a joint return of a two-person household, so an unmarried pair is representable. Each of them is then simply an eligible individual with family coverage under (b)(2)(B) whom paragraph (5) never reaches, and each keeps a whole family limit. A sole survivor keeps the undivided base for the same reason, having nobody left to divide with. The per-person contribution group key is retained rather than replaced by a household one precisely so the (b)(3) catch-up stays attached to the spouse who earned it.',
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
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
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

  // --- Registered 2026-08-03: account-eligibility rules and their proxies -----

  'irc-408-d-3-G-simple-two-year-rollover-bar': {
    title: 'SIMPLE IRA two-year bar on rollover and Roth conversion',
    statement:
      'A payment out of a SIMPLE IRA during the two-year period to which section 72(t)(6)(A) applies is denied rollover treatment unless it is paid into another SIMPLE IRA. A qualified rollover contribution to a Roth IRA must meet the requirements of section 408(d)(3), so inside that period a Roth conversion out of a SIMPLE IRA is barred outright rather than merely repriced, and the engine refuses the action instead of computing one.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This is not the rule already registered as irc-72-t-6-simple-two-year-rate, and neither record covers the other. That one is the rate substitution in 72(t)(6)(A): it prices a distribution the taxpayer is nonetheless permitted to take, and every 72(t)(2) exception still zeroes it. This one is the eligibility bar in 408(d)(3)(G): it makes the movement unavailable at all. They share a period and nothing else, so a distribution can sit inside the period, carry no additional tax because an exception applies, and still be ineligible for rollover or conversion. Reading either record as coverage of the other would leave a conversion the statute forbids being merely repriced at 25 percent. The period itself is measured as 24 calendar months from the participation start date using the month-end clamp in actions/civilDate.ts, and the comparison is strict, so a conversion dated on the 24-month anniversary is permitted and one dated the day before is refused. That follows from a 2-year period beginning on the participation date, which runs through the day before the anniversary.',
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
  },

  'treas-reg-1-408-8-e-1-i-aggregate-ira-rmd-sum': {
    title: 'The sum of separately calculated IRA RMDs must leave some IRA',
    statement:
      'The required minimum distribution is calculated separately for each IRA, but the sum of those separately calculated amounts may be distributed from any one or more of the IRAs. An IRA whose own balance cannot cover its calculated amount therefore leaves a shortfall that the other IRAs of the same owner must still distribute; it is not extinguished. Only IRAs the individual holds as owner aggregate, so an inherited IRA, a spouse IRA, and an employer plan each stand outside that sum.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Paragraph (e)(1)(i) leaves a living owner free to choose which IRAs the sum comes from, so the engine has to pick an order that the regulation permits but does not select. It sweeps an unmet amount across the remaining owned IRAs in plan account order, which is one of the permitted choices; no ordering here is more correct than another, and none of them changes the total distributed or its tax character. The proportionate allocation of 1.408-8(e)(4)(i) is deliberately not borrowed, because that paragraph governs the year-of-death shortfall passing to beneficiaries rather than a living owner free choice.',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(1)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Except as provided in paragraph (e)(1)(ii) of this section, the required minimum distribution must be calculated separately for each IRA and the sum of those separately calculated required minimum distributions may be distributed from any one or more of the IRAs under the rules set forth in this paragraph (e).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Generally, only amounts in IRAs that an individual holds as the IRA owner are aggregated for purposes of paragraph (e)(1) of this section. ... Thus, for example, for purposes of satisfying the minimum distribution requirements with respect to one IRA by making distributions from another IRA, IRAs for which the individual is the IRA owner are not aggregated with IRAs for which the individual is a beneficiary.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-6(b)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'Thus, in a year for which a minimum distribution is required (including the calendar year in which the individual attains age 70 1/2), an individual may not convert the assets of an IRA (or any portion of those assets) to a Roth IRA to the extent that the required minimum distribution for the traditional IRA for the year has not been distributed.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },

  'irc-401-a-9-H-designated-beneficiary-ten-year-rule': {
    title: 'SECURE Act ten-year rule for a designated beneficiary',
    statement:
      'Where an employee dies before the entire interest in a defined contribution plan has been distributed, a designated beneficiary who is not an eligible designated beneficiary must have the whole interest distributed within ten years of the death, and that deadline applies whether or not distributions had already begun. An inherited account therefore leaves the owner Uniform Lifetime schedule entirely rather than continuing it under a different divisor: it runs a separate forced-distribution clock from the death year, so the engine excludes it from the owner RMD pass and drives it from the ten-year deadline instead.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Two limits on how far this record reaches, stated so it is not read as covering more than it does. First, the engine treats every inherited account as held by a beneficiary who is not an eligible designated beneficiary, because the plan model carries no beneficiary category. A surviving spouse, a minor child of the employee, a disabled or chronically ill beneficiary, or a beneficiary not more than ten years younger than the decedent is entitled under 401(a)(9)(H)(ii) to the life-expectancy payout in (B)(iii), and will be shown a faster forced drawdown than the law requires. Second, the annual amount required in years one through nine when the decedent had reached the required beginning date is computed from the SSA period table in longevity/ssaPeriod2022.ts rather than the IRS Single Life Table. That divisor proxy is documented at the head of strategies/inheritedIra.ts and is a separate question from the ten-year deadline registered here.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(H)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'In the case of a defined contribution plan, if an employee dies before the distribution of the employee’s entire interest- (i) In general.-Except in the case of a beneficiary who is not a designated beneficiary, subparagraph (B)(ii)- (I) shall be applied by substituting "10 years" for "5 years", and (II) shall apply whether or not distributions of the employee’s interests have begun in accordance with subparagraph (A).',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section401&num=0&edition=prelim',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan provides that, if an employee dies before the distribution of the employee’s interest has begun in accordance with subparagraph (A)(ii), the entire interest of the employee will be distributed within 5 years after the death of such employee.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(a)(6)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section408&num=0&edition=prelim',
      quotedText:
        'Under regulations prescribed by the Secretary, rules similar to the rules of section 401(a)(9) and the incidental death benefit requirements of section 401(a) shall apply to the distribution of the entire interest of an individual for whose benefit the trust is maintained.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/accountEligibility.ts',
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },

  'irc-72-t-2-A-ii-death-beneficiary-exception': {
    title: 'Death exception to the early-distribution tax',
    statement:
      'The 10 percent additional tax does not apply to a distribution made to a beneficiary, or to the estate of the employee, on or after the death of the employee. The exception turns on the death and on nothing else, so neither the age of the decedent nor the age of the beneficiary enters it, and a distribution from an inherited account is penalty-free at any age.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine reads this exception off the inherited marker on the account rather than off the identity of the person receiving the distribution. Those are the same test only for so long as an account a surviving spouse has elected to treat as their own stops being marked inherited. That election is registered separately as irc-408-d-3-C-ii-surviving-spouse-not-inherited and treas-reg-1-408-8-c-3-spouse-treated-as-owner; once it is made the spouse takes distributions in their own right and 72(t) applies to them normally, so a plan that left the marker in place would waive a tax that is actually due.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraphs (3) and (4), paragraph (1) shall not apply to any of the following distributions: (A) In general Distributions which are- ... (ii) made to a beneficiary (or to the estate of the employee) on or after the death of the employee,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "employee" includes any participant, and in the case of an individual retirement plan, the individual for whose benefit such plan was established.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
  },

  'irc-72-t-2-A-i-age-59-half-annual-proxy': {
    title: 'Age 59.5 modelled as an annual attained-age-60 threshold',
    statement:
      'Section 72(t)(2)(A)(i) waives the 10 percent additional tax for a distribution made on or after the date the individual attains age 59.5, which is a date inside a calendar year. The need-based withdrawal path in strategies/accountEligibility.ts waives it instead from the first calendar year in which the owner attains age 60, so it is not modelling the statutory boundary and must not be presented as doing so.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'The direction of the error is knowable but it is not one-sided, and a reader who assumes it is will mis-state the exposure. Attained age here is the calendar-year age, the projection year minus the birth year, so the proxy waives from January 1 of the year the owner turns 60 while the statute waives from the date six calendar months after the 59th birthday. For a birthday in the first half of the year that statutory date falls in the preceding calendar year, so the proxy waives late and over-penalizes, by up to about six months at a January 1 birth. For a birthday in the second half it falls inside the same calendar year the proxy is already waiving, so the proxy waives early and under-penalizes, again by up to about six months at a December 31 birth. Only a July 1 birthday makes the two agree exactly. It is out of scope rather than settled because the annual projection carries an attained age and no distribution date, so there is no boundary to compare anything against. Two reachable paths therefore disagree about the same taxpayer: the exact-cent path in actions/ownedNonRothIraPenaltyPrerequisite.ts and actions/traditionalEmployerPlanPenaltyPrerequisite.ts computes the boundary as addCalendarMonths(dob, 714) with the month-end clamp and accepts equality, which is the reading registered as irc-72-t-2-A-i-age-59-half. Only that path is filing-relevant; a penalty figure produced from the annual proxy must not be reported as one.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Except as provided in paragraphs (3) and (4), paragraph (1) shall not apply to any of the following distributions: (A) In general Distributions which are- (i) made on or after the date on which the employee attains age 59½,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'If any taxpayer receives any amount from a qualified retirement plan (as defined in section 4974(c)), the taxpayer’s tax under this chapter for the taxable year in which such amount is received shall be increased by an amount equal to 10 percent of the portion of such amount which is includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
  },

  'irc-223-f-4-C-hsa-age-65-annual-proxy': {
    title: 'HSA age-65 waiver modelled as a whole attained-age year',
    statement:
      'Section 223(f)(4)(C) removes the 20 percent additional tax only for a payment or distribution after the date the account beneficiary attains age 65. The annual HSA path in strategies/accountEligibility.ts removes it for every distribution in the calendar year of attainment, including distributions taken months before the 65th birthday.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'This proxy errs in one direction only, which is the reason it is worth setting beside the age-59.5 proxy rather than dismissing the two together as a single rounding habit. Attained age here is the calendar-year age, the projection year minus the birth year, so the waiver switches on at January 1 of the year the account beneficiary turns 65 while the statute switches it on the day after the 65th birthday. The proxy is therefore never late and always early, so it under-penalizes: by one day at a January 1 birth, and by nearly a full year at a December 31 birth, where a non-qualified distribution taken in January bears nothing under the proxy and 20 percent of the includible amount under the statute. The age-59.5 proxy registered as irc-72-t-2-A-i-age-59-half-annual-proxy does not behave this way. The half-year offset there puts the statutory boundary on either side of the calendar boundary depending on the birth month, so that one errs both ways and is bounded by about six months each way, and assuming the two proxies share a sign gets the HSA exposure wrong. The exact-date reading is registered as irc-223-f-4-hsa-age-65-boundary and implemented in actions/annualHsaPenaltyEvaluation.ts, so here too two reachable paths disagree about the same account beneficiary and only the exact-date path is filing-relevant.',
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
  },

  'irc-72-t-2-A-v-rule-of-55-separation-proxy': {
    title: 'Rule of 55 modelled from the plan retirement age',
    statement:
      'Section 72(t)(2)(A)(v) waives the 10 percent tax on an employer-plan distribution made to an employee after separation from service after attainment of age 55, and reaches only the plan of the employer separated from. The annual path in strategies/accountEligibility.ts has no separation event and no employer identity: it waives the tax whenever the account is an employer plan, the plan retirement age is at least 55, and the owner attained age has reached that retirement age.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Unlike the two age proxies, this one errs in both directions and neither direction is bounded by a fixed number of months. It under-penalizes where the employer plan is one the owner left well before age 55, because the statute reaches only the plan maintained by the employer separated from and the code tests no employer identity at all: a 401(k) left behind at 40 is waived at the modelled retirement age like any other. It over-penalizes where the owner separates during the calendar year of attaining 55 but before the birthday, because the code compares a retirement age to 55 as a number, where the IRS calendar-year gloss recorded under irc-72-t-2-A-v-rule-of-55 asks only whether the separation fell in that year. It is out of scope rather than settled because the plan model carries a single household retirement age and no employment history, so no separation date and no employer for the plan exist to test. The engine does get the one structural limit right: 72(t)(3)(A) denies the exception to individual retirement plans, and the code waives only for an account of employer kind. The exact-date reading lives in actions/traditionalEmployerPlanPenaltyPrerequisite.ts.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(t)(2)(A)(v)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText: 'made to an employee after separation from service after attainment of age 55,',
    }, {
      kind: 'statute',
      citation: 'IRC 72(t)(3)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section72&num=0&edition=prelim',
      quotedText:
        'Subparagraphs (A)(v) and (C) of paragraph (2) shall not apply to distributions from an individual retirement plan.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/accountEligibility.ts'],
  },

  'irc-408A-d-2-roth-qualified-distribution': {
    title: 'Roth qualified distribution and the five-taxable-year period',
    statement:
      'A Roth distribution escapes gross income only if it is qualified, and that takes two things at once: one of the events in 408A(d)(2)(A), which are attaining age 59.5, death, disability, and a qualified special purpose distribution, and a distribution made after the 5-taxable year period beginning with the first taxable year for which the individual made any Roth IRA contribution. The engine tests one thing, whether attained age has reached 60, so it models neither the event date nor the five-year period.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Two independent errors sit under the single age test, and this record states both because neither covers the other. The five-taxable-year period is not modelled at all, and its absence under-taxes: a 62-year-old whose first Roth IRA was opened two years ago is shown tax-free earnings that the statute makes ordinary income and exposes to the 72(t) tax, which is exactly the case a conversion ladder started late in life produces. The attained-age-60 test is a second and separate error: it is the same annual proxy registered for the traditional path as irc-72-t-2-A-i-age-59-half-annual-proxy, appearing here as ROTH_QUALIFIED_AGE, and because attained age is the calendar-year age it runs both ways by up to about six months depending on the birth month rather than in a single direction. The five-year period cannot be recovered from account state the projection already holds, because 408A(d)(2)(B) runs it per individual from the first contribution to any Roth IRA rather than per account; closing this needs a household-level first-Roth-year fact, not a change to the withdrawal split. Until then nothing from this path is filing-grade on the taxability of Roth earnings.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The term “qualified distribution” means any payment or distribution- (i) made on or after the date on which the individual attains age 59½, (ii) made to a beneficiary (or to the estate of the individual) on or after the death of the individual, (iii) attributable to the individual’s being disabled (within the meaning of section 72(m)(7)), or (iv) which is a qualified special purpose distribution.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(2)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'A payment or distribution from a Roth IRA shall not be treated as a qualified distribution under subparagraph (A) if such payment or distribution is made within the 5-taxable year period beginning with the first taxable year for which the individual made a contribution to a Roth IRA (or such individual’s spouse, or employer in the case of a simple retirement account (as defined in section 408(p)) or simplified employee pension (as defined in section 408(k)), made a contribution to a Roth IRA) established for such individual.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText: 'Any qualified distribution from a Roth IRA shall not be includible in gross income.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/rothBasis.ts'],
  },

  'irc-408A-d-3-F-roth-conversion-recapture': {
    title: 'Five-year recapture on a conversion layer tapped early',
    statement:
      'Where a portion of a Roth distribution is properly allocable to a conversion and the distribution falls within the 5-taxable year period beginning with the taxable year of that conversion, section 72(t) applies as if that portion were includible in gross income, even though the conversion itself was not a taxable distribution and the portion is not taxed again. The recapture reaches only so much of the conversion as was includible in income at the time, so converted nondeductible basis recaptures nothing.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Each conversion runs its own clock, because 408A(d)(3)(F)(i)(II) begins the period with the taxable year of that contribution and not with the year the Roth was opened. That is why the layers are held separately and drawn oldest first, and it is why this record is distinct from the account-level five-year period in irc-408A-d-2-roth-qualified-distribution: one decides whether earnings are taxable, this one decides whether already-taxed conversion principal carries the additional tax. Two things about the surrounding code so this is not read as broader than it is. The period is counted in calendar years, which is exact for the calendar-year taxpayers the engine models and would not be for a fiscal-year taxpayer it does not. And the recapture lifts through the 72(t) exceptions themselves, so the 59.5 boundary applies to it; the engine uses its attained-age-60 proxy for that boundary, recorded under irc-408A-d-2-roth-qualified-distribution.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(F)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'If- (I) any portion of a distribution from a Roth IRA is properly allocable to a qualified rollover contribution described in this paragraph; and (II) such distribution is made within the 5-taxable year period beginning with the taxable year in which such contribution was made, then section 72(t) shall be applied as if such portion were includible in gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(F)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'Clause (i) shall apply only to the extent of the amount of the qualified rollover contribution includible in gross income under subparagraph (A)(i).',
    }, {
      kind: 'statute',
      citation: 'IRC 408A(d)(3)(C)',
      url: 'https://www.law.cornell.edu/uscode/text/26/408A',
      quotedText:
        'The conversion of an individual retirement plan (other than a Roth IRA) to a Roth IRA shall be treated for purposes of this paragraph as a distribution to which this paragraph applies.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/strategies/rothBasis.ts'],
  },
  'irc-1-j-2-progressive-ordinary-rate-schedule': {
    title: 'Ordinary rate schedule is marginal, and permanent after OBBBA',
    statement:
      'Tax on ordinary taxable income is the sum of each bracket rate applied only to the portion of taxable income falling inside that bracket, using the 1(j)(2) tables as annually adjusted. The schedule no longer expires: OBBBA struck the January 1, 2026 sunset from 1(j)(1), so the 10/12/22/24/32/35/37 structure is current law indefinitely.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Two things about the 2026 tables are easy to get wrong from memory. First, the 37 percent bracket begins at the same figure for unmarried individuals and for heads of household ($640,600), while the married-filing-separately table diverges from the unmarried table only at the top, at $384,350. Second, OBBBA gave the boundaries of the 10 and 12 percent brackets one extra year of indexing by confining the 2017-base substitution in 1(j)(3)(B)(i) to brackets above 12 percent, so those two thresholds move on a different base than the rest of the table. The engine models only unmarried and married-filing-jointly, mapping every other status onto one of the two.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(j)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'In the case of a taxable year beginning after December 31, 2017- (A) subsection (i) shall not apply, and (B) this section (other than subsection (i)) shall be applied as provided in paragraphs (2) through (6).',
    }, {
      kind: 'statute',
      citation: 'IRC 1(j)(2)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'The following table shall be applied in lieu of the table contained in subsection (c): ... Not over $9,525 ... 10% of taxable income. Over $9,525 but not over $38,700 ... $952.50, plus 12% of the excess over $9,525. ...',
    }, {
      kind: 'legislativeHistory',
      citation: 'Amendment note to IRC 1, P.L. 119-21 sec. 70101(a)(1), (b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'Subsec. (j)(1). ... struck out ", and before January 1, 2026" after "December 31, 2017" in introductory provisions. Subsec. (j)(3)(B)(i). ... inserted "solely for purposes of determining the dollar amounts at which any rate bracket higher than 12 percent ends and at which any rate bracket higher than 22 percent begins," before "subsection (f)(3)".',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.01, Table 3',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'For taxable years beginning in 2026, the tax rate tables under § 1 are as follows: ... Not over $12,400 ... 10% of the taxable income ... Over $12,400 but not over $50,400 ... $1,240 plus 12% of the excess over $12,400 ... Over $50,400 but not over $105,700 ... $5,800 plus 22% of the excess over $50,400 ... Over $640,600 ... $192,979.25 plus 37% of the excess over $640,600',
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
  'irc-1-j-3-B-rate-tables-adjusted-each-year': {
    title: 'The rate tables are re-prescribed every year, so a nominal projection must index them',
    statement:
      'For taxable years beginning after December 31, 2018 the Secretary prescribes rate tables that apply in lieu of the ones printed in section 1(j)(2), adjusted in the same manner as under section 1(f). The printed thresholds are therefore the figures for one year only. A projection that carries nominal income forward must carry the thresholds forward with it; holding a published year fixed measures inflated income against unadjusted brackets and creates bracket creep the statute does not.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The same reasoning reaches the other annually adjusted figures the federal engine reads, each under its own provision: the basic standard deduction under 63(c)(7)(B)(ii), the age-65 addition under 63(c)(4) (which indexes the dollar amounts in subsection (f)), the maximum zero-rate and maximum 15-percent capital gain amounts under 1(j)(5)(C), and the AMT exemption, its phase-out threshold and the 28 percent rate threshold under 55(d)(4)(B) and 55(d)(3)(B). Their base years differ -- 2016, 2017, 2024, 2025, 2011 -- and so do their rounding steps, but none of that survives into the projection: the pack figure has already absorbed every adjustment through the pack year, so carrying it forward is one multiplication for all of them. Two approximations remain and are deliberate. The index is the plan assumed general inflation rather than the C-CPI-U of 1(f)(3), and the statutory rounding to a multiple of 50 or 100 dollars is not reproduced -- the same two liberties limitScale already takes with the contribution limits. What must not be swept along are the figures with no indexing provision at all: the section 86 provisional-income thresholds, the section 1411 thresholds, the section 121 exclusion, the section 1211(b) ordinary offset and the section 151(d)(5)(C) senior deduction are unindexed by design, and the SALT cap follows the explicit 164(b)(7) schedule rather than an index. Scaling any of those would be the mirror-image defect.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(j)(3)(B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'For taxable years beginning after December 31, 2018, the Secretary shall prescribe tables which shall apply in lieu of the tables contained in paragraph (2) in the same manner as under paragraphs (1) and (2) of subsection (f) (applied without regard to clauses (i) and (ii) of subsection (f)(2)(A)), except that in prescribing such tables - (i) solely for purposes of determining the dollar amounts at which any rate bracket higher than 12 percent ends and at which any rate bracket higher than 22 percent begins, subsection (f)(3) shall be applied by substituting calendar year 2017 for calendar year 2016 in subparagraph (A)(ii) thereof.',
    }, {
      kind: 'statute',
      citation: 'IRC 1(j)(5)(C)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'In the case of any taxable year beginning after 2018, each of the dollar amounts in clauses (i) and (ii) of subparagraph (B) shall be increased by an amount equal to - (i) such dollar amount, multiplied by (ii) the cost-of-living adjustment determined under subsection (f)(3) for the calendar year in which the taxable year begins, determined by substituting calendar year 2017 for calendar year 2016 in subparagraph (A)(ii) thereof.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(7)(B)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'In the case of a taxable year beginning after 2025, the 23,625 dollar and 15,750 dollar amounts in subparagraph (A) shall each be increased by an amount equal to - (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, determined by substituting 2024 for 2016 in subparagraph (A)(ii) thereof.',
    }, {
      kind: 'statute',
      citation: 'IRC 55(d)(4)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/55',
      quotedText:
        'In the case of any taxable year beginning in a calendar year after 2018 (2026, in the case of the 1,000,000 dollar amount in subparagraph (A)(ii)(I)), the amounts described in clause (ii) shall each be increased by an amount equal to - (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/federalTax.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-151-d-5-C-senior-deduction-not-indexed': {
    title: 'The senior deduction is a flat 6,000 dollars that never grows',
    statement:
      'For a taxable year beginning before January 1, 2029 a deduction of 6,000 dollars is allowed for each qualified individual, reduced by 6 percent of modified adjusted gross income over 75,000 dollars (150,000 dollars on a joint return). No provision adjusts either figure for inflation: section 151(d)(4) indexes only the dollar amount in paragraph (1) and is expressly subordinated to paragraph (5), whose subparagraph (C) is where this deduction lives. The amount and the phase-out threshold both stay fixed for every year the deduction applies.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This record exists because of the change that produced it. The engine now carries the annually indexed federal figures forward past the published pack, and the senior deduction is the figure most likely to be swept into that projection by a later reader: it sits in the same pack object as the standard deduction, is claimed by the same taxpayers in the same years, and is the one deduction in the group that has no cost-of-living clause. Indexing the 6,000 dollars, or the 75,000 dollar threshold, would overstate the deduction in exactly the years a 65-plus household is deciding how much to convert. The fixed threshold also means the phase-out bites harder each year in a nominal projection, which is a real effect of the drafting and must be preserved rather than smoothed away. The expiry is modeled from the same subparagraph: taxable years beginning before January 1, 2029 makes 2028 the last applicable year.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/151',
      quotedText:
        'In the case of a taxable year beginning before January 1, 2029, there shall be allowed a deduction in an amount equal to 6,000 dollars for each qualified individual with respect to the taxpayer.',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(5)(C)(iii)(I)',
      url: 'https://www.law.cornell.edu/uscode/text/26/151',
      quotedText:
        'In the case of any taxpayer for any taxable year, the 6,000 dollar amount in clause (i) shall be reduced (but not below zero) by 6 percent of so much of the taxpayer modified adjusted gross income as exceeds 75,000 dollars (150,000 dollars in the case of a joint return).',
    }, {
      kind: 'statute',
      citation: 'IRC 151(d)(4)',
      url: 'https://www.law.cornell.edu/uscode/text/26/151',
      quotedText:
        'Except as provided in paragraph (5), in the case of any taxable year beginning in a calendar year after 1989, the dollar amount contained in paragraph (1) shall be increased by an amount equal to - (A) such dollar amount, multiplied by (B) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins.',
    }],
    volatility: 'sunsetting',
    effectiveFrom: 2025,
    effectiveThrough: 2028,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
  },
  'irc-1-h-11-qualified-dividends-as-net-capital-gain': {
    title: 'Qualified dividends are folded into net capital gain',
    statement:
      'For purposes of the preferential rate schedule, net capital gain means net capital gain increased by qualified dividend income. Qualified dividends therefore stack with long-term gain and are taxed at 0, 15, or 20 percent, even though they are ordinary gross income that enters AGI in full and is not itself a capital gain.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine carries qualified dividends as a separate input rather than as a slice of ordinary income, and adds them to AGI once. That matters because a qualified dividend is simultaneously ordinary income for AGI, provisional income, and NIIT modified AGI, and preferential income for the rate schedule. Note also that 1(h)(11)(B) and (C) impose holding-period and qualified-foreign-corporation tests the engine cannot verify: it takes the qualified character of the supplied figure on trust.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(11)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "net capital gain" means net capital gain (determined without regard to this paragraph) increased by qualified dividend income.',
    }, {
      kind: 'statute',
      citation: 'IRC 1(h)(11)(B)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1&num=0&edition=prelim',
      quotedText:
        'The term "qualified dividend income" means dividends received during the taxable year from- (I) domestic corporations, and (II) qualified foreign corporations.',
    }, {
      kind: 'irsNotice',
      citation: 'Rev. Proc. 2025-32, section 4.03',
      url: 'https://www.irs.gov/pub/irs-drop/rp-25-32.pdf',
      quotedText:
        'Maximum Capital Gains Rate (§ 1(h), § 1(j)(5)). For taxable years beginning in 2026, the maximum zero rate amounts and maximum 15 percent rate amounts under § 1(j)(5)(B), as adjusted for inflation, are as follows: ... All Other Individuals $49,450 ... $545,500',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-86-b-2-provisional-income-modified-agi': {
    title: 'What enters provisional income for taxing Social Security',
    statement:
      'The figure compared against the base amounts is modified adjusted gross income plus one-half of the benefits received, where modified AGI is AGI computed without regard to sections 85(c), 135, 137, 221, 911, 931, and 933 and increased by tax-exempt interest. Tax-exempt interest and excluded foreign earned income therefore raise the taxable share of benefits without ever entering AGI.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine adds back only the 911, 931, and 933 exclusions and tax-exempt interest. The other four add-backs in 86(b)(2)(A) are sections 85(c), 135, 137, and 221, which cover unemployment compensation, education savings bond interest, adoption assistance, and student loan interest. None can plausibly appear in a household this engine models alongside Social Security benefits, so omitting them is a scope decision rather than a reading of the statute. Note the base amounts in 86(c) carry no inflation adjustment and have not moved since 1983 and 1993, which is why the engine holds them as unindexed constants.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 86(b)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section86&num=0&edition=prelim',
      quotedText:
        'A taxpayer is described in this subsection if- (A) the sum of- (i) the modified adjusted gross income of the taxpayer for the taxable year, plus (ii) one-half of the social security benefits received during the taxable year, exceeds (B) the base amount.',
    }, {
      kind: 'statute',
      citation: 'IRC 86(b)(2)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section86&num=0&edition=prelim',
      quotedText:
        'For purposes of this subsection, the term "modified adjusted gross income" means adjusted gross income- (A) determined without regard to this section and sections 85(c), 135, 137, 221, 911, 931, and 933, and (B) increased by the amount of interest received or accrued by the taxpayer during the taxable year which is exempt from tax.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-63-b-e-itemize-election-and-section-151-additivity': {
    title: 'Itemizing is an election; the section 151 deduction is additive',
    statement:
      'No itemized deduction is allowed unless the individual elects to itemize, and the election replaces the standard deduction rather than supplementing it. The section 151 senior deduction sits outside that trade: 63(d)(2) excludes from the definition of itemized deductions anything listed in a paragraph of 63(b), and 63(b)(2) lists the section 151 deduction, so it is subtracted on top of whichever base the taxpayer uses.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Nothing in section 63 requires the election to be the one that minimises tax; the engine assumes the taxpayer elects to itemize exactly when the itemized total exceeds the standard deduction, and compares against the standard deduction alone because the senior deduction is common to both branches. That assumption can be wrong in two directions the engine does not explore. Itemizing state and local taxes creates an AMT add-back that the standard deduction branch also creates but at a different amount, so the larger deduction is not always the lower total tax. And because the senior deduction is not an itemized deduction, it also escapes the section 68 overall limitation, which only bites on the itemized side.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(e)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'Unless an individual makes an election under this subsection for the taxable year, no itemized deduction shall be allowed for the taxable year. For purposes of this subtitle, the determination of whether a deduction is allowable under this chapter shall be made without regard to the preceding sentence.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'In the case of an individual who does not elect to itemize his deductions for the taxable year, for purposes of this subtitle, the term "taxable income" means adjusted gross income, minus- (1) the standard deduction, (2) the deduction for personal exemptions provided in section 151, (3) any deduction provided in section 199A, (4) the deduction provided in section 170(p), ...',
    }, {
      kind: 'statute',
      citation: 'IRC 63(d)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section63&num=0&edition=prelim',
      quotedText:
        'For purposes of this subtitle, the term "itemized deductions" means the deductions allowable under this chapter other than- (1) the deductions allowable in arriving at adjusted gross income, and (2) any deduction referred to in any paragraph of subsection (b).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-67-h-miscellaneous-itemized-permanently-disallowed': {
    title: 'Miscellaneous itemized deductions are permanently disallowed',
    statement:
      'No miscellaneous itemized deduction is allowed for any taxable year beginning after December 31, 2017, with no expiry date. Miscellaneous itemized deductions are defined by exclusion in 67(b), so investment advisory fees, tax preparation fees, and safe deposit box rent are all disallowed while interest, taxes, casualty losses, charitable contributions, and medical expenses are not.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The provision moved. OBBBA added a new 67(g) defining educator expenses and redesignated the former 67(g) suspension as 67(h), while striking the January 1, 2026 expiry, so a citation to 67(g) now points at the wrong subsection. The engine builds its itemized total from state and local taxes, mortgage interest, and charitable gifts only, and offers no input channel for advisory or preparation fees. That absence is the correct answer rather than a gap, which is why this rule is registered as settled rather than out of scope.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 67(h)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText:
        'Notwithstanding subsection (a), no miscellaneous itemized deduction shall be allowed for any taxable year beginning after December 31, 2017.',
    }, {
      kind: 'statute',
      citation: 'IRC 67(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText:
        'For purposes of this section, the term "miscellaneous itemized deductions" means the itemized deductions other than- (1) the deduction under section 163 (relating to interest), (2) the deduction under section 164 (relating to taxes), (3) the deduction under section 165(a) for casualty or theft losses described in paragraph (2) or (3) of section 165(c) or for losses described in section 165(d), (4) the deductions under section 170 ... (5) the deduction under section 213 (relating to medical, dental, etc., expenses), ...',
    }, {
      kind: 'legislativeHistory',
      citation: 'Amendment note to IRC 67, P.L. 119-21 sec. 70110(a), (b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText:
        'Subsec. (g). ... added subsec. (g). Former subsec. (g) redesignated (h). ... substituted "beginning after 2017" for "2018 through 2025" in heading and struck out ", and before January 1, 2026" after "December 31, 2017" in text.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-56-b-1-A-ii-state-and-local-taxes-disallowed-for-amt': {
    title: 'Deducted state and local taxes are an AMT add-back',
    statement:
      'For AMT purposes no deduction is allowed for any tax described in paragraph (1), (2), or (3) of 164(a), which covers state and local income, real property, and personal property taxes, nor for any miscellaneous itemized deduction. Mortgage interest and charitable contributions are not add-backs, so an itemizing taxpayer adds back the state and local component only.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The add-back is the amount actually deducted, so the 164(b)(6) cap applies first and the AMT add-back is the capped figure rather than the taxes paid. Two refinements are unmodelled. 56(b)(1)(B) substitutes qualified housing interest for qualified residence interest, which can make part of a deducted mortgage interest amount an AMT add-back where the loan was not used to acquire, construct, or substantially improve the residence. And the final sentence of 56(b)(1)(A) preserves taxes allowable in computing adjusted gross income, which never arises in this engine because it deducts no above-the-line taxes.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 56(b)(1)(A)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section56&num=0&edition=prelim',
      quotedText:
        'No deduction shall be allowed- (i) for any miscellaneous itemized deduction (as defined in section 67(b)), or (ii) for any taxes described in paragraph (1), (2), or (3) of section 164(a) or clause (ii) of section 164(b)(5)(A). Clause (ii) shall not apply to any amount allowable in computing adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 56(b)(1)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section56&num=0&edition=prelim',
      quotedText:
        'In determining the amount allowable as a deduction for interest, subsections (d) and (h) of section 163 shall apply, except that- (i) in lieu of the exception under section 163(h)(2)(D), the term "personal interest" shall not include any qualified housing interest (as defined in subsection (e)), ...',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-55-b-3-amt-net-capital-gain-maximum-rate': {
    title: 'Preferential capital gain rates survive into the AMT',
    statement:
      'Tentative minimum tax computed under 55(b)(1)(A) may not exceed the amount produced by removing net capital gain from the taxable excess, taxing what remains at 26 and 28 percent, and taxing the adjusted net capital gain at 0, 15, and 20 percent using the same section 1(h) breakpoints as the regular tax. Long-term gain and qualified dividends are therefore never taxed at 26 or 28 percent, though they still enlarge alternative minimum taxable income and so can crowd out the exemption.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The engine stacks the AMT preferential income on top of the AMT ordinary excess and applies the regular-tax breakpoints to that stack, which is the Form 6251 Part III construction. Two layers of 55(b)(3) are not modelled anywhere in this engine: the 25 percent layer for unrecaptured section 1250 gain in subparagraph (E) and, in the regular tax, the 28 percent collectibles rate. Both would raise tax, so their absence understates it for a taxpayer holding depreciated real property or collectibles.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 55(b)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        'The amount determined under the first sentence of paragraph (1)(A) shall not exceed the sum of- (A) the amount determined under such first sentence computed at the rates and in the same manner as if this paragraph had not been enacted on the taxable excess reduced by the lesser of- (i) the net capital gain; or (ii) the sum of- (I) the adjusted net capital gain, plus (II) the unrecaptured section 1250 gain, plus (B) 0 percent of so much of the adjusted net capital gain (or, if less, taxable excess) as does not exceed an amount equal to the excess described in section 1(h)(1)(B), plus (C) 15 percent of the lesser of- (i) so much of the adjusted net capital gain (or, if less, taxable excess) as exceeds the amount on which tax is determined under subparagraph (B), or (ii) the excess described in section 1(h)(1)(C)(ii), plus (D) 20 percent of the adjusted net capital gain (or, if less, taxable excess) in excess of the sum of the amounts on which tax is determined under subparagraphs (B) and (C), plus (E) 25 percent of the amount of taxable excess in excess of the sum of the amounts on which tax is determined under the preceding subparagraphs of this paragraph.',
    }, {
      kind: 'statute',
      citation: 'IRC 55(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section55&num=0&edition=prelim',
      quotedText:
        'There is hereby imposed (in addition to any other tax imposed by this subtitle) a tax equal to the excess (if any) of- (1) the tentative minimum tax for the taxable year, over (2) the regular tax for the taxable year plus, in the case of an applicable corporation, the tax imposed by section 59A.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-1411-c-5-plan-distributions-excluded-from-nii': {
    title: 'Retirement plan distributions are not net investment income',
    statement:
      'Net investment income does not include any distribution from a plan or arrangement described in section 401(a), 403(a), 403(b), 408, 408A, or 457(b). A traditional IRA withdrawal, an RMD, or a Roth conversion therefore bears no net investment income tax itself, but it does raise modified adjusted gross income and can push other interest, dividends, and gains above the threshold.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This is the mechanism behind the most common NIIT surprise in retirement planning, and it only appears correctly if the two halves of 1411(a)(1) are kept separate: the distribution is absent from the net investment income leg and present in the modified AGI leg. The engine gets this right structurally by carrying plan distributions in ordinary income and building net investment income from a separate set of inputs. Note the exclusion is keyed to the type of plan, not to the character of the earnings inside it, so the investment return accumulated in an IRA never becomes net investment income.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 1411(c)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'The term "net investment income" shall not include any distribution from a plan or arrangement described in section 401(a), 403(a), 403(b), 408, 408A, or 457(b).',
    }, {
      kind: 'statute',
      citation: 'IRC 1411(a)(1)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section1411&num=0&edition=prelim',
      quotedText:
        'In the case of an individual, there is hereby imposed (in addition to any other tax imposed by this subtitle) for each taxable year a tax equal to 3.8 percent of the lesser of- (A) net investment income for such taxable year, or (B) the excess (if any) of- (i) the modified adjusted gross income for such taxable year, over (ii) the threshold amount.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-213-a-medical-expense-deduction': {
    title: 'Medical expense deduction above 7.5 percent of AGI',
    statement:
      'Unreimbursed expenses for medical care of the taxpayer, a spouse, or a dependent are deductible to the extent they exceed 7.5 percent of adjusted gross income, and they are not a miscellaneous itemized deduction, so 67(h) does not disallow them. Not modelled: the engine builds its itemized total from state and local taxes, mortgage interest, and charitable gifts alone and has no medical input, so a household with large unreimbursed medical costs has its itemized total understated by the full deductible amount and its tax overstated, which for a retiree in long-term care can be tens of thousands of dollars of deduction at a marginal rate of 22 to 32 percent.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'This is the highest-value omission in the itemized set for this engine audience, because the deduction is largest exactly when income is drawn down to pay care costs. It also interacts with the itemize election: a year of heavy medical spending can flip a household from the standard deduction to itemizing, which the engine cannot see, so the error is not confined to households that already itemize.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 213(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section213&num=0&edition=prelim',
      quotedText:
        'There shall be allowed as a deduction the expenses paid during the taxable year, not compensated for by insurance or otherwise, for medical care of the taxpayer, his spouse, or a dependent (as defined in section 152, determined without regard to subsections (b)(1), (b)(2), and (d)(1)(B) thereof), to the extent that such expenses exceed 7.5 percent of adjusted gross income.',
    }, {
      kind: 'statute',
      citation: 'IRC 67(b)(5)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section67&num=0&edition=prelim',
      quotedText: 'the deduction under section 213 (relating to medical, dental, etc., expenses),',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'irc-163-h-3-F-acquisition-indebtedness-limit': {
    title: 'Mortgage interest is limited to $750,000 of acquisition debt',
    statement:
      'Only interest on acquisition indebtedness is qualified residence interest, home equity indebtedness interest is disallowed outright, and the aggregate acquisition indebtedness taken into account may not exceed $750,000 ($375,000 for a separate return) for debt incurred after December 15, 2017. Not modelled: the engine deducts the supplied mortgage interest figure in full with no principal limit and no home-equity test, so a household with acquisition debt above the cap has its deduction overstated in proportion to the excess and its tax understated, up to 37 cents per dollar of disallowed interest.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'The error scales with the mortgage rather than with income: at $1.5 million of acquisition debt half the interest is disallowed, and a household paying $90,000 of interest would see $45,000 of deduction that does not exist. The grandfather in 163(h)(3)(F)(i)(IV) preserves the older $1,000,000 limit for debt incurred on or before December 15, 2017, so the engine cannot even apply a flat cap without knowing when the loan was taken out, which is why this is left unmodelled rather than approximated.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 163(h)(3)(F)(i)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'In the case of taxable years beginning after December 31, 2017- (I) Disallowance of home equity indebtedness interest Subparagraph (A)(ii) shall not apply. (II) Limitation on acquisition indebtedness Subparagraph (B)(ii) shall be applied by substituting "$750,000 ($375,000" for "$1,000,000 ($500,000".',
    }, {
      kind: 'statute',
      citation: 'IRC 163(h)(3)(B)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section163&num=0&edition=prelim',
      quotedText:
        'The aggregate amount treated as acquisition indebtedness for any period shall not exceed $1,000,000 ($500,000 in the case of a married individual filing a separate return).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/tax/federalTax.ts'],
  },
  'treas-reg-1-408-8-b-2-prior-december-31-balance': {
    title: 'RMD numerator is the prior December 31 balance',
    statement:
      'The required minimum distribution for a calendar year is computed on the IRA balance as of December 31 of the preceding calendar year, with no adjustment for contributions or distributions occurring after that date. A rebalance, an annuity purchase, or a withdrawal taken during the distribution year therefore does not reduce the amount required.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(b)(2)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'For purposes of determining the required minimum distribution from an IRA for any calendar year, the account balance of the IRA as of December 31 of the calendar year preceding the calendar year for which distributions are required to be made is substituted for the account balance of the employee under § 1.401(a)(9)-5(b). Except as provided in paragraph (d) of this section, no adjustments are made for contributions or distributions after that date.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(b)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'In the case of an individual account under a defined contribution plan, the benefit used in determining the required minimum distribution for a distribution calendar year is the account balance as of the last valuation date in the calendar year preceding that distribution calendar year (valuation calendar year) adjusted in accordance with this paragraph (b). For this purpose, all of an employee’s accounts under the plan are aggregated.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-5',
      quotedText:
        'However, the required minimum distribution amount will never exceed the entire account balance on the date of the distribution.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/rmd/rmd.ts',
    ],
  },
  'treas-reg-1-408A-4-a-6-rmd-precedes-conversion': {
    title: 'A required minimum distribution cannot be converted to a Roth IRA',
    statement:
      'In a year for which an RMD is required, the first dollars distributed from the IRA are the RMD, an RMD is not eligible for rollover, and so no amount may be converted until the whole RMD for that year has been distributed. The order in which the annual ledger runs RMDs before Roth conversions is required by the regulation, not chosen for convenience.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-6(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'No. In order to be eligible for a conversion, an amount first must be eligible to be rolled over. Section 408(d)(3) prohibits the rollover of a required minimum distribution. If a minimum distribution is required for a year with respect to an IRA, the first dollars distributed during that year are treated as consisting of the required minimum distribution until an amount equal to the required minimum distribution for that year has been distributed.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-6(c)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'If a required minimum distribution is contributed to a Roth IRA, it is treated as having been distributed, subject to the normal rules under section 408(d)(1) and (2), and then contributed as a regular contribution to a Roth IRA. The amount of the required minimum distribution is not a conversion contribution.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408A-4, A-7(a)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408A-4',
      quotedText:
        'Any amount that is converted to a Roth IRA is includible in gross income as a distribution according to the rules of section 408(d)(1) and (2) for the taxable year in which the amount is distributed or transferred from the traditional IRA. Thus, any portion of the distribution or transfer that is treated as a return of basis under section 408(d)(1) and (2) is not includible in gross income as a result of the conversion.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'treas-reg-1-401-a-9-2-b-2-v-applicable-age-1959': {
    title: 'Applicable age for an owner born in 1959',
    statement:
      'A person born in 1959 satisfies both prongs of the SECURE 2.0 applicable-age definition at once, so the statute names age 73 and age 75 for the same individual. The engine uses 73, following the proposed regulation that would fill the paragraph the final regulation left reserved.',
    classification: 'unsettled',
    contraryReading:
      'IRC 401(a)(9)(C)(v)(II) applies on its own terms to a 1959 birth, because such a person attains age 74 in 2033, after December 31, 2032. Read alone it makes the applicable age 75 and defers the first distribution calendar year by two years. Nothing in the enacted text resolves the overlap, Treas. Reg. 1.401(a)(9)-2(b)(2)(v) is reserved, and the only source choosing 73 is a notice of proposed rulemaking that has not been finalised. The two readings differ by two distribution calendar years of forced ordinary income for the whole 1959 cohort.',
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(v)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec401.htm',
      quotedText:
        'Applicable age.— (I) In the case of an individual who attains age 72 after December 31, 2022, and age 73 before January 1, 2033, the applicable age is 73. (II) In the case of an individual who attains age 74 after December 31, 2032, the applicable age is 75.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-2(b)(2)(iv), (v), (vi)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-2',
      quotedText:
        '(iv) Employees born in 1951 through 1958. In the case of an employee born on or after January 1, 1951, but before January 1, 1959, the applicable age is age 73; (v) [Reserved] (vi) Employees born after 1959. In the case of an employee born on or after January 1, 1960, the applicable age is age 75.',
    }, {
      kind: 'regulation',
      citation: 'Prop. Treas. Reg. 1.401(a)(9)-2(b)(2)(v), REG-103529-23, 89 FR 58644',
      url: 'https://www.govinfo.gov/content/pkg/FR-2024-07-19/html/2024-14543.htm',
      quotedText:
        '(v) Employees born in 1959. In the case of an employee born in 1959, the applicable age is age 73.',
    }],
    volatility: 'awaitingGuidance',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/rmd/rmd.ts',
    ],
  },
  'irc-408-d-8-B-ii-projection-annual-age-proxy': {
    title: 'Annual-ledger stand-in for the age 70.5 QCD date',
    statement:
      'QCD eligibility begins on the date the donor attains age 70.5, which the exact-cent path computes as 846 calendar months from birth. Not modelled in the annual ledger: it gates on the age attained in the calendar year being at least 71, so the whole of the year in which the donor actually crosses 70.5 is treated as ineligible.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Direction of error: uniformly restrictive, never permissive. A donor born in January attains 70.5 in July of the year the calendar age is 70 and is eligible from that July, but the ledger withholds eligibility until the following January, a delay of six months. A donor born in December attains 70.5 in June of the year the calendar age is 71, and the ledger grants eligibility from that January, five months early — but there is no QCD in that window under the ledger anyway, because the ledger also requires an RMD to exist and no RMD is due before the applicable age. Netting those, the ledger never treats an ineligible donor as eligible and delays a genuinely eligible donor by six to seventeen months, understating the QCD and overstating taxable income in the crossing year. The threshold date itself is the subject of the registered rule irc-408-d-8-B-ii-age-70-half, whose leap-day and month-end convention is an engineering decision; this record is only about the annual proxy layered on top of it. Both paths therefore disagree with each other, and only the exact-cent path is defensible to a preparer.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70½.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(g)(1)(iv)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'An employee attains age 70 1/2 as of the date six calendar months after the 70th anniversary of the employee’s birth.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-408-d-8-A-projection-rmd-conditioned-qcd': {
    title: 'Annual-ledger conditioning of a QCD on an existing RMD',
    statement:
      'A QCD is available from age 70.5 up to the annual per-taxpayer limit whether or not any required minimum distribution is due, and may exceed the required amount. Not modelled: the annual ledger makes a QCD conditional on a positive household RMD and then caps it at that RMD, so a donor between 70.5 and the applicable age makes no QCD at all and a donor past the applicable age can never give more than the required amount.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Direction of error: uniformly restrictive. Nothing in 408(d)(8) references section 401(a)(9); the interaction runs the other way, in that a QCD counts toward an RMD when one happens to be due. For a donor aged 70.5 through 72 the ledger reports zero exclusion where up to the full annual limit is available, overstating ordinary income by the whole intended gift. For an older donor with a small balance the cap binds at the required amount, which for a $200,000 IRA at age 75 is about $8,130 against a $111,000 statutory ceiling. The consequence is not confined to the gift year: dollars the ledger refuses to route out of the IRA stay in the pre-tax balance and inflate every later RMD. The offset in the second sentence of 408(d)(8)(A), which sweeps post-70.5 deductible IRA contributions against the exclusion, is likewise not applied in the annual ledger; that omission runs the other way and would reduce the exclusion.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year. The amount of distributions not includible in gross income by reason of the preceding sentence for a taxable year (determined without regard to this sentence) shall be reduced (but not below zero) by an amount equal to the excess of— (i) the aggregate amount of deductions allowed to the taxpayer under section 219 for all taxable years ending on or after the date the taxpayer attains age 70½, over (ii) the aggregate amount of reductions under this sentence for all taxable years preceding the current taxable year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(g)(1)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'all amounts distributed from an IRA are taken into account in determining whether section 401(a)(9) is satisfied, regardless of whether the amount is includible in income. Thus, for example, a qualified charitable distribution made pursuant to section 408(d)(8) is taken into account in determining whether section 401(a)(9) is satisfied.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-408-d-8-A-projection-household-qcd-aggregation': {
    title: 'Annual-ledger substitution of the household for the individual donor',
    statement:
      'The QCD exclusion limit runs per taxpayer, eligibility turns on the age of the individual for whose benefit the plan is maintained, and IRA required distributions are aggregated only within one individual own IRAs. Not modelled: the annual ledger asks only whether any living member of the household is old enough, pools both spouses required distributions into a single figure, and applies one annual dollar limit to that pooled figure.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Direction of error: permissive in three separate ways, each of which lets the ledger exclude dollars a return could not. First, a household with one spouse aged 71 and one aged 66 passes the eligibility gate on the elder, then funds the gift out of a pool that includes the younger spouse distributions, which cannot be a QCD from anyone. Second, one annual limit is applied where a married couple has two, so a couple giving more than the single limit from genuinely separate IRAs is understated. Third, since required distributions never aggregate across spouses, the pooled figure has no counterpart in the regulation at all. The engine holds enough facts to do this per donor: every account carries an owner and every person carries a date of birth. The substitution is not forced by missing data.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(A)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'So much of the aggregate amount of qualified charitable distributions with respect to a taxpayer made during any taxable year which does not exceed $100,000 shall not be includible in gross income of such taxpayer for such taxable year.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B)(ii)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'which is made on or after the date that the individual for whose benefit the plan is maintained has attained age 70½.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.408-8(e)(2)(i)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.408-8',
      quotedText:
        'Generally, only amounts in IRAs that an individual holds as the IRA owner are aggregated for purposes of paragraph (e)(1) of this section.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-408-d-8-D-projection-qcd-after-pro-rata': {
    title: 'Annual-ledger ordering of the QCD against pro-rata basis recovery',
    statement:
      'A QCD is deemed to consist of otherwise-includible dollars up to the aggregate pre-tax balance, so it leaves the section 72 pro-rata computation entirely and the whole of the year basis remains available to the other distributions. Not modelled: the annual ledger applies pro-rata basis recovery to the entire required distribution first, including the part later routed to charity, and then subtracts the QCD in full from ordinary income.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Direction of error: understates current-year ordinary income and overconsumes basis, and the two are equal and opposite over time. On a $10,000 required distribution from an IRA that is 20 percent basis, with a $5,000 QCD, the statute excludes the $5,000 in full and applies the 20 percent to the remaining $5,000, giving $4,000 of income and $1,000 of basis used. The ledger applies the 20 percent to all $10,000, giving $3,000 of income and $2,000 of basis used. Income in the gift year is understated by $1,000 and the extra $1,000 of basis consumed will show up as $1,000 of additional taxable income in a later year. The comment at the subtraction site already records that the ledger is planning-grade here. The registered rule irc-408-d-8-D-qcd-taxable-first states the correct treatment and is implemented in the exact-cent path, so the two paths return different numbers for the same household.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 408(d)(8)(D)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'Notwithstanding section 72, in determining the extent to which a distribution is a qualified charitable distribution, the entire amount of the distribution shall be treated as includible in gross income without regard to subparagraph (A) to the extent that such amount does not exceed the aggregate amount which would have been so includible if all amounts in all individual retirement plans of the individual were distributed during such taxable year and all such plans were treated as 1 contract for purposes of determining under section 72 the aggregate amount which would have been so includible. Proper adjustments shall be made in applying section 72 to other distributions in such taxable year and subsequent taxable years.',
    }, {
      kind: 'statute',
      citation: 'IRC 408(d)(8)(B), flush text',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapD-partI-subpartA-sec408.htm',
      quotedText:
        'A distribution shall be treated as a qualified charitable distribution only to the extent that the distribution would be includible in gross income without regard to subparagraph (A).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'irc-223-b-5-A-projection-spousal-family-limit': {
    title: 'One family HSA limit divided between spouses',
    statement:
      'Where either spouse has family coverage, both spouses are treated as having only that family coverage and the single family limit is divided equally between them unless they agree otherwise, with each spouse own age 55 catch-up added outside the division. Not modelled: the annual ledger tracks the contribution limit per account owner and gives every owner in a two-person household the full family limit.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale:
      'Direction of error: permissive, by up to a full family limit. Two spouses each holding an HSA are each allowed the whole family maximum, so the household can contribute roughly twice what the statute permits, and the excess is deducted rather than taxed and charged the section 4973 excise. The catch-up handling is correct by accident, since paragraph (b)(5)(B) excludes the additional contribution amount from the division and the ledger already tracks it per owner. Two further approximations sit underneath: household size is read from the number of people on the plan rather than from actual coverage, so a two-person household is always given the family base even when only self-only coverage exists, and the monthly proration of 223(b)(1) and the Medicare-entitlement zeroing of 223(b)(7) are not applied at all.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 223(b)(5)',
      url: 'https://www.govinfo.gov/content/pkg/USCODE-2024-title26/html/USCODE-2024-title26-subtitleA-chap1-subchapB-partVII-sec223.htm',
      quotedText:
        'In the case of individuals who are married to each other, if either spouse has family coverage— (A) both spouses shall be treated as having only such family coverage (and if such spouses each have family coverage under different plans, as having the family coverage with the lowest annual deductible), and (B) the limitation under paragraph (1) (after the application of subparagraph (A) and without regard to any additional contribution amount under paragraph (3))— (i) shall be reduced by the aggregate amount paid to Archer MSAs of such spouses for the taxable year, and (ii) after such reduction, shall be divided equally between them unless they agree on a different division.',
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
    verifiedOn: '2026-08-03',
    implementedBy: ['packages/engine/src/projection/simulate.ts'],
  },
  'treas-reg-1-401-a-9-9-c-uniform-lifetime-table': {
    title: 'Uniform Lifetime Table denominator for a lifetime required minimum distribution',
    statement:
      'The lifetime required minimum distribution is the prior year-end account balance divided by the Uniform Lifetime Table denominator for the age the employee attains on the birthday falling in that distribution calendar year, not the age at the start of the year and not the age at the distribution date. The table in force runs from age 72 at 27.4 to age 120 and over at 2.0 and governs distribution calendar years beginning on or after 1 January 2022; the table it replaced is a different set of numbers at every age.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(c)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'the applicable denominator for required minimum distributions for each distribution calendar year beginning with the employee\'s first distribution calendar year ... is determined using the Uniform Lifetime Table in § 1.401(a)(9)-9(c) for the employee\'s age as of the employee\'s birthday in the relevant distribution calendar year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(c)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9',
      quotedText:
        'Uniform Lifetime Table. The following table, referred to as the Uniform Lifetime Table, sets forth the applicable denominator that applies for lifetime distributions to an employee in situations in which the employee\'s surviving spouse is not the sole designated beneficiary.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(f)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9',
      quotedText:
        'The life expectancy tables and Uniform Lifetime Table set forth in this section apply for distribution calendar years beginning on or after January 1, 2022. For life expectancy tables and the Uniform Lifetime Table applicable for earlier distribution calendar years, see § 1.401(a)(9)-9, as set forth in 26 CFR part 1 revised as of April 1, 2020 (formerly applicable § 1.401(a)(9)-9).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'treas-reg-1-401-a-9-5-a-2-first-distribution-calendar-year': {
    title: 'First distribution calendar year is the year the applicable age is attained',
    statement:
      'Where the required beginning date is April 1 of the year following attainment of the applicable age, the first distribution calendar year is the attainment year itself. A required minimum distribution is therefore due for the attainment year, computed on the prior year-end balance and the denominator for the age attained in that year, even though the payment may lawfully be made as late as the following April 1. The deadline moves; the year the amount belongs to does not.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(2)(ii)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If an employee\'s required beginning date is April 1 of the calendar year following the calendar year in which the employee attains the applicable age, then the employee\'s first distribution calendar year is the year the employee attains the applicable age.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'The distribution required for the employee\'s first distribution calendar year (as described in paragraph (a)(2)(ii) of this section) may be made on or before April 1 of the following calendar year. The required minimum distribution for any other distribution calendar year ... must be made on or before the end of that distribution calendar year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/params/index.ts',
    ],
  },
  'irc-401-a-9-C-i-first-year-april-1-deferral': {
    title: 'Deferral of the first required minimum distribution to April 1',
    statement:
      'The distribution for the first distribution calendar year may be paid as late as April 1 of the following year, in which case two required minimum distributions are taxed in that following year. Not modelled: the engine recognises the first-year amount entirely in the attainment year and offers no deferral election. For a taxpayer who defers, the error runs one way — attainment-year ordinary income is overstated by the whole first-year amount and the following year is understated by the same amount, which suppresses a real one-year spike in the bracket, in the capital-gain stacking threshold, and in the income used two years later for the Medicare premium adjustment.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(a)(3)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'The distribution required for the employee\'s first distribution calendar year (as described in paragraph (a)(2)(ii) of this section) may be made on or before April 1 of the following calendar year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-401-a-9-C-i-II-still-working-exception': {
    title: 'Required beginning date deferred while still employed by the plan sponsor',
    statement:
      'For an employer plan, the required beginning date is April 1 following the later of the attainment year or the year the employee retires, so a participant who keeps working past the applicable age has no required minimum distribution from that plan. The deferral is unavailable to a 5-percent owner and never reaches an IRA. Not modelled: the engine forces an employer-plan distribution from the applicable age alone and never consults employment status, so for a non-5-percent owner still employed it overstates forced ordinary income every year until retirement and understates the balance carried forward. It cannot err the other way. The plan schema already carries a retirement age for each person, so the fact the rule turns on is present and unused.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(i)(II)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “required beginning date” means April 1 of the calendar year following the later of— (I) the calendar year in which the employee attains the applicable age, or (II) the calendar year in which the employee retires.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(C)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'Subclause (II) of clause (i) shall not apply— (I) except as provided in section 409(d), in the case of an employee who is a 5-percent owner (as defined in section 416) with respect to the plan year ending in the calendar year in which the employee attains the applicable age, or (II) for purposes of section 408(a)(6) or (b)(3).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/strategies/accountEligibility.ts',
    ],
  },
  'irc-401-a-9-H-ii-annual-distributions-inside-ten-year-window': {
    title: 'Whether annual distributions are also required inside the 10-year window',
    statement:
      'The ten-year deadline is not the only obligation. Where the employee died on or after the required beginning date, the at-least-as-rapidly rule survives, so an annual life-expectancy distribution is required in each year of the window in addition to the year-ten sweep. Where the employee died before the required beginning date, no annual distribution is required at all and the sole obligation is to be empty by the deadline. The two cases differ in the shape of the taxable income the window produces, not merely in its total.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(B)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'A trust shall not constitute a qualified trust under this section unless the plan provides that if— (I) the distribution of the employee’s interest has begun in accordance with subparagraph (A)(ii), and (II) the employee dies before his entire interest has been distributed to him, the remaining portion of such interest will be distributed at least as rapidly as under the method of distributions being used under subparagraph (A)(ii) as of the date of his death.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(1)(i)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If an employee dies after distribution has begun as determined under § 1.401(a)(9)-2(a)(3) (generally, on or after the employee\'s required beginning date), distributions must satisfy section 401(a)(9)(B)(i). ... The requirement to take an annual distribution in accordance with the preceding sentence continues to apply for every distribution calendar year until the employee\'s interest is fully distributed. ... If section 401(a)(9)(H) applies to the employee\'s interest in the plan, then the distributions also must satisfy either section 401(a)(9)(B)(ii) (applied by substituting 10 years for 5 years) or, if the beneficiary is an eligible designated beneficiary, section 401(a)(9)(B)(iii) (taking into account sections 401(a)(9)(E)(iii) and 401(a)(9)(H)(iii)).',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If an employee dies before distributions have begun (as determined under § 1.401(a)(9)-2(a)(3)) and the life expectancy rule described in § 1.401(a)(9)-3(c)(4) applies, then the applicable denominator for distribution calendar years beginning with the first distribution calendar year for the designated beneficiary ... is the designated beneficiary\'s remaining life expectancy (or is determined under the rules of paragraph (g)(3) of this section, if applicable).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator': {
    title: 'Denominator for a beneficiary annual distribution after death on or after the required beginning date',
    statement:
      'The prescribed denominator is the greater of the designated beneficiary remaining life expectancy and the employee remaining life expectancy, each taken from the unisex Single Life Table, with a non-spouse beneficiary expectancy fixed at the age reached in the year following death and reduced by one for each later year. Not modelled as prescribed: the engine substitutes a sex-specific SSA period life expectancy looked up at the beneficiary current age each year, and never applies the greater-of test. The direction is dominated by the table. SSA population expectancies are shorter than Single Life Table entries at every age in range — at 55 the Single Life Table gives 31.6 against SSA figures of 24.94 for a man and 28.34 for a woman — so the denominator is too small and the forced annual distribution too large. Ignoring the greater-of adds a second overstatement whenever the beneficiary is older than the decedent. Recomputing at the current age instead of subtracting one runs the other way and partly offsets in the late years of the window. Because the balance must be gone by the deadline either way, the net effect is to pull taxable income into the earlier years of the window rather than to change the total.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(1)(ii)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'If the employee has a designated beneficiary as of the date determined under § 1.401(a)(9)-4(c), the applicable denominator is the greater of— (A) The designated beneficiary\'s remaining life expectancy; and (B) The employee\'s remaining life expectancy.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-5(d)(3)(i) and (d)(3)(iii)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-5',
      quotedText:
        'For purposes of this paragraph (d), all life expectancies are determined using the Single Life Table in § 1.401(a)(9)-9(b). ... If the designated beneficiary is not the employee\'s surviving spouse, then the designated beneficiary\'s remaining life expectancy is determined initially using the beneficiary\'s age as of the beneficiary\'s birthday in the calendar year following the calendar year of the employee\'s death. ... for subsequent calendar years, the designated beneficiary\'s remaining life expectancy is determined by reducing that initial life expectancy by one for each calendar year that has elapsed after that first calendar year.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-9(b)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.401(a)(9)-9',
      quotedText:
        'Single Life Table. The following table, referred to as the Single Life Table, sets forth the life expectancy of an individual at each age.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/longevity/ssaPeriod2022.ts',
    ],
  },
  'irc-401-a-9-E-ii-eligible-designated-beneficiary': {
    title: 'Eligible designated beneficiary escapes the 10-year rule',
    statement:
      'A designated beneficiary who is the surviving spouse, a minor child of the employee, disabled, chronically ill, or not more than ten years younger than the employee is an eligible designated beneficiary, and the life-expectancy exception applies only to such a beneficiary. Status is fixed at the date of death. Not modelled: the engine applies the ten-year rule to every inherited traditional account and holds no beneficiary-status fact, so for an eligible designated beneficiary it compresses a whole-of-life stretch into ten years. The error runs one way — forced ordinary income inside the window is overstated, the balance that should have survived past the window is understated, and the income the window should have produced in later decades disappears.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 401(a)(9)(E)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'The term “eligible designated beneficiary” means, with respect to any employee, any designated beneficiary who is— (I) the surviving spouse of the employee, (II) subject to clause (iii), a child of the employee who has not reached majority (within the meaning of subparagraph (F)), (III) disabled (within the meaning of section 72(m)(7)), (IV) a chronically ill individual ..., or (V) an individual not described in any of the preceding subclauses who is not more than 10 years younger than the employee. The determination of whether a designated beneficiary is an eligible designated beneficiary shall be made as of the date of death of the employee.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(H)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'Exception for eligible designated beneficiaries.—Subparagraph (B)(iii) shall apply only in the case of an eligible designated beneficiary.',
    }, {
      kind: 'statute',
      citation: 'IRC 401(a)(9)(E)(iii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/401',
      quotedText:
        'Subject to subparagraph (F), an individual described in clause (ii)(II) shall cease to be an eligible designated beneficiary as of the date the individual reaches majority and any remainder of the portion of the individual’s interest to which subparagraph (H)(ii) applies shall be distributed within 10 years after such date.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/strategies/inheritedIra.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-4974-rmd-shortfall-excise-tax': {
    title: 'Excise tax on a required minimum distribution shortfall',
    statement:
      'A payee who takes less than the required minimum distribution for a year owes an excise tax of 25 percent of the shortfall, reduced to 10 percent if the shortfall is distributed and a return reflecting the tax is filed inside the correction window, and waivable entirely where the shortfall was reasonable error and reasonable steps are being taken to remedy it. Not modelled: nothing in the engine prices a shortfall. The engine instead forces the distribution, so a plan the user could not or would not execute is reported as costing nothing rather than as costing a quarter of what was missed. The error can only understate: a missed distribution is shown at zero penalty, and the difference between the 25 percent default and the 10 percent corrected rate — which is the whole value of acting quickly — cannot be represented at all.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 4974(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/4974',
      quotedText:
        'If the amount distributed during the taxable year of the payee under any qualified retirement plan or any eligible deferred compensation plan (as defined in section 457(b)) is less than the minimum required distribution for such taxable year, there is hereby imposed a tax equal to 25 percent of the amount by which such minimum required distribution exceeds the actual amount distributed during the taxable year. The tax imposed by this section shall be paid by the payee.',
    }, {
      kind: 'statute',
      citation: 'IRC 4974(e)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/4974',
      quotedText:
        'In the case of a taxpayer who— (A) receives a distribution, during the correction window, of the amount which resulted in imposition of a tax under subsection (a) from the same plan to which such tax relates, and (B) submits a return, during the correction window, reflecting such tax (as modified by this subsection), the first sentence of subsection (a) shall be applied by substituting “10 percent” for “25 percent”.',
    }, {
      kind: 'statute',
      citation: 'IRC 4974(d)',
      url: 'https://www.law.cornell.edu/uscode/text/26/4974',
      quotedText:
        'If the taxpayer establishes to the satisfaction of the Secretary that— (1) the shortfall described in subsection (a) in the amount distributed during any taxable year was due to reasonable error, and (2) reasonable steps are being taken to remedy the shortfall, the Secretary may waive the tax imposed by subsection (a) for the taxable year.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/rmd/rmd.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-72-b-annuity-exclusion-ratio': {
    title: 'Exclusion ratio for a non-qualified annuity, and the cap at unrecovered investment',
    statement:
      'The part of each annuity payment excluded from gross income is the payment multiplied by the ratio of investment in the contract to expected return, both measured once at the annuity starting date and never revised. For a single life the expected return is the total annual payment multiplied by the Table V expectancy multiple for the age at that date. The cumulative exclusion may never exceed the unrecovered investment, so once the whole investment has been returned every later payment is fully taxable, and the same fixed share carries to a survivor or beneficiary until that point is reached.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Table V rather than Table I is the correct table because Tables V through VIII govern any contract whose investment includes post-June-1986 money, which is every contract a plan under this engine could be buying. The distinction is load-bearing and not cosmetic: at age 66 the Table I male multiple is 14.4 and the Table V multiple is 19.2, a difference of about a third in the expected return and therefore in the ratio.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'Gross income does not include that part of any amount received as an annuity under an annuity, endowment, or life insurance contract which bears the same ratio to such amount as the investment in the contract (as of the annuity starting date) bears to the expected return under the contract (as of such date).',
    }, {
      kind: 'statute',
      citation: 'IRC 72(b)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'The portion of any amount received as an annuity which is excluded from gross income under paragraph (1) shall not exceed the unrecovered investment in the contract immediately before the receipt of such amount.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-5(a)(1)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-5',
      quotedText:
        'If a contract to which section 72 applies provides that one annuitant is to receive a fixed monthly income for life, the expected return is determined by multiplying the total of the annuity payments to be received annually by the multiple shown in Table I or V (whichever is applicable) of § 1.72-9 under the age (as of the annuity starting date) and, if applicable, sex of the measuring life ... If, however, the taxpayer had purchased the contract after June 30, 1986, the expected return would be $23,040, determined by multiplying 19.2 (multiple shown in Table V, age 66) by $1,200.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-9',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-9',
      quotedText:
        'Tables I, II, IIA, III, and IV are to be used if the investment in the contract does not include a post-June 1986 investment in the contract (as defined in § 1.72-6(d)(3)). Tables V, VI, VIA, VII, and VIII are to be used if the investment in the contract includes a post-June 1986 investment in the contract (as defined in § 1.72-6(d)(3)).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/projection/annuityForms.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'treas-reg-1-72-7-refund-feature-investment-adjustment': {
    title: 'Adjustment for a period-certain guarantee on a life annuity',
    statement:
      'A life annuity with a minimum period of payments certain is a refund feature. The prescribed treatment reduces the numerator: take the Table VII percentage for the annuitant age and the whole number of guaranteed years, multiply it by the smaller of the investment or the total guaranteed, subtract that from the investment, and compute an ordinary single-life exclusion ratio on the reduced investment. Not modelled as prescribed: the engine leaves the investment untouched and instead raises the denominator, using the greater of the single-life multiple and the certain period. Where the guarantee is shorter than the life multiple — the ordinary case for a ten- or twenty-year certain bought at 65 — the engine makes no adjustment at all while the regulation prescribes a positive one, so the exclusion ratio is too high and taxable income too low in the early payment years. Where the guarantee is longer the engine at least moves the ratio downward, but by a quantity no authority prescribes. The cap at unrecovered investment bounds the total excluded, so the error is a timing shift unless the annuitant dies before recovery, where it becomes permanent.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 72(c)(2)',
      url: 'https://www.law.cornell.edu/uscode/text/26/72',
      quotedText:
        'then the value (computed without discount for interest) of such payments on the annuity starting date shall be subtracted from the amount determined under paragraph (1). Such value shall be computed in accordance with actuarial tables prescribed by the Secretary. For purposes of this paragraph and of subsection (e)(2)(A), the term “refund of the consideration paid” includes amounts payable after the death of an annuitant by reason of a provision in the contract for a life annuity with minimum period of payments certain, ...',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-7(b)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-7',
      quotedText:
        '(1) Determine the number of years necessary for the guaranteed amount to be fully paid by dividing the maximum amount guaranteed as of the annuity starting date by the amount to be received annually under the contract ... (2) Consult Table III or VII (whichever is applicable) of § 1.72-9 for the appropriate percentage under the whole number of years found in subparagraph (1) of this paragraph and the age (as of the annuity starting date) ... (3) Multiply the percentage found in subparagraph (2) of this paragraph by whichever of the following is the smaller: (i) The investment in the contract found in accordance with § 1.72-6 or (ii) the total amount guaranteed as of the annuity starting date. (4) Subtract the amount found in subparagraph (3) of this paragraph from the investment in the contract found in accordance with § 1.72-6.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/annuityForms.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'treas-reg-1-72-5-b-2-joint-and-survivor-expected-return': {
    title: 'Expected return for a joint and survivor annuity paying a reduced survivor amount',
    statement:
      'Where the survivor receives a different amount from the first annuitant, the expected return is the first annuitant annual payment times the Table V single-life multiple, plus the survivor annual payment times the excess of the Table VI joint and last survivor multiple over that single-life multiple. The engine reproduces that decomposition exactly, which is worth recording because it is easy to mistake for an ad hoc blend. What it does not do is take the joint multiple from Table VI: it derives a joint last-survivor expectancy from the SSA-based mortality model instead, and does so per sex where Table VI is unisex. Not modelled as prescribed for that reason. SSA population mortality is heavier than the annuitant mortality standing behind Table VI, so the survivor tail comes out shorter than prescribed, expected return is understated, the exclusion ratio overstated, and taxable income understated in the early payment years. The cap at unrecovered investment turns most of that into a timing shift; it is permanent only where the annuitant dies before the investment is recovered.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-5(b)(2)',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-5',
      quotedText:
        'The applicable multiple in Table II or VI (whichever is applicable) is first found ... The multiple applicable to the first annuitant is then found in Table I or V (whichever is applicable) as though the contract were for a single life annuity. The multiple from Table I or V is then subtracted from the multiple obtained from Table II or VI and the resulting multiple is applied to the total payments to be received annually under the contract by the second annuitant. ... The expected returns with respect to each of the annuitants separately are then aggregated to obtain the expected return under the entire contract.',
    }, {
      kind: 'regulation',
      citation: 'Treas. Reg. 1.72-5(b)(2), Example 2',
      url: 'https://www.law.cornell.edu/cfr/text/26/1.72-5',
      quotedText:
        'Multiple from Table VI (ages 70, 67) 22.0 Multiple from Table V (age 70) 16.0 Difference (multiple applicable to second annuitant) 6.0 Portion of expected return, second annuitant ($600 × 6.0) $3,600 Plus: Portion of expected return, first annuitant ($1,200 × 16.0) $19,200 Expected return under the contract $22,800',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/projection/annuityForms.ts',
      'packages/engine/src/montecarlo/mortality.ts',
    ],
  },
  'irc-1-h-1-E-unrecaptured-section-1250-gain': {
    title: 'Depreciation on real property is capital gain capped at 25 percent, not ordinary income',
    statement:
      'Depreciation taken on real property is generally not section 1250 recapture, because additional depreciation means only the excess over the straight-line method and real property placed in service after 1986 is depreciated straight line. It is unrecaptured section 1250 gain: long-term capital gain to which the maximum rate is 25 percent. Not modelled: the engine adds the whole recapture figure to ordinary income. The direction is fixed by the fact that 25 percent is a ceiling rather than a rate. For a taxpayer whose marginal ordinary rate exceeds 25 percent the engine overstates tax on that slice by the difference between the two rates; for a taxpayer already below 25 percent the answer is the same either way. It cannot understate.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 1(h)(1)(E)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'If a taxpayer has a net capital gain for any taxable year, the tax imposed by this section for such taxable year shall not exceed the sum of— ... (E) 25 percent of the excess (if any) of— (i) the unrecaptured section 1250 gain (or, if less, the net capital gain (determined without regard to paragraph (11))), over (ii) the excess (if any) of ...',
    }, {
      kind: 'statute',
      citation: 'IRC 1(h)(6)(A)(i)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1',
      quotedText:
        'The term “unrecaptured section 1250 gain” means the excess (if any) of— (i) the amount of long-term capital gain (not otherwise treated as ordinary income) which would be treated as ordinary income if section 1250(b)(1) included all depreciation and the applicable percentage under section 1250(a) were 100 percent, over ...',
    }, {
      kind: 'statute',
      citation: 'IRC 1250(b)(1)',
      url: 'https://www.law.cornell.edu/uscode/text/26/1250',
      quotedText:
        'The term “additional depreciation” means, in the case of any property, the depreciation adjustments in respect of such property; except that, in the case of property held more than one year, it means such adjustments only to the extent that they exceed the amount of the depreciation adjustments which would have resulted if such adjustments had been determined for each taxable year under the straight line method of adjustment.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-121-a-b-principal-residence-eligibility-tests': {
    title: 'Eligibility tests that gate the principal-residence exclusion',
    statement:
      'The exclusion is available only where the property was owned and used as the principal residence for periods aggregating two years within the five years ending on the sale, is denied outright where another sale qualifying under the section occurred in the two years before, reaches the larger joint figure only where either spouse meets the ownership test and both meet the use test, and does not reach the share of gain allocated to periods of nonqualified use after 2008. Not modelled: the engine applies the whole filing-status cap whenever a boolean primary-residence flag is set. Every test it omits can only reduce an exclusion, never enlarge one, so the engine can only over-exclude and understate tax; the extreme case is a full joint exclusion where the correct answer is nothing at all.',
    classification: 'outOfScope',
    contraryReading: null,
    conventionRationale: null,
    authority: [{
      kind: 'statute',
      citation: 'IRC 121(a)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Gross income shall not include gain from the sale or exchange of property if, during the 5-year period ending on the date of the sale or exchange, such property has been owned and used by the taxpayer as the taxpayer’s principal residence for periods aggregating 2 years or more.',
    }, {
      kind: 'statute',
      citation: 'IRC 121(b)(2)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Paragraph (1) shall be applied by substituting “$500,000” for “$250,000” if— (i) either spouse meets the ownership requirements of subsection (a) with respect to such property; (ii) both spouses meet the use requirements of subsection (a) with respect to such property; and (iii) neither spouse is ineligible for the benefits of subsection (a) with respect to such property by reason of paragraph (3).',
    }, {
      kind: 'statute',
      citation: 'IRC 121(b)(3)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Subsection (a) shall not apply to any sale or exchange by the taxpayer if, during the 2-year period ending on the date of such sale or exchange, there was any other sale or exchange by the taxpayer to which subsection (a) applied.',
    }, {
      kind: 'statute',
      citation: 'IRC 121(b)(5)(A) and (B)',
      url: 'https://www.law.cornell.edu/uscode/text/26/121',
      quotedText:
        'Subsection (a) shall not apply to so much of the gain from the sale or exchange of property as is allocated to periods of nonqualified use. ... gain shall be allocated to periods of nonqualified use based on the ratio which— (i) the aggregate periods of nonqualified use during the period such property was owned by the taxpayer, bears to (ii) the period such property was owned by the taxpayer.',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/tax/propertySale.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-86-c-provisional-income-thresholds': {
    title: 'The Social Security base amounts are fixed dollars, and the joint figure is not double',
    statement:
      'The two provisional-income thresholds that gate benefit taxation are the base amount, 25,000 for an unmarried filer and 32,000 on a joint return, and the adjusted base amount, 34,000 and 44,000. Section 86 contains no cost-of-living provision of any kind, so all four figures have stood in the same nominal dollars since 1993 and move only by legislation. Two errors follow from forgetting that. Scaling them with an inflation factor understates taxable Social Security in every projected year, because the whole design of the section is that a rising nominal benefit crosses a still threshold. And the joint amounts are not twice the unmarried ones -- 32,000 against 25,000 and 44,000 against 34,000 -- so the doubling that holds for the standard deduction must not be carried across to these.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The base amount is zero rather than 25,000 for a married taxpayer who files separately and did not live apart from the spouse for the whole year, which makes the whole benefit taxable at the 85 percent rate. The engine has no married-filing-separately status, so that case cannot arise; the record notes it because a later filing status added without reading 86(c)(1)(C) would inherit the unmarried figure and understate the tax by the largest margin the section allows.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 86(c)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section86&num=0&edition=prelim',
      quotedText:
        'Base amount and adjusted base amount For purposes of this section- (1) Base amount The term "base amount" means- (A) except as otherwise provided in this paragraph, $25,000, (B) $32,000 in the case of a joint return, and (C) zero in the case of a taxpayer who- (i) is married as of the close of the taxable year (within the meaning of section 7703) but does not file a joint return for such year, and (ii) does not live apart from his spouse at all times during the taxable year. (2) Adjusted base amount The term "adjusted base amount" means- (A) except as otherwise provided in this paragraph, $34,000, (B) $44,000 in the case of a joint return, and (C) zero in the case of a taxpayer described in paragraph (1)(C).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 1994,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/tax/federalTax.ts',
    ],
  },
  'irc-414-v-7-E-roth-catch-up-wage-threshold': {
    title: 'The Roth catch-up wage threshold moves in five-thousand-dollar steps',
    statement:
      'A participant whose wages from the sponsoring employer for the preceding calendar year exceed the threshold in IRC 414(v)(7)(A) may make catch-up contributions only as designated Roth contributions. The base figure is 145,000, and 414(v)(7)(E) adjusts it annually in the same time and manner as the section 415(d) limits, from a base period of the calendar quarter beginning July 1, 2023, with any increase that is not a multiple of 5,000 rounded to the next lower multiple. Notice 2025-67 sets the threshold at 150,000 for 2026. The round-down is what makes the figure hard to guess: it stands still for a year or more at a time and then jumps a whole step, so it is never the base amount scaled by a year of inflation.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The parameter pack carries the threshold but no engine calculator reads it, so nothing in the projection currently forces a high-wage catch-up into Roth. Registering the rule against the pack fields that hold the figure means a later implementation inherits the authority and the rounding rule rather than re-deriving them, and the fixture pins the published figure against the un-adjusted statutory base in the meantime.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 414(v)(7)(A), (v)(7)(E)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section414&num=0&edition=prelim',
      quotedText:
        'Except as provided in subparagraph (C), in the case of an eligible participant whose wages (as defined in section 3121(a)) for the preceding calendar year from the employer sponsoring the plan exceed $145,000, paragraph (1) shall apply only if any additional elective deferrals are designated Roth contributions (as defined in section 402A(c)(1)) made pursuant to an employee election. ... In the case of a year beginning after December 31, 2024, the Secretary shall adjust annually the $145,000 amount in subparagraph (A) for increases in the cost-of-living at the same time and in the same manner as adjustments under 415(d); except that the base period taken into account shall be the calendar quarter beginning July 1, 2023, and any increase under this subparagraph which is not a multiple of $5,000 shall be rounded to the next lower multiple of $5,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the Roth catch-up wage threshold',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The Roth catch-up wage threshold for 2025, which under section 414(v)(7)(A) is used to determine whether an individual’s catch-up contributions to an applicable employer plan (other than a plan described in section 408(k) or (p)) for 2026 must be designated as Roth contributions, is increased from $145,000 to $150,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/types.ts',
    ],
  },
  'irc-415-d-cost-of-living-adjustment-anchor': {
    title: 'Section 415(d) is the adjustment mechanism the other retirement limits borrow',
    statement:
      'IRC 415(d) directs the Secretary to adjust the defined benefit limit and the 40,000 defined contribution limit in 415(c)(1)(A) for cost of living, measured on the calendar quarter ending September 30 of the preceding year against a base period of the calendar quarter beginning July 1, 2001, by procedures similar to those used for Social Security benefit adjustments, with any increase in the 415(c)(1)(A) amount rounded down to a multiple of 1,000. For 2026 that limit is 72,000, up from 70,000. The reason to record the mechanism rather than only the figure is that the 402(g) elective deferral limit, the 414(v) catch-up amounts, the Roth catch-up wage threshold and the QLAC premium cap all adjust by reference back to this same subsection, each with its own base period and its own rounding step. They move together, and none of them is ever a smooth multiple of the prior year.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The statutory adjustment lands on rounded steps while the projection multiplies the pack figure by a continuous inflation factor, so a projected year can sit between two published steps. Holding the step exactly would require index values for years that have not happened, which do not exist at planning time, so the continuous factor is a deliberate approximation. It is bounded by one rounding step, unbiased over a long horizon, and never reverses the direction of a limit. What it must not be extended to is a figure with no adjustment provision at all, where the same multiplication produces a number the statute never allows.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 415(d)(1), (d)(2), (d)(3)(D), (d)(4)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section415&num=0&edition=prelim',
      quotedText:
        'The Secretary shall adjust annually- (A) the $160,000 amount in subsection (b)(1)(A), (B) in the case of a participant who is separated from service, the amount taken into account under subsection (b)(1)(B), and (C) the $40,000 amount in subsection (c)(1)(A), for increases in the cost-of-living in accordance with regulations prescribed by the Secretary. (2) Method The regulations prescribed under paragraph (1) shall provide for- (A) an adjustment with respect to any calendar year based on the increase in the applicable index for the calendar quarter ending September 30 of the preceding calendar year over such index for the base period, and (B) adjustment procedures which are similar to the procedures used to adjust benefit amounts under section 215(i)(2)(A) of the Social Security Act. ... The base period taken into account for purposes of paragraph (1)(C) is the calendar quarter beginning July 1, 2001. ... Any increase under subparagraph (C) of paragraph (1) which is not a multiple of $1,000 shall be rounded to the next lowest multiple of $1,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the section 415 limitations',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation for defined contribution plans under section 415(c)(1)(A) is increased in 2026 from $70,000 to $72,000. The Code provides that various other amounts are to be adjusted at the same time and in the same manner as the limitation of section 415(b)(1)(A).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'treas-reg-1-401-a-9-6-q-2-qlac-premium-dollar-limit': {
    title: 'The QLAC premium cap is a household-wide running total that moves in ten-thousand-dollar steps',
    statement:
      'Premiums paid for a qualifying longevity annuity contract satisfy the limitation only if they do not exceed 200,000 as adjusted, reduced by every premium already paid for that contract and for any other contract intended to be a QLAC purchased under the plan or under any other plan, annuity, or account described in section 401(a), 403(a), 403(b), or 408, or under an eligible governmental plan. The cap is therefore one running total across all of the retirement accounts of an individual, not a per-contract or per-account allowance. The 200,000 amount is adjusted at the same time and in the same manner as the section 415(d) limits, from a base period of the calendar quarter beginning July 1, 2022, with any increment that is not a multiple of 10,000 rounded down, so the cap sits on a whole ten-thousand-dollar step. Notice 2025-67 confirms it remains 210,000 for 2026.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The regulation moves the cap as a step function while the projection multiplies it by a continuous inflation factor, so a projected year can sit between two published steps and a premium within one step of the cap can read as eligible when the regulation would refuse it, or the reverse. The error is bounded by a single ten-thousand-dollar step. Holding the step would require index values for years that have not happened, so the continuous factor is the same deliberate approximation taken for every other limit that borrows the section 415(d) mechanism.',
    authority: [{
      kind: 'regulation',
      citation: 'Treas. Reg. 1.401(a)(9)-6(q)(2)(ii), (q)(4)(ii)(A)',
      url: 'https://www.ecfr.gov/current/title-26/section-1.401(a)(9)-6',
      quotedText:
        'Dollar limitation. The dollar limitation as of a premium payment date is an amount by which $200,000 (as adjusted under paragraph (q)(4)(ii)(A) of this section), exceeds the sum of- (A) The premiums paid before that date with respect to the contract, and (B) The premiums paid on or before that date with respect to any other contract that is intended to be a QLAC and that is purchased for the employee under the plan, or any other plan, annuity, or account described in section 401(a), 403(a), 403(b), or 408 or eligible governmental plan under section 457(b). ... Dollar limitation. The $200,000 amount under paragraph (q)(2)(ii) of this section will be adjusted at the same time and in the same manner as the limits are adjusted under section 415(d), except that- (1) The base period is the calendar quarter beginning July 1, 2022; and (2) The amount of any increment to the limit that is not a multiple of $10,000 will be rounded to the next lowest multiple of $10,000.',
    }, {
      kind: 'irsNotice',
      citation: 'Notice 2025-67, section on the qualifying longevity annuity contract limitation',
      url: 'https://www.irs.gov/pub/irs-drop/n-25-67.pdf',
      quotedText:
        'The limitation on premiums paid for a qualifying longevity annuity contract under § 1.401(a)(9)-6(q)(2)(ii) remains $210,000.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/decisions/generators.ts',
    ],
  },
  'usc-42-430-b-contribution-and-benefit-base': {
    title: 'The OASDI contribution and benefit base is wage-indexed, not price-indexed',
    statement:
      'The Social Security taxable wage base for 2026 is 184,500. It is not a price-indexed figure. Section 230(b) of the Act sets it to the larger of the base already in effect and the 1994 base of 60,600 multiplied by the ratio of the national average wage index for the second preceding year to that for 1992, rounded to the nearest multiple of 300. For 2026 that product is 184,548.71 and it rounds to 184,500. Average wages have grown faster than consumer prices over almost every long window, so a projection that carries the base forward on a consumer-price factor understates it, and because the two rates compound the gap widens every year rather than staying a fixed percentage.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The parameter pack carries the base but no engine calculator reads it yet, and the engine has no national-average-wage path to carry it forward on: the plan supplies a general inflation assumption and nothing else. When a calculator does read it, scaling by general inflation will be a stand-in for wage indexing rather than a reading of section 230, and this record is where that has to be said. The same caution applies to the retirement earnings test exempt amounts, which are wage-indexed by the same ratio.',
    authority: [{
      kind: 'statute',
      citation: '42 USC 430(b)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section430&num=0&edition=prelim',
      quotedText:
        'The amount of such contribution and benefit base shall (subject to subsection (c)) be the amount of the contribution and benefit base in effect in the year in which the determination is made or, if larger, the product of- (1) $60,600, and (2) the ratio of (A) the national average wage index (as defined in section 409(k)(1) of this title) for the calendar year before the calendar year in which the determination under subsection (a) is made to (B) the national average wage index (as so defined) for 1992, with such product, if not a multiple of $300, being rounded to the next higher multiple of $300 where such product is a multiple of $150 but not of $300 and to the nearest multiple of $300 in any other case.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Multiplying the 1994 OASDI contribution and benefit base ($60,600) by the ratio of the national average wage index for 2024 ($69,846.57 as determined above) to that for 1992 ($22,935.42) produces $184,548.71. We round this amount to $184,500. Because $184,500 exceeds the current base amount of $176,100, the OASDI contribution and benefit base is $184,500 for 2026.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/types.ts',
    ],
  },
  'usc-42-403-f-8-earnings-test-exempt-amounts': {
    title: 'The earnings test exempt amounts are wage-indexed, and the higher one is not a multiple of the lower',
    statement:
      'Section 203(f)(8)(B) of the Act sets each monthly exempt amount to the larger of the amount already in effect and a base monthly amount scaled by the ratio of the national average wage index for the second preceding year to that for a fixed reference year, rounded to the nearest multiple of 10. The two amounts run off different bases and different reference years: 670 against 1992 for a beneficiary below normal retirement age throughout the year, and 2,500 against 2000 for the year normal retirement age is attained. The annual amounts are exactly twelve times the monthly ones, giving 24,480 and 65,160 for 2026. Because the index is wages rather than prices, and because the two amounts are separately derived, neither one can be obtained by scaling the other or by applying the benefit cost-of-living increase to last year figure.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The projection carries both exempt amounts forward on the general inflation assumption because the engine has no national-average-wage path, and the plan supplies no wage growth input from which one could be built. That is a stand-in rather than a reading of section 203(f)(8)(B), and it biases the projected exempt amount low in the direction that withholds more benefit than the Act would, since wages have historically outrun prices. It is recorded here rather than left in the code because the fix is a new assumption rather than a change of formula.',
    authority: [{
      kind: 'statute',
      citation: '42 USC 403(f)(8)(B)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section403&num=0&edition=prelim',
      quotedText:
        'Except as otherwise provided in subparagraph (D), the exempt amount which is applicable to individuals described in such subparagraph and the exempt amount which is applicable to other individuals, for each month of a particular taxable year, shall each be whichever of the following is the larger- (i) the corresponding exempt amount which is in effect with respect to months in the taxable year in which the determination under subparagraph (A) is made, or (ii) the product of the corresponding exempt amount which is in effect with respect to months in the taxable year ending after 2001 and before 2003 (with respect to individuals described in subparagraph (D)) or the taxable year ending after 1993 and before 1995 (with respect to other individuals), and the ratio of- (I) the national average wage index (as defined in section 409(k)(1) of this title) for the calendar year before the calendar year in which the determination under subparagraph (A) is made, to (II) the national average wage index (as so defined) for 2000 (with respect to individuals described in subparagraph (D)) or 1992 (with respect to other individuals), with such product, if not a multiple of $10, being rounded to the next higher multiple of $10 where such product is a multiple of $5 but not of $10 and to the nearest multiple of $10 in any other case.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Multiplying the 1994 retirement earnings test monthly exempt amount of $670 by the ratio of the national average wage index for 2024 ($69,846.57) to that for 1992 ($22,935.42) produces $2,040.39. We round this to $2,040. Because $2,040 exceeds the current exempt amount of $1,950, the lower retirement earnings test monthly exempt amount is $2,040 for 2026. The lower annual exempt amount is $24,480 under the retirement earnings test. ... Multiplying the 2002 retirement earnings test monthly exempt amount of $2,500 by the ratio of the national average wage index for 2024 ($69,846.57) to that for 2000 ($32,154.82) produces $5,430.49. We round this to $5,430. Because $5,430 exceeds the current exempt amount of $5,180, the higher retirement earnings test monthly exempt amount is $5,430 for 2026. The higher annual exempt amount is $65,160 under the retirement earnings test.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'usc-42-1395r-i-5-C-top-irmaa-threshold-frozen': {
    title: 'The top IRMAA threshold is frozen through 2027, then indexed off a later base',
    statement:
      'Every IRMAA dollar threshold is indexed under 42 USC 1395r(i)(5)(A) to consumer prices measured against an August 2006 base and rounded to the nearest 1,000, but that subparagraph is expressly subject to (i)(5)(C), which treats the 500,000 amounts twice. Subparagraph (i)(5)(C)(i) removes them from the (i)(5)(A) adjustment outright. Subparagraph (i)(5)(C)(ii) brings them back for calendar years after 2027, measured against August 2026 rather than August 2006. Because both provisions read the August of the preceding calendar year, an August 2026 base is exactly one year behind the general one, so from 2028 the top row grows at the same rate as the rows beneath it but from a position one year further back. The carve-out reaches only the 500,000 amounts, not paragraph (3) at large, so the four lower rows never pause. The joint figure follows from (i)(3)(C)(ii), which sets the last row at 150 percent of the individual amount rather than twice it, which is why the pack carries 500,000 and 750,000 where every lower row is an exact double. CMS says the same in its own words when it promulgates the table: the top threshold levels are to be inflation-adjusted beginning in 2028, which is why that row has stood at 500,000 and 750,000 since it was created for 2019 while every row beneath it rose each year. Both errors bite on a long horizon. Scaling all five boundaries by one factor sweeps into the top tier a household whose income never reached it; freezing the top boundary forever does the same thing more slowly and never stops, because a nominal projection keeps rising past a threshold the statute does allow to move again.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'Three things are decided here rather than dictated. First, the index: the resumed adjustment is measured on the plan assumed general inflation rather than the consumer price index the statute names, which is the same stand-in the lower rows already take, and the pack year of 2026 is what makes the general inflation series readable at the August 2026 base period without an offset. Second, the rounding: (i)(5)(B) rounds a dollar amount increased under subparagraph (C) to the nearest 1,000, and that is reproduced for the top row. The identical rounding (i)(5)(B) applies to the (i)(5)(A) adjustment of the four lower rows is not reproduced, which is pre-existing behaviour and is named here rather than left as a silent asymmetry between two branches of one function. Third, the Federal Register determination that publishes the table is registered under the regulation authority kind. It is neither a statute nor an IRS notice, and the enum has no member for an agency determination published in the Federal Register; introducing one is a schema decision rather than a research finding, so the nearest existing member is used and the choice is named rather than left silent.',
    authority: [{
      kind: 'statute',
      citation: '42 USC 1395r(i)(5)(A), (i)(5)(B), (i)(5)(C)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395r&num=0&edition=prelim',
      quotedText:
        'Subject to subparagraph (C), in the case of any calendar year beginning after 2007 (other than 2018 and 2019), each dollar amount in paragraph (2) or (3) shall be increased by an amount equal to- (i) such dollar amount, multiplied by (ii) the percentage (if any) by which the average of the Consumer Price Index for all urban consumers (United States city average) for the 12-month period ending with August of the preceding calendar year exceeds such average for the 12-month period ending with August 2006 (or, in the case of a calendar year beginning with 2020, August 2018). (B) Rounding If any dollar amount after being increased under subparagraph (A) or (C) is not a multiple of $1,000, such dollar amount shall be rounded to the nearest multiple of $1,000. (C) Treatment of adjustments for certain higher income individuals (i) In general Subparagraph (A) shall not apply with respect to each dollar amount in paragraph (3) of $500,000. (ii) Adjustment beginning 2028 In the case of any calendar year beginning after 2027, each dollar amount in paragraph (3) of $500,000 shall be increased by an amount equal to- (I) such dollar amount, multiplied by (II) the percentage (if any) by which the average of the Consumer Price Index for all urban consumers (United States city average) for the 12-month period ending with August of the preceding calendar year exceeds such average for the 12-month period ending with August 2026.',
    }, {
      kind: 'statute',
      citation: '42 USC 1395r(i)(3)(C)(ii)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395r&num=0&edition=prelim',
      quotedText:
        'In the case of a joint return, clause (i) shall be applied by substituting dollar amounts which are twice the dollar amounts otherwise applicable under clause (i) for the calendar year except, with respect to the dollar amounts applied in the last row of the table under subclause (III) of such clause (and the second dollar amount specified in the second to last row of such table), clause (i) shall be applied by substituting dollar amounts which are 150 percent of such dollar amounts for the calendar year.',
    }, {
      kind: 'regulation',
      citation: 'CMS, Medicare Part B Monthly Actuarial Rates, Premium Rates, and Annual Deductible Beginning January 1, 2026, 90 FR 52063 (Nov. 19, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-19/html/2025-20251.htm',
      quotedText:
        'For years beginning in 2019, the BBA of 2018 established a new income threshold. If a beneficiary\'s modified adjusted gross income is greater than or equal to $500,000 for a beneficiary filing an individual income tax return and $750,000 for a beneficiary filing a joint tax return, the beneficiary is responsible for 85 percent of the estimated total cost of Part B coverage. The BBA of 2018 specified that these new income threshold levels be inflation-adjusted beginning in 2028.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2019,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/medicare.ts',
      'packages/engine/src/insights/detectors/irmaaTierEdge.ts',
      'packages/engine/src/projection/simulate.ts',
      'packages/engine/src/params/data/year2026.ts',
    ],
  },
  'usc-42-1395r-a-3-part-b-standard-premium': {
    title: 'The standard Part B premium is half the aged actuarial rate plus a repayment amount',
    statement:
      'The Secretary determines the monthly actuarial rate for enrollees age 65 and over each September as the amount needed for those enrollees to fund one half of the benefits and administrative costs attributable to them, and then promulgates a standard monthly premium equal to 50 percent of that rate, which is why the standard premium is described as roughly 25 percent of program cost. For 2026 the aged actuarial rate is 405.40 and the promulgated standard premium is 202.90, which is 50 percent of the rate plus a 0.20 repayment amount required under current law. The premium is re-determined every year against projected program cost and tracks no published price index, so a projected year needs a medical cost path rather than general inflation, and the promulgated figure must be read rather than re-derived: halving the actuarial rate alone loses the repayment amount.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The repayment amount rides on the standard premium but is not part of the income-related scaling, so deriving a tier premium as the standard premium times the applicable percentage over 25 reproduces the promulgated table only to within a few cents. That residual is accepted as planning-grade rather than carrying a separate per-tier premium table. The Federal Register determination is registered under the regulation authority kind because the enum has no member for an agency determination published in the Federal Register, and adding one is a schema decision rather than a research finding; the choice is named here rather than left silent.',
    authority: [{
      kind: 'statute',
      citation: '42 USC 1395r(a)(1), (a)(3)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section1395r&num=0&edition=prelim',
      quotedText:
        'The Secretary shall, during September of 1983 and of each year thereafter, determine the monthly actuarial rate for enrollees age 65 and over which shall be applicable for the succeeding calendar year. Subject to paragraphs (5), (6), and (7), such actuarial rate shall be the amount the Secretary estimates to be necessary so that the aggregate amount for such calendar year with respect to those enrollees age 65 and older will equal one-half of the total of the benefits and administrative costs which he estimates will be payable from the Federal Supplementary Medical Insurance Trust Fund for services performed and related administrative costs incurred in such calendar year with respect to such enrollees ... The Secretary, during September of each year, shall determine and promulgate a monthly premium rate for the succeeding calendar year that (except as provided in subsection (g)) is equal to 50 percent of the monthly actuarial rate for enrollees age 65 and over, determined according to paragraph (1), for that succeeding calendar year.',
    }, {
      kind: 'regulation',
      citation: 'CMS, Medicare Part B Monthly Actuarial Rates, Premium Rates, and Annual Deductible Beginning January 1, 2026, 90 FR 52063 (Nov. 19, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-19/html/2025-20251.htm',
      quotedText:
        'The monthly actuarial rates for 2026 are $405.40 for aged enrollees and $548.60 for disabled enrollees. The standard monthly Part B premium rate for all enrollees for 2026 is $202.90, which is equal to 50 percent of the monthly actuarial rate for aged enrollees (or approximately 25 percent of the expected average total cost of Part B coverage for aged enrollees) plus the $0.20 repayment amount required under current law.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/index.ts',
      'packages/engine/src/tax/medicare.ts',
    ],
  },
  'cfr-20-404-1574-b-2-sga-non-blind-monthly-amount': {
    title: 'The non-blind substantial gainful activity amount is set by regulation and wage-indexed',
    statement:
      'The monthly earnings level that ordinarily shows substantial gainful activity for a non-blind beneficiary is fixed by regulation rather than by the Act, which supplies a formula only for the statutorily blind amount. Under 20 CFR 404.1574(b)(2)(ii) it is redetermined each year as the larger of the amount for the previous year and 700 multiplied by the ratio of the national average wage index for the second preceding year to that for 1998, rounded to the nearest multiple of 10. For 2026 that product is 1,694.05 and the amount is 1,690 a month, which the determination states supersedes 1,620. Two consequences follow. The figure moves with wages rather than prices, so carrying it forward on a consumer-price factor drifts low. And because it gates the whole SSDI benefit for the year rather than reducing it, an amount one year stale flips the benefit off for a beneficiary earning between the old and new levels.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The projection compares annual wages against twelve times the monthly amount, which is an annual-granularity stand-in: the regulation applies the level to average monthly earnings, so a beneficiary whose earnings are concentrated in part of the year is treated differently by the two. The regulation is also carried forward on the general inflation assumption rather than on the national average wage index, for want of a wage path in the engine. The Federal Register determination that fixes the year figure is registered under the regulation authority kind, which is also where the underlying 20 CFR provision sits; the enum has no member for an agency determination published in the Federal Register, and adding one is a schema decision rather than a research finding.',
    authority: [{
      kind: 'regulation',
      citation: '20 CFR 404.1574(b)(2)(ii)',
      url: 'https://www.ecfr.gov/current/title-20/section-404.1574',
      quotedText:
        'Beginning January 1, 2001, and each year thereafter, they average more than the larger of: (A) The amount for the previous year, or (B) An amount adjusted for national wage growth, calculated by multiplying $700 by the ratio of the national average wage index for the year 2 calendar years before the year for which the amount is being calculated to the national average wage index for the year 1998. We will then round the resulting amount to the next higher multiple of $10 where such amount is a multiple of $5 but not of $10 and to the nearest multiple of $10 in any other case.',
    }, {
      kind: 'regulation',
      citation: 'SSA, Cost-of-Living Increase and Other Determinations for 2026, 90 FR 49047 (Nov. 3, 2025)',
      url: 'https://www.govinfo.gov/content/pkg/FR-2025-11-03/html/2025-19763.htm',
      quotedText:
        'Section 223(d)(4)(A) of the Act specifies the formula for determining the SGA amount for statutorily blind individuals under title II while our regulations (20 CFR 404.1574 and 416.974) specify the formula for determining the SGA amount for non-blind individuals with a determined disability. ... Multiplying the 2000 monthly SGA amount for non-blind individuals with a determined disability ($700) by the ratio of the national average wage index for 2024 ($69,846.57) to that for 1998 ($28,861.44) produces $1,694.05. We then round this amount to $1,690. Because $1,690 exceeds the current amount of $1,620, the monthly SGA amount for non-blind individuals with a determined disability is $1,690 for 2026.',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/socialSecurity/disability.ts',
      'packages/engine/src/projection/simulate.ts',
    ],
  },
  'irc-3101-a-oasdi-employee-tax-rate': {
    title: 'The employee-side OASDI rate is a flat statutory percentage',
    statement:
      'IRC 3101(a) imposes the old-age, survivors, and disability insurance tax on the employee at 6.2 percent of wages. The subsection states a single percentage, with no table of future rates and no cost-of-living provision, so the rate has been 6.2 percent since 1990 and moves only by legislation. The employer pays the same again under 3111(a) and a self-employed individual pays the combined 12.4 percent under 1401(a), which is why a lifetime-contributions readout has to say which side of the payroll tax it is describing: quoting 12.4 for an employee doubles what the person actually paid, and quoting 6.2 for a self-employed person halves it.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'The rate is carried in the parameter pack and consumed outside the engine, by the Social Security analysis page in the planner package, which the registry cannot name because implementedBy is checked against engine sources. The pack and its type are listed instead, which are the files a later reader would change.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 3101(a)',
      url: 'https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title26-section3101&num=0&edition=prelim',
      quotedText:
        'In addition to other taxes, there is hereby imposed on the income of every individual a tax equal to 6.2 percent of the wages (as defined in section 3121(a)) received by the individual with respect to employment (as defined in section 3121(b)).',
    }],
    volatility: 'staticStatute',
    effectiveFrom: 1990,
    effectiveThrough: null,
    verifiedOn: '2026-08-03',
    implementedBy: [
      'packages/engine/src/params/data/year2026.ts',
      'packages/engine/src/params/types.ts',
    ],
  },
  'irc-63-c-7-B-ii-conformed-state-deduction-tracks-federal': {
    title: 'A state deduction defined by reference to the federal one moves when the federal one moves',
    statement:
      'The basic standard deduction is increased for every taxable year beginning after 2025, so its value is a function of the year rather than a constant. Nine state packs (AZ, CO, DC, IA, ID, MO, MT, ND, NM) do not carry a state figure at all -- they carry a copy of the federal one, because their law defines the state deduction by reference to it or, for CO and ND, because their brackets run on federal taxable income and this field is what converts the engine gross base into that base. The copy is the same statutory amount as the original, so it takes the original value in every projected year. Holding it at the pack year while the federal figure is projected forward puts two different values on one amount inside a single year and taxes the whole widening difference at the state rate.',
    classification: 'settled',
    contraryReading: null,
    conventionRationale:
      'This record is anchored federally because the proposition is federal: nothing here decides how a state adjusts a figure of its own, it keeps a borrowed federal figure equal to the federal figure. Two boundaries follow from that and are deliberate. State BRACKETS are not touched -- those are state dollar amounts under state law, some indexed, some fixed by statute, several on legislated rate ramps, and the per-state research to move any of them does not exist yet -- and neither are the state retirement-exclusion caps, which are likewise state figures (the Colorado 24,000 dollar pension subtraction is not indexed by Colorado law). A state that decouples from the federal amount simply loses the conformity tag and stops moving; Maine and South Carolina did exactly that for 2026 and are untagged. The scaling factor is the plan assumed general inflation rather than the C-CPI-U of section 1(f)(3), and the statutory rounding of the increase to the next lowest multiple of 50 dollars is not reproduced -- the same two approximations indexFederalTaxPack already makes, and they must be the same ones, because a conformed copy indexed on any other basis would diverge from the federal figure it is a copy of.',
    authority: [{
      kind: 'statute',
      citation: 'IRC 63(c)(7)(B)(ii)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'In the case of a taxable year beginning after 2025, the 23,625 dollar and 15,750 dollar amounts in subparagraph (A) shall each be increased by an amount equal to - (I) such dollar amount, multiplied by (II) the cost-of-living adjustment determined under section 1(f)(3) for the calendar year in which the taxable year begins, determined by substituting 2024 for 2016 in subparagraph (A)(ii) thereof. If any increase under this clause is not a multiple of 50 dollars, such increase shall be rounded to the next lowest multiple of 50 dollars.',
    }, {
      kind: 'statute',
      citation: 'IRC 63(c)(7)(A)',
      url: 'https://www.law.cornell.edu/uscode/text/26/63',
      quotedText:
        'Increase in standard deduction. Paragraph (2) shall be applied - (i) by substituting 23,625 dollars for 4,400 dollars in subparagraph (B), and (ii) by substituting 15,750 dollars for 3,000 dollars in subparagraph (C).',
    }],
    volatility: 'annuallyIndexed',
    effectiveFrom: 2026,
    effectiveThrough: null,
    verifiedOn: '2026-08-04',
    implementedBy: [
      'packages/engine/src/params/state/index.ts',
      'packages/engine/src/tax/stateTax.ts',
      'packages/engine/src/params/state/data/year2026.ts',
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
