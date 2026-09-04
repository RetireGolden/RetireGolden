/**
 * Hostile delegation guard for the coordinated-HECM boundary.
 *
 * The mocks call production first, then selectively alter capacity, id order,
 * or allocation amounts. Those changes are observable through independent
 * ledger fields, so an orphaned helper or a caller that recomputes either
 * result fails. An annual counterfactual run additionally proves that the pure
 * helpers retain no state and that caller-owned line mutation rolls back.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualCoordinatedHecmAllocationInput,
  AnnualCoordinatedHecmAllocationRow,
  AnnualCoordinatedHecmEligibility,
  AnnualCoordinatedHecmEligibilityInput,
} from './internal/annualCoordinatedHecm.js'

type Mode =
  | 'original'
  | 'capacity30'
  | 'reverseIds'
  | 'insertExcluded'
  | 'inflateAllocation'

/**
 * Read off the live line map before the real allocator runs, because the map is
 * caller-owned and the projection keeps moving after the seam returns.
 */
interface AllocationCapture {
  /** Year of the eligibility pass that produced this allocation's live map. */
  readonly year: number
  readonly lineBalancesAtCall: Readonly<Record<string, number>>
  /** Shallow copy: values retain the caller-owned line object identities. */
  readonly lineReferencesAtCall: ReadonlyMap<
    string,
    Readonly<{ principalLimit: number; loanBalance: number }>
  >
}

const hostile = vi.hoisted(() => ({ mode: 'original' as Mode }))

const eligibilitySeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualCoordinatedHecmEligibilityInput,
      AnnualCoordinatedHecmEligibility
    >(),
)

const allocationSeam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualCoordinatedHecmAllocationInput,
      readonly AnnualCoordinatedHecmAllocationRow[],
      AllocationCapture
    >(),
)

vi.mock('./internal/annualCoordinatedHecm.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/annualCoordinatedHecm.js')>()
  const balances = (
    states: ReadonlyMap<string, Readonly<{ loanBalance: number }>>,
  ): Readonly<Record<string, number>> => Object.fromEntries(
    [...states].map(([id, line]) => [id, line.loanBalance]),
  )
  return eligibilitySeam.through(
    allocationSeam.through(
      original,
      'annualCoordinatedHecmAllocations',
      (natural): readonly AnnualCoordinatedHecmAllocationRow[] =>
        hostile.mode === 'inflateAllocation' && natural.length > 0
          ? natural.map((row, index) => index === 0
            ? { ...row, amount: row.amount + 7_000 }
            : row)
          : natural,
      {
        capture: (input): AllocationCapture => {
          const eligibility = [...eligibilitySeam.calls].reverse().find(
            (call) => call.input.hecmStates === input.hecmStates,
          )
          if (eligibility === undefined) {
            throw new Error('allocation did not follow an eligibility call on its live map')
          }
          return {
            year: eligibility.input.year,
            lineBalancesAtCall: balances(input.hecmStates),
            lineReferencesAtCall: new Map(input.hecmStates),
          }
        },
      },
    ),
    'annualCoordinatedHecmEligibility',
    (natural, { input }): AnnualCoordinatedHecmEligibility => {
      const afterStartYear = input.year > input.startYear
      return hostile.mode === 'capacity30' && afterStartYear
        ? { propertyAccountIds: natural.propertyAccountIds, capacity: 30_000 }
        : hostile.mode === 'reverseIds' && afterStartYear
          ? {
              propertyAccountIds: [...natural.propertyAccountIds].reverse(),
              capacity: 30_000,
            }
          : hostile.mode === 'insertExcluded' && afterStartYear
            ? {
                propertyAccountIds: [...natural.propertyAccountIds, 'excluded'],
                capacity: natural.capacity + 15_000,
              }
          : natural
    },
  )
})

import { expectPublishedFromSeam } from './simulate.seamGuard.test-support.js'
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
  const excluded = property('excluded', 15)
  excluded.hecm!.drawPolicy = 'lastResort'
  plan.accounts = [
    taxable(),
    excluded,
    {
      ...excluded,
      name: 'later excluded alias with coordinated policy',
      hecm: { ...excluded.hecm!, drawPolicy: 'coordinated' },
    },
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
  hostile.mode = mode
  eligibilitySeam.reset()
  allocationSeam.reset()
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
  hostile.mode = 'original'
  eligibilitySeam.reset()
  allocationSeam.reset()
})

describe('simulatePlan delegates annual coordinated HECM work', () => {
  it('passes live identity-bearing state through both helpers and consumes their rows', () => {
    const { plan, result } = run('original')
    expect(eligibilitySeam.calls.map((call) => call.input.year)).toEqual([2026, 2027])
    expect(allocationSeam.calls.map((call) => call.captured.year)).toEqual([2026, 2027])
    for (const call of eligibilitySeam.calls) {
      expect(call.input.accounts).toBe(plan.accounts)
      expect(Array.isArray(call.injected.propertyAccountIds)).toBe(true)
    }

    const eligible = eligibilitySeam.calls.find((call) => call.input.year === 2027)!
    const allocation = allocationSeam.calls.find(
      (call) => call.captured.year === 2027,
    )!
    expect(eligible.injected).toBe(eligible.natural)
    expect(eligible.injected).toEqual({
      propertyAccountIds: ['home1', 'home2'],
      capacity: 50_000,
    })
    expect(allocation.input.hecmStates).toBe(eligible.input.hecmStates)
    expectPublishedFromSeam(
      allocation.input.propertyAccountIds,
      eligible.injected.propertyAccountIds,
      'the allocation input property-id list',
    )
    expect(allocation.input.acceptedDraw).toBe(50_000)
    expect(allocation.injected).toBe(allocation.natural)
    expect(allocation.injected).toEqual([
      { propertyAccountId: 'home1', amount: 40_000 },
      { propertyAccountId: 'home2', amount: 10_000 },
    ])
    const home1AtCommit = allocation.captured.lineReferencesAtCall.get('home1')!
    const home2AtCommit = allocation.captured.lineReferencesAtCall.get('home2')!
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

    const capacityStart = year(run('capacity30').result, 2026)
    expect(capacityStart.hecmDraw).toBe(0)
    expect(capacityStart.hecmLoanBalance).toBe(0)

    const reversedRun = run('reverseIds').result
    const reversedStart = year(reversedRun, 2026)
    expect(reversedStart.hecmDraw).toBe(0)
    expect(reversedStart.hecmLoanBalance).toBe(0)
    const reversed = year(reversedRun, 2027)
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

    const inserted = year(run('insertExcluded').result, 2027)
    expect(inserted.hecmDraw).toBe(65_000)
    expect(inserted.hecmLoanBalance).toBe(65_000)
    expect(allocationSeam.calls.find(
      (call) => call.captured.year === 2027 && call.input.acceptedDraw > 0,
    )!.injected).toContainEqual({
      propertyAccountId: 'excluded',
      amount: 15_000,
    })

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
    const accepted = allocationSeam.calls.filter(
      (call) => call.captured.year === 2026 && call.input.acceptedDraw > 0,
    )
    expect(taxCalls.filter((input) => input.year === 2026).length).toBeGreaterThan(2)
    expect(accepted).toHaveLength(1)
    expect(accepted[0]!.captured.lineBalancesAtCall.home1).toBe(0)
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
    const accepted = allocationSeam.calls.filter(
      (call) => call.captured.year === 2027 && call.input.acceptedDraw > 0,
    )
    expect(accepted.length).toBeGreaterThan(1)
    for (const call of accepted) {
      expect(call.input.acceptedDraw).toBe(50_000)
      expect(call.captured.lineBalancesAtCall).toMatchObject({
        excluded: 0,
        home1: 0,
        home2: 0,
      })
      expect(call.injected).toEqual([
        { propertyAccountId: 'home1', amount: 40_000 },
        { propertyAccountId: 'home2', amount: 10_000 },
      ])
    }
    expect(new Set(accepted.map((call) => call.injected)).size).toBe(
      accepted.length,
    )
  })
})
