import { describe, expect, it } from 'vitest'

import { blockedActionResult } from './actionResult.js'

/**
 * These pin the properties the evaluators relied on their own `blocked()` for:
 * the record's exact keys, the order they serialise in, the single-issue tuple,
 * and deep immutability. They are characterization tests of the shared frame,
 * not of any evaluator's rule.
 */
describe('blockedActionResult', () => {
  const build = (): Record<string, unknown> =>
    blockedActionResult(
      'blocked',
      { committed: false, movement: 'notEstablished', taxYear: 2026, entries: [] },
      { kind: 'invalidInput', detail: 'input was not a plain record' },
    )

  it('places status first, the payload in its own order, and issues last', () => {
    expect(Object.keys(build())).toEqual([
      'status',
      'committed',
      'movement',
      'taxYear',
      'entries',
      'issues',
    ])
  })

  it('serialises to the record the hand-rolled factories produced', () => {
    expect(JSON.stringify(build())).toBe(
      '{"status":"blocked","committed":false,"movement":"notEstablished","taxYear":2026,"entries":[],' +
        '"issues":[{"kind":"invalidInput","detail":"input was not a plain record"}]}',
    )
  })

  it('carries exactly one issue, which is the issue it was handed', () => {
    const issues = build().issues as readonly Record<string, unknown>[]
    expect(issues).toHaveLength(1)
    expect(issues[0]).toEqual({ kind: 'invalidInput', detail: 'input was not a plain record' })
  })

  it('freezes the result, the issues tuple, the issue, and nested payload values', () => {
    const result = build()
    const issues = result.issues as readonly Record<string, unknown>[]
    expect(Object.isFrozen(result)).toBe(true)
    expect(Object.isFrozen(issues)).toBe(true)
    expect(Object.isFrozen(issues[0])).toBe(true)
    expect(Object.isFrozen(result.entries)).toBe(true)
  })

  it('freezes a payload value the caller still holds a reference to', () => {
    const nested = { reimbursementScopeId: null }
    const result = blockedActionResult<Record<string, unknown>>('blocked', { scope: nested }, { kind: 'invalidInput' })
    expect(Object.isFrozen(nested)).toBe(true)
    expect(result).toHaveProperty('scope', nested)
  })

  it('does not add keys the caller did not supply', () => {
    const result = blockedActionResult<Record<string, unknown>>('annualHsaTreatmentBindingBlocked', {}, { stage: 'input' })
    expect(Object.keys(result)).toEqual(['status', 'issues'])
    expect(result.status).toBe('annualHsaTreatmentBindingBlocked')
  })

  it('lets a payload key named status or issues win, so a caller cannot silently lose one', () => {
    // The spread sits between the two, so `status` from the payload would
    // overwrite the argument. No evaluator does this; the test records which
    // way the collision resolves rather than leaving it undiscovered.
    const result = blockedActionResult<Record<string, unknown>>('blocked', { status: 'shadowed' }, { kind: 'invalidInput' })
    expect(result.status).toBe('shadowed')
  })
})
