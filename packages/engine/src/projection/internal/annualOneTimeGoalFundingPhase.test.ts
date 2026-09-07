import { describe, expect, it } from 'vitest'

import type { OneTimeGoal } from '../../model/plan.js'
import { createGoalScheduler, toSchedulableGoal } from '../../spending/flexibleGoals.js'
import type { RecordedGoalOutcome } from '../annualCashFlowYearSites.js'
import { annualOneTimeGoalFundingPhase } from './annualOneTimeGoalFundingPhase.js'

const TARGET_YEAR = 2030
const AMOUNT_TODAY = 100
const INFL_FACTOR = 1.5
// Worksheet (DOCS/features/README.md §oneTimeGoals): today's $100 × 1.5 = $150 nominal.
const EXPECTED_NOMINAL = AMOUNT_TODAY * INFL_FACTOR

function movableTargetGoal(overrides: Partial<OneTimeGoal> = {}): OneTimeGoal {
  return {
    id: 'car',
    label: 'Car',
    year: TARGET_YEAR,
    amount: AMOUNT_TODAY,
    classification: 'target',
    flexibility: 'movable',
    earliestYear: TARGET_YEAR,
    latestYear: TARGET_YEAR,
    allowPartialFunding: false,
    ...overrides,
  }
}

describe('annualOneTimeGoalFundingPhase direct outcomes', () => {
  it('reports a skipped movable goal at latest year under cut as target miss, not spending', () => {
    const goal = movableTargetGoal()
    const scheduler = createGoalScheduler([toSchedulableGoal(goal, 0)])
    const outcomes: RecordedGoalOutcome[] = []

    const result = annualOneTimeGoalFundingPhase({
      year: TARGET_YEAR,
      inflFactor: INFL_FACTOR,
      anyAlive: true,
      goalScheduler: scheduler,
      oneTimeGoals: [goal],
      cutting: true,
      canPullForwardGoals: false,
      remainingUpsideBudget: 0,
      commitGoalOutcome: (row) => outcomes.push(row),
    })

    expect(result.oneTimeGoalsFunded).toBe(0)
    expect(result.targetGoalsFunded).toBe(0)
    expect(result.skippedTargetNominal).toBe(EXPECTED_NOMINAL)
    expect(result.skippedRequiredNominal).toBe(0)
    expect(result.skippedIdealNominal).toBe(0)
    expect(result.skippedExcessNominal).toBe(0)
    expect(result.goalOutcomeCounts).toEqual({
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 1,
      fundedAmount: 0,
      unfundedAmount: EXPECTED_NOMINAL,
    })
    expect(outcomes).toEqual([
      {
        goalId: 'car',
        classification: 'target',
        outcome: 'skipped',
        requested: EXPECTED_NOMINAL,
        fundedNominal: 0,
      },
    ])
    expect(scheduler.isResolved('car')).toBe(true)
  })

  it('funds the target-year goal without a scheduler and ignores out-of-year goals', () => {
    const inYearGoal = movableTargetGoal({ id: 'due' })
    const outOfYearGoal = movableTargetGoal({
      id: 'later',
      year: TARGET_YEAR + 2,
      earliestYear: TARGET_YEAR + 2,
      latestYear: TARGET_YEAR + 2,
    })
    const outcomes: RecordedGoalOutcome[] = []

    const result = annualOneTimeGoalFundingPhase({
      year: TARGET_YEAR,
      inflFactor: INFL_FACTOR,
      anyAlive: true,
      goalScheduler: null,
      oneTimeGoals: [outOfYearGoal, inYearGoal],
      cutting: false,
      canPullForwardGoals: false,
      remainingUpsideBudget: 0,
      commitGoalOutcome: (row) => outcomes.push(row),
    })

    expect(result.oneTimeGoalsFunded).toBe(EXPECTED_NOMINAL)
    expect(result.targetGoalsFunded).toBe(EXPECTED_NOMINAL)
    expect(result.skippedTargetNominal).toBe(0)
    expect(result.skippedRequiredNominal).toBe(0)
    expect(result.skippedIdealNominal).toBe(0)
    expect(result.skippedExcessNominal).toBe(0)
    expect(result.goalOutcomeCounts).toEqual({
      funded: 0,
      partiallyFunded: 0,
      deferred: 0,
      skipped: 0,
      fundedAmount: 0,
      unfundedAmount: 0,
    })
    expect(outcomes).toEqual([
      {
        goalId: 'due',
        classification: 'target',
        outcome: 'funded',
        requested: EXPECTED_NOMINAL,
        fundedNominal: EXPECTED_NOMINAL,
      },
    ])
  })
})
