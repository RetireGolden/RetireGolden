import { useContext } from 'react'

import { PlanCtx } from './planContextCore'
import { parseIssue, type ParsedIssue } from './validationIssues'

/**
 * The engine's validation issue for one schema path (`strategies.qcdAnnual`,
 * `incomes.0.endAge`), so a field can show it inline. Null when the plan is
 * valid, when the field has no path, or outside a plan context (the field
 * components also render in the import wizard and lever editors).
 */
export function useFieldIssue(path: string | undefined): ParsedIssue | null {
  const ctx = useContext(PlanCtx)
  if (!path || !ctx) return null
  const hit = ctx.issues.find((issue) => issue.startsWith(`${path}: `))
  return hit ? parseIssue(hit) : null
}
