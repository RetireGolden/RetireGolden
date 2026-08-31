/**
 * Contract tests for the pension lump-sum rollover phase.
 *
 * These pin the helper in isolation: selection, target resolution, the two
 * publication gates and the occurrence-key format. What they CANNOT see is
 * whether `simulatePlan` actually calls this function — a byte-identical
 * differential dump passes an orphaned helper, and so do these. That is
 * `simulate.pensionLumpSumRolloversDelegation.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest'

import type { Account } from '../../model/plan.js'
import {
  pensionLumpSumRollovers,
  type PensionLumpSumRolloverBalanceView,
  type PensionLumpSumRolloverYearInput,
} from './pensionLumpSumRollovers.js'

const YEAR = 2026

/** `simulate.ts`'s own key builder, reproduced here as the caller passes it. */
const runtimeOccurrenceKey: PensionLumpSumRolloverYearInput['runtimeOccurrenceKey'] = (kind, ...binding) =>
  JSON.stringify([kind, ...binding])

function pension(
  id: string,
  opts: {
    offer?: { amount: number; electionYear: number } | null
    rolloverAccountId?: string | null
  } = {},
): Account {
  const offer = opts.offer === undefined ? { amount: 20_000, electionYear: YEAR } : opts.offer
  const rolloverAccountId = opts.rolloverAccountId === undefined ? 'dest' : opts.rolloverAccountId
  return {
    type: 'pension',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 60,
    monthlyAmount: 0,
    colaPct: 0,
    survivorPct: 0,
    ...(offer === null ? {} : { lumpSumOffer: offer }),
    ...(rolloverAccountId === null ? {} : { lumpSumElection: { rolloverAccountId } }),
  } as Account
}

const traditional = (
  id: string,
  kind: 'ira' | 'employer' = 'ira',
  extra: Record<string, unknown> = {},
): Account =>
  ({
    type: 'traditional',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind,
    balance: 100_000,
    annualContribution: 0,
    ...extra,
  }) as Account

const roth = (id: string): Account =>
  ({
    type: 'roth',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: 0,
    kind: 'ira',
    balance: 0,
    annualContribution: 0,
  }) as Account

const view = (...accounts: readonly Account[]): PensionLumpSumRolloverBalanceView[] =>
  accounts.map((account) => ({ account }))

const call = (
  accounts: readonly Account[],
  balances: readonly PensionLumpSumRolloverBalanceView[],
  year = YEAR,
) => pensionLumpSumRollovers({ accounts, year, balances, runtimeOccurrenceKey })

describe('pensionLumpSumRollovers — selection', () => {
  it('returns one row per electing pension, in accounts order', () => {
    const rows = call(
      [pension('pen-b'), traditional('dest'), pension('pen-a')],
      view(traditional('dest')),
    )
    expect(rows.map((r) => r.pensionAccountId)).toEqual(['pen-b', 'pen-a'])
  })

  it('skips a pension with no election, no offer, or an offer for another year', () => {
    const rows = call(
      [
        pension('no-election', { rolloverAccountId: null }),
        pension('no-offer', { offer: null }),
        pension('other-year', { offer: { amount: 20_000, electionYear: YEAR + 1 } }),
        pension('elects'),
      ],
      view(traditional('dest')),
    )
    expect(rows.map((r) => r.pensionAccountId)).toEqual(['elects'])
  })

  it('skips every account that is not a pension', () => {
    expect(call([traditional('dest'), roth('r')], view(traditional('dest')))).toEqual([])
  })

  it('produces NO row when the rollover target does not resolve', () => {
    // Unreachable through `parsePlan`, which forces the target to be an
    // existing owned traditional account — but `simulatePlan` takes a `Plan` by
    // TYPE, and the inlined phase skipped this row rather than throwing.
    expect(call([pension('pen', { rolloverAccountId: 'nowhere' })], view(traditional('dest')))).toEqual([])
  })

  it('resolves the target to the FIRST balance state carrying the id', () => {
    const rows = call([pension('pen')], view(roth('other'), traditional('dest'), traditional('dest')))
    expect(rows[0]!.destinationIndex).toBe(1)
    expect(rows[0]!.destinationAccountId).toBe('dest')
  })

  it('keeps two pensions that share an id as two rows', () => {
    // A pension account id is not action-referenced, so `model/plan.ts` does
    // not reject the duplicate. Any map-by-id would collapse these.
    const rows = call([pension('same'), pension('same')], view(traditional('dest')))
    expect(rows.length).toBe(2)
    expect(rows.map((r) => r.pensionAccountId)).toEqual(['same', 'same'])
    expect(rows[0]!.runtime?.producerOccurrenceKey).toBe(rows[1]!.runtime?.producerOccurrenceKey)
  })
})

describe('pensionLumpSumRollovers — the two publication gates', () => {
  it('emits an occurrence AND an aggregated-IRA application for an owned IRA', () => {
    const [row] = call([pension('pen')], view(traditional('dest', 'ira')))
    expect(row!.runtime).toEqual({
      producerOccurrenceKey: JSON.stringify(['rolloverInflow', 'pen', 'dest']),
      creditsAggregatedIra: true,
    })
  })

  it('emits the occurrence but NOT the application for an owned EMPLOYER plan', () => {
    // Measured reachable through `parsePlan`. A contract that collapsed the two
    // gates into one would silently drop this occurrence, which the optimizer reads.
    const [row] = call([pension('pen')], view(traditional('dest', 'employer')))
    expect(row!.runtime?.creditsAggregatedIra).toBe(false)
    expect(row!.runtime?.producerOccurrenceKey).toBe(JSON.stringify(['rolloverInflow', 'pen', 'dest']))
  })

  it('emits the occurrence but NOT the application for an INHERITED traditional IRA', () => {
    const [row] = call(
      [pension('pen')],
      view(traditional('dest', 'ira', { inherited: { decedentDeathYear: 2020, relationship: 'nonSpouse' } })),
    )
    expect(row!.runtime?.creditsAggregatedIra).toBe(false)
  })

  it('emits NO runtime record when the destination is not traditional', () => {
    const [row] = call([pension('pen')], view(roth('dest')))
    expect(row!.runtime).toBeNull()
    // It is still a row: the balance is still credited and the ledger payload
    // is still built and handed over.
    expect(row!.amount).toBe(20_000)
  })

  it('emits NO runtime record for a zero offer, and still returns the row', () => {
    const [row] = call([pension('pen', { offer: { amount: 0, electionYear: YEAR } })], view(traditional('dest')))
    expect(row!.runtime).toBeNull()
    expect(row!.amount).toBe(0)
    expect(row!.record.amount).toBe(0)
  })

  it('emits NO runtime record for a NEGATIVE offer, and still returns the row', () => {
    const [row] = call([pension('pen', { offer: { amount: -5, electionYear: YEAR } })], view(traditional('dest')))
    expect(row!.runtime).toBeNull()
    expect(row!.amount).toBe(-5)
  })
})

describe('pensionLumpSumRollovers — the row payload', () => {
  it('carries the offer verbatim and names the destination by its own id', () => {
    const [row] = call([pension('pen')], view(traditional('dest')))
    expect(row!.amount).toBe(20_000)
    expect(row!.destinationAccountId).toBe('dest')
    expect(row!.ownerPersonId).toBe('p1')
  })

  it('normalizes a null owner to null in the record and leaves the row field raw', () => {
    const [row] = call([pension('pen')], view(traditional('dest', 'ira', { ownerPersonId: null })))
    expect(row!.ownerPersonId).toBeNull()
    expect(row!.record.ownerPersonId).toBeNull()
  })

  it('builds the ledger payload from the row’s own values', () => {
    const [row] = call([pension('pen')], view(traditional('dest')))
    expect(row!.record).toEqual({
      pensionAccountId: 'pen',
      destinationAccountId: 'dest',
      ownerPersonId: 'p1',
      amount: 20_000,
    })
    expect(row!.record.amount).toBe(row!.amount)
    expect(row!.record.pensionAccountId).toBe(row!.pensionAccountId)
  })
})

describe('pensionLumpSumRollovers — purity and structure', () => {
  const ACCOUNTS = [pension('pen'), traditional('dest')]
  const BALANCES = view(traditional('dest'))

  it('returns a materialized array, not a lazy iterable', () => {
    const rows = call(ACCOUNTS, BALANCES)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(1)
  })

  it('holds no state between calls', () => {
    const first = call(ACCOUNTS, BALANCES)
    const second = call(ACCOUNTS, BALANCES)
    expect(second).toEqual(first)
    expect(second[0]).not.toBe(first[0])
  })

  it('mutates neither the accounts nor the balance view it was handed', () => {
    const accounts = structuredClone(ACCOUNTS)
    const balances = view(traditional('dest'))
    const before = structuredClone({ accounts, balances })
    call(accounts, balances)
    expect({ accounts, balances }).toEqual(before)
  })

  it('produces nothing at all in a year no offer elects', () => {
    expect(call(ACCOUNTS, BALANCES, YEAR + 5)).toEqual([])
  })
})
