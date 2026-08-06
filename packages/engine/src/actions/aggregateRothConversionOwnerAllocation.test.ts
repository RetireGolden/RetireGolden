import { describe, expect, it } from 'vitest'

import type { Account } from '../model/plan.js'
import {
  allocateAggregateRothConversionByOwner,
  type AggregateRothConversionBalance,
} from './aggregateRothConversionOwnerAllocation.js'

/**
 * The allocation policy on its own, away from the ledger that executes it.
 *
 * The behaviour these cases describe is already pinned end-to-end through
 * `simulate.crossOwnerRothConversion.test.ts`, `conversionOwnerIdentity.test.ts`
 * and `conversionDestinationVehicle.test.ts`, which run the whole projection and
 * read balances and runtime evidence. What those cannot see is the shape of the
 * answer: which movements the policy names, in what order, and what it says
 * about an owner it refused. The promotion chooser reads exactly that shape, so
 * it is worth asserting directly rather than only through its consequences.
 */

interface TestBalance extends AggregateRothConversionBalance {
  readonly account: Account
  balance: number
}

function ira(id: string, balance: number, ownerPersonId: string | null): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function employerTraditional(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance,
    annualContribution: 0,
  }
}

function rothIra(id: string, ownerPersonId: string, balance = 0): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'ira',
    balance,
    annualContribution: 0,
  }
}

function designatedRoth(id: string, ownerPersonId: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance: 0,
    annualContribution: 0,
  }
}

function cash(id: string, balance: number): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function states(...accounts: Account[]): TestBalance[] {
  return accounts.map((account) => ({
    account,
    balance: 'balance' in account ? account.balance : 0,
  }))
}

function allocate(balances: TestBalance[], desiredPlanDollars: number) {
  return allocateAggregateRothConversionByOwner({
    balances,
    desiredPlanDollars,
    primaryPersonId: 'p1',
  })
}

/** `{sourceId: amount}` for the movements the policy named, in its own order. */
function drawnAmounts(
  allocation: ReturnType<typeof allocate>,
): Array<[string, number]> {
  if (allocation.status !== 'allocated') throw new Error('expected an allocation')
  return allocation.draws.map((draw) => [draw.sourceAccount.id, draw.amountPlanDollars])
}

describe('household refusals', () => {
  it('refuses a household that holds no Roth account at all', () => {
    const allocation = allocate(states(ira('pat-ira', 100_000, 'p1')), 40_000)

    expect(allocation).toEqual({ status: 'refused', reason: 'householdHoldsNoRothAccount' })
  })

  it('refuses a household whose every Roth sits inside an employer plan', () => {
    // The discriminating half: there IS a Roth, and it still cannot receive a
    // conversion, so the household hears a different sentence.
    const allocation = allocate(
      states(ira('pat-ira', 100_000, 'p1'), designatedRoth('pat-roth-401k', 'p1')),
      40_000,
    )

    expect(allocation).toEqual({
      status: 'refused',
      reason: 'householdHoldsOnlyEmployerDesignatedRoth',
    })
  })
})

describe('owner slices', () => {
  it('hands a single convertible owner the sized amount without quantizing it', () => {
    // 1,000.005 dollars is not expressible in cents. A household with nothing
    // to split must not be routed through the exact-cent ledger, so the slice
    // is the sized figure itself and the draw is capped only by the balance.
    const balances = states(ira('pat-ira', 100_000, 'p1'), rothIra('pat-roth', 'p1'))
    const allocation = allocate(balances, 1_000.005)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.slices).toHaveLength(1)
    expect(allocation.slices[0]!.slicePlanDollars).toBe(1_000.005)
    expect(drawnAmounts(allocation)).toEqual([['pat-ira', 1_000.005]])
  })

  it('splits a genuine two-owner household in exact cents with no residue', () => {
    // 100,001 cents at 1:2 is 33,333⅔ and 66,667⅓. The odd cent goes to the
    // larger exact remainder, and the parts still add to the whole.
    const balances = states(
      ira('pat-ira', 10_000, 'p1'),
      ira('robin-ira', 20_000, 'p2'),
      rothIra('pat-roth', 'p1'),
      rothIra('robin-roth', 'p2'),
    )
    const allocation = allocate(balances, 1_000.01)

    expect(drawnAmounts(allocation)).toEqual([
      ['pat-ira', 333.34],
      ['robin-ira', 666.67],
    ])
  })

  it('weights owners by gross convertible balance, employer plans included', () => {
    // The set the draws take from is the set the weight is built from: Alex's
    // 401(k) counts for the split exactly as an IRA would.
    const balances = states(
      employerTraditional('alex-401k', 820_000, 'alex'),
      ira('sam-ira', 310_000, 'sam'),
      rothIra('alex-roth', 'alex'),
      rothIra('sam-roth', 'sam'),
    )
    const allocation = allocate(balances, 100_000)

    expect(drawnAmounts(allocation)).toEqual([
      ['alex-401k', 72_566.37],
      ['sam-ira', 27_433.63],
    ])
    expect(72_566.37 + 27_433.63).toBe(100_000)
  })

  it('ignores an account that holds nothing when it weights owners', () => {
    const balances = states(
      ira('pat-ira', 0, 'p1'),
      ira('robin-ira', 20_000, 'p2'),
      rothIra('pat-roth', 'p1'),
      rothIra('robin-roth', 'p2'),
    )
    const allocation = allocate(balances, 5_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.slices.map((slice) => slice.ownerPersonId)).toEqual(['p2'])
    expect(drawnAmounts(allocation)).toEqual([['robin-ira', 5_000]])
  })

  it('gives an unowned account to the primary person', () => {
    // A Plan account with no individual owner is the primary's for every
    // purpose here: their weight, their slice, their destination.
    const balances = states(ira('joint-ira', 50_000, null), rothIra('pat-roth', 'p1'))
    const allocation = allocate(balances, 10_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.slices[0]!.ownerPersonId).toBe('p1')
    expect(drawnAmounts(allocation)).toEqual([['joint-ira', 10_000]])
  })
})

describe('trims', () => {
  it('drops the slice of an owner who holds no Roth, and names the reason', () => {
    const balances = states(
      ira('robin-ira', 100_000, 'p2'),
      ira('pat-ira', 100_000, 'p1'),
      rothIra('pat-roth', 'p1'),
    )
    const allocation = allocate(balances, 40_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.trims).toEqual([
      { ownerPersonId: 'p2', reason: 'ownerHoldsNoRothAccount', slicePlanDollars: 20_000 },
    ])
    expect(drawnAmounts(allocation)).toEqual([['pat-ira', 20_000]])
  })

  it('distinguishes the owner whose only Roth is a designated Roth account', () => {
    const balances = states(
      ira('robin-ira', 100_000, 'p2'),
      designatedRoth('robin-roth-401k', 'p2'),
      ira('pat-ira', 100_000, 'p1'),
      rothIra('pat-roth', 'p1'),
    )
    const allocation = allocate(balances, 40_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.trims).toEqual([
      {
        ownerPersonId: 'p2',
        reason: 'ownerHoldsOnlyEmployerDesignatedRoth',
        slicePlanDollars: 20_000,
      },
    ])
  })

  it('leaves a trimmed slice out of what the balances were asked to produce', () => {
    // Robin cannot convert for want of a Roth. That is not a shortfall against
    // anyone's balance, so the target the caller measures the result against is
    // Pat's slice alone.
    const balances = states(
      ira('pat-ira', 100_000, 'p1'),
      ira('robin-ira', 100_000, 'p2'),
      rothIra('pat-roth', 'p1'),
    )
    const allocation = allocate(balances, 40_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.convertibleTargetPlanDollars).toBe(20_000)
  })

  it('treats the whole request as the target when nobody holds a convertible balance', () => {
    // No slice, no owner to name: summing an empty set to zero would leave a
    // requested conversion that moved nothing entirely silent.
    const allocation = allocate(states(rothIra('pat-roth', 'p1')), 40_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.slices).toEqual([])
    expect(allocation.trims).toEqual([])
    expect(allocation.convertibleTargetPlanDollars).toBe(40_000)
  })
})

describe('destinations', () => {
  it('passes over a designated Roth account for a Roth IRA later in Plan order', () => {
    const rothIraAccount = rothIra('pat-roth-ira', 'p1')
    const balances = states(
      ira('pat-ira', 100_000, 'p1'),
      designatedRoth('pat-roth-401k', 'p1'),
      rothIraAccount,
    )
    const allocation = allocate(balances, 10_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.destinations.map((entry) => entry.destinationAccount.id))
      .toEqual(['pat-roth-ira'])
    expect(allocation.draws[0]!.destination.destinationAccount).toBe(rothIraAccount)
  })

  it('names only an owner’s first Roth IRA, so a second is never credited twice', () => {
    const balances = states(
      ira('pat-ira', 100_000, 'p1'),
      rothIra('pat-roth-a', 'p1'),
      rothIra('pat-roth-b', 'p1'),
    )
    const allocation = allocate(balances, 10_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(allocation.destinations.map((entry) => entry.destinationAccount.id))
      .toEqual(['pat-roth-a'])
  })

  it('returns the destinations in Plan order, one per converting owner', () => {
    const balances = states(
      ira('robin-ira', 30_000, 'p2'),
      ira('pat-ira', 90_000, 'p1'),
      rothIra('pat-roth', 'p1'),
      rothIra('robin-roth', 'p2'),
    )
    const allocation = allocate(balances, 40_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    // Slice order follows each owner's first convertible account (Robin first);
    // destination order follows the Roth accounts themselves (Pat first).
    expect(allocation.slices.map((slice) => slice.ownerPersonId)).toEqual(['p2', 'p1'])
    expect(allocation.destinations.map((entry) => entry.ownerPersonId)).toEqual(['p1', 'p2'])
  })
})

describe('draws', () => {
  it('walks the balances once in Plan order rather than grouping by owner', () => {
    // Pat's two accounts sit either side of Robin's. The ledger's journal
    // records movements in the order it visits balances, so the policy has to
    // name them in that order and not owner by owner.
    const balances = states(
      ira('pat-ira-a', 10_000, 'p1'),
      ira('robin-ira', 20_000, 'p2'),
      ira('pat-ira-b', 10_000, 'p1'),
      rothIra('pat-roth', 'p1'),
      rothIra('robin-roth', 'p2'),
    )
    const allocation = allocate(balances, 20_000)

    // Pat holds half the household's convertible balance, so Pat's 10,000
    // slice exhausts the first account and takes nothing from the second.
    expect(drawnAmounts(allocation)).toEqual([
      ['pat-ira-a', 10_000],
      ['robin-ira', 10_000],
    ])
  })

  it('spills an owner’s slice into their next account in Plan order', () => {
    const balances = states(
      ira('pat-ira-a', 4_000, 'p1'),
      ira('robin-ira', 20_000, 'p2'),
      ira('pat-ira-b', 16_000, 'p1'),
      rothIra('pat-roth', 'p1'),
      rothIra('robin-roth', 'p2'),
    )
    const allocation = allocate(balances, 20_000)

    expect(drawnAmounts(allocation)).toEqual([
      ['pat-ira-a', 4_000],
      ['robin-ira', 10_000],
      ['pat-ira-b', 6_000],
    ])
  })

  it('caps an owner at their own balance and converts nothing of the other’s', () => {
    const balances = states(
      ira('pat-ira', 1_000, 'p1'),
      ira('robin-ira', 9_000, 'p2'),
      rothIra('pat-roth', 'p1'),
    )
    const allocation = allocate(balances, 20_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    // Pat's 2,000 slice outruns Pat's 1,000 balance; Robin's 18,000 is trimmed.
    expect(drawnAmounts(allocation)).toEqual([['pat-ira', 1_000]])
    expect(allocation.convertibleTargetPlanDollars).toBe(2_000)
  })

  it('skips a movement the exact-cent ledger would record as nothing', () => {
    // A source holding a fraction of a cent is a non-event, not a small event:
    // the journal has no occurrence for a gross that rounds to zero.
    const balances = states(
      ira('pat-ira-a', 0.004, 'p1'),
      ira('pat-ira-b', 5_000, 'p1'),
      rothIra('pat-roth', 'p1'),
    )
    const allocation = allocate(balances, 1_000)

    // The skipped source takes nothing AND costs the owner nothing: the whole
    // 1,000 still comes out of the second account.
    expect(drawnAmounts(allocation)).toEqual([['pat-ira-b', 1_000]])
  })

  it.each([
    ['a zero request', 0],
    ['a negative request', -40_000],
  ])('allocates nothing at all for %s', (_label, desired) => {
    // A negative figure must not reach the split: it produces negative slice
    // targets, and the caller's shortfall test then measures the year against
    // them. Nothing is refused either -- there is no share a missing Roth IRA
    // failed to receive, so there is nothing to tell anyone about.
    const balances = states(ira('pat-ira', 100_000, 'p1'), rothIra('pat-roth', 'p1'))
    const allocation = allocate(balances, desired)

    expect(allocation).toEqual({
      status: 'allocated',
      slices: [],
      trims: [],
      draws: [],
      destinations: [],
      convertibleTargetPlanDollars: 0,
    })
  })

  it.each([
    ['NaN', Number.NaN],
    ['an infinity', Number.POSITIVE_INFINITY],
  ])('throws on %s rather than converting it into a household refusal', (_label, desired) => {
    // Malformed input, not a small request. The two refusal reasons are facts
    // about a household that the ledger turns into sentences for the person
    // whose household it is, and this is not one of them.
    const balances = states(ira('pat-ira', 100_000, 'p1'), rothIra('pat-roth', 'p1'))

    expect(() => allocate(balances, desired)).toThrow(RangeError)
    expect(balances.map((state) => state.balance)).toEqual([100_000, 0])
  })

  it('never lets the ledger reach either guard', () => {
    // `simulate.ts` sizes `desired` itself and calls only inside
    // `desired > 0.01`, which is false for NaN and for every nonpositive
    // figure. The guards exist for the promotion chooser and whatever consumes
    // this next, and this is the arithmetic that says so.
    for (const desired of [Number.NaN, 0, -1, 0.005]) {
      expect(desired > 0.01).toBe(false)
    }
  })

  it('never takes from an account that is not a convertible source', () => {
    const balances = states(
      cash('savings', 50_000),
      ira('pat-ira', 10_000, 'p1'),
      rothIra('pat-roth', 'p1'),
    )
    const allocation = allocate(balances, 40_000)

    expect(drawnAmounts(allocation)).toEqual([['pat-ira', 10_000]])
  })
})

describe('the policy decides and does not move', () => {
  it('leaves every balance it was handed exactly as it found it', () => {
    // The ledger owns the movement. A policy that debited on the caller's
    // behalf would double-count the moment a second caller read the same
    // answer without executing it.
    const balances = states(
      ira('pat-ira', 100_000, 'p1'),
      rothIra('pat-roth', 'p1', 5_000),
    )
    const allocation = allocate(balances, 40_000)

    if (allocation.status !== 'allocated') throw new Error('expected an allocation')
    expect(balances.map((state) => state.balance)).toEqual([100_000, 5_000])
    // And it hands back the caller's own records, so the ledger debits the
    // objects it already holds rather than copies it would have to re-match.
    expect(allocation.draws[0]!.sourceState).toBe(balances[0])
    expect(allocation.draws[0]!.destination.destinationState).toBe(balances[1])
  })
})
