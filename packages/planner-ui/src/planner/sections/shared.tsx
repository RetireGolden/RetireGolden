/**
 * Validation-issue list shared by the plan entry sections. Each section shows
 * the issues that belong to it (plus any the router cannot place), with the
 * field named and the fix stated in words; the raw schema path stays in the
 * item's title for anyone who needs it (#452, #491, #494).
 */

import { Link } from 'react-router'

import { usePlan } from '../planContextCore'
import { issuesForSection, parseIssues, sectionsWithIssues, type IssueSection } from '../validationIssues'

export function Issues({ section }: { section: IssueSection }) {
  const { issues } = usePlan()
  const mine = issuesForSection(parseIssues(issues), section)
  if (mine.length === 0) return null
  return (
    <ul className="issue-list" id={`plan-issues-${section}`} tabIndex={-1} aria-label="Fix these to store the plan">
      {mine.map((i, n) => (
        <li key={`${n}:${i.path}`} title={`${i.path}: ${i.message}`}>
          <strong>{i.label}</strong>: {i.advice}
        </li>
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
  // Number follows the linked sections (one issue list per section); "each
  // field" is number-neutral, so the sentence never has to know how many
  // issues a section holds.
  if (sections.length === 0) {
    return <>Open the page that holds the {issues.length > 1 ? 'entries' : 'entry'}; its issue list names each field.</>
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
      The issue {sections.length > 1 ? 'lists' : 'list'} on {joined} {sections.length > 1 ? 'name' : 'names'} each field.
    </>
  )
}
