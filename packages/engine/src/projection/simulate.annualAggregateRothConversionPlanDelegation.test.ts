/**
 * Hostile delegation guard for the aggregate Roth-conversion planner.
 *
 * The mock always calls production first, records the live identities and then
 * can replace either the published snapshot or one economic draw. This makes
 * an orphaned helper, caller recomputation, copied publication, or ignored
 * allocation row observable. The counterfactual fixture separately proves
 * that reservation replay and the caller-owned conversion mutations roll back
 * before the committed annual pass re-enters the helper.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualAggregateRothConversionPlan,
  AnnualAggregateRothConversionPlanInput,
} from './internal/annualAggregateRothConversionPlan.js'
import type { AggregateRothConversionBalance } from
  '../actions/aggregateRothConversionOwnerAllocation.js'

type PlannerInput = AnnualAggregateRothConversionPlanInput<
  AggregateRothConversionBalance
>
type PlannerOutput = AnnualAggregateRothConversionPlan<
  AggregateRothConversionBalance
>
type Mode = 'original' | 'snapshot' | 'draw' | 'reservation' | 'refusal'

interface PlannerEvent {
  readonly input: PlannerInput
  readonly original: PlannerOutput
  readonly output: PlannerOutput
  readonly balancesAtCall: readonly number[]
}

const SENTINEL_DRAW = 1_234.56
const seam = vi.hoisted(() => ({
  mode: 'original' as Mode,
  events: [] as PlannerEvent[],
}))

vi.mock('./internal/annualAggregateRothConversionPlan.js', async (
  importOriginal,
) => {
  const original = await importOriginal<
    typeof import('./internal/annualAggregateRothConversionPlan.js')
  >()
  return {
    ...original,
    annualAggregateRothConversionPlan: (
      input: Parameters<
        typeof original.annualAggregateRothConversionPlan
      >[0],
    ) => {
      const production = original.annualAggregateRothConversionPlan(input)
      let output = production
      if (
        seam.mode === 'refusal' &&
        production.allocation.status === 'refused' &&
        production.reservations.length > 0
      ) {
        const [first, ...rest] = production.reservations
        output = {
          ...production,
          allocationBalances: Object.freeze({
            'delegated-refusal-snapshot': 9_876.54,
          }),
          reservations: [{
            ...first!,
            amountPlanDollars: first!.state.balance / 10,
          }, ...rest],
        }
      } else if (seam.mode === 'snapshot') {
        output = {
          ...production,
          allocationBalances: Object.freeze({
            'delegated-snapshot': 9_876.54,
          }),
        }
      } else if (
        seam.mode === 'draw' &&
        production.allocation.status === 'allocated' &&
        production.allocation.draws.length > 0
      ) {
        const [first, ...rest] = production.allocation.draws
        output = {
          ...production,
          allocation: {
            ...production.allocation,
            draws: [{ ...first!, amountPlanDollars: SENTINEL_DRAW }, ...rest],
          },
        }
      } else if (
        seam.mode === 'reservation' &&
        production.reservations.length > 0
      ) {
        const [first, ...rest] = production.reservations
        output = {
          ...production,
          reservations: [{
            ...first!,
            amountPlanDollars: first!.state.balance / 10,
          }, ...rest],
        }
      }
      seam.events.push({
        input,
        original: production,
        output,
        balancesAtCall: input.balances.map((state) => state.balance),
      })
      return output
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import type { RmdApplicablePlan } from '../rmd/rmdShortfallExcise.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import {
  simulatePlan,
  type SimulateAnnualCounterfactualRequest,
  type SimulateOptions,
} from './simulate.js'
import type { CounterfactualAnnualLiabilityResult } from
  '../internal/counterfactualAnnualLiability.js'

const YEAR = 2026
const OPENING = 500_000
const FIRST_RMD = OPENING / 26.5
const OWNER_IRAS: RmdApplicablePlan = {
  kind: 'ownedTraditionalIras',
  payeePersonId: 'p1',
}
const noTax = createFlatTaxCalculator(0)

function roth(id = 'roth'): Account {
  return {
    type: 'roth',
    kind: 'ira',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
  }
}

function conversionPlan(
  opening = OPENING,
  conversion = OPENING,
  holdsRoth = true,
): Plan {
  const plan = singlePersonPlan({
    dob: '1953-01-01',
    planningAge: 95,
    retirementAge: null,
  })
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  const source = traditionalAccount('ira', opening)
  source.annualReturnPct = 0
  plan.accounts = [
    cashAccount('cash', 100_000),
    source,
    ...(holdsRoth ? [roth()] : []),
  ]
  plan.strategies.rothConversion = {
    mode: 'manual',
    conversions: [{ year: YEAR, amount: conversion }],
  }
  return validatePlan(plan)
}

function run(
  mode: Mode,
  plan = conversionPlan(),
  options: Partial<SimulateOptions> = {},
) {
  seam.mode = mode
  seam.events.length = 0
  const result = simulatePlan(plan, {
    startYear: YEAR,
    horizonEndYear: YEAR,
    taxCalculator: noTax,
    captureAnnualCashFlow: true,
    rmdFirstYearDeferrals: [{
      distributionCalendarYear: YEAR,
      applicablePlan: OWNER_IRAS,
    }],
    ...options,
  })
  return { plan, result, events: [...seam.events] }
}

function transfer(result: ReturnType<typeof simulatePlan>) {
  const line = result.years[0]!.cashFlow!.transferLines.find(
    (candidate) => candidate.kind === 'aggregateRothConversion',
  )
  if (line === undefined) throw new Error('missing aggregate conversion line')
  return line
}

beforeEach(() => {
  seam.mode = 'original'
  seam.events.length = 0
})

describe('simulatePlan delegates aggregate Roth-conversion planning', () => {
  it('passes live state and the deferred-RMD reserve, then publishes the returned snapshot by identity', () => {
    const { plan, result, events } = run('snapshot')
    expect(events.length).toBeGreaterThan(0)
    const committed = events.at(-1)!

    expect(committed.input.desiredPlanDollars).toBe(OPENING)
    expect([...committed.input.iraRmdUnsatisfiedByOwner]).toEqual([
      ['p1', FIRST_RMD],
    ])
    expect(committed.input.balances.map((state) => state.account))
      .toEqual(plan.accounts)
    expect(committed.input.balances[0]!.account).toBe(plan.accounts[0])
    expect(committed.balancesAtCall).toEqual([100_000, OPENING, 0])
    expect(committed.original.reservations).toHaveLength(1)
    expect(committed.original.reservations[0]!.state)
      .toBe(committed.input.balances[1])
    expect(committed.original.reservations[0]!.amountPlanDollars)
      .toBe(FIRST_RMD)
    expect(result.years[0]!.aggregateRothConversionAllocationBalances)
      .toBe(committed.output.allocationBalances)
    expect(result.years[0]!.aggregateRothConversionAllocationBalances)
      .toEqual({ 'delegated-snapshot': 9_876.54 })
  })

  it('executes hostile returned rows while retaining ordinals, Form 8606 and cash-flow work in the caller', () => {
    const { result, events } = run('draw')
    const year = result.years[0]!
    const committed = events.at(-1)!
    if (committed.output.allocation.status !== 'allocated') {
      throw new Error('expected an allocated hostile output')
    }

    expect(committed.output.allocation.draws[0]!.sourceState)
      .toBe(committed.input.balances[1])
    expect(committed.output.allocation.draws[0]!.destination.destinationState)
      .toBe(committed.input.balances[2])
    expect(year.rothConversion).toBe(SENTINEL_DRAW)
    expect(year.balances.ira).toBe(OPENING - SENTINEL_DRAW)
    expect(year.balances.roth).toBe(SENTINEL_DRAW)
    expect(year.advisoryFederalTax).toBeDefined()
    expect(year.advisoryFederalTax!.input.ordinaryIncome).toBe(SENTINEL_DRAW)
    expect(year.ownedTraditionalIraAggregateActivity).toEqual([
      expect.objectContaining({
        ownerPersonId: 'p1',
        assumedBasisConsequential: expect.objectContaining({
          conversions: SENTINEL_DRAW,
        }),
      }),
    ])
    expect(transfer(result).debitPlanDollars).toBe(SENTINEL_DRAW)
    expect(transfer(result).creditPlanDollars).toBe(SENTINEL_DRAW)
    expect(year.retirementRuntimeSource?.runtimeOccurrences).toHaveLength(1)
    expect(year.retirementRuntimeApplicationSource?.applications.map(
      (application) => application.mutationOrdinal,
    )).toEqual([1, 2])
  })

  it('replays the returned subtract/add reservation with its exact binary64 association', () => {
    const opening = 371_153_914_996_534.69
    const conversion = 100
    const firstRmd = opening / 26.5
    const originalRoundTrip = (opening - firstRmd) + firstRmd
    const delegatedReservation = opening / 10
    const delegatedRoundTrip =
      (opening - delegatedReservation) + delegatedReservation
    const { result, events } = run(
      'reservation',
      conversionPlan(opening, conversion),
    )
    const year = result.years[0]!
    const committed = events.at(-1)!

    expect(committed.original.reservations[0]!.amountPlanDollars)
      .toBe(firstRmd)
    expect(committed.output.reservations[0]!.amountPlanDollars)
      .toBe(delegatedReservation)
    expect(originalRoundTrip).not.toBe(opening)
    expect(delegatedRoundTrip).not.toBe(originalRoundTrip)
    expect(year.balances.ira).toBe(delegatedRoundTrip - conversion)
    expect(year.balances.ira).not.toBe(originalRoundTrip - conversion)
    expect(year.balances.ira).not.toBe(opening - conversion)
    expect(year.balances.roth).toBe(conversion)
  })

  it('publishes and replays delegated output even when the policy refuses the conversion', () => {
    const opening = 371_153_914_996_534.69
    const conversion = 100
    const firstRmd = opening / 26.5
    const originalRoundTrip = (opening - firstRmd) + firstRmd
    const delegatedReservation = opening / 10
    const delegatedRoundTrip =
      (opening - delegatedReservation) + delegatedReservation
    const { result, events } = run(
      'refusal',
      conversionPlan(opening, conversion, false),
    )
    const year = result.years[0]!
    const committed = events.at(-1)!

    expect(committed.original.allocation).toEqual({
      status: 'refused',
      reason: 'householdHoldsNoRothAccount',
    })
    expect(committed.original.reservations[0]!.amountPlanDollars)
      .toBe(firstRmd)
    expect(committed.output.reservations[0]!.amountPlanDollars)
      .toBe(delegatedReservation)
    expect(year.aggregateRothConversionAllocationBalances)
      .toBe(committed.output.allocationBalances)
    expect(year.aggregateRothConversionAllocationBalances).toEqual({
      'delegated-refusal-snapshot': 9_876.54,
    })
    expect(delegatedRoundTrip).not.toBe(originalRoundTrip)
    expect(year.balances.ira).toBe(delegatedRoundTrip)
    expect(year.rothConversion).toBe(0)
  })

  it('rolls reservation replay and allocation back before counterfactual re-entry', () => {
    const opening = 371_153_914_996_534.69
    const conversion = 100
    const firstRmd = opening / 26.5
    const oneReplayClosing = (opening - firstRmd) + firstRmd - conversion
    const target = conversionPlan(opening, conversion)
    const control = run('original', target)
    const captured: CounterfactualAnnualLiabilityResult[] = []
    const annualCounterfactual: SimulateAnnualCounterfactualRequest = {
      omitActionIds: [],
      taxUnitId: 'aggregate-roth-delegation-tax-unit',
      nonGroupTaxInputs: [],
      capture: (reading) => captured.push(reading),
    }
    const prePassed = run('original', target, { annualCounterfactual })

    expect(JSON.stringify(prePassed.result)).toBe(JSON.stringify(control.result))
    expect(captured).toHaveLength(1)
    expect(captured[0]?.status).toBe('counterfactualAnnualLiabilityRead')
    expect(prePassed.events.length).toBeGreaterThan(control.events.length)
    for (const event of prePassed.events) {
      expect(event.balancesAtCall).toEqual([100_000, opening, 0])
      expect([...event.input.iraRmdUnsatisfiedByOwner]).toEqual([
        ['p1', firstRmd],
      ])
      expect(event.original.reservations.map((reservation) =>
        reservation.amountPlanDollars)).toEqual([firstRmd])
    }
    expect(prePassed.result.years[0]!.balances.ira).toBe(oneReplayClosing)
  })
})
