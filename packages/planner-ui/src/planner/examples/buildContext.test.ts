import { describe, expect, it } from 'vitest'

import { createExamplePlan } from './buildContext'

describe('createExamplePlan', () => {
  it('gives each example its own nested baseline defaults', () => {
    const first = createExamplePlan({ exampleId: 'first', name: 'First' })
    const second = createExamplePlan({ exampleId: 'second', name: 'Second' })

    expect(first.assumptions.ssCola).not.toBe(second.assumptions.ssCola)
    expect(first.strategies.withdrawalOrder).not.toBe(second.strategies.withdrawalOrder)
    expect(first.strategies.rothConversion).not.toBe(second.strategies.rothConversion)
    expect(first.strategies.retirementActions).not.toBe(second.strategies.retirementActions)
  })
})
