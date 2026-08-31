/**
 * The seam itself: `simulatePlan` must actually DELEGATE income pass 1 — wages
 * — to `internal/wageIncome.ts`, and must fold and publish exactly the rows
 * that helper returns.
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
 * this file and the helper's own unit tests together (6 + 18 = 24 tests):
 *
 *   orphan (call site re-inlined from the pristine   5 fail — G1, G2, G3b, G4,
 *   block, helper present and never called)          G5. All 18 helper unit
 *                                                    tests still pass, and so
 *                                                    does the differential dump:
 *                                                    measured, the orphaned tree
 *                                                    reproduced the baseline over
 *                                                    all 228 corpus entries at
 *                                                    the same sha256
 *                                                    ed0fb0bb…1382ae. G2 fails
 *                                                    through its WHOLE-LOG line —
 *                                                    25 recorded wages fell
 *                                                    outside every phase call.
 *                                                    G3, whose expectations are
 *                                                    entirely fixture-derived,
 *                                                    correctly PASSES: an orphan
 *                                                    moves no number
 *   half-orphan (helper called for effect, the       1 fails — ONLY G2, on its
 *   inline copy folded and its payloads rebuilt)     `toBe` identity line: the
 *                                                    rebuilt record is
 *                                                    field-for-field equal
 *   under-production: `if (year === 2030) return`    G3 by name, on the
 *   no rows for one in-horizon year                  fixture-derived
 *                                                    `incomes.wages` (0 against
 *                                                    149655.23156391404), plus
 *                                                    G2, G3b and G5 through
 *                                                    their exact row counts. One
 *                                                    of the helper's own unit
 *                                                    tests also failed, by
 *                                                    coincidence — it happens to
 *                                                    exercise START_YEAR + 4
 *
 * G3 IS THE POINT OF THIS SPLIT. G2, G4 and G5 build their expectations out of
 * the rows the helper handed back, so they are self-consistent under a helper
 * that hands back too few; only G3 states the fixture's own schedule.
 *
 * WHAT AN EXACT MATCH PROVES IS NOT THE SAME FOR EVERY ACCUMULATOR, and the
 * difference is worth stating rather than implying. This phase writes three:
 *
 *   - `ordinaryIncome` is LIVE ON THIS FIXTURE, and only because the fixture
 *     earns it. Its one earlier writer in the year is the distributed-yield
 *     pass, which contributes nothing on a plan with no yield-distributing
 *     taxable account — so this fixture carries one deliberately. Only where
 *     that base is non-zero does `B + a + b` genuinely differ from
 *     `B + (a + b)`. G4 COUNTS the years that actually separate the two and
 *     asserts the count is non-zero rather than assuming every year does.
 *   - `incomes.wages` is ZERO-BASED. It is declared 0 each year and this phase
 *     is its only writer, so `0 + a + b` IS `0 + (a + b)` and G3's exact match
 *     proves SELECTION and PER-ROW VALUES and nothing about association.
 *   - `wagesByPerson` is zero-based per entry (`?? 0`) and is not published at
 *     all; it reaches output only through the Social Security earnings test and
 *     the §219 / §415(c) contribution gates. Nothing here pins it directly, and
 *     no claim is made that anything does.
 *
 * WHERE THE EXPECTED VALUES COME FROM, which bounds what any of this proves.
 * G2, G4 and G5 build their expectations out of the rows the helper returned on
 * that same run, so they are self-consistent under a helper that hands back too
 * few. G3 is the answer to that: it states the fixture's own wage schedule and
 * holds the projection to it, reading only published output. Its honest scope
 * is the years this fixture simulates.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedWage } from './annualCashFlowYearSites.js'
import type { WageIncomeRow, WageIncomeYearInput } from './internal/wageIncome.js'

type SeamEvent =
  | {
      readonly kind: 'phase'
      readonly input: WageIncomeYearInput
      readonly rows: readonly WageIncomeRow[]
      /** `rows.length` read the instant the helper returned. */
      readonly rowCountAtCall: number
      readonly streamIdsAtCall: readonly string[]
    }
  | { readonly kind: 'recorded'; readonly row: RecordedWage }

const seam = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

vi.mock('./internal/wageIncome.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/wageIncome.js')>()
  return {
    ...original,
    wageIncome: (input: Parameters<typeof original.wageIncome>[0]) => {
      const rows = original.wageIncome(input)
      seam.events.push({
        kind: 'phase',
        input,
        rows,
        rowCountAtCall: rows.length,
        streamIdsAtCall: input.incomes.map((s) => s.id),
      })
      return rows
    },
  }
})

vi.mock('./annualCashFlowYearSites.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./annualCashFlowYearSites.js')>()
  return {
    ...original,
    createAnnualCashFlowYearSites: () => {
      const sites = original.createAnnualCashFlowYearSites()
      // A Proxy rather than a copy: the buffer's published getters read private
      // fields off `this`, so every other member must keep running against the
      // real instance. Only the one recorder is observed, and it forwards.
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordWages') {
            return (row: RecordedWage) => {
              seam.events.push({ kind: 'recorded', row })
              target.recordWages(row)
            }
          }
          const value: unknown = Reflect.get(target, prop, target)
          return typeof value === 'function' ? (value as (...args: never[]) => unknown).bind(target) : value
        },
      })
    },
  }
})

import { createEmptyPlan, parsePlan, type Account, type IncomeStream, type Plan } from '../model/plan.js'
import { productionTaxCalculator } from '../testing/planFixtures.js'
import { cashFlowLineIds } from './annualCashFlowIds.js'
import { simulatePlan } from './simulate.js'
import type { ProjectionResult, TaxCalculator, TaxYearInput, YearResult } from './types.js'

let counter = 0
const START_YEAR = 2026
/**
 * dob 1976 ⇒ age 50 in START_YEAR, and 64 in END_YEAR. The horizon deliberately
 * stops below 65, so no Medicare premium, IRMAA tier or Social Security
 * interaction enters the year and the only ordinary income in play is the
 * taxable account's yield plus this phase's rows — which is the premise
 * `ordinaryFoldBase` checks and G4 reads.
 */
const END_YEAR = 2040
const RETIREMENT_AGE = 60
const PLANNING_AGE = 70
const INFLATION_PCT = 2.5

/**
 * TWO contributing wage rows in one year, for ONE person, is the shape nothing
 * in the repository covered before this file: every existing wages fixture is a
 * single stream for a single person. It exercises the in-loop read-modify-write
 * of `wagesByPerson` and gives G4 a fold order to bite on.
 *
 * The three streams stop at three different times, which is what gives G3 a
 * schedule rather than a constant: `wage-b` ends at its own `endAge`, and the
 * other two fall back to the person's `retirementAge`.
 */
const WAGE_A = { id: 'wage-a', gross: 92_137.41, growthPct: 2.7, endAge: null } as const
const WAGE_B = { id: 'wage-b', gross: 31_415.93, growthPct: 1.3, endAge: 55 } as const
/** Recorded every year it contributes, and published in none: the sink drops it. */
const WAGE_ZERO = { id: 'wage-zero', gross: 0, growthPct: 0, endAge: null } as const

const AGE_IN = (year: number): number => year - 1976

function plan(): Plan {
  const p = createEmptyPlan({ newId: () => `wage-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1976-01-01',
    sex: 'average',
    retirementAge: RETIREMENT_AGE,
    longevity: { planningAge: PLANNING_AGE, source: 'manual' },
  }
  p.household.filingStatus = 'single'
  p.household.state = 'KY'
  p.assumptions.inflationPct = INFLATION_PCT
  p.assumptions.defaultReturnPct = 0
  p.assumptions.healthcareExtraInflationPct = 0
  const cash: Account = {
    type: 'cash',
    id: 'cash1',
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: 0,
    balance: 500_000,
    annualContribution: 0,
  }
  // The ONE yield-distributing taxable account. Its interest and its
  // non-qualified dividends are what make `ordinaryIncome` non-zero when this
  // phase runs, and so what makes G4 a live association guard at all.
  const brokerage: Account = {
    type: 'taxable',
    id: 'brok',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: 0,
    // Deliberately ragged. With a round balance and round yields the fold base
    // came out an exact integer (8175), and an integer base plus a
    // full-mantissa wage is an EXACT addition — so `(base + a) + b` and
    // `base + (a + b)` agreed in every year of the horizon and G4's
    // association count was zero. Measured over 20,000 candidate wage amounts
    // against that base: not one discriminated. These values give the base its
    // own low bits, which is what makes the re-association observable.
    balance: 317_419.37,
    costBasis: 317_419.37,
    interestYieldPct: 2.37,
    dividendYieldPct: 1.13,
    qualifiedRatio: 0.83,
    reinvestDividends: true,
    annualContribution: 0,
  }
  p.accounts = [cash, brokerage]
  const wages = (spec: { id: string; gross: number; growthPct: number; endAge: number | null }): IncomeStream => ({
    type: 'wages',
    id: spec.id,
    personId: 'p1',
    annualGross: spec.gross,
    endAge: spec.endAge,
    realGrowthPct: spec.growthPct,
  })
  p.incomes = [wages(WAGE_A), wages(WAGE_B), wages(WAGE_ZERO)]
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  const parsed = parsePlan(p)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

const taxInputs: TaxYearInput[] = []

/** The production federal+state stack, with every input kept. */
function recordingTaxCalculator(): TaxCalculator {
  const inner = productionTaxCalculator()
  return {
    compute(input: TaxYearInput): number {
      taxInputs.push({ ...input })
      return inner.compute(input)
    },
  }
}

function run(options: { capture?: boolean } = {}): {
  result: ProjectionResult
  phases: readonly Extract<SeamEvent, { kind: 'phase' }>[]
  byYear: ReadonlyMap<number, readonly WageIncomeRow[]>
} {
  seam.events.length = 0
  taxInputs.length = 0
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: recordingTaxCalculator(),
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
  })
  const phases = seam.events.filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase')
  const byYear = new Map<number, readonly WageIncomeRow[]>()
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
}

function rowsFor(byYear: ReadonlyMap<number, readonly WageIncomeRow[]>, year: number): readonly WageIncomeRow[] {
  const rows = byYear.get(year)
  if (rows === undefined) throw new Error(`no wageIncome call was recorded for ${year}`)
  return rows
}

/**
 * `simulate.ts`'s `cumInfl`, rebuilt from the plan's own assumption in the same
 * order: index 0 is 1, and each entry multiplies in that year's rate, left to
 * right. `Math.pow` would be a different double, so this is a repeated product
 * exactly as the simulator builds it.
 */
const INFL_FACTORS: readonly number[] = (() => {
  const factors = [1]
  for (let i = 0; i < END_YEAR - START_YEAR + 1; i++) factors.push(factors[i]! * (1 + INFLATION_PCT / 100))
  return factors
})()

/** The fixture's own amount for one stream in one year, or null when it has stopped. */
function fixtureAmount(
  spec: { gross: number; growthPct: number; endAge: number | null },
  year: number,
): number | null {
  const stopAge = spec.endAge ?? RETIREMENT_AGE
  if (AGE_IN(year) >= stopAge) return null
  const raiseFactor = Math.pow(1 + spec.growthPct / 100, year - START_YEAR)
  return spec.gross * raiseFactor * INFL_FACTORS[year - START_YEAR]!
}

/** The streams that pay in `year`, in `plan.incomes` order, from the fixture alone. */
function fixtureRows(year: number): { id: string; amount: number }[] {
  const rows: { id: string; amount: number }[] = []
  for (const spec of [WAGE_A, WAGE_B, WAGE_ZERO]) {
    const amount = fixtureAmount(spec, year)
    if (amount !== null) rows.push({ id: spec.id, amount })
  }
  return rows
}

/**
 * G4's premise, CHECKED rather than asserted in prose: the value the year's tax
 * evaluation sees is the yield base plus this phase's rows and nothing else.
 * The fixture carries exactly one yield-distributing taxable account, no
 * traditional account, and no other income stream, so every other ordinary
 * source is pinned at zero here instead of being left to this comment.
 */
function ordinaryFoldBase(year: YearResult): number {
  const where = `${year.year} — G4 derives the fold base from the one taxable account`
  expect(year.incomes.recurring, `recurring ${where}`).toBe(0)
  expect(year.incomes.oneTime, `one-time ${where}`).toBe(0)
  expect(year.incomes.pension, `pension ${where}`).toBe(0)
  expect(year.incomes.annuity, `annuity ${where}`).toBe(0)
  expect(year.incomes.socialSecurity, `social security ${where}`).toBe(0)
  expect(year.incomes.tipsLadder, `tips ladder ${where}`).toBe(0)
  expect(year.withdrawals.traditional, `traditional withdrawals ${where}`).toBe(0)
  const base = year.incomes.taxableInterest + year.incomes.ordinaryDividends
  expect(base, `the fold base is zero ${where} — G4 would be association-blind`).toBeGreaterThan(0)
  return base
}

/**
 * The value every one of the year's tax evaluations saw, with the agreement
 * ASSERTED rather than assumed.
 *
 * A year is not evaluated exactly once, and an earlier draft of this file
 * assumed it was. The primary `taxCalculator.compute` site sits inside an HSA
 * fixed-point loop within the withdrawal search, and the search calls the
 * enclosing function repeatedly — measured on this fixture, the year the wages
 * stop evaluates TWICE, because the income drop opens a withdrawal search.
 * What makes those evaluations comparable is a property of this fixture rather
 * than a guarantee: it holds no traditional account, so a withdrawal realizes
 * capital gains and never ordinary income, and nothing between the evaluations
 * can move `ordinaryIncome`. This function checks that agreement instead of
 * trusting it, so a fixture change that broke it fails here by name rather than
 * silently handing back whichever evaluation happened to be first.
 */
function agreedTaxInput(year: number, key: 'ordinaryIncome'): number {
  const calls = taxInputs.filter((input) => input.year === year)
  expect(calls.length, `${year} was never evaluated for tax`).toBeGreaterThan(0)
  for (const call of calls) {
    expect(call[key], `${year} evaluations disagree on ${key} — see agreedTaxInput`).toBe(calls[0]![key])
  }
  return calls[0]![key]
}

describe('simulatePlan delegates income pass 1 (wages)', () => {
  // G1 — defeats the FULLY ORPHANED helper. The inlined loop ran every
  // projected year, so the call must happen every year, including the years
  // after every stream has stopped.
  it('calls the extracted helper exactly once for every projected year', () => {
    const { result, phases, byYear } = run()
    expect(phases.length).toBeGreaterThan(0)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect(phases.length).toBe(result.years.length)
    expect([...byYear.keys()].sort((a, b) => a - b)).toEqual(result.years.map((y) => y.year))
    // A year past every stop age: the call still happens and returns nothing.
    expect(rowsFor(byYear, END_YEAR)).toEqual([])
    const planIds = plan().incomes.map((s) => s.id)
    for (const phase of phases) {
      // `plan.incomes` whole and in order — not pre-filtered to wages.
      expect(phase.streamIdsAtCall, `streams at ${phase.input.year}`).toEqual(planIds)
      expect(phase.input.startYear, `startYear at ${phase.input.year}`).toBe(START_YEAR)
      // `inflFactor` is the year's live cumulative factor, rebuilt here as a
      // repeated product rather than with `Math.pow`.
      expect(phase.input.inflFactor, `inflFactor ${phase.input.year}`).toBe(
        INFL_FACTORS[phase.input.year - START_YEAR]!,
      )
      // The person lookups are the caller's live ones, not pre-resolved scalars.
      expect(phase.input.personById.get('p1')?.retirementAge).toBe(RETIREMENT_AGE)
      expect(phase.input.peopleStates.map((s) => s.ageAttained)).toEqual([AGE_IN(phase.input.year)])
    }
  })

  // G2 — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // Capture mode is mandatory: `yearSites` is null under default options.
  it('publishes the helper’s own record objects, not look-alike rebuilds', () => {
    const { result } = run({ capture: true })
    let identityChecks = 0
    let attributedRecords = 0
    for (let i = 0; i < seam.events.length; i++) {
      const event = seam.events[i]!
      if (event.kind !== 'phase') continue
      const where = `year ${event.input.year}`
      const followed: Extract<SeamEvent, { kind: 'recorded' }>[] = []
      for (let j = i + 1; j < seam.events.length; j++) {
        const next = seam.events[j]!
        if (next.kind === 'phase') break
        followed.push(next)
      }
      attributedRecords += followed.length
      // EVERY row is recorded, unfiltered — the sink, not the caller, drops the
      // non-positive ones, and this log sits in front of the sink. The
      // fixture's zero-gross stream is what makes that rule load-bearing.
      expect(followed.length, `${where} recorded a different number of rows`).toBe(event.rows.length)
      for (let k = 0; k < event.rows.length; k++) {
        const want = event.rows[k]!
        // THE LOAD-BEARING ONE. A caller that invokes the helper for effect and
        // then records its own byte-identical rebuild satisfies every field
        // comparison below and every other suite in the repository, and fails
        // only this.
        expect(followed[k]!.row, `${where} [${k}] is not the helper's own record object`).toBe(want.record)
        expect(followed[k]!.row.amount, `${where} [${k}] record amount diverged from the row`).toBe(want.amount)
        expect(followed[k]!.row.incomeStreamId).toBe(want.incomeStreamId)
        identityChecks++
      }
    }
    // WHOLE-LOG ACCOUNTING. The loop claims the records that FOLLOW each phase
    // call, so a record emitted before the first call would belong to no run
    // and be skipped in silence. `recordWages` has exactly one call site today,
    // which makes that gap empty — asserted rather than relied on.
    const recordEvents = seam.events.filter((e) => e.kind === 'recorded').length
    expect(attributedRecords, 'a recorded wage fell outside every phase call').toBe(recordEvents)
    expect(identityChecks, 'the fixture no longer records any wages').toBe(25)
    // AND THE PUBLISHED LEDGER, filtered: the sink drops a non-positive amount,
    // so the published set is the rows with `amount > 0`, in row order.
    for (const year of result.years) {
      const rows = seam.events
        .filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase' && e.input.year === year.year)
        .flatMap((e) => e.rows)
      const published = (year.cashFlow?.sourceLines ?? []).filter((l) => l.kind === 'wages')
      expect(
        published.map((l) => l.id),
        `published wage lines ${year.year}`,
      ).toEqual(rows.filter((r) => r.amount > 0).map((r) => cashFlowLineIds.sourceWages(r.incomeStreamId)))
    }
  })

  // G3 — THE FIXTURE-DERIVED GUARD, and the only one here that never reads the
  // helper's output. G2, G4 and G5 all build their expectations from the rows
  // the helper handed back, so an early-out that returns nothing for some year
  // loses that year's whole contribution and they agree with the loss.
  //
  // HONEST SCOPE: this covers only the years this fixture simulates, and only
  // this fixture's three streams.
  it('pays the fixture’s whole wage schedule, on a fixture-derived expectation', () => {
    const { result } = run({ capture: true })
    let yearsWithTwoPayingStreams = 0
    let yearsWithNoWages = 0
    for (const year of result.years) {
      const expected = fixtureRows(year.year)
      // ZERO-BASED, and said so: `incomes.wages` is declared 0 each year with
      // this phase as its only writer, so this exact match pins SELECTION and
      // PER-ROW VALUES and nothing about association.
      let wages = 0
      for (const row of expected) wages += row.amount
      expect(year.incomes.wages, `incomes.wages ${year.year}`).toBe(wages)
      // The published ledger: the fixture's paying streams, minus the ones the
      // sink drops for being non-positive.
      const published = (year.cashFlow?.sourceLines ?? []).filter((l) => l.kind === 'wages')
      expect(
        published.map((l) => l.id),
        `published wage lines ${year.year}`,
      ).toEqual(expected.filter((r) => r.amount > 0).map((r) => cashFlowLineIds.sourceWages(r.id)))
      for (const line of published) {
        const want = expected.find((r) => cashFlowLineIds.sourceWages(r.id) === line.id)!
        expect(line.amountPlanDollars, `${year.year} ${line.id}`).toBe(want.amount)
      }
      if (expected.filter((r) => r.amount > 0).length > 1) yearsWithTwoPayingStreams++
      if (expected.length === 0) yearsWithNoWages++
    }
    expect(yearsWithTwoPayingStreams, 'the fixture no longer has a year with two paying wage streams').toBeGreaterThan(0)
    expect(yearsWithNoWages, 'the fixture no longer runs past every stop age').toBeGreaterThan(0)
    // The horizon itself, so a projection that stopped early cannot pass by
    // having no years left to disagree about.
    expect(result.years.map((y) => y.year)).toEqual(
      Array.from({ length: END_YEAR - START_YEAR + 1 }, (_unused, i) => START_YEAR + i),
    )
  })

  // G3b — the stop boundaries, stated from the fixture. `>= stopAge` means the
  // stop year itself pays nothing, and the two streams stop in different years.
  it('stops each stream at its own boundary, the stream’s endAge before the person’s retirementAge', () => {
    const { result, byYear } = run()
    const yearAtAge = (age: number) => 1976 + age
    // `wage-b` ends at its own endAge of 60; the other two run to retirementAge.
    expect(rowsFor(byYear, yearAtAge(WAGE_B.endAge - 1)).map((r) => r.incomeStreamId)).toEqual([
      WAGE_A.id,
      WAGE_B.id,
      WAGE_ZERO.id,
    ])
    expect(rowsFor(byYear, yearAtAge(WAGE_B.endAge)).map((r) => r.incomeStreamId)).toEqual([WAGE_A.id, WAGE_ZERO.id])
    expect(rowsFor(byYear, yearAtAge(RETIREMENT_AGE - 1)).map((r) => r.incomeStreamId)).toEqual([
      WAGE_A.id,
      WAGE_ZERO.id,
    ])
    expect(rowsFor(byYear, yearAtAge(RETIREMENT_AGE))).toEqual([])
    // …and the published totals agree at both boundaries.
    const wagesAt = (year: number) => result.years.find((y) => y.year === year)!.incomes.wages
    expect(wagesAt(yearAtAge(RETIREMENT_AGE - 1))).toBeGreaterThan(0)
    expect(wagesAt(yearAtAge(RETIREMENT_AGE))).toBe(0)
  })

  // G4 — THE ONE LIVE ASSOCIATION GUARD, on `ordinaryIncome`. `toBe`, never
  // `toBeCloseTo`: addition ORDER is what is being pinned.
  it('folds the wage rows into the year’s tax base row by row, not pre-summed', () => {
    const { result, byYear } = run()
    let yearsWithTwoRows = 0
    let yearsThatDiscriminateAssociation = 0
    for (const year of result.years) {
      const base = ordinaryFoldBase(year)
      const legs = rowsFor(byYear, year.year).map((r) => r.amount)
      let rowByRow = base
      let summed = 0
      for (const leg of legs) {
        rowByRow += leg
        summed += leg
      }
      if (legs.length > 1) yearsWithTwoRows++
      if (!Object.is(rowByRow, base + summed)) yearsThatDiscriminateAssociation++
      expect(agreedTaxInput(year.year, 'ordinaryIncome'), `ordinaryIncome ${year.year}`).toBe(rowByRow)
    }
    expect(yearsWithTwoRows, 'fixture no longer has a year that folds two wage rows').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first wage folds differ, ' +
        'so this guard proves selection and per-row values only',
    ).toBeGreaterThan(0)
  })

  // G5 — THE STRUCTURAL PREMISES G2's positional attribution rests on.
  // `Array.isArray` catches a generator; `rowCountAtCall` catches an array
  // appended to after it was returned. A generator PASSES the count check
  // (both reads are `undefined`), so neither line is redundant.
  it('returns a materialized array that does not grow after it is returned', () => {
    const { phases } = run()
    expect(phases.length).toBeGreaterThan(0)
    let rowsSeen = 0
    for (const phase of phases) {
      const where = `year ${phase.input.year}`
      expect(Array.isArray(phase.rows), `${where} rows are not a materialized array`).toBe(true)
      expect(phase.rows.length, `${where} rows grew after the call returned`).toBe(phase.rowCountAtCall)
      rowsSeen += phase.rows.length
    }
    expect(rowsSeen, 'the fixture no longer pays any wages').toBe(25)
  })
})
