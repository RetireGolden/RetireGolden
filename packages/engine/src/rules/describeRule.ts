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
 */
export interface RuleFixtureSpec<Readings extends Readonly<Record<string, unknown>>> {
  /**
   * Candidate readings of the rule and the value each one predicts. At least
   * two, with distinct values — that is what makes the fixture discriminating.
   */
  readonly readings: Readings
  /** The reading the registered authority supports. */
  readonly accepted: keyof Readings & string
  /** Optional note on why the other readings are wrong, beyond the registry. */
  readonly note?: string
}

export interface RuleFixtureContext<Readings extends Readonly<Record<string, unknown>>> {
  /** The value predicted by the accepted reading. */
  readonly accepted: Readings[keyof Readings]
  /** Every candidate reading, for tests that assert the others are not produced. */
  readonly readings: Readings
  readonly ruleId: TaxRuleId
}

export function describeRule<const Readings extends Readonly<Record<string, unknown>>>(
  ruleId: TaxRuleId,
  spec: RuleFixtureSpec<Readings>,
  suite: (context: RuleFixtureContext<Readings>) => void,
): void {
  const rule: TaxRuleRecord | undefined = TAX_RULE_REGISTRY[ruleId]
  if (rule === undefined) {
    throw new RangeError(`Unknown tax rule: ${ruleId}`)
  }
  if (rule.classification === 'outOfScope') {
    throw new RangeError(
      `Rule ${ruleId} is out of scope; cover the typed refusal rather than a computed value`,
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

  describe(`${ruleId} — ${rule.title}`, () => {
    suite({
      accepted: spec.readings[spec.accepted] as Readings[keyof Readings],
      readings: spec.readings,
      ruleId,
    })
  })
}
