/**
 * Where the header's "Fix N issues" chip goes (#494): the first invalid
 * control on the current page if there is one, else the issue list of the
 * section that owns the first issue, navigating there when it is another
 * section. Pure helpers here; the chip wires them to the router.
 */
import { parseIssues, type IssueSection } from './validationIssues'

/** Route segment under /plan/:id for each section's page. */
export const SECTION_ROUTE: Record<IssueSection, string | null> = {
  household: 'household',
  assumptions: 'assumptions',
  strategy: 'strategy',
  spending: 'spending',
  accounts: 'accounts',
  income: 'income',
  'social-security': 'social-security',
  insurance: 'insurance',
  'income-floor': 'income-floor',
  unknown: null,
}

/** The section that owns the first placeable issue, or null. */
export function firstIssueSection(issues: readonly string[]): IssueSection | null {
  const placed = parseIssues(issues).find((i) => i.section !== 'unknown')
  return placed?.section ?? null
}

/**
 * Where the chip goes when no issue can be placed (a `schemaVersion` or
 * plan-level failure). Every section's list shows the unplaceable issues, and
 * Household is the first entry section, so it is a page where they are both
 * visible and near the fields — better than a chip that does nothing on
 * Results, Optimize, or Scenarios (#494).
 */
export const UNPLACEABLE_FALLBACK_SECTION: IssueSection = 'household'

/** The route the chip should navigate to for these issues, or null when there is nowhere to go. */
export function routeForIssues(issues: readonly string[]): string | null {
  const section = firstIssueSection(issues) ?? (issues.length > 0 ? UNPLACEABLE_FALLBACK_SECTION : null)
  return section ? SECTION_ROUTE[section] : null
}

export const INVALID_CONTROL_SELECTOR = '[aria-invalid="true"]'
export const ISSUE_LIST_SELECTOR = 'ul.issue-list[id^="plan-issues-"]'

/**
 * Scroll to and focus the first invalid control on the page, else an issue
 * list; true when something was found. With a section named, only that
 * section's list counts — landing on another section's list would leave the
 * person reading an issue they did not ask about while the caller believes
 * the jump succeeded and skips navigating. With no section (every issue is
 * unplaceable) any plan issue list will do, since they all show it.
 */
export function focusIssueTarget(root: ParentNode, section: IssueSection | null): boolean {
  const list =
    section && section !== 'unknown'
      ? root.querySelector<HTMLElement>(`#plan-issues-${section}`)
      : root.querySelector<HTMLElement>(ISSUE_LIST_SELECTOR)
  const target = root.querySelector<HTMLElement>(INVALID_CONTROL_SELECTOR) ?? list
  if (!target) return false
  target.scrollIntoView?.({ block: 'center' })
  target.focus?.()
  return true
}
