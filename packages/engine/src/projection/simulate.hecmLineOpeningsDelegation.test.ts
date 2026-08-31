/**
 * The seam itself: `simulatePlan` must actually DELEGATE the HECM line-open
 * phase to `internal/hecmLineOpenings.ts`, and must store and warn with exactly
 * the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a differential
 * equivalence dump (`scripts/equivalence.mjs` — the app compared against itself
 * across two source trees; DOCS/testing.md reserves "oracle" for a CORRECTNESS
 * oracle, and this is not one). Identical output is that dump's PASS condition,
 * so it cannot see an orphaned helper. Nothing else in the repository observes
 * the call. This file does.
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording WHICH named tests failed. Measured over
 * this file and the helper's own unit tests together (7 + 16 = 23 tests):
 *
 *   orphan (call site re-inlined from the pristine   5 fail — G1, G2, G3c, G4,
 *   block, helper present and never called)          G5. All 16 helper unit
 *                                                    tests still pass, and so
 *                                                    does the differential dump:
 *                                                    measured, the orphaned tree
 *                                                    reproduced the baseline over
 *                                                    all 228 corpus entries at
 *                                                    the same sha256
 *                                                    ed0fb0bb…1382ae. G3, whose
 *                                                    expectations are entirely
 *                                                    fixture-derived, correctly
 *                                                    PASSES — an orphan moves no
 *                                                    number
 *   half-orphan (helper called for effect, the       1 fails — ONLY G2, on the
 *   inline copy run so the map stores its OWN        line that requires the
 *   `{ principalLimit, loanBalance }` literal)       returned object to have been
 *                                                    mutated in place ("expected
 *                                                    6900 not to be 6900")
 *   under-production: `if (year === 2028) return`    4 fail. G3 by name, on the
 *   no rows for the third line's open year           fixture-derived loan balance
 *                                                    (17230.657656249998 against
 *                                                    34792.93265624999); G1, G2
 *                                                    and G4 only through their
 *                                                    explicit counts and order
 *                                                    lists
 *
 * WHAT G2 DOES AND DOES NOT PROVE HERE, because this phase is unusual. Its
 * whole product is a map write, and value-equality cannot separate "stored the
 * helper's object" from "stored a copy of it" — a caller that wrote
 * `hecmStates.set(id, { ...row.state })` would produce byte-identical
 * projection output. So G2 does not pin a number. What it pins is the SEAM,
 * and it does that by exploiting a property the phase already has: the stored
 * object is MUTATED IN PLACE later in the same year (the line's growth rate
 * multiplies both fields; a coordinated or backstop draw adds to the balance).
 * If the caller stored the helper's own object, the object this test captured
 * at call time shows those mutations afterwards. If it stored a copy, the
 * captured object still holds its opening values. That is a real observation
 * of the seam rather than a restatement of the numbers.
 *
 * THERE IS NO FOLD IN THIS PHASE, and no fold guard is claimed for it. What
 * there is, downstream, is the year-end total `simulate.ts` sums over
 * `hecmStates` in INSERTION order — and this phase is that map's only writer,
 * so it fixes that order. That accumulator is ZERO-BASED, so with two open
 * lines `0 + a + b` and `0 + b + a` are exactly equal in IEEE-754 and no
 * two-line fixture can discriminate a permutation at all. The fixture below
 * carries THREE concurrently open lines for that reason, and G4 COUNTS the
 * years in which reversing them lands on a different double rather than
 * assuming any year does.
 */
import { describe, expect, it, vi } from 'vitest'

import type { HecmLineOpeningRow, HecmLineOpeningYearInput } from './internal/hecmLineOpenings.js'

type PhaseEvent = {
  readonly input: HecmLineOpeningYearInput
  readonly rows: readonly HecmLineOpeningRow[]
  /** `rows.length` read the instant the helper returned. */
  readonly rowCountAtCall: number
  readonly accountIdsAtCall: readonly string[]
  readonly openIdsAtCall: readonly string[]
  /** A deep copy of each row's state, taken at call time. See G2. */
  readonly stateAtCall: readonly { readonly principalLimit: number; readonly loanBalance: number }[]
}

const seam = vi.hoisted(() => ({ phases: [] as PhaseEvent[] }))

vi.mock('./internal/hecmLineOpenings.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/hecmLineOpenings.js')>()
  return {
    ...original,
    hecmLineOpenings: (input: Parameters<typeof original.hecmLineOpenings>[0]) => {
      const rows = original.hecmLineOpenings(input)
      seam.phases.push({
        input,
        rows,
        rowCountAtCall: rows.length,
        accountIdsAtCall: input.accounts.map((a) => a.id),
        openIdsAtCall: [...input.openHecmLines.keys()],
        stateAtCall: rows.map((r) => ({ principalLimit: r.state.principalLimit, loanBalance: r.state.loanBalance })),
      })
      return rows
    },
  }
})

import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, YearResult } from './types.js'

const START_YEAR = 2026
const END_YEAR = 2030
const noTax = createFlatTaxCalculator(0)
const GROWTH_PCT = 7.5
const AGE_62_WARNING =
  'A HECM line of credit was modeled before the youngest borrower turns 62 (real HECMs require age 62+).'

/** Three concurrently open lines, each a different size. See the header on G4. */
const HOMES = [
  { id: 'home-a', value: 300_000, plf: 41.7, upfront: 2.3, openYear: START_YEAR },
  { id: 'home-b', value: 410_000, plf: 38.9, upfront: 1.7, openYear: START_YEAR },
  { id: 'home-c', value: 527_000, plf: 44.3, upfront: 3.1, openYear: START_YEAR + 2 },
] as const

const property = (
  id: string,
  value: number,
  hecm: Record<string, unknown> | null,
  extra: Record<string, unknown> = {},
): Account =>
  ({
    type: 'property',
    id,
    name: id,
    ownerPersonId: 'p1',
    annualReturnPct: null,
    value,
    plannedSaleYear: null,
    expectedNetProceeds: null,
    primaryResidence: true,
    ...extra,
    ...(hecm === null
      ? {}
      : { hecm: { openYear: START_YEAR, growthRatePct: GROWTH_PCT, drawPolicy: 'lastResort', ...hecm } }),
  }) as Account

/**
 * `inflationPct: 0` so property values never move, which is what makes the
 * loan balances in G3 derivable from the fixture's own constants; zeroed
 * spending so `drawPolicy: 'lastResort'` never actually draws, which
 * `noDrawsHappened` checks rather than assumes.
 */
function shell(dob = '1956-01-01'): Plan {
  const p = singlePersonPlan({ dob, planningAge: 90 })
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  p.assumptions.inflationPct = 0
  p.assumptions.defaultReturnPct = 0
  return p
}

function mainPlan(): Plan {
  const p = shell()
  p.accounts = [
    ...HOMES.map((h) => property(h.id, h.value, { principalLimitPct: h.plf, upfrontCostPct: h.upfront, openYear: h.openYear })),
    // A property with NO hecm block, and a zero-valued one that carries one:
    // both are rows the phase must decline to open.
    property('home-plain', 150_000, null),
    property('home-zero', 0, { principalLimitPct: 40 }),
    traditionalAccount('ira', 300_000),
  ]
  return validatePlan(p)
}

function run(plan: Plan): { result: ProjectionResult; phases: readonly PhaseEvent[] } {
  seam.phases.length = 0
  const result = simulatePlan(plan, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: noTax,
  })
  return { result, phases: [...seam.phases] }
}

const yearOf = (result: ProjectionResult, year: number): YearResult => {
  const found = result.years.find((y) => y.year === year)
  if (found === undefined) throw new Error(`the projection published no year ${year}`)
  return found
}

/**
 * G3's premise, CHECKED: with `drawPolicy: 'lastResort'` and nothing to spend,
 * no line is ever drawn, so a published loan balance is the opening balance
 * compounded and nothing else.
 */
function noDrawsHappened(result: ProjectionResult): void {
  for (const year of result.years) expect(year.hecmDraw, `hecmDraw ${year.year}`).toBe(0)
}

/**
 * The fixture's own arithmetic: opening loan balance, then one multiplication
 * by the line's growth factor for each year the line has been open, in the same
 * order `simulate.ts` applies them. Repeated multiplication rather than
 * `Math.pow`, because that is what the property-events phase does.
 */
function expectedLoanBalance(upfrontPct: number, value: number, yearsOpen: number): number {
  let balance = (upfrontPct / 100) * value
  for (let i = 0; i < yearsOpen; i++) balance *= 1 + GROWTH_PCT / 100
  return balance
}

describe('simulatePlan delegates the HECM line open', () => {
  // G1 — defeats the FULLY ORPHANED helper. The inlined `for (const account of
  // plan.accounts)` ran every projected year, so the call must happen every
  // year, including the ones in which no line opens.
  it('calls the extracted helper exactly once for every projected year', () => {
    const { result, phases } = run(mainPlan())
    expect(phases.length).toBeGreaterThan(0)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect(phases.length).toBe(result.years.length)
    expect(phases.map((p) => p.input.year)).toEqual(result.years.map((y) => y.year))
    for (const phase of phases) {
      expect(phase.input.startYear, `startYear at ${phase.input.year}`).toBe(START_YEAR)
      // `plan.accounts` whole and in order — not pre-filtered to properties.
      expect(phase.accountIdsAtCall, `accounts at ${phase.input.year}`).toEqual([
        'home-a',
        'home-b',
        'home-c',
        'home-plain',
        'home-zero',
        'ira',
      ])
    }
    // The open-line map handed over is the caller's LIVE `hecmStates`, not a
    // setup-time snapshot: it is empty when the first two lines open, holds
    // those two when the third does, and holds all three afterwards.
    const openIdsAt = (year: number) => phases.find((p) => p.input.year === year)!.openIdsAtCall
    expect(openIdsAt(START_YEAR)).toEqual([])
    expect(openIdsAt(START_YEAR + 1)).toEqual(['home-a', 'home-b'])
    expect(openIdsAt(START_YEAR + 2)).toEqual(['home-a', 'home-b'])
    expect(openIdsAt(END_YEAR)).toEqual(['home-a', 'home-b', 'home-c'])
    // Rows appear only in the years the fixture opens a line.
    expect(phases.map((p) => p.rows.length)).toEqual([2, 0, 1, 0, 0])
  })

  // G2 — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // See the header for what it does and does not prove.
  it('stores the helper’s own line-state objects, not copies of them', () => {
    const { result, phases } = run(mainPlan())
    noDrawsHappened(result)
    let mutationsObserved = 0
    for (const phase of phases) {
      for (let i = 0; i < phase.rows.length; i++) {
        const row = phase.rows[i]!
        const atCall = phase.stateAtCall[i]!
        // The opening values really were what the helper returned…
        expect(atCall.loanBalance, `${phase.input.year} opening loan balance`).toBeGreaterThan(0)
        // …and by the end of the run THIS object carries the growth the caller
        // applied through the map. A caller that stored `{ ...row.state }`
        // leaves the helper's object at its opening values and fails here,
        // while producing byte-identical projection output.
        expect(row.state.loanBalance, `${phase.input.year} [${i}] the stored line was not this object`).not.toBe(
          atCall.loanBalance,
        )
        expect(row.state.principalLimit, `${phase.input.year} [${i}] principal limit`).not.toBe(atCall.principalLimit)
        mutationsObserved++
      }
    }
    expect(mutationsObserved, 'the fixture no longer opens any HECM line').toBe(3)
    // No two rows share a state object: a hoisted literal pushed twice would
    // alias two independent lines into one.
    const states = phases.flatMap((p) => p.rows.map((r) => r.state))
    expect(new Set(states).size).toBe(states.length)
    // And the object the seam holds really is the one the published total is
    // summed from: the three captured balances add up to the year's published
    // loan balance, in insertion order.
    let folded = 0
    for (const state of states) folded += state.loanBalance
    expect(yearOf(result, END_YEAR).hecmLoanBalance).toBe(folded)
  })

  // G3 — THE FIXTURE-DERIVED GUARD, and the only one here that never reads the
  // helper's output. G2, G4 and G5 all build their expectations from the rows
  // the helper handed back, so an early-out that returns nothing for some year
  // loses that year's whole contribution and they agree with the loss.
  it('opens the fixture’s whole schedule, on a fixture-derived expectation', () => {
    const { result } = run(mainPlan())
    noDrawsHappened(result)
    // The two start-year lines, from the fixture's own percentages and values.
    // `toBe`, never `toBeCloseTo`: rewriting `(pct / 100) * value` as
    // `pct * value / 100` is a different double, and the only other assertion
    // on this output in the repository uses a precision of 0.
    expect(yearOf(result, START_YEAR).hecmLoanBalance).toBe(
      expectedLoanBalance(HOMES[0].upfront, HOMES[0].value, 1) +
        expectedLoanBalance(HOMES[1].upfront, HOMES[1].value, 1),
    )
    // The third line is absent until its own open year, then present.
    expect(yearOf(result, START_YEAR + 1).hecmLoanBalance).toBe(
      expectedLoanBalance(HOMES[0].upfront, HOMES[0].value, 2) +
        expectedLoanBalance(HOMES[1].upfront, HOMES[1].value, 2),
    )
    expect(yearOf(result, START_YEAR + 2).hecmLoanBalance).toBe(
      expectedLoanBalance(HOMES[0].upfront, HOMES[0].value, 3) +
        expectedLoanBalance(HOMES[1].upfront, HOMES[1].value, 3) +
        expectedLoanBalance(HOMES[2].upfront, HOMES[2].value, 1),
    )
    // The zero-valued property never opens, and the property with no hecm block
    // never opens: if either did, the totals above would be wrong.
    expect(result.warnings).not.toContain(AGE_62_WARNING)
  })

  // G3b — the two arms nothing else in the repository covers, each pinned from
  // the fixture rather than from the seam.
  it('clamps a pre-projection open year in, and warns below age 62', () => {
    // `Math.max(openYear, startYear)`: a line dated before the projection opens
    // in the FIRST projected year, at today's value rather than a reconstructed
    // one — so the balance is the same as if `openYear` were the start year.
    const early = shell()
    early.accounts = [
      property('home', 400_000, { openYear: START_YEAR - 4, principalLimitPct: 35, upfrontCostPct: 2 }),
      traditionalAccount('ira', 100_000),
    ]
    const earlyResult = run(validatePlan(early)).result
    noDrawsHappened(earlyResult)
    expect(yearOf(earlyResult, START_YEAR).hecmLoanBalance).toBe(expectedLoanBalance(2, 400_000, 1))

    // The under-62 warning: nothing else in the repository asserts this string.
    const young = shell('1970-01-01')
    young.accounts = [
      property('home', 350_000, { principalLimitPct: 30, upfrontCostPct: 1 }),
      traditionalAccount('ira', 120_000),
    ]
    const youngResult = run(validatePlan(young)).result
    expect(youngResult.warnings).toContain(AGE_62_WARNING)
    // …and it is added exactly once, in the open year, not once per year.
    expect(youngResult.warnings.filter((w) => w === AGE_62_WARNING).length).toBe(1)
  })

  // G3c — THE OPEN-AS-YOU-GO RULE, from published output. Two property
  // accounts may legally share an id, and the inlined phase let the FIRST open
  // the line while the second met its own already-open guard. `propertyValues`
  // is seeded last-write-wins by id, so the line opens against the SECOND
  // account's value with the FIRST account's percentages — a quirk the
  // extraction preserves rather than repairs.
  it('opens ONE line for two property accounts sharing an id', () => {
    const plan = shell()
    plan.accounts = [
      property('twin', 320_000, { principalLimitPct: 42, upfrontCostPct: 2 }),
      { ...property('twin', 275_000, { principalLimitPct: 33, upfrontCostPct: 4 }), name: 'twin-second' } as Account,
      traditionalAccount('ira', 180_000),
    ]
    const { result, phases } = run(validatePlan(plan))
    noDrawsHappened(result)
    expect(phases[0]?.rows.length).toBe(1)
    // FIRST account's upfront percentage, SECOND account's value — and TWO
    // growth multiplications in the one year, because the property-events phase
    // walks `plan.accounts` and both rows resolve to the same open line. That
    // double-growth is outside this phase and unchanged by this extraction; it
    // is spelled out here so the number is not misread as this phase's doing.
    expect(yearOf(result, START_YEAR).hecmLoanBalance).toBe(expectedLoanBalance(2, 275_000, 2))
  })

  // G4 — THE ONE ORDER-SENSITIVE THING THIS PHASE CONTROLS, and its limit. The
  // phase folds nothing itself; what it fixes is the insertion order of
  // `hecmStates`, which the year-end total is summed over. That accumulator is
  // ZERO-BASED, so a permutation of TWO lines cannot move it at all. The
  // fixture carries three, and the discriminating years are COUNTED.
  it('publishes the year total in the insertion order this phase fixed', () => {
    const { result, phases } = run(mainPlan())
    // ORDER from the seam, VALUES from the fixture. The state objects
    // themselves cannot be read here: they are mutated in place all run, so by
    // the time this assertion runs they hold end-of-horizon numbers rather than
    // each year's.
    const insertionOrder = phases.flatMap((p) =>
      p.rows.map((r) => {
        const home = HOMES.find((h) => h.id === r.propertyAccountId)
        if (home === undefined) throw new Error(`unexpected opened line ${r.propertyAccountId}`)
        return home
      }),
    )
    expect(insertionOrder.map((h) => h.id), 'insertion order').toEqual(['home-a', 'home-b', 'home-c'])
    let yearsWithThreeLines = 0
    let yearsThatDiscriminateOrder = 0
    for (const year of result.years) {
      const open = insertionOrder
        .filter((h) => h.openYear <= year.year)
        .map((h) => expectedLoanBalance(h.upfront, h.value, year.year - h.openYear + 1))
      let inOrder = 0
      for (const balance of open) inOrder += balance
      let reversed = 0
      for (const balance of [...open].reverse()) reversed += balance
      if (open.length > 2) yearsWithThreeLines++
      if (!Object.is(inOrder, reversed)) yearsThatDiscriminateOrder++
      expect(year.hecmLoanBalance, `hecmLoanBalance ${year.year}`).toBe(inOrder)
    }
    expect(yearsWithThreeLines, 'fixture no longer holds three concurrently open lines').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateOrder,
      'fixture no longer contains a year where reversing the open lines lands on a different double, ' +
        'so this guard proves the values and not the order',
    ).toBeGreaterThan(0)
  })

  // G5 — THE STRUCTURAL PREMISES. `Array.isArray` catches a generator;
  // `rowCountAtCall` catches an array appended to after it was returned. A
  // generator PASSES the count check (both reads are `undefined`), so neither
  // line is redundant.
  it('returns a materialized array that does not grow after it is returned', () => {
    const { phases } = run(mainPlan())
    expect(phases.length).toBeGreaterThan(0)
    for (const phase of phases) {
      const where = `year ${phase.input.year}`
      expect(Array.isArray(phase.rows), `${where} rows are not a materialized array`).toBe(true)
      expect(phase.rows.length, `${where} rows grew after the call returned`).toBe(phase.rowCountAtCall)
    }
  })
})
