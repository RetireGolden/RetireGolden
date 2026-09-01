import { describe, expect, it } from 'vitest'

import type { Account, Person } from '../../model/plan.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import {
  ANNUITY_PURCHASE_SHORTFALL_WARNING,
  LATE_NON_QLAC_QUALIFIED_START_WARNING,
  LATE_QLAC_START_WARNING,
  annualAnnuityPurchaseFunding,
  type AnnuityPurchaseFundingBalanceView,
} from './annualAnnuityPurchaseFunding.js'

const YEAR = 2026
const PRIMARY: Person = {
  id: 'p1',
  name: 'Pat',
  dob: '1940-01-01',
  sex: 'average',
  retirementAge: null,
  longevity: { planningAge: 100, source: 'manual' },
}

function annuity(
  id: string,
  premium: number,
  fundingAccountId = 'fund',
  overrides: Record<string, unknown> = {},
): Extract<Account, { type: 'annuity' }> {
  return {
    type: 'annuity',
    id,
    name: id,
    ownerPersonId: PRIMARY.id,
    annualReturnPct: null,
    startAge: 80,
    monthlyAmount: 0,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: YEAR,
      premium,
      fundingAccountId,
      taxQualification: 'nonQualified',
    },
    ...overrides,
  } as Extract<Account, { type: 'annuity' }>
}

function funding(
  type: 'cash' | 'taxable' | 'equityComp' | 'traditional',
  balance: number,
  costBasis = 0,
  id = 'fund',
  extra: Record<string, unknown> = {},
): AnnuityPurchaseFundingBalanceView {
  const account = {
    type,
    id,
    name: id,
    ownerPersonId: PRIMARY.id,
    annualReturnPct: 0,
    balance: 0,
    annualContribution: 0,
    ...(type === 'taxable' || type === 'equityComp' ? { costBasis: 0 } : {}),
    ...(type === 'equityComp'
      ? { vestingMode: 'final', vestDate: null }
      : {}),
    ...(type === 'traditional' ? { kind: 'ira' } : {}),
    ...extra,
  } as AnnuityPurchaseFundingBalanceView['account']
  return { account, balance, costBasis }
}

function call(
  accounts: readonly Account[],
  balances: readonly AnnuityPurchaseFundingBalanceView[],
  overrides: Partial<Parameters<typeof annualAnnuityPurchaseFunding>[0]> = {},
) {
  return annualAnnuityPurchaseFunding({
    accounts,
    balances,
    peopleById: new Map([[PRIMARY.id, PRIMARY]]),
    primaryPerson: PRIMARY,
    year: YEAR,
    qlacPremiumCap: 210_000,
    limitGrowth: 1,
    ...overrides,
  })
}

describe('annualAnnuityPurchaseFunding — positional selection', () => {
  it('returns one row per Plan account and resolves the first duplicate funding id', () => {
    const other = funding('cash', 1).account
    const rows = call(
      [other, annuity('missing', 10, 'missing'), annuity('buy', 40)],
      [funding('cash', 25), funding('cash', 1_000)],
    )

    expect(rows.map((row) => row.kind)).toEqual(['none', 'none', 'purchase'])
    expect(rows.map((row) => row.accountIndex)).toEqual([0, 1, 2])
    const row = rows[2]!
    if (row.kind !== 'purchase') throw new Error('expected purchase')
    expect(row.fundingIndex).toBe(0)
    expect(row.funded).toBe(25)
    expect(row.closingBalance).toBe(0)
  })

  it('threads shared-source cash and taxable basis through Plan order', () => {
    const cashRows = call(
      [annuity('first', 60), annuity('second', 60)],
      [funding('cash', 100)],
    )
    const taxableRows = call(
      [annuity('first', 25), annuity('second', 25)],
      [funding('taxable', 100, 40)],
    )
    const [cashFirst, cashSecond] = cashRows
    const [taxFirst, taxSecond] = taxableRows
    if (
      cashFirst?.kind !== 'purchase' ||
      cashSecond?.kind !== 'purchase' ||
      taxFirst?.kind !== 'purchase' ||
      taxSecond?.kind !== 'purchase'
    ) throw new Error('expected purchases')

    expect([cashFirst.funded, cashSecond.funded]).toEqual([60, 40])
    expect(cashSecond.warnings).toEqual([ANNUITY_PURCHASE_SHORTFALL_WARNING])
    expect(taxFirst.capitalGainOrLossDelta).toBe(15)
    expect(taxFirst.closingCostBasis).toBe(30)
    expect(taxSecond.capitalGainOrLossDelta).toBe(15)
    expect(taxSecond.closingCostBasis).toBe(20)
    expect(taxSecond.closingBalance).toBe(50)
  })
})

describe('annualAnnuityPurchaseFunding — exact arithmetic and warnings', () => {
  it('uses the equity-comp basis ratio and leaves unvested shares untouched', () => {
    const vested = call(
      [annuity('vested', 32)],
      [funding('equityComp', 80, 20)],
    )[0]!
    const unvested = call(
      [annuity('unvested', 32)],
      [funding('equityComp', 80, 20, 'fund', {
        vestingMode: 'cliff',
        vestDate: '2027-01-01',
      })],
    )[0]!
    if (vested.kind !== 'purchase' || unvested.kind !== 'purchase') {
      throw new Error('expected purchases')
    }
    expect(vested.capitalGainOrLossDelta).toBe(24)
    expect(vested.closingCostBasis).toBe(12)
    expect(vested.closingBalance).toBe(48)
    expect(unvested.funded).toBe(0)
    expect(unvested.capitalGainOrLossDelta).toBe(0)
    expect(unvested.closingCostBasis).toBe(20)
    expect(unvested.closingBalance).toBe(80)
  })

  it('preserves the equity-comp basis/gain evaluation association', () => {
    const openingBalance = 0.2
    const openingCostBasis = 0.1
    const funded = 0.1
    const row = call(
      [annuity('equity-fp', funded)],
      [funding('equityComp', openingBalance, openingCostBasis)],
    )[0]!
    if (row.kind !== 'purchase') throw new Error('expected purchase')

    const basisRatio = Math.min(1, openingCostBasis / openingBalance)
    const associatedGain = funded * (1 - basisRatio)
    const regroupedGain = (funded * (openingBalance - openingCostBasis)) /
      openingBalance
    const associatedBasis = Math.max(
      0,
      openingCostBasis - funded * basisRatio,
    )
    const regroupedBasis = Math.max(
      0,
      openingCostBasis - (funded * openingCostBasis) / openingBalance,
    )
    expect(associatedGain).not.toBe(regroupedGain)
    expect(associatedBasis).not.toBe(regroupedBasis)
    expect(row.capitalGainOrLoss).toBe(associatedGain)
    expect(row.capitalGainOrLossDelta).toBe(associatedGain)
    expect(row.closingCostBasis).toBe(associatedBasis)
  })

  it('emits late-start, cap, and shortfall warnings in original order', () => {
    const account = annuity('qlac', 300, 'fund', {
      startAge: 86,
      purchase: {
        year: YEAR,
        premium: 300,
        fundingAccountId: 'fund',
        taxQualification: 'qualified',
        qlac: true,
      },
    })
    const row = call([account], [funding('traditional', 150)], {
      qlacPremiumCap: 100,
      limitGrowth: 2,
    })[0]!
    if (row.kind !== 'purchase') throw new Error('expected purchase')
    expect(row.funded).toBe(150)
    expect(row.warnings).toEqual([
      LATE_QLAC_START_WARNING,
      'A QLAC premium above the $200 cap was reduced to the cap (the excess is not QLAC-eligible).',
      ANNUITY_PURCHASE_SHORTFALL_WARNING,
    ])
  })

  it('uses the primary fallback for the non-QLAC qualified start warning', () => {
    const account = annuity('qualified', 10, 'fund', {
      ownerPersonId: 'missing-owner',
      startAge: 100,
      purchase: {
        year: YEAR,
        premium: 10,
        fundingAccountId: 'fund',
        taxQualification: 'qualified',
      },
    })
    const row = call([account], [funding('traditional', 10)])[0]!
    if (row.kind !== 'purchase') throw new Error('expected purchase')
    expect(row.warnings).toEqual([LATE_NON_QLAC_QUALIFIED_START_WARNING])
  })

  it('gates late-start warnings by qualification and QLAC shape', () => {
    const purchase = (
      taxQualification: 'qualified' | 'nonQualified',
      qlac?: true,
    ) => ({
      year: YEAR,
      premium: 300,
      fundingAccountId: 'fund',
      taxQualification,
      ...(qlac === true ? { qlac: true as const } : {}),
    })
    const rows = call([
      annuity('qualified-qlac-at-age-85', 300, 'fund', {
        startAge: 85,
        purchase: purchase('qualified', true),
      }),
      annuity('nonqualified-qlac-late', 300, 'fund', {
        startAge: 100,
        purchase: purchase('nonQualified', true),
      }),
      annuity('qualified-nonqlac-late', 300, 'fund', {
        startAge: 100,
        purchase: purchase('qualified'),
      }),
      annuity('nonqualified-nonqlac-late', 300, 'fund', {
        startAge: 100,
        purchase: purchase('nonQualified'),
      }),
    ], [funding('traditional', 2_000)], {
      qlacPremiumCap: 100,
      limitGrowth: 2,
    })
    const actual = rows.map((row) => {
      if (row.kind !== 'purchase') throw new Error('expected purchase')
      return row.warnings
    })
    expect(actual).toEqual([
      ['A QLAC premium above the $200 cap was reduced to the cap (the excess is not QLAC-eligible).'],
      ['A QLAC premium above the $200 cap was reduced to the cap (the excess is not QLAC-eligible).'],
      [LATE_NON_QLAC_QUALIFIED_START_WARNING],
      [],
    ])
  })

  it('warns only beyond the shared half-cent tolerance and retains zero rows', () => {
    const within = call(
      [annuity('within', 100 + ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS)],
      [funding('cash', 100)],
    )[0]!
    const short = call(
      [annuity(
        'short',
        100 + ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS + Number.EPSILON * 100,
      )],
      [funding('cash', 100)],
    )[0]!
    const zero = call([annuity('zero', 0)], [funding('cash', 0)])[0]!
    if (
      within.kind !== 'purchase' ||
      short.kind !== 'purchase' ||
      zero.kind !== 'purchase'
    ) throw new Error('expected purchases')
    expect(within.warnings).toEqual([])
    expect(short.warnings).toEqual([ANNUITY_PURCHASE_SHORTFALL_WARNING])
    expect(zero.record.funded).toBe(0)
    expect(zero.debit).toBeNull()
    expect(zero.capitalGainOrLossDelta).toBeNull()
  })
})

describe('annualAnnuityPurchaseFunding — purity and freshness', () => {
  it('mutates no input and retains no state across calls', () => {
    const accounts = [annuity('first', 60), annuity('second', 60)]
    const balances = [funding('taxable', 100, 40)]
    const before = structuredClone({ accounts, balances })
    const first = call(accounts, balances)
    const second = call(accounts, balances)

    expect({ accounts, balances }).toEqual(before)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
    if (first[0]?.kind !== 'purchase' || second[0]?.kind !== 'purchase') {
      throw new Error('expected purchases')
    }
    expect(second[0].record).not.toBe(first[0].record)
    expect(second[0].debit).not.toBe(first[0].debit)
  })
})
