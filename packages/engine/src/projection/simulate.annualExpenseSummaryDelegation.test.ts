/**
 * Delegation guard for the final annual expense-summary extraction.
 *
 * The mock runs the real pure helper first, then returns a fresh set of
 * deliberately different values. Matching the normal projection is not enough
 * to prove the helper is wired in: an orphaned helper beside the old inline
 * block would still match. These sentinels instead prove that `simulatePlan`
 * publishes the helper's exact mutable object and carries each separate layer
 * base into downstream shortfall attribution.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. The second
 * mock below (the goal scheduler) is not a delegation seam and keeps its own
 * hand-written factory.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualExpenseSummary,
  AnnualExpenseSummaryInput,
} from './internal/annualExpenseSummary.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualExpenseSummaryInput,
      AnnualExpenseSummary,
      AnnualExpenseSummaryInput
    >(),
)
const guardrailSeam = vi.hoisted(() => ({ calls: 0 }))

vi.mock('./internal/annualExpenseSummary.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualExpenseSummary.js')>(),
    'annualExpenseSummary',
    (_natural, { ordinal }): AnnualExpenseSummary => ({
      expenses: {
        baseSpending: 2_001 + ordinal,
        oneTimeGoals: 2_003 + ordinal,
        debtService: 2_005 + ordinal,
        propertyCosts: 2_007 + ordinal,
        healthcare: 2_011 + ordinal,
        insurancePremiums: 2_013 + ordinal,
        careCost: 2_017 + ordinal,
        ltcBenefit: 2_019 + ordinal,
        requiredSpending: 2_023 + ordinal,
        targetSpending: 2_029 + ordinal,
        idealSpending: 2_031 + ordinal,
        excessSpending: 2_037 + ordinal,
        intendedSpending: 2_039 + ordinal,
        guardrailFactor: 0.81 + ordinal / 100,
        total: 101 + ordinal,
      },
      requiredSpendingBase: 137 + ordinal,
      targetSpendingBase: 159 + ordinal,
      idealSpendingBase: 23 + ordinal,
      excessSpendingBase: 29 + ordinal,
    }),
    { capture: (input): AnnualExpenseSummaryInput => ({ ...input }) },
  ),
)

vi.mock('../spending/flexibleGoals.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('../spending/flexibleGoals.js')>()
  return {
    ...original,
    createGoalScheduler: (): import('../spending/flexibleGoals.js').GoalScheduler => ({
      isResolved: () => false,
      planYear: () => ({
        remainingBudget: null,
        results: [
          {
            id: 'required-goal-sentinel',
            classification: 'required',
            outcome: 'partiallyFunded',
            amountNominal: 214,
            fundedNominal: 101,
            unfundedNominal: 113,
          },
          {
            id: 'target-goal-sentinel',
            classification: 'target',
            outcome: 'partiallyFunded',
            amountNominal: 230,
            fundedNominal: 103,
            unfundedNominal: 127,
          },
          {
            id: 'ideal-goal-sentinel',
            classification: 'ideal',
            outcome: 'partiallyFunded',
            amountNominal: 238,
            fundedNominal: 107,
            unfundedNominal: 131,
          },
          {
            id: 'excess-goal-sentinel',
            classification: 'excess',
            outcome: 'partiallyFunded',
            amountNominal: 246,
            fundedNominal: 109,
            unfundedNominal: 137,
          },
        ],
      }),
    }),
  }
})

vi.mock('../spending/guardrails.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('../spending/guardrails.js')>()
  return {
    ...original,
    nextGuardrailMultiplier: () => {
      const multiplier = guardrailSeam.calls === 0 ? 2 : 0.5
      guardrailSeam.calls += 1
      return {
        multiplier,
        action: multiplier > 1 ? ('raise' as const) : ('cut' as const),
      }
    },
  }
})

import type { Account, CareEvent, InsurancePolicy } from '../model/plan.js'
import { expectSeamRanAtLeastOnce } from './simulate.seamGuard.test-support.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

function debt(): Extract<Account, { type: 'debt' }> {
  return {
    type: 'debt',
    id: 'expense-summary-debt',
    name: 'Expense summary debt',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 10_000,
    interestPct: 0,
    monthlyPayment: 149 / 12,
  }
}

function property(): Extract<Account, { type: 'property' }> {
  return {
    type: 'property',
    id: 'expense-summary-property',
    name: 'Expense summary property',
    ownerPersonId: null,
    annualReturnPct: null,
    value: 50_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    propertyTaxAnnual: 151,
    insuranceAnnual: 0,
  }
}

function ltcPolicy(): Extract<InsurancePolicy, { kind: 'ltc' }> {
  return {
    kind: 'ltc',
    id: 'expense-summary-ltc',
    name: 'Expense summary LTC',
    owner: 'p1',
    annualPremium: 157,
    premiumMode: 'lifetime',
    benefitMonthly: 139 / 12,
    benefitPeriodYears: 'lifetime',
    eliminationPeriodDays: 0,
  }
}

function careEvent(): CareEvent {
  return {
    id: 'expense-summary-care',
    personId: 'p1',
    startAge: 60,
    durationYears: 2,
    annualCost: 163,
  }
}

function run() {
  seam.reset()
  guardrailSeam.calls = 0
  const plan = singlePersonPlan({ planningAge: 90 })
  plan.expenses.baseAnnual = 41
  plan.expenses.requiredAnnual = 17
  plan.expenses.idealAnnual = 13
  plan.expenses.excessAnnual = 11
  plan.expenses.spendingPolicy = { mode: 'withdrawalRateGuardrails' }
  plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 167 / 12
  plan.accounts = [cashAccount('guardrail-signal', 1_000), debt(), property()]
  plan.insurance = [ltcPolicy()]
  plan.careEvents = [careEvent()]
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    horizonEndYear: 2027,
    taxCalculator: createFlatTaxCalculator(0),
  })
  return { result, calls: [...expectSeamRanAtLeastOnce(seam)] }
}

describe('simulatePlan delegates final annual expense assembly', () => {
  it('calls the helper once per year with every live spending component', () => {
    const { result, calls } = run()

    expect(result.years.map((year) => year.year)).toEqual([2026, 2027])
    expect(calls).toHaveLength(result.years.length)
    for (let ordinal = 0; ordinal < calls.length; ordinal++) {
      const call = calls[ordinal]!
      const raising = ordinal === 0
      // `captured` is the shallow copy taken at call time, so a later mutation
      // of the live input cannot rewrite what this asserts.
      expect(call.captured).toEqual({
        requiredLifestyle: 17,
        targetLifestyle: 24,
        targetLifestyleFunded: raising ? 24 : 12,
        idealLifestyle: 13,
        idealLifestyleFunded: raising ? 13 : 0,
        excessLifestyle: 11,
        excessLifestyleFunded: raising ? 11 : 0,
        systemRequired: 648,
        oneTimeGoalsFunded: 420,
        requiredGoalsFunded: 101,
        targetGoalsFunded: 103,
        idealGoalsFunded: 107,
        excessGoalsFunded: 109,
        skippedRequiredNominal: 113,
        skippedTargetNominal: 127,
        skippedIdealNominal: 131,
        skippedExcessNominal: 137,
        debtService: 149,
        propertyCosts: 151,
        healthcare: 167,
        insurancePremiums: 157,
        careCost: 163,
        ltcBenefit: 139,
        discretionaryMultiplier: raising ? 2 : 0.5,
      })
      expect(call.natural).toEqual({
        expenses: {
          baseSpending: raising ? 65 : 29,
          oneTimeGoals: 420,
          debtService: 149,
          propertyCosts: 151,
          healthcare: 167,
          insurancePremiums: 157,
          careCost: 163,
          ltcBenefit: 139,
          requiredSpending: 879,
          targetSpending: 1_133,
          idealSpending: 251,
          excessSpending: 257,
          intendedSpending: 1_641,
          guardrailFactor: raising ? 2 : 0.5,
          total: raising ? 1_133 : 1_097,
        },
        requiredSpendingBase: 766,
        targetSpendingBase: 893,
        idealSpendingBase: 120,
        excessSpendingBase: 120,
      })
    }
  })

  it('publishes each fresh helper object and consumes all returned bases downstream', () => {
    const { result, calls } = run()

    expect(calls[0]!.injected.expenses).not.toBe(calls[1]!.injected.expenses)
    for (let ordinal = 0; ordinal < calls.length; ordinal++) {
      const call = calls[ordinal]!
      const year = result.years[ordinal]!

      expect(year.expenses).toBe(call.injected.expenses)
      expect(year.expenses).toEqual(call.injected.expenses)
      expect(year.shortfall).toBe(0)
      expect(year.requiredShortfall).toBe(149)
      expect(year.targetShortfall).toBe(298)
      expect(year.idealShortfall).toBe(154 + ordinal)
      expect(year.excessShortfall).toBe(166 + ordinal)
    }
  })
})
