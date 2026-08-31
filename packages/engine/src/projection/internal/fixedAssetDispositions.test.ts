/**
 * The fixed-asset-disposition phase's CONTRACT, tested directly.
 *
 * These tests exercise the helper through its own interface rather than
 * restating its implementation. The pricing arithmetic is deliberately NOT
 * re-derived here: it belongs to `tax/propertySale.ts#propertySaleTax`, which
 * has its own citable-source tests. What is pinned here is what this module
 * actually owns — which accounts sell, how a HECM line is repaid and closed,
 * that the ledger payload carries the row's own values, that the inflation
 * lookup is called per row rather than hoisted, and that nothing the caller
 * handed in is mutated.
 */
import { describe, expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import type { Account } from '../../model/plan.js'
import { fixedAssetDispositions, type FixedAssetDispositionYearInput } from './fixedAssetDispositions.js'

const pack = packForYear(2026).pack
const YEAR = 2030

/**
 * A property account, fully shaped — no `as Account`. The cast this fixture
 * used to carry was load-bearing rather than cosmetic: it silenced two REQUIRED
 * fields of the property variant (`annualReturnPct` and `expectedNetProceeds`)
 * that the literal simply omitted, so the compiler was not checking that what
 * the helper gets handed is a whole property account. Supplying the two
 * restores that check; the `Partial` override still types every call site.
 */
function property(
  id: string,
  over: Partial<Extract<Account, { type: 'property' }>> = {},
): Extract<Account, { type: 'property' }> {
  return {
    type: 'property',
    id,
    name: id,
    ownerPersonId: null,
    annualReturnPct: null,
    value: 500_000,
    // The legacy tax-free path this phase deliberately does not take.
    expectedNetProceeds: null,
    plannedSaleYear: YEAR,
    costBasis: 300_000,
    sellingCostPct: 6,
    primaryResidence: false,
    ...over,
  }
}

function input(over: Partial<FixedAssetDispositionYearInput> = {}): FixedAssetDispositionYearInput {
  return {
    accounts: [property('home')],
    year: YEAR,
    propertyValues: new Map([['home', 500_000]]),
    inflRateAt: () => 0,
    filingStatus: 'single',
    pack,
    hecmStates: new Map(),
    ...over,
  }
}

describe('fixedAssetDispositions — which accounts sell', () => {
  it('emits one row per qualifying account, in accounts order', () => {
    const rows = fixedAssetDispositions(
      input({
        accounts: [property('b'), property('a')],
        propertyValues: new Map([
          ['a', 400_000],
          ['b', 500_000],
        ]),
      }),
    )
    expect(rows.map((r) => r.propertyAccountId)).toEqual(['b', 'a'])
  })

  it('skips a non-property account', () => {
    const cash: Account = {
      type: 'cash',
      id: 'home',
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 500_000,
      annualContribution: 0,
    }
    expect(fixedAssetDispositions(input({ accounts: [cash] }))).toEqual([])
  })

  it('skips a property whose planned sale is not this year', () => {
    expect(fixedAssetDispositions(input({ accounts: [property('home', { plannedSaleYear: YEAR + 1 })] }))).toEqual([])
    expect(fixedAssetDispositions(input({ accounts: [property('home', { plannedSaleYear: null })] }))).toEqual([])
  })

  it('skips a property with no cost basis — the legacy expectedNetProceeds path', () => {
    expect(fixedAssetDispositions(input({ accounts: [property('home', { costBasis: undefined })] }))).toEqual([])
  })

  it('sells a property whose cost basis is ZERO — 0 is a basis, not an absence', () => {
    // `propertySchema` types `costBasis` as `nonNegative.optional()`, so 0 is a
    // legal basis (a fully depreciated property, or one taken in at nil) and
    // the selection filter must test for ABSENCE — `=== undefined` — not for
    // falsiness. Measured, rewriting it as `if (!account.costBasis) continue`
    // turns the row count below from 1 into 0.
    //
    // Be exact about what this adds. It is NOT the only test that catches that
    // edit: `simulate.annualCashFlow.propertyHecm.test.ts` already sells a
    // `costBasis: 0` home end to end, and the same injection fails it too
    // (measured: 2 files failed, 281 passed). What was missing is the case in
    // THIS file — the helper's own selection contract, failing by name on the
    // row count rather than downstream on a ledger line that stopped being
    // published.
    const rows = fixedAssetDispositions(input({ accounts: [property('home', { costBasis: 0 })] }))
    expect(rows).toHaveLength(1)
    // Nothing was paid for the house, so every dollar it nets is gain, and the
    // whole gain is capital: not a primary residence, so no §121 exclusion, and
    // no depreciation to recapture. Exactly equal, so a filter that quietly
    // substituted some other basis could not satisfy this.
    expect(rows[0]!.capitalGain).toBe(rows[0]!.netProceedsAfterHecm)
    expect(rows[0]!.ordinaryGain).toBe(0)
    expect(rows[0]!.capitalGain).toBeGreaterThan(0)
  })

  it('skips a property whose value is zero or absent', () => {
    expect(fixedAssetDispositions(input({ propertyValues: new Map([['home', 0]]) }))).toEqual([])
    expect(fixedAssetDispositions(input({ propertyValues: new Map() }))).toEqual([])
  })
})

describe('fixedAssetDispositions — HECM repayment and closure', () => {
  it('closes the line as it goes, so a second account sharing the id sees none', () => {
    // Account ids are not globally unique in a valid Plan: `duplicate account
    // id` is raised only when a retirement action references the id. The
    // inlined phase deleted the line INSIDE the loop, so the second row got no
    // payoff. A caller-side post-hoc delete would pay the line off twice.
    const rows = fixedAssetDispositions(
      input({
        accounts: [property('home'), property('home')],
        propertyValues: new Map([['home', 500_000]]),
        hecmStates: new Map([['home', { loanBalance: 100_000 }]]),
      }),
    )
    expect(rows).toHaveLength(2)
    expect(rows[0]!.closesHecmForAccountId).toBe('home')
    expect(rows[1]!.closesHecmForAccountId).toBeNull()
    // Row 0 paid the line off; row 1 kept every dollar the sale netted.
    expect(rows[0]!.netProceedsAfterHecm).toBe(rows[1]!.netProceedsAfterHecm - 100_000)
  })

  it('closes a line drawn to a zero balance, with a zero payoff', () => {
    const rows = fixedAssetDispositions(input({ hecmStates: new Map([['home', { loanBalance: 0 }]]) }))
    expect(rows[0]!.closesHecmForAccountId).toBe('home')
    const noLine = fixedAssetDispositions(input())
    expect(rows[0]!.netProceedsAfterHecm).toBe(noLine[0]!.netProceedsAfterHecm)
  })

  it('repays non-recourse: the payoff never exceeds what the sale nets', () => {
    // 500k value, 6% selling costs -> 470k net. A larger balance cannot reach
    // past it, and the taxable gain is untouched by the repayment.
    const rows = fixedAssetDispositions(input({ hecmStates: new Map([['home', { loanBalance: 900_000 }]]) }))
    expect(rows[0]!.netProceedsAfterHecm).toBe(0)
    expect(rows[0]!.capitalGain).toBe(fixedAssetDispositions(input())[0]!.capitalGain)
    expect(rows[0]!.capitalGain).toBeGreaterThan(0)
  })
})

describe('fixedAssetDispositions — the ledger payload', () => {
  it('carries the row’s own values, exactly, into the ledger payload', () => {
    const rows = fixedAssetDispositions(input({ hecmStates: new Map([['home', { loanBalance: 100_000 }]]) }))
    const row = rows[0]!
    // `toBe`, not `toBeCloseTo`: the record must carry the row's exact doubles,
    // not a rounded or re-derived approximation. Be exact about what that does
    // NOT establish. It cannot show that one computation feeds both: a verbatim
    // re-evaluation of the same expression on the same operands yields the
    // identical double, and rebuilding the record's `netProceedsAfterHecm` as
    // `sale.netProceeds - hecmPayoff` keeps this test green and moves nothing
    // in the differential oracle (measured). Sharing the computed value is a
    // convention this module keeps, not a property this assertion tests.
    expect(row.record.propertyAccountId).toBe(row.propertyAccountId)
    expect(row.record.netProceedsAfterHecm).toBe(row.netProceedsAfterHecm)
    expect(row.record.ordinaryGain).toBe(row.ordinaryGain)
    expect(row.record.capitalGain).toBe(row.capitalGain)
  })
})

describe('fixedAssetDispositions — the inflation lookup', () => {
  it('calls the caller’s lookup with the projected year, once per selling row', () => {
    // Passed as a function and called per row, exactly as the inlined phase
    // did: it closes over the Monte Carlo inflation path, so a hoisted value or
    // the plan's flat assumption would silently break every market-path run.
    const seen: number[] = []
    const rows = fixedAssetDispositions(
      input({
        accounts: [property('a'), property('b'), property('c', { plannedSaleYear: YEAR + 5 })],
        propertyValues: new Map([
          ['a', 400_000],
          ['b', 500_000],
          ['c', 600_000],
        ]),
        inflRateAt: (year) => {
          seen.push(year)
          return 0.1
        },
      }),
    )
    expect(rows).toHaveLength(2)
    expect(seen).toEqual([YEAR, YEAR])
    // And the rate is actually applied to the sale price. The equivalent is
    // built as the SAME product (`400_000 * (1 + 0.1)`, not the hand-rounded
    // 440_000, which differs from it in the last bits) and then grown by a
    // zero rate, because multiplying by exactly 1 is the one growth step that
    // is bit-exact.
    const grown = fixedAssetDispositions(
      input({
        accounts: [property('a')],
        propertyValues: new Map([['a', 400_000 * (1 + 0.1)]]),
        inflRateAt: () => 0,
      }),
    )
    expect(rows[0]!.netProceedsAfterHecm).toBe(grown[0]!.netProceedsAfterHecm)
    const ungrown = fixedAssetDispositions(
      input({ accounts: [property('a')], propertyValues: new Map([['a', 400_000]]), inflRateAt: () => 0 }),
    )
    expect(rows[0]!.netProceedsAfterHecm).not.toBe(ungrown[0]!.netProceedsAfterHecm)
  })
})

describe('fixedAssetDispositions — purity', () => {
  it('mutates nothing it was handed, and repeats itself exactly', () => {
    const accounts = [property('home'), property('other', { plannedSaleYear: YEAR + 1 })]
    const propertyValues = new Map([
      ['home', 500_000],
      ['other', 250_000],
    ])
    const hecmStates = new Map([['home', { loanBalance: 100_000 }]])
    const before = JSON.stringify([accounts, [...propertyValues], [...hecmStates]])

    const first = fixedAssetDispositions(input({ accounts, propertyValues, hecmStates }))
    expect(JSON.stringify([accounts, [...propertyValues], [...hecmStates]])).toBe(before)

    // Same input, same answer: the module holds no state across calls, so the
    // optimizer's and Monte Carlo's repeated re-entry cannot drift it.
    const second = fixedAssetDispositions(input({ accounts, propertyValues, hecmStates }))
    expect(JSON.stringify([accounts, [...propertyValues], [...hecmStates]])).toBe(before)
    expect(second).toEqual(first)
    expect(second[0]!.closesHecmForAccountId).toBe('home')
  })
})
