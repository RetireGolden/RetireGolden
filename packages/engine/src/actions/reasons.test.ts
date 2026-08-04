import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  ACTION_REASON_REGISTRY,
  actionPredicateNames,
  actionReasonCodes,
  actionReasonSchema,
  createActionReason,
  parseActionReason,
  partialActionReasonCodes,
  refusedActionReasonCodes,
  taxTreatmentAdjustmentReasonCodes,
  unsupportedActionReasonCodes,
  type ActionReason,
  type UnsupportedActionReasonCode,
} from './reasons.js'

const LOCKED_UNSUPPORTED_CODES = [
  'required-facts-missing',
  'withdrawal-taxable-basis-unsupported',
  'withdrawal-employer-basis-unsupported',
  'withdrawal-roth-ira-character-unsupported',
  'withdrawal-designated-roth-character-unsupported',
  'withdrawal-penalty-evidence-missing',
  'withdrawal-plan-availability-unknown',
  'withdrawal-rule-of-55-evidence-missing',
  'withdrawal-sepp-evidence-missing',
  'withdrawal-inherited-facts-missing',
  'withdrawal-spousal-owner-treatment-begun',
  'withdrawal-spousal-conversion-unsupported',
  'withdrawal-hsa-qualification-unknown',
  'withdrawal-source-type-unsupported',
  'withdrawal-aggregate-unallocated',
  'conversion-date-missing',
  'conversion-ira-subtype-unknown',
  'conversion-simple-two-year-rule-unknown',
  'conversion-roth-simple-destination-unsupported',
  'conversion-plan-availability-unknown',
  'conversion-employer-basis-unsupported',
  'conversion-employer-destination-unsupported',
  'conversion-basis-evidence-missing',
  'conversion-tax-funding-evidence-unsupported',
  'conversion-principal-withholding-unsupported',
  'conversion-aggregate-unallocated',
  'qcd-date-missing',
  'qcd-sep-simple-activity-unknown',
  'qcd-roth-source-unsupported',
  'qcd-direct-charity-unconfirmed',
  'qcd-split-interest-unsupported',
  'qcd-entire-distribution-deductibility-unconfirmed',
  'qcd-nonqcd-deduction-unsupported',
  'qcd-tax-year-limit-unsupported',
  'qcd-contribution-history-unknown',
  'qcd-inherited-basis-unsupported',
  'qcd-rmd-evidence-missing',
  'qcd-aggregate-unallocated',
  'optimizer-retirement-action-unsupported',
] as const satisfies readonly UnsupportedActionReasonCode[]

describe('action reason registry', () => {
  it('exhaustively owns 79 codes across 39 predicates and four disjoint outcomes', () => {
    expect(actionReasonCodes).toHaveLength(79)
    expect(new Set(actionReasonCodes).size).toBe(79)
    expect(actionPredicateNames).toHaveLength(39)
    expect(partialActionReasonCodes).toHaveLength(3)
    expect(taxTreatmentAdjustmentReasonCodes).toHaveLength(3)
    expect(unsupportedActionReasonCodes).toHaveLength(39)
    expect(refusedActionReasonCodes).toHaveLength(34)
  })

  it('preserves the locked unsupported set exactly', () => {
    expect([...unsupportedActionReasonCodes].sort()).toEqual([...LOCKED_UNSUPPORTED_CODES].sort())
  })

  it('derives every reason from the registry', () => {
    for (const code of actionReasonCodes) {
      const reason = createActionReason(code)
      expect(reason).toEqual({ code, ...ACTION_REASON_REGISTRY[code] })
      expect(actionReasonSchema.parse(reason)).toEqual(reason)
    }

    expect(createActionReason('qcd-before-age-70-half').message).toContain('70½')
  })

  it('freezes the registry and each entry at runtime', () => {
    const original = createActionReason('person-not-found')
    expect(Object.isFrozen(ACTION_REASON_REGISTRY)).toBe(true)
    expect(Object.values(ACTION_REASON_REGISTRY).every((entry) => Object.isFrozen(entry))).toBe(true)
    expect(
      Reflect.set(
        ACTION_REASON_REGISTRY['person-not-found'],
        'message',
        'forged registry copy',
      ),
    ).toBe(false)
    expect(createActionReason('person-not-found')).toEqual(original)
  })

  it.each(['predicate', 'outcome', 'message'] as const)(
    'rejects supplied %s metadata that differs from the registry',
    (field) => {
      const reason = {
        ...createActionReason('person-not-found'),
        [field]: 'forged',
      }
      const result = actionReasonSchema.safeParse(reason)

      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === field)).toBe(true)
      }
    },
  )

  it('rejects unknown codes, unknown fields, and blank identity context', () => {
    expect(
      actionReasonSchema.safeParse({
        ...createActionReason('person-not-found'),
        code: 'not-a-reason',
      }).success,
    ).toBe(false)
    expect(
      actionReasonSchema.safeParse({
        ...createActionReason('person-not-found'),
        additionalCopy: 'drift',
      }).success,
    ).toBe(false)
    expect(() => createActionReason('not-a-reason' as never)).toThrow()
    expect(() => createActionReason('person-not-found', { personId: '' as never })).toThrow()
  })

  it('keeps each reason code correlated with its canonical metadata at compile time', () => {
    type ForgedReason = Readonly<{
      code: 'person-not-found'
      predicate: 'qcdEligibilityDate'
      outcome: 'refused'
      message: (typeof ACTION_REASON_REGISTRY)['qcd-date-invalid']['message']
    }>

    expectTypeOf<ForgedReason>().not.toMatchTypeOf<ActionReason>()
  })

  it('parses reasons without throwing and reports explicit issue paths', () => {
    const valid = createActionReason('person-not-found', { personId: 'person-1' as never })
    expect(parseActionReason(valid)).toEqual({ ok: true, reason: valid })

    const invalid = parseActionReason({ ...valid, message: 'forged' })
    expect(invalid.ok).toBe(false)
    if (!invalid.ok) expect(invalid.issues).toContain('message: message must match the registry entry for person-not-found')
  })
})
