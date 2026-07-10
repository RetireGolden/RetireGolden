import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { createFlatTaxCalculator } from '../projection/flatTax'
import { HISTORICAL_YEARS } from './historicalReturns'
import { buildSpendingSuccessFrontier } from './frontiers'
import { runHistoricalStressSuites } from './historicalSuites'
import { comparePlansOnSharedMarketPaths } from './sharedPaths'

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
