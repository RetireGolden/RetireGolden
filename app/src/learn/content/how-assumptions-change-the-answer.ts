/**
 * "How assumptions change the answer" - a Start Here P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const howAssumptionsChangeAnswerArticle: LearningArticle = {
  slug: 'how-assumptions-change-the-answer',
  title: 'How assumptions change the answer',
  description: 'How small changes to returns, inflation, spending, and longevity move the result.',
  category: 'start-here',
  tags: ['assumptions', 'sensitivity', 'inflation', 'returns', 'planning basics'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'three-big-questions-spending-time-risk',
    'using-assumptions-and-provenance',
    'sensitivity-testing-what-changes-the-answer',
    'inflation-risk',
    'longevity-risk',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/assumptions',
    '/plan/:planId/spending',
    '/plan/:planId/results',
    '/plan/:planId/scenarios',
    '/plan/:planId/monte-carlo',
  ],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A retirement projection can feel precise because the output has exact dollars and exact years. The precision is useful, but the answer is still built from assumptions. When an assumption changes, the projection is answering a different question.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Assumptions are levers, not background decoration.',
        'The most important tests usually change spending, retirement age, return, inflation, and planning age.',
        'Change one lever at a time when you want to learn what actually moved the result.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A plan has two kinds of inputs: facts you can know now and assumptions about the future. Current balances, birth dates, and account types are facts. Future returns, inflation, healthcare inflation, lifespan, tax law, and spending behavior are assumptions. A projection is strongest when you know which inputs are facts, which are estimates, and which are stress tests.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/assumptions-change-answer.webp' },
      caption:
        'Changing one major assumption at a time makes it easier to see which lever is driving the result.',
      alt: 'An illustrated control panel with separate sliders for spending, inflation, return, and time feeding a retirement path.',
    },
    {
      type: 'table',
      caption: 'Common assumptions and how they tend to move the plan.',
      columns: ['Assumption', 'What it changes', 'What to inspect'],
      rows: [
        ['Spending', 'The annual amount the portfolio must support', 'Shortfalls, depletion year, and withdrawal size'],
        ['Retirement age', 'Years of saving and years of withdrawals', 'Account balances at retirement and Social Security timing'],
        ['Return', 'Growth before and during retirement', 'Ending estate and Monte Carlo success rate'],
        ['Inflation', 'Future cost of the same lifestyle', 'Today-dollar results and late-life spending pressure'],
        ['Planning age', 'How long the plan must keep working', 'Late-life balances and survivor years'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Kim household',
      assumptions: [
        { label: 'Baseline', value: 'Retire at 65, spend $92,000 per year, plan through age 95' },
        { label: 'First test', value: 'Raise spending by 10%' },
        { label: 'Second test', value: 'Keep spending unchanged, but lower the default return by 1 point' },
      ],
      summary:
        'If both tests weaken the plan, they should not be mixed together at first. Separate tests show whether the problem is lifestyle cost, return sensitivity, or both.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets you use **Assumptions** for the plan-wide levers, **Spending** for lifestyle costs, **Scenarios** for named what-if changes, and **Monte Carlo** for market paths around the same plan. The deterministic Results page tells you what happens under one assumption set. Scenarios and Monte Carlo tell you how fragile that answer is.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Changing several assumptions at once and then not knowing which one mattered.',
        'Using optimistic returns to compensate for spending that may be too high.',
        'Looking only at the ending estate and missing a shortfall in an earlier year.',
        'Treating planning age as a prediction instead of a resilience test.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Start in **Assumptions** and **Spending**, read the baseline in **Results**, then make one named change in **Scenarios**. If the scenario changes the result a lot, it has earned more attention.',
    },
  ],
}
