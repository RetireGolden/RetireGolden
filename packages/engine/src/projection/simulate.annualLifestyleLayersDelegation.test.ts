/**
 * Seam guard for the recurring lifestyle extraction. Pure-helper tests cannot
 * detect an orphaned helper beside a re-inlined caller, so this mock returns a
 * deliberately different four-layer result and requires every published
 * expense channel to move with it.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualLifestyleLayersInput,
} from './internal/annualLifestyleLayers.js'
import type { AnnualSpendingLayers } from '../spending/layers.js'

interface Phase {
  readonly input: AnnualLifestyleLayersInput
  readonly natural: AnnualSpendingLayers
  readonly injected: AnnualSpendingLayers
}

const seam = vi.hoisted(() => ({ phases: [] as Phase[] }))

vi.mock('./internal/annualLifestyleLayers.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualLifestyleLayers.js')>()
  return {
    ...original,
    annualLifestyleLayers: (input: AnnualLifestyleLayersInput) => {
      const natural = original.annualLifestyleLayers(input)
      const yearOrdinal = input.year - 2026
      const abwOffset = input.abwActive ? 1 : 0
      const injected: AnnualSpendingLayers = {
        requiredLifestyle: 11 + abwOffset * 9 + yearOrdinal,
        discretionaryLifestyle: 7 + abwOffset * 13 + yearOrdinal * 2,
        targetLifestyle: 7 + abwOffset * 13 + yearOrdinal * 2,
        idealLifestyle: 5 + abwOffset * 10 + yearOrdinal * 3,
        excessLifestyle: 3 + abwOffset * 7 + yearOrdinal * 4,
      }
      seam.phases.push({ input, natural, injected })
      return injected
    },
  }
})

import type { Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  couplePlan,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2028

function fixedPlan(): Plan {
  const plan = couplePlan({
    p1Dob: '1966-01-01',
    p2Dob: '1965-01-01',
    p1PlanningAge: 90,
    p2PlanningAge: 60,
  })
  plan.expenses.baseAnnual = 100
  plan.expenses.requiredAnnual = 70
  plan.expenses.idealAnnual = 20
  plan.expenses.excessAnnual = 10
  plan.expenses.survivorSpendingPct = 40
  plan.expenses.phases = [
    { fromAge: 70, multiplier: 2 },
    { fromAge: 60, multiplier: 1.25 },
    { fromAge: 60, multiplier: 1.5 },
    { fromAge: 40, multiplier: 0.5 },
  ]
  return validatePlan(plan)
}

function abwPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 90 })
  plan.expenses.baseAnnual = 999
  plan.expenses.requiredAnnual = 888
  plan.expenses.idealAnnual = 777
  plan.expenses.excessAnnual = 666
  plan.expenses.phases = [{ fromAge: 40, multiplier: 3 }]
  plan.expenses.spendingPolicy = {
    mode: 'abw',
    abw: {
      returnSource: 'fixed',
      fixedRealReturnPct: 4,
      tiltPct: 1,
      horizon: 'planningAge',
    },
  }
  plan.accounts = [cashAccount('duplicate', 100), cashAccount('duplicate', 200)]
  return validatePlan(plan)
}

function run(plan: Plan, horizonEndYear = START_YEAR) {
  seam.phases.length = 0
  const result = simulatePlan(plan, {
    startYear: START_YEAR,
    horizonEndYear,
    taxCalculator: createFlatTaxCalculator(0),
  })
  return { result, phases: [...seam.phases] }
}

describe('simulatePlan delegates recurring lifestyle layers', () => {
  it('passes the live fixed-plan inputs and consumes every returned layer', () => {
    const plan = fixedPlan()
    const { result, phases } = run(plan)

    expect(phases.length).toBeGreaterThan(0)
    for (const phase of phases) {
      expect(phase.input.expenses).toBe(plan.expenses)
      expect(phase.input.primaryAge).toBe(60)
      expect(phase.input.peopleStateCount).toBe(2)
      expect(phase.input.aliveCount).toBe(1)
      expect(phase.input.anyAlive).toBe(true)
      expect(phase.input.inflFactor).toBe(1)
      expect(phase.input.abwActive).toBe(false)
      expect(phase.input.balances).toEqual([])
      expect([...phase.input.startOfYearBalance]).toEqual([])
      expect(phase.natural).toEqual({
        requiredLifestyle: 42.00000000000001,
        discretionaryLifestyle: 18,
        targetLifestyle: 18,
        idealLifestyle: 12.000000000000002,
        excessLifestyle: 6.000000000000001,
      })
    }

    const year = result.years[0]!
    expect(year.expenses.baseSpending).toBe(26)
    expect(year.expenses.requiredSpending).toBe(11)
    expect(year.expenses.targetSpending).toBe(18)
    expect(year.expenses.idealSpending).toBe(5)
    expect(year.expenses.excessSpending).toBe(3)
    expect(year.expenses.intendedSpending).toBe(26)
    expect(year.expenses.total).toBe(26)
  })

  it('passes ABW setup and duplicate-id opening balances through the seam', () => {
    const plan = abwPlan()
    const { result, phases } = run(plan, END_YEAR)

    expect(phases.length).toBeGreaterThan(0)
    expect(new Set(phases.map((phase) => phase.injected)).size).toBe(phases.length)
    for (const phase of phases) {
      expect(phase.input.expenses).toBe(plan.expenses)
      expect(phase.input.abwActive).toBe(true)
      expect(phase.input.abwRealReturnPct).toBe(4)
      expect(phase.input.abwTiltPct).toBe(1)
      expect(phase.input.abwHorizonYear).toBe(END_YEAR)
      expect(phase.input.balances.map((balance) => balance.account.id)).toEqual([
        'duplicate',
        'duplicate',
      ])
      expect(phase.natural.requiredLifestyle).toBe(0)
      expect(phase.natural.targetLifestyle).toBeGreaterThan(0)
      expect(phase.natural.idealLifestyle).toBe(0)
      expect(phase.natural.excessLifestyle).toBe(0)
    }

    expect([...new Set(phases.map((phase) => phase.input.year))]).toEqual([
      2026,
      2027,
      2028,
    ])
    const openingByYear = new Map<number, number>()
    for (const phase of phases) {
      openingByYear.set(
        phase.input.year,
        phase.input.startOfYearBalance.get('duplicate') ?? 0,
      )
    }
    expect([...openingByYear]).toEqual([
      [2026, 300],
      [2027, 235],
      [2028, 160],
    ])

    // Year-ordinal sentinels prove that each year's fresh return remains
    // load-bearing instead of the caller caching the first year's layers.
    expect(result.years.map((year) => ({
      year: year.year,
      baseSpending: year.expenses.baseSpending,
      requiredSpending: year.expenses.requiredSpending,
      targetSpending: year.expenses.targetSpending,
      idealSpending: year.expenses.idealSpending,
      excessSpending: year.expenses.excessSpending,
      intendedSpending: year.expenses.intendedSpending,
    }))).toEqual([
      { year: 2026, baseSpending: 65, requiredSpending: 20, targetSpending: 40, idealSpending: 15, excessSpending: 10, intendedSpending: 65 },
      { year: 2027, baseSpending: 75, requiredSpending: 21, targetSpending: 43, idealSpending: 18, excessSpending: 14, intendedSpending: 75 },
      { year: 2028, baseSpending: 85, requiredSpending: 22, targetSpending: 46, idealSpending: 21, excessSpending: 18, intendedSpending: 85 },
    ])
  })
})
