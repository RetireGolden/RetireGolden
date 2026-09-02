/** Validation-issue list shared by the plan entry sections. */

import { Link } from 'react-router'

import { usePlan } from '../planContextCore'
import { sectionsWithIssues } from '../validationIssues'

export function Issues() {
  const { issues } = usePlan()
  if (issues.length === 0) return null
  return (
    <ul className="issue-list">
      {issues.map((i) => (
        <li key={i}>{i}</li>
      ))}
    </ul>
  )
}

/**
 * Where to look for the entries behind the current issues, for a paused
 * panel that may sit on a page with no issue list of its own (the funded
 * ratio on Results): "The issue list on Insurance names the field." with a
 * link per section, in rail order. Falls back to generic wording when an
 * issue's plan key has no editing section.
 */
export function IssueSectionsSentence() {
  const { issues } = usePlan()
  const sections = sectionsWithIssues(issues)
  const plural = issues.length > 1
  if (sections.length === 0) {
    return <>The issue list on the page with the {plural ? 'entries names the fields' : 'entry names the field'}.</>
  }
  const links = sections.map((section) => (
    <Link key={section.segment} to={`../${section.segment}`}>
      {section.title}
    </Link>
  ))
  const joined = links.flatMap((link, i) => {
    if (i === 0) return [link]
    const sep = i === links.length - 1 ? (links.length === 2 ? ' and ' : ', and ') : ', '
    return [sep, link]
  })
  return (
    <>
      The issue {sections.length > 1 ? 'lists' : 'list'} on {joined} {sections.length > 1 ? 'name' : 'names'} the{' '}
      {plural ? 'fields' : 'field'}.
    </>
  )
}
