/**
 * The income-pass-2 phase's CONTRACT, tested directly.
 *
 * These tests exercise the helper through its own interface rather than
 * restating its implementation. What is pinned here is what the module owns:
 * which streams contribute in a given year (the recurring window, the
 * survivorship gate, the one-time year match), what each contributing stream
 * pays (the inflation election, which since plan schema v5 both kinds carry),
 * how the amount is routed for tax, and — the part the delegation test
 * deliberately cannot check — that rows come back in `plan.incomes` ORDER and
 * are keyed by POSITION rather than by stream id.
 *
 * `internal/*` is null-exported from the package (`"./projection/internal/*":
 * null`), so none of this joins the published surface.
 */
import { describe, expect, it } from 'vitest'

import type { IncomeStream } from '../../model/plan.js'
import { otherIncomeStreams, type OtherIncomeStreamYearInput } from './otherIncomeStreams.js'

const YEAR = 2030

function recurring(over: Partial<Extract<IncomeStream, { type: 'recurring' }>> = {}): IncomeStream {
  return {
    type: 'recurring',
    id: 'rec',
    label: 'Rental',
    annualAmount: 10_000,
    startYear: null,
    endYear: null,
    inflationAdjusted: false,
    taxTreatment: 'ordinary',
    ...over,
  }
}

function oneTime(over: Partial<Extract<IncomeStream, { type: 'oneTime' }>> = {}): IncomeStream {
  return {
    type: 'oneTime',
    id: 'once',
    label: 'Windfall',
    year: YEAR,
    inflationAdjusted: false,
    amount: 25_000,
    taxTreatment: 'ordinary',
    ...over,
  }
}

function input(over: Partial<OtherIncomeStreamYearInput> = {}): OtherIncomeStreamYearInput {
  return {
    incomes: [recurring()],
    year: YEAR,
    anyAlive: true,
    inflFactor: 2,
    ...over,
  }
}

describe('otherIncomeStreams — selection', () => {
  // BOTH neighbouring passes are present, and that is the point rather than
  // thoroughness for its own sake. Wages (pass 1) and Social Security (pass 3)
  // are the only other `plan.incomes` kinds, each is already folded into
  // `incomes.wages` / `incomes.socialSecurity` by its own pass, and a row
  // emitted here for either would be counted a SECOND time — into
  // `incomes.recurring` or `incomes.oneTime`, and into `ordinaryIncome` on top
  // of whatever tax treatment its own pass applied. Asserting the id list
  // rather than the length is what makes the wrong stream nameable.
  it('skips the passes it does not own', () => {
    const rows = otherIncomeStreams(
      input({
        incomes: [
          {
            type: 'wages',
            id: 'w',
            personId: 'p1',
            annualGross: 90_000,
            endAge: null,
            realGrowthPct: 0,
          },
          {
            type: 'socialSecurity',
            id: 'ss',
            personId: 'p1',
            piaMonthly: 2_400,
            earnings: null,
            claimAge: { years: 67, months: 0 },
          },
          recurring(),
        ],
      }),
    )
    expect(rows.map((r) => r.record.incomeStreamId)).toEqual(['rec'])
  })

  it('includes a recurring stream on both window boundaries and excludes it outside', () => {
    const windowed = (year: number) =>
      otherIncomeStreams(
        input({ year, incomes: [recurring({ startYear: 2030, endYear: 2032 })] }),
      ).length
    expect(windowed(2029)).toBe(0)
    // Both ends are INCLUSIVE.
    expect(windowed(2030)).toBe(1)
    expect(windowed(2031)).toBe(1)
    expect(windowed(2032)).toBe(1)
    expect(windowed(2033)).toBe(0)
  })

  it('treats a null window edge as unbounded on that side', () => {
    const open = (over: Partial<Extract<IncomeStream, { type: 'recurring' }>>, year: number) =>
      otherIncomeStreams(input({ year, incomes: [recurring(over)] })).length
    expect(open({ startYear: null, endYear: 2030 }, 1900)).toBe(1)
    expect(open({ startYear: null, endYear: 2030 }, 2031)).toBe(0)
    expect(open({ startYear: 2030, endYear: null }, 9999)).toBe(1)
    expect(open({ startYear: 2030, endYear: null }, 2029)).toBe(0)
    expect(open({ startYear: null, endYear: null }, 1900)).toBe(1)
  })

  it('pays a single-year window only in that year', () => {
    const one = (year: number) =>
      otherIncomeStreams(input({ year, incomes: [recurring({ startYear: 2030, endYear: 2030 })] })).length
    expect(one(2029)).toBe(0)
    expect(one(2030)).toBe(1)
    expect(one(2031)).toBe(0)
  })

  it('pays a one-time stream only in its own year', () => {
    const at = (year: number) => otherIncomeStreams(input({ year, incomes: [oneTime()] })).length
    expect(at(YEAR - 1)).toBe(0)
    expect(at(YEAR)).toBe(1)
    expect(at(YEAR + 1)).toBe(0)
  })

  // THE SURVIVORSHIP GATE. The ledger has no post-household cash-flow path
  // (domain rules reference §19), so once nobody is alive NEITHER kind pays.
  // The alive reading is asserted from the SAME `incomes` array in the same
  // test, so a helper that returned nothing for any reason at all cannot pass
  // the dead half by being vacuously empty — which is exactly how the previous
  // version of this test could be satisfied while the one-time arm was
  // ungated.
  it('pays nothing of either kind once no one is alive', () => {
    const incomes = [recurring(), oneTime()]
    expect(otherIncomeStreams(input({ anyAlive: true, incomes })).map((r) => r.kind)).toEqual([
      'recurring',
      'oneTime',
    ])
    expect(otherIncomeStreams(input({ anyAlive: false, incomes }))).toEqual([])
  })

  it('applies the survivorship gate independently of the window', () => {
    // In-window but dead: still nothing. The window test alone cannot say this.
    const rows = otherIncomeStreams(
      input({ anyAlive: false, incomes: [recurring({ startYear: 2030, endYear: 2030 })] }),
    )
    expect(rows).toEqual([])
  })
})

describe('otherIncomeStreams — amounts', () => {
  it('scales an inflation-adjusted recurring amount and leaves an un-adjusted one alone', () => {
    const rows = otherIncomeStreams(
      input({
        inflFactor: 1.5,
        incomes: [
          recurring({ id: 'adj', inflationAdjusted: true }),
          recurring({ id: 'flat', inflationAdjusted: false }),
        ],
      }),
    )
    expect(rows.map((r) => r.amount)).toEqual([15_000, 10_000])
  })

  // The SAME election on the one-time arm, which before plan schema v5 did not
  // exist: an amount was never inflated and the author could not say otherwise.
  it('scales an inflation-adjusted one-time amount and leaves an un-adjusted one alone', () => {
    const rows = otherIncomeStreams(
      input({
        inflFactor: 1.5,
        incomes: [
          oneTime({ id: 'adj', inflationAdjusted: true }),
          oneTime({ id: 'flat', inflationAdjusted: false }),
        ],
      }),
    )
    expect(rows.map((r) => r.amount)).toEqual([37_500, 25_000])
  })

  // The election reaches the LEDGER PAYLOAD too, not just the row's scalar.
  // They are the same double by construction (`record.amount` is assigned from
  // `amount`), and this is what pins that they stay so — a rebuild at the
  // record site that forgot the factor would leave every projection total
  // right and every published ledger line wrong.
  it('carries the elected amount into the record on both kinds', () => {
    const rows = otherIncomeStreams(
      input({
        inflFactor: 1.5,
        incomes: [oneTime({ inflationAdjusted: true }), recurring({ inflationAdjusted: true })],
      }),
    )
    for (const row of rows) expect(row.record.amount).toBe(row.amount)
    expect(rows.map((r) => r.record.amount)).toEqual([37_500, 15_000])
  })

  // THE ZERO-AMOUNT CONTRACT, asserted for BOTH kinds. It is the one rule whose
  // violation is invisible in every projection number: a skipped zero row
  // changes no total (`+= 0` is exact) and only moves the recorder CALL count,
  // so nothing downstream of the sink can see it. Each branch has to be pinned
  // on its own — they are separate arms of the loop, and the recurring case
  // alone would pass a one-time branch that had learned to skip zero.
  it('returns a zero-amount recurring row rather than filtering it out', () => {
    // Dropping it here would leave every projection number identical while
    // changing the recorder call count. The sink, not this module, decides.
    const rows = otherIncomeStreams(
      input({ incomes: [recurring({ id: 'zero', annualAmount: 0 }), recurring({ id: 'paid' })] }),
    )
    expect(rows.map((r) => [r.record.incomeStreamId, r.amount])).toEqual([
      ['zero', 0],
      ['paid', 10_000],
    ])
  })

  it('returns a zero-amount one-time row rather than filtering it out', () => {
    const rows = otherIncomeStreams(
      input({ incomes: [oneTime({ id: 'zero', amount: 0 }), oneTime({ id: 'paid' })] }),
    )
    expect(rows.map((r) => [r.record.incomeStreamId, r.amount])).toEqual([
      ['zero', 0],
      ['paid', 25_000],
    ])
    // The payload goes to the sink too, zero and all — `skipNonPositive` is the
    // sink's rule to apply, and it cannot apply it to a row it never receives.
    expect(rows[0]!.record.amount).toBe(0)
  })
})

describe('otherIncomeStreams — tax routing', () => {
  it('reports every treatment a stream can legally carry', () => {
    const rows = otherIncomeStreams(
      input({
        incomes: [
          recurring({ id: 'r-ord', taxTreatment: 'ordinary' }),
          recurring({ id: 'r-none', taxTreatment: 'none' }),
          oneTime({ id: 'o-ord', taxTreatment: 'ordinary' }),
          oneTime({ id: 'o-cap', taxTreatment: 'capitalGain' }),
          oneTime({ id: 'o-none', taxTreatment: 'none' }),
        ],
      }),
    )
    expect(rows.map((r) => [r.record.incomeStreamId, r.kind, r.taxTreatment])).toEqual([
      ['r-ord', 'recurring', 'ordinary'],
      ['r-none', 'recurring', 'none'],
      ['o-ord', 'oneTime', 'ordinary'],
      ['o-cap', 'oneTime', 'capitalGain'],
      ['o-none', 'oneTime', 'none'],
    ])
  })

  it('returns a none-treated stream as a full row, not a skip', () => {
    // A 'none' row still folds into `incomes.recurring`/`incomes.oneTime` and,
    // when positive, still reaches the ledger. Only the ordinary and capital
    // legs are conditional on treatment.
    const rows = otherIncomeStreams(input({ incomes: [recurring({ taxTreatment: 'none' })] }))
    expect(rows).toHaveLength(1)
    expect(rows[0]!.amount).toBe(10_000)
    expect(rows[0]!.record.amount).toBe(10_000)
  })
})

describe('otherIncomeStreams — row identity and order', () => {
  // Row ORDER is pinned HERE, not in the delegation test: reversing the
  // returned rows is a permutation, and the delegation test's fold guards catch
  // kind-grouping but not a general permutation. This is the assertion that
  // fails by name if the return order ever changes.
  it('returns rows in plan.incomes order, interleaving kinds', () => {
    const rows = otherIncomeStreams(
      input({
        incomes: [
          oneTime({ id: 'first' }),
          recurring({ id: 'second' }),
          oneTime({ id: 'third' }),
          recurring({ id: 'fourth' }),
        ],
      }),
    )
    expect(rows.map((r) => r.record.incomeStreamId)).toEqual(['first', 'second', 'third', 'fourth'])
    expect(rows.map((r) => r.kind)).toEqual(['oneTime', 'recurring', 'oneTime', 'recurring'])
  })

  // KEYED BY POSITION, NEVER BY ID. `parsePlan` accepts duplicate income-stream
  // ids (it guards action, person and account ids, but not these), so two
  // streams may legally share one. A map-by-id anywhere in this pipeline would
  // collapse them into a single row.
  it('keeps duplicate-id streams as separate rows', () => {
    const rows = otherIncomeStreams(
      input({
        incomes: [
          recurring({ id: 'dup', annualAmount: 1_000 }),
          recurring({ id: 'dup', annualAmount: 2_000 }),
          oneTime({ id: 'dup', amount: 3_000 }),
        ],
      }),
    )
    expect(rows).toHaveLength(3)
    expect(rows.map((r) => r.amount)).toEqual([1_000, 2_000, 3_000])
    expect(new Set(rows.map((r) => r.record.incomeStreamId))).toEqual(new Set(['dup']))
  })

  it('carries the row’s own amount into its ledger payload', () => {
    const rows = otherIncomeStreams(input({ inflFactor: 1.5, incomes: [recurring({ inflationAdjusted: true })] }))
    const row = rows[0]!
    // The caller folds `row.amount` and publishes `row.record` unrebuilt, so
    // the two must be the same double.
    expect(row.record.amount).toBe(row.amount)
    expect(row.record.incomeStreamId).toBe('rec')
    expect(row.record.taxTreatment).toBe(row.taxTreatment)
  })

  it('returns a materialized array, not a lazy iterable', () => {
    // The delegation test's record attribution depends on every row existing by
    // the time the call returns. Pinned at both ends.
    const rows = otherIncomeStreams(input({ incomes: [recurring(), oneTime()] }))
    expect(Array.isArray(rows)).toBe(true)
    expect(rows).toHaveLength(2)
  })

  it('returns no rows, rather than throwing, when nothing contributes', () => {
    expect(otherIncomeStreams(input({ incomes: [] }))).toEqual([])
    // A year outside every window. Note it takes a BOUNDED stream to empty the
    // list: the default fixture's window is open at both ends, so it pays in
    // 1900 too — which is the contract, not a bug.
    expect(
      otherIncomeStreams(input({ year: 1900, incomes: [recurring({ startYear: 2030, endYear: 2032 }), oneTime()] })),
    ).toEqual([])
  })
})

describe('otherIncomeStreams — purity', () => {
  it('does not mutate the streams it was handed', () => {
    const streams = [recurring({ inflationAdjusted: true }), oneTime()]
    const before = JSON.stringify(streams)
    otherIncomeStreams(input({ incomes: streams, inflFactor: 2.5 }))
    expect(JSON.stringify(streams)).toBe(before)
  })

  it('holds no state between calls', () => {
    // The optimizer and Monte Carlo re-enter `simulatePlan` against the same
    // `Plan` repeatedly; a module-scope accumulator would drift across runs.
    const args = input({ incomes: [recurring(), oneTime()] })
    const first = otherIncomeStreams(args)
    const second = otherIncomeStreams(args)
    expect(second.map((r) => r.amount)).toEqual(first.map((r) => r.amount))
    // Fresh objects each call, so a caller cannot alias one run's rows into
    // another's.
    expect(second[0]).not.toBe(first[0])
  })
})
