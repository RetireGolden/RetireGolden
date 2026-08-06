import type {
  RetirementActionPromotion,
  RetirementActionReadinessVetoSummary,
} from '@retiregolden/engine/projection/optimizePlan'
import { promotionWithheldClause } from './retirementActionPromotionCopy'

export const RETIREMENT_ACTION_READINESS_VETO_ROW_NOTE =
  'calculated winner; withheld pending account allocation'

/**
 * Why a calculated winner was withheld, plus what the promotion loop made of
 * it when one ran.
 *
 * The veto sentence alone stopped being the whole story once the loop shipped:
 * a standing veto now means the loop was tried and did not produce a schedule
 * anyone could act on, and a reader entitled to the first half is entitled to
 * the second. A published promotion carries no veto, so it never reaches here.
 */
export function retirementActionReadinessVetoExplanation(
  veto: RetirementActionReadinessVetoSummary,
  promotion: RetirementActionPromotion | null = null,
): string {
  const source = veto.vetoedWinnerSource === 'milp'
    ? "The solver's calculated schedule"
    : veto.vetoedCandidateLabel ?? 'The calculated candidate'
  const clause = promotionWithheldClause(promotion)
  return `${source} cleared the selected objective, but its aggregate conversions do not identify the owner, source IRA, and Roth destination. It remains diagnostic-only until those account identities are allocated.${clause === null ? '' : ` ${clause}`}`
}
