import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualHealthcareExpensesInput,
  AnnualHealthcareExpensesResult,
} from './internal/annualHealthcareExpenses.js'

type DebtInput = Parameters<
  typeof import('./internal/annualDebtAndLongTermCare.js').annualDebtServiceRows
>[0]
type LtcInput = Parameters<
  typeof import('./internal/annualDebtAndLongTermCare.js').annualLongTermCarePlan
>[0]
type GuardrailInput = Parameters<
  typeof import('./internal/annualGuardrailFunding.js').annualGuardrailFundingPlan
>[0]

const seam = vi.hoisted(() => ({
  debt: [] as Array<{ input: DebtInput; opening: number | undefined }>,
  ltc: [] as Array<{ input: LtcInput; opening: number | undefined }>,
  healthcare: [] as AnnualHealthcareExpensesInput[],
  guardrail: [] as GuardrailInput[],
  rollbacks: 0,
}))

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
      seam.rollbacks += 1
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

vi.mock('./internal/annualDebtAndLongTermCare.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualDebtAndLongTermCare.js')
  >()
  return {
    ...original,
    annualDebtServiceRows: (input: DebtInput) => {
      seam.debt.push({
        input,
        opening: input.balances.get('delegation-debt'),
      })
      const ordinal = seam.debt.length - 1
      return [{
        accountId: 'delegation-debt',
        ownerPersonId: 'p1',
        amount: 11 + ordinal,
        nextBalance: 101 + ordinal,
      }]
    },
    annualLongTermCarePlan: (input: LtcInput) => {
      seam.ltc.push({
        input,
        opening: input.benefitYearsUsed.get('delegation-policy'),
      })
      const ordinal = seam.ltc.length - 1
      return {
        careCost: 13 + ordinal,
        ltcBenefit: 5 + ordinal,
        benefitYearWrites: [{
          policyId: 'delegation-policy',
          yearsUsed: 41 + ordinal,
        }],
        personRows: [],
      }
    },
  }
})

vi.mock('./internal/annualHealthcareExpenses.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualHealthcareExpenses.js')
  >()
  return {
    ...original,
    annualHealthcareExpenses: (
      input: AnnualHealthcareExpensesInput,
    ): AnnualHealthcareExpensesResult => {
      seam.healthcare.push(input)
      const natural = original.annualHealthcareExpenses(input)
      const healthcare = 17 + seam.healthcare.length - 1
      return {
        ...natural,
        healthcare,
        healthcareExcludingAcaEnrollment: healthcare,
        healthcareExcludingMarketplacePremium: healthcare,
      }
    },
  }
})

vi.mock('./internal/annualGuardrailFunding.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualGuardrailFunding.js')
  >()
  return {
    ...original,
    annualGuardrailFundingPlan: (input: GuardrailInput) => {
      seam.guardrail.push(input)
      const natural = original.annualGuardrailFundingPlan(input)
      const ordinal = seam.guardrail.length - 1
      return {
        ...natural,
        targetLifestyleFunded: 19 + ordinal,
      }
    },
  }
})

import type { Account } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

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
    seam.debt.length = 0
    seam.ltc.length = 0
    seam.healthcare.length = 0
    seam.guardrail.length = 0
    seam.rollbacks = 0
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
    expect(seam.debt).toHaveLength(2)
    expect(seam.ltc).toHaveLength(2)
    expect(seam.healthcare).toHaveLength(2)
    expect(seam.guardrail).toHaveLength(2)
    expect(seam.rollbacks).toBe(1)
    expect(seam.debt[0]!.input.balances).toBe(
      seam.debt[1]!.input.balances,
    )
    expect(seam.debt.map((call) => call.opening)).toStrictEqual([100, 101])
    expect(seam.ltc[0]!.input.benefitYearsUsed).toBe(
      seam.ltc[1]!.input.benefitYearsUsed,
    )
    expect(seam.ltc.map((call) => call.opening)).toStrictEqual([
      undefined,
      41,
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
})
