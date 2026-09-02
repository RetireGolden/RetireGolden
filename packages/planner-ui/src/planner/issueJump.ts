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

/** The first placeable issue's section and path, or nulls. */
export function firstIssue(issues: readonly string[]): { section: IssueSection | null; path: string | null } {
  const placed = parseIssues(issues).find((i) => i.section !== 'unknown')
  return { section: placed?.section ?? null, path: placed?.path ?? null }
}

/** The section that owns the first placeable issue, or null. */
export function firstIssueSection(issues: readonly string[]): IssueSection | null {
  return firstIssue(issues).section
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
 * The element the jump searches within: the plan outlet, so host chrome and
 * any other widget on the same document that happens to carry aria-invalid
 * can never swallow the chip. Falls back to the whole document only where
 * there is no workspace (tests of the bare helper).
 */
export function workspaceRoot(doc: Document = document): ParentNode {
  return doc.getElementById('plan-content') ?? doc.querySelector('.planner-shell') ?? doc
}

/** A `data-path` attribute selector; the path is a schema path, never user text, but escaped all the same. */
function ownControlSelector(path: string): string {
  const escaped = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(path) : path.replace(/["\\]/g, '\\$&')
  return `${INVALID_CONTROL_SELECTOR}[data-path="${escaped}"]`
}

/**
 * Scroll to and focus the control for the issue, else an issue list; true
 * when something was found. In order: the control wired to the first issue's
 * own path (`data-path`), then any invalid control within the root, then a
 * list. With a section named, only that section's list counts — landing on
 * another section's list would leave the person reading an issue they did
 * not ask about while the caller believes the jump succeeded and skips
 * navigating. With no section (every issue is unplaceable) any plan issue
 * list will do, since they all show it.
 */
export function focusIssueTarget(root: ParentNode, section: IssueSection | null, path: string | null = null): boolean {
  const own = path ? root.querySelector<HTMLElement>(ownControlSelector(path)) : null
  const list =
    section && section !== 'unknown'
      ? root.querySelector<HTMLElement>(`#plan-issues-${section}`)
      : root.querySelector<HTMLElement>(ISSUE_LIST_SELECTOR)
  const target = own ?? root.querySelector<HTMLElement>(INVALID_CONTROL_SELECTOR) ?? list
  if (!target) return false
  target.scrollIntoView?.({ block: 'center' })
  target.focus?.()
  return true
}

/**
 * After navigating, the destination renders over the next frames: keep
 * looking for the target until it is found, `frames` frames have passed, or
 * `isStale()` says the person has moved on (another route, another control).
 * Returns a cancel for the caller's own cleanup.
 */
export function retryFocus(
  root: () => ParentNode,
  section: IssueSection | null,
  path: string | null,
  isStale: () => boolean,
  frames = 30,
): () => void {
  let handle: number | undefined
  let tries = 0
  const look = () => {
    handle = undefined
    if (isStale()) return
    if (focusIssueTarget(root(), section, path) || tries++ >= frames) return
    handle = requestAnimationFrame(look)
  }
  handle = requestAnimationFrame(look)
  return () => {
    if (handle !== undefined) cancelAnimationFrame(handle)
    handle = undefined
  }
}
