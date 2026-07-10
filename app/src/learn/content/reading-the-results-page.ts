/**
 * "Reading the Results page" - a Using RetireGolden P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const readingResultsPageArticle: LearningArticle = {
  slug: 'reading-the-results-page',
  title: 'Reading the Results page',
  description: 'What each headline number and chart on the Results page means.',
  category: 'using-retiregolden',
  tags: ['results', 'projection', 'balances', 'cash flow', 'magi', 'csv'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'how-to-read-a-retirement-projection',
    'todays-dollars-vs-future-dollars',
    'understanding-monte-carlo-success-rate',
    'what-retiregolden-models',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/report'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'The Results page is the deterministic version of your plan: one path, using the assumptions you entered. It is the best place to understand the mechanics before you ask risk questions.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Use the **Today\'s $ / Nominal $** toggle before judging any dollar amount.',
        'Read the charts from top to bottom: balances, cash flow, taxes, then year-by-year details.',
        'If a plan depletes, the first shortfall year matters more than the final zero.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Results answers one question: "If these assumptions happen, how does the plan unfold?" The charts summarize the ledger, and the table lets you inspect each year.\n\nThis is different from Monte Carlo. Results does not test hundreds or thousands of market paths. It shows the clean baseline, which makes it easier to find which inputs and cash flows are moving the plan.',
    },
    {
      type: 'table',
      caption: 'What each Results section is trying to tell you.',
      columns: ['Section', 'What it shows', 'How to read it'],
      rows: [
        ['Dollar toggle', 'Today\'s dollars or nominal dollars', 'Use today\'s dollars for lifestyle comparisons; nominal dollars for ledger and tax-year mechanics.'],
        ['Investable balances', 'End-of-year account balances by type', 'Watch which buckets empty first and whether a depletion marker appears.'],
        ['Income vs spending', 'Income beside spending plus tax', 'The wider the gap, the more withdrawals must do.'],
        ['Tax and MAGI', 'Estimated tax and modified adjusted gross income', 'Look for spikes that may explain Roth conversion, healthcare, or Social Security tax effects.'],
        ['Year-by-year detail', 'The full annual ledger', 'Use it when a chart surprises you or you need the exact year something changes.'],
      ],
    },
    { type: 'heading', text: 'A worked reading pattern' },
    {
      type: 'scenario',
      name: 'The Chen household',
      assumptions: [
        { label: 'Baseline result', value: 'Money lasts through age 95' },
        { label: 'Chart surprise', value: 'Traditional IRA falls from $700,000 to $420,000 in the early 70s' },
        { label: 'Detail table clue', value: '$45,000 conversions and RMDs are both active in the same years' },
      ],
      summary:
        'The headline says the plan lasts. The table explains why the IRA falls: conversions and RMDs are moving about **$45,000+** per year out of the pre-tax bucket.',
    },
    { type: 'heading', text: 'The year-by-year table' },
    {
      type: 'prose',
      md: 'The table is the audit trail. It includes income, expenses, required minimum distributions, Roth conversions, withdrawals, tax, MAGI, shortfall, investable assets, and net worth. You do not need to read every row every time. Start with the first year that looks unusual.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'A blank shortfall cell is good news for that year. It means the modeled accounts covered the plan\'s cash needs for that year.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Comparing a today\'s-dollar chart to a nominal-dollar account statement.',
        'Assuming a higher ending balance is always better without checking taxes, risk, or survivor years.',
        'Ignoring MAGI because it looks like a tax detail. MAGI can also affect Medicare and ACA modeling in other parts of the plan.',
        'Assuming the CSV follows the dollar toggle. The export uses the nominal year-by-year ledger, even when the screen is showing today\'s dollars.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Results** after every meaningful input change. Use **View printable report** when you want a clean summary, and **Download CSV** when you want to inspect or archive the nominal annual ledger outside the app.',
    },
  ],
}
