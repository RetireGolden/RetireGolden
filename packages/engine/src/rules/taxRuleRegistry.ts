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
export type TaxRuleVolatility =
  | 'staticStatute'
  | 'annuallyIndexed'
  | 'awaitingGuidance'
  | 'sunsetting'

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
  const asOf = Date.parse(`${asOfIsoDate}T00:00:00Z`)
  if (Number.isNaN(asOf)) throw new RangeError('As-of date must be an ISO calendar date')
  return taxRuleIds.filter((ruleId) => {
    const rule: TaxRuleRecord | undefined = TAX_RULE_REGISTRY[ruleId]
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
