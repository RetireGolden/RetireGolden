import { describe, expect, it } from 'vitest'

import { createGoalScheduler, toSchedulableGoal, type SchedulableGoal } from './flexibleGoals'
import type { OneTimeGoal } from '../model/plan'

function goal(overrides: Partial<SchedulableGoal> & { id: string; targetYear: number }): SchedulableGoal {
  return {
    classification: 'target',
    flexibility: 'fixed',
    earliestYear: overrides.targetYear,
    latestYear: overrides.targetYear,
    priority: 0,
    order: 0,
    amountTodayDollars: 10_000,
    minFundingPct: 100,
    allowPartialFunding: false,
    ...overrides,
  }
}

describe('toSchedulableGoal', () => {
  it('defaults optional flexibility fields (fixed goal in its year)', () => {
    const stored: OneTimeGoal = { id: 'g', label: 'Trip', year: 2030, amount: 5_000 }
    const s = toSchedulableGoal(stored, 3)
    expect(s.classification).toBe('target')
    expect(s.flexibility).toBe('fixed')
    expect(s.earliestYear).toBe(2030)
    expect(s.targetYear).toBe(2030)
    expect(s.latestYear).toBe(2030)
    expect(s.priority).toBe(3)
    expect(s.order).toBe(3)
    expect(s.minFundingPct).toBe(100)
  })
})

describe('createGoalScheduler', () => {
  const infl = { inflFactor: 2, cutting: false }

  it('funds a fixed goal in its target year and inflates the amount', () => {
    const s = createGoalScheduler([goal({ id: 'g', targetYear: 2030, amountTodayDollars: 10_000 })])
    expect(s.planYear(2029, infl).results).toEqual([])
    const r = s.planYear(2030, infl).results
    expect(r).toHaveLength(1)
    expect(r[0]).toMatchObject({ id: 'g', outcome: 'funded', fundedNominal: 20_000, amountNominal: 20_000 })
    expect(s.planYear(2031, infl).results).toEqual([])
  })

  it('funds a movable goal in its target year when not cutting', () => {
    const s = createGoalScheduler([
      goal({ id: 'car', flexibility: 'movable', earliestYear: 2032, targetYear: 2034, latestYear: 2036 }),
    ])
    expect(s.planYear(2033, { inflFactor: 1, cutting: false }).results).toEqual([])
    const r = s.planYear(2034, { inflFactor: 1, cutting: false }).results
    expect(r[0]).toMatchObject({ id: 'car', outcome: 'funded' })
  })

  it('can pull a movable goal earlier in a strong path when budget allows', () => {
    const s = createGoalScheduler([
      goal({ id: 'car', flexibility: 'movable', earliestYear: 2032, targetYear: 2034, latestYear: 2036 }),
    ])
    const r = s.planYear(2032, {
      inflFactor: 1,
      cutting: false,
      canPullForward: true,
      availableBudget: 10_000,
    })
    expect(r.results[0]).toMatchObject({ id: 'car', outcome: 'funded', fundedNominal: 10_000 })
    expect(r.remainingBudget).toBe(0)
  })

  it('defers a movable goal while cutting, then funds it when the cut lifts', () => {
    const s = createGoalScheduler([
      goal({ id: 'car', flexibility: 'movable', targetYear: 2034, latestYear: 2036 }),
    ])
    expect(s.planYear(2034, { inflFactor: 1, cutting: true }).results[0]!.outcome).toBe('deferred')
    expect(s.planYear(2035, { inflFactor: 1, cutting: true }).results[0]!.outcome).toBe('deferred')
    expect(s.planYear(2036, { inflFactor: 1, cutting: false }).results[0]!.outcome).toBe('funded')
  })

  it('skips a movable goal at the latest year when the hard budget cannot fund it under a cut', () => {
    const s = createGoalScheduler([
      goal({ id: 'car', flexibility: 'movable', targetYear: 2034, latestYear: 2035 }),
    ])
    s.planYear(2034, { inflFactor: 1, cutting: true })
    const r = s.planYear(2035, { inflFactor: 1, cutting: true, availableBudget: 0 }).results
    expect(r[0]).toMatchObject({ outcome: 'skipped', fundedNominal: 0, amountNominal: 10_000, unfundedNominal: 10_000 })
    expect(s.isResolved('car')).toBe(true)
  })

  it('funds a movable goal at the latest year when the cut lifts and budget is unlimited', () => {
    const s = createGoalScheduler([
      goal({ id: 'car', flexibility: 'movable', targetYear: 2034, latestYear: 2035 }),
    ])
    s.planYear(2034, { inflFactor: 1, cutting: true })
    const r = s.planYear(2035, { inflFactor: 1, cutting: false }).results
    expect(r[0]).toMatchObject({ outcome: 'funded', fundedNominal: 10_000, unfundedNominal: 0 })
    expect(s.isResolved('car')).toBe(true)
  })

  it('does not cap normally due goals with the pull-forward budget in a non-cut year', () => {
    const s = createGoalScheduler([
      goal({ id: 'due', flexibility: 'movable', earliestYear: 2032, targetYear: 2034, latestYear: 2036 }),
    ])
    const r = s.planYear(2034, {
      inflFactor: 1,
      cutting: false,
      canPullForward: true,
      availableBudget: 0,
    })
    expect(r.results[0]).toMatchObject({ id: 'due', outcome: 'funded', fundedNominal: 10_000 })
    expect(r.remainingBudget).toBe(0)
  })

  it('skips a skippable goal when its window closes under a cut, reporting the intended amount', () => {
    const s = createGoalScheduler([
      goal({ id: 'trip', flexibility: 'skippable', classification: 'excess', targetYear: 2034, latestYear: 2035 }),
    ])
    expect(s.planYear(2034, { inflFactor: 1, cutting: true }).results[0]!.outcome).toBe('deferred')
    const r = s.planYear(2035, { inflFactor: 1, cutting: true }).results
    expect(r[0]).toMatchObject({ id: 'trip', outcome: 'skipped', fundedNominal: 0, amountNominal: 10_000 })
    expect(s.planYear(2036, { inflFactor: 1, cutting: true }).results).toEqual([])
  })

  it('partially funds a goal when the hard budget clears its minimum funding percent', () => {
    const s = createGoalScheduler([
      goal({
        id: 'remodel',
        flexibility: 'movable',
        classification: 'ideal',
        targetYear: 2034,
        latestYear: 2036,
        allowPartialFunding: true,
        minFundingPct: 40,
        amountTodayDollars: 20_000,
      }),
    ])
    const r = s.planYear(2034, { inflFactor: 1, cutting: true, availableBudget: 10_000 }).results
    expect(r[0]).toMatchObject({
      id: 'remodel',
      outcome: 'partiallyFunded',
      fundedNominal: 10_000,
      unfundedNominal: 10_000,
    })
  })

  it('processes goals by classification, then priority order', () => {
    const s = createGoalScheduler([
      goal({ id: 'ideal-high', classification: 'ideal', targetYear: 2030, priority: 1 }),
      goal({ id: 'target-low', classification: 'target', targetYear: 2030, priority: 5 }),
    ])
    const r = s.planYear(2030, infl).results
    expect(r.map((g) => g.id)).toEqual(['target-low', 'ideal-high'])
  })
})
