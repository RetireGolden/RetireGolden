/**
 * Human labels for the plan workspace's route segments (`/plan/:id/<segment>`).
 * Drives the tab title, the page h1, and any link that names a screen (the
 * Insights "Go to …" link, #461), so one place owns the wording.
 */
export const SECTION_TITLES: Record<string, string> = {
  household: 'Household',
  'social-security': 'Social Security',
  accounts: 'Accounts',
  insurance: 'Insurance',
  income: 'Income',
  'income-floor': 'Income floor',
  spending: 'Spending',
  strategy: 'Strategy',
  assumptions: 'Assumptions',
  insights: 'Insights',
  optimize: 'Roth & Tax Optimizer',
  'spending-solver': 'How much can I spend?',
  'social-security-analysis': 'Social Security Optimizer',
  results: 'Results',
  'monte-carlo': 'Monte Carlo',
  scenarios: 'Scenarios',
  'household-map': 'Household map',
  survivor: 'Survivor transition',
  relocation: 'Relocation Compare',
  report: 'Report',
  'assumptions-card': 'Assumptions card',
}

/** The screen's label for a route segment (or a path starting with one), else null. */
export function sectionTitleOf(segmentOrPath: string): string | null {
  const segment = segmentOrPath.split('/').filter(Boolean)[0] ?? ''
  return SECTION_TITLES[segment] ?? null
}
