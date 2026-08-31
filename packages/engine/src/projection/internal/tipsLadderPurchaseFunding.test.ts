import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS } from '../moneyTolerance.js'
import {
  TIPS_LADDER_PURCHASE_SHORTFALL_WARNING,
  tipsLadderPurchaseFunding,
  type TipsLadderPurchaseFundingBalanceView,
  type TipsLadderPurchaseStateView,
} from './tipsLadderPurchaseFunding.js'

const YEAR = 2026

const ladder = (
  id: string,
  costReal: number,
  fundingAccountId = 'fund',
  year = YEAR,
): TipsLadderPurchaseStateView => ({
  id,
  costReal,
  purchase: { year, fundingAccountId },
})

const noPurchase = (id: string, costReal = 10): TipsLadderPurchaseStateView => ({
  id,
  costReal,
  purchase: undefined,
})

const account = (
  type: 'cash' | 'taxable' | 'equityComp' | 'traditional',
  id = 'fund',
  extra: Record<string, unknown> = {},
): Extract<Account, { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' }> => ({
  type,
  id,
  name: id,
  ownerPersonId: null,
  annualReturnPct: 0,
  balance: 0,
  annualContribution: 0,
  ...(type === 'taxable' || type === 'equityComp' ? { costBasis: 0 } : {}),
  ...(type === 'equityComp' ? { vestingMode: 'final', vestDate: null } : {}),
  ...(type === 'traditional' ? { kind: 'ira' } : {}),
  ...extra,
}) as Extract<Account, { type: 'cash' | 'taxable' | 'equityComp' | 'traditional' }>

const balance = (
  type: 'cash' | 'taxable' | 'equityComp' | 'traditional',
  openingBalance: number,
  costBasis = 0,
  id = 'fund',
  extra: Record<string, unknown> = {},
): TipsLadderPurchaseFundingBalanceView => ({
  account: account(type, id, extra),
  balance: openingBalance,
  costBasis,
})

const call = (
  ladderStates: readonly TipsLadderPurchaseStateView[],
  balances: readonly TipsLadderPurchaseFundingBalanceView[],
  inflFactor = 1,
) => tipsLadderPurchaseFunding({ ladderStates, balances, year: YEAR, inflFactor })

describe('tipsLadderPurchaseFunding — selection and identity', () => {
  it('returns one position-keyed row per ladder in input order', () => {
    const rows = call(
      [noPurchase('same'), ladder('same', 10, 'missing'), ladder('same', 10, 'fund'), ladder('same', 10, 'fund', YEAR + 1)],
      [balance('cash', 100)],
    )
    expect(rows.map((row) => row.kind)).toEqual(['none', 'none', 'purchase', 'none'])
    expect(rows.map((row) => row.ladderIndex)).toEqual([0, 1, 2, 3])
    const purchase = rows[2]!
    if (purchase.kind !== 'purchase') throw new Error('expected purchase')
    expect(purchase.record.ladderId).toBe('same')
  })

  it('resolves a duplicate funding id to the first balance position', () => {
    const [row] = call([ladder('lad', 40)], [balance('cash', 25), balance('cash', 1_000)])
    if (row?.kind !== 'purchase') throw new Error('expected purchase')
    expect(row.fundingIndex).toBe(0)
    expect(row.funded).toBe(25)
    expect(row.closingBalance).toBe(0)
  })
})

describe('tipsLadderPurchaseFunding — ordered shared-source planning', () => {
  it('lets each later ladder observe earlier debits against the same state', () => {
    const rows = call([ladder('first', 60), ladder('second', 60)], [balance('cash', 100)])
    const [first, second] = rows
    if (first?.kind !== 'purchase' || second?.kind !== 'purchase') throw new Error('expected purchases')
    expect(first.funded).toBe(60)
    expect(first.closingBalance).toBe(40)
    expect(first.scale).toBeNull()
    expect(second.funded).toBe(40)
    expect(second.closingBalance).toBe(0)
    expect(second.scale).toBe(2 / 3)
    expect(second.warning).toBe(TIPS_LADDER_PURCHASE_SHORTFALL_WARNING)
    expect(rows.map((row) => row.ladderIndex)).toEqual([0, 1])
  })

  it('threads taxable basis through two sales instead of repricing both from the opening state', () => {
    const rows = call([ladder('first', 25), ladder('second', 25)], [balance('taxable', 100, 40)])
    const [first, second] = rows
    if (first?.kind !== 'purchase' || second?.kind !== 'purchase') throw new Error('expected purchases')
    expect(first.capitalGainOrLoss).toBe(15)
    expect(first.closingCostBasis).toBe(30)
    expect(second.capitalGainOrLoss).toBe(15)
    expect(second.closingCostBasis).toBe(20)
    expect(second.closingBalance).toBe(50)
  })
})

describe('tipsLadderPurchaseFunding — funding arithmetic', () => {
  it('inflates the quoted cost and carries a full cash purchase at book value', () => {
    const [row] = call([ladder('lad', 40)], [balance('cash', 100)], 1.25)
    if (row?.kind !== 'purchase') throw new Error('expected purchase')
    expect(row.funded).toBe(50)
    expect(row.capitalGainOrLoss).toBe(0)
    expect(row.closingBalance).toBe(50)
    expect(row.closingCostBasis).toBe(0)
    expect(row.scale).toBeNull()
    expect(row.warning).toBeNull()
    expect(row.debit).toEqual({ accountId: 'fund', amountPlanDollars: 50 })
    expect(row.record).toEqual({
      fundingAccountId: 'fund',
      ladderId: 'lad',
      funded: 50,
      capitalGainOrLoss: 0,
    })
  })

  it('scales a partial purchase and warns only beyond the shared half-cent tolerance', () => {
    const within = call(
      [ladder('lad', 100 + ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS)],
      [balance('cash', 100)],
    )[0]!
    const short = call(
      [ladder('lad', 100 + ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS + Number.EPSILON * 100)],
      [balance('cash', 100)],
    )[0]!
    if (within.kind !== 'purchase' || short.kind !== 'purchase') throw new Error('expected purchases')
    expect(within.funded).toBe(100)
    expect(within.scale).toBeNull()
    expect(within.warning).toBeNull()
    expect(short.scale).toBe(100 / (100 + ANNUAL_FUNDING_TOLERANCE_PLAN_DOLLARS + Number.EPSILON * 100))
    expect(short.warning).toBe(TIPS_LADDER_PURCHASE_SHORTFALL_WARNING)
  })

  it('keeps zero-cost and zero-funded purchases as recorder rows', () => {
    const zeroCost = call([ladder('zero', 0)], [balance('cash', 0)])[0]!
    const noMoney = call([ladder('short', 10)], [balance('cash', 0)])[0]!
    if (zeroCost.kind !== 'purchase' || noMoney.kind !== 'purchase') throw new Error('expected purchases')
    expect(zeroCost.funded).toBe(0)
    expect(zeroCost.scale).toBeNull()
    expect(zeroCost.warning).toBeNull()
    expect(zeroCost.debit).toBeNull()
    expect(noMoney.funded).toBe(0)
    expect(noMoney.scale).toBe(0)
    expect(noMoney.warning).toBe(TIPS_LADDER_PURCHASE_SHORTFALL_WARNING)
    expect(noMoney.debit).toBeNull()
  })

  it('realizes taxable gains and signed losses with aggregate-basis arithmetic', () => {
    const gain = call([ladder('gain', 25)], [balance('taxable', 100, 40)])[0]!
    const loss = call([ladder('loss', 25)], [balance('taxable', 100, 200)])[0]!
    if (gain.kind !== 'purchase' || loss.kind !== 'purchase') throw new Error('expected purchases')
    expect(gain.capitalGainOrLoss).toBe(15)
    expect(gain.closingCostBasis).toBe(30)
    expect(loss.capitalGainOrLoss).toBe(-25)
    expect(loss.closingCostBasis).toBe(150)
  })

  it('uses the equity-comp basis ratio and makes unvested shares unspendable', () => {
    const vested = call([ladder('vested', 32)], [balance('equityComp', 80, 20)])[0]!
    const unvested = call(
      [ladder('unvested', 32)],
      [balance('equityComp', 80, 20, 'fund', { vestingMode: 'cliff', vestDate: '2027-01-01' })],
    )[0]!
    if (vested.kind !== 'purchase' || unvested.kind !== 'purchase') throw new Error('expected purchases')
    expect(vested.capitalGainOrLoss).toBe(24)
    expect(vested.closingCostBasis).toBe(12)
    expect(vested.closingBalance).toBe(48)
    expect(unvested.funded).toBe(0)
    expect(unvested.capitalGainOrLoss).toBe(0)
    expect(unvested.closingCostBasis).toBe(20)
    expect(unvested.closingBalance).toBe(80)
    expect(unvested.scale).toBe(0)
  })
})

describe('tipsLadderPurchaseFunding — purity and freshness', () => {
  it('mutates neither ladders nor balances and holds no state between calls', () => {
    const ladders = [ladder('first', 60), ladder('second', 60)]
    const balances = [balance('taxable', 100, 40)]
    const before = structuredClone({ ladders, balances })
    const first = call(ladders, balances)
    const second = call(ladders, balances)
    expect({ ladders, balances }).toEqual(before)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
    if (first[0]?.kind !== 'purchase' || second[0]?.kind !== 'purchase') throw new Error('expected purchases')
    expect(second[0].record).not.toBe(first[0].record)
    expect(second[0].debit).not.toBe(first[0].debit)
  })
})
