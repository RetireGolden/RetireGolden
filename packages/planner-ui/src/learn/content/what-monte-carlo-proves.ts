/**
 * "What Monte Carlo does and does not prove" - a Risk and Uncertainty P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const whatMonteCarloProvesArticle: LearningArticle = {
  slug: 'what-monte-carlo-proves',
  title: 'What Monte Carlo does and does not prove',
  description: 'How to read a success rate as a model statistic, not a promise.',
  category: 'risk-uncertainty',
  tags: ['monte carlo', 'success rate', 'simulation', 'model risk', 'forecasting'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.investor.gov/introduction-investing/investing-basics/glossary/monte-carlo-simulation'],
  relatedArticles: [
    'understanding-monte-carlo-success-rate',
    'why-95-percent-is-not-a-guarantee',
    'sequence-of-returns-risk',
    'historical-vs-random-return-models',
    'how-to-read-a-retirement-projection',
  ],
  relatedPlannerRoutes: ['/plan/:planId/monte-carlo', '/plan/:planId/scenarios', '/plan/:planId/optimize'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Monte Carlo is a way to ask, "How often does this plan survive under many modeled futures?" It can expose fragility that a single projection hides. It does not prove what will happen in real life.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Monte Carlo proves how the plan behaves inside a chosen model, not how the real world must behave.',
        'The result is only as good as the inputs, account modeling, tax rules, and market model behind it.',
        'Use Monte Carlo to compare choices and identify weak spots, then decide what margin of safety feels appropriate.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A deterministic projection is one path. Monte Carlo runs many paths. In RetireGolden, each path uses the same household, accounts, tax logic, withdrawal strategy, and expenses, but varies market returns and inflation according to the selected market model. The success rate is the share of paths where investable assets do not deplete before the plan ends.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/monte-carlo-does-not-prove.webp' },
      caption:
        'Monte Carlo explores many modeled futures; it does not draw a boundary around every real future.',
      alt: 'Many modeled retirement paths fan across a planning map while a dotted outer region shows unknown real-world outcomes beyond the model.',
    },
    {
      type: 'table',
      caption: 'A useful split between proves and does not prove.',
      columns: ['Monte Carlo can show', 'Monte Carlo cannot prove'],
      rows: [
        ['How often the plan works under the selected model', 'The exact probability your real life will succeed'],
        ['Which years tend to fail in modeled bad paths', 'Which market year will happen next'],
        ['Whether one strategy appears more resilient than another under shared assumptions', 'That the strategy is guaranteed or personally optimal'],
        ['How sensitive the plan is to volatility, inflation, and longevity settings', 'That the assumptions are correct'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Rivera household',
      assumptions: [
        { label: 'Baseline', value: '92% success with lognormal markets' },
        { label: 'Historical block model', value: '86% success with more clustered bad years' },
        { label: 'Difference', value: '6 percentage points between two reasonable market lenses' },
      ],
      summary:
        'Neither 92% nor 86% is the true future probability. The useful fact is the **6-point** drop when bad years cluster, which tells the Riveras how much cushion to keep discussing.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets you switch market models, re-roll the seed, run more paths, and optionally model longevity and long-term-care shocks. Those controls do not make the future knowable. They help you ask clearer questions about which risks the plan can absorb.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating 95% as a promise instead of a model statistic.',
        'Comparing two plans after changing both the strategy and the assumptions.',
        'Ignoring whether failures happen early or late.',
        'Using Monte Carlo before the base inputs are accurate enough to trust.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Monte Carlo** to stress-test the plan after **Results** makes sense. Use **Scenarios** or **Optimize** to compare choices, then return to Monte Carlo with the same assumptions to see whether the better-looking choice is also more resilient.',
    },
  ],
}
