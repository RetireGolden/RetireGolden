import { describe, expect, expectTypeOf, it } from 'vitest'

import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  asAccountId,
  asActionId,
  asAllocationId,
  asPersonId,
  asPlanId,
  personIdSchema,
  planIdSchema,
  type ActionId,
  type PersonId,
} from './identity.js'

describe('stable action identities', () => {
  const schemas = [
    actionIdSchema,
    personIdSchema,
    accountIdSchema,
    allocationIdSchema,
    planIdSchema,
  ] as const

  it('accepts nonempty identity without rewriting it', () => {
    for (const schema of schemas) {
      expect(schema.parse(' stable-id ')).toBe(' stable-id ')
    }
  })

  it('rejects empty, blank, and non-string identities at runtime', () => {
    for (const schema of schemas) {
      expect(schema.safeParse('').success).toBe(false)
      expect(schema.safeParse(' \t').success).toBe(false)
      expect(schema.safeParse(123).success).toBe(false)
    }
  })

  it('keeps identity brands separate at compile time', () => {
    const actionId = actionIdSchema.parse('same-runtime-value')
    const personId = personIdSchema.parse('same-runtime-value')

    expect(actionId).toBe(personId)
    expectTypeOf(actionId).toEqualTypeOf<ActionId>()
    expectTypeOf(personId).toEqualTypeOf<PersonId>()
    expectTypeOf(actionId).not.toEqualTypeOf<PersonId>()
  })

  it('constructs each branded identity through an explicit runtime boundary', () => {
    expect(asActionId('action')).toBe('action')
    expect(asPersonId('person')).toBe('person')
    expect(asAccountId('account')).toBe('account')
    expect(asAllocationId('allocation')).toBe('allocation')
    expect(asPlanId('plan')).toBe('plan')
    expect(() => asActionId(' ')).toThrow()
  })
})
