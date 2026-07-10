/**
 * "Reading the Social Security analysis page" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const readingSocialSecurityAnalysisPageArticle: LearningArticle = {
  slug: 'reading-the-social-security-analysis-page',
  title: 'Reading the Social Security analysis page',
  description: 'How to interpret break-even and whole-plan claiming results.',
  category: 'using-retiregolden',
  tags: ['retiregolden', 'social security', 'claiming age', 'break-even', 'survivor benefits'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'rule-change',
  sourceUrls: [
    'https://www.ssa.gov/benefits/retirement/planner/agereduction.html',
    'https://www.ssa.gov/benefits/survivors/',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'break-even-useful-lens',
    'spousal-and-survivor-benefits',
    'planning-for-couples-and-survivor-years',
    'widows-penalty-and-survivor-brackets',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/social-security-analysis',
    '/plan/:planId/social-security',
    '/plan/:planId/results',
    '/plan/:planId/monte-carlo',
  ],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'The Social Security analysis page is not one calculator. It gives you three lenses on the same claiming decision: the whole retirement plan, the benefits-only insurance value, and the simple break-even chart.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        '**In your plan** ranks claim ages by after-tax estate after rerunning the full projection.',
        '**Benefits only** isolates Social Security value from the rest of the portfolio.',
        '**Break-even** is educational, but it ignores taxes, portfolio withdrawals, spousal benefits, and survivor value.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Claiming age is both a cash-flow choice and an insurance choice. Claiming early can bring money sooner. Waiting can raise the monthly check and, for a couple, may raise the survivor check. The best choice depends on the rest of the plan, not only the total Social Security dollars.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/social-security-analysis-page.webp' },
      caption:
        'The page compares claiming choices through whole-plan, benefits-only, and break-even lenses.',
      alt: 'Three illustrated panels compare a household plan ledger, a Social Security benefit stream, and crossing break-even lines.',
    },
    {
      type: 'table',
      caption: 'How to read the three tabs.',
      columns: ['Tab', 'What it answers', 'Best use'],
      rows: [
        ['In your plan', 'Which claim-age combination leaves the strongest after-tax plan result', 'Primary decision lens for RetireGolden users'],
        ['Benefits only', 'Which strategy has higher Social Security value before the rest of the portfolio', 'Insurance and longevity context'],
        ['Break-even', 'When cumulative benefits from one claim age catch up to another', 'Simple teaching lens, not the full decision'],
        ['Robustness check', 'Whether top whole-plan choices still work across sampled markets', 'Tie-breaker when top choices are close'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Chen household',
      assumptions: [
        { label: 'Break-even lens', value: 'Claiming at 62 improves near-term cash flow by about $20,000 a year' },
        { label: 'Whole-plan lens', value: 'Delaying the higher benefit raises the survivor floor by about $700 a month' },
        { label: 'Robustness check', value: 'Top strategies have similar estate values, but 82% vs 87% Monte Carlo success' },
      ],
      summary:
        'The simple break-even answer favors near-term cash. The whole-plan view shows the cost of that choice: about **$700** less survivor income and a lower risk score in this example.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **In your plan** tab includes taxes, withdrawals, Roth conversions, IRMAA, ACA, RMDs, and ending after-tax estate. For couples, the heatmap helps show how one spouse\'s age and the other spouse\'s age interact. The page can also refine a whole-year choice to the month.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating break-even as the final answer.',
        'Ignoring survivor benefit protection for the lower-income spouse.',
        'Applying a strategy before checking whether the plan inputs are credible.',
        'Overreacting to a tiny ranking difference when several claim ages are effectively close.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Enter benefits and claim ages on **Social Security**, then use **Social Security analysis** to sweep claim-age choices. After applying a choice, return to **Results** and **Monte Carlo** to confirm the broader plan still behaves as expected.',
    },
  ],
}
