/**
 * The seam itself: `simulatePlan` must actually DELEGATE income pass 1 —
 * wages — to `internal/wageIncomeStreams.ts`, and must fold and publish
 * exactly the rows that helper returns.
 *
 * Why this file exists. The extraction was verified by a differential
 * equivalence dump (the app compared against itself across two source trees;
 * DOCS/testing.md reserves "oracle" for a CORRECTNESS oracle, and this is not
 * one). Identical output is that dump's PASS condition, so it cannot see an
 * orphaned helper — and that is measured rather than assumed. Reverting the
 * call site to the inlined arithmetic, leaving the helper present in the tree
 * but never called, reproduced the baseline dump BYTE FOR BYTE: the same file
 * sha256 over all 308 corpus entries in four option modes, zero moved leaves.
 * The only behavioural failures anywhere in the engine were in this file —
 * eight of its ten tests, with only G6 and G8 surviving. Nothing else observes
 * the call. This file does, with the real implementation still running, so no
 * number changes; only the fact of the call is asserted.
 *
 * (Two honest footnotes on that measurement, because the count above has a
 * denominator. It was taken on an out-of-tree copy of the package, where 5441
 * of the engine's 5529 tests run: seven test files read repository paths and
 * cannot be collected from a copy at all, and they fail to load identically on
 * an UN-injected copy, so they are excluded in both directions rather than
 * counted as orphan damage. One of those seven is the coverage-shard freshness
 * check, and in the real tree it WOULD notice — a faithful orphan must also
 * delete the helper's import or `noUnusedLocals` rejects the file for an
 * unrelated reason, and deleting it shifts `simulatePlan` back one line along
 * with every pinned citation of it. That gate is a line-number artifact, not a
 * behavioural check, and a determined defector would simply regenerate the
 * shards. It is not what makes the orphan visible; this file is.)
 *
 * CALIBRATION — every guard below was proved to discriminate by injecting the
 * defect it exists for and recording WHICH named tests failed. Measured over
 * this file and the helper's own unit tests together (32 tests), on an
 * out-of-tree copy of this package, so the worktree was never written to. Every
 * count is the measured one, not a prediction:
 *
 *   control (a comment-only edit in the helper)     0 fail — the pair is not
 *                                                   hypersensitive
 *   orphan (call site re-inlined, helper uncalled)  8 fail — G1, G2, G3, G4a,
 *                                                   G4b, G4c, G5, G7. G6 and
 *                                                   G8 survive: both read only
 *                                                   published numbers, which
 *                                                   the inlined copy still
 *                                                   produces. The corpus dump
 *                                                   is byte-identical
 *                                                   throughout (0 of 308)
 *   half-orphan (helper called for effect, verbatim 1 fails — ONLY G3, on `is
 *   inline copy folded, payloads rebuilt)           not the helper's own record
 *                                                   object`. The corpus dump is
 *                                                   byte-identical here too
 *   re-associated ordinary fold (rows pre-summed)   2 fail — G4a and G4b
 *   caller folds the helper's rows reversed         6 fail — G3, G4a, G4b, G4c,
 *                                                   G6, G7
 *   helper returns its rows reversed                4 fail — G6, G7, and two of
 *                                                   the helper's unit tests
 *   helper returns no rows for one IN-HORIZON year  1 fails — G7, and G7 alone
 *   (2035, where the fixture pays five streams)
 *   the same early-out on 2034, a year G6 DOES    2 fail — G6 and G7. This is
 *   spot-check                                    what shows G6 is an
 *                                                 independent under-production
 *                                                 guard at its four gate years,
 *                                                 not merely a gate check
 *   helper rewritten to return a generator          27 fail. G3 by name, `rows
 *                                                   are not a materialized
 *                                                   array`
 *   returned array appended to during the next call 5 fail. G3 by name, `rows
 *                                                   grew after the call
 *                                                   returned` (7 against 6),
 *                                                   while the helper's own
 *                                                   `returns a materialized
 *                                                   array` test PASSES — which
 *                                                   is why both G3 lines exist
 *   helper's record mutated in place after publish  2 fail — G3's `record
 *                                                   amount diverged from the
 *                                                   row` and G5's published
 *                                                   amount. G3's `toBe`
 *                                                   IDENTITY line cannot see
 *                                                   it: both sides are one
 *                                                   object
 *   caller rebuilds `inflFactor` from the plan's    3 fail — G2, G6 and G7
 *   flat assumption instead of the year's factor
 *   caller drops the `wagesByPerson` fold           1 fails — G8, and G8 alone
 *   caller folds only the FIRST row of a year into  1 fails — G8, and G8 alone
 *   `wagesByPerson`
 *   caller pre-sums the `wagesByPerson` fold        0 fail, and that is
 *                                                   CORRECT rather than a gap —
 *                                                   see the zero-based note
 *                                                   below. The corpus dump does
 *                                                   not move on it either
 *   caller supplies a map-backed (last-wins)        0 fail. THIS PAIR CANNOT
 *   `stateOf`, unifying the two person lookups      SEE IT: the fixture has no
 *                                                   duplicate person ids. The
 *                                                   differential corpus does —
 *                                                   4 of 308 entries move, in
 *                                                   its one duplicate-id member
 *   `?? 0` fallback given a different default       1 fails — the helper's own
 *   (`?? 0.01`), and the fallback dropped entirely  `treats a missing
 *   (`stream.realGrowthPct!`)                       realGrowthPct as no real
 *                                                   raise at all`, and that
 *                                                   test alone, on both. That
 *                                                   is the ONE sub-branch the
 *                                                   corpus dump provably
 *                                                   cannot reach: `parsePlan`
 *                                                   defaults the field, so no
 *                                                   parsed plan carries
 *                                                   `undefined` there
 *
 * EVERY COUNT ABOVE PREDATES THIS REVIEW ROUND, and the denominators say so
 * rather than being quietly carried forward. Both measurements — the orphan run
 * in the opening paragraph and the calibration table — were taken when this file
 * held TEN guards and the helper held 22 unit tests, which is where "eight of
 * its ten tests" and "32 tests" come from. Two things changed afterwards, in
 * answer to review: G8b was added here, so the file now holds eleven guards and
 * G8b appears in none of the failure lists above; and the helper's record test
 * was renamed, given a second assertion, and re-fixtured with a non-zero real
 * raise so its value check can see a re-bracketed product (that fixture's own
 * measurements are recorded there). Neither is in any count above and nothing
 * above was re-measured with them present. The two named helper tests the table
 * cites — `treats a missing realGrowthPct as no real raise at all` and `returns
 * a materialized array` — are untouched. What WAS measured for G8b is two
 * fixture edits, recorded at G8 and at G8b themselves.
 *
 * THE MAP-BACKED-`stateOf` ROW IS A MEASURED BLIND SPOT, recorded rather than
 * left implicit.
 * The helper's own unit tests pin that it resolves the stop age through
 * `personById` and the year state through `stateOf`, in both directions; what
 * no test in this pair can see is a CALLER that hands over a `stateOf` with the
 * wrong tie-break. Only a plan with duplicate person ids exposes that, and only
 * the corpus dump carries one.
 *
 * `Array.isArray` and `rowCountAtCall` are BOTH present in G3 and neither is
 * redundant, and the two halves of that claim rest on different evidence. What
 * is MEASURED: the generator injection fails through `rows are not a
 * materialized array` by name, and the array-grown injection fails through
 * `rows grew after the call returned` by name — while the helper's own
 * `returns a materialized array` unit test PASSES on that second injection,
 * since a grown array is still an array. What is REASONED, because
 * `Array.isArray` is asserted first and aborts the test before the count line
 * is reached: a generator's `rows.length` and its `rowCountAtCall` are both
 * `undefined`, so the count line could not have caught it either way.
 *
 * Matching numbers alone cannot pin that call. A `simulate.ts` that invokes the
 * helper for effect and then folds its own verbatim inline copy, recording its
 * own byte-identical payloads, is numerically indistinguishable from real
 * delegation. So G3 asserts the published record IS the helper's own object
 * (`toBe`), not merely one that looks like it.
 *
 * WHAT AN EXACT MATCH PROVES IS NOT THE SAME FOR EVERY ACCUMULATOR, and the
 * difference is worth stating rather than implying. Income pass 1 writes three
 * accumulators and calls one recorder, and only ONE of the three can carry an
 * association guard:
 *
 *   - `ordinaryIncome` is the LIVE one, and its liveness is FIXTURE-DEPENDENT
 *     rather than a property of the engine. Its only earlier writer in the year
 *     is the distributed-yield pass, so a plan with no yielding taxable account
 *     enters this phase at zero in EVERY year and leaves G4a blind. (Measured
 *     over the 77-member differential corpus: zero at pass-1 entry in 6268 of
 *     9788 year-runs.) This fixture holds one taxable account that distributes
 *     interest and nothing else, so its base is non-zero in every year. G4a is
 *     the one real association guard here, and it COUNTS the years that
 *     actually separate row-by-row from pre-summed and asserts the count is
 *     non-zero, rather than assuming every year is one.
 *   - `incomes.wages` is ZERO-BASED. This phase is its sole writer, so
 *     `0 + a + b` IS `0 + (a + b)` and G4c's exact match proves SELECTION and
 *     PER-ROW VALUES and NOTHING about association.
 *   - `wagesByPerson` is ZERO-BASED TOO, and that is measured rather than
 *     argued. The map is rebuilt empty each year, so a person's first stream
 *     folds onto 0 and a pre-summed variant adds the same left-to-right partial
 *     sum to the same 0. Injecting that pre-sum moved 0 of 308 corpus entries
 *     and fails nothing here. G8 pins that the map is POPULATED, for the right
 *     person, in the right years — not the association of its fold, which
 *     cannot be pinned by anything. G8b pins the fixture sizing that lets G8's
 *     population check separate a PARTIAL fold from a complete one.
 *
 * WHERE THE EXPECTED VALUES COME FROM, which bounds what any of this proves.
 * G3, G4a, G4b, G4c and G5 all build their expectations out of the rows the
 * helper returned on that same run. That makes them exact checks of what the
 * caller DID with the rows it was handed, and it makes them blind to a helper
 * that hands over FEWER rows than it should: an early-out returning nothing for
 * some year loses that year's entire wage contribution to both accumulators,
 * the map and the recorder, and every one of those guards agrees with the loss.
 * G1 pins that the call HAPPENS, not what comes back. G7 is the answer: a
 * hand-written schedule of which streams are open in which year, and the exact
 * published `incomes.wages` folded from the fixture's own constants.
 *
 * G7 IS THE ONLY GUARD THAT HOLDS EVERY PROJECTED YEAR TO THAT SCHEDULE — but
 * it is NOT the only fixture-derived guard here, and an earlier draft of this
 * comment claimed it was. G6 builds its whole expectation from `STREAMS`,
 * `openStreamIdsIn`, `foldWages` and `expectedInflFactors`, reads only
 * PUBLISHED output and never touches the seam; G8 likewise checks published
 * output against a fixture constant. That is why both survive the orphan
 * above, where the other eight fail. It also makes G6 an independent
 * under-production guard at the years its four gate checks touch, not merely a
 * gate check — measured, by injecting an early-out into the helper on an
 * out-of-tree copy: no rows for 2034 fails G6 AND G7 (2 of 32 tests), while
 * the same early-out at 2035, a year G6 does not touch, fails G7 alone (1 of
 * 32). The division of labour is coverage, not kind: G7 holds all 35 years.
 *
 * G7'S REACH IS THE FIXTURE'S REACH, and no wider. It covers the 35 years
 * 2026-2060 that this plan simulates, and the six wage-stream shapes it
 * carries. It says nothing about a plan shape this fixture does not build.
 *
 * THE PHASE IS PRE-PASS. Its call site sits well above the re-entrancy boundary
 * where `runPostContributionAnnualPass` is defined, so it runs EXACTLY ONCE per
 * projected year. That is asserted below (G1's `phases.length ===
 * result.years.length`) rather than assumed, so the `byYear` map is defensive
 * here rather than load-bearing — the opposite is true for in-pass phases, and
 * is not claimed here.
 */
import { describe, expect, it, vi } from 'vitest'

import type { RecordedWage } from './annualCashFlowYearSites.js'
import type { WageIncomeRow, WageIncomeYearInput } from './internal/wageIncomeStreams.js'

/**
 * One ordered log of both seam events, so a record can be attributed to the
 * phase call it came from without the sink having to know the year.
 *
 * WHY POSITION IS A SOUND ATTRIBUTION, and not an assumption. Three facts about
 * the caller make a record event impossible to interleave with a phase event:
 *
 *   1. The helper is EAGER. `wageIncomeStreams` returns a materialized
 *      `WageIncomeRow[]` its own loop finishes building before it returns — not
 *      a generator and not a lazy iterable. So by the time the `phase` event is
 *      pushed, every row that call will ever yield exists.
 *   2. `simulate.ts` has exactly ONE call to the helper, and `recordWages` has
 *      exactly one call site in the whole projection tree (grep-verified: its
 *      only other occurrences are the interface declaration and the
 *      implementation in `annualCashFlowYearSites.ts`), inside the `for…of`
 *      over the helper's returned array.
 *   3. `recordWages` is a sink, not a re-entry point. It calls one module-local
 *      numeric predicate (`skipNonPositive`) and then either drops the row or
 *      pushes it onto a private array. What the attribution needs is not "it
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
 *     residual array-backed case, an array appended to after it was returned —
 *     which `Array.isArray` cannot see, measured: the array-grown injection
 *     fails the count line by name while the helper's own `returns a
 *     materialized array` test passes. Neither line is redundant.
 *   - (2) and (3) are pinned by their observable CONSEQUENCE, not by anything
 *     that reads `simulate.ts`: G3 requires each call's run to hold exactly that
 *     call's rows, and its whole-log accounting requires every record to fall
 *     inside some run.
 *
 * NOTE WHERE THE `amount > 0` FILTER DOES AND DOES NOT APPLY. This log
 * intercepts the recorder BEFORE the sink's `skipNonPositive` drop, so a
 * zero-amount row appears here as a CALL. It is the PUBLISHED ledger that is
 * filtered. G3 therefore attributes ALL rows, unfiltered; G5 reconciles the
 * published lines against rows filtered to `amount > 0`. The fixture carries a
 * deliberate zero-gross wage stream so both rules are exercised rather than
 * assumed.
 */
type SeamEvent =
  | {
      readonly kind: 'phase'
      readonly input: WageIncomeYearInput
      readonly rows: readonly WageIncomeRow[]
      /** `rows.length` read the instant the helper returned. See above. */
      readonly rowCountAtCall: number
      /** `incomes` is the caller's live `plan.incomes`; the ids are snapshotted at call time. */
      readonly streamIdsAtCall: readonly string[]
    }
  | { readonly kind: 'recorded'; readonly row: RecordedWage }

const seam = vi.hoisted(() => ({ events: [] as SeamEvent[] }))

vi.mock('./internal/wageIncomeStreams.js', async (importOriginal) => {
  const original = await importOriginal<typeof import('./internal/wageIncomeStreams.js')>()
  return {
    ...original,
    wageIncomeStreams: (input: Parameters<typeof original.wageIncomeStreams>[0]) => {
      const rows = original.wageIncomeStreams(input)
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
import type { TaxCalculator, TaxYearInput, YearResult } from './types.js'

let counter = 0
const START_YEAR = 2026
const END_YEAR = 2060

/**
 * The household. Pat outlives the horizon; Sam does not, and Sam dies with two
 * wage streams still inside their age windows — which is the only way the
 * `!s.alive` half of the gate can be observed separately from the age half.
 */
const PAT = { id: 'p1', birthYear: 1976, retirementAge: 65, planningAge: 92 } as const
const SAM = { id: 'p2', birthYear: 1979, retirementAge: 60, planningAge: 62 } as const
/** `alive` while `ageAttained <= planningAge`: Sam attains 62 in 2041. */
const SAM_FIRST_DEAD_YEAR = 2042
/** After every stream has closed. Both `ordinaryIncome` reads are clean here. */
const QUIET_YEAR = 2050

/**
 * The six wage streams, IN `plan.incomes` ORDER — which is the order the caller
 * folds them in, and therefore the order every expectation below folds them in
 * too. Amounts are deliberately not round: G4a needs a year where
 * `B + a + b + …` differs from `B + (a + b + …)`, and G4b needs a year where
 * reversing the rows lands on a different double. Both are COUNTED and asserted
 * non-zero rather than trusted from these constants.
 *
 * The two small Pat streams are sized for G8. Together they exceed the indexed
 * earnings-test threshold in Pat's first three claimed years; each ALONE falls
 * below it. That is what makes G8 catch a caller which folds only one of a
 * person's rows into `wagesByPerson`, and not merely one which folds none.
 * Neither half is trusted from these constants: G8 asserts the first, and G8b
 * asserts the second by re-running the fixture one Pat stream at a time.
 */
const STREAMS = [
  { id: 'w-pat-main', personId: PAT.id, gross: 137_777.77, endAge: 62, growthPct: 1.3 },
  { id: 'w-sam-early', personId: SAM.id, gross: 88_888.88, endAge: 55, growthPct: 0 },
  { id: 'w-pat-side', personId: PAT.id, gross: 14_111.11, endAge: null, growthPct: 0 },
  /** Recorded every year it is open and published in none: G5's drop rule. */
  { id: 'w-zero', personId: SAM.id, gross: 0, endAge: 70, growthPct: 0 },
  { id: 'w-sam-long', personId: SAM.id, gross: 63_456.78, endAge: 70, growthPct: 0.7 },
  { id: 'w-pat-tail', personId: PAT.id, gross: 16_222.22, endAge: 70, growthPct: 0 },
] as const

/**
 * WHICH STREAMS ARE OPEN IN WHICH YEAR, WRITTEN OUT BY HAND from the constants
 * above rather than re-derived by re-running the helper's own gate logic. This
 * is what makes G7 independent of the helper: every other guard here builds its
 * expectation from the rows that came back.
 *
 *   2026-2033  all six. Sam attains 55 in 2034, closing `w-sam-early`.
 *   2034-2037  five. Pat attains 62 in 2038, closing `w-pat-main`.
 *   2038-2040  four. Pat attains 65 — `retirementAge`, the FALLBACK stop age —
 *              in 2041, closing `w-pat-side`, which names no `endAge`.
 *   2041       three. Sam's last living year is 2041, so `w-zero` and
 *              `w-sam-long` close in 2042 by DEATH while their age windows
 *              (endAge 70, Sam attains 70 in 2049) are still open.
 *   2042-2045  one. Pat attains 70 in 2046, closing `w-pat-tail`.
 *   2046-2060  none.
 */
function openStreamIdsIn(year: number): readonly string[] {
  if (year <= 2033) return ['w-pat-main', 'w-sam-early', 'w-pat-side', 'w-zero', 'w-sam-long', 'w-pat-tail']
  if (year <= 2037) return ['w-pat-main', 'w-pat-side', 'w-zero', 'w-sam-long', 'w-pat-tail']
  if (year <= 2040) return ['w-pat-side', 'w-zero', 'w-sam-long', 'w-pat-tail']
  if (year === 2041) return ['w-zero', 'w-sam-long', 'w-pat-tail']
  if (year <= 2045) return ['w-pat-tail']
  return []
}

/** The plan's deterministic inflation assumption, used when no market path is supplied. */
const FLAT_INFLATION_PCT = 2.5

/**
 * A deliberately NON-FLAT realized inflation path, one rate per projected year.
 * No entry equals `FLAT_INFLATION_PCT`, which is the whole point: with no
 * series supplied, `inflRateAt` returns the plan's flat assumption every year,
 * so the cumulative factor a correct caller passes and the factor a defective
 * caller would rebuild from `assumptions.inflationPct` agree closely and the
 * substitution can hide. On this path they diverge visibly. See G2.
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
 * than an approximation of them — and note that `Math.pow(1 + rate, n)` is NOT,
 * even on a flat path, which is why the flat run below also uses this function.
 */
function expectedInflFactors(path: readonly number[]): number[] {
  const factors = [1]
  for (let i = 0; i < path.length; i++) factors.push(factors[i]! * (1 + path[i]! / 100))
  return factors
}

const FLAT_PATH: readonly number[] = Array.from({ length: END_YEAR - START_YEAR + 1 }, () => FLAT_INFLATION_PCT)

/**
 * One stream's pay for one year, from the fixture's constants only: gross times
 * the compounded real raise times the year's cumulative inflation factor, in
 * that operand order. Multiplication is not associative in IEEE-754 either, so
 * the bracketing matters as much as the values.
 */
function expectedStreamAmount(streamId: string, year: number, factors: readonly number[]): number {
  const stream = STREAMS.find((s) => s.id === streamId)!
  return stream.gross * Math.pow(1 + stream.growthPct / 100, year - START_YEAR) * factors[year - START_YEAR]!
}

/** The year's `incomes.wages`, folded over the given ids IN `plan.incomes` ORDER, from 0. */
function foldWages(ids: readonly string[], year: number, factors: readonly number[]): number {
  let total = 0
  for (const stream of STREAMS) if (ids.includes(stream.id)) total += expectedStreamAmount(stream.id, year, factors)
  return total
}

/**
 * The years Pat's earnings test withholds. Pat claims at 62 (2038) and reaches
 * FRA later, so the below-FRA formula applies from 2038; it withholds only when
 * Pat's OWN wages clear the indexed threshold, which they do while both
 * `w-pat-side` and `w-pat-tail` are open and not after `w-pat-side` closes in
 * 2041. Measured on the fixture rather than predicted from the statute: these
 * are the only three years in which `ssEarningsTestWithheld` is non-zero.
 */
const EARNINGS_TEST_YEARS: readonly number[] = [2038, 2039, 2040]

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

/**
 * The fixture. `onlyWageStreamIds` keeps just the named wage streams and drops
 * the rest; every other part of the plan — both people, the accounts, Pat's
 * Social Security stream — is untouched. It exists for G8b, which needs Pat
 * carrying ONE wage stream, and no caller of `plan()` passes it otherwise.
 */
function plan(options: { readonly onlyWageStreamIds?: readonly string[] } = {}): Plan {
  const p = createEmptyPlan({ newId: () => `delegation-${++counter}`, now: () => new Date('2026-06-11T00:00:00.000Z') })
  p.household.people = [
    {
      id: PAT.id,
      name: 'Pat',
      dob: `${PAT.birthYear}-01-01`,
      sex: 'average',
      retirementAge: PAT.retirementAge,
      longevity: { planningAge: PAT.planningAge, source: 'manual' },
    },
    {
      id: SAM.id,
      name: 'Sam',
      dob: `${SAM.birthYear}-01-01`,
      sex: 'average',
      retirementAge: SAM.retirementAge,
      longevity: { planningAge: SAM.planningAge, source: 'manual' },
    },
  ]
  p.household.filingStatus = 'marriedFilingJointly'
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
    balance: 3_000_000,
    annualContribution: 0,
  }
  /**
   * THE REASON G4a IS A LIVE ASSOCIATION GUARD. This account distributes
   * taxable INTEREST and nothing else — no dividends, no tax-exempt yield — so
   * `ordinaryIncome` is non-zero when pass 1 opens, and `incomes.taxableInterest`
   * is the same double the yield pass added to it. Its cost basis is far below
   * its balance, so a sale realizes a GAIN: a capital LOSS would reach
   * `ordinaryIncome` through the §1211(b) ordinary offset and silently break
   * that identity.
   */
  const brokerage: Account = {
    type: 'taxable',
    id: 'tax1',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: 0,
    balance: 900_000,
    costBasis: 100_000,
    interestYieldPct: 3.4,
    dividendYieldPct: 0,
    taxExemptInterestYieldPct: 0,
    reinvestDividends: true,
    annualContribution: 0,
  }
  p.accounts = [cash, brokerage]
  const keep = options.onlyWageStreamIds
  const wageStreams: IncomeStream[] = STREAMS.filter((s) => keep === undefined || keep.includes(s.id)).map((s) => ({
    type: 'wages',
    id: s.id,
    personId: s.personId,
    annualGross: s.gross,
    endAge: s.endAge,
    realGrowthPct: s.growthPct,
  }))
  p.incomes = [
    ...wageStreams,
    // Pat only. Sam claims nothing, so `ssEarningsTestWithheld` is Pat's alone
    // and G8 reads one person's map entry rather than a household total.
    {
      type: 'socialSecurity',
      id: 'ss-pat',
      personId: PAT.id,
      piaMonthly: 3_200,
      earnings: null,
      claimAge: { years: 62, months: 0 },
    },
  ]
  p.expenses.baseAnnual = 0
  p.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  const parsed = parsePlan(p)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

function run(
  options: { capture?: boolean; market?: { inflationPct: number[] }; onlyWageStreamIds?: readonly string[] } = {},
) {
  seam.events.length = 0
  taxInputs.length = 0
  const fixture =
    options.onlyWageStreamIds === undefined ? plan() : plan({ onlyWageStreamIds: options.onlyWageStreamIds })
  const result = simulatePlan(fixture, {
    startYear: START_YEAR,
    horizonEndYear: END_YEAR,
    taxCalculator: recordingTaxCalculator(),
    ...(options.capture === true ? { captureAnnualCashFlow: true } : {}),
    ...(options.market !== undefined ? { market: options.market } : {}),
  })
  const phases = seam.events.filter((e): e is Extract<SeamEvent, { kind: 'phase' }> => e.kind === 'phase')
  const byYear = new Map<number, readonly WageIncomeRow[]>()
  // Defensive last-wins, not load-bearing: this phase is pre-pass and runs once
  // per year. See the header, and G1, which asserts it.
  for (const phase of phases) byYear.set(phase.input.year, phase.rows)
  return { result, phases, byYear }
}

/**
 * The rows the helper returned for `year`. A missing year is a real regression
 * — the caller stopped invoking the phase for that year — and it deserves to
 * say so rather than surfacing as `rows is not iterable` further on.
 */
function rowsFor(byYear: ReadonlyMap<number, readonly WageIncomeRow[]>, year: number): readonly WageIncomeRow[] {
  const rows = byYear.get(year)
  if (rows === undefined) throw new Error(`no wageIncomeStreams call was recorded for ${year}`)
  return rows
}

/**
 * The `ordinaryIncome` every tax evaluation in `year` saw.
 *
 * `simulate.ts` has two `taxCalculator.compute` call sites and BOTH can
 * evaluate more than once in a year — the primary one sits inside a 16-pass HSA
 * fixed-point loop within a withdrawal search, and the second is the
 * Roth-conversion trimmer. Rather than assert a call COUNT, which would pin a
 * property of the search rather than of this phase, this asserts what the
 * guards below actually need: that every evaluation in the year saw the SAME
 * `ordinaryIncome`. On this fixture it does, because nothing a withdrawal can
 * reach adds ordinary income — there is no traditional, Roth or HSA account, so
 * a withdrawal moves cash or realizes a capital gain and nothing else.
 * (Measured: one evaluation per year, one distinct value per year, in every
 * mode this file runs.) If a later fixture change opened one of those paths,
 * this fails by name here instead of quietly reading whichever evaluation
 * happened to be first.
 */
function soleOrdinaryIncome(year: number): number {
  const calls = taxInputs.filter((input) => input.year === year)
  expect(calls.length, `${year} was never evaluated for tax`).toBeGreaterThan(0)
  const distinct = new Set(calls.map((c) => c.ordinaryIncome))
  expect(distinct.size, `${year} saw more than one ordinaryIncome — see soleOrdinaryIncome`).toBe(1)
  return calls[0]!.ordinaryIncome
}

/**
 * The `ordinaryIncome` this year's pass-1 fold starts from, with G4a's premise
 * CHECKED rather than left in a comment.
 *
 * The distributed-yield pass is the only writer of `ordinaryIncome` ahead of
 * this phase, and it adds `interest + ordinaryDividends`. On a plan whose one
 * taxable account pays interest and no dividends that is `interest + 0`, which
 * is the same double as `incomes.taxableInterest` — itself `0 + interest`, one
 * account being the only contributor. That is a FIXTURE fact rather than a law:
 * give the fixture a second taxable account or a dividend yield and this base
 * silently becomes the wrong number. Pinning the two dividend legs at zero
 * makes that failure arrive here, by name, saying what actually broke.
 */
function ordinaryFoldBase(year: YearResult): number {
  const where = `${year.year} — G4a/G4b derive the fold base from taxable interest alone`
  expect(year.incomes.ordinaryDividends, `ordinary dividends ${where}`).toBe(0)
  expect(year.incomes.qualifiedDividends, `qualified dividends ${where}`).toBe(0)
  expect(year.incomes.taxableInterest, `taxable interest ${where}`).toBeGreaterThan(0)
  return year.incomes.taxableInterest
}

describe('simulatePlan delegates income pass 1 (wages)', () => {
  // G1 — defeats the FULLY ORPHANED helper. This is the assertion a
  // `simulate.ts` reverted to the inlined arithmetic fails while all four
  // differential dumps and every other suite in the repository stay green.
  // The call must happen for EVERY projected year, including years where no
  // stream pays: the inlined loop always ran, so a caller that skips the call
  // when nothing matches is itself a regression.
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
  it('passes the year’s real state, both person lookups, and the stream list unsorted and unfiltered', () => {
    const { result, phases } = run()
    expect(phases.map((p) => p.input.year)).toEqual(result.years.map((y) => y.year))
    const planIds = plan().incomes.map((s) => s.id)
    for (const phase of phases) {
      // Same ids in the same ORDER, INCLUDING the Social Security stream this
      // phase does not own: pins that the caller hands over `plan.incomes`
      // whole, rather than pre-filtering to wages or sorting. Identity is
      // deliberately NOT asserted — a copied array cannot change a number, and
      // pinning it would overstate what the check proves.
      expect(phase.streamIdsAtCall, `stream list for ${phase.input.year}`).toEqual(planIds)
      expect(phase.input.startYear, `startYear for ${phase.input.year}`).toBe(START_YEAR)
    }
    // `personById` is built ONCE for the whole projection, so every year must
    // see the same object. A caller rebuilding it per year fails here — and a
    // rebuilt map is where the last-wins/first-wins asymmetry would quietly go.
    for (const phase of phases) expect(phase.input.personById).toBe(phases[0]!.input.personById)
    const phaseAt = (year: number) => {
      const phase = phases.find((p) => p.input.year === year)
      if (phase === undefined) throw new Error(`no wageIncomeStreams call was recorded for ${year}`)
      return phase
    }
    // `stateOf` is the caller's own `find` over the year's people states, so it
    // returns the SAME object twice. A closure that rebuilt a state per call
    // would not, and would also be free to resolve a duplicate id differently.
    const twice = phaseAt(START_YEAR)
    expect(twice.input.stateOf(SAM.id)).toBe(twice.input.stateOf(SAM.id))
    // It really is the year's state: Sam's `alive` flips at the death boundary.
    expect(phaseAt(SAM_FIRST_DEAD_YEAR - 1).input.stateOf(SAM.id).alive).toBe(true)
    expect(phaseAt(SAM_FIRST_DEAD_YEAR).input.stateOf(SAM.id).alive).toBe(false)
    expect(phaseAt(START_YEAR).input.stateOf(PAT.id).ageAttained).toBe(START_YEAR - PAT.birthYear)
    // `inflFactor` is the year's live cumulative factor: 1 in the start year and
    // strictly increasing under a positive inflation assumption. That catches a
    // HOISTED factor — a constant is not strictly increasing. It does NOT catch
    // a flat RECONSTRUCTION; the market-path run below is what does.
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
  // default-only run never reaches the recorder at all.
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
      // (generator) form; the count catches an array grown after return, which
      // is still an array and which `Array.isArray` therefore cannot see.
      // Measured: each injection fails through its own line. See the header.
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
        // THE LOAD-BEARING ONE. A caller that invokes the helper for effect and
        // then records its own byte-identical rebuild satisfies every field
        // comparison below and every other suite in the repository, and fails
        // only this.
        expect(got.row, `${where} [${k}] is not the helper's own record object`).toBe(want.record)
        expect(got.row.incomeStreamId).toBe(want.record.incomeStreamId)
        expect(got.row.personId).toBe(want.record.personId)
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
    expect(attributedRecords, 'a recorded wage fell outside every phase call').toBe(recordEvents)
    // An explicit floor, so the identity check can never silently degrade to a
    // call-count check if the fixture ever stops paying anything.
    expect(identityChecks, 'the fixture no longer records any wages').toBeGreaterThan(50)
  })

  // G4a — THE ONE LIVE ASSOCIATION GUARD, on `ordinaryIncome`.
  it('folds each wage row into the year’s tax base row by row, not pre-summed', () => {
    const { result, byYear } = run()
    let yearsWithTwoRows = 0
    let yearsThatDiscriminateAssociation = 0
    for (const year of result.years) {
      const base = ordinaryFoldBase(year)
      const rows = rowsFor(byYear, year.year)
      let rowByRow = base
      let summed = 0
      for (const row of rows) {
        rowByRow += row.amount
        summed += row.amount
      }
      if (rows.length > 1) yearsWithTwoRows++
      if (!Object.is(rowByRow, base + summed)) yearsThatDiscriminateAssociation++
      // `toBe`, never `toBeCloseTo`: addition ORDER is what is being pinned.
      expect(soleOrdinaryIncome(year.year), `ordinaryIncome ${year.year}`).toBe(rowByRow)
    }
    // The base identity itself, proved at a year with no wage rows at all:
    // adding nothing is exact, so this is a clean read of the accumulator.
    expect(rowsFor(byYear, QUIET_YEAR)).toEqual([])
    const quiet = result.years.find((y) => y.year === QUIET_YEAR)!
    expect(soleOrdinaryIncome(QUIET_YEAR)).toBe(ordinaryFoldBase(quiet))
    expect(yearsWithTwoRows, 'fixture no longer has a year that folds two wage rows').toBeGreaterThan(0)
    expect(
      yearsThatDiscriminateAssociation,
      'fixture no longer contains a year where row-by-row and summed-first wage folds differ',
    ).toBeGreaterThan(0)
  })

  // G4b — THE PERMUTATION GUARD. Every wage row folds into the same
  // accumulator with no discriminant, so ANY reordering of the returned rows is
  // a re-association once the base is non-zero — which the sibling pass-2 seam
  // could not say of its own rows. The counterfactual here is the rows reversed.
  it('folds the rows in row order, not permuted', () => {
    const { result, byYear } = run()
    let yearsThatDiscriminatePermutation = 0
    for (const year of result.years) {
      const base = ordinaryFoldBase(year)
      const rows = rowsFor(byYear, year.year)
      let rowByRow = base
      for (const row of rows) rowByRow += row.amount
      let reversed = base
      for (let i = rows.length - 1; i >= 0; i--) reversed += rows[i]!.amount
      if (!Object.is(reversed, rowByRow)) {
        yearsThatDiscriminatePermutation++
        expect(soleOrdinaryIncome(year.year), `ordinaryIncome ${year.year}`).not.toBe(reversed)
      }
    }
    expect(
      yearsThatDiscriminatePermutation,
      'fixture no longer contains a year where reversing the rows moves the ordinary fold',
    ).toBeGreaterThan(0)
  })

  // G4c — ZERO-BASED, and said so rather than implied. `incomes.wages` has
  // exactly one writer — this phase — so `0 + a + b` IS `0 + (a + b)` and this
  // exact match proves SELECTION and PER-ROW VALUES and NOTHING about
  // association. It is worth having anyway: it catches a dropped row, a wrong
  // amount, or a row folded into the wrong accumulator.
  it('folds every row’s amount into the year’s published wages, exactly', () => {
    const { result, byYear } = run()
    for (const year of result.years) {
      let total = 0
      for (const row of rowsFor(byYear, year.year)) total += row.amount
      expect(year.incomes.wages, `incomes.wages ${year.year}`).toBe(total)
    }
  })

  // G5 — the published ledger, and the sink's drop rule.
  it('publishes each positive row to the ledger and drops only what the sink drops', () => {
    const { result, byYear } = run({ capture: true })
    let publishedRows = 0
    let droppedZeroRows = 0
    for (const year of result.years) {
      const rows = rowsFor(byYear, year.year)
      const cashFlow = year.cashFlow
      expect(cashFlow, `no cash flow captured for ${year.year}`).toBeDefined()
      // THE FILTER RULE, stated as an assertion rather than assumed: the
      // published set is the helper's rows filtered to `amount > 0`.
      const expectedIds = new Set(
        rows.filter((r) => r.amount > 0).map((r) => cashFlowLineIds.sourceWages(r.record.incomeStreamId)),
      )
      const actualIds = new Set(cashFlow!.sourceLines.filter((l) => l.kind === 'wages').map((l) => l.id))
      expect(actualIds, `wage lines ${year.year}`).toEqual(expectedIds)
      for (const row of rows) {
        const line = cashFlow!.sourceLines.find((l) => l.id === cashFlowLineIds.sourceWages(row.record.incomeStreamId))
        if (row.amount > 0) {
          // Reads the PUBLISHED amount, so it catches an in-place mutation of
          // the helper's record after the caller handed it over. G3's `toBe`
          // IDENTITY line cannot see that — there both sides are the same
          // object — so this is the guard that fails on that injection.
          expect(line?.amountPlanDollars, `${year.year} ${row.record.incomeStreamId}`).toBe(row.amount)
          publishedRows++
        } else {
          expect(line, `${year.year} ${row.record.incomeStreamId} should have been dropped`).toBeUndefined()
          droppedZeroRows++
        }
      }
    }
    expect(publishedRows, 'no wages reached the ledger').toBeGreaterThan(50)
    expect(
      droppedZeroRows,
      'the fixture no longer has a zero-gross wage stream, so the sink’s drop rule is untested',
    ).toBeGreaterThan(0)
  })

  // G6 — THE THREE GATES, each named, each observed from PUBLISHED output and
  // each with a counterfactual so it cannot pass vacuously. A caller that
  // applied only one of the gates, or read the stop age from the wrong place,
  // fails the year where that gate first bites.
  //
  // Its expectations are FIXTURE-DERIVED — `STREAMS`, `openStreamIdsIn`,
  // `foldWages`, `expectedInflFactors` — and it never reads the seam, which is
  // why it survives the orphan and why it also catches UNDER-PRODUCTION at the
  // years its four gate checks touch (measured: an early-out returning no rows
  // for 2034 fails this test as well as G7). G7 is the year-complete version of
  // that same argument; this one is the named-gate version.
  it('closes a stream at its endAge, at the retirementAge fallback, and at death', () => {
    const { result } = run()
    const factors = expectedInflFactors(FLAT_PATH)
    const publishedAt = (year: number) => {
      const found = result.years.find((y) => y.year === year)
      if (found === undefined) throw new Error(`the projection published no year ${year}`)
      return found.incomes.wages
    }
    const gate = (year: number, closingStreamId: string, why: string) => {
      const open = openStreamIdsIn(year)
      expect(open, `${why}: ${closingStreamId} should be closed in ${year}`).not.toContain(closingStreamId)
      // Closed: the published total is the fold WITHOUT it …
      expect(publishedAt(year), `${why} in ${year}`).toBe(foldWages(open, year, factors))
      // … and genuinely not the fold WITH it, so the check is not vacuous.
      expect(publishedAt(year), `${why} in ${year} — the counterfactual is identical`).not.toBe(
        foldWages([...open, closingStreamId], year, factors),
      )
      // And it really did pay the year before.
      const prior = openStreamIdsIn(year - 1)
      expect(prior, `${why}: ${closingStreamId} should still be open in ${year - 1}`).toContain(closingStreamId)
      expect(publishedAt(year - 1), `${why} in ${year - 1}`).toBe(foldWages(prior, year - 1, factors))
    }
    // The stream's own endAge, on two different people.
    gate(2034, 'w-sam-early', 'endAge 55 closes Sam’s early stream')
    gate(2038, 'w-pat-main', 'endAge 62 closes Pat’s main stream')
    // THE FALLBACK: `w-pat-side` names no endAge, so its stop age is Pat's
    // retirementAge. A caller that ignored the fallback would keep paying it.
    gate(2041, 'w-pat-side', 'the retirementAge fallback closes Pat’s side stream')
    // DEATH, with the age window still open: Sam's endAge is 70 and Sam attains
    // 70 in 2049, so only the `alive` half of the gate can close this in 2042.
    gate(SAM_FIRST_DEAD_YEAR, 'w-sam-long', 'death closes Sam’s long stream')
    // The last stream closes, and the household earns nothing thereafter.
    expect(publishedAt(2046)).toBe(0)
    expect(publishedAt(2045)).toBeGreaterThan(0)
  })

  // G7 — THE ONLY GUARD THAT HOLDS EVERY PROJECTED YEAR TO A FIXTURE-DERIVED
  // SCHEDULE. G3, G4a, G4b, G4c and G5 all build their expected values out of
  // the rows the helper returned, which makes them self-consistent under a
  // helper that silently UNDER-PRODUCES: one early-out returning no rows for
  // some year loses that year's whole wage contribution to both accumulators,
  // the map and the recorder, and every one of those guards agrees with it. G1
  // pins that the call HAPPENS but says nothing about what comes back.
  //
  // So this guard states the fixture's own schedule and holds the projection to
  // it. Both expectations come from `STREAMS` and `openStreamIdsIn` above, and
  // the second reads PUBLISHED output without consulting the seam at all. Its
  // reach is the fixture's reach: the 35 years 2026-2060, and these six stream
  // shapes.
  //
  // NOT the only fixture-derived guard, though it is the only year-complete
  // one. G6 above is built from the same constants and catches the same defect
  // class at the years its four gate checks touch — measured, an early-out
  // returning no rows for 2034 fails G6 and G7, while the same early-out at
  // 2035 fails G7 alone.
  it('pays the fixture’s whole pass-1 schedule every year, on a fixture-derived expectation', () => {
    for (const market of [null, INFLATION_PATH] as const) {
      const { result, byYear } = run(market === null ? {} : { market: { inflationPct: [...market] } })
      const factors = expectedInflFactors(market ?? FLAT_PATH)
      const where = market === null ? 'flat' : 'market path'
      for (const year of result.years) {
        const open = openStreamIdsIn(year.year)
        expect(rowsFor(byYear, year.year).length, `row count ${year.year} (${where})`).toBe(open.length)
        // PUBLISHED, and exact, folded in `plan.incomes` order from the
        // fixture's own constants. This never consults the seam. Honest scope:
        // `incomes.wages` is zero-based, so this pins SELECTION and PER-ROW
        // VALUES — not association.
        expect(year.incomes.wages, `incomes.wages ${year.year} (${where})`).toBe(
          foldWages(open, year.year, factors),
        )
      }
      // The horizon itself, so a projection that simply stopped early cannot
      // pass by having no years left to disagree about.
      expect(result.years.map((y) => y.year)).toEqual(
        Array.from({ length: END_YEAR - START_YEAR + 1 }, (_unused, i) => START_YEAR + i),
      )
    }
  })

  // G8 — `wagesByPerson` IS OBSERVABLE, which nothing above can see. The map is
  // this phase's third fold and it is read far downstream: the Social Security
  // earnings test withholds from a claimant's benefit in proportion to that
  // person's own wages. Pat claims at 62 and keeps two small streams, and the
  // fixture is sized so the two TOGETHER clear the indexed threshold while
  // EACH ALONE falls below it — so this fails not only when the caller drops
  // the fold, but when it folds only one of a person's rows.
  //
  // Scope, stated rather than implied: this pins that the map is populated for
  // the right person in the right years. It does not pin the association of its
  // fold, and nothing can — the map is rebuilt empty each year, so a person's
  // first row folds onto 0 and pre-summing is exactly equivalent (measured: the
  // pre-sum injection moved 0 of 308 differential-corpus entries).
  //
  // The "each alone falls below" half is a FIXTURE SIZING fact this test only
  // PARTLY observes, and WHICH of Pat's two streams is lifted decides it. Both
  // edits named here are fixture-only, with no caller defect present, and both
  // are measured. Lift `w-pat-side` alone to a flat 30_000, so it clears the
  // exempt amount unaided, and every assertion here stays green (1 of 33 fails:
  // G8b, and G8b alone) — that is the sizing this test cannot see. Lift
  // `w-pat-tail` alone instead and THIS test fails, at 2041: `earnings-test
  // withholding 2041: expected 3997.302939534784 to be +0`, because 2041 sits
  // outside `EARNINGS_TEST_YEARS` and the tail is Pat's ONLY open stream there,
  // so the `=== 0` branch below trips. G8b, the test that follows this one,
  // holds the fixture to both sizings.
  it('feeds each person’s own wage total to the Social Security earnings test', () => {
    const { result } = run()
    let withheldYears = 0
    for (const year of result.years) {
      if (EARNINGS_TEST_YEARS.includes(year.year)) {
        expect(year.ssEarningsTestWithheld, `earnings-test withholding ${year.year}`).toBeGreaterThan(0)
        // Not clamped to the whole benefit: the withheld amount is still a
        // function of the wage total at the margin, which is what makes the
        // partial-fold defect visible here.
        expect(year.incomes.socialSecurity, `benefit remaining after withholding ${year.year}`).toBeGreaterThan(0)
        withheldYears++
      } else {
        expect(year.ssEarningsTestWithheld, `earnings-test withholding ${year.year}`).toBe(0)
      }
    }
    expect(withheldYears, 'the fixture no longer withholds against wages in any year').toBe(
      EARNINGS_TEST_YEARS.length,
    )
  })

  // G8b — G8'S PREMISE, PINNED, and the two halves of that premise are not
  // equally at risk. G8 above reads only that `ssEarningsTestWithheld` is
  // non-zero in `EARNINGS_TEST_YEARS`, which a `w-pat-side` sized to clear the
  // indexed exempt amount unaided also satisfies — measured below, and in that
  // fixture a caller folding only one of Pat's rows into `wagesByPerson` would
  // leave G8 green. The `w-pat-side` iteration is what covers that, and it is
  // the load-bearing one.
  //
  // THE `w-pat-tail` ITERATION IS BELT-AND-BRACES, said plainly rather than
  // implied. MEASURED: the mirror edit, `w-pat-tail` alone lifted to 30_000,
  // already fails G8 at 2041 — `expected 3997.302939534784 to be +0` — where
  // the tail is Pat's ONLY open stream and the year sits outside
  // `EARNINGS_TEST_YEARS`. REASONED, and marked as such because it generalises
  // beyond that one size: the wage and the exempt amount are scaled by the SAME
  // inflation path (`inflFactor` for the row, `limitScale` for
  // `earningsTestBelowFraAnnual`, `simulate.ts`), so their ratio does not move
  // between years and a tail sized to clear alone in 2038-2040 clears in 2041
  // too, bar a sizing within an ulp of the threshold. That fixedness shows in
  // the mirror edit's own numbers: 2041 is a year where the tail is Pat's only
  // open stream, so G8's 2041 figure and G8b's 2038 figure are withholdings on
  // that one stream alone, and they stand in the years' inflation ratio —
  // 3711.8931549197805 × 1.025³ lands one ulp from the reported
  // 3997.302939534784. Both iterations are kept so that each constant is
  // asserted where the `STREAMS` comment claims it, instead of one of them
  // resting on a year G8 happens to reach.
  //
  // THE COUNTERFACTUAL IS RUN, NOT COMPUTED. Nothing here restates the exempt
  // amount or the withholding formula; the same fixture is re-run with only ONE
  // wage stream in `plan.incomes` and the engine's own earnings test answers.
  // That run puts exactly the same double in Pat's map entry that a one-row fold
  // would leave there, because a row's amount is `annualGross * raiseFactor *
  // inflFactor` and reads no other stream. Nothing else feeding the test moves
  // either: the exempt amount is `limitScale(pack, isStandIn, year)` times a
  // parameter-pack constant, and Pat's benefit is built from `piaMonthly` and
  // the claim age — the stream sets `earnings: null`, so no wage record feeds
  // it. A wage stream touches none of them.
  //
  // Like G6 and G8, this reads PUBLISHED output only and never the seam.
  //
  // MEASURED, by making exactly the edit this guard exists to catch: lifting
  // `w-pat-side` alone, from 14_111.11 to a flat 30_000, so that Pat's side
  // stream clears the exempt amount with no help from the tail stream. All TEN
  // guards above stayed green — G8 included, which is the whole point — and so
  // did the helper's 22 unit tests; 1 of the 33 failed, this one, by name at
  // the first year it checks:
  //
  //   w-pat-side alone withholds in 2038 … expected 3711.8931549197805 to be +0
  //
  // The assertion aborts there, so 2038 is what was OBSERVED; 2039 and 2040 were
  // never reached on that run. That plus the `w-pat-tail` mirror edit recorded
  // above — 2 of 33 failing, this test and G8 — is the whole of the G8b
  // measurement: two fixture edits, over this file and the helper's unit tests,
  // with the engine source untouched in both.
  it('sizes each of Pat’s streams to fall under the earnings-test exempt amount alone', () => {
    const factors = expectedInflFactors(FLAT_PATH)
    for (const streamId of ['w-pat-side', 'w-pat-tail'] as const) {
      const { result } = run({ onlyWageStreamIds: [streamId] })
      for (const year of EARNINGS_TEST_YEARS) {
        const published = result.years.find((y) => y.year === year)
        if (published === undefined) throw new Error(`the projection published no year ${year}`)
        // NOT VACUOUS. The stream is the plan's only wage stream, so this
        // zero-based fold is its amount alone, and it really is paying in this
        // year — the zero below therefore means "under the exempt amount" and
        // not "no wages to test".
        expect(published.incomes.wages, `${streamId} pay in ${year}`).toBe(
          expectedStreamAmount(streamId, year, factors),
        )
        expect(published.incomes.wages, `${streamId} pay in ${year}`).toBeGreaterThan(0)
        expect(
          published.ssEarningsTestWithheld,
          `${streamId} alone withholds in ${year} — G8 can no longer catch a partial wagesByPerson fold`,
        ).toBe(0)
      }
    }
  })
})
