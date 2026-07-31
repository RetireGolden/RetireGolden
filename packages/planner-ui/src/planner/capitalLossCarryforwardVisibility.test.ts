import { describe, expect, it } from 'vitest'

import { hasCapitalLossCarryforward } from './capitalLossCarryforwardVisibility'

describe('results and report carryforward visibility', () => {
  it('shows carryforward detail when the projection creates a loss from an opening zero balance', () => {
    expect(
      hasCapitalLossCarryforward(0, [
        { capitalLossCarryforwardRemaining: 7_000 },
      ]),
    ).toBe(true)
  })

  it('stays hidden when neither the opening plan nor any projected year has a carryforward', () => {
    expect(
      hasCapitalLossCarryforward(0, [
        { capitalLossCarryforwardRemaining: 0 },
      ]),
    ).toBe(false)
  })

  it('keeps opening carryforwards visible even after the projection exhausts them', () => {
    expect(
      hasCapitalLossCarryforward(25_000, [
        { capitalLossCarryforwardRemaining: 0 },
      ]),
    ).toBe(true)
  })
})
