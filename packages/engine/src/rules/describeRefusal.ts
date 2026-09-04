import { describe } from 'vitest'
import { TAX_RULE_REGISTRY, type TaxRuleId, type TaxRuleRecord } from './taxRuleRegistry.js'

/**
 * Declares that a suite covers a registered `outOfScope` rule, by driving the
 * typed refusal the record claims the engine returns instead of a figure.
 *
 * `describeRule` is the sibling of this helper and refuses an `outOfScope` id
 * outright, because there is no computed value to discriminate between
 * readings of. That refusal left the classification with no coverage
 * obligation at all: an `outOfScope` record asserts the engine fails closed,
 * and until now nothing checked that the refusal existed, still existed, or
 * still had the shape the record describes. That is exactly the rot the
 * `produced` field on `describeRule` was invented to stop, on the slice of the
 * registry (73 of 416 records, under a fifth) that says "we will not answer
 * this".
 *
 * The obligation this helper imposes is different in kind from a discriminating
 * reading, because the claim is different in kind. An `outOfScope` record makes
 * three assertions a reader can check, so the spec asks for all three:
 *
 *  - `entryPoint` — WHERE the refusal lives, as one of the record's own
 *    `implementedByFunctions` entries. Naming a symbol the record does not
 *    claim is rejected, so a fixture cannot drift onto a different module than
 *    the one the registry publishes, and renaming the refusal site without
 *    updating the record fails the conformance symbol guard rather than
 *    silently orphaning this fixture.
 *  - `outOfScopeInput` — WHAT the caller asked for that is out of scope.
 *  - `refusal` — WHAT comes back instead: the reason code, issue kind, or typed
 *    refusal record. This is the field that rots, and it is the reason the
 *    suite body must assert against the real engine entry point rather than
 *    restate the string.
 *
 * The suite body is where the assertion lives, and it must drive an exported
 * engine function. `entryPoint` may name a module-private symbol, because that
 * is what the registry records; the suite reaches it through whatever public
 * function calls it.
 *
 * @example
 * describeRefusal('irc-408-d-3-C-i-inherited-ira-rollover-bar', {
 *   entryPoint: 'packages/engine/src/strategies/accountEligibility.ts#evaluateConversion',
 *   outOfScopeInput: 'a Roth conversion whose source is a nonspouse inherited IRA',
 *   refusal: "reason code 'conversion-inherited-source', with no dollars moved",
 * }, () => {
 *   it('refuses the conversion rather than computing one', () => {
 *     expect(reasonCodesOf(evaluate(request, plan))).toContain('conversion-inherited-source')
 *   })
 * })
 */
export interface RuleRefusalSpec {
  /**
   * The refusal site, as a `<repo-relative path>#<symbol>` entry that must
   * appear verbatim in the record's `implementedByFunctions`.
   */
  readonly entryPoint: string
  /** The out-of-scope input, in one clause: what the caller asked for. */
  readonly outOfScopeInput: string
  /**
   * The refusal the engine returns instead of a figure: a reason code, an
   * issue kind, or the name of the typed refusal record.
   */
  readonly refusal: string
  /**
   * Short label naming the question THIS fixture settles, for a rule whose
   * refusal has more than one shape. Appended to the suite name, exactly as
   * `describeRule` does, and trimmed so a blank label cannot leave a dangling
   * separator.
   */
  readonly note?: string
}

export interface RuleRefusalContext {
  readonly ruleId: TaxRuleId
  readonly entryPoint: RuleRefusalSpec['entryPoint']
  readonly outOfScopeInput: RuleRefusalSpec['outOfScopeInput']
  readonly refusal: RuleRefusalSpec['refusal']
}

/**
 * Named for this module rather than `requireNonblankField`, because
 * `annualQcdPhysicalExecution.ts` and `annualSection68ItemizedDeduction.ts`
 * each have their own nonblank-field helper with its own throw contract; a
 * shared name across three incompatible signatures is the same drift the
 * shared-guard lint rule exists to prevent, one level down.
 */
function requireNonblankRefusalField(value: string, ruleId: string, field: string): string {
  const trimmed = value.trim()
  if (trimmed === '') {
    throw new RangeError(`Rule ${ruleId} refusal fixture needs a nonblank ${field}`)
  }
  return trimmed
}

export function describeRefusal(
  ruleId: TaxRuleId,
  spec: RuleRefusalSpec,
  suite: (context: RuleRefusalContext) => void,
): void {
  const rule: TaxRuleRecord | undefined = TAX_RULE_REGISTRY[ruleId]
  if (rule === undefined) {
    throw new RangeError(`Unknown tax rule: ${ruleId}`)
  }
  if (rule.classification !== 'outOfScope') {
    // Refused rather than allowed as a second way to claim coverage. A rule the
    // engine computes an answer for is covered by discriminating readings, and
    // a fixture that only pinned some refusal path on it would report coverage
    // while leaving the figure itself unwatched.
    throw new RangeError(
      `Rule ${ruleId} is ${rule.classification}, not outOfScope; cover its computed value with describeRule instead`,
    )
  }

  const entryPoint = requireNonblankRefusalField(spec.entryPoint, ruleId, 'entryPoint')
  if (!rule.implementedByFunctions.includes(entryPoint)) {
    throw new RangeError(
      `Rule ${ruleId} does not name ${entryPoint} in implementedByFunctions; a refusal fixture must drive a refusal site the record itself claims`,
    )
  }
  const outOfScopeInput = requireNonblankRefusalField(spec.outOfScopeInput, ruleId, 'outOfScopeInput')
  const refusal = requireNonblankRefusalField(spec.refusal, ruleId, 'refusal')

  const note = spec.note?.trim()
  const label = note === undefined || note === '' ? '' : ` — ${note}`
  describe(`${ruleId} — ${rule.title}${label}`, () => {
    suite({ ruleId, entryPoint, outOfScopeInput, refusal })
  })
}
