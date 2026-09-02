/**
 * Hostile seam proof for candidate tax/ACA funding evaluation.
 *
 * The wrapper first runs production, then replaces its accepted tax, penalty,
 * required-need, healthcare, HSA-cap, and warning-gate values. Independent
 * ledger and warning observations fail if simulatePlan calls the coordinator
 * but reconstructs any of those outputs locally.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualFundingCandidateEvaluationInput,
  AnnualFundingCandidateEvaluationResult,
  AnnualFundingCandidateWithdrawalPlan,
} from './internal/annualFundingCandidateEvaluation.js'

interface CandidateCall {
  readonly input: AnnualFundingCandidateEvaluationInput<AnnualFundingCandidateWithdrawalPlan>
  readonly original: AnnualFundingCandidateEvaluationResult<AnnualFundingCandidateWithdrawalPlan>
  readonly output: AnnualFundingCandidateEvaluationResult<AnnualFundingCandidateWithdrawalPlan>
}

const seam = vi.hoisted(() => ({
  inject: false,
  calls: [] as CandidateCall[],
  withdrawalEffectsInputs: [] as unknown[],
}))

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
        seam.withdrawalEffectsInputs.push(input)
        return original.annualFundingWithdrawalEffects(input)
      },
    }
  },
)

vi.mock(
  './internal/annualFundingCandidateEvaluation.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualFundingCandidateEvaluation.js')
    >()
    return {
      ...original,
      annualFundingCandidateEvaluation: (
        input: AnnualFundingCandidateEvaluationInput<AnnualFundingCandidateWithdrawalPlan>,
      ) => {
        const production = original.annualFundingCandidateEvaluation(input)
        const output = seam.inject
          ? {
              ...production,
              tax: 321,
              penalties: 123,
              requiredNeed: 444,
              healthcare: 50,
              hsaQualifiedCap: 70,
              traditionalEarlyWithdrawalPenaltyCharged: true,
            }
          : production
        seam.calls.push({ input, original: production, output })
        return output
      },
    }
  },
)

import { cashAccount, singlePersonPlan, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator } from './types.js'

const START_YEAR = 2026
const zeroTax: TaxCalculator = { compute: () => 0 }

beforeEach(() => {
  seam.inject = false
  seam.calls.length = 0
  seam.withdrawalEffectsInputs.length = 0
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

    seam.inject = true
    const result = simulatePlan(validatePlan(plan), {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR,
      taxCalculator: zeroTax,
    })
    const year = result.years[0]!

    expect(seam.calls.length).toBeGreaterThanOrEqual(2)
    expect(seam.calls.every((call) => call.output !== call.original)).toBe(true)
    expect(seam.calls.every((call) =>
      Object.isFrozen(call.input) &&
      Object.isFrozen(call.input.taxInputBase) &&
      Object.isFrozen(call.input.aca) &&
      Object.isFrozen(call.input.hsa)
    )).toBe(true)
    expect(seam.calls.some((call) =>
      call.input.request.need === 444 &&
      call.input.withdrawalPlan.byCategory.cash === 444 &&
      call.original.withdrawalPlan === call.input.withdrawalPlan
    )).toBe(true)
    expect(seam.withdrawalEffectsInputs).toHaveLength(seam.calls.length + 1)
    expect(seam.withdrawalEffectsInputs.at(-1)).toMatchObject({
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
