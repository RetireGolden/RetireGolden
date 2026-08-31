import { describe, expect, it } from 'vitest'

import {
  DEFAULT_ASSET_CLASS_PARAMS,
  type AssetClassParams,
} from '../../allocation/assetClasses.js'
import type { Account, AssetClassId } from '../../model/plan.js'
import {
  distributedTaxableYieldRows,
  type DistributedTaxableYieldInput,
  type DistributedTaxableYieldState,
} from './distributedTaxableYieldRows.js'

const params = (): Record<AssetClassId, AssetClassParams> => ({
  usStocks: { ...DEFAULT_ASSET_CLASS_PARAMS.usStocks },
  intlStocks: { ...DEFAULT_ASSET_CLASS_PARAMS.intlStocks },
  bonds: { ...DEFAULT_ASSET_CLASS_PARAMS.bonds },
  cash: { ...DEFAULT_ASSET_CLASS_PARAMS.cash },
})

function taxable(
  id: string,
  over: Partial<Extract<Account, { type: 'taxable' }>> = {},
): Extract<Account, { type: 'taxable' }> {
  return {
    id,
    name: id,
    type: 'taxable',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 100_000,
    costBasis: 50_000,
    annualContribution: 0,
    ...over,
  }
}

function cash(id: string): Extract<Account, { type: 'cash' }> {
  return {
    id,
    name: id,
    type: 'cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 10_000,
    annualContribution: 0,
  }
}

const state = (account: Account, balance = 'balance' in account ? account.balance : 0): DistributedTaxableYieldState => ({
  account,
  balance,
})

function input(over: Partial<DistributedTaxableYieldInput> = {}): DistributedTaxableYieldInput {
  return {
    states: [state(taxable('brokerage', { interestYieldPct: 2, dividendYieldPct: 3 }))],
    startOfYearBalance: new Map([['brokerage', 200_000]]),
    allocationTrack: new Map(),
    classParams: params(),
    ...over,
  }
}

describe('distributedTaxableYieldRows — selection and positional contract', () => {
  it('returns exactly one row per state, in balance order', () => {
    const rows = distributedTaxableYieldRows(input({
      states: [
        state(cash('cash')),
        state(taxable('yielding', { interestYieldPct: 1 })),
        state(taxable('zero')),
      ],
      startOfYearBalance: new Map([['yielding', 100], ['zero', 100]]),
    }))

    expect(rows).toHaveLength(3)
    expect(rows.map((row) => row.kind)).toEqual(['none', 'yield', 'none'])
    expect(rows[1]?.kind === 'yield' ? rows[1].accountId : null).toBe('yielding')
  })

  it('uses the start-of-year map when present, falls back only when absent, and floors negative openings', () => {
    const accounts = [
      taxable('mapped-zero', { interestYieldPct: 10 }),
      taxable('fallback', { interestYieldPct: 10 }),
      taxable('mapped-negative', { interestYieldPct: 10 }),
    ]
    const rows = distributedTaxableYieldRows(input({
      states: [state(accounts[0]!, 700), state(accounts[1]!, 700), state(accounts[2]!, 700)],
      startOfYearBalance: new Map([['mapped-zero', 0], ['mapped-negative', -1]]),
    }))

    expect(rows.map((row) => row.kind)).toEqual(['none', 'yield', 'none'])
    const fallback = rows[1]
    if (fallback?.kind !== 'yield') throw new Error('expected fallback yield row')
    expect(fallback.interest).toBe(70)
  })

  it('keeps duplicate account ids as separate positional rows while both maps stay last-wins', () => {
    const first = taxable('dup', { interestYieldPct: 1, dividendYieldPct: 0 })
    const second = taxable('dup', { interestYieldPct: 2, dividendYieldPct: 0 })
    const rows = distributedTaxableYieldRows(input({
      states: [state(first, 10), state(second, 20)],
      startOfYearBalance: new Map([['dup', 1_000]]),
      allocationTrack: new Map([
        ['dup', { weights: [0, 0, 1, 0] }],
        ['dup', { weights: [1, 0, 0, 0] }],
      ]),
    }))

    expect(rows).toHaveLength(2)
    expect(rows.map((row) => row.kind === 'yield' ? [row.accountId, row.interest] : null)).toEqual([
      ['dup', 10],
      ['dup', 20],
    ])
  })

  it('uses the one last-wins allocation-track value for every duplicate state sharing its id', () => {
    const classParams = params()
    classParams.usStocks = { ...classParams.usStocks, interestYieldPct: 1, dividendYieldPct: 0 }
    classParams.bonds = { ...classParams.bonds, interestYieldPct: 7, dividendYieldPct: 0 }
    const rows = distributedTaxableYieldRows(input({
      states: [state(taxable('dup')), state(taxable('dup'))],
      startOfYearBalance: new Map([['dup', 1_000]]),
      // allocationTrack is already a last-wins map by the time the helper
      // receives it. A second dead Map-constructor entry would not exercise
      // helper behavior; the duplicate *states* below do.
      allocationTrack: new Map([['dup', { weights: [1, 0, 0, 0] }]]),
      classParams,
    }))

    expect(rows.map((row) => row.kind === 'yield' ? row.interest : null)).toEqual([10, 10])
  })
})

describe('distributedTaxableYieldRows — yield sources and defaults', () => {
  it('derives taxable interest, dividends, and qualified share from the allocation blend', () => {
    const classParams = params()
    classParams.usStocks = { ...classParams.usStocks, interestYieldPct: 0.25, dividendYieldPct: 2.5, qualifiedRatioPct: 80 }
    classParams.bonds = { ...classParams.bonds, interestYieldPct: 4.75, dividendYieldPct: 0.5, qualifiedRatioPct: 20 }
    const [row] = distributedTaxableYieldRows(input({
      states: [state(taxable('allocated'))],
      startOfYearBalance: new Map([['allocated', 12_345.67]]),
      allocationTrack: new Map([['allocated', { weights: [0.3, 0, 0.7, 0] }]]),
      classParams,
    }))
    if (row?.kind !== 'yield') throw new Error('expected yield row')

    const interestPct = 0.3 * 0.25 + 0.7 * 4.75
    const dividendPct = 0.3 * 2.5 + 0.7 * 0.5
    const dividendQualifiedNumerator = 0.3 * 2.5 * 0.8 + 0.7 * 0.5 * 0.2
    const qualifiedRatio = dividendQualifiedNumerator / dividendPct
    const interest = 12_345.67 * (interestPct / 100)
    const dividends = 12_345.67 * (dividendPct / 100)

    expect(row.interest).toBe(interest)
    expect(row.qualified).toBe(dividends * qualifiedRatio)
    expect(row.ordinaryDividends).toBe(dividends - row.qualified)
    expect(row.distributedYieldPct).toBe(interestPct + dividendPct)
  })

  it('lets explicit zeroes override a nonzero blend and never derives tax-exempt yield', () => {
    const [row] = distributedTaxableYieldRows(input({
      states: [state(taxable('muni', {
        interestYieldPct: 0,
        dividendYieldPct: 0,
        taxExemptInterestYieldPct: 3.125,
      }))],
      startOfYearBalance: new Map([['muni', 8_000]]),
      allocationTrack: new Map([['muni', { weights: [0, 0, 1, 0] }]]),
    }))
    if (row?.kind !== 'yield') throw new Error('expected yield row')

    expect(row.interest).toBe(0)
    expect(row.taxableGross).toBe(0)
    expect(row.exempt).toBe(250)
    expect(row.gross).toBe(250)
    expect(row.distributedYieldPct).toBe(3.125)
  })

  it('uses 0.85 as the unallocated qualified-ratio default and reinvests by default', () => {
    const [row] = distributedTaxableYieldRows(input({
      states: [state(taxable('plain', { dividendYieldPct: 4 }))],
      startOfYearBalance: new Map([['plain', 1_000]]),
    }))
    if (row?.kind !== 'yield') throw new Error('expected yield row')

    expect(row.qualified).toBe(34)
    expect(row.ordinaryDividends).toBe(6)
    expect(row.reinvest).toBe(true)
  })

  it('honors reinvest false and clamps unparsed negative yields and qualified ratios', () => {
    const malformed = taxable('malformed', {
      interestYieldPct: -2,
      dividendYieldPct: 4,
      taxExemptInterestYieldPct: -3,
      qualifiedRatio: 5,
      reinvestDividends: false,
    })
    const [row] = distributedTaxableYieldRows(input({
      states: [state(malformed)],
      startOfYearBalance: new Map([['malformed', 1_000]]),
    }))
    if (row?.kind !== 'yield') throw new Error('expected yield row')

    expect(row.interest).toBe(0)
    expect(row.exempt).toBe(0)
    expect(row.qualified).toBe(40)
    expect(row.ordinaryDividends).toBe(0)
    expect(row.reinvest).toBe(false)

    const [negativeRatio] = distributedTaxableYieldRows(input({
      states: [state(taxable('negative-ratio', { dividendYieldPct: 4, qualifiedRatio: -2 }))],
      startOfYearBalance: new Map([['negative-ratio', 1_000]]),
    }))
    if (negativeRatio?.kind !== 'yield') throw new Error('expected yield row')
    expect(negativeRatio.qualified).toBe(0)
    expect(negativeRatio.ordinaryDividends).toBe(40)
  })
})

describe('distributedTaxableYieldRows — exact arithmetic, records, and purity', () => {
  it('keeps the original operand order for fractional values', () => {
    const opening = Number('9007199254740.991')
    const interestPct = 0.123456789012345
    const dividendPct = 0.987654321098765
    const exemptPct = 0.222222222222222
    const ratio = 0.3141592653589793
    const [row] = distributedTaxableYieldRows(input({
      states: [state(taxable('fractional', {
        interestYieldPct: interestPct,
        dividendYieldPct: dividendPct,
        taxExemptInterestYieldPct: exemptPct,
        qualifiedRatio: ratio,
      }))],
      startOfYearBalance: new Map([['fractional', opening]]),
    }))
    if (row?.kind !== 'yield') throw new Error('expected yield row')

    const interest = opening * (interestPct / 100)
    const dividends = opening * (dividendPct / 100)
    const exempt = opening * (exemptPct / 100)
    const qualified = dividends * Math.min(1, Math.max(0, ratio))
    const taxableGross = interest + dividends
    expect(row.interest).toBe(interest)
    expect(row.ordinaryDividends).toBe(dividends - qualified)
    expect(row.qualified).toBe(qualified)
    expect(row.taxableGross).toBe(taxableGross)
    expect(row.gross).toBe(taxableGross + exempt)
    expect(row.distributedYieldPct).toBe((interestPct + dividendPct) + exemptPct)
  })

  it('builds one record from the exact row scalars and returns fresh identities per call', () => {
    const first = distributedTaxableYieldRows(input())
    const second = distributedTaxableYieldRows(input())
    const firstRow = first[0]
    const secondRow = second[0]
    if (firstRow?.kind !== 'yield' || secondRow?.kind !== 'yield') throw new Error('expected yield rows')

    expect(first).not.toBe(second)
    expect(firstRow).not.toBe(secondRow)
    expect(firstRow.record).not.toBe(secondRow.record)
    expect(firstRow.record).toEqual({
      accountId: firstRow.accountId,
      taxableGross: firstRow.taxableGross,
      interest: firstRow.interest,
      ordinaryDividends: firstRow.ordinaryDividends,
      qualified: firstRow.qualified,
      exempt: firstRow.exempt,
      reinvest: firstRow.reinvest,
    })
  })

  it('does not mutate states, map entries, weights, or class parameters', () => {
    const account = taxable('immutable')
    const weights = [0.5, 0, 0.5, 0]
    const classParams = params()
    const states = [state(account, 321)]
    const startOfYearBalance = new Map([['immutable', 654]])
    const allocationTrack = new Map([['immutable', { weights }]])
    const before = JSON.stringify({ states, weights, classParams })

    distributedTaxableYieldRows({ states, startOfYearBalance, allocationTrack, classParams })

    expect(JSON.stringify({ states, weights, classParams })).toBe(before)
    expect(startOfYearBalance.get('immutable')).toBe(654)
    expect(allocationTrack.get('immutable')?.weights).toBe(weights)
  })
})
