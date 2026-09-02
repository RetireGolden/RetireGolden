/**
 * Hostile delegation proof for the annual HECM shortfall backstop.
 *
 * The wrapper replaces the coordinator's independently computed allocation,
 * total draw, and residual shortfall. Independent year, debt, depletion, and
 * cash-flow fields observe those exact replacements, so an orphaned helper or
 * caller-side recomputation cannot pass because production matches the former
 * inline loop.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualHecmBackstopInput,
  AnnualHecmBackstopPlan,
} from './internal/annualHecmBackstop.js'

interface BackstopCall {
  readonly input: AnnualHecmBackstopInput
  readonly original: AnnualHecmBackstopPlan
  readonly output: AnnualHecmBackstopPlan
  readonly lineBalanceAtCall: number
}

const seam = vi.hoisted(() => ({
  inject: false,
  calls: [] as BackstopCall[],
}))

vi.mock('./internal/annualHecmBackstop.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualHecmBackstop.js')>()
  return {
    ...original,
    annualHecmBackstopPlan: (input: AnnualHecmBackstopInput) => {
      const production = original.annualHecmBackstopPlan(input)
      const output: AnnualHecmBackstopPlan =
        seam.inject && production.allocations.length > 0
          ? {
              allocations: production.allocations.map((row, index) =>
                index === 0 ? { ...row, amount: row.amount - 3_000 } : row),
              draw: production.draw - 3_000,
              shortfallAfterHecm: production.shortfallAfterHecm + 3_000,
            }
          : production
      seam.calls.push({
        input,
        original: production,
        output,
        lineBalanceAtCall: input.hecmStates.get('home1')?.loanBalance ?? Number.NaN,
      })
      return output
    },
  }
})

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function backstopPlan(): Plan {
  const plan = createEmptyPlan({
    newId: () => 'backstop-id',
    now: () => new Date('2026-01-01T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'person1',
    name: 'Pat',
    dob: '1964-01-01',
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: 62, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.expenses.baseAnnual = 40_000
  plan.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  plan.accounts = [
    {
      type: 'cash',
      id: 'cash1',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 1_000,
      annualContribution: 0,
    },
    {
      type: 'property',
      id: 'home1',
      name: 'Home',
      ownerPersonId: null,
      annualReturnPct: null,
      value: 200_000,
      plannedSaleYear: null,
      expectedNetProceeds: null,
      primaryResidence: true,
      hecm: {
        openYear: START_YEAR,
        principalLimitPct: 5,
        upfrontCostPct: 0,
        growthRatePct: 0,
        drawPolicy: 'lastResort',
      },
    },
  ] satisfies Account[]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(inject: boolean) {
  seam.inject = inject
  const plan = backstopPlan()
  const result = simulatePlan(plan, {
    startYear: START_YEAR,
    horizonEndYear: START_YEAR,
    taxCalculator: noTax,
    captureAnnualCashFlow: true,
  })
  return { plan, year: result.years[0]! }
}

beforeEach(() => {
  seam.inject = false
  seam.calls.length = 0
})

describe('simulatePlan delegates annual HECM backstop planning', () => {
  it('passes live post-coordinated state and commits the returned plan exactly once', () => {
    const { plan, year } = run(false)
    expect(seam.calls).toHaveLength(1)
    const call = seam.calls[0]!
    expect(Object.isFrozen(call.input)).toBe(true)
    expect(call.input.accounts).toBe(plan.accounts)
    expect(call.lineBalanceAtCall).toBe(0)
    expect(call.output).toBe(call.original)
    expect(call.original).toEqual({
      allocations: [{ propertyAccountId: 'home1', amount: 10_000 }],
      draw: 10_000,
      shortfallAfterHecm: 29_000,
    })
    expect(year.hecmDraw).toBe(10_000)
    expect(year.hecmLoanBalance).toBe(10_000)
    expect(year.shortfall).toBe(29_000)
    expect(year.cashFlow!.sourceLines).toContainEqual(expect.objectContaining({
      kind: 'hecmBackstopDraw',
      amountPlanDollars: 10_000,
    }))
  })

  it('uses hostile allocations, draw, and residual shortfall without recomputing them', () => {
    const { year } = run(true)
    expect(seam.calls).toHaveLength(1)
    expect(seam.calls[0]!.output).toEqual({
      allocations: [{ propertyAccountId: 'home1', amount: 7_000 }],
      draw: 7_000,
      shortfallAfterHecm: 32_000,
    })
    expect(year.hecmDraw).toBe(7_000)
    expect(year.hecmLoanBalance).toBe(7_000)
    expect(year.shortfall).toBe(32_000)
    expect(year.cashFlow!.sourceLines).toContainEqual(expect.objectContaining({
      kind: 'hecmBackstopDraw',
      amountPlanDollars: 7_000,
    }))
  })
})
