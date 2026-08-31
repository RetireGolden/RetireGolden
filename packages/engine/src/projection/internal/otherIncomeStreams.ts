/**
 * Income pass 2 — "other non-SS streams", the once-per-year annual phase lifted
 * out of `simulatePlan` as a pure function ("extract the domain you touch",
 * DOCS/standards.md). The domain, as it was labelled at the call site:
 *
 * > Pass 2: other non-SS streams.
 *
 * Pass 1 is wages (it must precede Social Security for the earnings test) and
 * pass 3 is Social Security. This is the pass between them: the plan's
 * `recurring` and `oneTime` income streams, which are neither wages nor a
 * benefit and so carry their own window, their own survivorship rule and their
 * own tax routing.
 *
 * WHAT IT TAKES: the plan's income-stream list plus the three year-scoped
 * scalars the phase reads — the projected calendar year, whether anyone is
 * still alive, and this year's general-inflation factor.
 *
 * WHAT IT PRODUCES: one row per stream that CONTRIBUTES this year, in
 * `plan.incomes` order, saying what kind of stream it was, how much it paid and
 * how that amount is taxed. Recurring and one-time rows INTERLEAVE in that one
 * list exactly as they interleave in the plan, because that is the order the
 * caller folds them in.
 *
 * WHAT IT REFUSES: it will not sum across rows. The caller's `ordinaryIncome`
 * MAY already be non-zero when this phase runs — its only earlier writers in
 * the year are the distributed-yield pass and pass 1 wages, and a plan can
 * carry neither (measured over the phase-3 differential corpus: non-zero at
 * entry in 2346 of 6336 year-runs, zero in the other 3990). Where it is
 * non-zero, IEEE-754 addition is not associative and
 * `ordinaryIncome += a; ordinaryIncome += b` is not in general equal to
 * `ordinaryIncome += (a + b)`. Returning rows and letting the caller fold them
 * one at a time keeps every floating-point operation identical and identically
 * ordered to the inlined phase this replaces, at every base. It also refuses to
 * touch the ledger: `incomes.recurring`, `incomes.oneTime`, `ordinaryIncome`
 * and `oneTimeGains` stay in `simulatePlan`'s year scope, and the two recorders
 * are called by the caller, per row.
 *
 * It mutates nothing — the `IncomeStream` objects ARE the caller's `Plan` by
 * reference, and are `readonly` here so the compiler checks that rather than
 * the prose asserting it — and it holds no module-scope state, so it is safe
 * under the optimizer's and Monte Carlo's repeated re-entry into `simulatePlan`
 * against the same `Plan` object. There is no delete-as-you-go hazard of the
 * kind `internal/fixedAssetDispositions.ts` had to model: this phase writes no
 * map, no `BalanceState` and no cross-year object, and nothing it writes inside
 * the loop is read back inside the loop.
 *
 * TWO ASYMMETRIES THAT LOOK LIKE BUGS AND ARE PRESERVED ANYWAY. This is a
 * behaviour-preserving refactor, so both survive exactly as they were:
 *
 *   - A recurring stream STOPS when the household dies (`anyAlive`); a one-time
 *     stream has no such gate and PAYS OUT in a post-death year. (Measured
 *     reachable: 6 one-time rows in the differential corpus are paid after the
 *     last death.)
 *   - A recurring stream may be inflation-adjusted; a one-time stream's amount
 *     is NEVER inflated, whatever the year.
 *
 * THREE RULES THAT ARE EASY TO GET WRONG IN THE SAFE-LOOKING DIRECTION:
 *
 *   (a) ROWS ARE KEYED BY POSITION, NEVER BY STREAM ID. `model/plan.ts` raises
 *       on duplicate action, person and account ids, but NOT on duplicate
 *       income-stream ids — `parsePlan` accepts two streams sharing one id
 *       (measured). Any map-by-id, here or in a caller reconciling these rows,
 *       would collapse them.
 *   (b) ZERO-AMOUNT ROWS ARE STILL RETURNED. A recurring stream with
 *       `annualAmount: 0` contributes `+= 0` and still reaches
 *       `recordRecurringIncome`, which drops it via `skipNonPositive`
 *       (`annualCashFlowYearSites.ts`). Filtering it out here would leave every
 *       projection number identical while changing the recorder CALL count.
 *       The helper returns the row; the sink decides whether to keep it.
 *   (c) `taxTreatment: 'none'` ROWS ARE STILL ROWS. They fold into
 *       `incomes.recurring` / `incomes.oneTime` and, when positive, do reach
 *       the ledger. Only the `ordinaryIncome` and `oneTimeGains` legs are
 *       conditional on treatment.
 */
import type { IncomeStream } from '../../model/plan.js'
import type { RecordedStreamIncome } from '../annualCashFlowYearSites.js'

/**
 * The year-scoped state this phase reads. Every field is `readonly`, so the
 * non-mutation claim above is checked by the compiler rather than asserted in
 * prose.
 */
export interface OtherIncomeStreamYearInput {
  /**
   * `plan.incomes`. Iteration order is load-bearing: it fixes the order the
   * caller folds `ordinaryIncome` in, recurring and one-time rows interleaved,
   * and IEEE-754 addition is not associative. Never sorted, grouped or
   * pre-filtered.
   */
  readonly incomes: readonly Readonly<IncomeStream>[]
  /** The projected calendar year. */
  readonly year: number
  /** Whether any household member is alive. Gates RECURRING streams only. */
  readonly anyAlive: boolean
  /**
   * `inflFactorFrom(startYear, year)`, already computed by the caller and
   * passed as the resulting NUMBER exactly as the inlined phase used it. It
   * derives from the Monte Carlo inflation path, so re-deriving it here from
   * the plan's flat assumption would silently break every market-path run.
   */
  readonly inflFactor: number
}

/**
 * One contributing stream's payment for one year. The `record` is the ledger
 * payload, built from the same `amount` double as the row's own scalar, never
 * recomputed, and handed to the caller to publish UNREBUILT — that sharing is
 * what makes the delegation test's object-identity assertion possible.
 *
 * THE PAYLOAD IS BUILT EAGERLY, and on the default path that is an allocation
 * the inlined phase did not make. The inlined phase passed the literal straight
 * to `yearSites?.recordRecurringIncome({ … })`, and optional chaining does not
 * evaluate a call's arguments when the receiver is nullish — so under default
 * options, where `yearSites` is null (every product projection, and every
 * `simulatePlan` re-entry inside Monte Carlo, the optimizer and the spending
 * solver), the object was never constructed at all. Here it is constructed for
 * every contributing row whether or not a sink will consume it. No projection
 * number moves.
 *
 * IT IS NOT THE ONLY NEW ALLOCATION HERE. A pure helper has to return rows, so
 * the row objects and the array are new on the default path too, and no
 * arrangement of a pure helper avoids them. Measured on this phase in
 * isolation, at 40M rows per sample: 8.7-8.9 ns per contributing row as
 * written, against 5.1-5.3 ns for a variant that keeps the row but rebuilds the
 * payload back at the call site under the same optional chaining. So the eager
 * payload is ~3.5 ns per row, about 40% of what this phase costs; the residual
 * 5 ns is the loop the inlined phase also ran, plus the rows and array that
 * being a helper requires. End to end even the 3.5 ns does not surface: across
 * the phase-3 differential corpus this phase yields 0.491 rows per projected
 * year, so a 40-year projection carries ~20 of these objects, and on a
 * purpose-built plan running ~80 pass-2 rows a year (~160x the corpus rate) the
 * two trees timed the same to within run-to-run noise, the lazy one slower in
 * half the rounds.
 *
 * SO IT STAYS EAGER, and the reason is the guard rather than the nanoseconds.
 * The row OWNS its payload, which is what lets
 * `simulate.otherIncomeStreamsDelegation.test.ts` assert with `toBe` that the
 * object reaching the ledger IS this one — the only check in the repository
 * that separates real delegation from a caller which invokes the helper for
 * effect and then records its own byte-identical rebuild. Making the payload
 * conditional would take that away: `record` would be present only when an
 * input flag agreed with the caller's `yearSites`, an invariant no type can
 * check and a silently dropped ledger line whenever it did not. That is a worse
 * trade than 3.5 ns per row.
 *
 * IF A THIRD KIND IS EVER ADDED HERE, GO AND LOOK AT THE CALLER. `simulate.ts`
 * tests `row.kind === 'oneTime'` on its second arm rather than falling through
 * on `else`, so an unrecognised kind is SKIPPED — which is what the inlined
 * phase did with a stream that was neither `recurring` nor `oneTime`. That is
 * deliberate, and TypeScript will not flag the omission for you: a bare `else`
 * stays assignable, and would quietly fold a new kind into `incomes.oneTime`,
 * `oneTimeGains` and the one-time recorder.
 */
export type OtherIncomeStreamRow =
  | {
      readonly kind: 'recurring'
      readonly amount: number
      readonly taxTreatment: 'ordinary' | 'none'
      readonly record: RecordedStreamIncome
    }
  | {
      readonly kind: 'oneTime'
      readonly amount: number
      readonly taxTreatment: 'ordinary' | 'capitalGain' | 'none'
      readonly record: RecordedStreamIncome
    }

/**
 * One row per recurring or one-time stream that contributes this year, in
 * `plan.incomes` order. Wages and Social Security streams are passes 1 and 3
 * and are skipped here.
 */
export function otherIncomeStreams(
  input: OtherIncomeStreamYearInput,
): readonly OtherIncomeStreamRow[] {
  const { incomes, year, anyAlive, inflFactor } = input
  const rows: OtherIncomeStreamRow[] = []
  for (const stream of incomes) {
    if (stream.type === 'recurring') {
      if ((stream.startYear !== null && year < stream.startYear) || (stream.endYear !== null && year > stream.endYear)) continue
      if (!anyAlive) continue
      const amount = stream.annualAmount * (stream.inflationAdjusted ? inflFactor : 1)
      rows.push({
        kind: 'recurring',
        amount,
        taxTreatment: stream.taxTreatment,
        record: {
          incomeStreamId: stream.id,
          amount,
          taxTreatment: stream.taxTreatment,
        },
      })
    } else if (stream.type === 'oneTime') {
      if (stream.year !== year) continue
      rows.push({
        kind: 'oneTime',
        amount: stream.amount,
        taxTreatment: stream.taxTreatment,
        record: {
          incomeStreamId: stream.id,
          amount: stream.amount,
          taxTreatment: stream.taxTreatment,
        },
      })
    }
  }
  return rows
}
