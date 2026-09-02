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

export const INVALID_CONTROL_SELECTOR = '[aria-invalid="true"]'
export const ISSUE_LIST_SELECTOR = 'ul.issue-list[id^="plan-issues-"]'

/** Scroll to and focus the first invalid control on the page, else the given section's issue list; true when something was found. */
export function focusIssueTarget(root: ParentNode, section: IssueSection | null): boolean {
  const target =
    root.querySelector<HTMLElement>(INVALID_CONTROL_SELECTOR) ??
    (section ? root.querySelector<HTMLElement>(`#plan-issues-${section}`) : null) ??
    root.querySelector<HTMLElement>(ISSUE_LIST_SELECTOR)
  if (!target) return false
  target.scrollIntoView?.({ block: 'center' })
  target.focus?.()
  return true
}
