/**
 * The seam itself: `simulatePlan` must actually DELEGATE income pass 2 — "other
 * non-SS streams" — to `internal/otherIncomeStreams.ts`, and must fold and
 * publish exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a differential
 * equivalence dump (the app compared against itself across two source trees;
 * DOCS/testing.md reserves "oracle" for a CORRECTNESS oracle, and this is not
 * one). Identical output is that dump's PASS condition, so it cannot see an
 * orphaned helper — and that was measured rather than assumed. Reverting the
 * call site to the inlined arithmetic, leaving the helper present in the tree
 * but never called, reproduced the baseline dump BYTE FOR BYTE (same file
 * sha256 over all 256 corpus entries, zero moved leaves); the only behavioural
 * failures anywhere in the repository were in this file — eight of its nine
 * tests, with only G6 surviving. Nothing else observes the call. This file
 * does, with the real implementation still running, so no number changes; only
 * the fact of the call is asserted.
 *
 * (One honest footnote on that measurement. A faithful orphan must also delete
 * the helper's import, or `noUnusedLocals` rejects it for an unrelated reason —
 * and deleting it shifts `simulatePlan` back one line, which the pinned
 * coverage-shard citations notice. That gate is a line-number artifact, not a
 * behavioural check, and a determined defector would simply regenerate the
 * shards. It is not what makes the orphan visible; this file is.)
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording WHICH named tests failed. Measured over
 * this file and the helper's own unit tests together (29 tests), on an
 * out-of-tree copy of this package, so the worktree was never written to:
 *
 *   orphan (call site re-inlined, helper uncalled)   8 fail — G1, G2, G3, G4a,
 *                                                    G4b, G4c, G5, G7. Only G6
 *                                                    survives, and the dump is
 *                                                    byte-identical throughout
 *   half-orphan (helper called for effect, verbatim  1 fails — ONLY G3's `toBe`
 *   inline copy folded, payloads rebuilt)            identity line; the rebuilt
 *                                                    record is field-for-field
 *                                                    equal to the real one
 *   re-associated ordinary fold                      G4a, on the last bit
 *                                                    (240778.57751471872
 *                                                    against …875), and G4c
 *   rows grouped by kind                             G3 (wrong recorder), G4a,
 *                                                    G4c
 *   `anyAlive` gate applied to one-time rows too     G6 by name at the first
 *                                                    post-death year, and with
 *                                                    it G3, G4a, G4b, G5, G7
 *   helper rewritten as a generator                  26 of the 29 fail. G3 by
 *                                                    name, `rows are not a
 *                                                    materialized array`; a
 *                                                    generator is not an array
 *                                                    anywhere, so nearly
 *                                                    everything goes with it
 *   returned array appended to during the NEXT call  5 fail. G3 by name, `rows
 *                                                    grew after the call
 *                                                    returned` (7 against 6),
 *                                                    plus G4a, G5, G7 and the
 *                                                    helper's own `holds no
 *                                                    state between calls`
 *   helper's record mutated in place after publish   G3 and G5 both, on the
 *                                                    two different readings G5
 *                                                    describes
 *   caller rebuilds `inflFactor` from the plan's     G2, and G2 alone
 *   flat assumption instead of the market path
 *   helper returns no rows for one year (2040)       G7, and G7 alone
 *
 * THE LAST TWO ROWS ARE THE TWO DEFECTS THIS FILE DID NOT CATCH when it was
 * first written. Measured against that version, each of them passed all 27 of
 * its tests — this file's eight plus the helper's nineteen, nothing failing
 * anywhere. G2's market-path run and G7 exist because of that measurement, not
 * in anticipation of it. Three other rows above were understated in the same
 * version — the orphan, the re-association and the gate flip each fail more
 * tests than it claimed — and every count here is the re-measured one.
 *
 * `Array.isArray` and `rowCountAtCall` are BOTH present in G3 and neither is
 * redundant. A generator's `rows.length` and its `rowCountAtCall` are both
 * `undefined`, so the count line passes it; a grown array is still an array, so
 * `Array.isArray` passes that. Each line catches exactly what the other misses,
 * and above, each of the two injections fails through its own line by name.
 *
 * Matching numbers alone cannot pin that call. A `simulate.ts` that invokes the
 * helper for effect and then folds its own verbatim inline copy, recording its
 * own byte-identical payloads, is numerically indistinguishable from real
 * delegation. So G3 asserts the published record IS the helper's own object
 * (`toBe`), not merely one that looks like it.
 *
 * WHAT AN EXACT MATCH PROVES IS NOT THE SAME FOR EVERY ACCUMULATOR, and the
 * difference is worth stating rather than implying. Income pass 2 writes four
 * year-scoped accumulators and only ONE of them can carry an association guard:
 *
 *   - `ordinaryIncome` is LIVE ON THIS FIXTURE, and only on a fixture like it.
 *     Its two earlier writers in the year are the distributed-yield pass and
 *     pass 1 wages, and BOTH ARE OPTIONAL; this plan has wages, so the
 *     accumulator is non-zero when the phase folds into it and `B + a + b`
 *     genuinely differs from `B + (a + b)` in IEEE-754. G4a is the one real
 *     association guard here, and its liveness is FIXTURE-DEPENDENT rather than
 *     a property of the engine — a plan with neither wages nor taxable yield
 *     enters zero-based and leaves the guard blind. (Measured over the
 *     differential corpus: `ordinaryIncome` is zero at phase entry in 3990 of
 *     6336 year-runs.) That is why G4a COUNTS the years that actually separate
 *     the two associations and asserts the count is non-zero, rather than
 *     assuming the property holds — and why its fold base goes through
 *     `ordinaryFoldBase`, which pins the no-taxable-yield half of the premise
 *     instead of leaving it to this paragraph.
 *   - `oneTimeGains` is ZERO-BASED. It is declared 0 each year and this phase
 *     is its FIRST writer; the disposition fold is far downstream. `0 + a + b`
 *     IS `0 + (a + b)`, so G4b's exact match proves SELECTION and PER-ROW
 *     VALUES and nothing whatsoever about association. (Measured: zero at phase
 *     entry in all 6336 year-runs of the differential corpus — the same
 *     denominator the `ordinaryIncome` reading above uses.)
 *   - `incomes.recurring` and `incomes.oneTime` are ZERO-BASED for the same
 *     reason — this phase is each one's only writer. G5 pins their selection
 *     and values; it cannot pin association either.
 *
 * WHERE THE EXPECTED VALUES COME FROM, which bounds what any of this proves.
 * G3, G4a, G4b, G4c and G5 all build their expectations out of the rows the
 * helper returned on that same run. That makes them exact checks of what the
 * caller DID with the rows it was handed, and it makes them blind to a helper
 * that hands over FEWER rows than it should: an early-out returning nothing for
 * some year loses that year's entire pass-2 contribution to all four
 * accumulators and both recorders, and every one of those guards agrees with
 * the loss. G1 pins that the call HAPPENS, not what comes back. Measured: a
 * one-line `if (year === 2040) return rows` at the top of the helper failed
 * NOTHING in this file, and nothing in the helper's own unit tests either —
 * they happen to exercise 2030, where the same injection fails 16 of them.
 * G7 is the answer to that, and it is the only guard here whose expectations
 * are derived from the fixture rather than from the helper's output.
 *
 * WHAT IS AND IS NOT CAUGHT BY THE PERMUTATION GUARD. Recurring and one-time
 * rows INTERLEAVE in `plan.incomes` order and both reach `ordinaryIncome`, so a
 * helper that returned its rows GROUPED BY KIND is a detectable re-ordering:
 * G4c catches exactly that, on a fixture whose first ordinary row is a one-time
 * one. A GENERAL row permutation is not a re-association and is NOT caught
 * here. Do not read that as a licence to reorder — row order is pinned instead
 * by the helper's own unit tests, where reversing the returned rows fails
 * `returns rows in plan.incomes order, interleaving kinds` by name.
 *
 * THE PHASE IS PRE-PASS. Its call site sits well above the re-entrancy boundary
 * where `runPostContributionAnnualPass` is defined, so it runs EXACTLY ONCE per
 * projected year (measured over the differential corpus: the phase's entry
 * count equals `result.years.length` in all 192 runs). The `byYear` map below
 * is therefore defensive rather than load-bearing — the opposite is true only
 * for in-pass phases, and is not claimed here.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedStreamIncome } from './annualCashFlowYearSites.js'
import type { OtherIncomeStreamRow, OtherIncomeStreamYearInput } from './internal/otherIncomeStreams.js'

/**
 * One ordered log of both seam events, so a record can be attributed to the
 * phase call it came from without the sink having to know the year.
 *
 * WHY POSITION IS A SOUND ATTRIBUTION, and not an assumption. Three facts about
 * the caller make a record event impossible to interleave with a phase event:
 *
 *   1. The helper is EAGER. `otherIncomeStreams` returns a materialized
 *      `OtherIncomeStreamRow[]` its own loop finishes building before it
 *      returns — not a generator and not a lazy iterable. So by the time the
 *      `phase` event is pushed, every row that call will ever yield exists.
 *   2. `simulate.ts` has exactly ONE call to the helper, and
 *      `recordRecurringIncome` / `recordOneTimeIncome` have exactly one call
 *      site each in the whole projection tree (grep: they are their only
 *      occurrences), both inside the `for…of` over the helper's returned array.
 *   3. Both recorders are sinks, not re-entry points. Each calls one
 *      module-local numeric predicate (`skipNonPositive`) and then either drops
 *      the row or pushes it onto a private array in
 *      `annualCashFlowYearSites.ts`. What the attribution needs is not "it
 *      calls nothing", which is false, but that it never calls back into the
 *      phase.
 *
 * Given (1)-(3) the events for one call are a contiguous run. None of the three
 * is taken on trust, but they are not all pinned the same way:
 *
 *   - (1) is pinned STRUCTURALLY, by two checks in G3 that catch DIFFERENT
 *     shapes rather than the same one twice. `Array.isArray` catches a return
 *     that is not an array at all — rewriting the helper as a generator fails
 *     `rows are not a materialized array` by name. `rowCountAtCall` catches the
 *     residual array-backed case, an array appended to after it was returned. A
 *     generator PASSES the count check (both reads are `undefined`), so neither
 *     line is redundant.
 *   - (2) and (3) are pinned by their observable CONSEQUENCE, not by anything
 *     that reads `simulate.ts`: G3 requires each call's run to hold exactly that
 *     call's rows, and its whole-log accounting requires every record to fall
 *     inside some run.
 *
 * NOTE WHERE THE `amount > 0` FILTER DOES AND DOES NOT APPLY. This log
 * intercepts the recorders BEFORE the sink's `skipNonPositive` drop, so a
 * zero-amount row appears here as a CALL. It is the PUBLISHED ledger that is
 * filtered. G3 therefore attributes ALL rows, unfiltered; G5 reconciles the
 * published lines against rows filtered to `amount > 0`. The fixture carries a
 * deliberate zero-amount recurring stream so both rules are exercised rather
 * than assumed.
 */
type SeamEvent =
  | {
      readonly kind: 'phase'
      readonly input: OtherIncomeStreamYearInput
      readonly rows: readonly OtherIncomeStreamRow[]
      /** `rows.length` read the instant the helper returned. See above. */
      readonly rowCountAtCall: number
      /** `incomes` is the caller's live `plan.incomes`; the ids are snapshotted at call time. */
      readonly streamIdsAtCall: readonly string[]
    }
  | { readonly kind: 'recorded'; readonly sink: 'recurring' | 'oneTime'; readonly row: RecordedStreamIncome }

const seam = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

vi.mock('./internal/otherIncomeStreams.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/otherIncomeStreams.js')>()
  return {
    ...original,
    otherIncomeStreams: (input: Parameters<typeof original.otherIncomeStreams>[0]) => {
      const rows = original.otherIncomeStreams(input)
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
      // real instance. Only the two recorders are observed, and both forward.
      return new Proxy(sites, {
        get(target, prop) {
          if (prop === 'recordRecurringIncome' || prop === 'recordOneTimeIncome') {
            const sink = prop === 'recordRecurringIncome' ? ('recurring' as const) : ('oneTime' as const)
            return (row: RecordedStreamIncome) => {
              seam.events.push({ kind: 'recorded', sink, row })
              target[prop](row)
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
import type { TaxCalculator, TaxYearInput, YearResult } from './types.js'

let counter = 0
const START_YEAR = 2026
const END_YEAR = 2060
/**
 * dob 1976 ⇒ age 50 in `START_YEAR`. Wages stop at `WAGE_END_AGE` and the
 * household dies after `PLANNING_AGE`, so the horizon contains three regimes:
 * years with wages (where the association guard is live), years alive without
 * wages, and post-death years (where recurring stops and one-time still pays).
 */
const WAGE_END_AGE = 80
const PLANNING_AGE = 82
/** ageAttained 82 ⇒ 2058 is the last living year; 2059-2060 are post-death. */
const FIRST_DEAD_YEAR = 2059
/** Before every stream's window opens: the base for G4a is re-derived here. */
const QUIET_YEAR = START_YEAR

/**
 * The fixture's ONLY non-pass-2 ordinary income. Wages are the reason
 * `ordinaryIncome` is non-zero when this phase runs, and so the reason G4a is a
 * live association guard at all. There is no taxable account, no pension, no
 * annuity, no TIPS ladder and no Social Security stream in this plan, so
 * nothing else reaches `ordinaryIncome` and nothing but `oneTimeGains` reaches
 * `capitalGains`.
 */
const WAGES = 92_000

/**
 * The three ORDINARY pass-2 addends, in `plan.incomes` order:
 * [one-time, recurring-inflated, recurring-flat]. Deliberately not round, and
 * not chosen by eye: G4a needs a year where `B + a + b + c` differs from
 * `B + (a + b + c)`, and G4c needs a year where folding the recurring legs
 * before the one-time leg lands on a different double. Both are COUNTED and
 * asserted non-zero below rather than trusted from these constants.
 */
const ONE_TIME_ORDINARY = 7_777.77
const RECURRING_INFLATED = 88_888.88
const RECURRING_FLAT = 33_333.33
/** Reaches `oneTimeGains` only — the zero-based accumulator G4b pins. */
const ONE_TIME_CAPITAL_GAIN = 12_345.67
/** Reaches `incomes.recurring` but no tax leg at all. */
const RECURRING_UNTAXED = 4_321.09
/** Recorded, then dropped by the sink. See the filter-rule note in the header. */
const ZERO_STREAM_ID = 'rec-zero'

/** The plan's deterministic inflation assumption, used when no market path is supplied. */
const FLAT_INFLATION_PCT = 2.5

/**
 * A deliberately NON-FLAT realized inflation path, one rate per projected year.
 * No entry equals `FLAT_INFLATION_PCT`, which is the whole point: with no
 * series supplied, `inflRateAt` returns the plan's flat assumption every year,
 * so the cumulative factor a correct caller passes and the factor a defective
 * caller would rebuild from `assumptions.inflationPct` agree to within a last
 * bit and the substitution hides. On this path they diverge visibly. See G2.
 */
const INFLATION_PATH: readonly number[] = Array.from(
  { length: END_YEAR - START_YEAR + 1 },
  (_unused, i) => [0.8, 6.4, 3.1, 1.3, 9.2][i % 5]!,
)

/**
 * `simulate.ts`'s `cumInfl`, rebuilt here from the same series in the same
 * order: index 0 is 1, and each entry multiplies in that year's realized rate,
 * left to right. `inflFactorFrom(startYear, year)` is exactly
 * `cumInfl[year - startYear]`, so these are `toBe`-comparable doubles rather
 * than an approximation of them.
 */
function expectedInflFactors(path: readonly number[]): number[] {
  const factors = [1]
  for (let i = 0; i < path.length; i++) factors.push(factors[i]! * (1 + path[i]! / 100))
  return factors
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

function plan(): Plan {
  const p = createEmptyPlan({ newId: () => `delegation-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1976-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: PLANNING_AGE, source: 'manual' },
  }
  p.household.filingStatus = 'single'
  p.household.state = 'KY'
  p.assumptions.inflationPct = FLAT_INFLATION_PCT
  p.assumptions.defaultReturnPct = 0
  p.assumptions.healthcareExtraInflationPct = 0
  const cash: Account = {
    type: 'cash',
    id: 'cash1',
    name: 'Cash',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 400_000,
    annualContribution: 0,
  }
  p.accounts = [cash]
  const oneTimes = (id: string, amount: number, taxTreatment: 'ordinary' | 'capitalGain'): IncomeStream[] =>
    Array.from({ length: END_YEAR - START_YEAR }, (_unused, i) => ({
      type: 'oneTime' as const,
      id: `${id}-${START_YEAR + 1 + i}`,
      label: id,
      // Deliberately starting at START_YEAR + 1, so QUIET_YEAR has no pass-2
      // row at all and G4a's fold base can be re-derived from published output.
      year: START_YEAR + 1 + i,
      amount,
      taxTreatment,
    }))
  // ORDER IS THE POINT. The ordinary ONE-TIME row comes FIRST, ahead of both
  // ordinary recurring rows, so grouping the rows by kind really is a
  // permutation of the `ordinaryIncome` fold and G4c has something to bite on.
  p.incomes = [
    ...oneTimes('once', ONE_TIME_ORDINARY, 'ordinary'),
    {
      type: 'wages',
      id: 'wage1',
      personId: 'p1',
      annualGross: WAGES,
      endAge: WAGE_END_AGE,
      realGrowthPct: 0,
    },
    {
      type: 'recurring',
      id: 'rec-inflated',
      label: 'Rental',
      annualAmount: RECURRING_INFLATED,
      startYear: START_YEAR + 1,
      endYear: null,
      inflationAdjusted: true,
      taxTreatment: 'ordinary',
    },
    {
      type: 'recurring',
      id: 'rec-flat',
      label: 'Royalties',
      annualAmount: RECURRING_FLAT,
      startYear: START_YEAR + 1,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    },
    {
      // Recorded every year and dropped by the sink every year: the case that
      // makes G5's `amount > 0` filter rule load-bearing instead of vacuous.
      type: 'recurring',
      id: ZERO_STREAM_ID,
      label: 'Dormant',
      annualAmount: 0,
      startYear: START_YEAR + 1,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'ordinary',
    },
    {
      // A row that is a row, but is no tax leg at all.
      type: 'recurring',
      id: 'rec-untaxed',
      label: 'Gift',
      annualAmount: RECURRING_UNTAXED,
      startYear: START_YEAR + 1,
      endYear: null,
      inflationAdjusted: false,
      taxTreatment: 'none',
    },
    ...oneTimes('gain', ONE_TIME_CAPITAL_GAIN, 'capitalGain'),
  ]
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  const parsed = parsePlan(p)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(options: { capture?: boolean; market?: { inflationPct: number[] } } = {}) {
  seam.events.length = 0
  taxInputs.length = 0
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: recordingTaxCalculator(),
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
    ...(options.market !== undefined ? { market: options.market } : {}),
  })
  const phases = seam.events.filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase')
  const byYear = new Map<number, readonly OtherIncomeStreamRow[]>()
  // Defensive last-wins, not load-bearing: this phase is pre-pass and runs once
  // per year. See the header.
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
}

/**
 * The rows the helper returned for `year`. A missing year is a real regression
 * — the caller stopped invoking the phase for that year — and it deserves to
 * say so rather than surfacing as `rows is not iterable` further on.
 */
function rowsFor(
  byYear: ReadonlyMap<number, readonly OtherIncomeStreamRow[]>,
  year: number,
): readonly OtherIncomeStreamRow[] {
  const rows = byYear.get(year)
  if (rows === undefined) throw new Error(`no otherIncomeStreams call was recorded for ${year}`)
  return rows
}

/**
 * The one value the year's tax evaluation saw.
 *
 * "The one" is a property of THIS FIXTURE, not a guarantee the engine makes,
 * and saying so is the difference between a pin and an assumption. `simulate.ts`
 * has a SECOND `taxCalculator.compute` call site, inside `taxOf` — the
 * Roth-conversion safety-net trimmer — which runs a baseline evaluation and
 * then up to three more in the SAME year as it shrinks the conversion, each of
 * the three at a different `ordinaryIncome`. It is gated behind a desired
 * conversion above a cent, and this plan takes `createEmptyPlan`'s
 * `rothConversion: { mode: 'none' }` and never overrides it, so nothing ever
 * asks for one. MEASURED on this fixture rather than argued: 35 evaluations
 * across 35 projected years — exactly one per year — in default and capture
 * modes alike.
 *
 * So the COUNT is what is asserted, rather than the values merely agreeing. If
 * a later fixture change opened the conversion path, this fails by name here
 * instead of quietly handing back whichever evaluation happened to be first,
 * and whoever makes that change has to say which evaluation they meant.
 */
function soleTaxInput<K extends keyof TaxYearInput>(year: number, key: K): TaxYearInput[K] {
  const calls = taxInputs.filter((input) => input.year === year)
  expect(calls.length, `${year} must be evaluated for tax exactly once — see soleTaxInput`).toBe(1)
  return calls[0]![key]
}

/**
 * The `ordinaryIncome` this year's pass-2 fold starts from, with G4a's and
 * G4c's premise CHECKED rather than left in a comment.
 *
 * `simulate.ts` has exactly two writers of `ordinaryIncome` ahead of this phase:
 * the distributed-yield pass (`ordinaryIncome += interest + ordinaryDividends`)
 * and pass 1 wages. So on a plan that distributes no taxable yield the base IS
 * `year.incomes.wages` — and this plan holds one cash account and nothing that
 * distributes. That is a fixture fact rather than a law: give the fixture a
 * taxable account and `base` silently becomes too small, G4a would compare
 * against the wrong number, and the `toBe` it does on the year's tax input
 * would fail somewhere unrelated-looking. Pinning the two yield legs at zero
 * makes that failure arrive here, by name, saying what actually broke.
 */
function ordinaryFoldBase(year: YearResult): number {
  const where = `${year.year} — G4a/G4c derive the fold base from wages alone`
  expect(year.incomes.taxableInterest, `taxable interest ${where}`).toBe(0)
  expect(year.incomes.ordinaryDividends, `ordinary dividends ${where}`).toBe(0)
  return year.incomes.wages
}

/** The ordinary legs of a year's rows, in row order. Treatment routing included. */
function ordinaryLegs(rows: readonly OtherIncomeStreamRow[]): number[] {
  return rows.filter((r) => r.taxTreatment === 'ordinary').map((r) => r.amount)
}

describe('simulatePlan delegates income pass 2 (other non-SS streams)', () => {
  // G1 — defeats the FULLY ORPHANED helper. This is the assertion a
  // `simulate.ts` reverted to the inlined arithmetic fails while the
  // differential dump and every other suite in the repository stay green.
  // The call must happen for EVERY projected year, including years where no
  // stream contributes: the inlined loop always ran, so a caller that skips the
  // call when nothing matches is itself a regression.
  it('calls the extracted helper for every projected year', () => {
    const { result, phases, byYear } = run()
    expect(phases.length).toBeGreaterThan(0)
    expect(result.years.length).toBe(END_YEAR - START_YEAR + 1)
    expect([...byYear.keys()].sort((a, b) => a - b)).toEqual(result.years.map((y) => y.year))
    // Pre-pass: exactly one call per year, no more. A phase that started being
    // re-evaluated inside the annual pass would break this rather than silently
    // being absorbed by `byYear`'s last-wins.
    expect(phases.length).toBe(result.years.length)
    // The QUIET_YEAR call really does happen and really does return nothing.
    expect(rowsFor(byYear, QUIET_YEAR)).toEqual([])
  })

  // G2 — the input is the year's real state.
  it('passes the year’s real state, and the stream list unsorted and unfiltered', () => {
    const { result, phases } = run()
    expect(phases.map((p) => p.input.year)).toEqual(result.years.map((y) => y.year))
    const planIds = plan().incomes.map((s) => s.id)
    for (const phase of phases) {
      // Same ids in the same ORDER: pins that the caller hands over
      // `plan.incomes` whole, rather than pre-filtering to the two kinds this
      // phase owns or sorting them. Identity is deliberately NOT asserted — a
      // copied array cannot change a number, and pinning it would overstate
      // what the check proves.
      expect(phase.streamIdsAtCall, `stream list for ${phase.input.year}`).toEqual(planIds)
    }
    // `anyAlive` tracks the household, and gates recurring streams only (G6).
    const aliveAt = (year: number): boolean => {
      const phase = phases.find((p) => p.input.year === year)
      if (phase === undefined) throw new Error(`no otherIncomeStreams call was recorded for ${year}`)
      return phase.input.anyAlive
    }
    expect(aliveAt(FIRST_DEAD_YEAR - 1)).toBe(true)
    expect(aliveAt(FIRST_DEAD_YEAR)).toBe(false)
    expect(aliveAt(END_YEAR)).toBe(false)
    // `inflFactor` is the year's live cumulative factor: 1 in the start year and
    // strictly increasing under a positive inflation assumption. That catches a
    // HOISTED factor — a constant is not strictly increasing.
    //
    // It does NOT catch a flat RECONSTRUCTION, and this guard used to claim it
    // did. On a run with no market series, `inflRateAt` returns the plan's own
    // assumption every year, so `inflFactorFrom` already IS that assumption
    // compounded; substituting `Math.pow(1 + inflationPct / 100, year -
    // startYear)` at the call site moves published money in the last bit and
    // still produces a series that is 1 at the start and strictly increasing.
    // Measured: with only the assertions above, that substitution passed this
    // whole file. The market-path run below is what catches it.
    expect(phases[0]!.input.inflFactor).toBe(1)
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.input.inflFactor, `inflFactor ${phases[i]!.input.year}`).toBeGreaterThan(
        phases[i - 1]!.input.inflFactor,
      )
    }
    // THE MARKET PATH, pinned value by value. Under a supplied realized series
    // the flat reconstruction is not a last-bit difference but a different
    // number, so this separates "passed the year's live factor" from "rebuilt
    // something factor-shaped".
    const { phases: marketPhases } = run({ market: { inflationPct: [...INFLATION_PATH] } })
    const want = expectedInflFactors(INFLATION_PATH)
    expect(marketPhases.length).toBe(END_YEAR - START_YEAR + 1)
    let yearsWhereFlatWouldDiffer = 0
    for (const phase of marketPhases) {
      const n = phase.input.year - START_YEAR
      expect(phase.input.inflFactor, `inflFactor ${phase.input.year} on the market path`).toBe(want[n]!)
      if (!Object.is(want[n]!, Math.pow(1 + FLAT_INFLATION_PCT / 100, n))) yearsWhereFlatWouldDiffer++
    }
    // The discrimination is counted, not assumed: if the path above were ever
    // flattened back to the plan's assumption this guard would go quiet, and it
    // says so instead.
    expect(
      yearsWhereFlatWouldDiffer,
      'the market path no longer differs from the plan’s flat assumption, so this guard proves nothing',
    ).toBeGreaterThan(0)
  })

  // G3 — THE OBJECT-IDENTITY ASSERTION (defeats the HALF-ORPHANED duplicate).
  // Capture mode is mandatory: `yearSites` is null under default options, so a
  // default-only run never reaches either recorder at all.
  it('publishes the helper’s own record objects, not look-alike rebuilds', () => {
    run({ capture: true })
    let identityChecks = 0
    let attributedRecords = 0
    for (let i = 0; i < seam.events.length; i++) {
      const event = seam.events[i]!
      if (event.kind !== 'phase') continue
      const where = `year ${event.input.year}`
      // PREMISE (1) of the attribution, checked rather than assumed. The two
      // lines catch DIFFERENT shapes: `Array.isArray` catches the non-array
      // (generator) form; the count catches an array grown after return. A
      // generator PASSES the count — both reads are `undefined` — so neither
      // line is redundant.
      expect(Array.isArray(event.rows), `${where} rows are not a materialized array`).toBe(true)
      expect(event.rows.length, `${where} rows grew after the call returned`).toBe(event.rowCountAtCall)
      // The records that follow this phase call, before the next one, are its.
      const followed: Extract<SeamEvent, { kind: 'recorded' }>[] = []
      for (let j = i + 1; j < seam.events.length; j++) {
        const next = seam.events[j]!
        if (next.kind === 'phase') break
        followed.push(next)
      }
      attributedRecords += followed.length
      // EVERY row is recorded, unfiltered — the sink, not the caller, drops the
      // non-positive ones, and this log sits in front of the sink.
      expect(followed.length, `${where} recorded a different number of rows`).toBe(event.rows.length)
      for (let k = 0; k < event.rows.length; k++) {
        const want = event.rows[k]!
        const got = followed[k]!
        // Routing: a recurring row must reach the recurring recorder, in row
        // order. This is also what would fail if the caller grouped its calls
        // by kind.
        expect(got.sink, `${where} [${k}] reached the wrong recorder`).toBe(want.kind)
        // THE LOAD-BEARING ONE. A caller that invokes the helper for effect and
        // then records its own byte-identical rebuild satisfies every field
        // comparison below and every other suite in the repository, and fails
        // only this.
        expect(got.row, `${where} [${k}] is not the helper's own record object`).toBe(want.record)
        expect(got.row.incomeStreamId).toBe(want.record.incomeStreamId)
        expect(got.row.amount).toBe(want.record.amount)
        expect(got.row.taxTreatment).toBe(want.record.taxTreatment)
        // The caller must fold the SAME double it publishes.
        expect(got.row.amount, `${where} [${k}] record amount diverged from the row`).toBe(want.amount)
        identityChecks++
      }
    }
    // WHOLE-LOG ACCOUNTING. The loop above walks phase events and claims the
    // records that follow each one, so a record emitted BEFORE the first phase
    // call belongs to no run and would be skipped in silence — the one gap the
    // per-call counts cannot see. Every record must be claimed by exactly one
    // call, so the two totals are equal.
    const recordEvents = seam.events.filter((e) => e.kind === 'recorded').length
    expect(attributedRecords, 'a recorded stream income fell outside every phase call').toBe(recordEvents)
    // An explicit floor, so the identity check can never silently degrade to a
    // call-count check if the fixture ever stops paying anything.
    expect(identityChecks, 'the fixture no longer records any stream income').toBeGreaterThan(100)
  })

  // G4a — THE ONE LIVE ASSOCIATION GUARD, on `ordinaryIncome`.
  it('folds the ordinary legs into the year’s tax base row by row, not pre-summed', () => {
    const { result, byYear } = run()
    let yearsWithTwoOrdinaryRows = 0
    let yearsThatDiscriminateAssociation = 0
    for (const year of result.years) {
      // Re-derived from PUBLISHED output per year rather than trusted from the
      // fixture constant: wages are this fixture's only other ordinary income,
      // and they taper (the stream stops at WAGE_END_AGE), so the base is a
      // series, not a constant. `ordinaryFoldBase` checks the "only other"
      // half of that sentence instead of asserting it.
      const base = ordinaryFoldBase(year)
      const legs = ordinaryLegs(rowsFor(byYear, year.year))
      let rowByRow = base
      let summed = 0
      for (const leg of legs) {
        rowByRow += leg
        summed += leg
      }
      if (legs.length > 1) yearsWithTwoOrdinaryRows++
      if (!Object.is(rowByRow, base + summed)) yearsThatDiscriminateAssociation++
      // `toBe`, never `toBeCloseTo`: addition ORDER is what is being pinned.
      expect(soleTaxInput(year.year, 'ordinaryIncome'), `ordinaryIncome ${year.year}`).toBe(rowByRow)
    }
    // The base identity itself, proved at a year with no pass-2 rows at all:
    // adding nothing is exact, so this is a clean read of the accumulator.
    expect(rowsFor(byYear, QUIET_YEAR)).toEqual([])
    expect(soleTaxInput(QUIET_YEAR, 'ordinaryIncome')).toBe(WAGES)
    expect(yearsWithTwoOrdinaryRows, 'fixture no longer has a year that folds two ordinary rows').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first ordinary folds differ',
    ).toBeGreaterThan(0)
  })

  // G4b — ZERO-BASED, and said so rather than implied. `oneTimeGains` is
  // declared 0 each year and this phase is its FIRST writer, so `0 + a + b` IS
  // `0 + (a + b)` and this exact match proves SELECTION and PER-ROW VALUES and
  // NOTHING about association. It is worth having anyway: it catches a dropped
  // leg, a mis-routed treatment or a wrong amount.
  it('routes one-time capital-gain rows to the year’s capital gains, exactly', () => {
    const { result, byYear } = run()
    let yearsWithGain = 0
    for (const year of result.years) {
      const rows = rowsFor(byYear, year.year)
      let rowByRow = 0
      for (const row of rows) if (row.taxTreatment === 'capitalGain') rowByRow += row.amount
      if (rowByRow !== 0) yearsWithGain++
      expect(soleTaxInput(year.year, 'capitalGains'), `capitalGains ${year.year}`).toBe(rowByRow)
    }
    expect(yearsWithGain, 'fixture no longer has a year with a capital-gain stream').toBeGreaterThan(0)
  })

  // G4c — THE INTERLEAVING PREMISE. Returning rows grouped by kind re-orders
  // the `ordinaryIncome` fold, and on this fixture — whose first ordinary row is
  // a ONE-TIME one — that lands on a different double. Scope this precisely: it
  // catches KIND-GROUPING. A general row permutation is not a re-association
  // and is not caught here; row order is pinned by the helper's unit tests.
  it('folds recurring and one-time rows interleaved, not grouped by kind', () => {
    const { result, byYear } = run()
    let yearsThatDiscriminateGrouping = 0
    for (const year of result.years) {
      const base = ordinaryFoldBase(year)
      const rows = rowsFor(byYear, year.year)
      let rowByRow = base
      for (const leg of ordinaryLegs(rows)) rowByRow += leg
      // The counterfactual: all recurring ordinary legs, then all one-time ones.
      let grouped = base
      for (const leg of ordinaryLegs(rows.filter((r) => r.kind === 'recurring'))) grouped += leg
      for (const leg of ordinaryLegs(rows.filter((r) => r.kind === 'oneTime'))) grouped += leg
      if (!Object.is(grouped, rowByRow)) {
        yearsThatDiscriminateGrouping++
        expect(soleTaxInput(year.year, 'ordinaryIncome'), `ordinaryIncome ${year.year}`).not.toBe(grouped)
      }
    }
    expect(
      yearsThatDiscriminateGrouping,
      'fixture no longer contains a year where kind-grouped and interleaved ordinary folds differ',
    ).toBeGreaterThan(0)
  })

  // G5 — ZERO-BASED presence/value guards, and the published ledger. Both
  // `incomes.recurring` and `incomes.oneTime` have exactly one writer — this
  // phase — so they are zero-based and association-blind. What this pins is
  // SELECTION and PER-ROW VALUES, and it is also where the sink's `amount > 0`
  // drop is exercised: the fixture's zero-amount recurring stream is recorded
  // every year and published in none.
  it('folds and publishes each row’s amount, dropping only what the sink drops', () => {
    const { result, byYear } = run({ capture: true })
    let publishedRows = 0
    let droppedZeroRows = 0
    for (const year of result.years) {
      const rows = rowsFor(byYear, year.year)
      let recurring = 0
      let oneTime = 0
      for (const row of rows) {
        if (row.kind === 'recurring') recurring += row.amount
        else oneTime += row.amount
      }
      expect(year.incomes.recurring, `incomes.recurring ${year.year}`).toBe(recurring)
      expect(year.incomes.oneTime, `incomes.oneTime ${year.year}`).toBe(oneTime)

      const cashFlow = year.cashFlow
      expect(cashFlow, `no cash flow captured for ${year.year}`).toBeDefined()
      // THE FILTER RULE, stated as an assertion rather than assumed: the
      // published set is the helper's rows filtered to `amount > 0`.
      const expectedIds = (kind: 'recurring' | 'oneTime', lineId: (id: string) => string) =>
        new Set(
          rows
            .filter((r) => r.kind === kind && r.amount > 0)
            .map((r) => lineId(r.record.incomeStreamId)),
        )
      const actualIds = (lineKind: string) =>
        new Set(cashFlow!.sourceLines.filter((l) => l.kind === lineKind).map((l) => l.id))
      expect(actualIds('recurringIncome'), `recurring lines ${year.year}`).toEqual(
        expectedIds('recurring', cashFlowLineIds.sourceRecurringIncome),
      )
      expect(actualIds('oneTimeIncome'), `one-time lines ${year.year}`).toEqual(
        expectedIds('oneTime', cashFlowLineIds.sourceOneTimeIncome),
      )
      for (const row of rows) {
        const lineId =
          row.kind === 'recurring'
            ? cashFlowLineIds.sourceRecurringIncome(row.record.incomeStreamId)
            : cashFlowLineIds.sourceOneTimeIncome(row.record.incomeStreamId)
        const line = cashFlow!.sourceLines.find((l) => l.id === lineId)
        if (row.amount > 0) {
          // Reads the PUBLISHED amount, so it catches an in-place mutation of
          // the helper's record after the caller handed it over. G3's `toBe`
          // IDENTITY line alone cannot see that — there both sides are the same
          // object — but G3's row-vs-record comparison two lines below it can,
          // and measured, both guards fail on that injection. This is a second
          // and independent reading of the same defect, not the only one.
          expect(line?.amountPlanDollars, `${year.year} ${row.record.incomeStreamId}`).toBe(row.amount)
          publishedRows++
        } else {
          expect(line, `${year.year} ${row.record.incomeStreamId} should have been dropped`).toBeUndefined()
          droppedZeroRows++
        }
      }
    }
    expect(publishedRows, 'no stream income reached the ledger').toBeGreaterThan(100)
    expect(
      droppedZeroRows,
      'the fixture no longer has a zero-amount row, so the sink’s drop rule is untested',
    ).toBeGreaterThan(0)
  })

  // G6 — THE GATE ASYMMETRY, observed from PUBLISHED output rather than the
  // seam. Recurring streams stop when the household dies; one-time streams have
  // no such gate and still pay. Both halves matter: a caller that gated both
  // would pass the first alone.
  it('stops recurring income after the household dies while one-time income still pays', () => {
    const { result } = run()
    const yearOf = (year: number) => {
      const found = result.years.find((y) => y.year === year)
      if (found === undefined) throw new Error(`the projection published no year ${year}`)
      return found
    }
    // Alive: both kinds paying.
    expect(yearOf(FIRST_DEAD_YEAR - 1).incomes.recurring).toBeGreaterThan(0)
    expect(yearOf(FIRST_DEAD_YEAR - 1).incomes.oneTime).toBeGreaterThan(0)
    // Dead: recurring stops dead, one-time keeps paying.
    for (const year of result.years) {
      if (year.year < FIRST_DEAD_YEAR) continue
      expect(year.incomes.recurring, `incomes.recurring ${year.year}`).toBe(0)
      expect(year.incomes.oneTime, `incomes.oneTime ${year.year}`).toBeGreaterThan(0)
    }
  })

  // G7 — THE ONLY GUARD HERE WHOSE EXPECTATION DOES NOT COME FROM THE HELPER.
  // G3, G4a, G4b, G4c and G5 all build their expected values out of the rows
  // the helper returned, which makes them self-consistent under a helper that
  // silently UNDER-PRODUCES: one early-out that returns no rows for some year
  // loses that year's whole pass-2 contribution to all four accumulators and
  // both recorders, and every one of those guards agrees with it. (Measured on
  // the pristine file: a one-line `if (year === 2040) return rows` at the top
  // of the helper failed nothing in this file at all.) G1 pins that the call
  // HAPPENS but says nothing about what comes back; G6 catches it only in the
  // years its two boundaries happen to read.
  //
  // So this guard states the fixture's own schedule and holds the projection to
  // it. Every expectation below is derived from `plan()` above by counting, and
  // two of the three read PUBLISHED output without consulting the seam at all.
  it('pays the fixture’s whole pass-2 schedule every year, on a fixture-derived expectation', () => {
    const { result, byYear } = run()
    // By construction of `plan()`:
    //   START_YEAR        every window opens at START_YEAR + 1     0 rows
    //   alive years       once-YYYY + gain-YYYY + the four
    //                     recurring streams (inflated, flat,
    //                     zero-amount, untaxed)                    6 rows
    //   post-death years  `anyAlive` gates the four recurring
    //                     streams off; both one-time streams pay   2 rows
    const expectedRowCount = (year: number): number => (year === START_YEAR ? 0 : year < FIRST_DEAD_YEAR ? 6 : 2)
    for (const year of result.years) {
      const y = year.year
      expect(rowsFor(byYear, y).length, `row count ${y}`).toBe(expectedRowCount(y))
      // PUBLISHED, and exact: both one-time streams pay every year from
      // START_YEAR + 1 on, a one-time amount is never inflation-adjusted, and
      // this phase is the only writer of `incomes.oneTime` (simulate.ts).
      // Folding starts from 0, so the sum is the two constants and nothing else.
      expect(year.incomes.oneTime, `incomes.oneTime ${y}`).toBe(
        y === START_YEAR ? 0 : ONE_TIME_ORDINARY + ONE_TIME_CAPITAL_GAIN,
      )
      // PUBLISHED, as a floor rather than a value: the inflated leg makes the
      // exact total path-dependent, but the two flat legs are unconditional
      // while the household lives, so anything at or below their sum means a
      // recurring row went missing.
      if (y === START_YEAR || y >= FIRST_DEAD_YEAR) {
        expect(year.incomes.recurring, `incomes.recurring ${y}`).toBe(0)
      } else {
        expect(year.incomes.recurring, `incomes.recurring ${y}`).toBeGreaterThan(RECURRING_FLAT + RECURRING_UNTAXED)
      }
    }
    // The horizon itself, so a projection that simply stopped early cannot pass
    // by having no years left to disagree about.
    expect(result.years.map((y) => y.year)).toEqual(
      Array.from({ length: END_YEAR - START_YEAR + 1 }, (_unused, i) => START_YEAR + i),
    )
  })
})
