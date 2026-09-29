/**
 * Washington's income tax from 2028 (ESSB 6346) must not disturb a Washington
 * household that never owes it. Two library examples are moved to Washington,
 * the way the round-three review of decision D-2027-PUBLISHED-FIGURES checked
 * them: bracket-fill-roth, which gives to charity from its IRAs, and
 * early-retiree-aca. Neither reaches the $1,000,000 deduction.
 *
 * - The direct-QCD policy conforms from 2028 (section 301), so the QCD years
 *   stay complete and add no warning, and the optimizer keeps its pick.
 * - The optimizer's linear program gives Washington's deduction a zero-rate
 *   band (optimizePlan.ts#stateBracketSegmentsFor), so it does not front-load
 *   conversions into 2026 and 2027 to escape a 9.9% the household never pays.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '@retiregolden/engine/model/plan'
import { optimizePlan } from '@retiregolden/engine/projection/optimizePlan'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { EXAMPLE_FIXED_YEAR } from './buildContext'
import { getExampleById } from './registry'

function examplePlan(id: string, state?: string): Plan {
  const plan = getExampleById(id)!.build()
  if (state !== undefined) {
    plan.household.state = state
    plan.household.stateMoves = []
  }
  return plan
}

const options = (plan: Plan) => ({
  startYear: EXAMPLE_FIXED_YEAR,
  taxCalculator: combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  ),
})

describe('bracket-fill-roth moved to Washington', () => {
  const plan = examplePlan('bracket-fill-roth', 'WA')
  const home = examplePlan('bracket-fill-roth')

  it('keeps 2028 to 2030 complete and adds no warning', () => {
    const result = simulatePlan(plan, options(plan))
    const years = result.years.filter((year) => year.year >= 2028 && year.year <= 2030)
    expect(years.map((year) => year.taxComputation?.status)).toEqual(['complete', 'complete', 'complete'])
    const inHome = simulatePlan(home, options(home))
    const warnings = (projection: typeof result) => projection.warnings.map((warning) => (typeof warning === 'string' ? warning : JSON.stringify(warning)))
    expect(warnings(result)).toEqual(warnings(inHome))
    // It owes Washington nothing, so every year's tax is the same as at home.
    expect(result.years.map((year) => year.tax)).toEqual(inHome.years.map((year) => year.tax))
  })

  it('leaves the optimizer’s pick where it is in the household’s own state', async () => {
    const moved = await optimizePlan(plan, options(plan))
    const own = await optimizePlan(home, options(home))
    expect(moved.tournament?.winnerSource).toBe('incumbent')
    expect(moved.tournament?.winnerSource).toBe(own.tournament?.winnerSource)
    expect(moved.tournament?.winnerLabel).toBe(own.tournament?.winnerLabel)
  }, 300_000)
})

describe('early-retiree-aca moved to Washington', () => {
  it('keeps the solve’s 2026 and 2027 conversions near 10,500 and 10,763', async () => {
    const plan = examplePlan('early-retiree-aca', 'WA')
    const result = await optimizePlan(plan, options(plan))
    const schedule = result.schedule.schedule
    expect(Math.abs(schedule[0]!.conversion - 10_500)).toBeLessThan(50)
    expect(Math.abs(schedule[1]!.conversion - 10_763)).toBeLessThan(50)
  }, 300_000)
})
