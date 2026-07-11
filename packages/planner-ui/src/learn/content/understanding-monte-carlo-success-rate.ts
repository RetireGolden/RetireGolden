/**
 * "Understanding Monte Carlo success rate" - a Using RetireGolden P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const understandingMonteCarloArticle: LearningArticle = {
  slug: 'understanding-monte-carlo-success-rate',
  title: 'Understanding Monte Carlo success rate',
  description: 'How to read the success-rate number without over-trusting it.',
  category: 'using-retiregolden',
  tags: ['monte carlo', 'success rate', 'simulation', 'risk', 'sequence risk'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.investor.gov/introduction-investing/investing-basics/glossary/monte-carlo-simulation'],
  relatedArticles: [
    'how-to-read-a-retirement-projection',
    'reading-the-results-page',
    'what-monte-carlo-proves',
    'sequence-of-returns-risk',
    'why-95-percent-is-not-a-guarantee',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/monte-carlo',
    '/plan/:planId/results',
    '/plan/:planId/scenarios',
    '/plan/:planId/optimize',
  ],
  currentYearSensitive: false,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'A Monte Carlo success rate is a model statistic. It tells you how often the plan survived across many simulated market paths. It does not tell you the exact probability that your real life will work out.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Success means investable assets did not run out before the end of the modeled plan.',
        'A higher success rate usually means more cushion, but the inputs and model choice matter.',
        'Use Monte Carlo to compare risk between choices, not to declare that a plan is guaranteed.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The deterministic Results page uses one return and inflation path. Monte Carlo runs the same plan many times with different market paths. Some paths are friendly. Some are rough. The success rate is the share of paths where the plan makes it through.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/monte-carlo-paths.webp' },
      caption:
        'Monte Carlo starts from one plan and explores many possible paths; some reach the end comfortably and some fall short.',
      alt: 'Many teal and green paths flow from one plan bucket toward a finish area, while a few amber and coral paths fade or dip before the end of the timeline.',
    },
    {
      type: 'formula',
      expression: 'success rate = successful paths / total paths',
      where: [
        { symbol: 'successful paths', meaning: 'simulated futures where investable assets never deplete before the plan ends' },
        { symbol: 'total paths', meaning: 'the number of simulated market paths RetireGolden ran' },
      ],
      note: 'RetireGolden runs 1,000 paths automatically and can run 10,000 paths on demand for a tighter estimate.',
    },
    { type: 'heading', text: 'What the number means' },
    {
      type: 'table',
      caption: 'A plain-language way to read success rates.',
      columns: ['Result', 'What it says', 'What to do next'],
      rows: [
        ['90%+', 'The plan survived in nearly all modeled paths.', 'Check whether the assumptions are realistic and whether the remaining risk is acceptable.'],
        ['75%-89%', 'The plan often works, but bad markets can matter.', 'Look at depletion years, spending flexibility, and timing choices.'],
        ['Below 75%', 'Many modeled paths run out of investable assets.', 'Use Scenarios to test spending, retirement date, income timing, or risk changes.'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Garcia household',
      assumptions: [
        { label: 'Baseline deterministic result', value: 'Money lasts through the full plan' },
        { label: 'Monte Carlo result', value: '78% success over 1,000 paths' },
        { label: 'Key clue', value: 'About 220 paths deplete, usually in the first decade after retirement' },
      ],
      summary:
        'A 78% success rate means roughly **220 out of 1,000** tested paths fail. Because failures cluster early, the Garcias should test spending flexibility, later retirement, or a different claim/investment mix.',
    },
    { type: 'heading', text: 'Model controls change the question' },
    {
      type: 'list',
      items: [
        '**Lognormal** paths vary around your expected return and inflation assumptions.',
        '**Historical** paths resample market history in different ways, which can preserve more real-world clustering.',
        '**Seed** changes the random draw. If one seed changes the conclusion a lot, run more paths or test scenarios.',
        '**Model longevity** and **LTC shock** add life-span and long-term-care uncertainty when you want a wider stress test.',
      ],
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Reading 95% as "I am safe." It means 95% of modeled paths worked under the assumptions used.',
        'Treating a one-point difference as meaningful when only 1,000 paths were run.',
        'Ignoring the depletion-year chart. A 78% success rate with failures at age 93 feels different from failures at age 72.',
        'Comparing two strategies with different assumptions and calling the success-rate change a strategy effect.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Monte Carlo** after the Results page makes sense. Use **Scenarios** or **Optimize** when you want to compare choices, then come back to Monte Carlo to see whether the better-looking choice also holds up under market variation.',
    },
  ],
}
