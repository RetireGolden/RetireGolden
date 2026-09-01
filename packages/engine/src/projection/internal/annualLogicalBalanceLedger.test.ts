import { describe, expect, it } from 'vitest'
import type { Account } from '../../model/plan.js'
import {
  AnnualLogicalBalanceLedger,
  type PhysicalBalanceState,
} from './annualLogicalBalanceLedger.js'

function cash(id: string, balance: number, annualReturnPct = 0): PhysicalBalanceState {
  const account: Extract<Account, { type: 'cash' }> = {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct,
    balance,
    annualContribution: 0,
  }
  return { account, balance, costBasis: 0 }
}

function taxable(id: string, balance: number, costBasis: number): PhysicalBalanceState {
  const account: Extract<Account, { type: 'taxable' }> = {
    type: 'taxable',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: 0,
    balance,
    costBasis,
    annualContribution: 0,
  }
  return { account, balance, costBasis }
}

describe('AnnualLogicalBalanceLedger', () => {
  it('preserves first-ID order and last-row facts while aggregating capacity', () => {
    const states = [cash('dup', 10, 1), cash('other', 5), cash('dup', 20, 9)]
    const ledger = new AnnualLogicalBalanceLedger(states)

    expect(ledger.groups.map((group) => group.id)).toEqual(['dup', 'other'])
    expect(ledger.groups[0]!.account.annualReturnPct).toBe(9)
    expect(ledger.groups[0]!.balance).toBe(30)
    expect(ledger.groups[0]!.members.map((member) => member.balanceIndex)).toEqual([0, 2])
  })

  it('debits and credits pro rata with an exact aggregate residual', () => {
    const states = [cash('dup', 10), cash('dup', 20)]
    const group = new AnnualLogicalBalanceLedger(states).groups[0]!

    group.debit(9)
    expect(states.map((state) => state.balance)).toEqual([7, 14])
    expect(group.balance).toBe(21)

    group.credit(3)
    expect(states.map((state) => state.balance)).toEqual([8, 16])
    expect(group.balance).toBe(24)
  })

  it('commits live-state assignments transactionally to the physical members', () => {
    const states = [cash('dup', 10), cash('dup', 20)]
    const state = new AnnualLogicalBalanceLedger(states).liveStates()[0]!

    state.balance -= 6

    expect(states.map((row) => row.balance)).toEqual([8, 16])
    expect(state.balance).toBe(24)
  })

  it('allocates aggregate taxable basis with a final exact residual', () => {
    const states = [taxable('dup', 10, 9), taxable('dup', 30, 11)]
    const group = new AnnualLogicalBalanceLedger(states).groups[0]!

    group.applyClosingSnapshot({ balance: 30, costBasis: 13 })

    expect(group.balance).toBe(30)
    expect(group.costBasis).toBe(13)
    expect(states[0]!.balance).toBe(7.5)
    expect(states[0]!.costBasis).toBeCloseTo(5.85, 12)
    expect(states[1]!.costBasis).toBeCloseTo(7.15, 12)
  })

  it('credits the selected last member when aggregate opening is zero', () => {
    const states = [cash('dup', 0), cash('dup', 0)]
    const group = new AnnualLogicalBalanceLedger(states).groups[0]!

    group.credit(5)

    expect(states.map((state) => state.balance)).toEqual([0, 5])
    expect(group.balance).toBe(5)
  })

  it('fails without partial mutation when capacity or basis is invalid', () => {
    const states = [taxable('dup', 10, 4), taxable('dup', 20, 6)]
    const group = new AnnualLogicalBalanceLedger(states).groups[0]!
    const before = states.map((state) => ({ balance: state.balance, costBasis: state.costBasis }))

    expect(() => group.debit(31)).toThrow('exceeds aggregate capacity')
    expect(() => group.applyClosingSnapshot({ balance: 20, costBasis: Number.NaN }))
      .toThrow('must be finite and nonnegative')
    expect(states.map((state) => ({ balance: state.balance, costBasis: state.costBasis })))
      .toEqual(before)
  })

  it('writes exact single-member targets without multi-member normalization', () => {
    const state = cash('single', 0)
    const group = new AnnualLogicalBalanceLedger([state]).groups[0]!

    group.applyClosingSnapshot({ balance: -0 })

    expect(Object.is(state.balance, -0)).toBe(true)
  })

  it('rejects incompatible physical account facts', () => {
    const cashState = cash('dup', 1)
    const taxableState = taxable('dup', 1, 1)
    expect(() => new AnnualLogicalBalanceLedger([cashState, taxableState]))
      .toThrow('incompatible physical rows')
  })
})
