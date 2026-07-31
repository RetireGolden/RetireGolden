/**
 * Shared user-facing copy for the exact-ledger tournament's ACA actionability
 * veto (`ExactLedgerTournament.acaActionabilityVeto`). The Optimize page, the
 * "why this recommendation" panel, and the report evidence all explain a
 * vetoed incumbent/none fallback with the same sentences, so the story never
 * drifts between surfaces. Everything here is finding-framed — it reports what
 * the projection could not price, never an instruction — per the
 * decision-support boundary (guarded by app/src/boundaryLanguage.test.ts).
 */

import type { AcaActionabilityVeto } from '@retiregolden/engine/projection/optimizePlan'

/** Every non-actionable ACA year the veto cites, merged and ascending. */
export function acaVetoYears(veto: AcaActionabilityVeto): number[] {
  return [...new Set([...veto.baselineNonActionableYears, ...veto.candidateNonActionableYears])].sort((a, b) => a - b)
}

/** Natural-language year list ("2027", "2027 and 2028", "2026, 2027, and 2028"). */
export function formatYearList(years: number[]): string {
  if (years.length <= 1) return String(years[0] ?? '')
  if (years.length === 2) return `${years[0]} and ${years[1]}`
  return `${years.slice(0, -1).join(', ')}, and ${years[years.length - 1]}`
}

/** Short marker appended to a vetoed candidate row in the alternatives table. */
export const ACA_VETO_ROW_NOTE = 'not actionable (unpriced ACA years)'

/**
 * Full-sentence explanation of why the tournament held the current plan (or
 * recommended nothing) while a candidate row can show a positive delta.
 */
export function acaVetoExplanation(veto: AcaActionabilityVeto): string {
  const years = acaVetoYears(veto)
  const yearsText = formatYearList(years)
  const those = years.length === 1 ? 'that year' : 'those years'
  // Name the unpublished-parameters cause only when it is the SOLE code — the
  // engine merges codes across years, so a mixed set (e.g. one year with
  // unknown tax-exempt interest, another past the sourced-pack horizon) must
  // not claim every listed year is waiting on parameters.
  const parameterGapOnly = veto.supportCodes.length === 1 && veto.supportCodes[0] === 'tax-year-parameters-unsupported'
  const lead = parameterGapOnly
    ? `This plan carries marketplace (ACA) coverage in ${yearsText}, and sourced ACA tax parameters for ${those} are not yet published.`
    : `The marketplace (ACA) evidence for ${yearsText} could not be priced as actionable on the full projection.`
  const tail =
    veto.vetoedCandidateIds.length > 0
      ? ' A blocked candidate row can still show favorable deltas. Those figures leave the unpriced ACA effect out.'
      : ''
  return (
    `${lead} Conversion income changes the ACA premium tax credit, and the projection cannot measure that change in ` +
    `${those}, so no conversion schedule is presented as actionable while ${years.length === 1 ? 'it stays' : 'they stay'} unpriced.${tail}`
  )
}
