/** Hostile delegation proof for annual withdrawal strategy and drain planning. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualWithdrawalPlanInput,
  AnnualWithdrawalPlanResult,
  AnnualWithdrawalStrategyInput,
  AnnualWithdrawalStrategyResult,
} from './internal/annualWithdrawalPlanning.js'

type Mode = 'production' | 'strategy' | 'plan'

interface StrategyCall {
  readonly input: AnnualWithdrawalStrategyInput
  readonly production: AnnualWithdrawalStrategyResult
  readonly output: AnnualWithdrawalStrategyResult
}

interface PlanCall {
  readonly input: AnnualWithdrawalPlanInput
  readonly production: AnnualWithdrawalPlanResult
  readonly output: AnnualWithdrawalPlanResult
}

const seam = vi.hoisted(() => ({
  mode: 'production' as Mode,
  strategyCalls: [] as StrategyCall[],
  planCalls: [] as PlanCall[],
  sentinelWarning: 'delegated annual withdrawal-planning warning',
}))

vi.mock('./internal/annualWithdrawalPlanning.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualWithdrawalPlanning.js')
  >()
  return {
    ...original,
    annualWithdrawalStrategy: (
      input: AnnualWithdrawalStrategyInput,
    ): AnnualWithdrawalStrategyResult => {
      const production = original.annualWithdrawalStrategy(input)
      const output = seam.mode === 'strategy'
        ? {
            strategy: { mode: 'proportional' as const },
            warning: seam.sentinelWarning,
          }
        : production
      seam.strategyCalls.push({ input, production, output })
      return output
    },
    annualWithdrawalPlan: (
      input: AnnualWithdrawalPlanInput,
    ): AnnualWithdrawalPlanResult => {
      const production = original.annualWithdrawalPlan(input)
      const output = seam.mode === 'plan'
        ? {
            byCategory: {
              cash: 0,
              taxable: 0,
              traditional: input.needPlanDollars,
              roth: 0,
              hsa: 0,
              total: input.needPlanDollars,
            },
            byAccountId: new Map([
              ['traditional', input.needPlanDollars],
            ]),
            realizedGains: 0,
            taxableSales: new Map(),
            shortfall: 0,
            reserveUsed: 0,
          }
        : production
      seam.planCalls.push({ input, production, output })
      return output
    },
  }
})

import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function run(mode: Mode) {
  seam.mode = mode
  seam.strategyCalls.length = 0
  seam.planCalls.length = 0
  const plan = singlePersonPlan({
    dob: '1964-01-01',
    planningAge: 62,
    retirementAge: null,
  })
  plan.accounts = [
    cashAccount('cash', 100),
    traditionalAccount('traditional', 300),
  ]
  plan.expenses.baseAnnual = 200
  return simulatePlan(validatePlan(plan), {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: noTax,
  })
}

beforeEach(() => {
  seam.mode = 'production'
  seam.strategyCalls.length = 0
  seam.planCalls.length = 0
})

describe('simulatePlan annual withdrawal-planning delegation', () => {
  it('passes immutable annual inputs and commits the delegated strategy', () => {
    const result = run('strategy')
    const strategyCall = seam.strategyCalls.at(-1)
    if (strategyCall === undefined) throw new Error('strategy coordinator was not called')

    expect(Object.isFrozen(strategyCall.input)).toBe(true)
    expect(strategyCall.input.withdrawalOrder).toEqual({ mode: 'sequential' })
    expect(strategyCall.output).not.toBe(strategyCall.production)
    expect(seam.planCalls.length).toBeGreaterThan(0)
    expect(seam.planCalls.every((call) =>
      Object.isFrozen(call.input) &&
      Object.isFrozen(call.input.states) &&
      call.input.strategy.mode === 'proportional'
    )).toBe(true)
    expect(result.years[0]!.withdrawals).toMatchObject({
      cash: 50,
      traditional: 150,
      total: 200,
    })
    expect(result.years[0]!.balances).toMatchObject({
      cash: 50,
      traditional: 150,
    })
    expect(result.warnings).toContain(seam.sentinelWarning)
  })

  it('uses the delegated plan for accepted ledger debits and publication', () => {
    const result = run('plan')
    const finalPlan = seam.planCalls.at(-1)
    if (finalPlan === undefined) throw new Error('withdrawal planner was not called')

    expect(finalPlan.output).not.toBe(finalPlan.production)
    expect(finalPlan.output.byAccountId.get('traditional')).toBe(200)
    expect(result.years[0]!.withdrawals).toMatchObject({
      cash: 0,
      traditional: 200,
      total: 200,
    })
    expect(result.years[0]!.balances).toMatchObject({
      cash: 100,
      traditional: 100,
    })
  })
})
