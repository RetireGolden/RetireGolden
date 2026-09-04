/**
 * Hostile delegation proof for annual withdrawal strategy and drain planning.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. This module
 * carries two seams, so it wires one recorder per exported coordinator and
 * threads the second `through` around the first.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualWithdrawalPlanInput,
  AnnualWithdrawalPlanResult,
  AnnualWithdrawalStrategyInput,
  AnnualWithdrawalStrategyResult,
} from './internal/annualWithdrawalPlanning.js'

type Mode = 'production' | 'strategy' | 'plan'

const hostile = vi.hoisted(() => ({
  mode: 'production' as Mode,
  sentinelWarning: 'delegated annual withdrawal-planning warning',
}))

const strategySeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualWithdrawalStrategyInput,
      AnnualWithdrawalStrategyResult
    >(),
)

const planSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualWithdrawalPlanInput,
      AnnualWithdrawalPlanResult
    >(),
)

vi.mock('./internal/annualWithdrawalPlanning.js', async (importOriginal) =>
  planSeam.through(
    strategySeam.through(
      await importOriginal<
        typeof import('./internal/annualWithdrawalPlanning.js')
      >(),
      'annualWithdrawalStrategy',
      (natural): AnnualWithdrawalStrategyResult =>
        hostile.mode === 'strategy'
          ? {
              strategy: { mode: 'proportional' as const },
              warning: hostile.sentinelWarning,
            }
          : natural,
    ),
    'annualWithdrawalPlan',
    (natural, { input }): AnnualWithdrawalPlanResult =>
      hostile.mode === 'plan'
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
        : natural,
  ),
)

import { expectSeamRanAtLeastOnce } from './simulate.seamGuard.test-support.js'
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
  hostile.mode = mode
  strategySeam.reset()
  planSeam.reset()
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
  hostile.mode = 'production'
  strategySeam.reset()
  planSeam.reset()
})

describe('simulatePlan annual withdrawal-planning delegation', () => {
  it('passes immutable annual inputs and commits the delegated strategy', () => {
    const result = run('strategy')
    const strategyCall = strategySeam.calls.at(-1)
    if (strategyCall === undefined) throw new Error('strategy coordinator was not called')

    expect(Object.isFrozen(strategyCall.input)).toBe(true)
    expect(strategyCall.input.withdrawalOrder).toEqual({ mode: 'sequential' })
    expect(strategyCall.injected).not.toBe(strategyCall.natural)
    expect(expectSeamRanAtLeastOnce(planSeam).every((call) =>
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
    expect(result.warnings).toContain(hostile.sentinelWarning)
  })

  it('uses the delegated plan for accepted ledger debits and publication', () => {
    const result = run('plan')
    const finalPlan = planSeam.calls.at(-1)
    if (finalPlan === undefined) throw new Error('withdrawal planner was not called')

    expect(finalPlan.injected).not.toBe(finalPlan.natural)
    expect(finalPlan.injected.byAccountId.get('traditional')).toBe(200)
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
