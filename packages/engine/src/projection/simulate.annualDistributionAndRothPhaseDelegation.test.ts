/** Delegation and live-result guards for the grouped annual execution phases. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Account, Plan } from '../model/plan.js'
import type {
  AnnualForcedDistributionQcdAndRetirementActionsPhaseInput,
  AnnualForcedDistributionQcdAndRetirementActionsPhaseResult,
} from './internal/annualForcedDistributionQcdAndRetirementActionsPhase.js'
import type {
  AnnualAggregateRothConversionPhaseInput,
  AnnualAggregateRothConversionPhaseResult,
} from './internal/annualAggregateRothConversionPhase.js'

interface ForcedCall {
  readonly input: AnnualForcedDistributionQcdAndRetirementActionsPhaseInput
  readonly natural: AnnualForcedDistributionQcdAndRetirementActionsPhaseResult
  readonly returned: AnnualForcedDistributionQcdAndRetirementActionsPhaseResult
  readonly downstreamIsAggregatedIraThisYear: ReturnType<typeof vi.fn>
}

interface AggregateCall {
  readonly input: AnnualAggregateRothConversionPhaseInput
  readonly natural: AnnualAggregateRothConversionPhaseResult
  readonly returned: AnnualAggregateRothConversionPhaseResult
  readonly downstreamYearConvertibleToRoth:
    AnnualAggregateRothConversionPhaseResult['yearConvertibleToRoth']
  readonly downstreamYearConvertibleCalls: Account[]
  readonly downstreamOwnedIraConversionTaxableFraction: ReturnType<typeof vi.fn>
}

const seam = vi.hoisted(() => ({
  forcedCalls: [] as ForcedCall[],
  aggregateCalls: [] as AggregateCall[],
}))

vi.mock(
  './internal/annualForcedDistributionQcdAndRetirementActionsPhase.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualForcedDistributionQcdAndRetirementActionsPhase.js')
    >()
    return {
      ...original,
      annualForcedDistributionQcdAndRetirementActionsPhase: (
        input: AnnualForcedDistributionQcdAndRetirementActionsPhaseInput,
      ): AnnualForcedDistributionQcdAndRetirementActionsPhaseResult => {
        const natural =
          original.annualForcedDistributionQcdAndRetirementActionsPhase(input)
        const downstreamIsAggregatedIraThisYear = vi.fn(
          natural.isAggregatedIraThisYear,
        )
        const returned = {
          ...natural,
          isAggregatedIraThisYear: downstreamIsAggregatedIraThisYear,
        }
        seam.forcedCalls.push({
          input,
          natural,
          returned,
          downstreamIsAggregatedIraThisYear,
        })
        return returned
      },
    }
  },
)

vi.mock(
  './internal/annualAggregateRothConversionPhase.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualAggregateRothConversionPhase.js')
    >()
    return {
      ...original,
      annualAggregateRothConversionPhase: (
        input: AnnualAggregateRothConversionPhaseInput,
      ): AnnualAggregateRothConversionPhaseResult => {
        const natural = original.annualAggregateRothConversionPhase(input)
        const downstreamYearConvertibleCalls: Account[] = []
        const downstreamYearConvertibleToRoth:
          AnnualAggregateRothConversionPhaseResult['yearConvertibleToRoth'] =
          (account): account is Extract<Account, { type: 'traditional' }> => {
            downstreamYearConvertibleCalls.push(account)
            return natural.yearConvertibleToRoth(account)
          }
        const downstreamOwnedIraConversionTaxableFraction = vi.fn(
          natural.ownedIraConversionTaxableFraction,
        )
        const returned = {
          ...natural,
          yearConvertibleToRoth: downstreamYearConvertibleToRoth,
          ownedIraConversionTaxableFraction:
            downstreamOwnedIraConversionTaxableFraction,
        }
        seam.aggregateCalls.push({
          input,
          natural,
          returned,
          downstreamYearConvertibleToRoth,
          downstreamYearConvertibleCalls,
          downstreamOwnedIraConversionTaxableFraction,
        })
        return returned
      },
    }
  },
)

import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { OptimizerYearProbe } from './types.js'

const YEAR = 2026

function rothAccount(): Account {
  return {
    type: 'roth',
    kind: 'ira',
    id: 'roth',
    name: 'roth',
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
  }
}

function plan(): Plan {
  const result = singlePersonPlan({
    dob: '1980-01-01',
    retirementAge: null,
    planningAge: 95,
  })
  result.assumptions.inflationPct = 0
  result.assumptions.defaultReturnPct = 0
  result.expenses.baseAnnual = 10_000
  result.accounts = [
    cashAccount('cash', 0),
    traditionalAccount('traditional', 100_000),
    rothAccount(),
  ]
  result.strategies.rothConversion = { mode: 'none' }
  return validatePlan(result)
}

beforeEach(() => {
  seam.forcedCalls.length = 0
  seam.aggregateCalls.length = 0
})

describe('simulatePlan delegates grouped annual execution phases', () => {
  it('passes the exact forced-phase result onward and consumes both live function channels', () => {
    const probes: OptimizerYearProbe[] = []
    const target = plan()

    simulatePlan(target, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureOptimizerInputs: (probe) => probes.push(probe),
    })

    expect(seam.forcedCalls).toHaveLength(1)
    expect(seam.aggregateCalls).toHaveLength(1)
    const forced = seam.forcedCalls[0]!
    const aggregate = seam.aggregateCalls[0]!

    expect(Object.isFrozen(forced.input)).toBe(true)
    expect(Object.isFrozen(forced.input.facts)).toBe(true)
    expect(forced.input.facts.plan).toBe(target)
    expect(aggregate.input.prior).toBe(forced.returned)
    expect(aggregate.input.prior.isAggregatedIraThisYear).toBe(
      forced.downstreamIsAggregatedIraThisYear,
    )
    expect(forced.downstreamIsAggregatedIraThisYear).toHaveBeenCalled()

    expect(Object.isFrozen(aggregate.input)).toBe(true)
    expect(Object.isFrozen(aggregate.input.facts)).toBe(true)
    expect(aggregate.input.facts.plan).toBe(target)
    expect(aggregate.returned.yearConvertibleToRoth).toBe(
      aggregate.downstreamYearConvertibleToRoth,
    )
    expect(aggregate.returned.ownedIraConversionTaxableFraction).toBe(
      aggregate.downstreamOwnedIraConversionTaxableFraction,
    )
    expect(aggregate.downstreamYearConvertibleCalls.length).toBeGreaterThan(0)
    expect(aggregate.downstreamOwnedIraConversionTaxableFraction)
      .toHaveBeenCalledWith('p1')
    expect(probes).toHaveLength(1)
  })
})
