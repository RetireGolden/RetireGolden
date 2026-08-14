import { describe, expect, it } from 'vitest'

import { singlePersonPlan, taxableAccount, validatePlan } from '@retiregolden/engine/testing/planFixtures'
import { projectPlan } from './projection'

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
})
