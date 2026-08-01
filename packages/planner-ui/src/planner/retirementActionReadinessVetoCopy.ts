import type { RetirementActionReadinessVeto } from '@retiregolden/engine/projection/optimizePlan'

export const RETIREMENT_ACTION_READINESS_VETO_ROW_NOTE =
  'calculated winner; withheld pending account allocation'

export function retirementActionReadinessVetoExplanation(
  veto: RetirementActionReadinessVeto,
): string {
  const source = veto.vetoedWinnerSource === 'milp'
    ? "The solver's calculated schedule"
    : veto.vetoedCandidateLabel ?? 'The calculated candidate'
  return `${source} cleared the selected objective, but its aggregate conversions do not identify the owner, source IRA, and Roth destination. It remains diagnostic-only until those account identities are allocated.`
}
