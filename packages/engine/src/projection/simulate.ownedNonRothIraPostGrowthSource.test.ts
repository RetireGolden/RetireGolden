import { describe, expect, it } from 'vitest'

import { planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import type { Account, Plan } from '../model/plan.js'
import {
  couplePlan,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { simulatePlan } from './simulate.js'
import type { YearResult } from './types.js'

const TAX_YEAR = 2026
const noTax = createFlatTaxCalculator(0)

function run(plan: Plan, endYear = TAX_YEAR): YearResult[] {
  return simulatePlan(validatePlan(plan), {
    startYear: TAX_YEAR,
    horizonEndYear: endYear,
    taxCalculator: noTax,
  }).years
}

function sourceOf(
  year: YearResult,
): NonNullable<YearResult['ownedNonRothIraPostGrowthSource']> {
  const source = year.ownedNonRothIraPostGrowthSource
  if (source === undefined) throw new Error('expected simulator post-growth source')
  return source
}

function ownedIra(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
  annualReturnPct = 0,
): Extract<Account, { type: 'traditional' }> {
  const account = traditionalAccount(id, balance, ownerPersonId)
  if (account.type !== 'traditional') throw new Error('expected traditional account')
  return { ...account, annualReturnPct }
}

function rothIra(
  id: string,
  balance: number,
  ownerPersonId = 'p1',
): Extract<Account, { type: 'roth' }> {
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

describe('simulate owned non-Roth IRA post-growth source capture', () => {
  it('publishes a truthful explicit-empty frozen source when no owned IRA exists', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'post-growth-empty'
    const year = run(plan)[0]!

    expect(sourceOf(year)).toEqual({
      status: 'postGrowthOwnedNonRothIraBalancesCaptured',
      captureBoundary:
        'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication',
      annualObservationValidation: 'notRun',
      planId: 'post-growth-empty',
      taxYear: TAX_YEAR,
      ownerPools: [],
    })
    expect(Object.keys(year)).toContain('ownedNonRothIraPostGrowthSource')
    expect(year.ownedNonRothIraBalancesBeforeGrowth).toEqual({})
    expect(Object.isFrozen(year.ownedNonRothIraBalancesBeforeGrowth)).toBe(true)
    expect(Object.isFrozen(sourceOf(year))).toBe(true)
    expect(Object.isFrozen(sourceOf(year).ownerPools)).toBe(true)
  })

  it('captures complete owner-wide pools including zero and unrequested siblings', () => {
    const plan = couplePlan({
      p1Dob: '1966-01-01',
      p2Dob: '1966-01-01',
      p1PlanningAge: 60,
      p2PlanningAge: 60,
    })
    plan.id = 'post-growth-complete-pools'
    plan.accounts = [
      ownedIra('p2-ira', 30, 'p2'),
      ownedIra('p1-zero-sibling', 0),
      ownedIra('p1-requested', 10),
    ]

    expect(sourceOf(run(plan)[0]!).ownerPools).toEqual([
      {
        ownerPersonId: 'p1',
        accountBalances: [
          { sourceAccountId: 'p1-requested', balancePlanDollars: 10 },
          { sourceAccountId: 'p1-zero-sibling', balancePlanDollars: 0 },
        ],
        // Line 6's other half, empty for an owner who bought no annuity
        // contract. Explicit rather than absent, for the same reason the zero
        // sibling above is: an owner with nothing to report reports nothing,
        // and the replay can tell that from a source that never said.
        annuityContractValues: [],
      },
      {
        ownerPersonId: 'p2',
        accountBalances: [
          { sourceAccountId: 'p2-ira', balancePlanDollars: 30 },
        ],
        annuityContractValues: [],
      },
    ])
  })

  it('is directly invariant to Plan account permutation', () => {
    const firstPlan = couplePlan({
      p1Dob: '1966-01-01',
      p2Dob: '1966-01-01',
      p1PlanningAge: 60,
      p2PlanningAge: 60,
    })
    firstPlan.id = 'post-growth-permutation'
    firstPlan.accounts = [
      ownedIra('z-p1', 10),
      ownedIra('a-p2', 20, 'p2'),
      ownedIra('a-p1', 30),
    ]
    const secondPlan = structuredClone(firstPlan)
    secondPlan.accounts.reverse()

    expect(JSON.stringify(sourceOf(run(secondPlan)[0]!)))
      .toBe(JSON.stringify(sourceOf(run(firstPlan)[0]!)))
  })

  it('publishes only the canonical last row of duplicate raw account facts', () => {
    const firstPlan = singlePersonPlan({ planningAge: 60 })
    firstPlan.id = 'post-growth-duplicate-raw-facts'
    firstPlan.accounts = [
      ownedIra('duplicate-ira', 20),
      ownedIra('duplicate-ira', 10),
    ]
    const secondPlan = structuredClone(firstPlan)
    secondPlan.accounts.reverse()

    const first = sourceOf(run(firstPlan)[0]!)
    const second = sourceOf(run(secondPlan)[0]!)
    expect(first.ownerPools[0]!.accountBalances).toEqual([
      { sourceAccountId: 'duplicate-ira', balancePlanDollars: 10 },
    ])
    expect(second.ownerPools[0]!.accountBalances).toEqual([
      { sourceAccountId: 'duplicate-ira', balancePlanDollars: 20 },
    ])
    expect(first.annualObservationValidation).toBe('notRun')
    expect(second.annualObservationValidation).toBe('notRun')
  })

  it('captures the live ledger after annual transactions and each growth pass', () => {
    const plan = singlePersonPlan({ planningAge: 61 })
    plan.id = 'post-growth-timing'
    plan.assumptions.inflationPct = 0
    plan.incomes = [{
      type: 'wages',
      id: 'wages',
      personId: 'p1',
      annualGross: 100,
      endAge: null,
      realGrowthPct: 0,
    }]
    plan.accounts = [
      {
        type: 'cash',
        id: 'cash',
        name: 'cash',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: 100,
        annualContribution: 0,
      },
      {
        ...ownedIra('ira', 100, 'p1', 10),
        annualContribution: 10,
      },
    ]

    const years = run(plan, TAX_YEAR + 1)
    const capturedBalances = years.map((year) =>
      sourceOf(year).ownerPools[0]!
        .accountBalances[0]!.balancePlanDollars,
    )
    const balancesBeforeGrowth = years.map((year) =>
      year.ownedNonRothIraBalancesBeforeGrowth!.ira,
    )
    expect(balancesBeforeGrowth[0]).toBeCloseTo(110, 10)
    expect(balancesBeforeGrowth[1]).toBeCloseTo(131, 10)
    expect(capturedBalances[0]).toBeCloseTo(121, 10)
    expect(capturedBalances[1]).toBeCloseTo(144.1, 10)
    expect(capturedBalances).toEqual(years.map((year) => year.balances.ira))
  })

  it('preserves a null owner as invalid raw input instead of inventing the primary', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'post-growth-unvalidated-owner'
    const account = ownedIra('unowned-ira', 10)
    account.ownerPersonId = null
    plan.accounts = [account]

    const year = simulatePlan(plan, {
      startYear: TAX_YEAR,
      horizonEndYear: TAX_YEAR,
      taxCalculator: noTax,
    }).years[0]!
    expect(sourceOf(year).ownerPools).toEqual([
      {
        ownerPersonId: null,
        accountBalances: [
          { sourceAccountId: 'unowned-ira', balancePlanDollars: 10 },
        ],
        annuityContractValues: [],
      },
    ])
    expect(sourceOf(year).annualObservationValidation)
      .toBe('notRun')
  })

  it('excludes inherited IRAs, employer plans, Roth IRAs, and nontraditional accounts', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'post-growth-exclusions'
    const inherited = ownedIra('inherited-ira', 20)
    inherited.inherited = {
      ownerDeathYear: TAX_YEAR - 1,
      decedentHadStartedRmds: false,
    }
    plan.accounts = [
      ownedIra('owned-ira', 10),
      inherited,
      traditionalAccount('employer-plan', 30, 'p1', 'employer'),
      rothIra('roth-ira', 40),
      {
        type: 'cash',
        id: 'cash',
        name: 'cash',
        ownerPersonId: null,
        annualReturnPct: 0,
        balance: 50,
        annualContribution: 0,
      },
    ]

    expect(sourceOf(run(plan)[0]!).ownerPools).toEqual([
      {
        ownerPersonId: 'p1',
        accountBalances: [
          { sourceAccountId: 'owned-ira', balancePlanDollars: 10 },
        ],
        annuityContractValues: [],
      },
    ])
  })

  it('freezes every owner pool and account fact without structural IDs or sealing', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.accounts = [ownedIra('ira-b', 2), ownedIra('ira-a', 1)]
    const year = run(plan)[0]!
    const source = sourceOf(year)

    expect(Object.isFrozen(year.ownedNonRothIraBalancesBeforeGrowth)).toBe(true)
    expect(Object.isFrozen(source)).toBe(true)
    expect(Object.isFrozen(source.ownerPools)).toBe(true)
    expect(Object.isFrozen(source.ownerPools[0])).toBe(true)
    expect(Object.isFrozen(source.ownerPools[0]!.accountBalances)).toBe(true)
    expect(Object.isFrozen(source.ownerPools[0]!.accountBalances[0])).toBe(true)
    expect(JSON.stringify(source)).not.toMatch(/evidenceId|ledgerRunId|sealed/)
  })

  it('preserves exact Plan-dollar facts for later exact-cent replay without changing economics', () => {
    const plan = singlePersonPlan({ planningAge: 60 })
    plan.id = 'post-growth-exact-cents'
    plan.accounts = [ownedIra('ira', 100.005)]
    const year = run(plan)[0]!
    const balance = sourceOf(year).ownerPools[0]!
      .accountBalances[0]!

    expect(balance.balancePlanDollars).toBe(year.balances.ira)
    expect(planDollarsToLedgerCents(balance.balancePlanDollars)).toBe(10_001)
    expect(year.investableTotal).toBe(100.005)
    expect(year.withdrawals.total).toBe(0)
    expect(year.tax).toBe(0)
  })
})
