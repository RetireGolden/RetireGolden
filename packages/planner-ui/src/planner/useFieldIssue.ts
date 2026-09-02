import { useContext } from 'react'

import { PlanCtx } from './planContextCore'
import { parseIssue, type ParsedIssue } from './validationIssues'

/**
 * The engine's validation issue for one schema path (`strategies.qcdAnnual`,
 * `incomes.0.endAge`), so a field can show it inline. Null when the plan is
 * valid, when the field has no path, or outside a plan context (the field
 * components also render in the import wizard and lever editors). The match
 * is on the whole path, never a prefix.
 */
export function useFieldIssue(path: string | undefined): ParsedIssue | null {
  const ctx = useContext(PlanCtx)
  if (!path || !ctx) return null
  for (const issue of ctx.issues) {
    const parsed = parseIssue(issue, ctx.plan)
    if (parsed.path === path) return parsed
  }
  return null
}
