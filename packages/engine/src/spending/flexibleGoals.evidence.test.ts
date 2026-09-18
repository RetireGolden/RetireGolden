import { expect, it } from 'vitest'
import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createGoalScheduler } from './flexibleGoals.js'

describeCalculation('flexible-goal-scheduling', {
  example: {
    inputs: { cost: 1000, inflFactor: 1.10, availableBudget: 700, belowMinimumBudget: 520, minFundingPct: 50, allowPartialFunding: true },
    expected: { outcome: 'partiallyFunded', amountNominal: 1100, fundedNominal: 700, unfundedNominal: 400, remainingBudget: 0, belowMinimum: { outcome: 'skipped', amountNominal: 1100, fundedNominal: 0, unfundedNominal: 1100, remainingBudget: 520 } },
    tolerance: 'exact',
  },
  worksheet: 'DOCS/calculations/cash-flow-and-summary/flexible-goal-scheduling.md',
  mutation: 'DOCS/calculations/cash-flow-and-summary/flexible-goal-scheduling.mutation.md',
}, ({ example }) => {
  it('partially funds an inflated 1100 target with 700 and leaves 400 unfunded', () => {
    // A movable target during a cut makes the worksheet's finite budget binding.
    const scheduler = createGoalScheduler([{
      id: 'worksheet-goal', classification: 'target', flexibility: 'movable',
      earliestYear: 2026, targetYear: 2026, latestYear: 2027, priority: 0, order: 0,
      amountTodayDollars: example.inputs.cost as number,
      minFundingPct: example.inputs.minFundingPct as number,
      allowPartialFunding: example.inputs.allowPartialFunding as boolean,
    }])
    const planned = scheduler.planYear(2026, { inflFactor: example.inputs.inflFactor as number, availableBudget: example.inputs.availableBudget as number, cutting: true })
    const actual = planned.results[0]!
    expect(actual.outcome).toBe(example.expected.outcome)
    for (const key of ['amountNominal', 'fundedNominal', 'unfundedNominal'] as const) {
      expect(withinTolerance(actual[key], example.expected[key] as number, example.tolerance), `${key}: actual ${actual[key]}, worksheet ${example.expected[key]}`).toBe(true)
    }
    expect(withinTolerance(planned.remainingBudget!, example.expected.remainingBudget as number, example.tolerance)).toBe(true)
    expect(scheduler.isResolved('worksheet-goal')).toBe(true)
    expect(scheduler.planYear(2027, { inflFactor: 1.10, cutting: true, availableBudget: 700 }).results.length).toBe(0)
  })
  it('takes the minimum on the inflated amount, not today\'s: skips a 520 budget below 550', () => {
    // At the same movable goal's latest year, insufficient funding resolves as skipped.
    const scheduler = createGoalScheduler([{
      id: 'worksheet-goal', classification: 'target', flexibility: 'movable',
      earliestYear: 2026, targetYear: 2026, latestYear: 2027, priority: 0, order: 0,
      amountTodayDollars: example.inputs.cost as number,
      minFundingPct: example.inputs.minFundingPct as number,
      allowPartialFunding: example.inputs.allowPartialFunding as boolean,
    }])
    const planned = scheduler.planYear(2027, { inflFactor: example.inputs.inflFactor as number, availableBudget: example.inputs.belowMinimumBudget as number, cutting: true })
    const actual = planned.results[0]!
    const expected = example.expected.belowMinimum as Record<string, string | number>
    expect(actual.outcome).toBe(expected.outcome)
    for (const key of ['amountNominal', 'fundedNominal', 'unfundedNominal'] as const) {
      expect(withinTolerance(actual[key], expected[key] as number, example.tolerance), `${key}: actual ${actual[key]}, worksheet ${expected[key]}`).toBe(true)
    }
    expect(withinTolerance(planned.remainingBudget!, expected.remainingBudget as number, example.tolerance)).toBe(true)
    expect(scheduler.isResolved('worksheet-goal')).toBe(true)
    expect(scheduler.planYear(2028, { inflFactor: 1.10, cutting: true, availableBudget: 700 }).results.length).toBe(0)
  })
})
