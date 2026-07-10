/**
 * "Sequence-of-returns risk" - a Risk and Uncertainty P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const sequenceOfReturnsRiskArticle: LearningArticle = {
  slug: 'sequence-of-returns-risk',
  title: 'Sequence-of-returns risk',
  description: 'Why the order of good and bad years matters once you withdraw.',
  category: 'risk-uncertainty',
  tags: ['sequence risk', 'returns', 'withdrawals', 'monte carlo', 'retirement risk'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.investor.gov/introduction-investing/investing-basics/what-risk'],
  relatedArticles: [
    'understanding-monte-carlo-success-rate',
    'what-monte-carlo-proves',
    'withdrawal-order-basics',
    'historical-vs-random-return-models',
    'inflation-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/monte-carlo', '/plan/:planId/results', '/plan/:planId/scenarios'],
  currentYearSensitive: false,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'Sequence-of-returns risk is the risk that bad market years arrive at the wrong time. The average return can look fine, but the order of returns can still decide whether withdrawals recover or permanently damage the portfolio.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Before retirement, bad early returns can be helped by later contributions.',
        'After retirement, bad early returns combine with withdrawals, so fewer dollars remain to recover.',
        'Monte Carlo and scenarios are useful because the deterministic result shows only one return order.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Imagine two retirements with the same average return. In one, the good years arrive first. In the other, the bad years arrive first. The average may match, but the lived result can be very different because withdrawals are happening along the way. Selling investments after a decline leaves fewer shares available for the rebound.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/sequence-returns-risk.webp' },
      caption:
        'Two paths can have the same average return, but early losses during withdrawals can leave a lasting gap.',
      alt: 'Two retirement balance paths start together. One rises before dipping, while the other dips early during withdrawals and never fully catches up.',
    },
    {
      type: 'table',
      caption: 'Why the same average can feel different.',
      columns: ['Timing', 'During saving', 'During withdrawals'],
      rows: [
        ['Bad returns early', 'New contributions may buy lower prices', 'Withdrawals sell more shares at lower values'],
        ['Good returns early', 'Helpful, but still followed by later risk', 'Builds cushion before withdrawals stress the portfolio'],
        ['Bad returns late', 'Portfolio may have more years to recover first', 'Often less damaging if the plan already built cushion'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Adams household',
      assumptions: [
        { label: 'Plan A', value: '+8% average in the first decade, -1% average in the second' },
        { label: 'Plan B', value: '-1% average in the first decade, +8% average in the second' },
        { label: 'Withdrawal need', value: '$60,000 a year from the portfolio in both examples' },
      ],
      summary:
        'Both paths can have a similar long-run average, but Plan B sells investments during the weak first decade. The rebound applies to a smaller balance after years of $60,000 withdrawals.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Results** page is deterministic: it uses the expected return and inflation path. The **Monte Carlo** page keeps the same annual ledger but varies market paths, so sequence risk shows up as a fan of outcomes and as depletion-year counts. The **Scenarios** page lets you pair that risk view with spending, claiming, and strategy changes.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Looking only at the average return assumption.',
        'Assuming a high long-run return eliminates early-retirement risk.',
        'Ignoring the years when failures happen; early failures usually call for a different response than late failures.',
        'Comparing strategies under different assumptions instead of holding the assumptions constant.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Monte Carlo** after the baseline plan works in Results. Look at the success rate, percentile fan, and depletion-year chart together. If weak paths fail early, test spending flexibility, later retirement, bridge income, or a different withdrawal strategy.',
    },
  ],
}
