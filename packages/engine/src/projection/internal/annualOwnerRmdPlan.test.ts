import { describe, expect, it } from 'vitest'

import type { Account, Person } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { requiredMinimumDistribution } from '../../rmd/rmd.js'
import { rmdApplicablePlanKey, type RmdApplicablePlan } from '../../rmd/rmdShortfallExcise.js'
import { singlePersonPlan, traditionalAccount } from '../../testing/planFixtures.js'
import type { PersonYearState } from '../types.js'
import {
  annualOwnerRmdPlan,
  type AnnualOwnerRmdPlanInput,
  type OwnerRmdLogicalBalance,
} from './annualOwnerRmdPlan.js'
import { AnnualLogicalBalanceLedger } from './annualLogicalBalanceLedger.js'

const YEAR = 2026
const pack = packForYear(YEAR).pack

function ownedPlan(personId: string): RmdApplicablePlan {
  return { kind: 'ownedTraditionalIras', payeePersonId: personId }
}

function applicablePlanForAccount(
  account: Readonly<Extract<Account, { type: 'traditional' }>>,
): RmdApplicablePlan {
  const owner = account.ownerPersonId ?? 'p1'
  if (account.kind === 'ira') return ownedPlan(owner)
  if (account.employerPlanType === '403b') {
    return { kind: 'aggregable403bPlans', payeePersonId: owner }
  }
  return { kind: 'employerPlan', accountId: account.id }
}

function person(dob: string): Person {
  return {
    ...singlePersonPlan({ dob, planningAge: 100 }).household.people[0]!,
    id: 'p1',
  }
}

function ira(id: string, balance: number): OwnerRmdLogicalBalance {
  const account = traditionalAccount(id, balance)
  account.ownerPersonId = 'p1'
  return { account, balance }
}

function employer(id: string, balance: number): OwnerRmdLogicalBalance {
  const base = traditionalAccount(id, balance)
  if (base.type !== 'traditional') throw new Error('fixture did not create a traditional account')
  return {
    account: {
      ...base,
      kind: 'employer',
      employerPlanType: '401k',
    },
    balance,
  }
}

function call(overrides: Partial<AnnualOwnerRmdPlanInput> = {}) {
  const owner = person('1950-01-01')
  const people = overrides.people ?? [owner]
  const states = new Map<string, PersonYearState>(people.map((value) => [
    value.id,
    { personId: value.id, ageAttained: YEAR - Number(value.dob.slice(0, 4)), alive: true },
  ]))
  return annualOwnerRmdPlan({
    balances: [],
    startOfYearBalance: new Map(),
    people,
    personById: new Map(people.map((value) => [value.id, value])),
    stateOf: (personId) => states.get(personId)!,
    primaryPersonId: 'p1',
    followsOwnerRmdsThisYear: (account) =>
      account.type === 'traditional' && account.inherited === undefined,
    applicablePlanForAccount,
    deferredFirstRmdByApplicablePlan: new Map(),
    firstYearDeferrals: [],
    pack,
    year: YEAR,
    ...overrides,
  })
}

describe('annualOwnerRmdPlan — deferral state machine', () => {
  it('consumes an April 1 amount before the current December 31 requirement and deletes it explicitly', () => {
    const owner = person('1950-01-01')
    const balance = ira('ira', 50_000)
    const applicablePlan = ownedPlan(owner.id)
    const key = rmdApplicablePlanKey(applicablePlan)
    const deferred = new Map([[key, {
      applicablePlan,
      distributionCalendarYear: 2025,
      dueYear: YEAR,
      requiredAmount: 10_000,
    }]])
    const current = requiredMinimumDistribution(
      pack,
      1950,
      76,
      100_000,
      { ownerSex: owner.sex },
    )

    const result = call({
      balances: [balance],
      startOfYearBalance: new Map([['ira', 100_000]]),
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 76, alive: true }),
      deferredFirstRmdByApplicablePlan: deferred,
    })

    expect(result.rmdTakeByAccount.get('ira')).toBe(10_000 + current)
    expect(result.rmdShortfallObligations).toHaveLength(2)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      distributionCalendarYear: 2025,
      taxImposedOn: '2026-04-01',
      requiredAmount: 10_000,
      distributedByDeadline: 10_000,
    })
    expect(result.rmdShortfallObligations[1]).toMatchObject({
      distributionCalendarYear: 2026,
      taxImposedOn: '2026-12-31',
      requiredAmount: current,
      distributedByDeadline: current,
    })
    expect(result.deferredFirstRmdOperations).toEqual([
      { kind: 'delete', applicablePlanKey: key },
    ])
    expect([...deferred]).toHaveLength(1)
  })

  it('returns ordered cumulative set operations for first-year accounts sharing an applicable plan', () => {
    const owner = person('1953-01-01')
    const balances = [
      ira('first', 265_000_000_000_000_000),
      ira('second', 26.5),
      ira('third', 26.5),
    ]
    const applicablePlan = ownedPlan(owner.id)
    const key = rmdApplicablePlanKey(applicablePlan)
    const firstRmd = requiredMinimumDistribution(
      pack,
      1953,
      73,
      265_000_000_000_000_000,
      { ownerSex: owner.sex },
    )
    const secondRmd = requiredMinimumDistribution(pack, 1953, 73, 26.5, {
      ownerSex: owner.sex,
    })
    const thirdRmd = secondRmd
    const leftAssociated = (firstRmd + secondRmd) + thirdRmd
    const regrouped = firstRmd + (secondRmd + thirdRmd)
    expect(leftAssociated).not.toBe(regrouped)

    const result = call({
      balances,
      startOfYearBalance: new Map([
        ['first', 265_000_000_000_000_000],
        ['second', 26.5],
        ['third', 26.5],
      ]),
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 73, alive: true }),
      firstYearDeferrals: [{ distributionCalendarYear: YEAR, applicablePlan }],
    })

    expect([...result.rmdTakeByAccount]).toEqual([])
    expect(result.deferredFirstRmdOperations).toEqual([
      {
        kind: 'set',
        applicablePlanKey: key,
        value: {
          applicablePlan,
          distributionCalendarYear: YEAR,
          dueYear: YEAR + 1,
          requiredAmount: firstRmd,
        },
      },
      {
        kind: 'set',
        applicablePlanKey: key,
        value: {
          applicablePlan,
          distributionCalendarYear: YEAR,
          dueYear: YEAR + 1,
          requiredAmount: firstRmd + secondRmd,
        },
      },
      {
        kind: 'set',
        applicablePlanKey: key,
        value: {
          applicablePlan,
          distributionCalendarYear: YEAR,
          dueYear: YEAR + 1,
          requiredAmount: leftAssociated,
        },
      },
    ])
    expect(result.iraRmdRequiredByOwner.get(owner.id)).toBe(leftAssociated)
    expect(result.iraRmdUnsatisfiedByOwner.get(owner.id)).toBe(leftAssociated)
    expect(result.rmdShortfallObligations).toEqual([])
  })

  it('orders a same-key due deletion before reinsertion and preserves both plan identities', () => {
    const owner = person('1953-01-01')
    const deferredPlan = ownedPlan(owner.id)
    const currentPlan = ownedPlan(owner.id)
    const key = rmdApplicablePlanKey(currentPlan)
    const untouchedPlan = { kind: 'employerPlan' as const, accountId: 'untouched' }
    const untouchedKey = rmdApplicablePlanKey(untouchedPlan)
    const deferredValue = {
      applicablePlan: deferredPlan,
      distributionCalendarYear: YEAR - 1,
      dueYear: YEAR,
      requiredAmount: 1,
    }
    const untouchedValue = {
      applicablePlan: untouchedPlan,
      distributionCalendarYear: YEAR,
      dueYear: YEAR + 1,
      requiredAmount: 2,
    }
    const deferred = new Map([
      [key, deferredValue],
      [untouchedKey, untouchedValue],
    ])
    const openingBalance = 26_500
    const currentRmd = requiredMinimumDistribution(pack, 1953, 73, openingBalance, {
      ownerSex: owner.sex,
    })

    const result = call({
      balances: [ira('ira', 10_000)],
      startOfYearBalance: new Map([['ira', openingBalance]]),
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 73, alive: true }),
      applicablePlanForAccount: () => currentPlan,
      deferredFirstRmdByApplicablePlan: deferred,
      firstYearDeferrals: [{ distributionCalendarYear: YEAR, applicablePlan: currentPlan }],
    })

    expect(result.rmdShortfallObligations[0]!.applicablePlan).toBe(deferredPlan)
    expect(result.deferredFirstRmdOperations).toHaveLength(2)
    expect(result.deferredFirstRmdOperations[0]).toEqual({
      kind: 'delete',
      applicablePlanKey: key,
    })
    const setOperation = result.deferredFirstRmdOperations[1]!
    expect(setOperation).toMatchObject({
      kind: 'set',
      applicablePlanKey: key,
      value: {
        distributionCalendarYear: YEAR,
        dueYear: YEAR + 1,
        requiredAmount: currentRmd,
      },
    })
    if (setOperation.kind !== 'set') throw new Error('expected a set operation')
    expect(setOperation.value.applicablePlan).toBe(currentPlan)

    const applied = new Map(deferred)
    for (const operation of result.deferredFirstRmdOperations) {
      if (operation.kind === 'delete') applied.delete(operation.applicablePlanKey)
      else applied.set(operation.applicablePlanKey, operation.value)
    }
    expect([...applied.keys()]).toEqual([untouchedKey, key])
    expect(applied.get(key)).toBe(setOperation.value)
    expect([...deferred]).toEqual([
      [key, deferredValue],
      [untouchedKey, untouchedValue],
    ])
  })
})

describe('annualOwnerRmdPlan — aggregation and ordering', () => {
  it('plans one 12,000 logical RMD and the live proxy allocates 10,000 + 2,000 physically', () => {
    const owner = person('1953-01-01')
    const first = ira('duplicate', 265_000)
    const selected = ira('duplicate', 53_000)
    const firstAccount = first.account
    const selectedAccount = selected.account
    if (firstAccount.type !== 'traditional' || selectedAccount.type !== 'traditional') {
      throw new Error('fixture did not create traditional accounts')
    }
    const physical = [
      { account: firstAccount, balance: first.balance, costBasis: 0 },
      { account: selectedAccount, balance: selected.balance, costBasis: 0 },
    ]
    const ledger = new AnnualLogicalBalanceLedger(physical)
    const logical = ledger.liveStates()

    const result = call({
      balances: logical,
      startOfYearBalance: new Map([['duplicate', 318_000]]),
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 73, alive: true }),
    })

    // Pub. 590-B Uniform Lifetime Table divisor at age 73 is 26.5.
    expect(result.rmdTakeByAccount.get('duplicate')).toBe(318_000 / 26.5)
    logical[0]!.balance -= result.rmdTakeByAccount.get('duplicate')!
    expect(physical.map((state) => state.balance)).toEqual([255_000, 51_000])
  })

  it('sweeps an empty owned IRA requirement into the next IRA in plan order', () => {
    const owner = person('1950-01-01')
    const firstRmd = requiredMinimumDistribution(pack, 1950, 76, 100_000, { ownerSex: owner.sex })
    const secondRmd = requiredMinimumDistribution(pack, 1950, 76, 100_000, { ownerSex: owner.sex })
    const result = call({
      balances: [ira('empty', 0), ira('funded', 200_000)],
      startOfYearBalance: new Map([['empty', 100_000], ['funded', 100_000]]),
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 76, alive: true }),
    })

    expect([...result.rmdTakeByAccount]).toEqual([
      ['funded', secondRmd + firstRmd],
    ])
    expect(result.iraRmdRequiredByOwner.get(owner.id)).toBe(firstRmd + secondRmd)
    expect(result.iraRmdUnsatisfiedByOwner.has(owner.id)).toBe(false)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      requiredAmount: firstRmd + secondRmd,
      distributedByDeadline: firstRmd + secondRmd,
    })
  })

  it('keeps an employer-plan shortfall account-specific and reports it', () => {
    const owner = person('1950-01-01')
    const required = requiredMinimumDistribution(pack, 1950, 76, 100_000, { ownerSex: owner.sex })
    const applicablePlan = { kind: 'employerPlan' as const, accountId: 'plan' }
    const result = call({
      balances: [employer('plan', 1_000), employer('other', 100_000)],
      startOfYearBalance: new Map([['plan', 100_000], ['other', 100_000]]),
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 76, alive: true }),
      applicablePlanForAccount: (account) => account.id === 'plan'
        ? applicablePlan
        : { kind: 'employerPlan', accountId: account.id },
    })

    expect(result.rmdTakeByAccount.get('plan')).toBe(1_000)
    expect(result.rmdTakeByAccount.get('other')).toBe(required)
    expect(result.rmdShortfallObligations[0]).toMatchObject({
      applicablePlan: { kind: 'employerPlan', accountId: 'plan' },
      requiredAmount: required,
      distributedByDeadline: 1_000,
    })
    expect(result.rmdShortfallObligations[0]!.applicablePlan).toBe(applicablePlan)
    expect(result.applicablePlanByKey.get(rmdApplicablePlanKey(applicablePlan)))
      .toBe(applicablePlan)
    expect(result.iraRmdRequiredByOwner.size).toBe(0)
  })
})

describe('annualOwnerRmdPlan — purity and freshness', () => {
  it('rejects physical rows that repeat a logical account id', () => {
    expect(() => call({
      balances: [ira('duplicate', 265_000), ira('duplicate', 53_000)],
      startOfYearBalance: new Map([['duplicate', 318_000]]),
    })).toThrow('annual owner-RMD input repeated logical account id "duplicate"')
  })

  it('does not mutate inputs and returns fresh containers on every call', () => {
    const owner = person('1950-01-01')
    const balances = [ira('ira', 100_000)]
    const startOfYearBalance = new Map([['ira', 100_000]])
    const deferred = new Map<string, never>()
    const input = {
      balances,
      startOfYearBalance,
      people: [owner],
      personById: new Map([[owner.id, owner]]),
      stateOf: () => ({ personId: owner.id, ageAttained: 76, alive: true }),
      deferredFirstRmdByApplicablePlan: deferred,
    }

    const first = call(input)
    const second = call(input)

    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.rmdTakeByAccount).not.toBe(first.rmdTakeByAccount)
    expect(second.rmdShortfallObligations).not.toBe(first.rmdShortfallObligations)
    expect(balances[0]!.balance).toBe(100_000)
    expect([...startOfYearBalance]).toEqual([['ira', 100_000]])
    expect([...deferred]).toEqual([])
  })
})
