/**
 * "Troubleshooting surprising results" - a Using RetireGolden P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const troubleshootingSurprisingResultsArticle: LearningArticle = {
  slug: 'troubleshooting-surprising-results',
  title: 'Troubleshooting surprising results',
  description: 'Common reasons a projection looks wrong and how to track it down.',
  category: 'using-retiregolden',
  tags: ['troubleshooting', 'results', 'inputs', 'projection', 'retiregolden'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'reading-the-results-page',
    'how-assumptions-change-the-answer',
    'using-assumptions-and-provenance',
    'reports-csv-exports-and-sharing',
    'what-retiregolden-models',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/results',
    '/plan/:planId/assumptions',
    '/plan/:planId/accounts',
    '/plan/:planId/strategy',
    '/plan/:planId/report',
  ],
  currentYearSensitive: false,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'A surprising result is usually a clue, not a verdict. The fastest fix is to trace the result back through the ledger: inputs, assumptions, taxes, withdrawals, and warnings.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Start with modeling notes and the first surprising year, not the final estate number.',
        'Check account types, owners, cost basis, retirement ages, and spending before tuning strategy.',
        'Use the CSV when the screen summary is not enough to explain the annual ledger.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Projection errors often come from a small input with a large ripple: an account marked traditional instead of Roth, a retirement age that starts wages too early or too late, a missing cost basis, an aggressive inflation assumption, or a strategy that creates MAGI pressure. Troubleshooting works best when you find the first year the output looks strange.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/troubleshooting-surprising-results.webp' },
      caption:
        'Follow the first surprising year back to the inputs, assumptions, and rules that created it.',
      alt: 'A magnifying glass inspects a retirement ledger, tracing a highlighted year back to account, tax, spending, and assumption controls.',
    },
    {
      type: 'table',
      caption: 'Common symptoms and first checks.',
      columns: ['Symptom', 'First check', 'Likely screen'],
      rows: [
        ['Portfolio depletes earlier than expected', 'Spending, retirement age, one-time goals, and return assumptions', 'Spending, Household, Assumptions'],
        ['Taxes spike in one year', 'Roth conversions, RMDs, capital gains, or one-time income', 'Strategy, Results'],
        ['MAGI looks too high', 'Conversions, taxable gains, Social Security taxation, and recent MAGI seed', 'Results, Assumptions'],
        ['Healthcare costs jump', 'Age 65 transition, ACA credit setting, IRMAA lookback, healthcare inflation', 'Spending, Assumptions, Results'],
        ['A report or CSV does not match the screen view', 'Nominal vs today-dollar display', 'Results, Report'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Adams household',
      assumptions: [
        { label: 'Surprise', value: 'Taxes jump sharply at age 73' },
        { label: 'First ledger clue', value: '$48,000 RMD begins in the same year' },
        { label: 'Next checks', value: '$600,000 traditional balance, conversion strategy, QCD setting, and filing status' },
      ],
      summary:
        'The tax spike is no longer mysterious once the table shows a **$48,000** RMD. The next step is checking why the traditional balance stayed that high.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Results** page combines charts, modeling notes, and a year-by-year table. The **Download CSV** button gives the nominal ledger for deeper inspection. The **Report** route gives a printable summary of inputs, assumptions, headline results, warnings, and the appendix.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Fixing the strategy before checking whether the inputs are wrong.',
        'Reading today-dollar screen values beside nominal CSV values without noticing the basis.',
        'Ignoring model warnings because the headline number looks fine.',
        'Comparing two plans that use different assumptions and treating the strategy as the only change.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Start in **Results**, find the first surprising year, and then move to the screen that owns the line item: **Accounts**, **Spending**, **Strategy**, **Assumptions**, or **Social Security**. Export the CSV when you need to audit the row outside the app.',
    },
  ],
}
