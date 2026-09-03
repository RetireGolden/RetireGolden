/** Delegation and live-result guards for the grouped funding and settlement phases. */
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

interface FundingCall {
  readonly input: AnnualFundingApplicationAndClosePhaseInput
  readonly natural: AnnualFundingApplicationAndClosePhaseResult
  readonly returned: AnnualFundingApplicationAndClosePhaseResult
}

interface SettlementCall {
  readonly input: AnnualOwnedNonRothIraSettlementPhaseInput
  readonly callbackResults: AnnualFundingApplicationAndClosePhaseResult[]
  readonly natural: AnnualOwnedNonRothIraSettlementPhaseResult
  readonly returned: AnnualOwnedNonRothIraSettlementPhaseResult
}

const seam = vi.hoisted(() => ({
  fundingCalls: [] as FundingCall[],
  settlementCalls: [] as SettlementCall[],
}))

vi.mock(
  './internal/annualFundingApplicationAndClosePhase.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualFundingApplicationAndClosePhase.js')
    >()
    return {
      ...original,
      annualFundingApplicationAndClosePhase: (
        input: AnnualFundingApplicationAndClosePhaseInput,
      ): AnnualFundingApplicationAndClosePhaseResult => {
        const natural = original.annualFundingApplicationAndClosePhase(input)
        const returned = {
          yearResult: Object.freeze({ ...natural.yearResult }),
          optimizerProbe: natural.optimizerProbe === null
            ? null
            : Object.freeze({ ...natural.optimizerProbe }),
        }
        seam.fundingCalls.push({ input, natural, returned })
        return returned
      },
    }
  },
)

vi.mock(
  './internal/annualOwnedNonRothIraSettlementPhase.js',
  async (importOriginal) => {
    const original = await importOriginal<
      typeof import('./internal/annualOwnedNonRothIraSettlementPhase.js')
    >()
    return {
      ...original,
      annualOwnedNonRothIraSettlementPhase: (
        input: AnnualOwnedNonRothIraSettlementPhaseInput,
      ): AnnualOwnedNonRothIraSettlementPhaseResult => {
        const callbackResults: AnnualFundingApplicationAndClosePhaseResult[] = []
        const natural = original.annualOwnedNonRothIraSettlementPhase(
          Object.freeze({
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
        )
        const returned = {
          yearResult: Object.freeze({ ...natural.yearResult }),
          optimizerProbe: natural.optimizerProbe === null
            ? null
            : Object.freeze({ ...natural.optimizerProbe }),
        }
        seam.settlementCalls.push({ input, callbackResults, natural, returned })
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
  seam.fundingCalls.length = 0
  seam.settlementCalls.length = 0
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

    expect(seam.settlementCalls).toHaveLength(1)
    expect(seam.fundingCalls.length).toBeGreaterThan(0)
    const settlement = seam.settlementCalls[0]!

    expect(Object.isFrozen(settlement.input)).toBe(true)
    expect(Object.isFrozen(settlement.input.facts)).toBe(true)
    expect(Object.isFrozen(settlement.input.callbacks)).toBe(true)
    expect(settlement.input.facts.plan).toBe(target)
    expect(settlement.callbackResults.length).toBeGreaterThan(0)
    expect(settlement.callbackResults.every((result) =>
      seam.fundingCalls.some((call) => call.returned === result))).toBe(true)

    for (const funding of seam.fundingCalls) {
      expect(Object.isFrozen(funding.input)).toBe(true)
      expect(Object.isFrozen(funding.input.facts)).toBe(true)
      expect(funding.input.facts.plan).toBe(target)
    }

    expect(projection.years[0]).toBe(settlement.returned.yearResult)
    expect(settlement.returned.optimizerProbe).not.toBeNull()
    expect(probes).toEqual([settlement.returned.optimizerProbe])
  })

  it("hands the funding phase the simulator's own scalar cells, not copies", () => {
    simulatePlan(plan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    const settlement = seam.settlementCalls[0]!
    const funding = seam.fundingCalls[0]!

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
