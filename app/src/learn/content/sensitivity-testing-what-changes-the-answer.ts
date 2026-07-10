/**
 * "Sensitivity testing: what changes the answer most" - a Risk and Uncertainty P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const sensitivityTestingWhatChangesAnswerArticle: LearningArticle = {
  slug: 'sensitivity-testing-what-changes-the-answer',
  title: 'Sensitivity testing: what changes the answer most',
  description: 'Finding which assumptions move the outcome the most.',
  category: 'risk-uncertainty',
  tags: ['sensitivity', 'scenarios', 'assumptions', 'risk', 'comparison'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'how-assumptions-change-the-answer',
    'using-scenarios-to-compare-choices',
    'understanding-monte-carlo-success-rate',
    'inflation-risk',
    'historical-vs-random-return-models',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/scenarios',
    '/plan/:planId/assumptions',
    '/plan/:planId/results',
    '/plan/:planId/monte-carlo',
  ],
  currentYearSensitive: false,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Sensitivity testing asks a simple question: if one assumption changes, how much does the answer move? It is one of the fastest ways to find which parts of a plan deserve better data or a backup plan.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A sensitivity test changes one assumption while holding the rest of the plan steady.',
        'Rank tests by the size and seriousness of the change, not by which one is easiest to edit.',
        'Good sensitivity tests turn vague worry into a specific planning question.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A baseline projection can hide which assumptions are doing the heavy lifting. Sensitivity tests separate those levers. For example, lowering returns, raising inflation, extending planning age, or increasing spending may all weaken the plan, but one or two may explain most of the fragility.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/sensitivity-testing.webp' },
      caption:
        'Sensitivity testing compares one changed lever at a time against the same baseline.',
      alt: 'A baseline retirement path is compared with separate colored paths for lower returns, higher spending, higher inflation, and longer life.',
    },
    {
      type: 'table',
      caption: 'A practical sensitivity-testing sequence.',
      columns: ['Test', 'Change', 'Question it answers'],
      rows: [
        ['Spending', 'Raise or lower annual spending by a set percentage', 'How much lifestyle flexibility protects the plan?'],
        ['Retirement date', 'Move retirement one or two years', 'How valuable is more saving time and fewer withdrawal years?'],
        ['Return', 'Lower expected return or use a different market model', 'Is the plan dependent on optimistic growth?'],
        ['Inflation', 'Raise general or healthcare inflation', 'Does late-life purchasing power break?'],
        ['Longevity', 'Extend one or both planning ages', 'Does the plan survive a long life or survivor years?'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Morgan household',
      assumptions: [
        { label: 'Baseline', value: 'Money lasts through the full plan with a $180,000 estate' },
        { label: 'Largest sensitivity', value: 'A 12% spending increase causes depletion' },
        { label: 'Smaller sensitivity', value: 'A 1 point lower return reduces the estate to $95,000 but does not deplete' },
      ],
      summary:
        'Spending is the bigger lever here: one test depletes the plan, while the return test still leaves about **$95,000**. That points the first conversation toward spending flexibility.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Scenarios** page is built for sensitivity testing. Each scenario stores a small patch on top of the base plan, so you can keep editing the baseline without rebuilding every comparison. **Monte Carlo** then adds market variation around the same assumptions.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Testing only pleasant upside cases.',
        'Changing several inputs at once and calling it sensitivity testing.',
        'Ranking tests only by ending estate and missing depletion year or success rate.',
        'Ignoring whether the changed assumption is controllable by the household.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Scenarios** for named one-at-a-time tests, **Assumptions** for plan-wide levers, and **Monte Carlo** when you want the same scenario exposed to many market paths.',
    },
  ],
}
