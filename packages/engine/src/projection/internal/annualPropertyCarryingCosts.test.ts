import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import { annualPropertyCarryingCosts } from './annualPropertyCarryingCosts.js'

const YEAR = 2030

function property(
  id: string,
  propertyTaxAnnual?: number,
  insuranceAnnual?: number,
  plannedSaleYear: number | null = null,
): Extract<Account, { type: 'property' }> {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: id === 'unowned' ? null : 'p1',
    annualReturnPct: null,
    value: 100_000,
    plannedSaleYear,
    expectedNetProceeds: null,
    ...(propertyTaxAnnual === undefined ? {} : { propertyTaxAnnual }),
    ...(insuranceAnnual === undefined ? {} : { insuranceAnnual }),
  }
}

function cash(id: string): Extract<Account, { type: 'cash' }> {
  return {
    type: 'cash',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: 0,
    balance: 1,
    annualContribution: 0,
  }
}

const call = (
  accounts: readonly Readonly<Account>[],
  overrides: Partial<Parameters<typeof annualPropertyCarryingCosts>[0]> = {},
) => annualPropertyCarryingCosts({
  accounts,
  year: YEAR,
  anyAlive: true,
  inflFactor: 1,
  ...overrides,
})

describe('annualPropertyCarryingCosts', () => {
  it('returns eligible properties in account order without collapsing duplicate ids', () => {
    const accounts = [
      property('same', 1e16, 0),
      cash('between'),
      property('same', 1, 0),
      property('same', 2, 0),
    ]
    const rows = call(accounts)

    expect(rows.map((row) => row.account)).toEqual([accounts[0], accounts[2], accounts[3]])
    expect(rows.map((row) => row.amount)).toEqual([1e16, 1, 2])
    expect(rows.map((row) => row.record.accountId)).toEqual(['same', 'same', 'same'])
    expect(rows[0]!.record).not.toBe(rows[1]!.record)
  })

  it('uses the original add-then-inflate arithmetic and preserves owner identity', () => {
    const account = property('owned', 0.1, 0.2)
    const [row] = call([account], { inflFactor: 10 / 3 })

    expect(row!.amount).toBe((0.1 + 0.2) * (10 / 3))
    expect(row!.record).toEqual({ accountId: 'owned', ownerPersonId: 'p1', amount: row!.amount })
    expect(row!.record.amount).toBe(row!.amount)
  })

  it('keeps a zero-cost owned property as a row and normalizes a missing owner to null', () => {
    const [row] = call([property('unowned')])
    expect(row!.amount).toBe(0)
    expect(row!.record).toEqual({ accountId: 'unowned', ownerPersonId: null, amount: 0 })
  })

  it('stops at the sale year, includes the preceding year, and stops after the last death', () => {
    const selling = property('selling', 10, 5, YEAR)
    expect(call([selling], { year: YEAR - 1 })).toHaveLength(1)
    expect(call([selling], { year: YEAR })).toEqual([])
    expect(call([selling], { year: YEAR + 1 })).toEqual([])
    expect(call([property('kept', 10, 5)], { anyAlive: false })).toEqual([])
  })

  it('does not mutate inputs and returns fresh rows and records on every call', () => {
    const accounts = [property('home', 10, 5)]
    const before = structuredClone(accounts)
    const first = call(accounts)
    const second = call(accounts)

    expect(accounts).toEqual(before)
    expect(second).toEqual(first)
    expect(second).not.toBe(first)
    expect(second[0]).not.toBe(first[0])
    expect(second[0]!.record).not.toBe(first[0]!.record)
  })
})
