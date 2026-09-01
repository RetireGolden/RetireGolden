/**
 * Seam guard for the per-entity publication extraction.
 *
 * Byte-for-byte projection equivalence cannot prove that `simulatePlan`
 * actually calls a new pure helper: an orphaned helper beside the old inline
 * block produces the same dump. These checks drive each settled evidence map,
 * require one post-settlement call, and replace the helper result with distinct
 * arrays so YearResult must publish the helper's own objects.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  PublishedEntityFacts,
  PublishedEntityFactsInput,
} from './internal/publishedEntityFacts.js'

interface PhaseEvent {
  readonly input: PublishedEntityFactsInput
  readonly derived: PublishedEntityFacts
  readonly returned: PublishedEntityFacts
}

const seam = vi.hoisted(() => ({ phases: [] as PhaseEvent[] }))

vi.mock('./internal/publishedEntityFacts.js', async (importOriginal) => {
  const original =
    await importOriginal<typeof import('./internal/publishedEntityFacts.js')>()
  return {
    ...original,
    publishedEntityFacts: (
      input: Parameters<typeof original.publishedEntityFacts>[0],
    ) => {
      const derived = original.publishedEntityFacts(input)
      const ordinal = seam.phases.length + 1
      const returned: PublishedEntityFacts = {
        ownedRothIraPoolActivity: [
          {
            ownerPersonId: `mock-owned-${ordinal}-a`,
            assumedBasisConsequential: { withdrawal: 101 + ordinal },
          },
          {
            ownerPersonId: `mock-owned-${ordinal}-b`,
            assumedBasisConsequential: { withdrawal: 1_001 + ordinal },
          },
        ],
        employerRothAccountActivity: [
          {
            accountId: `mock-employer-${ordinal}-a`,
            ownerPersonId: `mock-owner-${ordinal}-a`,
            assumedBasisConsequential: { withdrawal: 201 + ordinal },
          },
          {
            accountId: `mock-employer-${ordinal}-b`,
            ownerPersonId: `mock-owner-${ordinal}-b`,
            assumedBasisConsequential: { withdrawal: 1_201 + ordinal },
          },
        ],
        ownedTraditionalIraAggregateActivity: [
          {
            ownerPersonId: `mock-traditional-${ordinal}-a`,
            assumedBasisConsequential: {
              distributions: 301 + ordinal,
              conversions: 401 + ordinal,
              annuityPayments: 501 + ordinal,
            },
          },
          {
            ownerPersonId: `mock-traditional-${ordinal}-b`,
            assumedBasisConsequential: {
              distributions: 1_301 + ordinal,
              conversions: 1_401 + ordinal,
              annuityPayments: 1_501 + ordinal,
            },
          },
        ],
      }
      seam.phases.push({ input, derived, returned })
      return returned
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'

const TAX_YEAR = 2026

function rothIra(
  id: string,
  balance: number,
): Extract<Account, { type: 'roth' }> {
  return {
    type: 'roth',
    kind: 'ira',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  }
}

function employerRoth(
  id: string,
  balance: number,
): Extract<Account, { type: 'roth' }> {
  return {
    ...rothIra(id, balance),
    kind: 'employer',
  }
}

function cash(balance = 0): Account {
  return {
    type: 'cash',
    id: 'cash',
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: 0,
    balance,
    annualContribution: 0,
  } as Account
}

function ownedRothEvidencePlan(): Plan {
  const value = singlePersonPlan({ dob: '1971-01-01', planningAge: 90 })
  value.id = 'published-facts-delegation-owned-roth'
  value.assumptions.inflationPct = 0
  value.assumptions.defaultReturnPct = 0
  value.expenses.baseAnnual = 60_000
  value.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  value.accounts = [
    { ...rothIra('roth-ira', 100_000), annualContribution: 6_000 },
    cash(),
  ]
  value.incomes = [
    {
      id: 'wages',
      type: 'wages',
      personId: 'p1',
      annualGross: 20_000,
      endAge: null,
    },
  ] as never
  return validatePlan(value)
}

function employerRothEvidencePlan(): Plan {
  const value = singlePersonPlan({ dob: '1971-01-01', planningAge: 90 })
  value.id = 'published-facts-delegation-employer-roth'
  value.assumptions.inflationPct = 0
  value.assumptions.defaultReturnPct = 0
  value.expenses.baseAnnual = 30_000
  value.expenses.healthcare = {
    pre65MonthlyPremiumPerPerson: 0,
    applyAcaCredit: false,
    medicareExtrasMonthlyPerPerson: 0,
  }
  value.accounts = [employerRoth('roth-401k', 100_000), cash()]
  value.incomes = [] as never
  return validatePlan(value)
}

function traditionalIraEvidencePlan(): Plan {
  const value = singlePersonPlan({ dob: '1953-01-01', planningAge: 90 })
  value.id = 'published-facts-delegation-traditional-ira'
  value.assumptions.inflationPct = 0
  value.assumptions.defaultReturnPct = 0
  const account = traditionalAccount('owned-ira', 265_000, 'p1')
  value.accounts = [{ ...account, annualReturnPct: 0 }]
  return validatePlan(value)
}

function runOneYear(value: Plan) {
  seam.phases.length = 0
  const result = simulatePlan(value, {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  expect(result.years).toHaveLength(1)
  expect(seam.phases).toHaveLength(1)
  return { year: result.years[0]!, phase: seam.phases[0]! }
}

function expectDelegatedArrays(
  year: ReturnType<typeof runOneYear>['year'],
  phase: PhaseEvent,
): void {
  expect(year.ownedRothIraPoolActivity).toBe(
    phase.returned.ownedRothIraPoolActivity,
  )
  expect(year.employerRothAccountActivity).toBe(
    phase.returned.employerRothAccountActivity,
  )
  expect(year.ownedTraditionalIraAggregateActivity).toBe(
    phase.returned.ownedTraditionalIraAggregateActivity,
  )
  expect(year.ownedRothIraPoolActivity).toEqual([
    {
      ownerPersonId: 'mock-owned-1-a',
      assumedBasisConsequential: { withdrawal: 102 },
    },
    {
      ownerPersonId: 'mock-owned-1-b',
      assumedBasisConsequential: { withdrawal: 1_002 },
    },
  ])
  expect(year.employerRothAccountActivity).toEqual([
    {
      accountId: 'mock-employer-1-a',
      ownerPersonId: 'mock-owner-1-a',
      assumedBasisConsequential: { withdrawal: 202 },
    },
    {
      accountId: 'mock-employer-1-b',
      ownerPersonId: 'mock-owner-1-b',
      assumedBasisConsequential: { withdrawal: 1_202 },
    },
  ])
  expect(year.ownedTraditionalIraAggregateActivity).toEqual([
    {
      ownerPersonId: 'mock-traditional-1-a',
      assumedBasisConsequential: {
        distributions: 302,
        conversions: 402,
        annuityPayments: 502,
      },
    },
    {
      ownerPersonId: 'mock-traditional-1-b',
      assumedBasisConsequential: {
        distributions: 1_302,
        conversions: 1_402,
        annuityPayments: 1_502,
      },
    },
  ])
}

describe('simulatePlan delegates settled per-entity published facts', () => {
  it('passes consequential owned-Roth evidence and publishes exact helper arrays', () => {
    const value = ownedRothEvidencePlan()
    const { year, phase } = runOneYear(value)

    expect(phase.input.accounts).toBe(value.accounts)
    expect(phase.input.primaryPersonId).toBe('p1')
    expect(
      phase.input.ownedRothAssumedBasisConsequentialByOwner,
    ).toEqual(new Map([['p1', 40_000]]))
    expect(phase.input.employerRothAssumedBasisConsequentialByAccount.size).toBe(0)
    expect(phase.input.form8606ConsequentialByOwner.size).toBe(0)
    expect(phase.derived.ownedRothIraPoolActivity).toEqual([
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: { withdrawal: 40_000 },
      },
    ])
    expectDelegatedArrays(year, phase)
  })

  it('passes consequential employer-Roth evidence and publishes exact helper arrays', () => {
    const value = employerRothEvidencePlan()
    const { year, phase } = runOneYear(value)

    expect(phase.input.accounts).toBe(value.accounts)
    expect(phase.input.primaryPersonId).toBe('p1')
    expect(phase.input.ownedRothAssumedBasisConsequentialByOwner.size).toBe(0)
    expect(
      phase.input.employerRothAssumedBasisConsequentialByAccount,
    ).toEqual(new Map([['roth-401k', 30_000]]))
    expect(phase.input.form8606ConsequentialByOwner.size).toBe(0)
    expect(phase.derived.employerRothAccountActivity).toEqual([
      {
        accountId: 'roth-401k',
        ownerPersonId: 'p1',
        assumedBasisConsequential: { withdrawal: 30_000 },
      },
    ])
    expectDelegatedArrays(year, phase)
  })

  it('passes consequential Form 8606 evidence and publishes exact helper arrays', () => {
    const value = traditionalIraEvidencePlan()
    const { year, phase } = runOneYear(value)

    expect(phase.input.accounts).toBe(value.accounts)
    expect(phase.input.primaryPersonId).toBe('p1')
    expect(phase.input.ownedRothAssumedBasisConsequentialByOwner.size).toBe(0)
    expect(phase.input.employerRothAssumedBasisConsequentialByAccount.size).toBe(0)
    expect(phase.input.form8606ConsequentialByOwner).toEqual(
      new Map([
        [
          'p1',
          { distributions: 10_000, conversions: 0, annuityPayments: 0 },
        ],
      ]),
    )
    expect(phase.derived.ownedTraditionalIraAggregateActivity).toEqual([
      {
        ownerPersonId: 'p1',
        assumedBasisConsequential: {
          distributions: 10_000,
          conversions: 0,
          annuityPayments: 0,
        },
      },
    ])
    expectDelegatedArrays(year, phase)
  })
})
