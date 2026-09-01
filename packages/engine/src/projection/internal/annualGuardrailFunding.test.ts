import { describe, expect, it } from 'vitest'

import { cashAccount, singlePersonPlan } from '../../testing/planFixtures.js'
import { annualGuardrailFundingPlan } from './annualGuardrailFunding.js'

describe('annualGuardrailFundingPlan', () => {
  it('folds positional balances and returns the persistent withdrawal-rate state', () => {
    const plan = singlePersonPlan()
    plan.expenses.spendingPolicy = {
      mode: 'withdrawalRateGuardrails',
      upperGuardrailPct: 101,
      adjustmentPct: 25,
    }
    plan.expenses.oneTimeGoals = [{
      id: 'early',
      label: 'Early goal',
      year: 2028,
      amount: 40,
      flexibility: 'movable',
      earliestYear: 2026,
    }]
    const account = cashAccount('same-id', 0)
    const input = {
      guardrailsActive: true,
      riskBasedGuardrails: false,
      allowRaisesAboveTarget:
        plan.expenses.spendingPolicy?.allowRaisesAboveTarget,
      guardrailPolicy: {
        mode: 'withdrawal-rate' as const,
        upperGuardrailPct: 101,
        adjustmentPct: 25,
      },
      oneTimeGoals: plan.expenses.oneTimeGoals,
      isGoalResolved: () => false,
      year: 2026,
      inflFactor: 1,
      anyAlive: true,
      balances: [{ account }, { account }],
      startOfYearBalance: new Map([['same-id', 100]]),
      requiredLifestyle: 20,
      targetLifestyle: 30,
      idealLifestyle: 10,
      excessLifestyle: 5,
      systemRequired: 10,
      discretionaryMultiplier: 1,
      startingWithdrawalRate: 0.1,
      startingRealPortfolio: null,
    }

    const result = annualGuardrailFundingPlan(input)

    // Positional fold is 200, so current rate is 60 / 200 = 0.3 and cuts.
    expect(result).toStrictEqual({
      discretionaryMultiplier: 0.75,
      startingWithdrawalRate: 0.1,
      startingRealPortfolio: null,
      guardrailAction: 'cut',
      targetLifestyleFunded: 22.5,
      idealLifestyleFunded: 0,
      excessLifestyleFunded: 0,
      cutting: true,
      canPullForwardGoals: false,
      remainingUpsideBudget: 0,
    })
  })

  it('initializes and consumes the real-balance anchor without mutating inputs', () => {
    const account = cashAccount('cash', 0)
    const result = annualGuardrailFundingPlan({
      guardrailsActive: true,
      riskBasedGuardrails: true,
      allowRaisesAboveTarget: undefined,
      guardrailPolicy: { mode: 'risk-based' },
      oneTimeGoals: [],
      isGoalResolved: () => false,
      year: 2026,
      inflFactor: 2,
      anyAlive: true,
      balances: [{ account }],
      startOfYearBalance: new Map([['cash', 200]]),
      requiredLifestyle: 0,
      targetLifestyle: 0,
      idealLifestyle: 0,
      excessLifestyle: 0,
      systemRequired: 0,
      discretionaryMultiplier: 1,
      startingWithdrawalRate: null,
      startingRealPortfolio: null,
    })

    expect(result.startingRealPortfolio).toBe(100)
    expect(result.guardrailAction).toBe('hold')
  })

  it('preserves positional floating-point association in the portfolio fold', () => {
    const accounts = [
      cashAccount('large', 0),
      cashAccount('small-1', 0),
      cashAccount('small-2', 0),
    ]
    const result = annualGuardrailFundingPlan({
      guardrailsActive: true,
      riskBasedGuardrails: false,
      allowRaisesAboveTarget: undefined,
      guardrailPolicy: { mode: 'withdrawal-rate' },
      oneTimeGoals: [],
      isGoalResolved: () => false,
      year: 2026,
      inflFactor: 1,
      anyAlive: true,
      balances: accounts.map((account) => ({ account })),
      startOfYearBalance: new Map([
        ['large', 1e16],
        ['small-1', 1],
        ['small-2', 2],
      ]),
      requiredLifestyle: 1,
      targetLifestyle: 0,
      idealLifestyle: 0,
      excessLifestyle: 0,
      systemRequired: 0,
      discretionaryMultiplier: 1,
      startingWithdrawalRate: null,
      startingRealPortfolio: null,
    })

    expect(result.startingWithdrawalRate).toBe(
      1 / 10_000_000_000_000_002,
    )
  })
})
