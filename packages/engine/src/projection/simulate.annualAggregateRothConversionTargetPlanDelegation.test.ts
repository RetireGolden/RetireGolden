/**
 * Hostile delegation guard for aggregate Roth-conversion target planning.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualAggregateRothConversionTargetPlanInput,
  AnnualAggregateRothConversionTargetPlanResult,
} from './internal/annualAggregateRothConversionTargetPlan.js'

type Mode = 'original' | 'economic' | 'acaGetter' | 'taxableFunction'

interface TargetCapture {
  readonly sources: ReturnType<
    AnnualAggregateRothConversionTargetPlanInput['readSources']
  >
  readonly liquid: readonly number[]
}

const SENTINEL_DESIRED = 1_234.56
const SENTINEL_WARNING = 'delegated aggregate conversion target warning'
const hostile = vi.hoisted(() => ({
  mode: 'original' as Mode,
  acaReads: 0,
  taxableCalls: [] as number[],
}))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualAggregateRothConversionTargetPlanInput,
      AnnualAggregateRothConversionTargetPlanResult,
      TargetCapture
    >(),
)

vi.mock(
  './internal/annualAggregateRothConversionTargetPlan.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualAggregateRothConversionTargetPlan.js')
      >(),
      'annualAggregateRothConversionTargetPlan',
      (natural): AnnualAggregateRothConversionTargetPlanResult => {
        if (hostile.mode === 'economic') {
          return {
            ...natural,
            desiredPlanDollars: SENTINEL_DESIRED,
            warnings: [SENTINEL_WARNING],
            fillToTargetSelected: true,
          }
        }
        if (hostile.mode === 'acaGetter') {
          return {
            ...natural,
            get acaSizingInput() {
              hostile.acaReads += 1
              return natural.acaSizingInput
            },
          }
        }
        if (hostile.mode === 'taxableFunction') {
          return {
            ...natural,
            taxableAmountForGross: (grossPlanDollars) => {
              hostile.taxableCalls.push(grossPlanDollars)
              return grossPlanDollars / 4
            },
          }
        }
        return natural
      },
      {
        capture: (input) => ({
          sources: input.readSources(),
          liquid: input.safetyNet.readSpendableLiquidBalances(),
        }),
      },
    ),
)

import { expectSeamRanAtLeastOnce } from './simulate.seamGuard.test-support.js'
import type { Account, Plan } from '../model/plan.js'
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
const noTax = createFlatTaxCalculator(0)

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
  const traditional = traditionalAccount('traditional', 100_000)
  traditional.annualReturnPct = 0
  result.accounts = [cashAccount('cash', 0), traditional, rothAccount()]
  result.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: YEAR, amount: 5_000 }],
  }
  return validatePlan(result)
}

function run(
  mode: Mode,
  target = plan(),
  captureOptimizerInputs?: (probe: OptimizerYearProbe) => void,
) {
  hostile.mode = mode
  seam.reset()
  hostile.acaReads = 0
  hostile.taxableCalls.length = 0
  return simulatePlan(target, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: noTax,
    captureOptimizerInputs,
  })
}

beforeEach(() => {
  hostile.mode = 'original'
  seam.reset()
  hostile.acaReads = 0
  hostile.taxableCalls.length = 0
})

describe('simulatePlan delegates aggregate Roth-conversion target planning', () => {
  it('passes frozen annual snapshots and commits the delegated target, warnings, and fill-target signal', () => {
    const result = run('economic')
    const event = expectSeamRanAtLeastOnce(seam).at(-1)!

    expect(Object.isFrozen(event.input)).toBe(true)
    expect(Object.isFrozen(event.input.sizing)).toBe(true)
    expect(Object.isFrozen(event.input.sizing.aca)).toBe(true)
    expect(Object.isFrozen(event.input.safetyNet)).toBe(true)
    expect(event.input.strategy).toEqual({
      mode: 'manual',
      conversions: [{ year: YEAR, amount: 5_000 }],
    })
    expect(event.input.namedConversionActionCount).toBe(0)
    expect(event.captured.sources).toEqual([
      { balancePlanDollars: 0, convertible: false, taxableFraction: 1 },
      { balancePlanDollars: 100_000, convertible: true, taxableFraction: 1 },
      { balancePlanDollars: 0, convertible: false, taxableFraction: 1 },
    ])
    expect(event.captured.liquid).toEqual([0])
    expect(result.years[0]!.aggregateRothConversionAllocationDesired)
      .toBe(SENTINEL_DESIRED)
    expect(result.years[0]!.rothConversion).toBe(SENTINEL_DESIRED)
    expect(result.warnings).toContain(SENTINEL_WARNING)
    expect(result.warnings).toContain(
      'Spending withdrawals from traditional accounts pushed income above the Roth-conversion target in some years.',
    )
  })

  it('reads the delegated ACA sizing envelope for bracket-targeted withdrawals', () => {
    const target = plan()
    target.strategies.rothConversion = { mode: 'none' }
    target.strategies.withdrawalOrder = {
      mode: 'bracketTargeted',
      bracketPct: 22,
    }

    run('acaGetter', validatePlan(target))

    expect(hostile.acaReads).toBeGreaterThan(0)
  })

  it('uses the delegated then-current taxable-gross translator in optimizer probes', () => {
    const target = plan()
    target.expenses.baseAnnual = 0
    target.strategies.rothConversion = { mode: 'none' }
    const probes: OptimizerYearProbe[] = []

    run('taxableFunction', validatePlan(target), (probe) => probes.push(probe))

    expect(hostile.taxableCalls.length).toBeGreaterThan(0)
    expect(hostile.taxableCalls.at(-1)).toBeGreaterThan(0)
    expect(probes[0]!.rothConversionTaxableFraction).toBe(0.25)
  })
})
