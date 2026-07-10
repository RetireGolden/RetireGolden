/**
 * "Historical returns vs random return models" - a Risk and Uncertainty P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const historicalVsRandomReturnModelsArticle: LearningArticle = {
  slug: 'historical-vs-random-return-models',
  title: 'Historical returns vs random return models',
  description: 'Two ways to generate possible futures and how they differ.',
  category: 'risk-uncertainty',
  tags: ['historical returns', 'random returns', 'monte carlo', 'market model', 'bootstrap'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.investor.gov/introduction-investing/investing-basics/glossary/monte-carlo-simulation',
    'https://www.investor.gov/introduction-investing/investing-basics/what-risk',
  ],
  relatedArticles: [
    'understanding-monte-carlo-success-rate',
    'what-monte-carlo-proves',
    'sequence-of-returns-risk',
    'inflation-risk',
    'how-assumptions-change-the-answer',
  ],
  relatedPlannerRoutes: ['/plan/:planId/monte-carlo', '/plan/:planId/assumptions', '/plan/:planId/scenarios'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A retirement projection needs some way to create possible future market paths. RetireGolden offers a random lognormal model and several historical models. The choice matters because each model preserves different kinds of risk.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A random model starts from assumptions about expected return, volatility, inflation, and correlation.',
        'A historical model resamples actual market years, so it can preserve some real-world patterns from the historical record.',
        'No market model is the truth. The goal is to see whether the plan only works under one narrow version of risk.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A lognormal model generates new return and inflation paths around your assumptions. A historical model starts from actual years in the embedded data set and resamples them. Historical independent years shuffle the deck one year at a time. Historical blocks keep short streaks together. Full-sequence replay starts in a random historical year and lets the historical order unfold.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/historical-vs-random-return-models.webp' },
      caption:
        'Random and historical models are two different machines for turning assumptions into retirement paths.',
      alt: 'One machine draws smooth random market paths from a bell-shaped source, while another shuffles cards of historical market years into retirement paths.',
    },
    {
      type: 'table',
      caption: 'How RetireGolden market models differ.',
      columns: ['Model', 'What it does', 'What to watch'],
      rows: [
        ['Lognormal', 'Draws each year around expected returns and inflation, with linked return and inflation shocks', 'Depends heavily on volatility and inflation assumptions'],
        ['Historical independent years', 'Samples historical years one at a time', 'Can break real-world streaks apart'],
        ['Historical 5-year blocks', 'Samples blocks so bad or good stretches can stay together', 'Still depends on the historical record available'],
        ['Historical full-sequence replay', 'Starts in a random historical year and replays the sequence from there', 'Can overemphasize the limited set of historical paths'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Chen household',
      assumptions: [
        { label: 'Lognormal result', value: '88% success when returns are sampled around the plan assumptions' },
        { label: 'Historical block result', value: '74% success when rough market clusters stay together' },
        { label: 'Difference', value: '14 percentage points of success rate' },
      ],
      summary:
        'The 14-point gap is the lesson. The plan is not simply good or bad; it is sensitive to whether bad market years arrive as isolated shocks or as a streak.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Monte Carlo** screen keeps your expected returns as the center of modeled returns. In lognormal mode, your inflation assumption is also the center of the inflation paths. In historical modes, inflation comes from the sampled historical years, so switching models can change both market variation and the inflation path source. If a strategy only looks good under one model, treat that as a reason to inspect the assumptions more closely.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Calling historical results "more accurate" just because they use real years.',
        'Calling random results "fake" even though all future paths are unknown.',
        'Changing equity weight or volatility and then blaming the entire difference on the strategy.',
        'Ignoring inflation behavior when comparing market models.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'On **Monte Carlo**, run the same plan under lognormal, historical independent years, historical blocks, and historical full-sequence replay. If the conclusion changes materially, use **Scenarios** to test ways to add cushion.',
    },
  ],
}
