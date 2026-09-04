/**
 * Hostile delegation proof for the annual HECM shortfall backstop.
 *
 * The wrapper replaces the coordinator's independently computed allocation,
 * total draw, and residual shortfall with deliberately inconsistent values.
 * Independent year, debt, depletion, and cash-flow fields observe those exact
 * replacements, so an orphaned helper or caller-side recomputation cannot pass
 * because production matches the former inline loop.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualHecmBackstopInput,
  AnnualHecmBackstopPlan,
} from './internal/annualHecmBackstop.js'

const hostile = vi.hoisted(() => ({ inject: false }))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<AnnualHecmBackstopInput, AnnualHecmBackstopPlan, number>(),
)

vi.mock('./internal/annualHecmBackstop.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/annualHecmBackstop.js')>(),
    'annualHecmBackstopPlan',
    (natural): AnnualHecmBackstopPlan =>
      hostile.inject && natural.allocations.length > 0
        ? {
            allocations: natural.allocations.map((row, index) =>
              index === 0 ? { ...row, amount: row.amount - 3_000 } : row),
            // Deliberately differs from both the allocation sum and the
            // amount implied by the independently injected residual.
            draw: natural.draw - 4_000,
            shortfallAfterHecm: natural.shortfallAfterHecm + 3_000,
          }
        : natural,
    {
      capture: (input) =>
        input.hecmStates.get('home1')?.loanBalance ?? Number.NaN,
    },
  ),
)

import { expectSeamRan } from './simulate.seamGuard.test-support.js'
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
  hostile.inject = inject
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
  hostile.inject = false
  seam.reset()
})

describe('simulatePlan delegates annual HECM backstop planning', () => {
  it('passes live post-coordinated state and commits the returned plan exactly once', () => {
    const { plan, year } = run(false)
    const call = expectSeamRan(seam, 1)[0]!
    expect(Object.isFrozen(call.input)).toBe(true)
    expect(call.input.accounts).toBe(plan.accounts)
    expect(call.captured).toBe(0)
    expect(call.injected).toBe(call.natural)
    expect(call.natural).toEqual({
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

  it('uses independently hostile allocations, draw, and residual without recomputing', () => {
    const { year } = run(true)
    expect(expectSeamRan(seam, 1)[0]!.injected).toEqual({
      allocations: [{ propertyAccountId: 'home1', amount: 7_000 }],
      draw: 6_000,
      shortfallAfterHecm: 32_000,
    })
    expect(year.hecmDraw).toBe(6_000)
    expect(year.hecmLoanBalance).toBe(7_000)
    expect(year.shortfall).toBe(32_000)
    expect(year.cashFlow!.sourceLines).toContainEqual(expect.objectContaining({
      kind: 'hecmBackstopDraw',
      amountPlanDollars: 7_000,
    }))
  })
})
