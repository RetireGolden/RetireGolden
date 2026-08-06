import { evaluateCandidate } from '../decisions/evaluateCandidate.js'
import type {
  DecisionCandidate,
  DecisionContext,
  ExactDecisionEvaluation,
} from '../decisions/types.js'
import {
  compareOptimizerAllocatedCandidate,
  type OptimizerAllocatedCandidateComparisonEvidence,
} from './optimizerAllocatedCandidateComparison.js'
import {
  promoteAggregateConversionSchedule,
  type AggregateConversionPromotionChoice,
  type AggregateConversionPromotionResult,
  type AggregateConversionPromotionYearBalances,
} from './optimizerAggregateConversionPromotion.js'
import type { RetirementActionReadinessVeto } from './optimizePlan.js'
import type { ProjectionResult } from './types.js'

/**
 * Run the promotion loop for one vetoed aggregate winner, and say what the
 * exact-ledger comparator made of the pair.
 *
 * WHAT THIS SLICE IS AND IS NOT. It measures; it publishes nothing. No
 * optimizer entry point calls it, `readinessVetoFor` still vetoes every
 * positive-conversion winner, `refuseAggregateScheduleRecommendation` still
 * rewrites `beneficial` to `identityIncomplete`, and `buildOptimizerInput`
 * still throws on a plan carrying identity-bearing retirement actions. Lifting
 * those three is the next slice; this one exists so that slice starts from a
 * measured fact instead of an assertion in a plan document.
 *
 * THE LOOP:
 *
 *   the veto's own projection      (`vetoedResult` — what the ledger ran)
 *     → the snapshots it published (`YearResult.aggregateRothConversionAllocationBalances`)
 *     → CHOOSE  the owners, sources, destinations and exact cents
 *     → MINT    the identity-complete candidate (the fill-target adapter)
 *     → PRICE   it on the exact ledger, its OWN run (`evaluateCandidate`)
 *     → COMPARE `compareOptimizerAllocatedCandidate` against the vetoed result
 *
 * WHY THE SNAPSHOTS COME OFF THE VETOED PROJECTION AND NOWHERE ELSE. The owner
 * weights that decide whose dollars move are a fact about the run that produced
 * the ranked schedule, not about the Plan. `RetirementActionReadinessVeto`
 * already says its `vetoedResult` is the authority allocation bridges compare
 * against and that callers "must not reconstruct it from the summary metrics";
 * the same holds a fortiori for the balances the policy weighted by. Reading
 * them from anywhere else would put a second-source number under a schedule a
 * person is invited to act on.
 *
 * WHAT THE COMPARATOR'S TWO ANSWERS MEAN — and this is the whole point of the
 * slice, so it is worth being exact. `compareOptimizerExactLedgerResults` is a
 * proof of arithmetic identity between two whole projections: every evaluated
 * account, every year, tax and penalties and investable total and net worth,
 * equal to the cent with no epsilon and no caller-selected key set. So:
 *
 * - `equivalent` — the allocated candidate IS the aggregate winner's
 *   projection, to the cent. This is the only state in which the aggregate
 *   result may be called implementation-ready, because it is the only state in
 *   which naming the owners changed nothing about what the ledger does.
 * - `repriced` — the two are different projections. That is the expected
 *   answer, not a failure: an identity-complete conversion executes at a
 *   different point in the annual sequence and moves exact cents rather than
 *   Plan dollars, and where an owner has no Roth IRA the household converts
 *   strictly less than the winner's figure. The aggregate winner stays
 *   exploratory; the allocated candidate's own `ExactDecisionEvaluation` — the
 *   one attached here — is what a later rank may consume. Nothing may rank the
 *   allocated schedule on the aggregate's metrics, which is the failure the
 *   comparator exists to prevent.
 *
 * THE MILP ARM IS NOT SERVED. The comparator's optimizer arm wants provenance
 * whose source ID is the allocated candidate's own ID, which the adapter
 * derives from the very requests that would have to carry it, so no assignment
 * satisfies it. A solver winner is therefore refused by the chooser with its
 * `milpWinnerNotPromotable` issue and arrives here as `notPromoted`. Whether
 * the MILP arm gets a promotion path at all is open.
 */

export interface AggregateConversionPromotionRunInput {
  /**
   * The tournament's own decision context: the base Plan, the shared baseline
   * run, and the simulate options the winner was priced with. The allocated
   * candidate must be priced against the same baseline as everything else in
   * the tournament, or its deltas are not comparable with theirs.
   */
  readonly context: DecisionContext
  readonly readinessVeto: Readonly<RetirementActionReadinessVeto>
  /**
   * The vetoed winner's own generator candidate. It supplies the fill-target
   * window every promoted year must fall inside, and its ID is the provenance
   * the comparator pins the candidate arm to; the chooser refuses a candidate
   * whose ID is not `readinessVeto.vetoedCandidateId`.
   */
  readonly exploratoryCandidate: Readonly<DecisionCandidate>
}

export type AggregateConversionPromotionRunResult =
  | Readonly<{
    /** Cent-identical to the aggregate winner's projection, everywhere. */
    status: 'equivalent'
    candidate: DecisionCandidate
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    /** The allocated candidate's own exact-ledger evaluation. */
    allocatedEvaluation: ExactDecisionEvaluation
    comparison: Readonly<OptimizerAllocatedCandidateComparisonEvidence>
  }>
  | Readonly<{
    /**
     * A different projection from the aggregate winner's. The comparator
     * offers no partial credit and no per-key report, so there is no evidence
     * object to attach — the absence IS the finding, and the allocated
     * evaluation beside it is the priced result a later rank may consume.
     */
    status: 'repriced'
    candidate: DecisionCandidate
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    allocatedEvaluation: ExactDecisionEvaluation
  }>
  | Readonly<{
    /**
     * Nothing was priced, because nothing lawful could be minted. The
     * chooser's issues or the adapter's carry the reason; `notPromoted` never
     * means "the comparison failed".
     */
    status: 'notPromoted'
    promotion: Exclude<AggregateConversionPromotionResult, { status: 'promoted' }>
  }>

/**
 * Every year of a projection that published an allocation snapshot, in
 * projection order.
 *
 * A year without one ran no aggregate conversion arm — see the field's own
 * contract for the full list of causes — so it is skipped here rather than
 * stated as an empty snapshot. A scheduled year that needed one and finds none
 * is the chooser's `missingYearBalances`, which names the year.
 */
function publishedAllocationSnapshots(
  result: Readonly<ProjectionResult>,
): AggregateConversionPromotionYearBalances[] {
  const snapshots: AggregateConversionPromotionYearBalances[] = []
  for (const year of result.years) {
    const balances = year.aggregateRothConversionAllocationBalances
    if (balances === undefined) continue
    snapshots.push({ year: year.year, balances })
  }
  return snapshots
}

/**
 * Promote the vetoed winner, price it, and record what the comparator said.
 *
 * The candidate is priced with `evaluateCandidate`'s ordinary options and NOT
 * with `allowLegacyAggregateDecisionCalculation`. That marker exists to let the
 * aggregate optimizer path skip the retirement-action readiness and execution
 * diagnostics, which is exactly what must not be skipped here: an allocated
 * candidate whose requests did not execute as written has to say so in its own
 * `recommendationState`, and the comparator will not look at one it cannot
 * read as `beneficial | neutral | rejected` anyway.
 */
export function runAggregateConversionPromotion(
  input: AggregateConversionPromotionRunInput,
): AggregateConversionPromotionRunResult {
  const { context, readinessVeto, exploratoryCandidate } = input
  const promotion = promoteAggregateConversionSchedule({
    plan: context.plan,
    winner: {
      source: readinessVeto.vetoedWinnerSource,
      candidateId: readinessVeto.vetoedCandidateId,
      conversions: readinessVeto.vetoedConversions,
    },
    yearBalances: publishedAllocationSnapshots(readinessVeto.vetoedResult),
    exploratoryCandidate,
  })
  if (promotion.status !== 'promoted') return { status: 'notPromoted', promotion }

  const allocatedEvaluation = evaluateCandidate(context, promotion.candidate)
  const comparison = compareOptimizerAllocatedCandidate({
    plan: context.plan,
    readinessVeto,
    allocatedEvaluation,
  })
  return comparison === null
    ? {
      status: 'repriced',
      candidate: promotion.candidate,
      choice: promotion.choice,
      allocatedEvaluation,
    }
    : {
      status: 'equivalent',
      candidate: promotion.candidate,
      choice: promotion.choice,
      allocatedEvaluation,
      comparison,
    }
}
