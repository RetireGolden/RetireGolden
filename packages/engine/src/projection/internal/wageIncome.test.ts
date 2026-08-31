/**
 * Contract tests for income pass 1 — wages.
 *
 * These pin the helper in isolation: the stop rule and its short-circuit, the
 * amount expression operand for operand, and the row-per-STREAM shape. What
 * they CANNOT see is whether `simulatePlan` actually calls this function — a
 * byte-identical differential dump passes an orphaned helper, and so do these.
 * That is `simulate.wageIncomeDelegation.test.ts`'s job.
 */
import { describe, expect, it } from 'vitest'

import type { IncomeStream, Person } from '../../model/plan.js'
import type { PersonYearState } from './types/yearLedger.js'
import { wageIncome, type WageIncomeYearInput } from './wageIncome.js'

const START_YEAR = 2026

const person = (id: string, retirementAge: number | null): Person => ({
  id,
  name: id,
  dob: '1966-01-01',
  sex: 'average',
  retirementAge,
  longevity: { planningAge: 90, source: 'manual' },
})

const state = (personId: string, ageAttained: number, alive = true): PersonYearState => ({
  personId,
  ageAttained,
  alive,
  lifeAge: 90,
})

const wages = (
  id: string,
  personId: string,
  annualGross: number,
  extra: Partial<{ endAge: number | null; realGrowthPct: number }> = {},
): IncomeStream =>
  ({
    type: 'wages',
    id,
    personId,
    annualGross,
    endAge: extra.endAge === undefined ? null : extra.endAge,
    realGrowthPct: extra.realGrowthPct === undefined ? 0 : extra.realGrowthPct,
  }) as IncomeStream

const recurring = (id: string): IncomeStream =>
  ({
    type: 'recurring',
    id,
    label: id,
    annualAmount: 1_000,
    startYear: null,
    endYear: null,
    inflationAdjusted: false,
    taxTreatment: 'ordinary',
  }) as IncomeStream

function call(
  incomes: readonly IncomeStream[],
  overrides: Partial<WageIncomeYearInput> = {},
) {
  return wageIncome({
    incomes,
    year: START_YEAR,
    startYear: START_YEAR,
    inflFactor: 1,
    personById: new Map([['p1', person('p1', 65)]]),
    peopleStates: [state('p1', 60)],
    ...overrides,
  })
}

describe('wageIncome — selection and the stop rule', () => {
  it('returns one row per contributing wages stream, in incomes order', () => {
    const rows = call([wages('w-b', 'p1', 50_000), recurring('r'), wages('w-a', 'p1', 20_000)])
    expect(rows.map((r) => r.incomeStreamId)).toEqual(['w-b', 'w-a'])
  })

  it('returns one row per STREAM even when two streams pay one person', () => {
    // `model/plan.ts` puts no uniqueness on `personId`. A helper that
    // pre-aggregated per person would move no money and would halve the
    // recorder call count, publishing one ledger line where two belong.
    const rows = call([wages('w-1', 'p1', 50_000), wages('w-2', 'p1', 20_000)])
    expect(rows.map((r) => [r.personId, r.amount])).toEqual([
      ['p1', 50_000],
      ['p1', 20_000],
    ])
  })

  it('keeps two streams that share an id as two rows', () => {
    // `parsePlan` accepts duplicate income-stream ids, and the published ledger
    // line id is derived from that id — any map-by-id would collapse these.
    expect(call([wages('same', 'p1', 10), wages('same', 'p1', 20)]).length).toBe(2)
  })

  it('skips every stream that is not wages', () => {
    expect(call([recurring('r')])).toEqual([])
  })

  it('stops at the stream’s own endAge when it has one', () => {
    const streams = [wages('w', 'p1', 50_000, { endAge: 62 })]
    expect(call(streams, { peopleStates: [state('p1', 61)] }).length).toBe(1)
    // `>= stopAge`: the stop year itself pays nothing.
    expect(call(streams, { peopleStates: [state('p1', 62)] })).toEqual([])
    expect(call(streams, { peopleStates: [state('p1', 63)] })).toEqual([])
  })

  it('falls back to the person’s retirementAge when endAge is null', () => {
    const streams = [wages('w', 'p1', 50_000)]
    expect(call(streams, { peopleStates: [state('p1', 64)] }).length).toBe(1)
    expect(call(streams, { peopleStates: [state('p1', 65)] })).toEqual([])
  })

  it('never stops when endAge and retirementAge are both null', () => {
    const rows = call([wages('w', 'p1', 50_000)], {
      personById: new Map([['p1', person('p1', null)]]),
      peopleStates: [state('p1', 99)],
    })
    expect(rows.length).toBe(1)
  })

  it('stops when the person is not alive, whatever the ages say', () => {
    expect(call([wages('w', 'p1', 50_000)], { peopleStates: [state('p1', 60, false)] })).toEqual([])
  })

  it('reads retirementAge ONLY when endAge is nullish', () => {
    // The `??` short-circuit is what makes `stateOf`'s non-null assertion the
    // thing that throws on an unknown personId. A pre-resolved stop age would
    // silently let the wage PAY instead.
    let reads = 0
    const watched = new Proxy(person('p1', 65), {
      get(target, prop, receiver) {
        if (prop === 'retirementAge') reads++
        return Reflect.get(target, prop, receiver) as unknown
      },
    })
    const personById = new Map([['p1', watched]])
    call([wages('w', 'p1', 50_000, { endAge: 70 })], { personById })
    expect(reads, 'endAge present: retirementAge must not be read').toBe(0)
    call([wages('w', 'p1', 50_000)], { personById })
    expect(reads, 'endAge null: retirementAge is read').toBe(1)
  })

  it('throws on an unknown personId rather than paying the wage', () => {
    expect(() => call([wages('w', 'ghost', 50_000)])).toThrow()
  })
})

describe('wageIncome — the amount', () => {
  it('multiplies gross, raise factor and inflation factor strictly left to right', () => {
    // `toBe`, never `toBeCloseTo`: re-grouping this product as
    // `gross * (raise * infl)` is a different double, and that exact
    // re-association moves 52 of the 228 differential-corpus entries while
    // every existing wages test in the repository passes either way.
    // These three constants are not decorative: they were searched for, because
    // most triples re-associate exactly and would leave the second assertion
    // vacuous.
    const [row] = call([wages('w', 'p1', 92_137.41, { realGrowthPct: 2.7 })], {
      year: START_YEAR + 3,
      inflFactor: 1.1234567,
    })
    const raiseFactor = Math.pow(1 + 2.7 / 100, 3)
    expect(row!.amount).toBe(92_137.41 * raiseFactor * 1.1234567)
    expect(row!.amount).not.toBe(92_137.41 * (raiseFactor * 1.1234567))
  })

  it('compounds the raise from the START year, not from the stream', () => {
    const streams = [wages('w', 'p1', 100_000, { realGrowthPct: 3 })]
    expect(call(streams, { year: START_YEAR }).at(0)!.amount).toBe(100_000)
    expect(call(streams, { year: START_YEAR + 1 }).at(0)!.amount).toBe(100_000 * 1.03)
  })

  it('treats a missing realGrowthPct as zero', () => {
    const bare = { type: 'wages', id: 'w', personId: 'p1', annualGross: 50_000, endAge: null } as IncomeStream
    expect(call([bare], { year: START_YEAR + 4 }).at(0)!.amount).toBe(50_000)
  })

  it('returns a zero-amount row rather than filtering it out', () => {
    // The sink applies the non-positive drop, not this phase: filtering here
    // would move no money and would change the recorder call count.
    const [row] = call([wages('w', 'p1', 0)])
    expect(row!.amount).toBe(0)
    expect(row!.record.amount).toBe(0)
  })
})

describe('wageIncome — the row payload', () => {
  it('builds the ledger payload from the row’s own double', () => {
    const [row] = call([wages('w', 'p1', 50_000)])
    expect(row!.record).toEqual({ incomeStreamId: 'w', personId: 'p1', amount: 50_000 })
    expect(row!.record.amount).toBe(row!.amount)
    expect(row!.record.incomeStreamId).toBe(row!.incomeStreamId)
    expect(row!.record.personId).toBe(row!.personId)
  })
})

describe('wageIncome — purity and structure', () => {
  const STREAMS = [wages('w-1', 'p1', 50_000), wages('w-2', 'p1', 20_000)]

  it('returns a materialized array, not a lazy iterable', () => {
    const rows = call(STREAMS)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(2)
  })

  it('holds no state between calls', () => {
    const first = call(STREAMS)
    const second = call(STREAMS)
    expect(second).toEqual(first)
    expect(second[0]).not.toBe(first[0])
  })

  it('mutates nothing it was handed', () => {
    const streams = structuredClone(STREAMS)
    const before = structuredClone(streams)
    const peopleStates = [state('p1', 60)]
    call(streams, { peopleStates })
    expect(streams).toEqual(before)
    expect(peopleStates).toEqual([state('p1', 60)])
  })
})
