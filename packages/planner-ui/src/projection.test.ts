import { describe, expect, it } from 'vitest'

import { singlePersonPlan, taxableAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { projectPlan } from './projection'

const START_YEAR = 2026

function fixturePlan() {
  // A horizon of several years and a nonzero rate, so the conversions below
  // move something (the bare fixture runs one year at 0% inflation).
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 70 })
  plan.assumptions.inflationPct = 2.5
  plan.accounts.push(taxableAccount('acct-taxable', 500_000, 250_000))
  return validatePlan(plan)
}

describe('projectPlan', () => {
  it('is deterministic for the same plan and explicit start year', () => {
    const plan = fixturePlan()
    const first = projectPlan(plan, START_YEAR)
    const second = projectPlan(plan, START_YEAR)

    expect(second.result).toEqual(first.result)
    expect(second.summary).toEqual(first.summary)
  })

  it('honors an explicit start year', () => {
    const projection = projectPlan(fixturePlan(), START_YEAR)

    expect(projection.startYear).toBe(START_YEAR)
    expect(projection.result.years[0]?.year).toBe(START_YEAR)
  })

  it('omits YearResult.cashFlow unless captureAnnualCashFlow is requested', () => {
    const plan = fixturePlan()
    const byStartYear = projectPlan(plan, START_YEAR)
    expect(byStartYear.result.years.some((year) => year.cashFlow !== undefined)).toBe(false)

    const captured = projectPlan(plan, { startYear: START_YEAR, captureAnnualCashFlow: true })
    expect(captured.result.years.some((year) => year.cashFlow !== undefined)).toBe(true)
    expect(captured.result.years[0]?.cashFlow?.reconciliation.status).toBeDefined()
  })
})

describe('ProjectionView dollar basis', () => {
  it("carries the run's own basis: one published factor per projected year, 1 in the start year", () => {
    const projection = projectPlan(fixturePlan(), START_YEAR)
    const { basis, result } = projection

    expect(basis.startYear).toBe(result.startYear)
    expect(basis.endYear).toBe(result.endYear)
    expect(basis.factors).toHaveLength(result.years.length)
    expect(basis.factors[0]).toBe(1)
    result.years.forEach((row, index) => {
      expect(Object.is(basis.factors[index], row.inflationScale), String(row.year)).toBe(true)
    })
  })

  it("deflates and inflates by the ledger's published factor for the year", () => {
    const plan = fixturePlan()
    const projection = projectPlan(plan, START_YEAR)
    const scaleIn = (year: number) => projection.result.years.find((row) => row.year === year)!.inflationScale!
    const rate = 1 + plan.assumptions.inflationPct / 100

    // Exactly the ledger's own factor, bit for bit.
    expect(Object.is(projection.deflate(START_YEAR + 2, 10_000), 10_000 / scaleIn(START_YEAR + 2))).toBe(true)
    expect(Object.is(projection.inflate(START_YEAR + 3, 10_000), 10_000 * scaleIn(START_YEAR + 3))).toBe(true)
    // Hand worksheet, not the code: 10,000 over rate^2, and 10,000 x rate^3.
    expect(projection.deflate(START_YEAR + 2, 10_000)).toBeCloseTo(10_000 / (rate * rate), 9)
    expect(projection.inflate(START_YEAR + 3, 10_000)).toBeCloseTo(10_000 * rate * rate * rate, 9)
    // The base year is a fixed point in both directions.
    expect(projection.inflate(START_YEAR, 10_000)).toBe(10_000)
    expect(projection.deflate(START_YEAR, 10_000)).toBe(10_000)
  })

  it('refuses a year outside the projection instead of extrapolating', () => {
    const projection = projectPlan(fixturePlan(), START_YEAR)

    expect(() => projection.deflate(START_YEAR - 1, 1)).toThrow(RangeError)
    expect(() => projection.inflate(projection.result.endYear + 1, 1)).toThrow(RangeError)
  })
})
