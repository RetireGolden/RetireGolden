/**
 * Delegation and live-result guards for the grouped annual execution phases.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. Two modules
 * are mocked, so there is one recorder each. Both seams replace *functions the
 * result carries* rather than plain values, so the injector builds those
 * wrappers and parks them on `hostile` by call ordinal. That keeps the
 * identity assertions non-vacuous — each one compares what the recorder saw
 * the caller receive against the wrapper this file built — without widening
 * `SeamCall`, which models the result and not the instrumentation hung off it.
 */
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

const hostile = vi.hoisted(() => ({
  isAggregatedIraThisYear: [] as ReturnType<typeof vi.fn>[],
  yearConvertibleToRoth: [] as
    AnnualAggregateRothConversionPhaseResult['yearConvertibleToRoth'][],
  yearConvertibleCalls: [] as Account[][],
  ownedIraConversionTaxableFraction: [] as ReturnType<typeof vi.fn>[],
}))

const forcedSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualForcedDistributionQcdAndRetirementActionsPhaseInput,
      AnnualForcedDistributionQcdAndRetirementActionsPhaseResult
    >(),
)

const aggregateSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualAggregateRothConversionPhaseInput,
      AnnualAggregateRothConversionPhaseResult
    >(),
)

vi.mock(
  './internal/annualForcedDistributionQcdAndRetirementActionsPhase.js',
  async (importOriginal) =>
    forcedSeam.through(
      await importOriginal<
        typeof import('./internal/annualForcedDistributionQcdAndRetirementActionsPhase.js')
      >(),
      'annualForcedDistributionQcdAndRetirementActionsPhase',
      (
        natural,
        { ordinal },
      ): AnnualForcedDistributionQcdAndRetirementActionsPhaseResult => {
        const isAggregatedIraThisYear = vi.fn(natural.isAggregatedIraThisYear)
        hostile.isAggregatedIraThisYear[ordinal] = isAggregatedIraThisYear
        return { ...natural, isAggregatedIraThisYear }
      },
    ),
)

vi.mock(
  './internal/annualAggregateRothConversionPhase.js',
  async (importOriginal) =>
    aggregateSeam.through(
      await importOriginal<
        typeof import('./internal/annualAggregateRothConversionPhase.js')
      >(),
      'annualAggregateRothConversionPhase',
      (natural, { ordinal }): AnnualAggregateRothConversionPhaseResult => {
        const yearConvertibleCalls: Account[] = []
        hostile.yearConvertibleCalls[ordinal] = yearConvertibleCalls
        const yearConvertibleToRoth:
          AnnualAggregateRothConversionPhaseResult['yearConvertibleToRoth'] =
          (account): account is Extract<Account, { type: 'traditional' }> => {
            yearConvertibleCalls.push(account)
            return natural.yearConvertibleToRoth(account)
          }
        hostile.yearConvertibleToRoth[ordinal] = yearConvertibleToRoth
        const ownedIraConversionTaxableFraction = vi.fn(
          natural.ownedIraConversionTaxableFraction,
        )
        hostile.ownedIraConversionTaxableFraction[ordinal] =
          ownedIraConversionTaxableFraction
        return {
          ...natural,
          yearConvertibleToRoth,
          ownedIraConversionTaxableFraction,
        }
      },
    ),
)

import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
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
  forcedSeam.reset()
  aggregateSeam.reset()
  hostile.isAggregatedIraThisYear.length = 0
  hostile.yearConvertibleToRoth.length = 0
  hostile.yearConvertibleCalls.length = 0
  hostile.ownedIraConversionTaxableFraction.length = 0
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

    const forced = expectSeamRan(forcedSeam, 1)[0]!
    const aggregate = expectSeamRan(aggregateSeam, 1)[0]!

    expect(Object.isFrozen(forced.input)).toBe(true)
    expect(Object.isFrozen(forced.input.facts)).toBe(true)
    expect(forced.input.facts.plan).toBe(target)
    expectPublishedFromSeam(
      aggregate.input.prior,
      forced.injected,
      "the aggregate phase's prior result",
    )
    expect(aggregate.input.prior.isAggregatedIraThisYear).toBe(
      hostile.isAggregatedIraThisYear[0],
    )
    expect(hostile.isAggregatedIraThisYear[0]).toHaveBeenCalled()

    expect(Object.isFrozen(aggregate.input)).toBe(true)
    expect(Object.isFrozen(aggregate.input.facts)).toBe(true)
    expect(aggregate.input.facts.plan).toBe(target)
    expect(aggregate.injected.yearConvertibleToRoth).toBe(
      hostile.yearConvertibleToRoth[0],
    )
    expect(aggregate.injected.ownedIraConversionTaxableFraction).toBe(
      hostile.ownedIraConversionTaxableFraction[0],
    )
    expect(hostile.yearConvertibleCalls[0]!.length).toBeGreaterThan(0)
    expect(hostile.ownedIraConversionTaxableFraction[0])
      .toHaveBeenCalledWith('p1')
    expect(probes).toHaveLength(1)
  })
})
