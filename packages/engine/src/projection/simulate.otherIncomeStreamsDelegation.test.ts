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
 * sha256 over all 256 corpus entries, zero moved leaves) and left 5480 engine
 * tests passing; the only behavioural failures anywhere in the repository were
 * seven of the eight tests in this file. Nothing else observes the call. This
 * file does, with the real implementation still running, so no number changes;
 * only the fact of the call is asserted.
 *
 * (One honest footnote on that measurement. A faithful orphan must also delete
 * the helper's import, or `noUnusedLocals` rejects it for an unrelated reason —
 * and deleting it shifts `simulatePlan` back one line, which the pinned
 * coverage-shard citations notice. That gate is a line-number artifact, not a
 * behavioural check, and a determined defector would simply regenerate the
 * shards. It is not what makes the orphan visible; this file is.)
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording which assertion fired. Measured, in this
 * worktree, against this fixture:
 *
 *   orphan (call site re-inlined, helper uncalled)  G1 and G3 fail; the dump is
 *                                                   byte-identical
 *   half-orphan (helper called for effect, verbatim  ONLY G3's `toBe` identity
 *   inline copy folded, payloads rebuilt)            fails — the rebuilt record
 *                                                    is field-for-field equal
 *   re-associated ordinary fold                      G4a fails, last bit:
 *                                                    240778.57751471872 vs
 *                                                    …875
 *   rows grouped by kind                             G3 (wrong recorder), G4a
 *                                                    and G4c fail
 *   `anyAlive` gate applied to one-time rows too     G6 fails by name, at the
 *                                                    first post-death year
 *   helper rewritten as a generator                  G3 fails `rows are not a
 *                                                    materialized array`
 *   array appended to after it was returned          G3 fails `rows grew after
 *                                                    the call returned`
 *
 * The last two are why `Array.isArray` and `rowCountAtCall` are BOTH present
 * and neither is redundant: measured, with `Array.isArray` disabled, the count
 * check does NOT catch a generator (both reads are `undefined`, so it passes),
 * and the growth case passes `Array.isArray` because the value is still an
 * array. Each catches exactly what the other misses.
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
 *   - `ordinaryIncome` is LIVE. Wages (pass 1) and distributed taxable yield
 *     both land in it earlier in the same year, so it is already non-zero when
 *     this phase folds into it, and `B + a + b` genuinely differs from
 *     `B + (a + b)` in IEEE-754. G4a is the one real association guard here.
 *     Its liveness is FIXTURE-DEPENDENT, not unconditional — this fixture has
 *     wages, and a plan with neither wages nor taxable yield would leave the
 *     accumulator zero-based and the guard blind. (Measured over the
 *     differential corpus: `ordinaryIncome` is zero at phase entry in 3990 of
 *     6336 year-runs.) That is why G4a COUNTS the years that actually separate
 *     the two associations and asserts the count is non-zero, rather than
 *     assuming the property holds.
 *   - `oneTimeGains` is ZERO-BASED. It is declared 0 each year and this phase
 *     is its FIRST writer; the disposition fold is far downstream. `0 + a + b`
 *     IS `0 + (a + b)`, so G4b's exact match proves SELECTION and PER-ROW
 *     VALUES and nothing whatsoever about association. (Measured: zero at phase
 *     entry in all 2112 year-runs of the differential corpus.)
 *   - `incomes.recurring` and `incomes.oneTime` are ZERO-BASED for the same
 *     reason — this phase is each one's only writer. G5 pins their selection
 *     and values; it cannot pin association either.
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
import type { TaxCalculator, TaxYearInput } from './types.js'

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
  p.assumptions.inflationPct = 2.5
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

function run(options: { capture?: boolean } = {}) {
  seam.events.length = 0
  taxInputs.length = 0
  const result = simulatePlan(plan(), {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: recordingTaxCalculator(),
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
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

/** The one value every tax evaluation in a year saw, or a failure if they disagree. */
function soleTaxInput<K extends keyof TaxYearInput>(year: number, key: K): TaxYearInput[K] {
  const calls = taxInputs.filter((input) => input.year === year)
  expect(calls.length, `no tax evaluation recorded for ${year}`).toBeGreaterThan(0)
  const distinct = [...new Set(calls.map((call) => call[key]))]
  expect(distinct, `every ${String(key)} evaluation in ${year} must agree`).toHaveLength(1)
  return distinct[0]!
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
    // strictly increasing under a positive inflation assumption. A caller that
    // hoisted it, or substituted the plan's flat rate for the market path,
    // would not produce this series.
    expect(phases[0]!.input.inflFactor).toBe(1)
    for (let i = 1; i < phases.length; i++) {
      expect(phases[i]!.input.inflFactor, `inflFactor ${phases[i]!.input.year}`).toBeGreaterThan(
        phases[i - 1]!.input.inflFactor,
      )
    }
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
      // series, not a constant.
      const base = year.incomes.wages
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
      const base = year.incomes.wages
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
          // the helper's record — the one residual G3's identity check cannot
          // reach, because there both sides are the same object.
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
})
