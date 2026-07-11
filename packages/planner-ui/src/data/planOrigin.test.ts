import { describe, expect, it } from 'vitest'

import { EXAMPLE_PLAN_ID_PREFIX, exampleStorageId, isExamplePlan, isExamplePlanId, isUserPlan, planOriginFromRaw } from './planOrigin'

describe('planOrigin helpers', () => {
  it('recognizes reserved example storage ids', () => {
    expect(EXAMPLE_PLAN_ID_PREFIX).toBe('example:')
    expect(exampleStorageId('example-couple')).toBe('example:example-couple')
    expect(isExamplePlanId('example:example-couple')).toBe(true)
    expect(isExamplePlanId('user-plan')).toBe(false)
  })

  it('classifies raw origin records with missing origin treated as user data', () => {
    expect(isUserPlan({ origin: 'user' })).toBe(true)
    expect(isUserPlan({})).toBe(true)
    expect(isUserPlan({ origin: 'example' })).toBe(false)
    expect(isExamplePlan({ origin: 'example' })).toBe(true)
    expect(isExamplePlan({ origin: 'user' })).toBe(false)
    expect(planOriginFromRaw({ origin: 'example' })).toBe('example')
    expect(planOriginFromRaw({})).toBe('user')
  })
})
