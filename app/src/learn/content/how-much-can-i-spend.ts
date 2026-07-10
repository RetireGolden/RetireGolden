/**
 * "How much can I spend?" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const howMuchCanISpendArticle: LearningArticle = {
  slug: 'how-much-can-i-spend',
  title: 'How much can I spend?',
  description: 'How RetireGolden finds the highest sustainable baseline spending level for a plan.',
  category: 'using-retiregolden',
  tags: ['sustainable spending', 'solver', 'spending slack', 'bequest target', 'scenarios'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-06',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'building-a-retirement-spending-budget',
    'spending-profiles-and-the-retirement-smile',
    'survivor-spending-in-couple-plans',
    'using-scenarios-to-compare-choices',
    'after-tax-estate',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/spending-solver',
    '/plan/:planId/spending',
    '/plan/:planId/optimize',
    '/plan/:planId/insights',
    '/plan/:planId/results',
    '/plan/:planId/scenarios',
  ],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'The "How much can I spend?" page turns a retirement plan around. Instead of asking whether your current spending works, it searches for the highest baseline spending level the exact projection ledger can sustain.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The answer is annual baseline spending in today\'s dollars.',
        'The solver reruns the same exact ledger used by Results: taxes, withdrawals, healthcare, Social Security, ACA, IRMAA, survivor years, and spending phases all count.',
        'A bequest target on the Spending screen becomes an estate floor the answer must preserve.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'RetireGolden tests spending levels by bisection. It tries a baseline spending amount, runs the full projection, and checks whether the portfolio ever depletes or the ending after-tax estate falls below the bequest target. Then it moves the test higher or lower until it finds the highest feasible level within the interactive simulation budget.',
    },
    {
      type: 'formula',
      expression: 'spending slack = max sustainable baseline spending - current baseline spending',
      basis: 'today',
      note: 'Positive slack means the solved level is above the current baseline. Negative slack means the current baseline is higher than the ledger can sustain under the same assumptions.',
    },
    {
      type: 'table',
      caption: 'What the solver does and does not move.',
      columns: ['Plan item', 'How the solver treats it', 'Why'],
      rows: [
        ['Baseline spending', 'Moves up or down', 'This is the question being solved'],
        ['Spending phases and survivor percentage', 'Kept and priced into every tested level', 'They shape the baseline spending path'],
        ['One-time goals', 'Kept as entered', 'A named goal should not become recurring spending'],
        ['Healthcare, debt, property, insurance, taxes', 'Kept and recalculated through the ledger', 'They affect feasibility but are not the spending answer'],
        ['Bequest target', 'Used as an ending estate floor', 'A spending level is not sustainable if it violates the floor'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Jordan household',
      assumptions: [
        { label: 'Current baseline', value: '$72,000 per year in today\'s dollars' },
        { label: 'Bequest target', value: '$250,000 in today\'s dollars' },
        { label: 'Solver answer', value: '$81,500 per year' },
        { label: 'Spending slack', value: '+$9,500 per year' },
      ],
      summary:
        'The answer means the exact ledger found a higher baseline that still avoids depletion and preserves the bequest floor. It does not mean every future path is risk-free.',
    },
    { type: 'heading', text: 'How to use the answer' },
    {
      type: 'prose',
      md: 'Use the answer as a planning boundary. If the solved amount is much higher than current spending, you may have room for a scenario with higher lifestyle spending, earlier retirement, gifts, or a larger bequest target. If it is lower than current spending, the plan needs attention before Roth conversions or other fine tuning matter.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the deterministic answer as a guarantee. Use Monte Carlo to test market variation.',
        'Forgetting that one-time goals stay fixed. A large goal can reduce sustainable baseline spending without showing up as part of the answer.',
        'Ignoring the binding constraint. A bequest target can be the limit even when the portfolio never depletes.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **How much can I spend?** from the Optimize rail. Use **Spending** to set the baseline, phases, survivor spending, and bequest target. Use **Add as scenario** to compare the solved spending level without changing the base plan.',
    },
  ],
}
