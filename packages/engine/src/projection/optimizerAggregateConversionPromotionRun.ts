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
  compareOptimizerExactLedgerResults,
  type OptimizerExactLedgerComparisonEvidence,
} from './optimizerExactLedgerComparison.js'
import {
  promoteAggregateConversionSchedule,
  type AggregateConversionPromotionChoice,
  type AggregateConversionPromotionIssue,
  type AggregateConversionPromotionResult,
  type AggregateConversionPromotionYear,
  type AggregateConversionPromotionYearBalances,
} from './optimizerAggregateConversionPromotion.js'
import type { RetirementActionReadinessVeto } from './optimizePlan.js'
import type { ProjectionResult } from './types.js'

/**
 * Run the promotion loop for one vetoed aggregate winner, and say what can
 * honestly be claimed about the pair of projections it produces.
 *
 * WHAT THIS FUNCTION DECIDES AND WHAT ITS CALLER DECIDES. It measures; it
 * publishes nothing and ranks nothing. `runExactLedgerTournament` calls it for
 * every vetoed winner and decides publication from the verdict: an
 * `equivalent` or a `repriced` candidate that earns a recommendation on its own
 * exact-ledger evaluation replaces the aggregate winner and lifts the veto; the
 * other verdicts leave the veto standing and surface the reason. That split is
 * the point — this module can say what is true of the pair, and only the
 * tournament can say what beats what.
 *
 * THE LOOP:
 *
 *   the veto's own projection      (`vetoedResult` — what the ledger ran)
 *     → the snapshots it published (`YearResult.aggregateRothConversionAllocation*`)
 *     → CHOOSE  the owners, sources, destinations and exact cents
 *     → MINT    the identity-complete candidate (the fill-target adapter)
 *     → PRICE   it on the exact ledger, its OWN run (`evaluateCandidate`)
 *     → COMPARE the two projections, on the equality core
 *
 * WHICH HOUSEHOLD AMOUNT IS PROMOTED, AND WHY IT IS NOT THE WINNER'S. The
 * winner's schedule names the YEARS; the amount promoted for each of them is
 * the ledger's own published `aggregateRothConversionAllocationDesired` — the
 * figure the allocation policy was asked for, before it trimmed any owner.
 *
 * `vetoedConversions` is derived from EXECUTED conversions (`buildRichCandidates`
 * reads `YearResult.rothConversion`), so for a household with a trimmed owner it
 * is already post-trim: it is the surviving owners' share alone. Handing that
 * figure back to the policy as a household amount would slice it across the
 * whole household a second time and trim the absent owner's phantom share
 * again, and the promoted schedule would convert strictly less than the ledger
 * did for no reason anyone chose. Promoting the pre-trim figure makes the
 * chooser's answer the ledger's own allocation: the same owners, the same
 * sources, the same cents.
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
 * WHICH FUNCTION DECIDES WHAT, AND WHY IT IS NOT THE OBVIOUS ONE.
 * `compareOptimizerAllocatedCandidate` is the richer of the two comparators and
 * the wrong one to read a verdict off, because it answers `null` to several
 * different questions: the projections differ, OR the allocated candidate did
 * not rank, OR an ACA year is non-actionable, OR identity, provenance and the
 * execution cents did not bind. Folding all of that into "repriced" would
 * report a candidate that never executed as a candidate that priced
 * differently — a claim about arithmetic made out of a failure to run.
 *
 * So the verdict comes from the equality core,
 * `compareOptimizerExactLedgerResults`, which IS the equivalence claim: every
 * evaluated account, every year, tax and penalties and investable total and net
 * worth, equal to the cent, with no epsilon and no caller-selected key set. The
 * richer comparator is then called only to ATTACH its binding evidence, never
 * to decide. That is also what the plan document's WS4 correction settled — the
 * comparator gates the claim that an aggregate result is implementation-ready,
 * and a promoted candidate is accepted on its own evaluation.
 *
 * The equality core folds two questions of its own into `null` — "they differ"
 * and "this pair was never in my structural domain" (mismatched horizons,
 * balance keys that are not the Plan's expected set, a year missing an account,
 * a failed sanity bound). Those are told apart without duplicating a line of
 * it: the horizons are compared directly, and each projection is then run
 * through the core AGAINST ITSELF. A self-comparison cannot fail on inequality,
 * since every key holds the same number on both sides, so a `null` there names
 * the projection that is out of domain. With both self-comparisons passing and
 * the horizons equal, every remaining `null` from the cross-comparison is the
 * inequality.
 *
 * THE FOUR ANSWERS:
 *
 * - `equivalent` — the two projections are the same to the cent. This is the
 *   only state in which an aggregate optimizer result may be called
 *   implementation-ready, because it is the only state in which naming the
 *   owners changed nothing about what the ledger does.
 * - `repriced` — they are genuinely different projections, and every
 *   precondition for saying so held. That is not a failure: an identity-complete
 *   conversion executes at a different point in the annual sequence and moves
 *   exact cents rather than Plan dollars, so a long schedule accumulates
 *   sub-cent residue the equality core's nearest-cent quantization eventually
 *   stops absorbing. The aggregate winner stays exploratory; the allocated
 *   candidate's own `ExactDecisionEvaluation` is what a later rank may consume.
 *   Nothing may rank the allocated schedule on the aggregate's metrics, which
 *   is the failure the comparator exists to prevent.
 * - `notComparable` — the promotion was minted and priced, and then no
 *   equivalence question could honestly be asked. The reason says which one,
 *   and none of them is a repricing.
 * - `notPromoted` — nothing lawful could be minted, so nothing was priced.
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

/** Why no equivalence question could be asked of a promotion that was priced. */
export type AggregateConversionPromotionComparabilityReason =
  /**
   * The allocated candidate did not rank. On this path that is `diagnostic`,
   * which means its own requests did not execute as written; its projection
   * then differs from the aggregate's because nothing converted, and calling
   * that a repricing would describe a failure to run as a difference in price.
   */
  | 'allocatedRankingNotComparable'
  /**
   * One of the two projections has a non-actionable ACA year. The exact ledger
   * is saying it could not price that year as executable, so neither an
   * equivalence claim nor a repricing claim may rest on it.
   */
  | 'acaEvidenceNonActionable'
  /** The two projections do not cover the same years. */
  | 'horizonMismatch'
  /** The aggregate projection is outside the equality core's structural domain. */
  | 'aggregateProjectionNotComparable'
  /** The allocated projection is outside it. */
  | 'allocatedProjectionNotComparable'

export type AggregateConversionPromotionRunResult =
  | Readonly<{
    /** Cent-identical to the aggregate winner's projection, everywhere. */
    status: 'equivalent'
    candidate: DecisionCandidate
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    /** The allocated candidate's own exact-ledger evaluation. */
    allocatedEvaluation: ExactDecisionEvaluation
    /** The equivalence claim itself, and what this status is decided by. */
    exactLedgerComparison: Readonly<OptimizerExactLedgerComparisonEvidence>
    /**
     * The richer binding evidence, when its own preconditions held. A `null`
     * here has exactly one meaning, because ranking, ACA actionability and
     * structural comparability were all established before it was asked:
     * identity, provenance, or the requested/executed/increment cent bindings
     * did not hold. The projections are still the same to the cent — that is
     * what `equivalent` says — but nothing then binds the allocated requests to
     * the winner they came from, so no surface may cite it as an audit trail.
     */
    binding: Readonly<OptimizerAllocatedCandidateComparisonEvidence> | null
  }>
  | Readonly<{
    /**
     * A genuinely different projection. The equality core offers no partial
     * credit and no per-key report, so there is no evidence object to attach —
     * the absence IS the finding, and the allocated evaluation beside it is the
     * priced result a later rank may consume.
     */
    status: 'repriced'
    candidate: DecisionCandidate
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    allocatedEvaluation: ExactDecisionEvaluation
  }>
  | Readonly<{
    /**
     * Minted and priced, and then unanswerable. Everything a caller would want
     * is still here — the candidate, the choice, and the evaluation carrying
     * its own diagnostics — but no claim is made about the pair.
     */
    status: 'notComparable'
    candidate: DecisionCandidate
    choice: Extract<AggregateConversionPromotionChoice, { status: 'chosen' }>
    allocatedEvaluation: ExactDecisionEvaluation
    reason: AggregateConversionPromotionComparabilityReason
  }>
  | Readonly<{
    /**
     * Nothing was priced, because nothing lawful could be minted. The chooser's
     * issues or the adapter's carry the reason; `notPromoted` never means "the
     * comparison failed".
     */
    status: 'notPromoted'
    promotion: Exclude<AggregateConversionPromotionResult, { status: 'promoted' }>
  }>

/** The ranking states an equivalence or repricing claim may be made about. */
const COMPARABLE_RANKING_STATES: readonly string[] = ['beneficial', 'neutral', 'rejected']

/** One year the aggregate allocation policy ran: what it was asked for, and on what. */
/** What one projection year published about the allocation its policy ran. */
interface PublishedAllocation {
  readonly year: number
  /** The household amount the policy was asked for, when the year stated one. */
  readonly desiredPlanDollars: number | undefined
  /** The balances it weighted owners by, when the year stated them. */
  readonly balances: Readonly<Record<string, number>> | undefined
}

/**
 * Every year of a projection that published either half of its allocation, in
 * projection order.
 *
 * A year that published neither ran no aggregate conversion arm — see the
 * fields' own contracts for the full list of causes — so it is absent here
 * rather than stated as an empty snapshot.
 *
 * THE TWO HALVES ARE KEPT SEPARATELY RATHER THAN COLLAPSED. `simulatePlan`
 * publishes both from the same call, so a year carrying one and not the other
 * did not come from it; but a caller holding such a projection is owed a
 * refusal that names which half is missing, because the two have different
 * remedies and a reader told "no balances" would go looking for a snapshot that
 * is sitting right there.
 */
function publishedAllocations(
  result: Readonly<ProjectionResult>,
): PublishedAllocation[] {
  const published: PublishedAllocation[] = []
  for (const year of result.years) {
    const balances = year.aggregateRothConversionAllocationBalances
    const desiredPlanDollars = year.aggregateRothConversionAllocationDesired
    if (balances === undefined && desiredPlanDollars === undefined) continue
    published.push({ year: year.year, desiredPlanDollars, balances })
  }
  return published
}

/**
 * The schedule to promote: the winner's years, each at the household amount the
 * ledger's policy was asked for in that year.
 *
 * A winner year the projection published no such amount for is refused by name
 * rather than promoted at the executed figure. The executed figure means
 * something different — it is what survived the trim — and substituting it here
 * is exactly the re-trim this function exists to prevent.
 *
 * The refusal distinguishes the two ways that amount can be absent: a year that
 * published nothing at all (`missingYearBalances`, the chooser's own kind for a
 * scheduled year with no snapshot), and a year that published its weights and
 * not the figure to weight (`missingYearDesiredAmount`).
 */
function promotedSchedule(
  vetoedConversions: readonly { year: number; amount: number }[],
  published: readonly PublishedAllocation[],
):
  | { readonly schedule: readonly AggregateConversionPromotionYear[] }
  | { readonly issues: readonly [AggregateConversionPromotionIssue, ...AggregateConversionPromotionIssue[]] } {
  const publishedByYear = new Map(published.map((entry) => [entry.year, entry]))
  const schedule: AggregateConversionPromotionYear[] = []
  const issues: AggregateConversionPromotionIssue[] = []
  for (const conversion of vetoedConversions) {
    const entry = publishedByYear.get(conversion.year)
    const desired = entry?.desiredPlanDollars
    if (desired === undefined) {
      const balancesArePresent = entry?.balances !== undefined
      issues.push(balancesArePresent
        ? {
          kind: 'missingYearDesiredAmount',
          field: `readinessVeto.vetoedResult.years[year=${conversion.year}].aggregateRothConversionAllocationDesired`,
          detail: `The vetoed projection converted in ${conversion.year} and published the balances its ` +
            'allocation policy weighted owners by, but not the household amount that policy was asked ' +
            'for, so there is nothing to allocate across those weights. The executed total is not a ' +
            'substitute: it is what survived the trim.',
        }
        : {
          kind: 'missingYearBalances',
          field: `readinessVeto.vetoedResult.years[year=${conversion.year}]`,
          detail: `The vetoed projection converted in ${conversion.year} but published no aggregate ` +
            'allocation for it at all — neither the balances its policy weighted owners by nor the ' +
            'household amount that policy was asked for. The executed total is not a substitute for ' +
            'the second: it is what survived the trim.',
        })
      continue
    }
    // Quantized to whole cents, which is what the policy itself does with the
    // figure (`planDollarsToLedgerCents`, half-up) before it slices anything,
    // and what `buildRichCandidates` does to the executed amounts the winner's
    // schedule is made of. The chooser refuses an amount that is not an exact
    // cent figure, and it is right to: the request contract this promotes into
    // is denominated in cents, and a float carrying sub-cent noise cannot be
    // asked for.
    schedule.push({ year: conversion.year, amount: Math.round(desired * 100) / 100 })
  }
  const [first, ...rest] = issues
  return first === undefined ? { schedule } : { issues: [first, ...rest] }
}

/**
 * Does every ACA year of this projection carry actionable evidence?
 *
 * The same rule `compareOptimizerAllocatedCandidate` applies: a year with no
 * ACA result at all is not an ACA problem, and a year that has one must have
 * priced it `actionable`. Read here rather than left to that function so the
 * failure can be named instead of arriving as an untyped `null`.
 */
function acaEvidenceIsActionable(result: Readonly<ProjectionResult>): boolean {
  return result.years.every((year) =>
    year.aca === undefined || year.aca.readiness === 'actionable')
}

/**
 * Is this projection inside the equality core's structural domain?
 *
 * Asked by running the core over the projection AGAINST ITSELF. Every key it
 * builds then holds the same number on both sides, so the entry-equality test
 * cannot be what fails, and a `null` can only come from the structural
 * preconditions — an invalid or non-contiguous horizon, balance keys that are
 * not the Plan's expected set, a year missing an account, a broken sanity
 * bound. Using the core rather than re-checking its rules is the point: a
 * second implementation of them would be a second thing to keep in step, and
 * the first time the two disagreed this function would lie.
 */
function isStructurallyComparable(
  result: Readonly<ProjectionResult>,
  plan: DecisionContext['plan'],
): boolean {
  return compareOptimizerExactLedgerResults(result, result, plan) !== null
}

/**
 * Promote the vetoed winner, price it, and say what can honestly be claimed
 * about the pair.
 *
 * The candidate is priced with `evaluateCandidate`'s ordinary options and NOT
 * with `allowLegacyAggregateDecisionCalculation`. That marker exists to let the
 * aggregate optimizer path skip the retirement-action readiness and execution
 * diagnostics, which is exactly what must not be skipped here: an allocated
 * candidate whose requests did not execute as written has to say so in its own
 * `recommendationState`, and this function reads that state as a precondition
 * rather than letting it arrive later disguised as a repricing.
 */
export function runAggregateConversionPromotion(
  input: AggregateConversionPromotionRunInput,
): AggregateConversionPromotionRunResult {
  const { context, readinessVeto, exploratoryCandidate } = input
  const published = publishedAllocations(readinessVeto.vetoedResult)
  const promoted = promotedSchedule(readinessVeto.vetoedConversions, published)
  if ('issues' in promoted) {
    return {
      status: 'notPromoted',
      promotion: {
        status: 'unallocatable',
        choice: { status: 'unallocatable', years: [], issues: promoted.issues },
      },
    }
  }
  // Only the years that actually stated their weights. A year that stated an
  // amount and no balances is left out here on purpose, so the chooser refuses
  // it with its own `missingYearBalances` naming the year rather than being
  // handed an empty snapshot to allocate against.
  const yearBalances: AggregateConversionPromotionYearBalances[] = published
    .flatMap((entry) => entry.balances === undefined
      ? []
      : [{ year: entry.year, balances: entry.balances }])
  const promotion = promoteAggregateConversionSchedule({
    plan: context.plan,
    winner: {
      source: readinessVeto.vetoedWinnerSource,
      candidateId: readinessVeto.vetoedCandidateId,
      conversions: promoted.schedule,
    },
    yearBalances,
    exploratoryCandidate,
  })
  if (promotion.status !== 'promoted') return { status: 'notPromoted', promotion }

  const { candidate, choice } = promotion
  const allocatedEvaluation = evaluateCandidate(context, candidate)
  const aggregateResult = readinessVeto.vetoedResult
  const allocatedResult = allocatedEvaluation.candidateResult
  const notComparable = (
    reason: AggregateConversionPromotionComparabilityReason,
  ): AggregateConversionPromotionRunResult =>
    ({ status: 'notComparable', candidate, choice, allocatedEvaluation, reason })

  // The preconditions, in the order that names a failure most usefully: a
  // candidate that did not rank is a different fact from one whose ACA year the
  // ledger could not price, and both are different from a projection the
  // equality core cannot read at all.
  if (!COMPARABLE_RANKING_STATES.includes(allocatedEvaluation.recommendationState)) {
    return notComparable('allocatedRankingNotComparable')
  }
  if (!acaEvidenceIsActionable(aggregateResult) ||
      !acaEvidenceIsActionable(allocatedResult)) {
    return notComparable('acaEvidenceNonActionable')
  }
  if (aggregateResult.startYear !== allocatedResult.startYear ||
      aggregateResult.endYear !== allocatedResult.endYear) {
    return notComparable('horizonMismatch')
  }
  if (!isStructurallyComparable(aggregateResult, context.plan)) {
    return notComparable('aggregateProjectionNotComparable')
  }
  if (!isStructurallyComparable(allocatedResult, context.plan)) {
    return notComparable('allocatedProjectionNotComparable')
  }

  const exactLedgerComparison = compareOptimizerExactLedgerResults(
    aggregateResult,
    allocatedResult,
    context.plan,
  )
  // Everything the equality core could have refused for a reason other than
  // inequality has now been ruled out, so this null IS the inequality.
  if (exactLedgerComparison === null) {
    return { status: 'repriced', candidate, choice, allocatedEvaluation }
  }
  return {
    status: 'equivalent',
    candidate,
    choice,
    allocatedEvaluation,
    exactLedgerComparison,
    binding: compareOptimizerAllocatedCandidate({
      plan: context.plan,
      readinessVeto,
      allocatedEvaluation,
    }),
  }
}
