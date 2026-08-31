/**
 * The income-pass-1 phase's CONTRACT, tested directly.
 *
 * These tests exercise the helper through its own interface rather than
 * restating its implementation. What is pinned here is what the module owns:
 * which wage streams pay in a given year (the two gates, and where the stop age
 * comes from), what each paying stream pays (the real-raise and inflation
 * factors, in that operand order), and — the parts the delegation test
 * deliberately cannot check — that rows come back in `plan.incomes` ORDER, that
 * they are keyed by POSITION rather than by stream id, and that the two person
 * lookups are kept separate because they disagree.
 *
 * `internal/*` is null-exported from the package (`"./projection/internal/*":
 * null`), so none of this joins the published surface.
 */
import { describe, expect, it } from 'vitest'

import type { IncomeStream, Person } from '../../model/plan.js'
import type { PersonYearState } from '../types.js'
import { wageIncomeStreams, type WageIncomeYearInput } from './wageIncomeStreams.js'

const START_YEAR = 2026
const YEAR = 2030

function person(over: Partial<Person> = {}): Person {
  return {
    id: 'p1',
    name: 'Pat',
    dob: '1976-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
    ...over,
  }
}

function state(over: Partial<PersonYearState> = {}): PersonYearState {
  return { personId: 'p1', ageAttained: 54, alive: true, ...over }
}

function wages(over: Partial<Extract<IncomeStream, { type: 'wages' }>> = {}): IncomeStream {
  return {
    type: 'wages',
    id: 'w1',
    personId: 'p1',
    annualGross: 100_000,
    endAge: null,
    realGrowthPct: 0,
    ...over,
  }
}

/**
 * The default input: one wage stream, one person, alive and inside the window.
 * `inflFactor` is deliberately not 1 so a caller that dropped it would be
 * visible rather than hidden behind a no-op multiplication.
 */
function input(over: Partial<WageIncomeYearInput> = {}): WageIncomeYearInput {
  const people = [person()]
  const states = [state()]
  return {
    incomes: [wages()],
    personById: new Map(people.map((p) => [p.id, p])),
    stateOf: (personId) => states.find((s) => s.personId === personId)!,
    year: YEAR,
    startYear: START_YEAR,
    inflFactor: 1.5,
    ...over,
  }
}

/** Convenience: build the two lookups from explicit lists, preserving order. */
function lookups(people: Person[], states: PersonYearState[]) {
  return {
    personById: new Map(people.map((p) => [p.id, p])),
    stateOf: (personId: string) => states.find((s) => s.personId === personId)!,
  }
}

describe('wageIncomeStreams — selection', () => {
  // The other three `plan.incomes` kinds each belong to a different pass —
  // Social Security to pass 3, recurring and one-time to pass 2 — and each is
  // already folded into its own accumulator there. A row emitted here for any
  // of them would be counted a SECOND time, into `incomes.wages` and into
  // `ordinaryIncome`. Asserting the id list rather than the length is what
  // makes the wrong stream nameable.
  it('skips the passes it does not own', () => {
    const rows = wageIncomeStreams(
      input({
        incomes: [
          { type: 'socialSecurity', id: 'ss', personId: 'p1', piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
          { type: 'recurring', id: 'rec', label: 'Rental', annualAmount: 10_000, startYear: null, endYear: null, inflationAdjusted: false, taxTreatment: 'ordinary' },
          { type: 'oneTime', id: 'once', label: 'Windfall', year: YEAR, amount: 25_000, taxTreatment: 'ordinary' },
          wages({ id: 'w-only' }),
        ],
      }),
    )
    expect(rows.map((r) => r.record.incomeStreamId)).toEqual(['w-only'])
  })

  // ROW ORDER IS PLAN ORDER, and it is load-bearing at the call site: every row
  // folds into the same `ordinaryIncome`, and IEEE-754 addition is not
  // associative once that accumulator is non-zero. A helper that grouped rows
  // by person — the obvious "tidy" — would be a re-ordering.
  it('returns rows in plan.incomes order, not grouped by person', () => {
    const people = [person(), person({ id: 'p2', name: 'Sam' })]
    const states = [state(), state({ personId: 'p2' })]
    const rows = wageIncomeStreams(
      input({
        incomes: [wages({ id: 'a', personId: 'p1' }), wages({ id: 'b', personId: 'p2' }), wages({ id: 'c', personId: 'p1' })],
        ...lookups(people, states),
      }),
    )
    expect(rows.map((r) => r.record.incomeStreamId)).toEqual(['a', 'b', 'c'])
    expect(rows.map((r) => r.personId)).toEqual(['p1', 'p2', 'p1'])
  })

  // ROWS ARE KEYED BY POSITION, NEVER BY STREAM ID. `parsePlan` raises
  // UNCONDITIONALLY only on duplicate retirement-action ids; duplicate account
  // and person ids raise only when a retirement action references them
  // (`model/plan.ts`) — the same conditional rule the two-lookups tests at the
  // bottom of this file depend on. Income-stream ids are not checked for
  // uniqueness at all, so two wage streams can share one id. Any map-by-id,
  // here or in a caller reconciling these rows, would collapse them and
  // silently halve the year's wages.
  it('returns one row per stream even when two streams share an id', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ id: 'dup', annualGross: 10 }), wages({ id: 'dup', annualGross: 20 })] }),
    )
    expect(rows.length).toBe(2)
    expect(rows.map((r) => r.amount)).toEqual([15, 30])
  })

  it('skips a stream whose owner is not alive, even inside the age window', () => {
    const rows = wageIncomeStreams(input({ stateOf: () => state({ alive: false, ageAttained: 54 }) }))
    expect(rows).toEqual([])
  })
})

describe('wageIncomeStreams — where the stop age comes from', () => {
  it('falls back to the person’s retirementAge when the stream names no endAge', () => {
    const paying = wageIncomeStreams(
      input({ incomes: [wages({ endAge: null })], ...lookups([person({ retirementAge: 55 })], [state({ ageAttained: 54 })]) }),
    )
    expect(paying.length).toBe(1)
    const stopped = wageIncomeStreams(
      input({ incomes: [wages({ endAge: null })], ...lookups([person({ retirementAge: 55 })], [state({ ageAttained: 55 })]) }),
    )
    expect(stopped).toEqual([])
  })

  // Both override directions, because a stream that only ever shortened the
  // working life would pass a test that checked one of them.
  it('lets endAge override retirementAge downward', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ endAge: 50 })], ...lookups([person({ retirementAge: 70 })], [state({ ageAttained: 54 })]) }),
    )
    expect(rows).toEqual([])
  })

  it('lets endAge override retirementAge upward', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ endAge: 70 })], ...lookups([person({ retirementAge: 50 })], [state({ ageAttained: 54 })]) }),
    )
    expect(rows.length).toBe(1)
  })

  // REACHABLE, NOT DEFENSIVE. `retirementAge` is nullable in the plan model and
  // `endAge` is required-nullable, so a person can legitimately have no stop
  // age at all. Treating the fallback as always-a-number — or collapsing the
  // null to 0 — would stop such a person from ever working.
  it('never stops a stream when both endAge and retirementAge are null', () => {
    const rows = wageIncomeStreams(
      input({
        incomes: [wages({ endAge: null })],
        ...lookups([person({ retirementAge: null })], [state({ ageAttained: 99 })]),
      }),
    )
    expect(rows.length).toBe(1)
  })

  // The gate is `>=`, so the stop age itself is the FIRST unpaid year.
  it('pays the year before the stop age and not the stop-age year itself', () => {
    const at = (ageAttained: number) =>
      wageIncomeStreams(input({ incomes: [wages({ endAge: 62 })], ...lookups([person()], [state({ ageAttained })]) })).length
    expect(at(61)).toBe(1)
    expect(at(62)).toBe(0)
    expect(at(63)).toBe(0)
  })
})

describe('wageIncomeStreams — the amount', () => {
  it('is gross × real raise × inflation, in that operand order', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ annualGross: 137_777.77, realGrowthPct: 1.3 })], year: 2039, inflFactor: 1.3448888 }),
    )
    // Re-derived, not copied: the same three operands multiplied left to right.
    // `toBe`, because multiplication is not associative in IEEE-754 either and
    // the bracketing is part of the contract.
    expect(rows[0]!.amount).toBe(137_777.77 * Math.pow(1 + 1.3 / 100, 2039 - START_YEAR) * 1.3448888)
  })

  it('applies no real raise in the start year', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ annualGross: 90_000, realGrowthPct: 4 })], year: START_YEAR, inflFactor: 1 }),
    )
    expect(rows[0]!.amount).toBe(90_000)
  })

  // THE `?? 0` FALLBACK, WHICH IS THE ONE SUB-BRANCH THE DIFFERENTIAL DUMP
  // CANNOT REACH. `model/plan.ts` declares `realGrowthPct: pct.default(0)` over
  // a non-nullable number, so no plan that has been through `parsePlan` can
  // carry `undefined` there — measured, 0 of 77 corpus members reach it, and
  // the fuzz generator cannot produce it by construction. `simulatePlan` takes
  // a raw `Plan` though, and this helper takes a raw `IncomeStream`, so the
  // branch IS reachable from here. It is pinned by this test and by nothing
  // else in the phase.
  it('treats a missing realGrowthPct as no real raise at all', () => {
    const rows = wageIncomeStreams(
      input({
        incomes: [wages({ annualGross: 137_777.77, realGrowthPct: undefined as unknown as number })],
        year: 2039,
        inflFactor: 1.3448888,
      }),
    )
    // Raise factor exactly 1 over 13 elapsed years: gross × 1 × inflFactor.
    expect(rows[0]!.amount).toBe(137_777.77 * 1 * 1.3448888)
    // Not vacuous — 13 elapsed years is long enough that any non-zero default
    // would land somewhere else.
    expect(rows[0]!.amount).not.toBe(137_777.77 * Math.pow(1 + 0.01 / 100, 2039 - START_YEAR) * 1.3448888)
  })

  it('compounds the real raise over elapsed years, not calendar years', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ annualGross: 1_000, realGrowthPct: 10 })], year: 2029, startYear: 2026, inflFactor: 1 }),
    )
    expect(rows[0]!.amount).toBe(1_000 * Math.pow(1.1, 3))
  })

  // A ZERO-AMOUNT ROW IS STILL A ROW. The sink drops non-positive amounts;
  // filtering here would leave every projection number identical while changing
  // the recorder CALL count, so the row has to come back.
  it('returns a row for a zero-gross stream inside its window', () => {
    const rows = wageIncomeStreams(input({ incomes: [wages({ annualGross: 0 })] }))
    expect(rows.length).toBe(1)
    expect(rows[0]!.amount).toBe(0)
    expect(rows[0]!.record.amount).toBe(0)
  })
})

describe('wageIncomeStreams — the row and its ledger payload', () => {
  // WHAT AN AMOUNT COMPARISON CAN AND CANNOT SHOW, said plainly because an
  // earlier version of this test was named for the stronger claim. Comparing
  // `record.amount` with `row.amount` — by `toBe`, which is `Object.is` — is a
  // VALUE check and nothing more: equal doubles are indistinguishable in
  // JavaScript, so a record whose amount had been RECOMPUTED by the same
  // `annualGross * raiseFactor * inflFactor` expression would satisfy it too.
  // Number identity is not observable; that is why the identity half below is
  // asserted on the record OBJECT, which is.
  //
  // The value check still earns its place: it fails on a record built from a
  // DIFFERENT double, and both of the ways that happens are measured on this
  // test rather than asserted. Rounding the record amount to cents fails it by
  // name (`expected 241770.76 to be 241770.7554183168`), and so does
  // re-bracketing the product to `annualGross * (raiseFactor * inflFactor)`
  // (`expected 241770.75541831684 to be 241770.7554183168`) — 1 failed, 21
  // passed, on each.
  //
  // THE 4% REAL RAISE BELOW IS WHAT BUYS THE SECOND OF THOSE, and it is here
  // deliberately rather than incidentally. `wages()` defaults `realGrowthPct` to
  // 0, which makes the raise factor exactly 1, and `gross * 1 * infl` and
  // `gross * (1 * infl)` are then the SAME double — measured on the default
  // fixture, the re-bracketing injection left this whole file green (22 passed)
  // and failed, in the delegation test, only G3 and G5, which run that fixture's
  // own non-zero growth rates and cumulative inflation factors. Those two files
  // are the whole of that measurement. A test cannot claim to catch a defect its
  // own fixture makes invisible, so this one's fixture was sized until it does.
  //
  // The value check is also what makes the caller's fold and the ledger line it
  // publishes statements about ONE number rather than two. What makes the
  // delegation test's `toBe` on the record work is the CALLER publishing this
  // object unrebuilt, which that test asserts and this one cannot.
  it('gives each row its own record, carrying the row’s amount and ids', () => {
    const rows = wageIncomeStreams(
      input({ incomes: [wages({ id: 'w-x', personId: 'p1', annualGross: 137_777.77, realGrowthPct: 4 })] }),
    )
    const row = rows[0]!
    expect(row.record.amount, 'the record amount is not the row amount').toBe(row.amount)
    expect(row.record.incomeStreamId).toBe('w-x')
    expect(row.record.personId).toBe('p1')
    expect(row.personId).toBe('p1')
    // ONE RECORD PER ROW, which IS identity-bearing and which the delegation
    // test's positional `toBe` comparison leans on: two rows sharing a single
    // record object would let a caller publish that one object twice and still
    // match both rows.
    const two = wageIncomeStreams(input({ incomes: [wages({ id: 'a' }), wages({ id: 'b' })] }))
    expect(two.length).toBe(2)
    expect(two[0]!.record).not.toBe(two[1]!.record)
  })

  // EAGERNESS is what makes the delegation test's positional attribution of
  // ledger records to phase calls sound, so it is pinned here rather than
  // assumed there.
  it('returns a materialized array, not a lazy iterable', () => {
    const rows = wageIncomeStreams(input())
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(1)
  })
})

describe('wageIncomeStreams — purity', () => {
  it('holds no state between calls', () => {
    const first = wageIncomeStreams(input())
    const second = wageIncomeStreams(input())
    expect(second.length).toBe(first.length)
    expect(second[0]!.amount).toBe(first[0]!.amount)
    expect(second[0]!.record).not.toBe(first[0]!.record)
  })

  it('mutates neither the stream list nor the person lookups', () => {
    const stream = Object.freeze(wages())
    const people = [Object.freeze(person())]
    const states = [Object.freeze(state())]
    const incomes = Object.freeze([stream])
    const personById = new Map(people.map((p) => [p.id, p]))
    const rows = wageIncomeStreams({
      incomes,
      personById,
      stateOf: (personId) => states.find((s) => s.personId === personId)!,
      year: YEAR,
      startYear: START_YEAR,
      inflFactor: 1.5,
    })
    expect(rows.length).toBe(1)
    expect(incomes).toEqual([stream])
    expect(personById.size).toBe(1)
    expect(states[0]).toEqual(state())
  })
})

describe('wageIncomeStreams — the two person lookups disagree, and that is preserved', () => {
  // `personById` is a Map (LAST wins) and `stateOf` is a `find` over an array
  // (FIRST wins). `parsePlan` raises on a duplicate person id only when a
  // retirement action references it, so a household with two people sharing an
  // id and no such action is a real, parseable plan — and there the two
  // adjacent lookups resolve to DIFFERENT people. Unifying them would be a
  // silent behaviour change, so both directions are pinned.
  const duplicated = (
    firstRetirementAge: number | null,
    lastRetirementAge: number | null,
    firstState: Partial<PersonYearState>,
    lastState: Partial<PersonYearState>,
  ) =>
    wageIncomeStreams(
      input({
        incomes: [wages({ endAge: null })],
        ...lookups(
          [person({ retirementAge: firstRetirementAge }), person({ retirementAge: lastRetirementAge })],
          [state(firstState), state(lastState)],
        ),
      }),
    )

  it('takes the stop age from the LAST duplicate and the year state from the FIRST', () => {
    // Stop age 60 (last person), age attained 65 (first state) ⇒ stopped.
    // Resolving both by the same rule would pay: last-wins state is 50, and
    // first-wins retirement age is 70.
    expect(duplicated(70, 60, { ageAttained: 65 }, { ageAttained: 50 })).toEqual([])
  })

  it('does not let the LAST duplicate’s year state close a stream the FIRST keeps open', () => {
    // Alive and inside the window on the first state; dead on the last. A
    // helper that resolved the state by last-wins would drop this row.
    const rows = duplicated(70, 70, { ageAttained: 65, alive: true }, { ageAttained: 65, alive: false })
    expect(rows.length).toBe(1)
  })
})

describe('wageIncomeStreams — an unvalidated plan still throws', () => {
  // `parsePlan` rejects a wages stream naming an unknown person, but
  // `simulatePlan` accepts a raw `Plan`, so this path is reachable without the
  // parser. The inlined phase threw on the bare non-null assertion; skipping
  // the stream defensively would silently drop someone's wages instead.
  it('throws rather than skipping a stream whose person is unknown', () => {
    expect(() => wageIncomeStreams(input({ incomes: [wages({ personId: 'nobody' })] }))).toThrow()
  })

  // BEING EAGER MOVED THE THROW EARLIER, and that is named rather than hidden.
  // The inlined loop folded streams 1..k-1 into the year's accumulators before
  // reaching the bad one; the helper throws before the caller folds anything.
  // Nothing observes the difference — the throw escapes `simulatePlan` either
  // way — but the returned rows for the good streams are genuinely lost.
  it('returns nothing at all when a later stream names an unknown person', () => {
    expect(() =>
      wageIncomeStreams(input({ incomes: [wages({ id: 'good' }), wages({ id: 'bad', personId: 'nobody' })] })),
    ).toThrow()
  })
})
