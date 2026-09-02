/**
 * Plan-name presentation limits (#533). The schema only requires a non-empty
 * name; these caps are chrome, not validation: the name inputs (workspace
 * header, Duplicate prompt) stop accepting text at the cap, a "Copy of …"
 * default is cut to fit it, and the tab title carries a shortened name so a
 * long one does not fill the tab strip. Stored names are never rewritten.
 */

/** Longest name the name inputs accept. */
export const PLAN_NAME_MAX_LENGTH = 120

/** Longest run of the name the document title carries before an ellipsis. */
export const PLAN_NAME_TITLE_MAX_LENGTH = 60

/** The Duplicate prompt's default for a source plan, cut to the input cap. */
export function duplicateNameDefault(sourceName: string): string {
  return clampPlanName(`Copy of ${sourceName}`)
}

/**
 * The name a Duplicate goes ahead with: what was typed, or, when the prompt
 * was emptied and confirmed, the same default the prompt opened with. The
 * store's own blank fallback is "Copy of <name>" unclamped, which for a
 * source already at the cap would exceed it (review of #533).
 */
export function duplicateNameFor(entered: string, sourceName: string): string {
  const typed = entered.trim()
  return typed ? clampPlanName(typed) : duplicateNameDefault(sourceName)
}

/** A default such as "Copy of <name>" cut to the input cap, trailing space trimmed. */
export function clampPlanName(name: string): string {
  return name.length <= PLAN_NAME_MAX_LENGTH ? name : name.slice(0, PLAN_NAME_MAX_LENGTH).trimEnd()
}

/** The plan name as the tab title shows it: shortened with an ellipsis past the cap. */
export function planNameForTitle(name: string): string {
  return name.length <= PLAN_NAME_TITLE_MAX_LENGTH ? name : `${name.slice(0, PLAN_NAME_TITLE_MAX_LENGTH).trimEnd()}…`
}
