/**
 * Seam guard for the per-entity publication extraction.
 *
 * Byte-for-byte projection equivalence cannot prove that `simulatePlan`
 * actually calls a new pure helper: an orphaned helper beside the old inline
 * block produces the same dump. These checks drive each settled evidence map,
 * require one post-settlement call, and replace the helper result with distinct
 * arrays so YearResult must publish the helper's own objects.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  PublishedEntityFacts,
  PublishedEntityFactsInput,
} from './internal/publishedEntityFacts.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<PublishedEntityFactsInput, PublishedEntityFacts>(),
)

vi.mock('./internal/publishedEntityFacts.js', async (importOriginal) =>
  seam.through(
    await importOriginal<typeof import('./internal/publishedEntityFacts.js')>(),
    'publishedEntityFacts',
    (_natural, { ordinal: index }): PublishedEntityFacts => {
      const ordinal = index + 1
      return {
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
    },
  ),
)

import type { SeamCall } from './simulate.seamGuard.test-support.js'
import {
  expectPublishedFromSeam,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
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
  seam.reset()
  const result = simulatePlan(value, {
    startYear: TAX_YEAR,
    horizonEndYear: TAX_YEAR,
    taxCalculator: createFlatTaxCalculator(0),
  })
  expect(result.years).toHaveLength(1)
  return { year: result.years[0]!, phase: expectSeamRan(seam, 1)[0]! }
}

function expectDelegatedArrays(
  year: ReturnType<typeof runOneYear>['year'],
  phase: SeamCall<PublishedEntityFactsInput, PublishedEntityFacts>,
): void {
  expectPublishedFromSeam(
    year.ownedRothIraPoolActivity,
    phase.injected.ownedRothIraPoolActivity,
    'the owned-Roth pool activity',
  )
  expectPublishedFromSeam(
    year.employerRothAccountActivity,
    phase.injected.employerRothAccountActivity,
    'the employer-Roth account activity',
  )
  expectPublishedFromSeam(
    year.ownedTraditionalIraAggregateActivity,
    phase.injected.ownedTraditionalIraAggregateActivity,
    'the owned traditional-IRA aggregate activity',
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
    expect(phase.natural.ownedRothIraPoolActivity).toEqual([
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
    expect(phase.natural.employerRothAccountActivity).toEqual([
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
    expect(phase.natural.ownedTraditionalIraAggregateActivity).toEqual([
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
