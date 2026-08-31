/**
 * Income pass 1 — wages, the once-per-year annual phase lifted out of
 * `simulatePlan` as a pure function ("extract the domain you touch",
 * DOCS/standards.md). The domain, as it was labelled at the call site:
 *
 * > Pass 1: wages (must precede Social Security for the earnings test).
 *
 * Pass 2 is the other non-SS streams (`internal/otherIncomeStreams.ts`) and
 * pass 3 is Social Security. This is the first of the three, and its position
 * is load-bearing for a reason outside this file: pass 3's earnings test reads
 * the per-person wage totals the caller folds from these rows.
 *
 * WHAT IT TAKES: the plan's income-stream list, the two person lookups the
 * phase uses, and the three year-scoped scalars — the projected calendar year,
 * the projection's start year, and this year's general-inflation factor.
 *
 * WHAT IT PRODUCES: one row per wage stream that PAYS this year, in
 * `plan.incomes` order, saying whose wages they are, how much was paid, and
 * carrying the ledger payload for that payment.
 *
 * WHAT IT REFUSES: it will not sum across rows, and it will not write anything
 * the inlined phase wrote. The three accumulators — `incomes.wages`,
 * `ordinaryIncome` and the `wagesByPerson` map — and the `recordWages` call all
 * stay in `simulatePlan`'s year scope. Only ONE of the three folds can move a
 * number under re-association, and it is worth naming which, because the other
 * two cannot:
 *
 *   - `ordinaryIncome` is the LIVE one. Its only earlier writer in the year is
 *     the distributed-yield pass (`simulate.ts`), so a plan with a yielding
 *     taxable account enters this phase with a non-zero base, and there
 *     `B + a + b` is not in general `B + (a + b)` in IEEE-754. Measured over
 *     the 77-member differential corpus: of 9788 year-runs, 2184 produce at
 *     least one wage row, 364 produce two or more onto a non-zero base, and in
 *     104 of them pre-summing the rows before the fold lands on a different
 *     double. Injecting exactly that pre-sum moved 20 of 308 corpus entries,
 *     across 5 of 77 members.
 *   - `incomes.wages` is ZERO-BASED — this phase is its sole writer — so
 *     `0 + a + b` IS `0 + (a + b)` and no fold order can move it.
 *   - `wagesByPerson` is ZERO-BASED TOO, and that is measured rather than
 *     assumed. The map is rebuilt empty each year, so a person's first stream
 *     folds onto 0 and the pre-summed variant adds the same left-to-right
 *     partial sum to the same 0. Injecting a per-person pre-sum moved 0 of 308
 *     corpus entries — no fixture can make that fold discriminate association,
 *     and this file does not claim one does.
 *   - The recorder is a sink, not an accumulator.
 *
 * Returning rows and letting the caller fold them one at a time keeps every
 * floating-point operation identical and identically ordered to the inlined
 * phase this replaces, at every base.
 *
 * TWO PERSON LOOKUPS THAT LOOK REDUNDANT AND ARE NOT. `personById` is a Map
 * (LAST wins on a duplicate id) and `stateOf` is a `find` over an array (FIRST
 * wins). `parsePlan` raises on a duplicate person id only when a retirement
 * action references it (`model/plan.ts`), so a household with two people
 * sharing an id and no such action parses, and the two lookups on the adjacent
 * lines below then resolve to DIFFERENT people — one supplying
 * `retirementAge`, the other `alive`/`ageAttained`. Both are passed in, and
 * `stateOf` is passed as a FUNCTION rather than a second map so the asymmetry
 * survives. Measured reachable, not hypothesised: the corpus carries such a
 * member, and unifying the two lookups moved 4 of 308 entries in it.
 *
 * NO CROSS-ROW VISIBILITY MODEL IS NEEDED HERE, and the reason is worth
 * stating because a sibling phase did need one. `internal/fixedAssetDispositions.ts`
 * deleted from a shared map inside its own loop and a later iteration read the
 * result, so the helper had to reproduce that visibility itself. This phase's
 * only in-loop write to shared state is `wagesByPerson`, nothing it computes
 * reads that map back — `amount` depends on `annualGross`, `raiseFactor` and
 * `inflFactor` and on nothing else — and the fold stays at the call site
 * anyway, so the per-person left-to-right accumulation order is preserved
 * exactly. The helper writes no map, no `BalanceState` and no cross-year
 * object, and holds no module-scope state, so it is safe under the optimizer's
 * and Monte Carlo's repeated re-entry into `simulatePlan` against the same
 * `Plan` object.
 *
 * FOUR THINGS THE LIFT DELIBERATELY DID NOT IMPROVE:
 *
 *   (a) THE TWO BARE NON-NULL ASSERTIONS STAY. `parsePlan` validates that a
 *       wages stream's `personId` names a real person, but `simulatePlan`
 *       accepts a raw `Plan`, so an unvalidated plan must keep throwing rather
 *       than being defensively skipped. Being eager changes WHEN it throws:
 *       the helper throws before the caller folds streams 1..k-1, where the
 *       inlined loop folded those first and threw afterwards. Nothing observes
 *       the difference — the throw escapes `simulatePlan` either way — but it
 *       is a real shape change on that path and is named rather than hidden.
 *   (b) `stopAge` MAY LEGITIMATELY BE NULL. `retirementAge` is nullable and
 *       `endAge` is required-nullable, so `stream.endAge ?? person.retirementAge`
 *       can be null, and the guard tests for that before comparing. A helper
 *       that treated the fallback as always-a-number would stop a
 *       null-`retirementAge` person from ever working. Measured reachable: one
 *       corpus member is built on it, and collapsing the null case to zero
 *       moved 4 of 308 entries.
 *   (c) `stream.realGrowthPct ?? 0` STAYS VERBATIM AND IS UNREACHABLE THROUGH
 *       `parsePlan`. The schema gives `realGrowthPct` a default of 0, so a
 *       parsed plan always carries a number. Measured: 0 of 77 corpus members
 *       and 0 of 400 generated fuzz plans reach the `??` fallback. The
 *       differential dump cannot protect this branch; it is kept because the
 *       inlined phase had it and this is a behaviour-preserving refactor, not
 *       because anything exercises it.
 *   (d) THE ARITHMETIC KEEPS ITS OPERAND ORDER. `Math.pow(1 + x / 100, n)` and
 *       `annualGross * raiseFactor * inflFactor` are lifted as written.
 *       Multiplication is not associative in IEEE-754 either: re-bracketing
 *       that product to `annualGross * (raiseFactor * inflFactor)` moved 96 of
 *       308 corpus entries across 24 members.
 */
import type { IncomeStream, Person } from '../../model/plan.js'
import type { RecordedWage } from '../annualCashFlowYearSites.js'
import type { PersonYearState } from '../types.js'

/**
 * The year-scoped state this phase reads. Every field is `readonly`, so the
 * non-mutation claim above is checked by the compiler rather than asserted in
 * prose.
 */
export interface WageIncomeYearInput {
  /**
   * `plan.incomes`, handed over WHOLE. Iteration order is load-bearing: it
   * fixes the order the caller folds `ordinaryIncome` in, and IEEE-754 addition
   * is not associative. Never sorted, grouped or pre-filtered to `wages`.
   */
  readonly incomes: readonly Readonly<IncomeStream>[]
  /**
   * The caller's person map, built once for the whole projection. Passed rather
   * than rebuilt here because it is LAST-WINS under duplicate person ids — see
   * the two-lookups note above.
   */
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  /**
   * The caller's per-year person state lookup. Passed as a FUNCTION, not a
   * second map, because it is FIRST-WINS where `personById` is last-wins.
   */
  readonly stateOf: (personId: string) => Readonly<PersonYearState>
  /** The projected calendar year. */
  readonly year: number
  /**
   * The projection's first year. Both years are passed so `year - startYear` is
   * computed here operand for operand, rather than the caller handing over a
   * pre-computed elapsed count.
   */
  readonly startYear: number
  /**
   * `inflFactorFrom(startYear, year)`, already computed by the caller and
   * passed as the resulting NUMBER exactly as the inlined phase used it. It
   * derives from the Monte Carlo inflation path, so re-deriving it here from
   * the plan's flat assumption would silently break every market-path run —
   * measured, that substitution moves 128 of 308 corpus entries.
   */
  readonly inflFactor: number
}

/**
 * One wage stream's payment for one year. The `record` is the ledger payload,
 * built from the same `amount` double as the row's own scalar, never
 * recomputed, and handed to the caller to publish UNREBUILT — that sharing is
 * what makes the delegation test's object-identity assertion possible.
 *
 * `personId` is the row's own copy of `stream.personId`, so the caller folds
 * the per-person map without reaching back into the plan.
 *
 * A ZERO-AMOUNT ROW IS STILL A ROW. A stream with `annualGross: 0` inside its
 * age window pays 0, folds `+= 0`, and still reaches `recordWages`, which drops
 * it via `skipNonPositive` (`annualCashFlowYearSites.ts`). Filtering it out
 * here would leave every projection number identical while changing the
 * recorder CALL count. The helper returns the row; the sink decides whether to
 * keep it.
 *
 * THE PAYLOAD IS BUILT EAGERLY, and on the default path that is an allocation
 * the inlined phase did not make. The inlined phase passed the literal straight
 * to `yearSites?.recordWages({ … })`, and optional chaining does not evaluate a
 * call's arguments when the receiver is nullish — so under default options,
 * where `yearSites` is null (every product projection, and every `simulatePlan`
 * re-entry inside Monte Carlo, the optimizer and the spending solver), the
 * object was never constructed at all. Here it is constructed for every paying
 * row whether or not a sink will consume it. No projection number moves.
 *
 * IT IS NOT THE ONLY NEW ALLOCATION HERE. A pure helper has to return rows, so
 * the row objects and the array are new on the default path too, and no
 * arrangement of a pure helper avoids them. Measured at 40M rows per sample,
 * over three interleaved runs of four rounds each, with the caller's four folds
 * present in BOTH arms so that only the payload differs: 31.4-33.1 ns per
 * paying row as written, against 29.7-30.4 ns for a variant whose rows carry no
 * payload and whose caller rebuilds the literal inside
 * `yearSites?.recordWages({ … })` under the same optional chaining. The two
 * ranges do not overlap across twelve samples, so the eager payload does cost
 * something real: about 1.9 ns per row at the medians. The ABSOLUTE figures are
 * dominated by work this phase does either way — a person lookup and a state
 * lookup per stream, and a map get-and-set per row — so they are not comparable
 * to the sibling pass-2 helper's, whose loop does none of that.
 *
 * END TO END IT DOES NOT SURFACE, and the honest form of that claim is an
 * arithmetic prediction from the measured per-row cost rather than a win/loss
 * tally. Across the 77-member differential corpus this phase yields 0.2754 rows
 * per projected year, so a 40-year projection carries about 11 of these objects
 * — around 20 nanoseconds. Even on a plan running 80 wage rows a year, roughly
 * 290x the corpus rate, 3200 rows at ~1.9 ns is about 6 microseconds spread
 * across a whole projection.
 *
 * SO IT STAYS EAGER — but NOT because laziness necessarily costs the guard.
 * `internal/otherIncomeStreams.ts` records the measurement that a memoizing
 * accessor on the row's prototype keeps the identity assertion while building
 * zero payloads on the default path. That shape is available here for the same
 * reasons and is declined for the same ones, and they are judgement rather than
 * measurement: rows would stop being plain object literals in a file whose
 * whole value is being an obviously-pure extraction, and the identity assertion
 * would start holding because an accessor keeps memoizing rather than because
 * the row owns one object. At ~3.4 ns per row on 0.2754 rows per year, that
 * trade is not worth making yet.
 */
export interface WageIncomeRow {
  /** `stream.personId` — the key the caller folds `wagesByPerson` on. */
  readonly personId: string
  readonly amount: number
  readonly record: RecordedWage
}

/**
 * One row per wage stream that pays this year, in `plan.incomes` order.
 * Recurring, one-time and Social Security streams are passes 2 and 3 and are
 * skipped here.
 *
 * A stream is skipped when its owner is not alive, or when the owner has
 * attained the stream's stop age — `endAge` when the stream names one, else the
 * person's `retirementAge`, and neither when both are null. Rows are keyed by
 * POSITION, never by stream id: `parsePlan` accepts duplicate income-stream
 * ids, so any map-by-id here or in a caller reconciling these rows would
 * collapse two streams into one.
 */
export function wageIncomeStreams(input: WageIncomeYearInput): readonly WageIncomeRow[] {
  const { incomes, personById, stateOf, year, startYear, inflFactor } = input
  const rows: WageIncomeRow[] = []
  for (const stream of incomes) {
    if (stream.type !== 'wages') continue
    const person = personById.get(stream.personId)!
    const s = stateOf(stream.personId)
    const stopAge = stream.endAge ?? person.retirementAge
    if (!s.alive || (stopAge !== null && s.ageAttained >= stopAge)) continue
    const raiseFactor = Math.pow(1 + (stream.realGrowthPct ?? 0) / 100, year - startYear)
    const amount = stream.annualGross * raiseFactor * inflFactor
    rows.push({
      personId: stream.personId,
      amount,
      record: {
        incomeStreamId: stream.id,
        personId: stream.personId,
        amount,
      },
    })
  }
  return rows
}
