/**
 * Hostile delegation guard for the coordinated-HECM boundary.
 *
 * The mocks call production first, then selectively alter capacity, id order,
 * or allocation amounts. Those changes are observable through independent
 * ledger fields, so an orphaned helper or a caller that recomputes either
 * result fails. An annual counterfactual run additionally proves that the pure
 * helpers retain no state and that caller-owned line mutation rolls back.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualCoordinatedHecmAllocationInput,
  AnnualCoordinatedHecmAllocationRow,
  AnnualCoordinatedHecmEligibility,
  AnnualCoordinatedHecmEligibilityInput,
} from './internal/annualCoordinatedHecm.js'

type Mode = 'original' | 'capacity30' | 'reverseIds' | 'inflateAllocation'

interface EligibilityEvent {
  readonly input: AnnualCoordinatedHecmEligibilityInput
  readonly original: AnnualCoordinatedHecmEligibility
  readonly output: AnnualCoordinatedHecmEligibility
  readonly lineBalancesAtCall: Readonly<Record<string, number>>
}

interface AllocationEvent {
  readonly year: number
  readonly input: AnnualCoordinatedHecmAllocationInput
  readonly original: readonly AnnualCoordinatedHecmAllocationRow[]
  readonly output: readonly AnnualCoordinatedHecmAllocationRow[]
  readonly eligibility: EligibilityEvent
  readonly lineBalancesAtCall: Readonly<Record<string, number>>
  /** Shallow copy: values retain the caller-owned line object identities. */
  readonly lineReferencesAtCall: ReadonlyMap<
    string,
    Readonly<{ principalLimit: number; loanBalance: number }>
  >
}

const seam = vi.hoisted(() => ({
  mode: 'original' as Mode,
  eligibility: [] as EligibilityEvent[],
  allocations: [] as AllocationEvent[],
}))

vi.mock('./internal/annualCoordinatedHecm.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualCoordinatedHecm.js')>()
  const balances = (
    states: ReadonlyMap<string, Readonly<{ loanBalance: number }>>,
  ): Readonly<Record<string, number>> => Object.fromEntries(
    [...states].map(([id, line]) => [id, line.loanBalance]),
  )
  return {
    ...original,
    annualCoordinatedHecmEligibility: (
      input: Parameters<typeof original.annualCoordinatedHecmEligibility>[0],
    ) => {
      const production = original.annualCoordinatedHecmEligibility(input)
      const output = seam.mode === 'capacity30'
        ? { propertyAccountIds: production.propertyAccountIds, capacity: 30_000 }
        : seam.mode === 'reverseIds'
          ? {
              propertyAccountIds: [...production.propertyAccountIds].reverse(),
              capacity: 30_000,
            }
          : production
      seam.eligibility.push({
        input,
        original: production,
        output,
        lineBalancesAtCall: balances(input.hecmStates),
      })
      return output
    },
    annualCoordinatedHecmAllocations: (
      input: Parameters<typeof original.annualCoordinatedHecmAllocations>[0],
    ) => {
      const production = original.annualCoordinatedHecmAllocations(input)
      const output = seam.mode === 'inflateAllocation' && production.length > 0
        ? production.map((row, index) => index === 0
          ? { ...row, amount: row.amount + 7_000 }
          : row)
        : production
      const eligibility = [...seam.eligibility].reverse().find(
        (event) => event.input.hecmStates === input.hecmStates,
      )
      if (eligibility === undefined) {
        throw new Error('allocation did not follow an eligibility call on its live map')
      }
      seam.allocations.push({
        year: eligibility.input.year,
        input,
        original: production,
        output,
        eligibility,
        lineBalancesAtCall: balances(input.hecmStates),
        lineReferencesAtCall: new Map(input.hecmStates),
      })
      return output
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  setAcaYearContract,
  singlePersonPlan,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'
import type { ProjectionResult, TaxYearInput, YearResult } from './types.js'

const START_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function property(
  id: string,
  principalLimitPct: number,
): Extract<Account, { type: 'property' }> {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    value: 100_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    hecm: {
      openYear: START_YEAR - 1,
      principalLimitPct,
      upfrontCostPct: 0,
      growthRatePct: 0,
      drawPolicy: 'coordinated',
    },
  }
}

function taxable(balance = 1_000_000): Extract<Account, { type: 'taxable' }> {
  return {
    type: 'taxable',
    id: 'brokerage',
    name: 'brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance,
    costBasis: balance,
    annualContribution: 0,
  }
}

function coordinatedPlan(): Plan {
  const plan = singlePersonPlan({ dob: '1964-01-01', planningAge: 63 })
  plan.expenses.baseAnnual = 70_000
  const shared = property('home1', 40)
  plan.accounts = [
    taxable(),
    { ...shared, name: 'earlier alias without HECM metadata', hecm: undefined },
    shared,
    {
      ...shared,
      name: 'later alias with divergent last-resort policy',
      hecm: { ...shared.hecm!, drawPolicy: 'lastResort' },
    },
    property('home2', 10),
  ]
  return validatePlan(plan)
}

function run(
  mode: Mode,
  plan = coordinatedPlan(),
  options: Partial<SimulateOptions> = {},
): { readonly plan: Plan; readonly result: ProjectionResult } {
  seam.mode = mode
  seam.eligibility.length = 0
  seam.allocations.length = 0
  return {
    plan,
    result: simulatePlan(plan, {
      startYear: START_YEAR,
      horizonEndYear: START_YEAR + 1,
      taxCalculator: noTax,
      market: { returnShockPct: [-10, 0] },
      captureAnnualCashFlow: true,
      ...options,
    }),
  }
}

function year(result: ProjectionResult, calendarYear: number): YearResult {
  const value = result.years.find((candidate) => candidate.year === calendarYear)
  if (value === undefined) throw new Error(`missing projection year ${calendarYear}`)
  return value
}

function coordinatedSources(value: YearResult) {
  return value.cashFlow!.sourceLines.filter(
    (line) => line.kind === 'hecmCoordinatedDraw',
  )
}

beforeEach(() => {
  seam.mode = 'original'
  seam.eligibility.length = 0
  seam.allocations.length = 0
})

describe('simulatePlan delegates annual coordinated HECM work', () => {
  it('passes live identity-bearing state through both helpers and consumes their rows', () => {
    const { plan, result } = run('original')
    expect(seam.eligibility.map((event) => event.input.year)).toEqual([2026, 2027])
    expect(seam.allocations.map((event) => event.year)).toEqual([2026, 2027])
    for (const event of seam.eligibility) {
      expect(event.input.accounts).toBe(plan.accounts)
      expect(Array.isArray(event.output.propertyAccountIds)).toBe(true)
    }

    const eligible = seam.eligibility.find((event) => event.input.year === 2027)!
    const allocation = seam.allocations.find((event) => event.year === 2027)!
    expect(eligible.output).toBe(eligible.original)
    expect(eligible.output).toEqual({
      propertyAccountIds: ['home1', 'home2'],
      capacity: 50_000,
    })
    expect(allocation.input.hecmStates).toBe(eligible.input.hecmStates)
    expect(allocation.input.propertyAccountIds).toBe(
      eligible.output.propertyAccountIds,
    )
    expect(allocation.input.acceptedDraw).toBe(50_000)
    expect(allocation.output).toBe(allocation.original)
    expect(allocation.output).toEqual([
      { propertyAccountId: 'home1', amount: 40_000 },
      { propertyAccountId: 'home2', amount: 10_000 },
    ])
    const home1AtCommit = allocation.lineReferencesAtCall.get('home1')!
    const home2AtCommit = allocation.lineReferencesAtCall.get('home2')!
    expect(allocation.input.hecmStates.get('home1')).toBe(home1AtCommit)
    expect(allocation.input.hecmStates.get('home2')).toBe(home2AtCommit)
    expect(home1AtCommit.loanBalance).toBe(40_000)
    expect(home2AtCommit.loanBalance).toBe(10_000)

    const accepted = year(result, 2027)
    expect(accepted.hecmDraw).toBe(50_000)
    expect(accepted.hecmLoanBalance).toBe(50_000)
    expect(coordinatedSources(accepted).map((line) => [
      line.identities[0],
      line.amountPlanDollars,
    ])).toEqual([
      [{ entityKind: 'propertyAccount', propertyAccountId: 'home1' }, 40_000],
      [{ entityKind: 'propertyAccount', propertyAccountId: 'home2' }, 10_000],
    ])
  })

  it('uses hostile capacity and id order, and applies hostile rows without replacing the accepted scalar', () => {
    const capacity = year(run('capacity30').result, 2027)
    expect(capacity.hecmDraw).toBe(30_000)
    expect(capacity.hecmLoanBalance).toBe(30_000)

    const reversed = year(run('reverseIds').result, 2027)
    expect(reversed.hecmDraw).toBe(30_000)
    expect(coordinatedSources(reversed).map((line) => {
      const identity = line.identities[0]
      return [
        identity?.entityKind === 'propertyAccount'
          ? identity.propertyAccountId
          : null,
        line.amountPlanDollars,
      ]
    })).toEqual([
      ['home1', 20_000],
      ['home2', 10_000],
    ])

    const inflated = year(run('inflateAllocation').result, 2027)
    expect(inflated.hecmDraw).toBe(50_000)
    expect(inflated.hecmLoanBalance).toBe(57_000)
    expect(coordinatedSources(inflated).reduce(
      (sum, line) => sum + line.amountPlanDollars,
      0,
    )).toBe(57_000)
    expect(inflated.cashFlow!.reconciliation.status).toBe('notReconciled')
  })

  it('allocates once after a multi-evaluation ACA fixed point and sees an untouched line', () => {
    const plan = singlePersonPlan({ dob: '1963-01-01', planningAge: 63 })
    plan.expenses.baseAnnual = 40_000
    plan.incomes = [{
      type: 'recurring',
      id: 'pension',
      label: 'pension',
      annualAmount: 30_000,
      startYear: 2026,
      endYear: 2026,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    }]
    plan.accounts = [taxable(400_000), {
      ...property('home1', 40),
      value: 600_000,
    }]
    setAcaYearContract(plan, { year: 2026 })
    plan.expenses.healthcare.pre65MonthlyPremiumPerPerson = 0
    const validated = validatePlan(plan)
    const taxCalls: TaxYearInput[] = []
    const calculator = {
      compute(input: TaxYearInput): number {
        taxCalls.push(input)
        return 0
      },
    }

    run('original', validated, {
      startYear: 2025,
      horizonEndYear: 2026,
      taxCalculator: calculator,
      market: { returnShockPct: [-10, 0] },
      captureAnnualCashFlow: false,
    })
    const accepted = seam.allocations.filter(
      (event) => event.year === 2026 && event.input.acceptedDraw > 0,
    )
    expect(taxCalls.filter((input) => input.year === 2026).length).toBeGreaterThan(2)
    expect(accepted).toHaveLength(1)
    expect(accepted[0]!.lineBalancesAtCall.home1).toBe(0)
    expect(accepted[0]!.input.acceptedDraw).toBeGreaterThan(10_000)
  })

  it('rolls caller mutation back on counterfactual re-entry and produces the same committed result', () => {
    const plan = coordinatedPlan()
    const baseline = run('original', plan).result
    const captures: unknown[] = []
    const replay = run('original', plan, {
      annualCounterfactual: {
        omitActionIds: [],
        taxUnitId: 'coordinated-hecm-delegation-tax-unit',
        nonGroupTaxInputs: [],
        capture: (reading) => captures.push(reading),
      },
    }).result

    expect(replay).toEqual(baseline)
    expect(captures).toHaveLength(2)
    const accepted = seam.allocations.filter(
      (event) => event.year === 2027 && event.input.acceptedDraw > 0,
    )
    expect(accepted.length).toBeGreaterThan(1)
    for (const event of accepted) {
      expect(event.input.acceptedDraw).toBe(50_000)
      expect(event.lineBalancesAtCall).toMatchObject({ home1: 0, home2: 0 })
      expect(event.output).toEqual([
        { propertyAccountId: 'home1', amount: 40_000 },
        { propertyAccountId: 'home2', amount: 10_000 },
      ])
    }
    expect(new Set(accepted.map((event) => event.output)).size).toBe(
      accepted.length,
    )
  })
})
