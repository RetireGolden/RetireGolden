/** Hostile delegation guard for aggregate Roth-conversion target planning. */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualAggregateRothConversionTargetPlanInput,
  AnnualAggregateRothConversionTargetPlanResult,
} from './internal/annualAggregateRothConversionTargetPlan.js'

type Mode = 'original' | 'economic' | 'acaGetter' | 'taxableFunction'

interface TargetEvent {
  readonly input: AnnualAggregateRothConversionTargetPlanInput
  readonly original: AnnualAggregateRothConversionTargetPlanResult
  readonly output: AnnualAggregateRothConversionTargetPlanResult
  readonly sourcesAtCall: ReturnType<
    AnnualAggregateRothConversionTargetPlanInput['readSources']
  >
  readonly liquidAtCall: readonly number[]
}

const SENTINEL_DESIRED = 1_234.56
const SENTINEL_WARNING = 'delegated aggregate conversion target warning'
const seam = vi.hoisted(() => ({
  mode: 'original' as Mode,
  events: [] as TargetEvent[],
  acaReads: 0,
  taxableCalls: [] as number[],
}))

vi.mock('./internal/annualAggregateRothConversionTargetPlan.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('./internal/annualAggregateRothConversionTargetPlan.js')
  >()
  return {
    ...original,
    annualAggregateRothConversionTargetPlan: (
      input: Parameters<
        typeof original.annualAggregateRothConversionTargetPlan
      >[0],
    ): ReturnType<
      typeof original.annualAggregateRothConversionTargetPlan
    > => {
      const production = original.annualAggregateRothConversionTargetPlan(input)
      let output: AnnualAggregateRothConversionTargetPlanResult = production
      if (seam.mode === 'economic') {
        output = {
          ...production,
          desiredPlanDollars: SENTINEL_DESIRED,
          warnings: [SENTINEL_WARNING],
          fillToTargetSelected: true,
        }
      } else if (seam.mode === 'acaGetter') {
        output = {
          ...production,
          get acaSizingInput() {
            seam.acaReads += 1
            return production.acaSizingInput
          },
        }
      } else if (seam.mode === 'taxableFunction') {
        output = {
          ...production,
          taxableAmountForGross: (grossPlanDollars) => {
            seam.taxableCalls.push(grossPlanDollars)
            return grossPlanDollars / 4
          },
        }
      }
      seam.events.push({
        input,
        original: production,
        output,
        sourcesAtCall: input.readSources(),
        liquidAtCall: input.safetyNet.readSpendableLiquidBalances(),
      })
      return output
    },
  }
})

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
  seam.mode = mode
  seam.events.length = 0
  seam.acaReads = 0
  seam.taxableCalls.length = 0
  const result = simulatePlan(target, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: noTax,
    captureOptimizerInputs,
  })
  return { result, events: [...seam.events] }
}

beforeEach(() => {
  seam.mode = 'original'
  seam.events.length = 0
  seam.acaReads = 0
  seam.taxableCalls.length = 0
})

describe('simulatePlan delegates aggregate Roth-conversion target planning', () => {
  it('passes frozen annual snapshots and commits the delegated target, warnings, and fill-target signal', () => {
    const { result, events } = run('economic')
    const event = events.at(-1)
    if (event === undefined) throw new Error('target coordinator was not called')

    expect(Object.isFrozen(event.input)).toBe(true)
    expect(Object.isFrozen(event.input.sizing)).toBe(true)
    expect(Object.isFrozen(event.input.sizing.aca)).toBe(true)
    expect(Object.isFrozen(event.input.safetyNet)).toBe(true)
    expect(event.input.strategy).toEqual({
      mode: 'manual',
      conversions: [{ year: YEAR, amount: 5_000 }],
    })
    expect(event.input.namedConversionActionCount).toBe(0)
    expect(event.sourcesAtCall).toEqual([
      { balancePlanDollars: 0, convertible: false, taxableFraction: 1 },
      { balancePlanDollars: 100_000, convertible: true, taxableFraction: 1 },
      { balancePlanDollars: 0, convertible: false, taxableFraction: 1 },
    ])
    expect(event.liquidAtCall).toEqual([0])
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

    expect(seam.acaReads).toBeGreaterThan(0)
  })

  it('uses the delegated then-current taxable-gross translator in optimizer probes', () => {
    const target = plan()
    target.expenses.baseAnnual = 0
    target.strategies.rothConversion = { mode: 'none' }
    const probes: OptimizerYearProbe[] = []

    run('taxableFunction', validatePlan(target), (probe) => probes.push(probe))

    expect(seam.taxableCalls.length).toBeGreaterThan(0)
    expect(seam.taxableCalls.at(-1)).toBeGreaterThan(0)
    expect(probes[0]!.rothConversionTaxableFraction).toBe(0.25)
  })
})
