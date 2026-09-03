import { describe, expect, it } from 'vitest'

import { singlePersonPlan, taxableAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { inflationView, projectPlan } from './projection'

const START_YEAR = 2026

function fixturePlan() {
  const plan = singlePersonPlan()
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

  it('keeps today-dollar deflation unchanged', () => {
    const plan = fixturePlan()
    const projection = projectPlan(plan, START_YEAR)
    const rate = 1 + plan.assumptions.inflationPct / 100

    expect(projection.deflate(START_YEAR + 2, 10_000)).toBeCloseTo(10_000 / Math.pow(rate, 2))
  })

  it('inflates a today-dollar amount the same way it deflates a nominal one', () => {
    const plan = fixturePlan()
    const projection = projectPlan(plan, START_YEAR)
    const rate = 1 + plan.assumptions.inflationPct / 100

    // Hand worksheet, not the code: 10,000 x rate^3 three years out.
    expect(projection.inflate(START_YEAR + 3, 10_000)).toBeCloseTo(10_000 * Math.pow(rate, 3))
    // The base year is a fixed point in both directions.
    expect(projection.inflate(START_YEAR, 10_000)).toBeCloseTo(10_000)
    expect(projection.deflate(START_YEAR, 10_000)).toBeCloseTo(10_000)
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

describe('inflationView', () => {
  const RATE_PCT = 2.5

  it('round-trips an amount through inflate then deflate, and back', () => {
    const money = inflationView(RATE_PCT, START_YEAR)
    for (const year of [START_YEAR - 4, START_YEAR, START_YEAR + 1, START_YEAR + 30]) {
      expect(money.deflate(year, money.inflate(year, 1_234.56)), String(year)).toBeCloseTo(1_234.56, 6)
      expect(money.inflate(year, money.deflate(year, 1_234.56)), String(year)).toBeCloseTo(1_234.56, 6)
    }
  })

  it('compounds the rate it is given, from the base year it is given', () => {
    // 1.025^10 = 1.2800845..., a figure independent of this module.
    expect(inflationView(RATE_PCT, START_YEAR).inflate(START_YEAR + 10, 1)).toBeCloseTo(1.2800845441, 9)
    // A different base year moves the exponent, not the rate.
    expect(inflationView(RATE_PCT, START_YEAR + 10).inflate(START_YEAR + 10, 1)).toBeCloseTo(1)
  })

  it('reads a year before the base year as the inverse, not as zero growth', () => {
    const money = inflationView(RATE_PCT, START_YEAR)
    expect(money.inflate(START_YEAR - 2, 1)).toBeCloseTo(1 / Math.pow(1.025, 2), 9)
  })
})
