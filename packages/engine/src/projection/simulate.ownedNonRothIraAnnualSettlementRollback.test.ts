import { beforeEach, describe, expect, it, vi } from 'vitest'

const controller = vi.hoisted(() => ({
  reason: 'assumptionCycle' as
    | 'assumptionCycle'
    | 'attemptCallbackThrew',
  calls: vi.fn(),
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
      controller.calls()
      const transaction = beginSimulatorAnnualPassTransaction(input.state)
      try {
        input.runAttempt({
          attemptNumber: 1,
          stable: {
            planId: asPlanId(input.plan.id),
            projectionStartTaxYear: input.projectionStartTaxYear,
          },
          assumedEffects: [],
        })
        if (controller.reason === 'attemptCallbackThrew') {
          throw new Error('synthetic callback failure after annual mutation')
        }
      } catch {
        // The mocked controller reports the same fail-closed outcome as C.
      } finally {
        transaction.rollback()
      }
      return Object.freeze({
        status: 'rolledBack' as const,
        reason: controller.reason,
        attemptCount: 1,
        pendingSettlement: null,
        committedCarryforwards: null,
        issue: null,
      })
    },
  }
})

import type { Account } from '../model/plan.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './types.js'

const TAX_YEAR = 2026

function ira(): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount('ira', 100, 'p1', 'ira')
  if (account.type !== 'traditional') throw new Error('expected IRA')
  return {
    ...account,
    annualReturnPct: 0,
    nondeductibleBasis: 10,
  }
}

describe('simulator owned-IRA settlement rollback integration', () => {
  beforeEach(() => {
    controller.calls.mockClear()
  })

  it.each([
    'assumptionCycle',
    'attemptCallbackThrew',
  ] as const)('restores the attempt after %s and never reseeds', (
    reason,
  ) => {
    controller.reason = reason
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.id = 'settlement-rollback-plan'
    plan.accounts = [ira()]
    const optimizerProbes: OptimizerYearProbe[] = []

    const result = simulatePlan(validatePlan(plan), {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 1,
      taxCalculator: createFlatTaxCalculator(0),
      captureOptimizerInputs: (probe) => optimizerProbes.push(probe),
    })

    expect(controller.calls).toHaveBeenCalledTimes(1)
    expect(optimizerProbes).toHaveLength(2)
    expect(result.years.map((year) => year.balances.ira)).toEqual([100, 100])
    expect(JSON.stringify(result)).not.toMatch(
      /pendingOwnedNonRothIraAnnualSettlement|assumptionCycle|attemptCallbackThrew/,
    )
  })
})
