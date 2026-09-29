import { describe, expect, it } from 'vitest'

import { summarizeProjection } from '../projection/compare.js'
import { projectionDollarBasis, toTodayDollars } from '../projection/dollarBasis.js'
import { simulatePlan } from '../projection/simulate.js'
import { cashAccount, productionTaxCalculator, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { detectorProjection } from './detectorProjection.js'

describe('detectorProjection', () => {
  const plan = singlePersonPlan({ dob: '1960-01-01', planningAge: 80 })
  plan.accounts = [cashAccount('cash', 250_000)]
  plan.expenses.baseAnnual = 20_000
  plan.assumptions.inflationPct = 3.1
  const validated = validatePlan(plan)
  const result = simulatePlan(validated, { startYear: 2026, taxCalculator: productionTaxCalculator() })
  const summary = summarizeProjection(validated, result, { conversionFreeRun: null })

  it("deflates by the run's own inflationScale, bit for bit with the dollar basis", () => {
    const projection = detectorProjection(result, summary)
    const basis = projectionDollarBasis(result)
    expect(projection.result).toBe(result)
    expect(projection.summary).toBe(summary)
    expect(projection.startYear).toBe(result.startYear)
    for (const row of result.years) {
      for (const amount of [1, 1_000_000, row.investableTotal]) {
        expect(Object.is(projection.deflate(row.year, amount), toTodayDollars(basis, row.year, amount))).toBe(true)
        expect(Object.is(projection.deflate(row.year, amount), amount / row.inflationScale!)).toBe(true)
      }
    }
  })

  it('refuses a year the projection does not have, rather than extrapolating', () => {
    const projection = detectorProjection(result, summary)
    expect(() => projection.deflate(result.endYear + 1, 1)).toThrow(RangeError)
    expect(() => projection.deflate(result.startYear - 1, 1)).toThrow(RangeError)
  })
})
