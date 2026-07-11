/**
 * "Using Scenarios to compare choices" - a Using RetireGolden P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const usingScenariosToCompareChoicesArticle: LearningArticle = {
  slug: 'using-scenarios-to-compare-choices',
  title: 'Using Scenarios to compare choices',
  description: 'How to stress-test and compare plan variations side by side.',
  category: 'using-retiregolden',
  tags: ['scenarios', 'what if', 'comparison', 'stress test', 'monte carlo'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'planner-overview',
    'how-assumptions-change-the-answer',
    'three-big-questions-spending-time-risk',
    'understanding-monte-carlo-success-rate',
    'sequence-of-returns-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/scenarios', '/plan/:planId/results', '/plan/:planId/monte-carlo'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Scenarios help you compare one decision at a time without losing the base plan. A scenario is a set of overrides layered on top of the current plan: retire earlier, spend more, skip Roth conversions, model a Social Security cut, or add a care shock.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Use scenarios when the question starts with "what if?"',
        'A good scenario changes only the few inputs needed to test the question.',
        'The Scenarios table compares ending estate, lifetime tax, depletion year, changed fields, and optional Monte Carlo success with shared markets.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The base plan remains the source of truth. Each scenario stores a patch, and RetireGolden merges that patch over the base plan for comparison. If the scenario is invalid, the table shows an error instead of silently simulating a broken plan.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/scenarios-compare-choices.webp' },
      caption:
        'Scenarios keep the base plan intact while testing alternate choices side by side.',
      alt: 'A base retirement plan branches into several side-by-side paths for earlier retirement, higher spending, lower returns, and care costs, then returns to a comparison table.',
    },
    {
      type: 'table',
      caption: 'When to use Scenarios instead of editing the base plan directly.',
      columns: ['Question', 'Scenario idea', 'What to compare'],
      rows: [
        ['Can I retire sooner?', 'Retire earlier or later', 'Depletion year, estate, taxes, and success rate'],
        ['What if I spend more?', 'Spend more or less', 'How quickly the margin disappears'],
        ['What if Social Security is cut?', 'Benefit haircut from a future year', 'Whether portfolio withdrawals fill the gap'],
        ['Do Roth conversions help?', 'Skip conversions or compare a different strategy', 'Lifetime tax, estate, and Monte Carlo risk'],
        ['What if care costs hit?', 'Add long-term-care shock years', 'Whether assets survive a concentrated expense'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Kim household',
      assumptions: [
        { label: 'Base plan', value: 'Retire at 65, spend $90,000 per year' },
        { label: 'Scenario A', value: 'Retire two years earlier and reduce ending estate by $140,000' },
        { label: 'Scenario B', value: 'Retire at 65 but spend 15% more, reducing success from 88% to 73%' },
      ],
      summary:
        'The early-retirement scenario mostly costs estate value. The higher-spending scenario damages risk more, dropping success by **15 percentage points** in this example.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The Scenarios screen can include a 200-path Monte Carlo success rate for each row, using the same seed so every scenario faces the same market paths. That makes comparisons cleaner than re-running separate plans with unrelated random draws.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Changing the base plan and the scenario at the same time.',
        'Packing too many changes into one scenario and then not knowing what caused the result.',
        'Comparing estate value without checking whether one path depletes earlier.',
        'Treating the 200-path scenario success rate as a final Monte Carlo answer; use the full Monte Carlo screen for a deeper run.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Scenarios** after the base plan is credible in **Results**. If a scenario looks promising, either edit the base plan intentionally or duplicate the plan for a larger comparison.',
    },
  ],
}
