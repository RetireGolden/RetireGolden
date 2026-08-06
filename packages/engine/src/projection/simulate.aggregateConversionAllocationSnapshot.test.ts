import { describe, expect, it } from 'vitest'

import { allocateAggregateRothConversionByOwner } from '../actions/aggregateRothConversionOwnerAllocation.js'
import { parseRetirementActionRequest } from '../actions/contract.js'
import { couplePlan, validatePlan } from '../testing/planFixtures.js'
import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

/**
 * What `YearResult.aggregateRothConversionAllocationBalances` promises.
 *
 * The field exists so the optimizer's promotion path can weight owners by the
 * figures THIS projection weighted them by, rather than by the Plan's opening
 * balances or a reconstruction from the closing ones. Three things have to hold
 * for that to be worth anything, and each has its own suite below:
 *
 * 1. the figures are the ones the policy consumed — asserted by re-running the
 *    policy on the published snapshot and getting the movements the ledger
 *    actually made, to the cent;
 * 2. the set is exactly the accounts the policy reads;
 * 3. presence means the policy was asked, and every way of not asking is a
 *    named, tested absence.
 */

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)
const ALEX = 'p1'
const SAM = 'p2'

function traditionalIra(id: string, balance: number, ownerPersonId: string): Account {
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

function rothIra(id: string, balance: number, ownerPersonId: string): Account {
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

function designatedRoth(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'roth',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    kind: 'employer',
    balance,
    annualContribution: 0,
  }
}

function cash(id: string, balance: number, ownerPersonId: string): Account {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId,
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

/**
 * A two-owner household with flat everything, so a year's opening balances are
 * its pre-conversion ones and the arithmetic under test is the only arithmetic.
 */
function household(accounts: Account[]): Plan {
  const plan = couplePlan({ p1PlanningAge: 65, p2PlanningAge: 65 })
  plan.id = 'aggregate-conversion-allocation-snapshot'
  plan.household.people[0]!.name = 'Alex'
  plan.household.people[1]!.name = 'Sam'
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.accounts = accounts
  return plan
}

const ACCOUNTS = (): Account[] => [
  cash('joint-cash', 40_000, ALEX),
  traditionalIra('alex-ira', 820_000, ALEX),
  traditionalIra('sam-ira', 310_000, SAM),
  rothIra('alex-roth', 145_000, ALEX),
]

function runManual(
  plan: Plan,
  conversions: { year: number; amount: number }[],
  horizonEndYear = TAX_YEAR,
): YearResult[] {
  const priced = validatePlan({
    ...plan,
    strategies: { ...plan.strategies, rothConversion: { mode: 'manual', conversions } },
  })
  return simulatePlan(priced, {
    startYear: TAX_YEAR,
    horizonEndYear,
    taxCalculator: noTax,
  }).years
}

function snapshotOf(year: YearResult): Readonly<Record<string, number>> {
  const snapshot = year.aggregateRothConversionAllocationBalances
  if (snapshot === undefined) {
    throw new Error(`expected ${year.year} to publish an allocation snapshot`)
  }
  return snapshot
}

describe('the published snapshot is what the policy consumed', () => {
  it('re-running the policy on it reproduces the year’s movements to the cent', () => {
    const plan = household(ACCOUNTS())
    const years = runManual(plan, [{ year: TAX_YEAR, amount: 100_000 }])
    const year = years[0]!
    const snapshot = snapshotOf(year)

    // The policy, run again over the published figures and the same household
    // amount, is the ledger's own answer -- not a second answer that agrees.
    const replay = allocateAggregateRothConversionByOwner({
      balances: validatePlan(plan).accounts
        .filter((account) => snapshot[account.id] !== undefined)
        .map((account) => ({ account, balance: snapshot[account.id]! })),
      desiredPlanDollars: 100_000,
      primaryPersonId: ALEX,
    })
    if (replay.status !== 'allocated') throw new Error('expected an allocated replay')

    // Alex keeps 820,000 : 310,000 of 100,000 and Sam, holding no Roth, is
    // trimmed -- the split the ledger warns about and the figure it moved.
    expect(replay.slices).toHaveLength(1)
    expect(replay.slices[0]!.ownerPersonId).toBe(ALEX)
    expect(replay.trims).toEqual([{
      ownerPersonId: SAM,
      reason: 'ownerHoldsNoRothAccount',
      slicePlanDollars: 27_433.63,
    }])
    expect(replay.draws.map((draw) => [draw.sourceAccount.id, draw.amountPlanDollars]))
      .toEqual([['alex-ira', 72_566.37]])

    // And the movements themselves, measured off the year's closing balances.
    expect(year.rothConversion).toBeCloseTo(72_566.37, 10)
    expect(820_000 - year.balances['alex-ira']!).toBeCloseTo(72_566.37, 10)
    expect(year.balances['alex-roth']! - 145_000).toBeCloseTo(72_566.37, 10)
    expect(year.balances['sam-ira']).toBe(310_000)
  })

  it('states the pre-drain balances, which a converting account’s closing figure is not', () => {
    const plan = household(ACCOUNTS())
    const years = runManual(
      plan,
      [{ year: TAX_YEAR, amount: 100_000 }, { year: TAX_YEAR + 1, amount: 50_000 }],
      TAX_YEAR + 1,
    )
    const first = snapshotOf(years[0]!)
    const second = snapshotOf(years[1]!)

    // Year one weights owners by the Plan's openings, because nothing has moved.
    expect(first['alex-ira']).toBe(820_000)
    expect(first['alex-roth']).toBe(145_000)
    // Year two does not: it weights them by what year one left behind, which is
    // the whole reason the snapshot cannot be reconstructed from the Plan.
    expect(second['alex-ira']).toBeCloseTo(820_000 - 72_566.37, 10)
    expect(second['alex-roth']).toBeCloseTo(145_000 + 72_566.37, 10)
    expect(second['alex-ira']).not.toBe(years[1]!.balances['alex-ira'])
  })

  it('states every account the policy reads and no account it does not', () => {
    const plan = household([...ACCOUNTS(), designatedRoth('sam-designated-roth', 60_000, SAM)])
    const years = runManual(plan, [{ year: TAX_YEAR, amount: 100_000 }])
    const snapshot = snapshotOf(years[0]!)

    // Owned traditional accounts and BOTH kinds of Roth. The designated Roth is
    // in it although nothing may convert into one: it is what tells an owner
    // who holds only that kind apart from an owner who holds no Roth at all,
    // and those two hear different sentences.
    //
    // Asserted as a SET, and never as an enumeration: the field promises which
    // accounts are stated and what each one held, not what order the keys come
    // out in, and a plain object cannot promise the second (an integer-like ID
    // enumerates first however it was inserted). Pinning `Object.keys` order
    // would pin a property the contract disclaims.
    expect(new Set(Object.keys(snapshot)))
      .toEqual(new Set(['alex-ira', 'sam-ira', 'alex-roth', 'sam-designated-roth']))
    // Per account, joined the way a consumer joins it: on `plan.accounts`,
    // which is where Plan order actually lives.
    expect(validatePlan(plan).accounts
      .filter((account) => snapshot[account.id] !== undefined)
      .map((account) => [account.id, snapshot[account.id]]))
      .toEqual([
        ['alex-ira', 820_000],
        ['sam-ira', 310_000],
        ['alex-roth', 145_000],
        ['sam-designated-roth', 60_000],
      ])
    // The cash account funds the household and weights nobody, so it is absent
    // rather than published as a figure a reader might weight by.
    expect(snapshot['joint-cash']).toBeUndefined()
  })
})

describe('presence means the policy was asked, and absence names its cause', () => {
  it('publishes in the years the aggregate arm ran and in no others', () => {
    const plan = household(ACCOUNTS())
    const years = runManual(
      plan,
      [{ year: TAX_YEAR + 1, amount: 25_000 }],
      TAX_YEAR + 2,
    )

    expect(years.map((year) => [
      year.year,
      year.aggregateRothConversionAllocationBalances !== undefined,
    ])).toEqual([
      [TAX_YEAR, false],
      [TAX_YEAR + 1, true],
      [TAX_YEAR + 2, false],
    ])
  })

  it('is absent for the whole projection when the plan converts nothing', () => {
    const plan = validatePlan(household(ACCOUNTS()))
    const result = simulatePlan(plan, {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR + 2,
      taxCalculator: noTax,
    })

    expect(plan.strategies.rothConversion.mode).toBe('none')
    expect(result.years.every((year) =>
      year.aggregateRothConversionAllocationBalances === undefined)).toBe(true)
  })

  it('is absent for an amount too small to move a cent', () => {
    const plan = household(ACCOUNTS())
    const years = runManual(plan, [{ year: TAX_YEAR, amount: 0.004 }])

    // The ledger's own `desired > 0.01` gate: the policy is never called, so
    // there is no snapshot and nothing converted.
    expect(years[0]!.aggregateRothConversionAllocationBalances).toBeUndefined()
    expect(years[0]!.rothConversion).toBe(0)
  })

  it('is absent for a year a named conversion request owns', () => {
    const base = household(ACCOUNTS())
    const plan = validatePlan({
      ...base,
      retirementActionEligibilityFacts: {
        iraClassifications: [{
          evidenceId: 'alex-ira-classification',
          provenance: { source: 'manual' },
          sourceAccountId: 'alex-ira',
          subtype: 'traditional',
        }],
        sepSimpleActivities: [],
        deductibleIraContributions: [],
      },
      strategies: {
        ...base.strategies,
        // A manual aggregate entry for the very same year, so the absence below
        // can only be the named request taking the year.
        rothConversion: { mode: 'manual', conversions: [{ year: TAX_YEAR, amount: 100_000 }] },
        retirementActions: [namedConversionRequest()],
      },
    })
    const year = simulatePlan(plan, {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR,
      taxCalculator: noTax,
    }).years[0]!

    expect(year.aggregateRothConversionAllocationBalances).toBeUndefined()
    expect(year.rothConversionActionExecution).toBeDefined()
  })
})

function namedConversionRequest() {
  const parsed = parseRetirementActionRequest({
          actionId: 'named-conversion',
          kind: 'rothConversion',
          personId: ALEX,
          year: TAX_YEAR,
          executionDate: `${TAX_YEAR}-06-30`,
          executionSequence: 1,
          requestedAmount: 10_000_00,
          provenance: { source: 'manual' },
          allocations: [{
            allocationId: 'named-conversion-allocation',
            sourceAccountId: 'alex-ira',
            requestedAmount: 10_000_00,
          }],
    destinationRothAccountId: 'alex-roth',
    taxFunding: { kind: 'noneExpected' },
  })
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.request
}
