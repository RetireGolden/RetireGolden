/**
 * "Break-even: useful lens, incomplete answer" - a Social Security P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const breakEvenUsefulLensArticle: LearningArticle = {
  slug: 'break-even-useful-lens',
  title: 'Break-even: useful lens, incomplete answer',
  description: 'Why break-even age helps but should not decide the claim alone.',
  category: 'social-security',
  tags: ['social security', 'break-even', 'claiming age', 'cumulative benefits', 'longevity'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.ssa.gov/benefits/retirement/planner/agereduction.html',
    'https://www.ssa.gov/benefits/retirement/planner/delayret.html',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'spousal-and-survivor-benefits',
    'understanding-monte-carlo-success-rate',
    'planning-for-couples-and-survivor-years',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security-analysis'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'A break-even age is the age when a later Social Security claim catches up to an earlier claim in cumulative dollars. It is a helpful picture, but it is not the whole claiming decision.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Break-even compares cumulative benefit dollars for different claim ages.',
        'The answer changes when you assume cost-of-living adjustments or investment growth on checks already received.',
        'Break-even usually ignores taxes, portfolio withdrawals, survivor benefits, and risk.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'An early claim has a head start because checks begin sooner. A later claim has a larger monthly check. The break-even question asks when the larger later checks make up for the missed early checks.\n\nThat is useful, but retirement is not only a race between two benefit lines. A household also has spending needs, taxes, market returns, survivor years, and uncertainty about lifespan.',
    },
    { type: 'heading', text: 'What break-even shows and misses' },
    {
      type: 'table',
      caption: 'Break-even is a lens, not the whole plan.',
      columns: ['Question', 'Break-even view', 'Whole-plan view'],
      rows: [
        ['How long must I live for the later claim to catch up?', 'Good at this', 'Still relevant, but not the only question'],
        ['What happens to taxes and withdrawals before the later claim starts?', 'Usually ignored', 'Included in RetireGolden projections'],
        ['How does a spouse or survivor benefit change the choice?', 'Usually ignored', 'Important for couples and widow(er) years'],
        ['What if markets are good or bad while I bridge to a later claim?', 'Usually ignored', 'Can be tested in plan results and Monte Carlo'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Early claim', value: '$1,700 a month starting at 62' },
        { label: 'Later claim', value: '$2,400 a month starting at 67' },
        { label: 'Bridge cost', value: 'Waiting five years requires about $102,000 of portfolio withdrawals before checks begin' },
      ],
      summary:
        'The larger $2,400 check catches up only after enough years of payments. The whole-plan question is whether spending the $102,000 bridge is worth the later income and survivor protection.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Social Security analysis** page includes a break-even tab for education. It also includes an **In your plan** tab that runs claim-age combinations through the full projection and a **Benefits-only** tab that uses mortality-weighted expected value. When the views disagree, that disagreement is the lesson.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating break-even age as a recommendation.',
        'Using one life expectancy date as if it were certain.',
        'Ignoring the cash needed to delay benefits.',
        'For couples, ignoring the larger survivor check after one spouse dies.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Open **Social Security analysis** and compare the break-even tab with the full-plan ranking. Use break-even to understand the tradeoff, then use the full-plan view to decide what the rest of the plan can support.',
    },
  ],
}
