/** Guidance uses evidence from the evaluated result, never a substitute baseline run. */
import type { TaxComputationIssue } from '@retiregolden/engine/projection/types'
import { formatYearList } from './acaVetoCopy'

export interface IncompleteComputationEvidence {
  year: number
  taxIssues?: readonly TaxComputationIssue[]
  hecmIssues?: readonly string[]
}

export interface StateTaxIncompleteGuidance {
  years: number[]
  summary: string
  details: string[]
  worksheetLinkLabel: string | null
  accountsLinkLabel: string | null
}

/** Only explicit state attribution identifies a state-tax issue. */
function isStateIssue(issue: TaxComputationIssue): boolean {
  return Boolean(issue.state) || [
    'missing-state-filing-status', 'missing-personal-exemption-facts',
    'unknown-retirement-source-or-eligibility', 'unallocated-part-year-event',
    'unknown-state-qcd-policy', 'unsupported-state-qcd-transaction',
    'inconsistent-state-basis', 'incomplete-state-facts',
  ].includes(issue.code)
}

export function stateTaxIncompleteGuidance(
  incompleteYears: readonly number[],
  evidence: readonly IncompleteComputationEvidence[] = [],
): StateTaxIncompleteGuidance | null {
  if (incompleteYears.length === 0) return null
  const years = [...new Set(incompleteYears)].sort((a, b) => a - b)
  const relevant = evidence.filter((entry) => years.includes(entry.year))
  const taxIssues = relevant.flatMap((entry) => entry.taxIssues ?? [])
  const hecmIssues = relevant.flatMap((entry) => entry.hecmIssues ?? [])
  const hasState = taxIssues.some(isStateIssue)
  const hasOtherTax = taxIssues.some((issue) => !isStateIssue(issue))
  const hasPension = taxIssues.some((issue) =>
    issue.code === 'unknown-retirement-source-or-eligibility' ||
    (issue.missingFacts ?? []).some((fact) => /pension|retirementSource/i.test(fact)),
  )
  const components = [
    ...(hasState ? ['state income tax'] : []),
    ...(hasOtherTax ? ['other tax calculations'] : []),
    ...(hecmIssues.length ? ['reverse-mortgage (HECM) calculations'] : []),
  ]
  const unavailableYears = years.filter((year) => !relevant.some((entry) =>
    entry.year === year && ((entry.taxIssues?.length ?? 0) > 0 || (entry.hecmIssues?.length ?? 0) > 0),
  ))
  const summary = components.length > 0
    ? `The evaluated result reports incomplete ${components.join(' and ')} in ${formatYearList(years)}. No exact conversion comparison can be published.`
    : `Tax or reverse-mortgage (HECM) calculations were incomplete in ${formatYearList(years)}. No exact conversion comparison can be published.`
  return {
    years,
    summary: unavailableYears.length > 0
      ? `${summary} Issue details are unavailable for the evaluated candidate results in ${formatYearList(unavailableYears)}; the current plan's projection may not reproduce their missing facts.`
      : summary,
    details: [...new Set([...taxIssues.map((issue) => issue.message), ...hecmIssues])],
    worksheetLinkLabel: hasState ? 'Review state tax worksheet facts' : null,
    accountsLinkLabel: hasPension ? 'Review pension source details on Accounts' : null,
  }
}
