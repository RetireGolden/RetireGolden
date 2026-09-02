/**
 * Validation-issue list shared by the plan entry sections. Each section shows
 * the issues that belong to it (plus any the router cannot place), with the
 * field named and the fix stated in words; the raw schema path stays in the
 * item's title for anyone who needs it (#452, #491, #494).
 */

import { usePlan } from '../planContextCore'
import { issuesForSection, parseIssues, type IssueSection } from '../validationIssues'

export function Issues({ section }: { section: IssueSection }) {
  const { issues } = usePlan()
  const mine = issuesForSection(parseIssues(issues), section)
  if (mine.length === 0) return null
  return (
    <ul className="issue-list" id={`plan-issues-${section}`} tabIndex={-1} aria-label="Fix these to store the plan">
      {mine.map((i) => (
        <li key={`${i.path}:${i.message}`} title={`${i.path}: ${i.message}`}>
          <strong>{i.label}</strong>: {i.advice}
        </li>
      ))}
    </ul>
  )
}
