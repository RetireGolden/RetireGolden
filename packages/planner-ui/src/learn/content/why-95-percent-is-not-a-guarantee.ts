/**
 * "Why a 95% success rate is not a guarantee" - a Risk and Uncertainty P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const why95PercentIsNotGuaranteeArticle: LearningArticle = {
  slug: 'why-95-percent-is-not-a-guarantee',
  title: 'Why a 95% success rate is not a guarantee',
  description: 'What the remaining percentage really represents.',
  category: 'risk-uncertainty',
  tags: ['monte carlo', 'success rate', 'risk', 'uncertainty', 'model risk'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.investor.gov/introduction-investing/investing-basics/glossary/monte-carlo-simulation'],
  relatedArticles: [
    'understanding-monte-carlo-success-rate',
    'what-monte-carlo-proves',
    'sequence-of-returns-risk',
    'historical-vs-random-return-models',
    'sensitivity-testing-what-changes-the-answer',
  ],
  relatedPlannerRoutes: ['/plan/:planId/monte-carlo', '/plan/:planId/results', '/plan/:planId/scenarios'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A 95% Monte Carlo success rate is encouraging, but it is not a promise. It means the plan avoided depletion in 95% of the modeled paths using the assumptions and market model you selected.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The percentage is about modeled paths, not all possible futures.',
        'The missing 5% still matters because those paths may fail early or fail late for different reasons.',
        'A high success rate should be paired with judgment about flexibility, spending cuts, insurance, and model limits.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Monte Carlo is a structured stress test. It runs the same plan through many possible market paths, then counts how often investable assets stay above zero through the planning horizon. The number is useful because it summarizes many paths. It is incomplete because real life can include rules, behavior, inflation, care needs, and market regimes that the model did not draw.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/why-95-not-guarantee.webp' },
      caption:
        'A high success rate means most modeled paths worked, while the failed paths still deserve inspection.',
      alt: 'Many illustrated market paths reach the end of a retirement timeline while a small group drops below the finish line.',
    },
    {
      type: 'table',
      caption: 'What the success rate does and does not say.',
      columns: ['It can tell you', 'It cannot tell you by itself'],
      rows: [
        ['How often the modeled paths avoided depletion', 'Whether the model captured every real-world risk'],
        ['Whether one strategy is usually more resilient than another', 'Whether a tiny difference is meaningful without more paths'],
        ['How weak paths behave under selected assumptions', 'Whether future tax law, spending behavior, or healthcare shocks will match the model'],
        ['Whether market timing risk is material', 'Whether the plan feels acceptable to the household'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Bennett household',
      assumptions: [
        { label: 'Monte Carlo', value: '95% success across 1,000 paths' },
        { label: 'Weak paths', value: 'About 50 paths still fail after a long-term-care shock and poor early markets' },
        { label: 'Planning response', value: 'Keep the strategy, but add a spending-cut scenario and review insurance' },
      ],
      summary:
        'A 95% result is strong, but it still leaves about **50** failed paths out of 1,000. The failed paths explain what backup moves the household should be ready to use.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Monte Carlo** page shows the success rate, the range of outcomes, ending-balance distributions, and depletion timing. The point is not to chase 100%. The point is to understand whether the plan has enough margin for the risks you care about.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Reading 95% as a guarantee instead of a modeled frequency.',
        'Comparing two strategies that differ by one percentage point using only 1,000 paths.',
        'Ignoring whether failures happen early, late, or only in extreme assumptions.',
        'Treating the model as more certain than the assumptions feeding it.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Monte Carlo** to inspect the weak paths, then use **Scenarios** to test practical responses such as retiring later, spending less, changing returns, or adding a care shock.',
    },
  ],
}
