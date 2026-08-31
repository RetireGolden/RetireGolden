/**
 * Contract tests for the HECM line-open phase.
 *
 * These pin the helper in isolation: the five guards, the two arithmetic
 * expressions operand for operand, the PLF-table fallback, the age-62 warning
 * and the open-as-you-go rule. What they CANNOT see is whether `simulatePlan`
 * actually calls this function — a byte-identical differential dump passes an
 * orphaned helper, and so do these. That is
 * `simulate.hecmLineOpeningsDelegation.test.ts`'s job.
 *
 * TWO ARMS HERE HAVE NO OTHER TEST IN THE REPOSITORY, which is why they are
 * pinned exactly rather than loosely: the under-62 warning string occurs at its
 * emission site and nowhere else, and `hecmPrincipalLimitFactorPct` has no
 * direct unit test at all, so the `principalLimitPct ?? …` fallback arm was
 * reachable through a validated plan and untested.
 */
import { describe, expect, it } from 'vitest'

import type { Account, Person } from '../../model/plan.js'
import { hecmPrincipalLimitFactorPct, packForYear } from '../../params/index.js'
import { hecmLineOpenings, type HecmLineOpeningYearInput, type HecmLineState } from './hecmLineOpenings.js'

const START_YEAR = 2026
const { pack } = packForYear(START_YEAR)

const person = (id: string, dob: string): Person => ({
  id,
  name: id,
  dob,
  sex: 'average',
  retirementAge: 65,
  longevity: { planningAge: 90, source: 'manual' },
})

const dobYear = (p: Person): number => Number(p.dob.slice(0, 4))

/** Age 70 in 2026, so the age-62 warning is off unless a fixture opts in. */
const OLD = person('p1', '1956-01-01')
/** Age 56 in 2026: under 62 at open. */
const YOUNG = person('p2', '1970-01-01')

const property = (id: string, hecm: Record<string, unknown> | null): Account =>
  ({
    type: 'property',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    value: 500_000,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    ...(hecm === null ? {} : { hecm: { openYear: START_YEAR, growthRatePct: 7.5, drawPolicy: 'lastResort', ...hecm } }),
  }) as Account

const cash = (id: string): Account =>
  ({ type: 'cash', id, name: id, ownerPersonId: null, annualReturnPct: 0, balance: 1, annualContribution: 0 }) as Account

function call(
  accounts: readonly Account[],
  overrides: Partial<HecmLineOpeningYearInput> = {},
): readonly { propertyAccountId: string; state: HecmLineState; warning: string | null }[] {
  return hecmLineOpenings({
    accounts,
    year: START_YEAR,
    startYear: START_YEAR,
    propertyValues: new Map(accounts.filter((a) => a.type === 'property').map((a) => [a.id, 500_000])),
    openHecmLines: new Map(),
    people: [OLD],
    dobYear,
    pack,
    ...overrides,
  })
}

describe('hecmLineOpenings — the five guards', () => {
  it('opens a line for a property account carrying a hecm block, in accounts order', () => {
    const rows = call([cash('c'), property('home-b', { principalLimitPct: 40 }), property('home-a', { principalLimitPct: 40 })])
    expect(rows.map((r) => r.propertyAccountId)).toEqual(['home-b', 'home-a'])
  })

  it('skips an account that is not property, and a property with no hecm block', () => {
    expect(call([cash('c'), property('plain', null)])).toEqual([])
  })

  it('opens in max(openYear, startYear): before, at, and after the projection opens', () => {
    const before = property('home', { openYear: START_YEAR - 4, principalLimitPct: 40 })
    // A line dated before the projection opens IN the first projected year.
    expect(call([before], { year: START_YEAR }).length).toBe(1)
    expect(call([before], { year: START_YEAR - 4 }).length).toBe(0)
    const future = property('home', { openYear: START_YEAR + 6, principalLimitPct: 40 })
    expect(call([future], { year: START_YEAR }).length).toBe(0)
    expect(call([future], { year: START_YEAR + 6 }).length).toBe(1)
    expect(call([future], { year: START_YEAR + 7 }).length).toBe(0)
  })

  it('skips an id whose line is ALREADY open', () => {
    const rows = call([property('home', { principalLimitPct: 40 })], {
      openHecmLines: new Map([['home', { principalLimit: 1, loanBalance: 2 }]]),
    })
    expect(rows).toEqual([])
  })

  it('skips a property whose value is not above zero', () => {
    const accounts = [property('home', { principalLimitPct: 40 })]
    expect(call(accounts, { propertyValues: new Map([['home', 0]]) })).toEqual([])
    expect(call(accounts, { propertyValues: new Map([['home', -1]]) })).toEqual([])
    // The `?? 0` fallback: an id with no entry at all is treated as zero.
    expect(call(accounts, { propertyValues: new Map() })).toEqual([])
  })
})

describe('hecmLineOpenings — the arithmetic', () => {
  // `toBe`, never `toBeCloseTo`: rewriting `(pct / 100) * value` as
  // `pct * value / 100` is a different IEEE-754 result, and the only existing
  // assertion on this output in the repository uses a precision of 0.
  it('computes both scalars operand for operand', () => {
    const [row] = call([property('home', { principalLimitPct: 41.7, upfrontCostPct: 2.3 })], {
      propertyValues: new Map([['home', 327_411.13]]),
    })
    expect(row!.state.principalLimit).toBe((41.7 / 100) * 327_411.13)
    expect(row!.state.loanBalance).toBe((2.3 / 100) * 327_411.13)
  })

  it('treats an omitted upfrontCostPct as zero', () => {
    const [row] = call([property('home', { principalLimitPct: 40 })])
    expect(row!.state.loanBalance).toBe(0)
  })

  it('falls back to the pack’s PLF-by-age table when principalLimitPct is omitted', () => {
    // Nothing else in the repository reaches this arm, and
    // `hecmPrincipalLimitFactorPct` has no direct unit test of its own — so the
    // expectation is re-derived from the pack here rather than hard-coded.
    const [row] = call([property('home', { upfrontCostPct: 2.5 })], {
      propertyValues: new Map([['home', 600_000]]),
    })
    const plfPct = hecmPrincipalLimitFactorPct(pack, START_YEAR - dobYear(OLD))
    expect(row!.state.principalLimit).toBe((plfPct / 100) * 600_000)
    // And the fallback really is a different number from a quoted one, so the
    // assertion above is not vacuously satisfied by a coincidence.
    expect(plfPct).not.toBe(0)
  })

  it('uses the YOUNGEST borrower’s age for the PLF fallback', () => {
    const [oneOld] = call([property('home', { upfrontCostPct: 0 })], { people: [OLD] })
    const [withYoung] = call([property('home', { upfrontCostPct: 0 })], { people: [OLD, YOUNG] })
    expect(withYoung!.state.principalLimit).toBe(
      (hecmPrincipalLimitFactorPct(pack, START_YEAR - dobYear(YOUNG)) / 100) * 500_000,
    )
    expect(withYoung!.state.principalLimit).not.toBe(oneOld!.state.principalLimit)
  })
})

describe('hecmLineOpenings — the age-62 warning', () => {
  it('reports the warning when the youngest borrower is under 62 at open', () => {
    const [row] = call([property('home', { principalLimitPct: 40 })], { people: [OLD, YOUNG] })
    expect(row!.warning).toBe(
      'A HECM line of credit was modeled before the youngest borrower turns 62 (real HECMs require age 62+).',
    )
  })

  it('reports no warning at exactly 62, and none above it', () => {
    const exactly62 = person('p3', `${START_YEAR - 62}-01-01`)
    expect(call([property('home', { principalLimitPct: 40 })], { people: [exactly62] })[0]!.warning).toBeNull()
    expect(call([property('home', { principalLimitPct: 40 })], { people: [OLD] })[0]!.warning).toBeNull()
  })
})

describe('hecmLineOpenings — the open-as-you-go rule', () => {
  it('opens only the FIRST of two property accounts sharing an id', () => {
    // `model/plan.ts` raises `duplicate account id` only when a retirement
    // action references the id, so this is a valid plan. The inlined phase
    // wrote into `hecmStates` inside its own loop, so the second account met
    // its own already-open guard.
    const rows = call([property('twin', { principalLimitPct: 42 }), property('twin', { principalLimitPct: 33 })])
    expect(rows.length).toBe(1)
    // And it is the FIRST account's factor that is used.
    expect(rows[0]!.state.principalLimit).toBe((42 / 100) * 500_000)
    // Distinct ids on the same inputs open TWO lines, so the assertion above is
    // about the shared id rather than about a fixture that only opens once.
    expect(call([property('a', { principalLimitPct: 42 }), property('b', { principalLimitPct: 33 })]).length).toBe(2)
  })
})

describe('hecmLineOpenings — purity and structure', () => {
  const ACCOUNTS = [property('home-a', { principalLimitPct: 40, upfrontCostPct: 2 }), property('home-b', { principalLimitPct: 30 })]

  it('returns a materialized array, not a lazy iterable', () => {
    const rows = call(ACCOUNTS)
    expect(Array.isArray(rows)).toBe(true)
    expect(rows.length).toBe(2)
  })

  it('gives every row its own state object', () => {
    // A hoisted literal pushed twice would alias two independent lines into
    // one, and the caller mutates these objects in place all year.
    const rows = call([property('home-a', { principalLimitPct: 40 }), property('home-b', { principalLimitPct: 40 })])
    expect(rows[0]!.state).toEqual(rows[1]!.state)
    expect(rows[0]!.state).not.toBe(rows[1]!.state)
  })

  it('holds no state between calls', () => {
    const first = call(ACCOUNTS)
    const second = call(ACCOUNTS)
    expect(second).toEqual(first)
    expect(second[0]!.state).not.toBe(first[0]!.state)
  })

  it('mutates neither the accounts nor either map it was handed', () => {
    const accounts = [property('home', { principalLimitPct: 40, upfrontCostPct: 2 })]
    const propertyValues = new Map([['home', 500_000]])
    const openHecmLines = new Map<string, HecmLineState>()
    const before = structuredClone(accounts)
    call(accounts, { propertyValues, openHecmLines })
    expect(accounts).toEqual(before)
    expect([...propertyValues]).toEqual([['home', 500_000]])
    expect(openHecmLines.size).toBe(0)
  })
})
