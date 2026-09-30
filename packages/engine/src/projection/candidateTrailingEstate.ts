/**
 * How far a conversion candidate that was not chosen trails the schedule it
 * is measured against, in after-tax estate improvement (B2-P1, the
 * downloadable report's "Trailed … by $X"). Nominal dollars at the plan's
 * last year, the unit of every `afterTaxEstateDelta` a tournament publishes.
 *
 * The benchmark is the exact-ledger validation's `afterTaxEstateDelta` of
 * the selected winner (`winnerValidation`) or, when the calculated winner was
 * withheld pending account allocation, of that withheld winner
 * (`retirementActionReadinessVeto.vetoedValidation`); with neither (the
 * incumbent and none outcomes) it is the largest of 0 and every candidate's
 * `afterTaxEstateDelta`. A candidate trails by benchmark − its own delta when
 * that is positive; otherwise it does not trail.
 *
 * A leaf module (its one import is a type), so the report does not load the
 * optimizer to print the gap.
 *
 * @see DOCS/calculations/optimizer-and-comparisons/optimizer-candidate-trailing-estate-amount.md
 */
import type { SimpleCandidateEvaluation } from './optimizePlan.js'

/** What the gap reads from a tournament: its candidates and the validation of the winner it selected or withheld. */
export interface TrailingEstateTournament {
  readonly candidates: readonly Pick<SimpleCandidateEvaluation, 'afterTaxEstateDelta'>[]
  readonly winnerValidation: { readonly afterTaxEstateDelta: number } | null
  readonly retirementActionReadinessVeto: { readonly vetoedValidation: { readonly afterTaxEstateDelta: number } } | null
}

/** The after-tax estate improvement a tournament's candidates are measured against (see the module comment). */
export function tournamentEstateBenchmark(tournament: TrailingEstateTournament): number {
  const validation = tournament.winnerValidation ?? tournament.retirementActionReadinessVeto?.vetoedValidation ?? null
  if (validation !== null) return validation.afterTaxEstateDelta
  let best = 0
  for (const candidate of tournament.candidates) best = Math.max(best, candidate.afterTaxEstateDelta)
  return best
}

/**
 * benchmark − candidate.afterTaxEstateDelta when the benchmark is larger, the
 * amount the report prints; null when the candidate does not trail it.
 */
export function candidateTrailingEstateAmount(
  tournament: TrailingEstateTournament,
  candidate: Pick<SimpleCandidateEvaluation, 'afterTaxEstateDelta'>,
): number | null {
  const benchmark = tournamentEstateBenchmark(tournament)
  return benchmark > candidate.afterTaxEstateDelta ? benchmark - candidate.afterTaxEstateDelta : null
}
