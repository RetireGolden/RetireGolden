import type {
  AcaActionabilityVeto,
  ExactLedgerValidation,
  RetirementActionReadinessVetoSummary,
} from '@retiregolden/engine/projection/optimizePlan'
import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import { formatYearRuns } from './acaVetoCopy'
import { fmtMoney, fmtMoneyCompact } from './format'

/**
 * What else the result carries about why a schedule is not offered. An
 * 'unexecutable' validation whose schedule executed without a material
 * shortfall is held back for another cause, and the copy names that cause
 * instead of claiming a shortfall that did not happen.
 */
export interface RecommendationContext {
  /** The tournament's ACA actionability veto, when unpriced credit years blocked the schedule. */
  acaActionabilityVeto?: AcaActionabilityVeto | null
}

/**
 * An 'unexecutable' validation whose schedule ran without a material shortfall,
 * in any one year or in total: the cause is not execution. The engine decides
 * that where it measures the execution and publishes it
 * (ExactLedgerValidation.executedWithoutMaterialShortfall); the page reads it
 * and re-derives no margin (decision D-UI-SS; PR #754 finding 5).
 */
function heldForAnotherCause(validation: ExactLedgerValidation): boolean {
  return validation.recommendationState === 'unexecutable' && validation.executedWithoutMaterialShortfall
}

/**
 * True when a run ended with nothing to recommend: the solver found no
 * feasible schedule and neither the incumbent strategy, a tournament
 * candidate, nor a readiness veto stands in for a result. The page shows
 * "Couldn't optimize this plan" on exactly this condition, and the
 * recommendation report must not be offered for it (#426). An incumbent-holds
 * outcome — the plan's own conversions beat everything, even when the fresh
 * solve was infeasible — or a no-beneficial-conversions outcome is still a
 * recommendation ("no change"), so it stays reportable. Keep the argument
 * order aligned with the page's result-card chain, which tests incumbent
 * holds before infeasibility.
 */
export function optimizerProducedNoRecommendation(args: {
  scheduleStatus: OptimizedSchedule['status'] | null
  incumbentHolds: boolean
  candidateWins: boolean
  readinessVeto: RetirementActionReadinessVetoSummary | null | undefined
}): boolean {
  return (
    !args.incumbentHolds && args.scheduleStatus === 'infeasible' && !args.candidateWins && !args.readinessVeto
  )
}

/**
 * Which limit stopped the conversion solver, in the page's words, or null when
 * none did: 'node-limit' is its search limit (a fixed number of branch-and-bound
 * nodes, the same on every machine), 'timeout' its time limit.
 */
export function optimizerStopLimit(status: OptimizedSchedule['status'] | null): 'search limit' | 'time limit' | null {
  return status === 'node-limit' ? 'search limit' : status === 'timeout' ? 'time limit' : null
}

/** The solver's status as the page prints it after "Optimizer status:". */
export function optimizerStatusText(status: OptimizedSchedule['status']): string {
  const limit = optimizerStopLimit(status)
  if (limit !== null) return `stopped at its ${limit}`
  return status === 'feasible' ? 'feasible, not proven optimal' : status
}

/** Publication copy follows the readiness veto while retaining exact metrics. */
export function publicationValidation(
  validation: ExactLedgerValidation,
  readinessVeto: RetirementActionReadinessVetoSummary | null,
): ExactLedgerValidation {
  return readinessVeto === null
    ? validation
    : { ...validation, recommendationState: readinessVeto.reason }
}

export function recommendationHeading(validation: ExactLedgerValidation): string {
  switch (validation.recommendationState) {
    case 'beneficial':
      return `Up to ${fmtMoney(validation.afterTaxEstateDelta)} more for your heirs.`
    case 'neutral':
      return 'The optimizer matches your current strategy.'
    case 'rejected':
      return 'This lower-tax schedule is not recommended.'
    case 'unexecutable':
      return heldForAnotherCause(validation)
        ? 'This conversion schedule is shown as a diagnostic.'
        : 'This conversion schedule is mostly theoretical.'
    case 'identityIncomplete':
      return 'This schedule still needs account allocation.'
  }
}

export function recommendationBody(validation: ExactLedgerValidation, context: RecommendationContext = {}): string {
  const requested = fmtMoney(validation.requestedConversionTotal)
  const executed = fmtMoney(validation.executedConversionTotal)
  const from = fmtMoneyCompact(validation.baseline.endingAfterTaxEstate)
  const to = fmtMoneyCompact(validation.candidate.endingAfterTaxEstate)
  const taxPhrase =
    validation.lifetimeTaxDelta < 0
      ? `lowers lifetime tax by ${fmtMoney(Math.abs(validation.lifetimeTaxDelta))}`
      : validation.lifetimeTaxDelta > 0
        ? `raises lifetime tax by ${fmtMoney(validation.lifetimeTaxDelta)}`
        : 'leaves lifetime tax unchanged'

  switch (validation.recommendationState) {
    case 'beneficial':
      return `Converting ${requested} raises your projected after-tax estate from ${from} to ${to}.`
    case 'neutral':
      return `Converting ${requested} leaves your projected after-tax estate essentially unchanged at ${to}.`
    case 'rejected':
      return `Converting ${requested} ${taxPhrase}, but your projected after-tax estate moves from ${from} to ${to}.`
    case 'unexecutable': {
      if (!heldForAnotherCause(validation)) {
        return `The optimizer proposed converting ${requested}, but only ${executed} could actually be converted. The traditional balance it counted on is not available in the plan years shown.`
      }
      // Printed amounts, not a comparison of dollars: when the two print alike
      // the reader is told plainly that the whole request ran.
      const executes =
        executed === requested
          ? `Your full projection converts all ${requested} requested`
          : `Your full projection converts ${executed} of the ${requested} requested`
      const incomplete = validation.incompleteComputationYears ?? []
      if (incomplete.length > 0 && context.acaActionabilityVeto) {
        // Both causes hold the schedule back, and the reader is told both
        // (PR #754 finding 8).
        return `${executes}, but two things hold it back: its tax could not be computed completely in ${formatYearRuns(incomplete)}, and the marketplace (ACA) premium tax credit isn't priced in some of the plan's years, while conversion income changes that credit. So the schedule is shown as a diagnostic, not a recommendation. The ACA note below names the credit's years.`
      }
      if (incomplete.length > 0) {
        return `${executes}, but its tax could not be computed completely in ${formatYearRuns(incomplete)}, so the schedule is shown as a diagnostic, not a recommendation.`
      }
      if (context.acaActionabilityVeto) {
        return `${executes}, but the marketplace (ACA) premium tax credit isn't priced in some of the plan's years, and conversion income changes that credit, so the schedule is shown as a diagnostic, not a recommendation. The ACA note below names the years.`
      }
      return `${executes}, but it cannot be applied to your plan as it stands, so the schedule is shown as a diagnostic, not a recommendation.`
    }
    case 'identityIncomplete':
      return `The full projection priced and executed ${executed}, but stable owner, source IRA, and Roth destination identities are still required before this aggregate schedule can be recommended.`
  }
}
