/** Validation-issue list shared by the plan entry sections. */

import { usePlan } from '../planContextCore'

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
