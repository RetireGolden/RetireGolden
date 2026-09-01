import type {
  ExactLedgerValidation,
  RetirementActionReadinessVetoSummary,
} from '@retiregolden/engine/projection/optimizePlan'
import { fmtMoney, fmtMoneyCompact } from './format'

/**
 * True when a run ended with nothing to recommend: the solver found no
 * feasible schedule and no tournament candidate or readiness veto stands in
 * for a result. The page shows "Couldn't optimize this plan" on exactly this
 * condition, and the recommendation report must not be offered for it (#426).
 * An incumbent-holds or no-beneficial-conversions outcome is still a
 * recommendation ("no change"), so it stays reportable.
 */
export function optimizerProducedNoRecommendation(args: {
  scheduleStatus: 'optimal' | 'feasible' | 'infeasible' | 'timeout' | null
  candidateWins: boolean
  readinessVeto: RetirementActionReadinessVetoSummary | null | undefined
}): boolean {
  return args.scheduleStatus === 'infeasible' && !args.candidateWins && !args.readinessVeto
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
      return 'This conversion schedule is mostly theoretical.'
    case 'identityIncomplete':
      return 'This schedule still needs account allocation.'
  }
}

export function recommendationBody(validation: ExactLedgerValidation): string {
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
    case 'unexecutable':
      return `The optimizer proposed converting ${requested}, but only ${executed} could actually be converted. The traditional balance it counted on is not available in the plan years shown.`
    case 'identityIncomplete':
      return `The exact ledger priced and executed ${executed}, but stable owner, source IRA, and Roth destination identities are still required before this aggregate schedule can be recommended.`
  }
}
