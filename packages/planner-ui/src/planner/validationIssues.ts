/**
 * The engine's validation issues as the UI reads them. `parsePlan` reports
 * each issue as `path.segments: message` (`(root)` for a plan-level one);
 * a derived panel asks here whether the entries it prices are the ones
 * failing, and which planner sections the failing entries live on, instead
 * of matching the strings itself (#512, #517, review rounds 2 and 3).
 */

import { SECTION_TITLES } from './sectionTitles'

export interface ParsedIssue {
  /** Path segments, e.g. ['incomeFloor', 'ladders', '10', 'endYear']; empty for a plan-level issue. */
  path: string[]
  message: string
}

/** Split `a.b.0: message` into its segments and message; a string with no separator is all message. */
export function parseIssue(issue: string): ParsedIssue {
  const sep = issue.indexOf(': ')
  if (sep < 0) return { path: [], message: issue }
  const path = issue.slice(0, sep)
  return { path: path === '(root)' ? [] : path.split('.'), message: issue.slice(sep + 2) }
}

const toSegments = (path: string | readonly string[]): string[] =>
  typeof path === 'string' ? path.split('.').filter((s) => s.length > 0) : [...path]

/**
 * Whether an issue sits at `path` or anywhere under it, compared segment by
 * segment: `incomeFloor.ladders.1` covers `incomeFloor.ladders.1.endYear`
 * and not `incomeFloor.ladders.10.endYear`.
 */
export function hasIssueUnder(issues: readonly string[], ...paths: readonly (string | readonly string[])[]): boolean {
  return issues.some((issue) => {
    const { path } = parseIssue(issue)
    return paths.some((p) => {
      const want = toSegments(p)
      return want.length <= path.length && want.every((segment, i) => path[i] === segment)
    })
  })
}

/** Whether an issue is reported on exactly `path` (not on a child of it). */
export function hasIssueAt(issues: readonly string[], path: string | readonly string[]): boolean {
  const want = toSegments(path)
  return issues.some((issue) => {
    const { path: got } = parseIssue(issue)
    return got.length === want.length && want.every((segment, i) => got[i] === segment)
  })
}

/**
 * The planner section (route segment under /plan/:id/) that edits each
 * top-level plan key, in rail order. A key with no editing section maps to
 * nothing and the caller falls back to generic wording.
 */
const SECTION_BY_PLAN_KEY: Record<string, string> = {
  household: 'household',
  accounts: 'accounts',
  insurance: 'insurance',
  careEvents: 'insurance',
  incomes: 'income',
  incomeFloor: 'income-floor',
  expenses: 'spending',
  strategies: 'strategy',
  retirementActionEligibilityFacts: 'strategy',
  retirementActionAnnualTaxFacts: 'strategy',
  assumptions: 'assumptions',
  scenarios: 'scenarios',
}

const RAIL_ORDER = Object.keys(SECTION_TITLES)

export interface IssueSection {
  /** Route segment, e.g. 'income-floor'; link to it as `../${segment}` from any plan page. */
  segment: string
  title: string
}

/** The sections the issues' entries live on, each once, in rail order; empty when none is known. */
export function sectionsWithIssues(issues: readonly string[]): IssueSection[] {
  const segments = new Set<string>()
  for (const issue of issues) {
    const key = parseIssue(issue).path[0]
    const segment = key === undefined ? undefined : SECTION_BY_PLAN_KEY[key]
    if (segment !== undefined) segments.add(segment)
  }
  return RAIL_ORDER.filter((s) => segments.has(s)).map((segment) => ({ segment, title: SECTION_TITLES[segment]! }))
}
