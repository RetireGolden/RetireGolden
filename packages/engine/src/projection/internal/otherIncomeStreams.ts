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
 * is already non-zero whenever the year has wages or distributed taxable yield
 * — both land in it earlier in the same year — and IEEE-754 addition is not
 * associative, so `ordinaryIncome += a; ordinaryIncome += b` is not in general
 * equal to `ordinaryIncome += (a + b)`. Returning rows and letting the caller
 * fold them one at a time keeps every floating-point operation identical and
 * identically ordered to the inlined phase this replaces. It also refuses to
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
