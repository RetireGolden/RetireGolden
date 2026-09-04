/**
 * Hostile seam proof for candidate tax/ACA funding evaluation.
 *
 * The wrapper first runs production, then replaces its accepted tax, penalty,
 * required-need, healthcare, HSA-cap, and warning-gate values. Independent
 * ledger and warning observations fail if simulatePlan calls the coordinator
 * but reconstructs any of those outputs locally.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualFundingCandidateEvaluationInput,
  AnnualFundingCandidateEvaluationResult,
  AnnualFundingCandidateWithdrawalPlan,
} from './internal/annualFundingCandidateEvaluation.js'

const hostile = vi.hoisted(() => ({
  inject: false,
  withdrawalEffectsInputs: [] as unknown[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualFundingCandidateEvaluationInput<AnnualFundingCandidateWithdrawalPlan>,
      AnnualFundingCandidateEvaluationResult<AnnualFundingCandidateWithdrawalPlan>
    >(),
)

vi.mock(
  './internal/annualFundingWithdrawalEffects.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualFundingWithdrawalEffects.js')
    >()
    return {
      ...original,
      annualFundingWithdrawalEffects: (
        input: Parameters<typeof original.annualFundingWithdrawalEffects>[0],
      ) => {
        hostile.withdrawalEffectsInputs.push(input)
        return original.annualFundingWithdrawalEffects(input)
      },
    }
  },
)

vi.mock(
  './internal/annualFundingCandidateEvaluation.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualFundingCandidateEvaluation.js')
      >(),
      'annualFundingCandidateEvaluation',
      (
        natural,
      ): AnnualFundingCandidateEvaluationResult<AnnualFundingCandidateWithdrawalPlan> =>
        hostile.inject
          ? {
              ...natural,
              tax: 321,
              penalties: 123,
              requiredNeed: 444,
              healthcare: 50,
              hsaQualifiedCap: 70,
              traditionalEarlyWithdrawalPenaltyCharged: true,
            }
          : natural,
    ),
)

import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const START_YEAR = 2026
const zeroTax: TaxCalculator = { compute: () => 0 }

beforeEach(() => {
  hostile.inject = false
  hostile.withdrawalEffectsInputs.length = 0
  seam.reset()
})

describe('simulatePlan annual funding candidate-evaluation delegation', () => {
  it('commits the coordinator-selected evaluation and preserves caller-owned planning inputs', () => {
    const plan = singlePersonPlan({
      dob: '1976-01-01',
      planningAge: 60,
      retirementAge: null,
    })
    const cash = cashAccount('cash', 1_000)
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
    const result = simulatePlan(validatePlan(plan), {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: zeroTax,
    })
    const year = result.years[0]!

    expect(seam.calls.length).toBeGreaterThanOrEqual(2)
    expect(seam.calls.every((call) => call.injected !== call.natural)).toBe(true)
    expect(seam.calls.every((call) =>
      Object.isFrozen(call.input) &&
      Object.isFrozen(call.input.taxInputBase) &&
      Object.isFrozen(call.input.aca) &&
      Object.isFrozen(call.input.hsa)
    )).toBe(true)
    expect(seam.calls.some((call) =>
      call.input.request.need === 444 &&
      call.input.withdrawalPlan.byCategory.cash === 444 &&
      call.natural.withdrawalPlan === call.input.withdrawalPlan
    )).toBe(true)
    expect(hostile.withdrawalEffectsInputs).toHaveLength(seam.calls.length + 1)
    expect(hostile.withdrawalEffectsInputs.at(-1)).toMatchObject({
      hsaQualifiedCap: 70,
    })
    expect(year.tax).toBe(321)
    expect(year.penalties).toBe(123)
    expect(year.expenses.healthcare).toBe(50)
    expect(year.balances.cash).toBe(556)
    expect(result.warnings).toContain(
      'Early-withdrawal penalties were charged (pre-59½ traditional or pre-65 HSA).',
    )
  })
})
