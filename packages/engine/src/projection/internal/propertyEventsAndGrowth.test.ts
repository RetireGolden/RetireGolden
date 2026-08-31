/**
 * Contract tests for the property events + growth phase.
 *
 * These pin the helper in isolation: the growth expression, the legacy sale and
 * its non-recourse clamp, the line accrual, and — the reason this extraction is
 * the hardest of its batch — the three read-after-write channels the private
 * numeric shadow exists to reproduce. What they CANNOT see is whether
 * `simulatePlan` actually calls this function, or whether it uses what comes
 * back: a byte-identical differential dump passes an orphaned helper, and so do
 * these. That is `simulate.propertyEventsAndGrowthDelegation.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import {
  propertyEventsAndGrowth,
  type PropertyEventHecmLine,
  type PropertyEventYearInput,
} from './propertyEventsAndGrowth.js'
import type { YearCashFlowTransferEndpoint } from './types/cashFlow.js'

const YEAR = 2026
const DESTINATION: YearCashFlowTransferEndpoint = { entityKind: 'unassignedCash' }

const property = (
  id: string,
  extra: Record<string, unknown> = {},
  hecm: Record<string, unknown> | null = null,
): Account =>
  ({
    type: 'property',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 12,
    value: 0,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    ...extra,
    ...(hecm === null ? {} : { hecm: { openYear: YEAR, growthRatePct: 15, drawPolicy: 'lastResort', ...hecm } }),
  }) as Account

const cash = (id: string): Account =>
  ({ type: 'cash', id, name: id, ownerPersonId: null, annualReturnPct: 0, balance: 1, annualContribution: 0 }) as Account

function call(
  accounts: readonly Account[],
  overrides: Partial<PropertyEventYearInput> = {},
) {
  return propertyEventsAndGrowth({
    accounts,
    year: YEAR,
    propertyValues: new Map(accounts.filter((a) => a.type === 'property').map((a) => [a.id, 100_000])),
    inflRateAt: () => 0.1,
    hecmStates: new Map<string, PropertyEventHecmLine>(),
    surplusDestination: DESTINATION,
    ...overrides,
  })
}

describe('propertyEventsAndGrowth — selection and growth', () => {
  it('returns one row per PROPERTY account, in accounts order', () => {
    const rows = call([cash('c'), property('home-b'), property('home-a')])
    expect(rows.map((r) => r.propertyAccountId)).toEqual(['home-b', 'home-a'])
  })

  it('grows the value at GENERAL INFLATION, not at the account’s annualReturnPct', () => {
    // The property variant carries `annualReturnPct` (12 in this fixture) and
    // this phase ignores it. Preserved, not repaired.
    const [row] = call([property('home')], { propertyValues: new Map([['home', 137_411.29]]) })
    expect(row!.value).toBe(137_411.29 * (1 + 0.1))
  })

  it('calls inflRateAt once per property row, with the projected year', () => {
    const seen: number[] = []
    call([property('a'), cash('c'), property('b')], {
      inflRateAt: (y) => {
        seen.push(y)
        return 0
      },
    })
    expect(seen).toEqual([YEAR, YEAR])
  })

  it('treats a property with no value entry as zero', () => {
    const [row] = call([property('home')], { propertyValues: new Map() })
    expect(row!.value).toBe(0)
    expect(row!.deposit).toBeNull()
  })
})

describe('propertyEventsAndGrowth — the legacy sale', () => {
  const SELLING = property('home', { plannedSaleYear: YEAR })

  it('tests the sale gate on the POST-growth value', () => {
    // Zero grows to zero, so the gate stays shut and nothing is deposited.
    const [row] = call([SELLING], { propertyValues: new Map([['home', 0]]) })
    expect(row!.deposit).toBeNull()
    expect(row!.value).toBe(0)
  })

  it('deposits expectedNetProceeds when set, and the grown value when not', () => {
    const [quoted] = call([property('home', { plannedSaleYear: YEAR, expectedNetProceeds: 88_500 })])
    expect(quoted!.deposit).toBe(88_500)
    const [unquoted] = call([SELLING])
    expect(unquoted!.deposit).toBe(100_000 * 1.1)
    expect(unquoted!.value).toBe(0)
  })

  it('does NOT deposit for an exact-basis sale, but still zeroes the value', () => {
    // Those were already priced and deposited by `fixedAssetDispositions`
    // earlier in the same year.
    const [row] = call([property('home', { plannedSaleYear: YEAR, costBasis: 50_000 })])
    expect(row!.deposit).toBeNull()
    expect(row!.record).toBeNull()
    expect(row!.closesHecmForAccountId).toBeNull()
    expect(row!.value).toBe(0)
  })

  it('repays an open line non-recourse and closes it', () => {
    const rows = call([property('home', { plannedSaleYear: YEAR }, {})], {
      hecmStates: new Map([['home', { principalLimit: 60_000, loanBalance: 40_000 }]]),
    })
    const row = rows[0]!
    expect(row.closesHecmForAccountId).toBe('home')
    expect(row.deposit).toBe(100_000 * 1.1 - 40_000)
    // The closed line does not then compound.
    expect(row.hecmGrowth).toBeNull()
  })

  it('never repays more than the sale nets', () => {
    const rows = call([property('home', { plannedSaleYear: YEAR, expectedNetProceeds: 10_000 }, {})], {
      hecmStates: new Map([['home', { principalLimit: 900_000, loanBalance: 800_000 }]]),
    })
    expect(rows[0]!.deposit).toBe(0)
    expect(rows[0]!.closesHecmForAccountId).toBe('home')
  })

  it('reports a deposit even when it is not positive, and no ledger row', () => {
    // The inlined phase called `deposit(amount)` unconditionally for a legacy
    // sale and gated only the ledger push on `amount > 0`; `deposit` itself
    // early-returns. Collapsing the two gates would change the call graph.
    const rows = call([property('home', { plannedSaleYear: YEAR, expectedNetProceeds: 0 })], {
      propertyValues: new Map([['home', 1]]),
    })
    expect(rows[0]!.deposit).toBe(0)
    expect(rows[0]!.record).toBeNull()
  })

  it('builds the ledger row only on the publish path', () => {
    const on = call([property('home', { plannedSaleYear: YEAR })])
    expect(on[0]!.record).toEqual({ propertyAccountId: 'home', amount: 100_000 * 1.1, destination: DESTINATION })
    expect(on[0]!.record!.destination).toBe(DESTINATION)
    // Off the publish path `surplusDestination` is null, and the inlined phase
    // never built the object at all — optional chaining did not evaluate it.
    const off = call([property('home', { plannedSaleYear: YEAR })], { surplusDestination: null })
    expect(off[0]!.record).toBeNull()
    expect(off[0]!.deposit, 'the deposit still happens off the publish path').toBe(100_000 * 1.1)
  })

  it('ignores a planned sale dated to another year', () => {
    const [row] = call([property('home', { plannedSaleYear: YEAR + 1 })])
    expect(row!.deposit).toBeNull()
    expect(row!.value).toBe(100_000 * 1.1)
  })
})

describe('propertyEventsAndGrowth — the HECM accrual', () => {
  it('compounds an open line at the account’s own growth rate', () => {
    const [row] = call([property('home', {}, { growthRatePct: 7.5 })], {
      hecmStates: new Map([['home', { principalLimit: 60_000, loanBalance: 40_000 }]]),
    })
    expect(row!.hecmGrowth).toBe(1 + 7.5 / 100)
  })

  it('reports no growth without a line, and none without a hecm block', () => {
    expect(call([property('home', {}, {})])[0]!.hecmGrowth).toBeNull()
    const noBlock = call([property('home')], {
      hecmStates: new Map([['home', { principalLimit: 1, loanBalance: 1 }]]),
    })
    expect(noBlock[0]!.hecmGrowth).toBeNull()
  })
})

describe('propertyEventsAndGrowth — the numeric shadow', () => {
  it('channel 1: a second account sharing an id compounds the value AGAIN', () => {
    // MEASURED against the inlined phase: two property accounts sharing one id
    // at 10% inflation end the year at 100000 x 1.1 x 1.1, not at 100000 x 1.1.
    // An eager helper reading a pre-loop snapshot would give the second row the
    // wrong base.
    const rows = call([property('twin'), property('twin')], { propertyValues: new Map([['twin', 100_000]]) })
    expect(rows[0]!.value).toBe(100_000 * 1.1)
    expect(rows[1]!.value).toBe(100_000 * 1.1 * 1.1)
    expect(rows[1]!.value).toBe(121_000.00000000003)
  })

  it('channel 2: the line compounds once per id, and the payoff clamp reads the RUNNING balance', () => {
    // First row: no sale, so the line grows. Second row: sells, and its
    // non-recourse clamp must see the GROWN balance, not the opening one.
    const growth = 1 + 15 / 100
    const rows = call(
      [property('twin', {}, {}), property('twin', { plannedSaleYear: YEAR, expectedNetProceeds: 100_000 }, {})],
      { hecmStates: new Map([['twin', { principalLimit: 60_000, loanBalance: 40_000 }]]) },
    )
    expect(rows[0]!.hecmGrowth).toBe(growth)
    expect(rows[1]!.hecmGrowth).toBeNull()
    expect(rows[1]!.deposit).toBe(100_000 - 40_000 * growth)
    // …and a helper reading the OPENING balance would have deposited this.
    expect(rows[1]!.deposit).not.toBe(100_000 - 40_000)
    expect(rows[1]!.closesHecmForAccountId).toBe('twin')
  })

  it('channel 2, third row: duplicate rows do not compound the one line again', () => {
    const growth = 1 + 15 / 100
    const rows = call(
      [
        property('twin', {}, {}),
        property('twin', {}, {}),
        property('twin', { plannedSaleYear: YEAR, expectedNetProceeds: 500_000 }, {}),
      ],
      { hecmStates: new Map([['twin', { principalLimit: 60_000, loanBalance: 40_000 }]]) },
    )
    expect(rows[1]!.hecmGrowth).toBeNull()
    expect(rows[2]!.deposit).toBe(500_000 - 40_000 * growth)
  })

  it('channel 3: a row that closes its own line does not then compound it', () => {
    const rows = call([property('twin', { plannedSaleYear: YEAR, expectedNetProceeds: 1_000_000 }, {}), property('twin', {}, {})], {
      hecmStates: new Map([['twin', { principalLimit: 60_000, loanBalance: 40_000 }]]),
    })
    expect(rows[0]!.closesHecmForAccountId).toBe('twin')
    expect(rows[0]!.hecmGrowth, 'the row that closed the line must not compound it').toBeNull()
    // And the deletion is visible to the LATER row too.
    expect(rows[1]!.hecmGrowth).toBeNull()
  })

  it('leaves distinct ids completely independent', () => {
    const rows = call([property('a', {}, {}), property('b', {}, {})], {
      propertyValues: new Map([
        ['a', 100_000],
        ['b', 100_000],
      ]),
      hecmStates: new Map([
        ['a', { principalLimit: 60_000, loanBalance: 40_000 }],
        ['b', { principalLimit: 60_000, loanBalance: 40_000 }],
      ]),
    })
    expect(rows[0]!.value).toBe(rows[1]!.value)
    expect(rows[0]!.hecmGrowth).toBe(rows[1]!.hecmGrowth)
  })
})

describe('propertyEventsAndGrowth — purity and structure', () => {
  const ACCOUNTS = [property('home', { plannedSaleYear: YEAR }, {}), property('other', {}, {})]
  const VALUES = new Map([
    ['home', 100_000],
    ['other', 200_000],
  ])
  const LINES = new Map<string, PropertyEventHecmLine>([
    ['home', { principalLimit: 60_000, loanBalance: 40_000 }],
    ['other', { principalLimit: 10_000, loanBalance: 5_000 }],
  ])

  it('returns a materialized array, not a lazy iterable', () => {
    const rows = call(ACCOUNTS, { propertyValues: VALUES, hecmStates: LINES })
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(2)
  })

  it('holds no state between calls', () => {
    const first = call(ACCOUNTS, { propertyValues: VALUES, hecmStates: LINES })
    const second = call(ACCOUNTS, { propertyValues: VALUES, hecmStates: LINES })
    expect(second).toEqual(first)
    expect(second[0]).not.toBe(first[0])
  })

  it('mutates neither map nor any line object it was handed', () => {
    const lines = new Map<string, PropertyEventHecmLine>([['other', { principalLimit: 10_000, loanBalance: 5_000 }]])
    const held = lines.get('other')!
    const values = new Map([['other', 200_000]])
    call([property('other', {}, {})], { propertyValues: values, hecmStates: lines })
    expect(held).toEqual({ principalLimit: 10_000, loanBalance: 5_000 })
    expect([...values]).toEqual([['other', 200_000]])
    expect(lines.size).toBe(1)
  })
})
