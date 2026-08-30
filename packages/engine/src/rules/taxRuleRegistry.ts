/**
 * The tax rule registry: its types, its composition, and its helpers.
 *
 * The records themselves live in the per-domain modules under `./records/`,
 * one statutory rule per frozen record, which this file spreads into the single
 * frozen `TAX_RULE_REGISTRY`. A record carries the authority it rests on, the
 * reading we took, and the date that reading was last verified against primary
 * sources. The registry is the single answer to "why are we calculating it this
 * way" — for a test, for a reviewer, for a report, and for an advisor defending
 * a number to a CPA. Reading a record means opening its module; reading the
 * shape a record must have, or the re-verification helpers over the whole set,
 * means staying here.
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
 * Adding a rule means doing the primary-source research first, then writing the
 * record into the `./records/` module for its domain. A record whose
 * `authority` is thin is worse than no record, because it lends unearned
 * confidence to a guess.
 */

import { charitableDeductionRecords } from './records/charitableDeductions.js'
import { charitableDistributionRecords } from './records/charitableDistributions.js'
import { iraBasisAndRolloverRecords } from './records/iraBasisAndRollovers.js'
import { requiredMinimumDistributionRecords } from './records/requiredMinimumDistributions.js'
import { rothAccountRecords } from './records/rothAccounts.js'
import { earlyDistributionAndSeppRecords } from './records/earlyDistributionsAndSepp.js'
import { annuityRecords } from './records/annuities.js'
import { contributionAndDeferralLimitRecords } from './records/contributionAndDeferralLimits.js'
import { healthSavingsAccountRecords } from './records/healthSavingsAccounts.js'
import { medicareAndHealthCoverageRecords } from './records/medicareAndHealthCoverage.js'
import { socialSecurityRecords } from './records/socialSecurity.js'
import { investmentIncomeAndBasisRecords } from './records/investmentIncomeAndBasis.js'
import { individualIncomeTaxRecords } from './records/individualIncomeTax.js'
import { transferAndUnmodeledRegimeRecords } from './records/transfersAndUnmodeledRegimes.js'
import { northeastStateRecords } from './records/statesNortheast.js'
import { midwestStateRecords } from './records/statesMidwest.js'
import { southAtlanticStateRecords } from './records/statesSouthAtlantic.js'
import { southCentralStateRecords } from './records/statesSouthCentral.js'
import { westStateRecords } from './records/statesWest.js'

/**
 * Where a rule's authority comes from, strongest first.
 *
 * `stateAgencyPublication` is the one member that is not admissible everywhere.
 * It names a state revenue department's or state legislature's own authoritative
 * statement of what its state does or does not levy — the South Dakota
 * Department of Revenue's "South Dakota is one of seven states that does not
 * impose a state income tax", the Tennessee Department of Revenue's statement
 * that the Hall tax is repealed. That is a real primary source for a state's
 * own law and it is the ONLY affirmative text a negative claim can rest on:
 * an absent chapter has no operative language to quote, so a state that levies
 * nothing can be cited only to whoever is entitled to say so.
 *
 * It has no authority whatever over a federal rule, which is why the conformance
 * suite refuses it on a `federal` record the same way the publisher tier refuses
 * a state host there. Before this member existed the alternatives were to write
 * `irsPublication` over a `dor.sd.gov` URL — wrong on its face — or to stretch
 * `formInstruction` to cover a department topic page, which is not a form and
 * carries no instruction. Both would have laundered a state agency's statement
 * into a kind that says "the IRS published this".
 *
 * `agencyGuidance` names an agency's published manual or interpretive guidance,
 * such as SSA's POMS. It is neither a regulation nor legislative history, and
 * must not be relabeled as either merely because a rule also rests on statute.
 */
export type TaxRuleAuthorityKind =
  | 'statute'
  | 'regulation'
  | 'agencyGuidance'
  | 'irsPublication'
  | 'formInstruction'
  | 'irsNotice'
  | 'legislativeHistory'
  | 'stateAgencyPublication'

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
 * - `approximated` — the engine computes and returns a figure that is knowably
 *   not the one the authority requires. It must state which way that figure
 *   errs in `errorDirection`, because a wrong number a consumer can act on is
 *   more dangerous than no number: it has a sign, and the sign decides whether
 *   the taxpayer is merely over-charged or is being told they owe less than
 *   they do.
 * - `outOfScope` — the engine produces no figure from this rule at all. Two
 *   shapes qualify, and only these two. Either it fails closed — a typed
 *   refusal, an `unsupported` outcome, or a `notEstablished` reconciliation
 *   naming the missing rule — or the fact the rule turns on cannot be expressed
 *   in the input model at all, so no accepted input reaches the rule. What does
 *   NOT qualify is computing an answer anyway; that is `approximated`.
 *
 * The line between the last two is the whole point of splitting them. Before
 * the split, `outOfScope` was carrying both refusals and approximations, and a
 * reader who trusted the doc comment would have believed 24 records refused
 * when in fact they returned a number.
 */
export type TaxRuleClassification = 'settled' | 'unsettled' | 'approximated' | 'outOfScope'

/**
 * Which way an `approximated` rule's computed figure departs from the figure
 * the authority requires.
 *
 * The referent is the taxpayer's exposure to the fisc across the years the rule
 * touches — income tax, the additional tax under 72(t) and 223(f), and the
 * excise tax under 4973 and 4974 alike. It is deliberately NOT the intermediate
 * quantity the rule names. A rule that governs a deduction, an exclusion, a
 * contribution limit, or a required distribution is stated by what its error
 * does to tax, not by whether the intermediate figure came out numerically
 * larger. Anchoring on the intermediate quantity would make the field
 * incomparable across records: "overstates" would mean opposite things for a
 * deduction record and a taxable-income record, and the field would answer a
 * different question each time it was read.
 *
 * - `understatesTax` — the engine's figure flatters the taxpayer. This is the
 *   dangerous direction: a consumer acting on it under-withholds, over-gives,
 *   or over-converts, and finds out from the return.
 * - `overstatesTax` — the engine charges more than the authority does. Wrong,
 *   but it fails toward caution.
 * - `bothDirections` — the sign depends on the facts or on the projection year.
 *   This covers a timing shift that nets to zero over a lifetime, because in an
 *   annual projection the year is not a detail: a spike lands in a bracket, in
 *   the capital-gain stacking threshold, and in the income the Medicare premium
 *   adjustment reads two years later. `bothDirections` means the direction was
 *   determined and found to vary, never that it was not determined.
 */
export type TaxRuleErrorDirection = 'understatesTax' | 'overstatesTax' | 'bothDirections'

/**
 * The sovereign whose law creates the rule, which decides what may be cited for
 * it.
 *
 * Federal tax law and state income tax law do not share publishers: the first
 * comes from the Code, the CFR, and the IRS, the second from a state code and a
 * state revenue department. A single publisher list cannot serve both without
 * admitting every state host as authority for every federal rule, so the record
 * declares which sovereign it belongs to and the conformance guard picks the
 * tier from that.
 *
 * Declared as a field rather than derived from the rule id or from an
 * authority's `kind`, because both of those let a record widen what it may cite
 * as a side effect of something else. An id prefix is a free-form string a typo
 * can silently move into the more permissive tier; an authority `kind` is a
 * property of the citation being checked, so a record could authorize its own
 * source by labelling it. A required field with a closed union can only be
 * changed on purpose, and the compiler names every record when it changes.
 */
export type TaxRuleJurisdiction = 'federal' | `state:${UsStateCode}`

/**
 * Postal codes for the fifty states and the District of Columbia, closing the
 * `state:` half of `TaxRuleJurisdiction` so a mistyped code is a compile error
 * rather than a record whose state tier silently resolves to nothing.
 */
export const US_STATE_CODES = Object.freeze([
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL',
  'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH',
  'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI',
  'WY',
] as const)

export type UsStateCode = (typeof US_STATE_CODES)[number]

export interface TaxRuleRecord {
  readonly title: string
  /** The rule in one sentence, stated so a fixture can be written from it. */
  readonly statement: string
  readonly classification: TaxRuleClassification
  /** Required when `classification` is `unsettled`: the reading we rejected. */
  readonly contraryReading: string | null
  /**
   * Required when `classification` is `approximated`, and null otherwise: which
   * way the computed figure errs against the authority. See
   * `TaxRuleErrorDirection` for the referent, which is the taxpayer's tax
   * exposure rather than the quantity the rule names.
   *
   * Typed rather than left to prose in `conventionRationale` for two reasons.
   * A convention cannot be enforced, so it decays to whichever records happened
   * to be written while someone was watching; and `conventionRationale` is null
   * on most of the records that need a direction, because it answers a
   * different question — why an engineering convention was picked where no
   * authority selects one. An approximation is not a convention. Overloading
   * one field with both would erase a distinction the registry already draws.
   */
  readonly errorDirection: TaxRuleErrorDirection | null
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
  /**
   * The sovereign whose law creates the rule. Sits next to `authority` because
   * it decides which publisher tier the citations below may be drawn from: a
   * federal rule may cite only federal publishers, a state rule may cite its
   * own state's publishers and the federal ones its state code incorporates by
   * reference. Enforced by `taxRuleRegistry.conformance.test.ts`.
   */
  readonly jurisdiction: TaxRuleJurisdiction
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
  /**
   * The operative functions inside `implementedBy`, as `<repo-relative
   * path>#<symbol>` entries whose path half must appear in `implementedBy`
   * and whose symbol must exist in that file. A member whose bare name
   * repeats in the file (a per-state pack field) must be qualified by its
   * immediate parent (`ND.capitalGainsTaxablePct`); conformance refuses the
   * ambiguous bare pin because the manifest publishes each pin's declaration
   * line as a deep-link anchor. Required and non-empty: the backfill covered
   * every record, and this stays a ratchet - conformance fails the build
   * when a symbol disappears from its file, so the public transparency page
   * can never name a function that no longer exists.
   */
  readonly implementedByFunctions: readonly [string, ...string[]]
}

/**
 * The registry, composed from the per-domain record modules in `./records/`.
 *
 * Split into modules purely for navigation: the records are the same records,
 * spread in one place so `TaxRuleId` stays a single closed union over all of
 * them. Spread lets a later duplicate key silently win, so
 * `taxRuleRegistry.conformance.test.ts` asserts that the per-module key counts
 * sum to the registry total; a key registered twice fails there.
 */
// `satisfies` without `as const`: keys and the union-typed fields
// (classification, kind, volatility) stay literal for describeRule's
// conditional typing, while the prose strings widen to `string` - past ~330
// records the fully-literal type exceeds the compiler's
// declaration-serialization limit (TS7056) under the build config.
const registry = {
  ...charitableDeductionRecords,
  ...charitableDistributionRecords,
  ...iraBasisAndRolloverRecords,
  ...requiredMinimumDistributionRecords,
  ...rothAccountRecords,
  ...earlyDistributionAndSeppRecords,
  ...annuityRecords,
  ...contributionAndDeferralLimitRecords,
  ...healthSavingsAccountRecords,
  ...medicareAndHealthCoverageRecords,
  ...socialSecurityRecords,
  ...investmentIncomeAndBasisRecords,
  ...individualIncomeTaxRecords,
  ...transferAndUnmodeledRegimeRecords,
  ...northeastStateRecords,
  ...midwestStateRecords,
  ...southAtlanticStateRecords,
  ...southCentralStateRecords,
  ...westStateRecords,
} satisfies Record<string, TaxRuleRecord>

// Compile-time proof that `satisfies` (without `as const`) keeps the
// union-typed fields literal: contextual typing against a union of literals
// blocks widening, so classification stays 'approximated' (not string) and
// describeRule's produced-pin conditionals keep working. If a future edit
// reintroduces widening, these lines fail to compile before any fixture does.
type _ApproximatedStaysLiteral =
  (typeof registry)['poms-rs-00615-320-rib-lim-after-survivor-reduction']['classification'] extends 'approximated'
    ? true
    : never
type _SettledStaysLiteral =
  (typeof registry)['irc-1211-b-capital-loss-ordinary-offset']['classification'] extends 'settled'
    ? true
    : never
const _classificationLiteralGuards: [_ApproximatedStaysLiteral, _SettledStaysLiteral] = [true, true]
void _classificationLiteralGuards

export const TAX_RULE_REGISTRY = Object.freeze(registry)

/**
 * The same modules the spread above composes, paired with their file basenames,
 * as data rather than syntax. The spread has to stay a spread — that is what
 * keeps `TaxRuleId` a closed literal union — so this list is written beside it
 * and must be kept in step; `taxRuleRegistry.conformance.test.ts` fails when it
 * drifts from `records/` on disk, and its per-module key counts must still sum
 * to the registry total, which is what catches a duplicate id the spread would
 * otherwise swallow.
 *
 * Consumers use it for the *contention unit*: the coverage ledger is sharded
 * one JSON file per module (`DOCS/operations/rule-coverage/<module>.json`) and
 * the dispatch tooling locks a handoff to the modules it actually edits, so two
 * re-verifications in different domains no longer collide on one 30k-line file.
 */
export const TAX_RULE_RECORD_MODULES: readonly (readonly [
  string,
  Readonly<Record<string, TaxRuleRecord>>,
])[] = Object.freeze([
  ['annuities', annuityRecords],
  ['charitableDeductions', charitableDeductionRecords],
  ['charitableDistributions', charitableDistributionRecords],
  ['contributionAndDeferralLimits', contributionAndDeferralLimitRecords],
  ['earlyDistributionsAndSepp', earlyDistributionAndSeppRecords],
  ['healthSavingsAccounts', healthSavingsAccountRecords],
  ['individualIncomeTax', individualIncomeTaxRecords],
  ['investmentIncomeAndBasis', investmentIncomeAndBasisRecords],
  ['iraBasisAndRollovers', iraBasisAndRolloverRecords],
  ['medicareAndHealthCoverage', medicareAndHealthCoverageRecords],
  ['requiredMinimumDistributions', requiredMinimumDistributionRecords],
  ['rothAccounts', rothAccountRecords],
  ['socialSecurity', socialSecurityRecords],
  ['statesMidwest', midwestStateRecords],
  ['statesNortheast', northeastStateRecords],
  ['statesSouthAtlantic', southAtlanticStateRecords],
  ['statesSouthCentral', southCentralStateRecords],
  ['statesWest', westStateRecords],
  ['transfersAndUnmodeledRegimes', transferAndUnmodeledRegimeRecords],
] as const)

export type TaxRuleId = keyof typeof TAX_RULE_REGISTRY

export const taxRuleIds = Object.freeze(
  Object.keys(TAX_RULE_REGISTRY).sort() as readonly TaxRuleId[],
)

export function taxRule(ruleId: TaxRuleId): Readonly<TaxRuleRecord> {
  return TAX_RULE_REGISTRY[ruleId]
}

/**
 * UTC calendar date on which a rule becomes due for re-verification:
 * `verifiedOn` plus the interval for its volatility. A rule is due exactly when
 * `asOfIsoDate >= taxRuleDueOn(ruleId)`, matching `taxRulesDueForVerification`.
 */
export function taxRuleDueOn(
  ruleId: TaxRuleId,
  intervals: Readonly<Record<TaxRuleVolatility, number>> = DEFAULT_REVERIFICATION_INTERVAL_DAYS,
): string {
  const rule = TAX_RULE_REGISTRY[ruleId]
  const interval = intervals[rule.volatility]
  if (!Number.isFinite(interval) || interval < 0 || !Number.isInteger(interval)) {
    throw new RangeError(`Re-verification interval for ${rule.volatility} must be a non-negative whole number of days`)
  }
  const due = new Date(`${rule.verifiedOn}T00:00:00Z`)
  due.setUTCDate(due.getUTCDate() + interval)
  return due.toISOString().slice(0, 10)
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
  if (new Date(`${asOfIsoDate}T00:00:00Z`).toISOString().slice(0, 10) !== asOfIsoDate) {
    throw new RangeError('As-of date must be an ISO calendar date')
  }
  // A missing or non-finite interval would make every comparison false and
  // silently report the rule as never due, which is the one failure mode this
  // function must not have.
  for (const volatility of TAX_RULE_VOLATILITIES) {
    const interval = maximumAgeDaysByVolatility[volatility]
    if (!Number.isFinite(interval) || interval < 0 || !Number.isInteger(interval)) {
      throw new RangeError(`Re-verification interval for ${volatility} must be a non-negative whole number of days`)
    }
  }
  return taxRuleIds.filter((ruleId) => asOfIsoDate >= taxRuleDueOn(ruleId, maximumAgeDaysByVolatility))
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
