/**
 * Human labels for planner route segments on an article's back link
 * ("← Back to Optimize").
 *
 * Deliberately NOT derived from planner/sectionTitles: a static edge from the
 * learn graph into the planner graph makes Rolldown regroup the modules
 * LearnLink shares with the lazy routes, and the Learning Center registry
 * (124 KiB) lands in the app entry instead of its own chunk, blowing the
 * entry budget (PR #488 review round 2). planner/sectionTitles.test.ts pins
 * that the two maps agree on every segment, so the wording still has one
 * owner in practice. The one deliberate difference is the assumptions card,
 * which the reader knows as "Your assumptions".
 */
export const SEGMENT_LABELS: Readonly<Record<string, string>> = {
  household: 'Household',
  'social-security': 'Social Security',
  accounts: 'Accounts',
  insurance: 'Insurance',
  income: 'Income',
  'income-floor': 'Income floor',
  spending: 'Spending',
  strategy: 'Strategy',
  assumptions: 'Assumptions',
  'assumptions-card': 'Your assumptions',
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
}
