/**
 * Decide what this year's one-time goals actually cost the ledger.
 *
 * Two paths, exactly as they were inline. Under guardrails the goals route
 * through the caller's scheduler, which may delay or skip flexible goals while
 * cutting; otherwise every goal funds in its target year exactly, as it always
 * has. A *skipped* goal is intended spending that never happens, so its amount
 * is tracked as a target miss (a required-classified skip is also a required
 * miss) rather than silently vanishing from both sides of the ledger.
 *
 * Every accumulator this returns starts at zero here and has no earlier writer
 * in the year, so folding inside the phase is the same IEEE-754 order the
 * caller's inline loops had. `goalOutcomeCounts` is deliberately returned by
 * identity: the funding-close phase publishes that very object as the year's
 * `spending.flexibleGoals`.
 *
 * The optional commit hook fires at the original per-row point. Like the
 * caller's `yearSites?.recordGoalOutcome(...)`, an absent hook never evaluates
 * the payload, so a projection that captures no cash flow constructs nothing.
 */
import type { Plan } from '../../model/plan.js'
import type { GoalScheduler } from '../../spending/flexibleGoals.js'
import type { RecordedGoalOutcome } from '../annualCashFlowYearSites.js'

export interface AnnualOneTimeGoalFundingPhaseInput {
  readonly year: number
  /** Cumulative inflation factor from the projection start to this year. */
  readonly inflFactor: number
  /** Nobody alive means no goal funds, and no goal is recorded as skipped. */
  readonly anyAlive: boolean
  /** Null outside guardrails: every goal then funds in its target year. */
  readonly goalScheduler: GoalScheduler | null
  readonly oneTimeGoals: Plan['expenses']['oneTimeGoals']
  /** This year's guardrail decision, as the scheduler's context reads it. */
  readonly cutting: boolean
  readonly canPullForwardGoals: boolean
  readonly remainingUpsideBudget: number
  /** Caller-owned effect, committed at the original per-row point. */
  readonly commitGoalOutcome?: (row: RecordedGoalOutcome) => void
}

/** Counts and amounts the year publishes as `spending.flexibleGoals`. */
export interface AnnualGoalOutcomeCounts {
  funded: number
  partiallyFunded: number
  deferred: number
  skipped: number
  fundedAmount: number
  unfundedAmount: number
}

export interface AnnualOneTimeGoalFundingPhaseResult {
  readonly oneTimeGoalsFunded: number
  readonly requiredGoalsFunded: number
  readonly targetGoalsFunded: number
  readonly idealGoalsFunded: number
  readonly excessGoalsFunded: number
  readonly skippedRequiredNominal: number
  readonly skippedTargetNominal: number
  readonly skippedIdealNominal: number
  readonly skippedExcessNominal: number
  /** Returned by identity; the year publishes this object, not a copy. */
  readonly goalOutcomeCounts: AnnualGoalOutcomeCounts
}

export function annualOneTimeGoalFundingPhase(
  input: AnnualOneTimeGoalFundingPhaseInput,
): AnnualOneTimeGoalFundingPhaseResult {
  const { year, inflFactor, anyAlive, goalScheduler } = input
  let oneTimeGoalsFunded = 0
  let requiredGoalsFunded = 0
  let targetGoalsFunded = 0
  let idealGoalsFunded = 0
  let excessGoalsFunded = 0
  let skippedTargetNominal = 0
  let skippedIdealNominal = 0
  let skippedExcessNominal = 0
  let skippedRequiredNominal = 0
  const goalOutcomeCounts: AnnualGoalOutcomeCounts = { funded: 0, partiallyFunded: 0, deferred: 0, skipped: 0, fundedAmount: 0, unfundedAmount: 0 }
  if (anyAlive) {
    if (goalScheduler) {
      const plannedGoals = goalScheduler.planYear(year, {
        inflFactor,
        cutting: input.cutting,
        canPullForward: input.canPullForwardGoals,
        availableBudget: input.cutting ? 0 : input.canPullForwardGoals ? input.remainingUpsideBudget : null,
      })
      for (const r of plannedGoals.results) {
        if (r.outcome === 'funded' || r.outcome === 'partiallyFunded') {
          oneTimeGoalsFunded += r.fundedNominal
          if (r.classification === 'required') requiredGoalsFunded += r.fundedNominal
          else if (r.classification === 'target') targetGoalsFunded += r.fundedNominal
          else if (r.classification === 'ideal') idealGoalsFunded += r.fundedNominal
          else excessGoalsFunded += r.fundedNominal
          if (r.outcome === 'funded') goalOutcomeCounts.funded++
          else goalOutcomeCounts.partiallyFunded++
          goalOutcomeCounts.fundedAmount += r.fundedNominal
          goalOutcomeCounts.unfundedAmount += r.unfundedNominal
          if (r.unfundedNominal > 0) {
            if (r.classification === 'required') skippedRequiredNominal += r.unfundedNominal
            else if (r.classification === 'target') skippedTargetNominal += r.unfundedNominal
            else if (r.classification === 'ideal') skippedIdealNominal += r.unfundedNominal
            else skippedExcessNominal += r.unfundedNominal
          }
          input.commitGoalOutcome?.({
            goalId: r.id,
            classification: r.classification,
            outcome: r.outcome,
            requested: r.fundedNominal + r.unfundedNominal,
            fundedNominal: r.fundedNominal,
          })
        } else if (r.outcome === 'deferred') {
          goalOutcomeCounts.deferred++
        } else {
          if (r.classification === 'required') skippedRequiredNominal += r.amountNominal
          else if (r.classification === 'target') skippedTargetNominal += r.amountNominal
          else if (r.classification === 'ideal') skippedIdealNominal += r.amountNominal
          else skippedExcessNominal += r.amountNominal
          goalOutcomeCounts.unfundedAmount += r.amountNominal
          goalOutcomeCounts.skipped++
          input.commitGoalOutcome?.({
            goalId: r.id,
            classification: r.classification,
            outcome: 'skipped',
            requested: r.amountNominal,
            fundedNominal: 0,
          })
        }
      }
    } else {
      for (const goal of input.oneTimeGoals) {
        if (goal.year !== year) continue
        const amount = goal.amount * inflFactor
        oneTimeGoalsFunded += amount
        const classification = goal.classification ?? 'target'
        if (classification === 'required') requiredGoalsFunded += amount
        else if (classification === 'target') targetGoalsFunded += amount
        else if (classification === 'ideal') idealGoalsFunded += amount
        else excessGoalsFunded += amount
        input.commitGoalOutcome?.({
          goalId: goal.id,
          classification,
          outcome: 'funded',
          requested: amount,
          fundedNominal: amount,
        })
      }
    }
  }

  return {
    oneTimeGoalsFunded,
    requiredGoalsFunded,
    targetGoalsFunded,
    idealGoalsFunded,
    excessGoalsFunded,
    skippedRequiredNominal,
    skippedTargetNominal,
    skippedIdealNominal,
    skippedExcessNominal,
    goalOutcomeCounts,
  }
}
