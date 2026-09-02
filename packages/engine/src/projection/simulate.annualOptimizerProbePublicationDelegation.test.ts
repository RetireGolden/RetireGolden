/** Hostile delegation proof for annual optimizer-probe publication. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualOptimizerProbeInput,
} from './internal/annualOptimizerProbePublication.js'
import type { OptimizerYearProbe } from './types.js'

interface ProbeCall {
  readonly input: AnnualOptimizerProbeInput
  readonly original: OptimizerYearProbe
  readonly output: OptimizerYearProbe
}

const INJECTED_ORDINARY_BASE = 12_345
const INJECTED_COMMITTED_MOVEMENT = Object.freeze([
  Object.freeze({ accountId: 'injected-action', amount: -98.76 }),
])
const INJECTED_STRATEGY_MOVEMENT = Object.freeze([
  Object.freeze({ accountId: 'injected-strategy', amount: 54.32 }),
])

const seam = vi.hoisted(() => ({
  inject: false,
  calls: [] as ProbeCall[],
}))

vi.mock('./internal/annualOptimizerProbePublication.js', async (importOriginal) => {
  const original = await importOriginal<
    typeof import('./internal/annualOptimizerProbePublication.js')
  >()
  return {
    ...original,
    annualOptimizerProbePublication: (input: AnnualOptimizerProbeInput) => {
      const production = original.annualOptimizerProbePublication(input)
      const output: OptimizerYearProbe = seam.inject
        ? {
            ...production,
            committedActionAccountMovement: INJECTED_COMMITTED_MOVEMENT,
            exogenousStrategyAccountMovement: INJECTED_STRATEGY_MOVEMENT,
            ordinaryIncomeBase: INJECTED_ORDINARY_BASE,
            incumbentTraditionalDistribution: 1,
            incumbentRothConversion: 1,
            traditionalWithdrawalTaxableFraction: 0.37,
            rothConversionTaxableFraction: 0.73,
          }
        : production
      seam.calls.push({ input, original: production, output })
      return output
    },
  }
})

import {
  setAcaYearContract,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const YEAR = 2026

function probePlan() {
  const plan = singlePersonPlan({
    dob: '1966-01-01',
    planningAge: 60,
  })
  plan.accounts = [traditionalAccount('traditional', 100_000)]
  setAcaYearContract(plan, {
    year: YEAR,
    monthlyEnrollment: 1_000,
    monthlySlcsp: 1_100,
  })
  return validatePlan(plan)
}

function run(inject: boolean) {
  seam.inject = inject
  const plan = probePlan()
  const probes: OptimizerYearProbe[] = []
  simulatePlan(plan, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: { compute: () => 0 },
    captureOptimizerInputs: (probe) => probes.push(probe),
  })
  return { plan, probes }
}

beforeEach(() => {
  seam.inject = false
  seam.calls.length = 0
})

describe('simulatePlan delegates annual optimizer-probe publication', () => {
  it('retains the optional capture gate outside the coordinator', () => {
    simulatePlan(probePlan(), {
      startYear: YEAR,
      horizonEndYear: YEAR,
      taxCalculator: { compute: () => 0 },
    })

    expect(seam.calls).toEqual([])
  })

  it('passes detached recursively frozen annual publication snapshots', () => {
    const { plan, probes } = run(false)

    expect(seam.calls).toHaveLength(1)
    expect(probes).toHaveLength(1)
    const call = seam.calls[0]!
    expect(Object.isFrozen(call.input)).toBe(true)
    expect(Object.isFrozen(call.input.traditionalAccounts)).toBe(true)
    expect(Object.isFrozen(call.input.traditionalAccounts[0])).toBe(true)
    expect(Object.isFrozen(call.input.runtimeOccurrences)).toBe(true)
    expect(Object.isFrozen(call.input.exogenousStrategyDebits)).toBe(true)
    expect(Object.isFrozen(call.input.yearAcaResult)).toBe(true)
    expect(call.input.traditionalAccounts[0]).toMatchObject({
      openingBalance: 100_000,
      inheritedOpeningBucket: false,
    })
    expect(call.input.traditionalAccounts[0]).not.toBe(plan.accounts[0])
    expect(call.output).toBe(call.original)
    expect(probes[0]).toMatchObject(call.original)
  })

  it('forwards hostile movement/scalar output to the final capture sink', () => {
    const { probes } = run(true)

    expect(seam.calls).toHaveLength(1)
    expect(probes).toHaveLength(1)
    const call = seam.calls[0]!
    expect(call.output).not.toBe(call.original)
    expect(probes[0]).toMatchObject({
      ordinaryIncomeBase: INJECTED_ORDINARY_BASE,
      traditionalWithdrawalTaxableFraction: 0.37,
      rothConversionTaxableFraction: 0.73,
    })
    expect(probes[0]?.committedActionAccountMovement).toBe(
      INJECTED_COMMITTED_MOVEMENT,
    )
    expect(probes[0]?.exogenousStrategyAccountMovement).toBe(
      INJECTED_STRATEGY_MOVEMENT,
    )
  })
})
