/**
 * Characterization contract for the extracted annual SEPP phase.
 *
 * Statutory amount formulas remain covered by `strategies/sepp.test.ts` and
 * projection oracle fixtures. These tests pin the extraction hazards: exact
 * operation order, cache timing, identity normalization, duplicate-id map
 * behavior, annual separation proxy, and the static Form 8606 aggregation gate.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { packForYear } from '../../params/index.js'
import { seppAnnualAmount } from '../../strategies/sepp.js'
import {
  annualSeppDistributions,
  type AnnualSeppBalanceView,
  type AnnualSeppDistributionsInput,
  type AnnualSeppDistribution,
} from './annualSeppDistributions.js'

const YEAR = 2026
const { pack } = packForYear(YEAR)

function traditional(
  id: string,
  overrides: Record<string, unknown> = {},
): Extract<Account, { type: 'traditional' }> {
  return {
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'owner',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 500_000,
    annualContribution: 0,
    sepp: { startAge: 55, method: 'amortization' },
    ...overrides,
  } as Extract<Account, { type: 'traditional' }>
}

const balance = (
  account: Extract<Account, { type: 'traditional' }>,
  amount = account.balance,
): AnnualSeppBalanceView => ({ account, balance: amount })

function call(
  balances: readonly AnnualSeppBalanceView[],
  overrides: Partial<AnnualSeppDistributionsInput> = {},
) {
  return annualSeppDistributions({
    balances,
    year: YEAR,
    primaryPersonId: 'primary',
    resolveOwnerState: () => ({ alive: true, ageAttained: 56 }),
    resolveOwnerRetirementAge: () => 55,
    startOfYearBalance: new Map(balances.map((row) => [row.account.id, row.balance])),
    amortizationAmountByAccountId: new Map(),
    pack,
    ...overrides,
  })
}

const distributions = (
  result: ReturnType<typeof annualSeppDistributions>,
): readonly AnnualSeppDistribution[] => result.operations.filter(
  (operation): operation is AnnualSeppDistribution => operation.kind === 'distribution',
)

describe('annualSeppDistributions — guards and identities', () => {
  it('skips non-traditional, missing election, dead owner, inactive series, and nonpositive balances', () => {
    const noElection = traditional('no-election', { sepp: undefined })
    const zero = traditional('zero')
    expect(call([
      {
        account: {
          type: 'cash', id: 'cash', name: 'cash', ownerPersonId: null,
          annualReturnPct: 0, balance: 1, annualContribution: 0,
        },
        balance: 1,
      },
      balance(noElection),
      balance(zero, 0),
    ]).total).toBe(0)

    expect(call([balance(traditional('dead'))], {
      resolveOwnerState: () => ({ alive: false, ageAttained: 56 }),
    }).total).toBe(0)
    expect(call([balance(traditional('inactive', {
      sepp: { startAge: 57, method: 'rmd' },
    }))]).total).toBe(0)
  })

  it('keeps raw Plan identity separate from the primary-normalized character owner', () => {
    const row = distributions(call([
      balance(traditional('unowned', { ownerPersonId: null })),
    ]))[0]!
    expect(row.ownerPersonId).toBeNull()
    expect(row.characterOwnerPersonId).toBe('primary')
    expect(row.recordsOwnedIraApplication).toBe(true)
    expect(row.defersIraCharacter).toBe(true)
  })

  it('allows a post-election spouse account to pay while retaining the static inherited-IRA character gate', () => {
    const inherited = traditional('inherited', {
      ownerPersonId: 'owner',
      sepp: { startAge: 56, method: 'rmd' },
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1970,
          soleBeneficiary: true,
          ownerBirthYear: 1945,
          election: 'treat-as-own',
          spouseUnlimitedWithdrawalRight: true,
          treatAsOwnElectionYear: 2028,
          provenance: { source: 'test', asOf: '2026-01-01' },
        },
      },
    })
    const before = call([balance(inherited)], {
      year: 2027,
      resolveOwnerState: () => ({ alive: true, ageAttained: 57 }),
    })
    expect(before.total).toBe(0)

    const after = distributions(call([balance(inherited)], {
      year: 2028,
      resolveOwnerState: () => ({ alive: true, ageAttained: 58 }),
    }))[0]!
    expect(after.take).toBeGreaterThan(0)
    // `isAggregatedIra`, intentionally not the year-aware owner-RMD gate.
    expect(after.recordsOwnedIraApplication).toBe(false)
    expect(after.defersIraCharacter).toBe(false)
  })
})

describe('annualSeppDistributions — amortization cache', () => {
  it('initializes a series using the owner current age, not the election start age', () => {
    const account = traditional('amort', {
      sepp: { startAge: 55, method: 'amortization' },
    })
    const result = call([balance(account)], {
      resolveOwnerState: () => ({ alive: true, ageAttained: 56 }),
      startOfYearBalance: new Map([['amort', 500_000]]),
    })
    const write = result.operations[0]!
    expect(write.kind).toBe('amortizationCacheWrite')
    if (write.kind !== 'amortizationCacheWrite') throw new Error('fixture drift')
    expect(write.amount).toBe(seppAnnualAmount(pack, 'amortization', 500_000, 56))
    expect(write.amount).not.toBe(seppAnnualAmount(pack, 'amortization', 500_000, 55))
  })

  it('publishes a cache write before suppressing a sub-cent distribution', () => {
    const cache = new Map<string, number>()
    const result = call([balance(traditional('dust'), 0.004)], {
      startOfYearBalance: new Map([['dust', 500_000]]),
      amortizationAmountByAccountId: cache,
    })
    expect(result.operations.map((operation) => operation.kind)).toEqual([
      'amortizationCacheWrite',
    ])
    expect(result.total).toBe(0)
    expect(cache.size).toBe(0)
  })

  it('makes a duplicate id observe the first row’s pending cache write', () => {
    const first = balance(traditional('same'), 0.004)
    const second = balance(traditional('same'), 500_000)
    const result = call([first, second], {
      startOfYearBalance: new Map([['same', 300_000]]),
    })
    expect(result.operations.map((operation) => operation.kind)).toEqual([
      'amortizationCacheWrite',
      'distribution',
    ])
    const [row] = distributions(result)
    expect(row!.balanceIndex).toBe(1)
    expect(row!.take).toBe(seppAnnualAmount(pack, 'amortization', 300_000, 56))
  })
})

describe('annualSeppDistributions — RMD-method opening balance', () => {
  it('sizes from the account-id opening map, not the larger live balance', () => {
    const account = traditional('rmd-opening', {
      sepp: { startAge: 56, method: 'rmd' },
    })
    const liveBalance = 600_000
    const openingBalance = 306_000
    const row = distributions(call([balance(account, liveBalance)], {
      startOfYearBalance: new Map([['rmd-opening', openingBalance]]),
    }))[0]!
    const expected = seppAnnualAmount(pack, 'rmd', openingBalance, 56)
    expect(row.take).toBe(expected)
    expect(row.take).toBeLessThan(liveBalance)
    expect(row.take).not.toBe(seppAnnualAmount(pack, 'rmd', liveBalance, 56))
    expect(row.sourceBalanceBefore).toBe(liveBalance)
    expect(row.sourceBalanceAfter).toBe(liveBalance - expected)
  })
})

describe('annualSeppDistributions — annual separation and numeric order', () => {
  it('uses Math.ceil for the first separated year of a fractional retirement age', () => {
    const employer = traditional('plan', {
      kind: 'employer',
      sepp: { startAge: 57, method: 'rmd' },
    })
    const refusedLastWageYear = call([balance(employer)], {
      year: 2027,
      resolveOwnerState: () => ({ alive: true, ageAttained: 57 }),
      resolveOwnerRetirementAge: () => 57.5,
    })
    expect(refusedLastWageYear.total).toBe(0)

    const firstSeparatedYearEmployer = traditional('first-separated-year-plan', {
      kind: 'employer',
      sepp: { startAge: 58, method: 'rmd' },
    })
    const acceptedFirstSeparatedYear = call([balance(firstSeparatedYearEmployer)], {
      year: 2028,
      resolveOwnerState: () => ({ alive: true, ageAttained: 58 }),
      resolveOwnerRetirementAge: () => 57.5,
    })
    const acceptedRow = distributions(acceptedFirstSeparatedYear)[0]!
    const expected = seppAnnualAmount(
      pack,
      'rmd',
      firstSeparatedYearEmployer.balance,
      58,
    )
    expect(acceptedRow.take).toBe(expected)
    expect(acceptedFirstSeparatedYear.total).toBe(expected)
  })

  it('preserves row order and the exact left-to-right total fold', () => {
    const rows = [
      balance(traditional('huge'), 1e13),
      balance(traditional('small-a'), 0.011),
      balance(traditional('small-b'), 0.011),
    ]
    const fixed = new Map([
      ['huge', 1e13],
      ['small-a', 0.011],
      ['small-b', 0.011],
    ])
    const result = call(rows, { amortizationAmountByAccountId: fixed })
    expect(distributions(result).map((row) => row.accountId)).toEqual([
      'huge', 'small-a', 'small-b',
    ])
    let exact = 0
    for (const amount of [1e13, 0.011, 0.011]) exact += amount
    expect(result.total).toBe(exact)
    expect(result.total).not.toBe(1e13 + (0.011 + 0.011))
  })

  it('mutates neither balances nor either map and holds no state between calls', () => {
    const rows = [balance(traditional('pure'), 500_000)]
    const starts = new Map([['pure', 500_000]])
    const cache = new Map<string, number>()
    const input = { startOfYearBalance: starts, amortizationAmountByAccountId: cache }
    const first = call(rows, input)
    const second = call(rows, input)
    expect(second).toEqual(first)
    expect(rows[0]!.balance).toBe(500_000)
    expect([...starts]).toEqual([['pure', 500_000]])
    expect(cache.size).toBe(0)
  })
})
