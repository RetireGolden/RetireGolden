/**
 * Income pass 1 — wages, the once-per-year annual phase lifted out of
 * `simulatePlan` as a pure function ("extract the domain you touch",
 * DOCS/standards.md). The domain, as it was labelled at the call site:
 *
 * > Pass 1: wages (must precede Social Security for the earnings test).
 *
 * That placement is the whole reason this pass runs first, and it is a fact
 * about the CALLER rather than about this module: `wagesByPerson` must be
 * complete before pass 3 runs the Social Security earnings test and the SSDI
 * substantial-gainful-activity gate. Nothing here enforces that; moving the
 * call site would break it silently.
 *
 * WHAT IT TAKES: the plan's income-stream list, the projected and start years,
 * this year's cumulative general-inflation factor, and the two per-person
 * lookups the stop rule reads.
 *
 * WHAT IT PRODUCES: one row per WAGES stream that CONTRIBUTES this year, in
 * `plan.incomes` order — never one row per PERSON. That distinction is
 * load-bearing rather than stylistic; see below.
 *
 * WHAT IT REFUSES: it will not sum across rows, will not touch a map, and will
 * not call a recorder. Of the caller's three accumulators only `ordinaryIncome`
 * can be non-zero when this phase runs — its one earlier writer in the year is
 * the distributed-yield pass, which contributes nothing on a plan with no
 * yield-distributing taxable account — and IEEE-754 addition is not
 * associative, so `B + a + b` is not in general `B + (a + b)`. Returning rows
 * and letting the caller fold them one at a time keeps every floating-point
 * operation identical and identically ordered to the inlined phase. The other
 * two are ZERO-BASED and an exact match on either proves selection and per-row
 * values and nothing about ordering: `incomes.wages` is declared 0 with this
 * loop as its only writer, and each `wagesByPerson` entry starts from `?? 0`.
 *
 * ONE ROW PER STREAM, NEVER PER PERSON. `wagesByPerson` is a read-modify-write
 * of shared state inside the loop, and a later iteration for the SAME person
 * observes the earlier one. Two wages streams for one person is legal —
 * `model/plan.ts` puts no uniqueness on `personId`, and its only cross-check
 * verifies household membership. A helper that pre-aggregated per person would
 * produce the same per-person total and the same `incomes.wages` (both folds
 * are zero-based) while calling `recordWages` once instead of twice, so the
 * ledger would carry one line where the inlined phase pushed two. Rows are also
 * keyed by POSITION and never by stream id: `parsePlan` accepts duplicate
 * income-stream ids, and the published wage line id is derived from that id.
 *
 * THE STOP RULE IS LIFTED WITH ITS LAZINESS INTACT. `stream.endAge ??
 * person.retirementAge` short-circuits, so `person.retirementAge` is read only
 * when `endAge` is nullish, and `stateOf`'s non-null assertion is what throws
 * on an unknown `personId`. That is why this module takes `personById` and
 * `peopleStates` and re-derives both lookups in the original expression order,
 * rather than being handed a pre-resolved `stopAge` or a
 * `retirementAgeByPersonId` map: with a pre-resolved map an unknown personId
 * would resolve to `undefined ?? null`, `stopAge` would be null, and the wage
 * would PAY where the inlined phase threw. `model/plan.ts` rejects an unknown
 * personId on a wages stream, so that is unreachable through `parsePlan` and
 * moves no number on any valid plan — and a differential dump could not see it
 * either. It is a silent behaviour change on a hand-built `Plan`, which is
 * reason enough not to make it.
 *
 * OPERAND ORDER IS LOAD-BEARING. `annualGross * raiseFactor * inflFactor`
 * evaluates left to right; re-grouping it as `annualGross * (raiseFactor *
 * inflFactor)` while tidying is a different double. Measured: that exact
 * re-association moves 52 of the 232 entries in the differential corpus, while
 * no PRE-EXISTING test in the repository fails. Not because the matchers are
 * all tolerant — `simulate.test.ts:188`, `earlyAccess.test.ts:346`,
 * `simulate.annualCashFlow.captureOff.test.ts:141` and
 * `seppHsaAndCharacter.approximation.test.ts:266` assert `incomes.wages` with
 * an exact `toBe` — but because those fixtures sit on values where the two
 * groupings land on the same double. The only two tests that fail under it are
 * the ones added with this extraction: `internal/wageIncome.test.ts` and
 * `simulate.wageIncomeDelegation.test.ts`. The defensive `?? 0` on
 * `realGrowthPct` is kept verbatim even though `model/plan.ts` defaults it.
 *
 * IT ALLOCATES MORE THAN THE INLINED PHASE DID, on the default path. The
 * `RecordedWage` literal used to be built INSIDE `yearSites?.recordWages({ … })`,
 * and optional chaining does not evaluate a call's arguments when the receiver
 * is nullish — so under default options (every product projection, and every
 * `simulatePlan` re-entry inside Monte Carlo, the optimizer and the spending
 * solver) it was never constructed. Here the row owns it, which is what lets
 * the delegation test assert with `toBe` that the object reaching the ledger IS
 * this one. The structural bound is one object per contributing wage stream per
 * year, and `model/plan.ts` caps the household at 2 people though streams per
 * person are unbounded. That is a bound, not a benchmark: no timing was
 * measured for this phase, and none is claimed. The sibling phase
 * `internal/otherIncomeStreams.ts` measured the same trade at 2.6-3.5 ns per
 * row and could not separate the two trees end to end; this phase's row rate is
 * lower still, but that is an inference from its shape rather than a
 * measurement of it.
 *
 * It mutates nothing — the `IncomeStream`s, `Person`s and `PersonYearState`s
 * ARE the caller's by reference, and are `readonly` here so the compiler checks
 * that rather than the prose asserting it — and it holds no module-scope state,
 * so it is safe under the optimizer's and Monte Carlo's repeated re-entry into
 * `simulatePlan` against the same `Plan` object.
 */
import type { IncomeStream, Person } from '../../model/plan.js'
import type { RecordedWage } from '../annualCashFlowYearSites.js'
import type { PersonYearState } from './types/yearLedger.js'

/** The year-scoped state this phase reads. */
export interface WageIncomeYearInput {
  /**
   * `plan.incomes`, whole and unsorted. Order fixes the caller's
   * `ordinaryIncome` fold order and the `wagesByPerson` insertion order.
   */
  readonly incomes: readonly Readonly<IncomeStream>[]
  /** The projected calendar year. */
  readonly year: number
  /** The projection's first year; the raise exponent is `year - startYear`. */
  readonly startYear: number
  /**
   * `inflFactorFrom(startYear, year)`, already computed by the caller and
   * passed as the resulting NUMBER exactly as the inlined phase used it. It
   * rides the Monte Carlo inflation path, so re-deriving it here from the
   * plan's flat assumption would silently break every market-path run.
   */
  readonly inflFactor: number
  /**
   * `personById`. Only `retirementAge` is read, and only when `stream.endAge`
   * is nullish — the `??` must stay lazy. See the stop-rule note above.
   */
  readonly personById: ReadonlyMap<string, Readonly<Person>>
  /**
   * `stateOf`'s backing array. The `find(…)!` is reproduced inside, unchanged;
   * `stateOf` closes over nothing else, so passing the array is exactly
   * equivalent to passing the function.
   */
  readonly peopleStates: readonly Readonly<PersonYearState>[]
}

/** One wages stream's payment for one year. */
export interface WageIncomeRow {
  readonly personId: string
  readonly incomeStreamId: string
  readonly amount: number
  /**
   * The ledger payload, built from the same `amount` double as the row's own
   * scalar and handed to the caller to publish UNREBUILT — that sharing is what
   * makes the delegation test's object-identity assertion possible.
   */
  readonly record: RecordedWage
}

/** One row per wages stream that contributes this year, in `incomes` order. */
export function wageIncome(input: WageIncomeYearInput): readonly WageIncomeRow[] {
  const { incomes, year, startYear, inflFactor, personById, peopleStates } = input
  const rows: WageIncomeRow[] = []
  for (const stream of incomes) {
    if (stream.type !== 'wages') continue
    const person = personById.get(stream.personId)!
    const s = peopleStates.find((state) => state.personId === stream.personId)!
    const stopAge = stream.endAge ?? person.retirementAge
    if (!s.alive || (stopAge !== null && s.ageAttained >= stopAge)) continue
    const raiseFactor = Math.pow(1 + (stream.realGrowthPct ?? 0) / 100, year - startYear)
    const amount = stream.annualGross * raiseFactor * inflFactor
    rows.push({
      personId: stream.personId,
      incomeStreamId: stream.id,
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
