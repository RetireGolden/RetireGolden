/**
 * "Planner overview: from household to results" - a Using RetireGolden P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const plannerOverviewArticle: LearningArticle = {
  slug: 'planner-overview',
  title: 'Planner overview: from household to results',
  description: 'A guided tour of the planner sections and the order to fill them in.',
  category: 'using-retiregolden',
  tags: ['planner', 'workflow', 'household', 'accounts', 'results', 'retiregolden'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'about-retiregolden',
    'what-retiregolden-models',
    'three-big-questions-spending-time-risk',
    'reading-the-results-page',
    'understanding-monte-carlo-success-rate',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/household',
    '/plan/:planId/accounts',
    '/plan/:planId/spending',
    '/plan/:planId/results',
    '/plan/:planId/report',
  ],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'The planner is organized as a loop: enter the household and money facts, read the result, then explore changes. You do not need every field perfect before the first run. You need the main facts good enough to learn what deserves attention.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Fill the Enter sections first: Household, Social Security, Accounts, Insurance, Income, Spending, Strategy, and Assumptions.',
        'Use Results as the baseline, then use Monte Carlo, Scenarios, Optimize, and Compare plans for exploration.',
        'Plans are stored on this device, so download a backup if you want a copy outside the browser.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'RetireGolden turns your inputs into a year-by-year projection. The left rail separates entry screens from exploration screens. Entry screens describe the plan. Exploration screens ask what the plan implies and how it changes under stress.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/planner-overview.webp' },
      caption:
        'The planner flows from household facts and account inputs into results, risk views, scenarios, and optimization.',
      alt: 'A left-to-right workflow shows household, income, accounts, spending, strategy, and assumptions feeding results, then branching to risk, scenarios, optimize, and report outputs.',
    },
    {
      type: 'table',
      caption: 'A practical first-pass order.',
      columns: ['Step', 'Section', 'What to get roughly right'],
      rows: [
        ['1', 'Household', 'People, filing status, state, retirement ages, and planning ages'],
        ['2', 'Social Security', 'Claim ages and benefit estimates'],
        ['3', 'Accounts', 'Balances, account types, owners, cost basis, and contributions'],
        ['4', 'Income and Spending', 'Non-portfolio income, base expenses, goals, healthcare, and debt'],
        ['5', 'Strategy and Assumptions', 'Withdrawal order, Roth conversion approach, inflation, returns, and tax assumptions'],
        ['6', 'Results and Explore screens', 'Whether the baseline works, which risks matter, and which choices to compare'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Avery household',
      assumptions: [
        { label: 'First pass', value: '$900,000 savings, $95,000 annual spending, rounded account details' },
        { label: 'First result', value: 'Money lasts in Results, but Monte Carlo shows 72% success' },
        { label: 'Next edit', value: 'Refines spending to $88,000 and adds taxable cost basis' },
      ],
      summary:
        'The rough plan is useful because it points to the two biggest inputs: spending and taxable basis. After the edits, the same household can see whether 72% success was a data problem or a real risk.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The KPI bar updates as the plan changes, and each plan is saved locally in the browser. The deterministic projection feeds Results, while Monte Carlo, Scenarios, and Optimize reuse the same plan data to answer different questions.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Starting with Optimize before the baseline inputs make sense.',
        'Leaving account types wrong and then trusting tax results.',
        'Comparing two plans that use different spending or return assumptions without noticing.',
        'Forgetting to save a downloaded backup before clearing browser data or changing devices.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use this overview when starting a new plan. After the first baseline, move between **Results**, **Monte Carlo**, **Scenarios**, and **Optimize** depending on whether you want to inspect, stress-test, compare, or search for a Roth conversion schedule.',
    },
  ],
}
