/**
 * Delegation and live-result guards for the grouped funding and settlement
 * phases.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. Two modules
 * are mocked, so there is one recorder each. The settlement recorder is what
 * motivated the helper's `wrapInput` option: this guard's proof is that the
 * settlement phase really calls the funding callback it was handed, and the
 * only way to watch that fire is to substitute a wrapped
 * `callbacks.runPostContributionAnnualPass` into the argument the real phase
 * receives. The recorded `input` stays the simulator's own frozen object, so
 * the frozen and identity assertions below still mean what they say.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { Plan } from '../model/plan.js'
import type {
  AnnualFundingApplicationAndClosePhaseInput,
  AnnualFundingApplicationAndClosePhaseResult,
} from './internal/annualFundingApplicationAndClosePhase.js'
import type {
  AnnualOwnedNonRothIraSettlementPhaseInput,
  AnnualOwnedNonRothIraSettlementPhaseResult,
} from './internal/annualOwnedNonRothIraSettlementPhase.js'

const settlementSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualOwnedNonRothIraSettlementPhaseInput,
      AnnualOwnedNonRothIraSettlementPhaseResult,
      AnnualFundingApplicationAndClosePhaseResult[]
    >(),
)

const fundingSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualFundingApplicationAndClosePhaseInput,
      AnnualFundingApplicationAndClosePhaseResult
    >(),
)

vi.mock(
  './internal/annualFundingApplicationAndClosePhase.js',
  async (importOriginal) =>
    fundingSeam.through(
      await importOriginal<
        typeof import('./internal/annualFundingApplicationAndClosePhase.js')
      >(),
      'annualFundingApplicationAndClosePhase',
      (natural): AnnualFundingApplicationAndClosePhaseResult => ({
        yearResult: Object.freeze({ ...natural.yearResult }),
        optimizerProbe: natural.optimizerProbe === null
          ? null
          : Object.freeze({ ...natural.optimizerProbe }),
      }),
    ),
)

vi.mock(
  './internal/annualOwnedNonRothIraSettlementPhase.js',
  async (importOriginal) =>
    settlementSeam.through(
      await importOriginal<
        typeof import('./internal/annualOwnedNonRothIraSettlementPhase.js')
      >(),
      'annualOwnedNonRothIraSettlementPhase',
      (natural): AnnualOwnedNonRothIraSettlementPhaseResult => ({
        yearResult: Object.freeze({ ...natural.yearResult }),
        optimizerProbe: natural.optimizerProbe === null
          ? null
          : Object.freeze({ ...natural.optimizerProbe }),
      }),
      {
        capture: () => [] as AnnualFundingApplicationAndClosePhaseResult[],
        wrapInput: (input, callbackResults) => Object.freeze({
          ...input,
          callbacks: Object.freeze({
            ...input.callbacks,
            runPostContributionAnnualPass: (
              ...args: Parameters<
                AnnualOwnedNonRothIraSettlementPhaseInput['callbacks']['runPostContributionAnnualPass']
              >
            ) => {
              const result = input.callbacks.runPostContributionAnnualPass(...args)
              callbackResults.push(result)
              return result
            },
          }),
        }),
      },
    ),
)

import {
  expectPublishedFromSeam,
  expectSeamRan,
  expectSeamRanAtLeastOnce,
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
  ]
  result.strategies.rothConversion = { mode: 'none' }
  return validatePlan(result)
}

beforeEach(() => {
  fundingSeam.reset()
  settlementSeam.reset()
})

describe('simulatePlan delegates grouped funding and settlement phases', () => {
  it('feeds settlement from the live funding callback and publishes the exact settlement result', () => {
    const probes: OptimizerYearProbe[] = []
    const target = plan()

    const projection = simulatePlan(target, {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
      captureOptimizerInputs: (probe) => probes.push(probe),
    })

    const fundingCalls = expectSeamRanAtLeastOnce(fundingSeam)
    const settlement = expectSeamRan(settlementSeam, 1)[0]!

    expect(Object.isFrozen(settlement.input)).toBe(true)
    expect(Object.isFrozen(settlement.input.facts)).toBe(true)
    expect(Object.isFrozen(settlement.input.callbacks)).toBe(true)
    expect(settlement.input.facts.plan).toBe(target)
    expect(settlement.captured.length).toBeGreaterThan(0)
    expect(settlement.captured.every((result) =>
      fundingCalls.some((call) => call.injected === result))).toBe(true)

    for (const funding of fundingCalls) {
      expect(Object.isFrozen(funding.input)).toBe(true)
      expect(Object.isFrozen(funding.input.facts)).toBe(true)
      expect(funding.input.facts.plan).toBe(target)
    }

    expectPublishedFromSeam(
      projection.years[0],
      settlement.injected.yearResult,
      'the published year result',
    )
    expect(settlement.injected.optimizerProbe).not.toBeNull()
    expect(probes).toEqual([settlement.injected.optimizerProbe])
  })

  it("hands the funding phase the simulator's own scalar cells, not copies", () => {
    simulatePlan(plan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    const settlement = expectSeamRan(settlementSeam, 1)[0]!
    const funding = expectSeamRanAtLeastOnce(fundingSeam)[0]!

    // The ten money-bearing scalars the funding-and-close phase writes are the
    // very bindings the annual-pass transaction rolls back, so a phase write
    // lands on `simulatePlan`'s own local. The old seam copied numbers out of a
    // plain ledger object by hand, and a forgotten line would have been silent.
    const keys = Object.keys(funding.input.ledger.scalars) as
      (keyof typeof funding.input.ledger.scalars)[]
    expect(keys).toHaveLength(10)
    for (const key of keys) {
      expect(funding.input.ledger.scalars[key]).toBe(settlement.input.state[key])
    }

    // The settlement phase's single latch is bound the same way.
    expect(
      typeof settlement.input.ledger.scalars
        .ownedNonRothIraSettlementRolledBackHousehold.write,
    ).toBe('function')
  })
})
