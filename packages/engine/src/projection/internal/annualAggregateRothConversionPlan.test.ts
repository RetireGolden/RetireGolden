import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import {
  annualAggregateRothConversionPlan,
} from './annualAggregateRothConversionPlan.js'

interface State {
  readonly account: Account
  balance: number
  readonly marker: object
}

function traditional(
  id: string,
  ownerPersonId: string | null,
  balance: number,
  extra: Partial<Extract<Account, { type: 'traditional' }>> = {},
): State {
  return {
    account: {
      type: 'traditional',
      kind: 'ira',
      id,
      name: id,
      ownerPersonId,
      annualReturnPct: 0,
      balance,
      annualContribution: 0,
      ...extra,
    },
    balance,
    marker: {},
  }
}

function roth(id: string, ownerPersonId: string, balance = 0): State {
  return {
    account: {
      type: 'roth',
      kind: 'ira',
      id,
      name: id,
      ownerPersonId,
      annualReturnPct: 0,
      balance,
      annualContribution: 0,
    },
    balance,
    marker: {},
  }
}

const sourceContextForOwner = () => ({
  ownerAgeAttained: 50,
  ownerRetirementAge: 80,
})

describe('annualAggregateRothConversionPlan', () => {
  it('reserves by Map owner order and reverse Plan order, then rebinds every policy row to live identities', () => {
    const alexFirst = traditional('alex-first', 'alex', 10)
    const samOnly = traditional('sam-only', 'sam', 20)
    const alexRoth = roth('alex-roth', 'alex')
    const samRoth = roth('sam-roth', 'sam')
    const alexLast = traditional('alex-last', 'alex', 30)
    // This later employer row is deliberately large enough to satisfy the
    // reserve by itself. An owned-plan RMD cannot satisfy an IRA RMD, so the
    // reverse walk must pass it and continue into Alex's IRAs.
    const alexEmployer = traditional('alex-employer', 'alex', 100, {
      kind: 'employer',
    })
    const balances = [
      alexFirst,
      samOnly,
      alexRoth,
      samRoth,
      alexLast,
      alexEmployer,
    ]
    const opening = balances.map((state) => state.balance)

    const plan = annualAggregateRothConversionPlan({
      balances,
      iraRmdUnsatisfiedByOwner: new Map([
        ['alex', 35],
        ['sam', 5],
      ]),
      desiredPlanDollars: 15,
      primaryPersonId: 'alex',
      sourceContextForOwner,
    })

    expect(plan.reservations.map((row) => [row.state, row.amountPlanDollars]))
      .toEqual([
        [alexLast, 30],
        [alexFirst, 5],
        [samOnly, 5],
      ])
    expect(plan.reservations[0]!.state).toBe(alexLast)
    expect(plan.allocationBalances).toEqual({
      'alex-first': 5,
      'sam-only': 15,
      'alex-roth': 0,
      'sam-roth': 0,
      'alex-last': 0,
      'alex-employer': 100,
    })
    expect(Object.isFrozen(plan.allocationBalances)).toBe(true)
    expect(balances.map((state) => state.balance)).toEqual(opening)

    if (plan.allocation.status !== 'allocated') {
      throw new Error('expected an allocated plan')
    }
    expect(plan.allocation.slices.map((slice) => [
      slice.ownerPersonId,
      slice.slicePlanDollars,
    ])).toEqual([
      ['alex', 3.75],
      ['sam', 11.25],
    ])
    expect(plan.allocation.draws.map((draw) => [
      draw.sourceState,
      draw.amountPlanDollars,
    ])).toEqual([
      [alexFirst, 3.75],
      [samOnly, 11.25],
    ])
    expect(plan.allocation.draws[0]!.sourceState).toBe(alexFirst)
    expect(plan.allocation.draws[1]!.sourceState).toBe(samOnly)
    expect(plan.allocation.draws[0]!.sourceAccount).toBe(alexFirst.account)
    expect(plan.allocation.draws[1]!.sourceAccount).toBe(samOnly.account)
    expect(plan.allocation.destinations.map((destination) =>
      destination.destinationState)).toEqual([alexRoth, samRoth])
    expect(plan.allocation.destinations[0]!.destinationState).toBe(alexRoth)
    expect(plan.allocation.destinations[1]!.destinationState).toBe(samRoth)
    expect(plan.allocation.destinations[0]!.destinationAccount)
      .toBe(alexRoth.account)
    expect(plan.allocation.destinations[1]!.destinationAccount)
      .toBe(samRoth.account)
    expect(plan.allocation.slices[0]!.destination)
      .toBe(plan.allocation.destinations[0])
    expect(plan.allocation.draws[0]!.destination)
      .toBe(plan.allocation.destinations[0])
  })

  it('keeps duplicate-id snapshot last-wins while reservation and allocation stay positional', () => {
    const firstDuplicate = traditional('dup', 'alex', 12)
    const secondDuplicate = traditional('dup', 'alex', 20)
    const destination = roth('roth', 'alex')
    const inherited = traditional('inherited', 'alex', 99, {
      inherited: {
        ownerDeathYear: 2020,
        decedentHadStartedRmds: false,
      },
    })

    const plan = annualAggregateRothConversionPlan({
      balances: [firstDuplicate, secondDuplicate, destination, inherited],
      iraRmdUnsatisfiedByOwner: new Map([['alex', 7]]),
      desiredPlanDollars: 25,
      primaryPersonId: 'alex',
      sourceContextForOwner,
    })

    expect(plan.reservations).toEqual([{
      state: secondDuplicate,
      amountPlanDollars: 7,
    }])
    expect(plan.allocationBalances).toEqual({ dup: 13, roth: 0 })
    if (plan.allocation.status !== 'allocated') {
      throw new Error('expected an allocated plan')
    }
    expect(plan.allocation.draws.map((draw) => [
      draw.sourceState,
      draw.amountPlanDollars,
    ])).toEqual([
      [firstDuplicate, 12],
      [secondDuplicate, 13],
    ])
    expect(plan.allocation.draws.every((draw) =>
      draw.sourceState !== inherited)).toBe(true)
  })

  it('returns the exact subtract/add operation whose caller replay changes the last bit', () => {
    const source = traditional('source', 'alex', 0.3)
    const destination = roth('roth', 'alex')
    const plan = annualAggregateRothConversionPlan({
      balances: [source, destination],
      iraRmdUnsatisfiedByOwner: new Map([['alex', 0.03]]),
      desiredPlanDollars: 0.1,
      primaryPersonId: 'alex',
      sourceContextForOwner,
    })

    expect(plan.allocationBalances.source).toBe(0.27)
    expect(plan.reservations).toEqual([{
      state: source,
      amountPlanDollars: 0.03,
    }])
    expect(source.balance).toBe(0.3)

    // This is the legacy caller's exact mutation order. Replacing it with an
    // assignment back to the opening value would erase a real binary64 leaf.
    for (const reservation of plan.reservations) {
      reservation.state.balance -= reservation.amountPlanDollars
    }
    for (const reservation of plan.reservations) {
      reservation.state.balance += reservation.amountPlanDollars
    }
    expect(source.balance).toBe(0.30000000000000004)
    expect(Object.is(source.balance, 0.3)).toBe(false)
  })

  it('passes through an allocated owner trim without copying account identities', () => {
    const alexSource = traditional('alex-source', 'alex', 10)
    const samSource = traditional('sam-source', 'sam', 20)
    const alexRoth = roth('alex-roth', 'alex')
    const plan = annualAggregateRothConversionPlan({
      balances: [alexSource, samSource, alexRoth],
      iraRmdUnsatisfiedByOwner: new Map(),
      desiredPlanDollars: 30,
      primaryPersonId: 'alex',
      sourceContextForOwner,
    })

    if (plan.allocation.status !== 'allocated') {
      throw new Error('expected an allocated plan')
    }
    expect(plan.allocation.trims).toEqual([{
      ownerPersonId: 'sam',
      reason: 'ownerHoldsNoRothAccount',
      slicePlanDollars: 20,
    }])
    expect(plan.allocation.draws).toHaveLength(1)
    expect(plan.allocation.draws[0]!.sourceState).toBe(alexSource)
    expect(plan.allocation.draws[0]!.sourceAccount).toBe(alexSource.account)
    expect(plan.allocation.draws[0]!.destination.destinationState)
      .toBe(alexRoth)
    expect(plan.allocation.draws[0]!.destination.destinationAccount)
      .toBe(alexRoth.account)
  })

  it('keeps live balances untouched when the delegated policy throws', () => {
    const source = traditional('source', 'alex', 100)
    const destination = roth('roth', 'alex')

    expect(() => annualAggregateRothConversionPlan({
      balances: [source, destination],
      iraRmdUnsatisfiedByOwner: new Map([['alex', 25]]),
      desiredPlanDollars: 50,
      primaryPersonId: 'alex',
      sourceContextForOwner: () => {
        throw new Error('hostile source context')
      },
    })).toThrow('hostile source context')
    expect(source.balance).toBe(100)
    expect(destination.balance).toBe(0)
  })

  it('returns refusal with the still-replayable reservation stream without mutating inputs', () => {
    const source = traditional('source', null, 100)
    const plan = annualAggregateRothConversionPlan({
      balances: [source],
      iraRmdUnsatisfiedByOwner: new Map([
        ['primary', 50],
        ['other-owner', -10],
      ]),
      desiredPlanDollars: 25,
      primaryPersonId: 'primary',
      sourceContextForOwner,
    })

    expect(plan.reservations).toEqual([{
      state: source,
      amountPlanDollars: 50,
    }])
    expect(plan.allocationBalances).toEqual({ source: 50 })
    expect(plan.allocation).toEqual({
      status: 'refused',
      reason: 'householdHoldsNoRothAccount',
    })
    expect(source.balance).toBe(100)
  })
})
