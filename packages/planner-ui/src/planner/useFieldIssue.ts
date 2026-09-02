import { useParsedIssues } from './planContextCore'
import { type ParsedIssue } from './validationIssues'

/**
 * The engine's validation issue for one schema path (`strategies.qcdAnnual`,
 * `incomes.0.endAge`), so a field can show it inline. Null when the plan is
 * valid, when the field has no path, or outside a plan context (the field
 * components also render in the import wizard and lever editors). The match
 * is on the whole path, never a prefix.
 *
 * The issues are parsed once per plan by the provider and read here as a map:
 * parsing recomputes section, label, advice, and schema-key wording, and there
 * are around sixty wired fields on screen (r3-7).
 */
export function useFieldIssue(path: string | undefined): ParsedIssue | null {
  const parsed = useParsedIssues()
  if (!path || !parsed) return null
  return parsed.byPath.get(path) ?? null
}
