import { describe, expect, it } from 'vitest'

import type { ExpensePlan } from '../../model/plan.js'
import {
  annualLifestyleLayers,
  type AnnualLifestyleLayersInput,
} from './annualLifestyleLayers.js'

function expenses(overrides: Partial<ExpensePlan> = {}): ExpensePlan {
  return {
    baseAnnual: 100,
    requiredAnnual: 70,
    idealAnnual: 20,
    excessAnnual: 10,
    phases: [],
    oneTimeGoals: [],
    healthcare: {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    },
    ...overrides,
  }
}

function call(overrides: Partial<AnnualLifestyleLayersInput> = {}) {
  return annualLifestyleLayers({
    expenses: expenses(),
    primaryAge: 65,
    peopleStateCount: 1,
    aliveCount: 1,
    anyAlive: true,
    inflFactor: 1,
    abwActive: false,
    abwRealReturnPct: 0,
    abwTiltPct: 0,
    abwHorizonYear: 2027,
    year: 2026,
    balances: [],
    startOfYearBalance: new Map(),
    ...overrides,
  })
}

describe('annualLifestyleLayers — fixed lifestyle', () => {
  it('stably sorts phases and lets the last eligible equal-age phase win', () => {
    const phases = [
      { fromAge: 70, multiplier: 2 },
      { fromAge: 60, multiplier: 1.25 },
      { fromAge: 60, multiplier: 1.5 },
      { fromAge: 40, multiplier: 0.5 },
    ]
    const result = call({
      expenses: expenses({ phases, survivorSpendingPct: 50 }),
      peopleStateCount: 2,
      aliveCount: 1,
      inflFactor: 1.1,
    })

    expect(result).toEqual({
      requiredLifestyle: 57.75000000000001,
      discretionaryLifestyle: 24.749999999999993,
      targetLifestyle: 24.749999999999993,
      idealLifestyle: 16.5,
      excessLifestyle: 8.25,
    })
    expect(phases).toEqual([
      { fromAge: 70, multiplier: 2 },
      { fromAge: 60, multiplier: 1.25 },
      { fromAge: 60, multiplier: 1.5 },
      { fromAge: 40, multiplier: 0.5 },
    ])
  })

  it('applies survivor scaling only to a multi-person one-survivor year', () => {
    const scaledExpenses = expenses({ survivorSpendingPct: 40 })

    expect(call({ expenses: scaledExpenses, peopleStateCount: 2, aliveCount: 1 }).requiredLifestyle).toBe(28)
    expect(call({ expenses: scaledExpenses, peopleStateCount: 2, aliveCount: 2 }).requiredLifestyle).toBe(70)
    expect(call({ expenses: scaledExpenses, peopleStateCount: 1, aliveCount: 1 }).requiredLifestyle).toBe(70)
  })

  it('zeros every layer when no household member is alive', () => {
    expect(call({ anyAlive: false, aliveCount: 0 })).toEqual({
      requiredLifestyle: 0,
      discretionaryLifestyle: 0,
      targetLifestyle: 0,
      idealLifestyle: 0,
      excessLifestyle: 0,
    })
  })

  it('clamps the required annual input to the base before scaling', () => {
    const result = call({ expenses: expenses({ baseAnnual: 80, requiredAnnual: 120 }) })
    expect(result.requiredLifestyle).toBe(80)
    expect(result.targetLifestyle).toBe(0)
  })

  it('preserves the left-associated inflation, phase, and survivor scale', () => {
    const result = call({
      expenses: expenses({
        baseAnnual: 100,
        requiredAnnual: 70,
        phases: [{ fromAge: 60, multiplier: 0.1 }],
        survivorSpendingPct: 30,
      }),
      inflFactor: 0.1,
      peopleStateCount: 2,
      aliveCount: 1,
    })
    const regroupedRequired = 70 * (0.1 * (0.1 * 0.3))

    expect(result.requiredLifestyle).toBe(0.21000000000000005)
    expect(regroupedRequired).toBe(0.21)
    expect(result.requiredLifestyle).not.toBe(regroupedRequired)
  })
})

describe('annualLifestyleLayers — ABW', () => {
  it('replaces all fixed layers and preserves the ordered start-balance fold', () => {
    const result = call({
      expenses: expenses({
        baseAnnual: 999,
        requiredAnnual: 888,
        idealAnnual: 777,
        excessAnnual: 666,
        phases: [{ fromAge: 40, multiplier: 3 }],
        survivorSpendingPct: 1,
      }),
      peopleStateCount: 2,
      aliveCount: 1,
      inflFactor: 99,
      abwActive: true,
      abwHorizonYear: 2026,
      balances: [
        { account: { id: 'large' } },
        { account: { id: 'small' } },
        { account: { id: 'negative-large' } },
        { account: { id: 'tail' } },
        { account: { id: 'duplicate' } },
        { account: { id: 'duplicate' } },
        { account: { id: 'missing' } },
      ],
      startOfYearBalance: new Map([
        ['large', 1e16],
        ['small', 1],
        ['negative-large', -1e16],
        ['tail', 2],
        ['duplicate', 3],
      ]),
    })

    // ((((1e16 + 1) - 1e16) + 2) + 3) + 3 = 8. Reordering the
    // cancellation rows would yield 9; each duplicate balance row re-reads
    // the map's single last-write value.
    expect(result).toEqual({
      requiredLifestyle: 0,
      discretionaryLifestyle: 8,
      targetLifestyle: 8,
      idealLifestyle: 0,
      excessLifestyle: 0,
    })
  })

  it('still suppresses an ABW payment after the household dies', () => {
    expect(call({
      anyAlive: false,
      aliveCount: 0,
      abwActive: true,
      balances: [{ account: { id: 'cash' } }],
      startOfYearBalance: new Map([['cash', 100]]),
    }).targetLifestyle).toBe(0)
  })

  it('uses nonzero return, tilt, and the shrinking multi-year horizon', () => {
    const shared = {
      abwActive: true,
      abwRealReturnPct: 4,
      abwTiltPct: 1,
      abwHorizonYear: 2028,
      balances: [{ account: { id: 'portfolio' } }],
      startOfYearBalance: new Map([['portfolio', 1_000]]),
    } as const

    expect(call({ ...shared, year: 2026 }).targetLifestyle)
      .toBeCloseTo(343.1363218172011, 12)
    expect(call({ ...shared, year: 2027 }).targetLifestyle)
      .toBeCloseTo(507.317073170732, 12)
  })
})

describe('annualLifestyleLayers — purity and freshness', () => {
  it('returns fresh results without mutating the expense object or balance inputs', () => {
    const expenseInput = expenses({ phases: [{ fromAge: 60, multiplier: 1.2 }] })
    const balances = [{ account: { id: 'cash' } }]
    const startOfYearBalance = new Map([['cash', 100]])
    const before = JSON.stringify(expenseInput)
    const first = call({ expenses: expenseInput, balances, startOfYearBalance })
    const second = call({ expenses: expenseInput, balances, startOfYearBalance })

    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(JSON.stringify(expenseInput)).toBe(before)
    expect(balances).toEqual([{ account: { id: 'cash' } }])
    expect([...startOfYearBalance]).toEqual([['cash', 100]])
  })
})
