/**
 * "Trust fund haircut scenarios" - a Social Security P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const trustFundHaircutScenariosArticle: LearningArticle = {
  slug: 'trust-fund-haircut-scenarios',
  title: 'Trust fund haircut scenarios',
  description: 'How to model a possible future reduction in scheduled benefits.',
  category: 'social-security',
  tags: ['social security', 'trust fund', 'haircut', 'scenario', 'stress test'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.ssa.gov/OACT/TR/'],
  relatedArticles: [
    'cola-and-inflation-protection',
    'social-security-claiming-age-basics',
    'using-scenarios-to-compare-choices',
    'how-assumptions-change-the-answer',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/assumptions',
    '/plan/:planId/scenarios',
    '/plan/:planId/social-security',
    '/plan/:planId/results',
  ],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A Social Security trust fund haircut scenario asks a practical question: what if scheduled benefits were reduced in a future year? It is a stress test, not a prediction of what Congress or SSA will do.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Scheduled benefits and payable benefits can be different policy questions.',
        'A haircut scenario reduces modeled Social Security benefits starting in a chosen year.',
        'The point is to test dependency on Social Security, not to forecast the exact law.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Social Security is not a personal account with your name on a trust-fund balance. It is a national program funded by taxes, trust funds, and law. Trustees reports discuss program finances and projected shortfalls, but the final outcome depends on future policy choices.\n\nFor planning, the useful move is to separate opinion from resilience. You can run the plan once using scheduled benefits, then run a second version with a future benefit reduction. If both plans work, the household is less exposed to Social Security policy risk. If the haircut plan fails, the result tells you where the plan depends on benefits most.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/trust-fund-haircut-scenarios.webp' },
      caption:
        'A trust fund haircut scenario draws a future boundary, then tests whether the plan can absorb a reduced Social Security stream after that point.',
      alt: 'A Social Security income ribbon crosses a timeline and becomes narrower after a warning boundary, while portfolio and spending buckets show the plan absorbing the change.',
    },
    {
      type: 'table',
      caption: 'How to use a haircut scenario without overclaiming precision.',
      columns: ['Question', 'Good use', 'Weak use'],
      rows: [
        ['How dependent is the plan?', 'Compare scheduled benefits with a reduced-benefit scenario', 'Assume the exact cut and year are known'],
        ['Which years are fragile?', 'Look for depletion or tax changes after the cut year', 'Focus only on the first year of retirement'],
        ['What can I change?', 'Test spending, retirement age, saving, or claiming alternatives', 'Treat the scenario as a personal recommendation'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Base case', value: '$50,000 a year of scheduled Social Security benefits' },
        { label: 'Stress case', value: '23% reduction starting in a future year' },
        { label: 'Income gap', value: 'Benefits fall by about $11,500 a year after the haircut starts' },
      ],
      summary:
        'The haircut scenario does not predict a cut. It asks whether the Patels could absorb an **$11,500** annual income gap with spending flexibility, later work, or portfolio withdrawals.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden has an optional Social Security haircut assumption. You choose a start year and a cut percentage. The projection applies that reduction to modeled Social Security benefits from that year forward, including benefits used in Results and scenario comparisons.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Reading one scenario as a forecast instead of a stress test.',
        'Only testing the headline cut and ignoring the year it starts.',
        'Forgetting that a benefit cut can change taxes, withdrawals, and estate value.',
        'Assuming the correct response is always to claim early. The full plan still matters.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Assumptions** to turn on a Social Security haircut, or use **Scenarios** to create a side-by-side case. Then inspect **Results** for spending coverage, taxes, withdrawals, and ending estate.',
    },
  ],
}
