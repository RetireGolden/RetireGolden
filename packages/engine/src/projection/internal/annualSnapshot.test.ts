/**
 * Characterization tests for the annual snapshot extraction.
 *
 * These prove the pure helper's contract in isolation. They cannot prove that
 * `simulatePlan` delegates to it; the integration change needs a separate
 * delegation guard at the caller boundary.
 */
import { describe, expect, it } from 'vitest'

import {
  annualSnapshot,
  type AnnualSnapshotBalance,
  type AnnualSnapshotInput,
} from './annualSnapshot.js'

const balance = (id: string, value: number): AnnualSnapshotBalance => ({
  account: { id },
  balance: value,
})

function call(overrides: Partial<AnnualSnapshotInput> = {}) {
  return annualSnapshot({
    balances: [],
    unassignedCash: 0,
    propertyValues: new Map(),
    debtBalances: new Map(),
    hecmStates: new Map(),
    insuranceCashValues: new Map(),
    ...overrides,
  })
}

describe('annualSnapshot — balance record', () => {
  it('uses category order and last-write values while totals count every source row', () => {
    const snapshot = call({
      balances: [
        balance('__proto__', 7),
        balance('shared', 10),
        balance('shared', 20),
        balance('all-category', 5),
      ],
      unassignedCash: 5,
      propertyValues: new Map([
        ['collision', 30],
        ['property-only', 40],
        ['all-category', 70],
      ]),
      debtBalances: new Map([
        ['collision', 50],
        ['debt-only', 55],
        ['all-category', 80],
      ]),
      insuranceCashValues: new Map([
        ['insurance-only', 60],
        ['all-category', 90],
      ]),
    })

    expect(Object.keys(snapshot.balanceRecord)).toEqual([
      '__proto__',
      'shared',
      'all-category',
      'collision',
      'property-only',
      'debt-only',
      'insurance-only',
    ])
    expect(Object.hasOwn(snapshot.balanceRecord, '__proto__')).toBe(true)
    expect(snapshot.balanceRecord.__proto__).toBe(7)
    expect(Object.getPrototypeOf(snapshot.balanceRecord)).toBe(Object.prototype)
    expect(snapshot.balanceRecord.shared).toBe(20)
    expect(snapshot.balanceRecord.collision).toBe(50)
    expect(snapshot.balanceRecord['property-only']).toBe(40)
    expect(snapshot.balanceRecord['debt-only']).toBe(55)
    expect(snapshot.balanceRecord['insurance-only']).toBe(60)
    expect(snapshot.balanceRecord['all-category']).toBe(90)
    expect(snapshot.investableTotal).toBe(47)
    expect(snapshot.propertyTotal).toBe(140)
    expect(snapshot.debtTotal).toBe(185)
    expect(snapshot.insuranceCashValueTotal).toBe(150)
  })

  it('retains signed zero in record values and in an untouched cash opening', () => {
    const snapshot = call({
      balances: [balance('negative-zero', -0)],
      unassignedCash: -0,
    })

    expect(Object.is(snapshot.balanceRecord['negative-zero'], -0)).toBe(true)
    // Starting and adding negative zero preserves negative zero.
    expect(Object.is(snapshot.investableTotal, -0)).toBe(true)

    const untouched = call({ unassignedCash: -0 })
    expect(Object.is(untouched.investableTotal, -0)).toBe(true)

    // The fold's ordinary +0 initializer instead collapses an added -0.
    const positiveOpening = call({ balances: [balance('negative-zero', -0)] })
    expect(Object.is(positiveOpening.investableTotal, 0)).toBe(true)
    expect(Object.is(positiveOpening.investableTotal, -0)).toBe(false)
  })
})

describe('annualSnapshot — exact folds', () => {
  it('does not regroup or reorder any source accumulation', () => {
    const cancellationOrder: readonly [string, number][] = [
      ['large', 1e16],
      ['small', 1],
      ['negative-large', -1e16],
    ]
    const snapshot = call({
      balances: cancellationOrder.map(([id, value]) => balance(`account-${id}`, value)),
      propertyValues: new Map(cancellationOrder.map(([id, value]) => [`property-${id}`, value])),
      debtBalances: new Map(cancellationOrder.map(([id, value]) => [`debt-${id}`, value])),
      hecmStates: new Map(cancellationOrder.map(([id, loanBalance]) => [`hecm-${id}`, { loanBalance }])),
      insuranceCashValues: new Map(cancellationOrder.map(([id, value]) => [`insurance-${id}`, value])),
    })

    // In this order, ((0 + 1e16) + 1) - 1e16 is 0. Reordering the same
    // values as 1e16, -1e16, 1 would produce 1 in IEEE-754 arithmetic.
    expect(snapshot.investableTotal).toBe(0)
    expect(snapshot.propertyTotal).toBe(0)
    expect(snapshot.debtTotal).toBe(0)
    expect(snapshot.hecmLoanTotal).toBe(0)
    expect(snapshot.insuranceCashValueTotal).toBe(0)
  })

  it('counts duplicate investable ids in order even though the record overwrites them', () => {
    const snapshot = call({
      balances: [balance('same', 1e16), balance('same', 1), balance('same', -1e16)],
    })

    expect(snapshot.investableTotal).toBe(0)
    expect(snapshot.balanceRecord.same).toBe(-1e16)
  })
})

describe('annualSnapshot — HECM debt', () => {
  it('publishes full loan balances but caps net-worth debt line-by-line at property value', () => {
    const snapshot = call({
      propertyValues: new Map([
        ['underwater-home', 100],
        ['above-water-home', 200],
      ]),
      hecmStates: new Map([
        ['underwater-home', { loanBalance: 150 }],
        ['above-water-home', { loanBalance: 75 }],
        ['missing-property', { loanBalance: 25 }],
      ]),
    })

    expect(snapshot.hecmLoanTotal).toBe(250)
    expect(snapshot.hecmEffectiveDebt).toBe(175)
    // HECM lines are liabilities, not entries in the published balance record.
    expect(snapshot.balanceRecord).toEqual({
      'underwater-home': 100,
      'above-water-home': 200,
    })
  })

  it('preserves map iteration order in the effective-debt fold', () => {
    const hecmStates = new Map([
      ['large', { loanBalance: 1e16 }],
      ['small', { loanBalance: 1 }],
      ['negative-large', { loanBalance: -1e16 }],
    ])
    const propertyValues = new Map([
      ['large', 1e16],
      ['small', 1],
      ['negative-large', 0],
    ])

    expect(call({ hecmStates, propertyValues }).hecmEffectiveDebt).toBe(0)
  })
})

describe('annualSnapshot — purity and re-entry', () => {
  it('returns a fresh result and fresh balance record on every call', () => {
    const input: AnnualSnapshotInput = {
      balances: [balance('cash', 10)],
      unassignedCash: 5,
      propertyValues: new Map([['home', 100]]),
      debtBalances: new Map([['mortgage', 40]]),
      hecmStates: new Map([['home', { loanBalance: 20 }]]),
      insuranceCashValues: new Map([['policy', 30]]),
    }

    const first = annualSnapshot(input)
    const second = annualSnapshot(input)

    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second.balanceRecord).not.toBe(first.balanceRecord)
  })

  it('does not mutate input arrays, maps, or referenced state', () => {
    const state = balance('cash', 10)
    const balances = [state]
    const propertyValues = new Map([['home', 100]])
    const debtBalances = new Map([['mortgage', 40]])
    const line = { loanBalance: 20 }
    const hecmStates = new Map([['home', line]])
    const insuranceCashValues = new Map([['policy', 30]])

    const serializedInput = () => JSON.stringify({
      balances: balances.map((entry) => ({
        account: { id: entry.account.id },
        balance: entry.balance,
      })),
      propertyValues: [...propertyValues],
      debtBalances: [...debtBalances],
      hecmStates: [...hecmStates].map(([id, value]) => [
        id,
        { loanBalance: value.loanBalance },
      ]),
      insuranceCashValues: [...insuranceCashValues],
    })
    const before = serializedInput()

    call({ balances, propertyValues, debtBalances, hecmStates, insuranceCashValues })

    expect(serializedInput()).toBe(before)
    expect(balances[0]).toBe(state)
    expect(hecmStates.get('home')).toBe(line)
  })
})
