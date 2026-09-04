import { describe } from 'vitest'
import { TAX_RULE_REGISTRY, type TaxRuleId, type TaxRuleRecord } from './taxRuleRegistry.js'

/**
 * Declares that a suite covers a registered tax rule, and forces the fixture to
 * discriminate between candidate readings of it.
 *
 * A fixture written by reading the implementation can only confirm what the
 * implementer already believed. The fixture that locked this engine's IRC
 * 170(b)(1)(I) ordering defect returned the same number under both candidate
 * orderings: green, and worthless. `readings` closes that hole by construction —
 * a suite must name at least two candidate readings whose expected values
 * differ, and say which one the authority supports. A fixture that cannot
 * distinguish the readings cannot be registered as covering the rule.
 *
 * @example
 * describeRule('irc-170-b-1-I-floor-ordering', {
 *   readings: { statute: 450, rejectedFloorBeforeCeiling: 500 },
 *   accepted: 'statute',
 * }, ({ accepted }) => {
 *   it('claims the post-ceiling amount less the floor', () => {
 *     expect(claimedCents).toBe(accepted)
 *   })
 * })
 *
 * @example
 * // An `approximated` rule inverts the assertion: the engine is expected NOT
 * // to produce the accepted reading, and `produced` says what it gives instead.
 * describeRule('irc-213-a-medical-expense-deduction', {
 *   readings: { statute: 125_000, engineOmitsMedicalEntirely: 60_000 },
 *   accepted: 'statute',
 *   produced: 'engineOmitsMedicalEntirely',
 * }, ({ accepted, produced }) => {
 *   it('deducts nothing for unreimbursed care above the floor', () => {
 *     expect(deduction).toBe(produced)
 *     expect(deduction).not.toBe(accepted)
 *   })
 * })
 */
export interface RuleFixtureSpec<Readings extends Readonly<Record<string, unknown>>> {
  /**
   * Candidate readings of the rule and the value each one predicts. At least
   * two, with distinct values — that is what makes the fixture discriminating.
   */
  readonly readings: Readings
  /** The reading the registered authority supports. */
  readonly accepted: keyof Readings & string
  /**
   * Short label naming the question THIS fixture settles, for a rule covered by
   * more than one of them. Appended to the suite name.
   *
   * A rule needs a second fixture whenever it turns on two independent
   * questions, because one spec cannot hold both — the readings would collide
   * on a value, which `readings` refuses below. So IRC 72(b) takes one fixture
   * for the exclusion ratio and another for the (b)(2) cap. Without a label the
   * suites are indistinguishable in the reporter, and a failure names the rule
   * rather than the reading that broke.
   *
   * Trimmed before it reaches the suite name, and omitted entirely when that
   * leaves nothing, so a blank label cannot leave a dangling separator or make
   * two suites differ only by surrounding whitespace.
   */
  readonly note?: string
}

/**
 * Obligation on the fixture for an `approximated` rule: name the reading the
 * engine actually produces, which cannot be the accepted one.
 *
 * An approximated record is a claim about what this engine gets *wrong*. Left
 * unpinned it is the only kind of registry entry that rots in the direction of
 * looking responsible: two of them survived on main describing gaps that had
 * been closed on a parallel branch, one of them contradicting a `settled`
 * record about the same statute. Nothing failed, because nothing was watching.
 *
 * Requiring `produced` closes that. The fixture asserts the engine returns the
 * approximated figure, so the day someone fixes the behaviour the assertion
 * fails and names the record that has to be reclassified. The gap is pinned by
 * the same discriminating machinery as the readings themselves.
 *
 * The requirement is a compile error rather than a runtime throw because the
 * registry is `as const`, so the classification of a literal rule ID is known
 * to the checker. A widened `TaxRuleId` degrades to the runtime guard below.
 */
export type RuleApproximationSpec<
  Id extends TaxRuleId,
  Readings extends Readonly<Record<string, unknown>>,
> = (typeof TAX_RULE_REGISTRY)[Id]['classification'] extends 'approximated'
  ? { readonly produced: keyof Readings & string }
  : { readonly produced?: undefined }

export interface RuleFixtureContext<
  Id extends TaxRuleId,
  Readings extends Readonly<Record<string, unknown>>,
> {
  /** The value predicted by the accepted reading. */
  readonly accepted: Readings[keyof Readings]
  /**
   * The value this engine actually produces, for an `approximated` rule; null
   * for every other classification, where the accepted reading is what the
   * engine is expected to return.
   *
   * Narrowed by the same conditional as `produced` on the spec, so an
   * approximated fixture can assert against it without a null check. Widening
   * this to `| null` unconditionally would put a non-null assertion in every
   * one of these fixtures, which is noise in exactly the tests whose whole
   * purpose is to be read closely.
   */
  readonly produced: (typeof TAX_RULE_REGISTRY)[Id]['classification'] extends 'approximated'
    ? Readings[keyof Readings]
    : null
  /** Every candidate reading, for tests that assert the others are not produced. */
  readonly readings: Readings
  readonly ruleId: TaxRuleId
}

export function describeRule<
  const Id extends TaxRuleId,
  const Readings extends Readonly<Record<string, unknown>>,
>(
  ruleId: Id,
  spec: RuleFixtureSpec<Readings> & RuleApproximationSpec<Id, Readings>,
  suite: (context: RuleFixtureContext<Id, Readings>) => void,
): void {
  const rule: TaxRuleRecord | undefined = TAX_RULE_REGISTRY[ruleId]
  if (rule === undefined) {
    throw new RangeError(`Unknown tax rule: ${ruleId}`)
  }
  if (rule.classification === 'outOfScope') {
    throw new RangeError(
      rule.outOfScope.shape === 'inexpressibleInput'
        ? `Rule ${ruleId} is out of scope with shape 'inexpressibleInput'; no accepted input reaches it, so there is nothing to fixture. Its obligation is missingInputFacts, not describeRule or describeRefusal`
        : `Rule ${ruleId} is out of scope with shape 'typedRefusal'; cover the refusal with describeRefusal instead of a computed value`,
    )
  }

  const entries = Object.entries(spec.readings)
  if (entries.length < 2) {
    throw new RangeError(
      `Rule ${ruleId} needs at least two candidate readings; a fixture that cannot distinguish readings proves nothing about the rule`,
    )
  }
  const serialized = entries.map(([, value]) => JSON.stringify(value))
  if (new Set(serialized).size !== serialized.length) {
    throw new RangeError(
      `Rule ${ruleId} has candidate readings predicting identical values; choose inputs under which the readings disagree`,
    )
  }
  if (!Object.hasOwn(spec.readings, spec.accepted)) {
    throw new RangeError(`Rule ${ruleId} accepted reading is not among its candidate readings`)
  }

  const produced: string | undefined = spec.produced
  if (rule.classification === 'approximated') {
    if (produced === undefined) {
      throw new RangeError(
        `Rule ${ruleId} is approximated; name the reading this engine produces so the fixture fails when the gap closes`,
      )
    }
    if (!Object.hasOwn(spec.readings, produced)) {
      throw new RangeError(`Rule ${ruleId} produced reading is not among its candidate readings`)
    }
    if (produced === spec.accepted) {
      throw new RangeError(
        `Rule ${ruleId} names the accepted reading as the one it produces; a rule the engine gets right is not approximated`,
      )
    }
  } else if (produced !== undefined) {
    // Refused rather than ignored. A settled rule whose fixture admits the
    // engine returns something else is not a settled rule with a caveat, it is
    // a misclassification — and reclassifying it is the point.
    throw new RangeError(
      `Rule ${ruleId} is ${rule.classification}, so it cannot name a produced reading that differs from the accepted one; reclassify it as approximated instead`,
    )
  }

  const note = spec.note?.trim()
  const label = note === undefined || note === '' ? '' : ` — ${note}`
  describe(`${ruleId} — ${rule.title}${label}`, () => {
    // The conditional type on `produced` cannot be satisfied structurally here:
    // `Id` is still generic inside the function body, so the checker has no
    // classification to resolve it against. The guards above are what make the
    // cast sound — an approximated rule has already been refused unless
    // `produced` names a reading, and every other classification has been
    // refused unless it names none.
    suite({
      accepted: spec.readings[spec.accepted] as Readings[keyof Readings],
      produced: (produced === undefined
        ? null
        : spec.readings[produced]) as RuleFixtureContext<Id, Readings>['produced'],
      readings: spec.readings,
      ruleId,
    })
  })
}
