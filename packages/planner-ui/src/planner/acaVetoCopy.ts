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
import { acaContractRemovalFor, type AcaContractRemovalEdit } from '@retiregolden/engine/model/acaContractRemovals'
import type { Plan } from '@retiregolden/engine/model/plan'
import { isAcaGrossPremiumDiagnostic } from '@retiregolden/engine/decisions/spendingSolverDiagnostics'
import {
  INFORMATIONAL_ACA_SUPPORT_CODES,
  type AcaSupportCode,
  type YearResult,
} from '@retiregolden/engine/projection/types'

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
 * code. The informational codes (the engine's INFORMATIONAL_ACA_SUPPORT_CODES:
 * the two tax-exempt-interest codes and income-tax-parameters-projected) never
 * block a year and give no reason; any other code reads as the generic one.
 */
const UNPRICED_CREDIT_REASONS: Partial<Record<AcaSupportCode, string>> = {
  // The engine prices a coverage year once its applicable-percentage table
  // and poverty guidelines are in its coverage-year block
  // (params/acaCoverageYears.ts); 2028 and later are not published yet.
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
  // The ledger's own fixed points: the credit and the income it depends on are
  // solved together each year, and these say the solution did not settle, not
  // that any fact is missing (annualAcaResultPublication.ts,
  // annualFundingCandidateEvaluation.ts). The HSA one is the loop on
  // hsa.qualifiedExpenseCap, the medical expenses (Marketplace premiums
  // excluded) that HSA withdrawals can count against, not a contribution limit.
  'fixed-point-nonconvergent': "the credit and the income it depends on didn't settle on one value in that year",
  'conflicting-cliff-fixed-points': "the income can settle on either side of the credit's cliff in that year",
  'hsa-cap-fixed-point-nonconvergent':
    "the credit and the amount of HSA withdrawals that count as medical expenses didn't settle on one value in that year",
}
const OTHER_UNPRICED_CREDIT_REASON = 'some facts the credit needs are missing'

/** A support code's reason in plain words, for one year or for several. */
function creditReasonText(code: AcaSupportCode, oneYear: boolean): string {
  const reason = UNPRICED_CREDIT_REASONS[code] ?? OTHER_UNPRICED_CREDIT_REASON
  return oneYear ? reason : reason.replace('for that year', 'for those years').replace('in that year', 'in those years')
}

/**
 * Why a year has no contract when an edit removed it (review finding M2): the
 * edit, named, instead of the planner's missing editor. The contracts are
 * recorded on the plan with the edit that removed them
 * (`healthcare.acaYearsRemoved`).
 */
const CONTRACT_REMOVED_BY: Record<AcaContractRemovalEdit, string> = {
  partnerAdded: 'the details the credit needs were removed when a partner was added',
  partnerRemoved: 'the details the credit needs were removed when a partner was removed',
  peopleChanged: 'the details the credit needs were removed when the people in the household were changed',
  filingStatusChanged: 'the details the credit needs were removed when the filing status was changed',
  householdChanged: "the credit's written figures were removed when the household's details were changed",
  premiumChanged: "the credit's written figures were removed when the pre-65 premium was changed",
}

/** Where an edit removed a year's contracts: the plan's record of those removals. */
export type AcaContractRemovals = Pick<Plan['expenses']['healthcare'], 'acaYearsRemoved'>

/**
 * The reasons a set of years has no contract: the edit that removed each
 * year's contract, named, and the planner's missing editor for a year no
 * recorded edit removed.
 */
function missingContractReasons(years: readonly number[], removals: AcaContractRemovals | undefined): string[] {
  const reasons = years.map((year) => {
    const edit = removals === undefined ? null : acaContractRemovalFor(removals, year)
    return edit === null ? UNPRICED_CREDIT_REASONS['missing-year-contract']! : CONTRACT_REMOVED_BY[edit]
  })
  return [...new Set(reasons)]
}
const NOT_A_REASON: ReadonlySet<AcaSupportCode> = new Set<AcaSupportCode>([
  'actionable',
  ...INFORMATIONAL_ACA_SUPPORT_CODES,
])

/** What the solver publishes about the Marketplace years it could not price (SustainableSpendingResult). */
export interface UnpricedCreditFacts {
  acaGrossPremiumYears: number[]
  acaGrossPremiumReasons: readonly AcaSupportCode[]
  acaGrossPremiumDirection: 'conservative' | 'uncertain' | null
}

/**
 * "The premium tax credit isn't counted in YEARS: REASON." for Marketplace
 * years whose credit is unpriced, with the engine's blocking codes in plain
 * words. The reasons are merged across years, so with several years and
 * several reasons the sentence says each year has at least one of them. A
 * missing contract is explained by the edit that removed it when the plan
 * records one (`missingYears`: the years known to have no contract, else all
 * the years).
 */
function unpricedCreditSentence(
  years: readonly number[],
  codes: readonly AcaSupportCode[],
  removals?: AcaContractRemovals,
  missingYears: readonly number[] = years,
): string {
  const one = new Set(years).size === 1
  const reasons = [
    ...new Set(
      codes
        .filter((code) => !NOT_A_REASON.has(code))
        .flatMap((code) =>
          code === 'missing-year-contract' ? missingContractReasons(missingYears, removals) : [creditReasonText(code, one)],
        ),
    ),
  ]
  const lead = `The premium tax credit isn't counted in ${formatYearRuns([...years])}`
  return reasons.length === 0
    ? `${lead}: ${OTHER_UNPRICED_CREDIT_REASON}.`
    : one || reasons.length === 1
      ? `${lead}: ${joinNatural(reasons)}.`
      : `${lead}. In each of those years, at least one of these applies: ${reasons.join('; ')}.`
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
export function unpricedCreditSpendingNote(
  facts: UnpricedCreditFacts,
  answered: boolean,
  removals?: AcaContractRemovals,
): string | null {
  const years = facts.acaGrossPremiumYears
  const codes = facts.acaGrossPremiumReasons
  if (years.length === 0) return null
  const one = new Set(years).size === 1
  const why = unpricedCreditSentence(years, codes, removals)
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
 * Why the spending-guardrails Insight preview is not shown when a Marketplace
 * year's premium tax credit is unpriced, in plain words (decision of
 * 2026-09-26). A fixed spending level can be priced on the gross-premium
 * ledger because a credit could only lower its cost, but guardrail spending
 * changes withdrawals, withdrawals change the credit, and a credit can move a
 * guardrail result either way, so the preview keeps its refusal and says
 * which years and why. The years are those the exact evaluation refused on:
 * the base plan's and the previewed plan's unpriced years together. Null when
 * neither run has one (the refusal had another cause).
 */
export function guardrailPreviewUnpricedCreditRefusal(
  baselineYears: readonly Pick<YearResult, 'year' | 'aca'>[],
  previewYears: readonly Pick<YearResult, 'year' | 'aca'>[],
  removals?: AcaContractRemovals,
): string | null {
  const unpriced = [...baselineYears, ...previewYears].filter((year) => year.aca?.readiness === 'nonActionable')
  if (unpriced.length === 0) return null
  const years = [...new Set(unpriced.map((year) => year.year))].sort((a, b) => a - b)
  const codes = unpriced.flatMap((year) => year.aca?.supportCodes ?? [])
  const missing = [
    ...new Set(unpriced.filter((year) => year.aca?.supportCodes.includes('missing-year-contract')).map((year) => year.year)),
  ]
  return (
    `No preview is shown for this plan. ${unpricedCreditSentence(years, codes, removals, missing)} Guardrail spending changes how ` +
    'much you withdraw each year, and your withdrawals change the credit, so a preview that leaves the credit ' +
    'out could come out too high or too low.'
  )
}

/**
 * A solve's diagnostics without the engine's unpriced-credit sentence,
 * recognized by its content (`isAcaGrossPremiumDiagnostic`), not its place in
 * the list; surfaces that show the plain note in its place print the rest
 * verbatim.
 */
export function diagnosticsWithoutUnpricedCreditSentence(diagnostics: readonly string[]): string[] {
  return diagnostics.filter((message) => !isAcaGrossPremiumDiagnostic(message))
}

/** A Marketplace year whose credit could not be priced, with its own blocking support codes (the engine's UnpricedAcaYear). */
export interface UnpricedCreditYear {
  readonly year: number
  readonly reasons: readonly AcaSupportCode[]
}

/**
 * One year's reasons in plain words: a missing contract is explained by the
 * edit that removed it when the plan records one (review finding M2), else by
 * the planner's missing editor.
 */
function yearReasonTexts(
  codes: readonly AcaSupportCode[],
  year: number,
  oneYear: boolean,
  removals: AcaContractRemovals | undefined,
): string[] {
  return [
    ...new Set(
      codes.flatMap((code) =>
        code === 'missing-year-contract' ? missingContractReasons([year], removals) : [creditReasonText(code, oneYear)],
      ),
    ),
  ]
}

/**
 * The unpriced credit years in plain words, each with its own reason: years
 * that share their reasons are grouped as runs ("2028 to 2060 (RetireGolden
 * doesn't have the credit's figures for those years yet)"), the groups in
 * order of their first year and joined with semicolons. With the plan's
 * removal record, a year whose contract an edit removed names that edit.
 */
export function unpricedCreditYearsText(years: readonly UnpricedCreditYear[], removals?: AcaContractRemovals): string {
  const groups = new Map<string, { years: number[]; codes: AcaSupportCode[] }>()
  for (const entry of [...years].sort((a, b) => a.year - b.year)) {
    const codes = [...new Set(entry.reasons.filter((code) => !NOT_A_REASON.has(code)))]
    const key = yearReasonTexts(codes, entry.year, true, removals).join('|')
    const group = groups.get(key) ?? { years: [], codes }
    group.years.push(entry.year)
    groups.set(key, group)
  }
  return [...groups.values()]
    .map((group) => {
      const one = group.years.length === 1
      // Every year in a group has the same reasons, so its first year speaks for them all.
      const reasons =
        group.codes.length > 0 ? yearReasonTexts(group.codes, group.years[0]!, one, removals) : [OTHER_UNPRICED_CREDIT_REASON]
      return `${formatYearRuns(group.years)} (${reasons.join('; ')})`
    })
    .join('; ')
}

/**
 * Why a claim-age search refuses on a plan with unpriced credit years: every
 * Social Security benefit counts in the credit's income (26 U.S.C.
 * 36B(d)(2)(B)(iii) adds back the part not taxed) in the years it is paid, so
 * a credit left unpriced there can change which claim age comes out ahead, in
 * either direction (the decision of 2026-09-25). Shared by the Social Security
 * page's sweep and the Optimize page's claim-age co-optimization, so the two
 * pages refuse in the same words.
 */
export function claimAgeUnpricedCreditReason(years: readonly UnpricedCreditYear[], removals?: AcaContractRemovals): string {
  return (
    `Your plan's premium tax credit can't be priced in ${unpricedCreditYearsText(years, removals)}. ` +
    'All of your Social Security counts in the income that credit depends on, in the years it is paid, so a credit ' +
    'left unpriced there could change which claim age comes out ahead, in either direction.'
  )
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
