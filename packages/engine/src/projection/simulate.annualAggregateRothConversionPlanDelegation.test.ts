/**
 * Hostile delegation guard for the aggregate Roth-conversion planner.
 *
 * The mock always calls production first, records the live identities and then
 * can replace either the published snapshot or one economic draw. This makes
 * an orphaned helper, caller recomputation, copied publication, or ignored
 * allocation row observable. The counterfactual fixture separately proves
 * that reservation replay and the caller-owned conversion mutations roll back
 * before the committed annual pass re-enters the helper.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

import type {
  AnnualAggregateRothConversionLiveBalance,
  AnnualAggregateRothConversionPlan,
  AnnualAggregateRothConversionPlanInput,
} from './internal/annualAggregateRothConversionPlan.js'

type PlannerInput = AnnualAggregateRothConversionPlanInput<
  AnnualAggregateRothConversionLiveBalance
>
type PlannerOutput = AnnualAggregateRothConversionPlan<
  AnnualAggregateRothConversionLiveBalance
>
type Mode = 'original' | 'snapshot' | 'draw' | 'reservation' | 'refusal'

const SENTINEL_DRAW = 1_234.56
const hostile = vi.hoisted(() => ({ mode: 'original' as Mode }))

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<PlannerInput, PlannerOutput, readonly number[]>(),
)

vi.mock(
  './internal/annualAggregateRothConversionPlan.js',
  async (importOriginal) =>
    seam.through(
      await importOriginal<
        typeof import('./internal/annualAggregateRothConversionPlan.js')
      >(),
      'annualAggregateRothConversionPlan',
      (natural): PlannerOutput => {
        if (
          hostile.mode === 'refusal' &&
          natural.allocation.status === 'refused' &&
          natural.reservations.length > 0
        ) {
          const [first, ...rest] = natural.reservations
          return {
            ...natural,
            allocationBalances: Object.freeze({
              'delegated-refusal-snapshot': 9_876.54,
            }),
            reservations: [{
              ...first!,
              amountPlanDollars: first!.state.balance / 10,
            }, ...rest],
          }
        }
        if (hostile.mode === 'snapshot') {
          return {
            ...natural,
            allocationBalances: Object.freeze({
              'delegated-snapshot': 9_876.54,
            }),
          }
        }
        if (
          hostile.mode === 'draw' &&
          natural.allocation.status === 'allocated' &&
          natural.allocation.draws.length > 0
        ) {
          const [first, ...rest] = natural.allocation.draws
          return {
            ...natural,
            allocation: {
              ...natural.allocation,
              draws: [{ ...first!, amountPlanDollars: SENTINEL_DRAW }, ...rest],
            },
          }
        }
        if (hostile.mode === 'reservation' && natural.reservations.length > 0) {
          const [first, ...rest] = natural.reservations
          return {
            ...natural,
            reservations: [{
              ...first!,
              amountPlanDollars: first!.state.balance / 10,
            }, ...rest],
          }
        }
        return natural
      },
      { capture: (input) => input.balances.map((state) => state.balance) },
    ),
)

import {
  expectPublishedFromSeam,
  expectSeamRanAtLeastOnce,
} from './simulate.seamGuard.test-support.js'
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
  hostile.mode = mode
  seam.reset()
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
  return { plan, result, events: [...seam.calls] }
}

function transfer(result: ReturnType<typeof simulatePlan>) {
  const line = result.years[0]!.cashFlow!.transferLines.find(
    (candidate) => candidate.kind === 'aggregateRothConversion',
  )
  if (line === undefined) throw new Error('missing aggregate conversion line')
  return line
}

beforeEach(() => {
  hostile.mode = 'original'
  seam.reset()
})

describe('simulatePlan delegates aggregate Roth-conversion planning', () => {
  it('passes live state and the deferred-RMD reserve, then publishes the returned snapshot by identity', () => {
    const { plan, result, events } = run('snapshot')
    expectSeamRanAtLeastOnce(seam)
    const committed = events.at(-1)!

    expect(committed.input.desiredPlanDollars).toBe(OPENING)
    expect([...committed.input.iraRmdUnsatisfiedByOwner]).toEqual([
      ['p1', FIRST_RMD],
    ])
    expect(committed.input.balances.map((state) => state.account))
      .toEqual(plan.accounts)
    expect(committed.input.balances[0]!.account).toBe(plan.accounts[0])
    expect(committed.captured).toEqual([100_000, OPENING, 0])
    expect(committed.natural.reservations).toHaveLength(1)
    expect(committed.natural.reservations[0]!.state)
      .toBe(committed.input.balances[1])
    expect(committed.natural.reservations[0]!.amountPlanDollars)
      .toBe(FIRST_RMD)
    expectPublishedFromSeam(
      result.years[0]!.aggregateRothConversionAllocationBalances,
      committed.injected.allocationBalances,
      'the aggregate conversion allocation snapshot',
    )
    expect(result.years[0]!.aggregateRothConversionAllocationBalances)
      .toEqual({ 'delegated-snapshot': 9_876.54 })
  })

  it('executes hostile returned rows while retaining ordinals, Form 8606 and cash-flow work in the caller', () => {
    const { result, events } = run('draw')
    const year = result.years[0]!
    const committed = events.at(-1)!
    if (committed.injected.allocation.status !== 'allocated') {
      throw new Error('expected an allocated hostile output')
    }

    expect(committed.injected.allocation.draws[0]!.sourceState)
      .toBe(committed.input.balances[1])
    expect(committed.injected.allocation.draws[0]!.destination.destinationState)
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

    expect(committed.natural.reservations[0]!.amountPlanDollars)
      .toBe(firstRmd)
    expect(committed.injected.reservations[0]!.amountPlanDollars)
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

    expect(committed.natural.allocation).toEqual({
      status: 'refused',
      reason: 'householdHoldsNoRothAccount',
    })
    expect(committed.natural.reservations[0]!.amountPlanDollars)
      .toBe(firstRmd)
    expect(committed.injected.reservations[0]!.amountPlanDollars)
      .toBe(delegatedReservation)
    expectPublishedFromSeam(
      year.aggregateRothConversionAllocationBalances,
      committed.injected.allocationBalances,
      'the aggregate conversion allocation snapshot',
    )
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
      expect(event.captured).toEqual([100_000, opening, 0])
      expect([...event.input.iraRmdUnsatisfiedByOwner]).toEqual([
        ['p1', firstRmd],
      ])
      expect(event.natural.reservations.map((reservation) =>
        reservation.amountPlanDollars)).toEqual([firstRmd])
    }
    expect(prePassed.result.years[0]!.balances.ira).toBe(oneReplayClosing)
  })
})
