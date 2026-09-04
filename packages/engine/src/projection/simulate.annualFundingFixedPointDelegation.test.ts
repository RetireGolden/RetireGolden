/**
 * Hostile seam proof for the annual funding fixed-point coordinator.
 *
 * The wrapper first runs production, then returns deliberately non-economic
 * accepted tax, penalty, cash-inflow, HECM, convergence, and ACA-flag values.
 * Those values are observed at independent ledger and warning boundaries, so an
 * orphaned coordinator or caller-side root recomputation cannot pass merely
 * because the production coordinator matches the former inline control flow.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
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

const hostile = vi.hoisted(() => ({
  inject: false,
  acaFixedPointFailed: true,
  acaConflictingCliffBasins: true,
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualFundingFixedPointInput<SimulatorEvaluation>,
      AnnualFundingFixedPointResult<SimulatorEvaluation>
    >(),
)

vi.mock('./internal/annualFundingFixedPoint.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualFundingFixedPoint.js')>(),
    'annualFundingFixedPoint',
    (natural): AnnualFundingFixedPointResult<SimulatorEvaluation> =>
      hostile.inject
        ? {
            ...natural,
            evaluation: {
              ...natural.evaluation,
              tax: 321,
              penalties: 123,
            },
            converged: false,
            closestResidual: 7.89,
            acceptedCoordinatedHecmDraw: 777,
            acceptedCashInflows: 999,
            acaFixedPointFailed: hostile.acaFixedPointFailed,
            acaConflictingCliffBasins: hostile.acaConflictingCliffBasins,
          }
        : natural,
  ),
)

import { expectSeamRanAtLeastOnce } from './simulate.seamGuard.test-support.js'
import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const START_YEAR = 2026
const zeroTax: TaxCalculator = { compute: () => 0 }

beforeEach(() => {
  hostile.inject = false
  hostile.acaFixedPointFailed = true
  hostile.acaConflictingCliffBasins = true
  seam.reset()
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

  hostile.inject = true
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

    const calls = expectSeamRanAtLeastOnce(seam)
    expect(calls.every((call) => call.injected !== call.natural)).toBe(true)
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

    hostile.acaFixedPointFailed = false
    hostile.acaConflictingCliffBasins = false
    const nonconverged = runInjectedProjection()
    expect(nonconverged.warnings).toContain(
      'Tax and withdrawal funding could not reconcile within half a cent for 2026; the closest result differs by $7.89.',
    )
  })
})
