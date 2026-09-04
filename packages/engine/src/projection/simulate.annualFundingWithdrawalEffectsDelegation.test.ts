/**
 * Hostile seam proof for annual funding-withdrawal characterization.
 *
 * The wrapper first runs production, then substitutes conspicuous traditional,
 * HSA, and Roth tax/penalty effects. Independent tax, annual-ledger, balance,
 * cash-flow, and warning observations fail if simulatePlan merely calls the
 * coordinator but recomputes any of those effects locally.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualFundingWithdrawalEffectsInput,
  AnnualFundingWithdrawalEffectsResult,
} from './internal/annualFundingWithdrawalEffects.js'

const hostile = vi.hoisted(() => ({
  inject: false,
  rothNext: {
    contributionBasis: 777,
    conversionLayers: [{ year: 2026, amount: 33, taxableAmount: 22 }],
  },
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualFundingWithdrawalEffectsInput,
      AnnualFundingWithdrawalEffectsResult
    >(),
)

vi.mock(
  './internal/annualFundingWithdrawalEffects.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualFundingWithdrawalEffects.js')
      >(),
      'annualFundingWithdrawalEffects',
      (natural): AnnualFundingWithdrawalEffectsResult =>
        hostile.inject
          ? {
              traditional: {
                rows: [{ sourceAccountId: 'traditional', amount: 50 }],
                penalty: 50,
              },
              hsa: {
                rows: [{
                  sourceAccountId: 'hsa',
                  taken: 30,
                  qualified: 30,
                  nonQualified: 17,
                  taxableOrdinary: 17,
                  penalty: 20,
                  capConsumed: 30,
                }],
                taxableOrdinary: 17,
                penalty: 20,
                qualified: 30,
                nonQualified: 17,
                capConsumed: 30,
              },
              roth: {
                rows: [{
                  poolKey: 'rothira:p1',
                  taken: 0,
                  ownerAgeAttained: 50,
                  split: {
                    contributions: 0,
                    conversions: 0,
                    earnings: 0,
                    penalty: 53,
                    taxableOrdinary: 29,
                    next: hostile.rothNext,
                  },
                }],
                taxableOrdinary: 29,
                penalty: 53,
              },
              penaltyExcludingRmdShortfallExcise: 123,
            }
          : natural,
    ),
)

import { expectSeamRanAtLeastOnce } from './simulate.seamGuard.test-support.js'
import type { Account } from '../model/plan.js'
import {
  cashAccount,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { TaxCalculator, TaxYearInput } from './types.js'

const START_YEAR = 2026

beforeEach(() => {
  hostile.inject = false
  seam.reset()
})

describe('simulatePlan annual funding-withdrawal-effects delegation', () => {
  it('consumes coordinator tax character, penalty rows, totals, and Roth next state', () => {
    const plan = singlePersonPlan({
      dob: '1976-01-01',
      planningAge: 60,
      retirementAge: null,
    })
    const cash = cashAccount('cash', 1_000)
    cash.annualReturnPct = 0
    plan.accounts = [
      cash,
      {
        type: 'traditional',
        id: 'traditional',
        name: 'Traditional IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
      {
        type: 'hsa',
        id: 'hsa',
        name: 'HSA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        balance: 0,
        annualContribution: 0,
        withdrawalTreatment: 'capByMedicalExpenses',
        reimburseLater: true,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth IRA',
        ownerPersonId: 'p1',
        annualReturnPct: 0,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
        contributionBasis: 0,
      },
    ] satisfies Account[]
    plan.incomes = []
    plan.careEvents = [{
      id: 'medical',
      personId: 'p1',
      startAge: 50,
      durationYears: 1,
      annualCost: 100,
    }]
    plan.expenses.baseAnnual = 0
    plan.expenses.healthcare = {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 0,
    }
    plan.assumptions.inflationPct = 0
    plan.assumptions.defaultReturnPct = 0

    const taxInputs: TaxYearInput[] = []
    const taxCalculator: TaxCalculator = {
      compute(input) {
        taxInputs.push(structuredClone(input))
        return input.ordinaryIncome
      },
    }
    hostile.inject = true

    const result = simulatePlan(validatePlan(plan), {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR + 1,
      taxCalculator,
      captureAnnualCashFlow: true,
    })
    const year = result.years[0]!

    const calls = expectSeamRanAtLeastOnce(seam)
    expect(calls.every((call) => call.injected !== call.natural)).toBe(true)
    expect(calls.some((call) =>
      call.input.year === START_YEAR + 1 &&
      call.input.rothBasisByPool.get('rothira:p1')?.contributionBasis ===
        hostile.rothNext.contributionBasis &&
      call.input.hsaQualifiedCap === 70
    )).toBe(true)
    expect(taxInputs.some((input) => input.ordinaryIncome === 46)).toBe(true)
    expect(year.tax).toBe(46)
    expect(year.penalties).toBe(123)
    expect(year.balances.cash).toBe(1_000 - 100 - 46 - 123)
    expect(result.warnings).toContain(
      'Early-withdrawal penalties were charged (pre-59½ traditional or pre-65 HSA).',
    )

    const penaltyUses = year.cashFlow!.useLines
      .filter((line) => line.kind === 'earlyWithdrawalPenalty')
      .map((line) => ({
        penaltyClass: line.penaltyClass,
        requestedPlanDollars: line.requestedPlanDollars,
      }))
    expect(penaltyUses).toEqual([
      { penaltyClass: 'hsaNonMedical', requestedPlanDollars: 20 },
      { penaltyClass: 'traditionalEarly', requestedPlanDollars: 50 },
      { penaltyClass: 'rothEarly', requestedPlanDollars: 53 },
    ])
    expect(year.cashFlow!.reconciliation.status).toBe('reconciled')
  })
})
