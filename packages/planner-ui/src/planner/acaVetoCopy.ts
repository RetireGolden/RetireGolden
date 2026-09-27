/**
 * Shared user-facing copy for the exact-ledger tournament's ACA actionability
 * veto (`ExactLedgerTournament.acaActionabilityVeto`). The Optimize page, the
 * "why this recommendation" panel, and the report evidence all explain a
 * vetoed incumbent/none fallback with the same sentences, so the story never
 * drifts between surfaces. Everything here is finding-framed — it reports what
 * the projection could not price, never an instruction — per the
 * decision-support boundary (guarded by app/src/boundaryLanguage.test.ts).
 *
 * The spending answer's note (the "How much can I spend?" page and the
 * Scenarios capacity section) lives here too: the same unpriced years, told
 * from the side of a spending level instead of a conversion.
 */

import type { AcaActionabilityVeto } from '@retiregolden/engine/projection/optimizePlan'
import type { AcaSupportCode } from '@retiregolden/engine/projection/types'

/** Every non-actionable ACA year the veto cites, merged and ascending. */
export function acaVetoYears(veto: AcaActionabilityVeto): number[] {
  return [...new Set([...veto.baselineNonActionableYears, ...veto.candidateNonActionableYears])].sort((a, b) => a - b)
}

function joinNatural(items: string[]): string {
  if (items.length <= 1) return items[0] ?? ''
  if (items.length === 2) return `${items[0]} and ${items[1]}`
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`
}

/** Natural-language year list ("2027", "2027 and 2028", "2026, 2027, and 2028"). */
export function formatYearList(years: number[]): string {
  return joinNatural(years.map(String))
}

/**
 * Year list with runs of three or more collapsed ("2027 to 2060", "2026 to
 * 2028 and 2030", "2027 and 2028"): an unpriced span can be decades long.
 */
export function formatYearRuns(years: number[]): string {
  const sorted = [...new Set(years)].sort((a, b) => a - b)
  const items: string[] = []
  for (let start = 0; start < sorted.length; ) {
    let end = start
    while (end + 1 < sorted.length && sorted[end + 1] === sorted[end]! + 1) end++
    if (end - start >= 2) items.push(`${sorted[start]} to ${sorted[end]}`)
    else for (let i = start; i <= end; i++) items.push(String(sorted[i]))
    start = end + 1
  }
  return joinNatural(items)
}

/**
 * Why a Marketplace year's credit is not priced, by the engine's support
 * code. The two tax-exempt-interest codes are informational (they never block
 * a year) and give no reason; any other code reads as the generic one.
 */
const UNPRICED_CREDIT_REASONS: Partial<Record<AcaSupportCode, string>> = {
  // Whether the IRS has published a later year's figures is not what blocks
  // it (the 2027 applicable-percentage table is out): the engine has no
  // sourced parameter pack for the year yet.
  'tax-year-parameters-unsupported': "RetireGolden doesn't have the credit's figures for that year yet",
  // No screen collects the per-year household contract yet, so the reason
  // points at the planner, not at a field the reader cannot find.
  'missing-year-contract': "the planner doesn't yet collect the household details the credit needs",
  'guardrail-interaction-unsupported': "the credit isn't modeled together with guardrail spending",
  // Below 100% of the poverty line there is generally no credit (26 U.S.C.
  // 36B(c)(1)(A)); the one pathway left for tax years after 2025 (Treas. Reg.
  // 1.36B-2(b)(6), advance credit paid on an enrollment estimate of 100% to
  // 400%) is not modeled.
  'below-100-fpl-exception-unsupported':
    'income is below the poverty line, where there is generally no credit and Medicaid may apply',
  'example-contract-input-mismatch': "the example's inputs were edited, so its stated credit figures no longer apply",
}
const OTHER_UNPRICED_CREDIT_REASON = 'some facts the credit needs are missing'
const NOT_A_REASON: ReadonlySet<AcaSupportCode> = new Set([
  'actionable',
  'tax-exempt-interest-plan-derived',
  'tax-exempt-interest-contract-contradicted',
])

/** What the solver publishes about the Marketplace years it could not price (SustainableSpendingResult). */
export interface UnpricedCreditFacts {
  acaGrossPremiumYears: number[]
  acaGrossPremiumReasons: readonly AcaSupportCode[]
  acaGrossPremiumDirection: 'conservative' | 'uncertain' | null
}

/**
 * The note beside a spending answer (or its absence) whose projection could
 * not price the premium tax credit in some Marketplace years: it names the
 * years and why, and says which way a credit there would move the result,
 * by the solver's direction: at fixed-target spending a credit would likely
 * leave room to spend more; under guardrails it could move the answer either
 * way. The reasons are merged across years, so with several years and several
 * reasons the note says each year has at least one of them rather than pinning
 * every reason on every year. Null when there are no such years.
 */
export function unpricedCreditSpendingNote(facts: UnpricedCreditFacts, answered: boolean): string | null {
  const years = facts.acaGrossPremiumYears
  const codes = facts.acaGrossPremiumReasons
  if (years.length === 0) return null
  const one = new Set(years).size === 1
  const reasons = [
    ...new Set(
      codes
        .filter((code) => !NOT_A_REASON.has(code))
        .map((code) => UNPRICED_CREDIT_REASONS[code] ?? OTHER_UNPRICED_CREDIT_REASON),
    ),
  ].map((reason) => (one ? reason : reason.replace('for that year', 'for those years')))
  const lead = `The premium tax credit isn't counted in ${formatYearRuns(years)}`
  const why =
    reasons.length === 0
      ? `${lead}: ${OTHER_UNPRICED_CREDIT_REASON}.`
      : one || reasons.length === 1
        ? `${lead}: ${joinNatural(reasons)}.`
        : `${lead}. In each of those years, at least one of these applies: ${reasons.join('; ')}.`
  const adaptive = facts.acaGrossPremiumDirection === 'uncertain'
  const guardrails = 'because your spending guardrails respond to what healthcare costs'
  const effect = answered
    ? adaptive
      ? `a credit then could move this answer up or down, ${guardrails}.`
      : 'if you receive a credit then, you would likely be able to spend somewhat more than this.'
    : adaptive
      ? `a credit then could change this result, ${guardrails}.`
      : 'a credit then would lower that cost.'
  return `${why} The projection pays the full Marketplace premium in ${one ? 'that year' : 'those years'}; ${effect}`
}

/**
 * A solve's diagnostics without its unpriced-credit sentence, which the engine
 * appends last whenever it names such years; surfaces that show the plain
 * note in its place print the rest verbatim.
 */
export function diagnosticsWithoutUnpricedCreditSentence(diagnostics: string[], acaGrossPremiumYears: number[]): string[] {
  return acaGrossPremiumYears.length > 0 ? diagnostics.slice(0, -1) : diagnostics
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
  // Name the missing-parameters cause only when it is the SOLE code — the
  // engine merges codes across years, so a mixed set (e.g. one year with
  // unknown tax-exempt interest, another past the sourced-pack horizon) must
  // not claim every listed year is waiting on parameters.
  const parameterGapOnly = veto.supportCodes.length === 1 && veto.supportCodes[0] === 'tax-year-parameters-unsupported'
  const lead = parameterGapOnly
    ? `This plan carries marketplace (ACA) coverage in ${yearsText}, and RetireGolden doesn't have the credit's figures for ${those} yet.`
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
