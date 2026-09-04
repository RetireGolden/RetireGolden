/**
 * Hostile delegation guard for the remaining annual expense band.
 *
 * Each planner seam returns non-economic sentinels that shift with the call
 * ordinal, so a caller that recomputes any band member locally, or that reuses
 * the first year's answer, cannot reproduce the published ledger. The
 * settlement mock beside them is not a delegation seam: it replaces the attempt
 * runner outright to force one rolled-back annual pass.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualHealthcareExpensesInput,
  AnnualHealthcareExpensesResult,
} from './internal/annualHealthcareExpenses.js'

type DebtInput = Parameters<
  typeof import('./internal/annualDebtAndLongTermCare.js').annualDebtServiceRows
>[0]
type DebtResult = ReturnType<
  typeof import('./internal/annualDebtAndLongTermCare.js').annualDebtServiceRows
>
type LtcInput = Parameters<
  typeof import('./internal/annualDebtAndLongTermCare.js').annualLongTermCarePlan
>[0]
type LtcResult = ReturnType<
  typeof import('./internal/annualDebtAndLongTermCare.js').annualLongTermCarePlan
>
type GuardrailInput = Parameters<
  typeof import('./internal/annualGuardrailFunding.js').annualGuardrailFundingPlan
>[0]
type GuardrailResult = ReturnType<
  typeof import('./internal/annualGuardrailFunding.js').annualGuardrailFundingPlan
>

const hostile = vi.hoisted(() => ({
  returnIncompleteMarketplaceMonths: false,
  rollbacks: 0,
}))

const debtSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<DebtInput, DebtResult, number | undefined>(),
)

const ltcSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<LtcInput, LtcResult, number | undefined>(),
)

const healthcareSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualHealthcareExpensesInput,
      AnnualHealthcareExpensesResult
    >(),
)

const guardrailSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<GuardrailInput, GuardrailResult>(),
)

vi.mock('../internal/ownedNonRothIraAnnualAttemptSettlement.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('../internal/ownedNonRothIraAnnualAttemptSettlement.js')
  >()
  const { beginSimulatorAnnualPassTransaction } = await import(
    './annualPassTransaction.js'
  )
  const { asPlanId } = await import('../actions/identity.js')
  return {
    ...original,
    runOwnedNonRothIraAnnualSettlementAttempts: (
      input: Parameters<
        typeof original.runOwnedNonRothIraAnnualSettlementAttempts
      >[0],
    ) => {
      const transaction = beginSimulatorAnnualPassTransaction(input.state)
      input.runAttempt({
        attemptNumber: 1,
        stable: {
          planId: asPlanId(input.plan.id),
          projectionStartTaxYear: input.projectionStartTaxYear,
        },
        assumedEffects: [],
      })
      input.state.expenses.healthcare = -9_999
      input.state.healthcare.write(-9_999)
      transaction.rollback()
      hostile.rollbacks += 1
      return Object.freeze({
        status: 'rolledBack' as const,
        reason: 'assumptionCycle' as const,
        attemptCount: 1,
        pendingSettlement: null,
        committedCarryforwards: null,
        issue: null,
      })
    },
  }
})

vi.mock('./internal/annualDebtAndLongTermCare.js', async (importOriginal) =>
  ltcSeam.through(
    debtSeam.through(
      await importOriginal<
        typeof import('./internal/annualDebtAndLongTermCare.js')
      >(),
      'annualDebtServiceRows',
      (_natural, { ordinal }): DebtResult => [{
        accountId: 'delegation-debt',
        ownerPersonId: 'p1',
        amount: 11 + ordinal,
        nextBalance: 101 + ordinal,
      }],
      { capture: (input) => input.balances.get('delegation-debt') },
    ),
    'annualLongTermCarePlan',
    (_natural, { ordinal }): LtcResult => ({
      careCost: 13 + ordinal,
      ltcBenefit: 5 + ordinal,
      benefitYearWrites: [{
        policyId: 'delegation-policy',
        yearsUsed: 41 + ordinal,
      }],
      personRows: [],
    }),
    { capture: (input) => input.benefitYearsUsed.get('delegation-policy') },
  ),
)

vi.mock('./internal/annualHealthcareExpenses.js', async (importOriginal) =>
  healthcareSeam.through(
    await importOriginal<typeof import('./internal/annualHealthcareExpenses.js')>(),
    'annualHealthcareExpenses',
    (natural, { ordinal }): AnnualHealthcareExpensesResult => {
      const healthcare = 17 + ordinal
      const result = {
        ...natural,
        healthcare,
        healthcareExcludingAcaEnrollment: healthcare,
        healthcareExcludingMarketplacePremium: healthcare,
      }
      return hostile.returnIncompleteMarketplaceMonths
        ? { ...result, marketplaceMonthsByPersonPosition: [] }
        : result
    },
  ),
)

vi.mock('./internal/annualGuardrailFunding.js', async (importOriginal) =>
  guardrailSeam.through(
    await importOriginal<typeof import('./internal/annualGuardrailFunding.js')>(),
    'annualGuardrailFundingPlan',
    (natural, { ordinal }): GuardrailResult => ({
      ...natural,
      discretionaryMultiplier: 2 + ordinal,
      startingWithdrawalRate: 0.02 + ordinal,
      startingRealPortfolio: 300 + ordinal,
      targetLifestyleFunded: 19 + ordinal,
    }),
  ),
)

import { expectSeamRan } from './simulate.seamGuard.test-support.js'
import type { Account } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

afterEach(() => {
  hostile.returnIncompleteMarketplaceMonths = false
})

function debt(): Extract<Account, { type: 'debt' }> {
  return {
    type: 'debt',
    id: 'delegation-debt',
    name: 'Delegation debt',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance: 100,
    interestPct: 0,
    monthlyPayment: 1,
  }
}

describe('simulatePlan delegates the remaining annual expense band', () => {
  it('consumes every injected planner result once per year, outside probes', () => {
    debtSeam.reset()
    ltcSeam.reset()
    healthcareSeam.reset()
    hostile.returnIncompleteMarketplaceMonths = false
    guardrailSeam.reset()
    hostile.rollbacks = 0
    const plan = singlePersonPlan({ planningAge: 90 })
    plan.expenses.baseAnnual = 23
    const ira = traditionalAccount('ira', 1_000, 'p1', 'ira')
    if (ira.type !== 'traditional') throw new Error('expected traditional IRA')
    ira.nondeductibleBasis = 100
    plan.accounts = [cashAccount('cash', 10_000), debt(), ira]

    const result = simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2027,
      taxCalculator: createFlatTaxCalculator(0),
    })

    expect(result.years).toHaveLength(2)
    const debtCalls = expectSeamRan(debtSeam, 2)
    const ltcCalls = expectSeamRan(ltcSeam, 2)
    expectSeamRan(healthcareSeam, 2)
    const guardrailCalls = expectSeamRan(guardrailSeam, 2)
    expect(hostile.rollbacks).toBe(1)
    expect(debtCalls[0]!.input.balances).toBe(
      debtCalls[1]!.input.balances,
    )
    expect(debtCalls.map((call) => call.captured)).toStrictEqual([100, 101])
    expect(ltcCalls[0]!.input.benefitYearsUsed).toBe(
      ltcCalls[1]!.input.benefitYearsUsed,
    )
    expect(ltcCalls.map((call) => call.captured)).toStrictEqual([
      undefined,
      41,
    ])
    expect(guardrailCalls.map(({ input: { discretionaryMultiplier,
      startingWithdrawalRate,
      startingRealPortfolio,
    } }) => ({
      discretionaryMultiplier,
      startingWithdrawalRate,
      startingRealPortfolio,
    }))).toStrictEqual([
      {
        discretionaryMultiplier: 1,
        startingWithdrawalRate: null,
        startingRealPortfolio: null,
      },
      {
        discretionaryMultiplier: 2,
        startingWithdrawalRate: 0.02,
        startingRealPortfolio: 300,
      },
    ])

    expect(result.years.map((year) => ({
      debt: year.expenses.debtService,
      healthcare: year.expenses.healthcare,
      care: year.expenses.careCost,
      benefit: year.expenses.ltcBenefit,
      base: year.expenses.baseSpending,
    }))).toStrictEqual([
      { debt: 11, healthcare: 17, care: 13, benefit: 5, base: 42 },
      { debt: 12, healthcare: 18, care: 14, benefit: 6, base: 43 },
    ])
  })

  it('fails loudly when the healthcare planner breaks positional Marketplace alignment', () => {
    hostile.returnIncompleteMarketplaceMonths = true
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 100

    expect(() => simulatePlan(validatePlan(plan), {
      startYear: 2026,
      horizonEndYear: 2026,
      taxCalculator: createFlatTaxCalculator(0),
    })).toThrow('Healthcare planner person-row mismatch')
  })
})
