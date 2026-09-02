/**
 * Hostile seam proof for the annual funding fixed-point coordinator.
 *
 * The wrapper first runs production, then returns deliberately non-economic
 * accepted tax, penalty, cash-inflow, HECM, convergence, and ACA-flag values.
 * Those values are observed at independent ledger and warning boundaries, so an
 * orphaned coordinator or caller-side root recomputation cannot pass merely
 * because the production coordinator matches the former inline control flow.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualFundingFixedPointEvaluation,
  AnnualFundingFixedPointInput,
  AnnualFundingFixedPointResult,
} from './internal/annualFundingFixedPoint.js'

type SimulatorEvaluation = AnnualFundingFixedPointEvaluation & Readonly<{
  tax: number
  penalties: number
}>

interface FundingCall {
  readonly input: AnnualFundingFixedPointInput<SimulatorEvaluation>
  readonly original: AnnualFundingFixedPointResult<SimulatorEvaluation>
  readonly output: AnnualFundingFixedPointResult<SimulatorEvaluation>
}

const seam = vi.hoisted(() => ({
  inject: false,
  acaFixedPointFailed: true,
  acaConflictingCliffBasins: true,
  calls: [] as FundingCall[],
}))

vi.mock('./internal/annualFundingFixedPoint.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualFundingFixedPoint.js')>()
  return {
    ...original,
    annualFundingFixedPoint: (
      input: AnnualFundingFixedPointInput<SimulatorEvaluation>,
    ) => {
      const production = original.annualFundingFixedPoint(input)
      const output = seam.inject
        ? {
            ...production,
            evaluation: {
              ...production.evaluation,
              tax: 321,
              penalties: 123,
            },
            converged: false,
            closestResidual: 7.89,
            acceptedCoordinatedHecmDraw: 777,
            acceptedCashInflows: 999,
            acaFixedPointFailed: seam.acaFixedPointFailed,
            acaConflictingCliffBasins: seam.acaConflictingCliffBasins,
          }
        : production
      seam.calls.push({ input, original: production, output })
      return output
    },
  }
})

import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const START_YEAR = 2026
const zeroTax: TaxCalculator = { compute: () => 0 }

beforeEach(() => {
  seam.inject = false
  seam.acaFixedPointFailed = true
  seam.acaConflictingCliffBasins = true
  seam.calls.length = 0
})

const runInjectedProjection = () => {
  const plan = singlePersonPlan({
    dob: '1966-01-01',
    planningAge: 60,
    retirementAge: null,
  })
  const cash = cashAccount('cash', 0)
  cash.annualReturnPct = 0
  plan.accounts = [cash]
  plan.incomes = []
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0

  seam.inject = true
  return simulatePlan(validatePlan(plan), {
    startYear: START_YEAR,
    horizonEndYear: START_YEAR,
    taxCalculator: zeroTax,
  })
}

describe('simulatePlan annual funding fixed-point delegation', () => {
  it('commits the selected evaluation, cash, HECM draw, flags, and diagnostics', () => {
    const result = runInjectedProjection()
    const year = result.years[0]!

    expect(seam.calls.length).toBeGreaterThan(0)
    expect(seam.calls.every((call) => call.output !== call.original)).toBe(true)
    expect(year.tax).toBe(321)
    expect(year.penalties).toBe(123)
    expect(year.balances.cash).toBe(999 - 321 - 123)
    expect(year.hecmDraw).toBe(777)
    expect(result.warnings).toContain(
      'ACA premium, tax, and withdrawals did not reach a stable subsidized fixed point for 2026; gross enrollment premium was funded.',
    )
    expect(result.warnings).toContain(
      'ACA funding has conflicting subsidized and gross-premium fixed points for 2026; gross enrollment premium was funded.',
    )

    seam.acaFixedPointFailed = false
    seam.acaConflictingCliffBasins = false
    const nonconverged = runInjectedProjection()
    expect(nonconverged.warnings).toContain(
      'Tax and withdrawal funding could not reconcile within half a cent for 2026; the closest result differs by $7.89.',
    )
  })
})
