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
 * SURVIVORSHIP: NOTHING IS PAID AFTER THE LAST DEATH. Both arms are gated on
 * `anyAlive`, and that is not this phase's own rule. The ledger has no
 * post-household cash-flow path — recorded as a documented simplification in
 * the domain rules reference (§19, which accepts a KNOWN understatement of a
 * period-certain annuity's estate value rather than pay past the household) and
 * stated for income streams in DOCS/features/README.md §3. Every other HOUSEHOLD
 * flow obeys it: one-time spending GOALS are skipped (`simulate.rmd-roth.test.ts`), TIPS
 * ladder cash stops (`incomeFloor.test.ts`), wages stop at each person's own
 * death, and lifestyle spending scales to zero.
 *
 * READ THE SCOPE PRECISELY, because it is narrower than "no number moves". The
 * rule covers flows TO AND FROM THE HOUSEHOLD. A portfolio that outlives it
 * keeps settling: distributed taxable-account yield still accrues, a planned
 * property sale in a post-death year still closes, and scheduled debt service
 * still runs, none of them gated. The question the rule asks of a new flow is
 * whether a living person is on one end of it.
 *
 * Before the gate was hoisted here, the one-time arm alone had NONE, and paid a
 * windfall into a year with nobody left to receive it — and into the estate
 * figure with it. Of the income streams, it was the only one that did not obey
 * §19. How reachable that was, measured over a 24-plan corpus: a plain
 * deterministic projection NEVER reached it (0 of 24 moved, and the same corpus
 * moves 18 of 24 under a 1e-12 perturbation, so that zero is a result rather
 * than a vacuum) — the default horizon ends at the last living year, so
 * `anyAlive` is true in every year of it. Every other channel reached it:
 * 16 of 24 on an extended horizon, 20 of 24 with an early death on one, and
 * 24 of 24 on a seeded stochastic-longevity Monte Carlo, where paths routinely
 * die decades before the fixed grid ends. See `DOCS/features/year-cash-flow.md`.
 *
 * The gate is the HOUSEHOLD one rather than per-person because neither stream
 * kind carries a `personId` (`DOCS/features/household-map.md`) — there is no
 * person to gate it against. Wages, which do, gate on their own owner.
 *
 * INFLATION: BOTH KINDS CARRY THE SAME ELECTION, and until plan schema v5 only
 * one did. A one-time `amount` was never inflated, whatever year it landed in,
 * while its mirror image on the spending side — `oneTimeGoalSchema.amount` —
 * was documented as today's dollars and WAS inflated to the goal year. A $100k
 * windfall and a $100k goal in the same future year were not the same real
 * amount, and the editor's `Amount` field said nothing either way.
 *
 * `oneTimeIncomeSchema.inflationAdjusted` closes that, and the two defaults
 * around it differ ON PURPOSE. `migratePlanV4ToV5` writes FALSE onto every
 * stored plan, the only value that reprojects it to the numbers its owner last
 * saw; the editor authors new streams TRUE, matching how the same user enters a
 * one-time goal. Neither default is right for the other's case, which is why
 * the field is required rather than optional. See DOCS/features/README.md §3.
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
  /**
   * Whether any household member is alive. Gates the WHOLE phase: false pays
   * nothing of either kind, because the ledger has no post-household cash-flow
   * path (domain rules reference §19).
   */
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
 * written, against 5.1-5.3 ns for a variant that rebuilds the payload back at
 * the call site under the same optional chaining, and 6.1-6.2 ns for the
 * memoizing-accessor variant described below. So the eager payload is roughly
 * 2.6-3.5 ns per row depending on which lazy shape it is measured against, and
 * the residual ~5 ns is the loop the inlined phase also ran plus the rows and
 * array that being a helper requires.
 *
 * END TO END IT DOES NOT SURFACE, and the honest form of that claim is a
 * predicted effect against a measured noise floor, not a win/loss tally. Across
 * the phase-3 differential corpus this phase yields 0.491 rows per projected
 * year, so a 40-year projection carries ~20 of these objects. Even on a
 * purpose-built plan running ~80 pass-2 rows a year (~160x the corpus rate),
 * ~2.6 ns per row predicts well under 1% of that workload's run time — an order
 * of magnitude below the benchmark's own round-to-round spread. Four
 * interleaved rounds could not separate the two trees, and which one came out
 * ahead flipped between rounds. Do not read a conclusion out of that tally in
 * either direction; at this effect size it is noise.
 *
 * SO IT STAYS EAGER — but NOT because laziness necessarily costs the guard.
 * The row OWNS its payload, which is what lets
 * `simulate.otherIncomeStreamsDelegation.test.ts` assert with `toBe` that the
 * object reaching the ledger IS this one — the only check in the repository
 * that separates real delegation from a caller which invokes the helper for
 * effect and then records its own byte-identical rebuild. Two lazy shapes do
 * lose that assertion, and one does not:
 *
 *   - A FLAG-CONDITIONAL payload loses it. `record` would be present only when
 *     an input flag agreed with the caller's `yearSites` — an invariant no type
 *     can check, and a silently dropped ledger line whenever it did not.
 *   - REBUILDING AT THE CALL SITE loses it outright: that is precisely the
 *     half-orphan shape G3 exists to catch.
 *   - A MEMOIZING ACCESSOR on the row's prototype KEEPS it. Because
 *     `yearSites?.recordRecurringIncome(row.record)` does not evaluate its
 *     argument when the receiver is nullish, and because the accessor memoizes,
 *     the caller and the test read the SAME object. Measured rather than
 *     reasoned: that variant passes all 29 guards, builds ZERO payloads on the
 *     default path, and runs at 6.1-6.2 ns per row.
 *
 * The accessor is rejected on other grounds, and they are judgement rather than
 * measurement, so they are stated as such. Rows would stop being plain object
 * literals and become class instances, in a file whose whole value is being an
 * obviously-pure extraction; and G3's `toBe` would stop holding because the row
 * owns one object and start holding because the accessor keeps memoizing — a
 * subtler invariant, bought with a saving that does not surface. If this phase
 * ever gets hot enough for ~2.6 ns per row to matter, the accessor is the shape
 * to reach for, and this note is the record that it works.
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
  // No post-household cash-flow path (domain rules reference §19): once nobody
  // is alive this phase pays nothing at all, so the gate is hoisted out of the
  // arms rather than repeated in each.
  if (!anyAlive) return rows
  for (const stream of incomes) {
    if (stream.type === 'recurring') {
      if ((stream.startYear !== null && year < stream.startYear) || (stream.endYear !== null && year > stream.endYear)) continue
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
      const amount = stream.amount * (stream.inflationAdjusted ? inflFactor : 1)
      rows.push({
        kind: 'oneTime',
        amount,
        taxTreatment: stream.taxTreatment,
        record: {
          incomeStreamId: stream.id,
          amount,
          taxTreatment: stream.taxTreatment,
        },
      })
    }
  }
  return rows
}
