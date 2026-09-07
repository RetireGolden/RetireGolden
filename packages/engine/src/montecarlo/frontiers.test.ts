import { describe, expect, it, vi } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { HISTORICAL_YEARS } from './historicalReturns.js'
import { buildRetirementAgeSuccessFrontier, buildSpendingSuccessFrontier } from './frontiers.js'
import { runHistoricalStressSuites } from './historicalSuites.js'
import * as sharedPathsModule from './sharedPaths.js'
import { comparePlansOnSharedMarketPaths } from './sharedPaths.js'

let counter = 0
const testIds = () => `frontier-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function taxable(balance: number): Account {
  return {
    type: 'taxable',
    id: testIds(),
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 88, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.assumptions.heirTaxRatePct = 20
  plan.expenses.baseAnnual = 48_000
  plan.accounts = [taxable(650_000)]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function coupleBasePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 88, source: 'manual' },
  }
  plan.household.people.push({
    id: 'p2',
    name: 'Robin',
    dob: '1966-06-15',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 88, source: 'manual' },
  })
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.assumptions.heirTaxRatePct = 20
  plan.expenses.baseAnnual = 48_000
  plan.accounts = [taxable(650_000)]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('shared-path stochastic helpers', () => {
  const opts = {
    startYear: 2026,
    taxCalculator: noTax,
    model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 14 } as const,
    pathCount: 80,
    seed: 123,
  }

  it('gives identical summaries to identical plans on the same market paths', () => {
    const plan = basePlan()
    const comparison = comparePlansOnSharedMarketPaths(
      [
        { id: 'a', label: 'A', plan },
        { id: 'b', label: 'B', plan },
      ],
      opts,
    )
    expect(comparison.rows[0]!.summary.successRate).toBe(comparison.rows[1]!.summary.successRate)
    expect(comparison.rows[0]!.summary.endingAfterTaxEstate.percentiles).toEqual(
      comparison.rows[1]!.summary.endingAfterTaxEstate.percentiles,
    )
  })

  it('reports monotonic completed work across every compared plan', () => {
    const plan = basePlan()
    const seen: Array<[completed: number, total: number]> = []
    comparePlansOnSharedMarketPaths(
      [
        { id: 'a', label: 'A', plan },
        { id: 'b', label: 'B', plan },
      ],
      {
        ...opts,
        pathCount: 3,
        onProgress: (completed, total) => seen.push([completed, total]),
      },
    )

    expect(seen).toEqual([
      [1, 6],
      [2, 6],
      [3, 6],
      [4, 6],
      [5, 6],
      [6, 6],
    ])
  })

  it('builds a bounded spending frontier whose success curve is monotone on the fixture', () => {
    const points = buildSpendingSuccessFrontier(basePlan(), opts, [0.8, 1, 1.2])
    expect(points).toHaveLength(3)
    expect(points[0]!.successRate).toBeGreaterThanOrEqual(points[1]!.successRate)
    expect(points[1]!.successRate).toBeGreaterThanOrEqual(points[2]!.successRate)
    expect(points[0]!.p10EndingAfterTaxEstate).toBeGreaterThanOrEqual(points[2]!.p10EndingAfterTaxEstate)
  })
})

describe('historical stress suites', () => {
  it('runs rolling and reversed windows and sorts the worst windows', () => {
    const result = runHistoricalStressSuites(basePlan(), {
      startYear: 2026,
      taxCalculator: noTax,
      windowLengthYears: 10,
      suites: ['rolling', 'reversed'],
      worstWindowCount: 3,
    })
    expect(result.windowLengthYears).toBe(10)
    expect(result.suites).toHaveLength(2)
    for (const suite of result.suites) {
      expect(suite.windows).toHaveLength(HISTORICAL_YEARS.length - 10 + 1)
      expect(suite.worstByEndingAfterTaxEstate).toHaveLength(3)
      expect(suite.worstByEndingAfterTaxEstate[0]!.summary.endingAfterTaxEstate).toBeLessThanOrEqual(
        suite.worstByEndingAfterTaxEstate[1]!.summary.endingAfterTaxEstate,
      )
    }
    const reversed = result.suites.find((suite) => suite.kind === 'reversed')!
    expect(reversed.windows[0]!.marketYears.slice(0, 3)).toEqual([1937, 1936, 1935])
  })
})

describe('retirement-age success frontier', () => {
  const frontierOpts = {
    startYear: 2026,
    taxCalculator: noTax,
    model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 14 } as const,
    pathCount: 2,
    seed: 123,
  }

  it('maps couple retirement deltas to minimum planned retirement age x, ids, and labels on shared paths', () => {
    const plan = coupleBasePlan()
    const originalAges = plan.household.people.map((person) => person.retirementAge)
    const points = buildRetirementAgeSuccessFrontier(plan, frontierOpts, [-1, 0, 1])
    expect(points.map((point) => point.x)).toEqual([59, 60, 61])
    expect(points.map((point) => point.id)).toEqual([
      'retirement-minus-1',
      'retirement-plus-0',
      'retirement-plus-1',
    ])
    expect(points.map((point) => point.label)).toEqual([
      '1y earlier',
      'Current retirement age',
      '1y later',
    ])
    expect(plan.household.people.map((person) => person.retirementAge)).toEqual(originalAges)
  })

  it('clamps retirement ages at the 30 and 80 product bounds', () => {
    const lower = basePlan()
    lower.household.people[0]!.retirementAge = 30
    const upper = basePlan()
    upper.household.people[0]!.retirementAge = 80

    expect(buildRetirementAgeSuccessFrontier(lower, frontierOpts, [-1])[0]!.x).toBe(30)
    expect(buildRetirementAgeSuccessFrontier(upper, frontierOpts, [1])[0]!.x).toBe(80)
    expect(lower.household.people[0]!.retirementAge).toBe(30)
    expect(upper.household.people[0]!.retirementAge).toBe(80)

    const originalCompare = sharedPathsModule.comparePlansOnSharedMarketPaths
    const observed: Array<Array<number | null>> = []
    const spy = vi.spyOn(sharedPathsModule, 'comparePlansOnSharedMarketPaths')
    spy.mockImplementation((variants, opts) => {
      for (const variant of variants) {
        observed.push(variant.plan.household.people.map((person) => person.retirementAge))
      }
      return originalCompare(variants, opts)
    })

    const lowerCouple = coupleBasePlan()
    lowerCouple.household.people[0]!.retirementAge = 35
    lowerCouple.household.people[1]!.retirementAge = 30
    const lowerOriginalAges = lowerCouple.household.people.map((person) => person.retirementAge)

    const upperCouple = coupleBasePlan()
    upperCouple.household.people[0]!.retirementAge = 75
    upperCouple.household.people[1]!.retirementAge = 80
    const upperOriginalAges = upperCouple.household.people.map((person) => person.retirementAge)

    try {
      observed.length = 0
      expect(buildRetirementAgeSuccessFrontier(lowerCouple, frontierOpts, [-1])[0]!.x).toBe(30)
      expect(observed).toEqual([[34, 30]])
      expect(lowerCouple.household.people.map((person) => person.retirementAge)).toEqual(lowerOriginalAges)

      observed.length = 0
      expect(buildRetirementAgeSuccessFrontier(upperCouple, frontierOpts, [1])[0]!.x).toBe(76)
      expect(observed).toEqual([[76, 80]])
      expect(upperCouple.household.people.map((person) => person.retirementAge)).toEqual(upperOriginalAges)
    } finally {
      spy.mockRestore()
    }
  })

  it('shifts both household members for each delta through the shared-path comparator', () => {
    const plan = coupleBasePlan()
    const observed: Array<Array<number | null>> = []
    const deltas = [-1, 0, 1] as const
    const originalCompare = sharedPathsModule.comparePlansOnSharedMarketPaths
    const spy = vi.spyOn(sharedPathsModule, 'comparePlansOnSharedMarketPaths')
    spy.mockImplementation((variants, opts) => {
      for (const variant of variants) {
        observed.push(variant.plan.household.people.map((person) => person.retirementAge))
      }
      return originalCompare(variants, opts)
    })

    try {
      const points = buildRetirementAgeSuccessFrontier(plan, frontierOpts, deltas)
      expect(observed).toEqual([[64, 59], [65, 60], [66, 61]])
      expect(points).toHaveLength(3)
    } finally {
      spy.mockRestore()
    }
  })
})
