/**
 * "Inflation risk" - a Risk and Uncertainty P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const inflationRiskArticle: LearningArticle = {
  slug: 'inflation-risk',
  title: 'Inflation risk',
  description: 'How rising prices erode buying power over a long retirement.',
  category: 'risk-uncertainty',
  tags: ['inflation', 'purchasing power', 'real dollars', 'expenses', 'cola'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.bls.gov/cpi/'],
  relatedArticles: [
    'todays-dollars-vs-future-dollars',
    'cola-and-inflation-protection',
    'how-assumptions-change-the-answer',
    'sequence-of-returns-risk',
    'healthcare-after-65',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/monte-carlo'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Inflation risk is the risk that prices rise faster than the plan can comfortably absorb. Even modest yearly inflation can make a long retirement more expensive because expenses compound year after year.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Future dollars and today\'s dollars are different ways to describe the same plan.',
        'Inflation affects expenses, tax thresholds, healthcare costs, Social Security COLAs, and the real value of fixed income.',
        'A plan can look comfortable in nominal dollars while still losing buying power if the inflation assumption is too low.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A dollar amount in the future does not buy the same basket of goods that the same dollar buys today. If retirement spending rises with inflation, the nominal spending number goes up. If an income source does not rise with inflation, its real buying power falls.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/inflation-risk.webp' },
      caption:
        'Inflation gradually changes what a fixed dollar amount can buy, while inflation-adjusted spending keeps chasing the basket.',
      alt: 'A fixed stack of dollars stays the same size while grocery and healthcare baskets get larger along a retirement timeline.',
    },
    {
      type: 'formula',
      expression: "today's dollars = future dollars / (1 + inflation)^years",
      where: [
        { symbol: 'future dollars', meaning: 'the nominal amount shown in a later year' },
        { symbol: 'inflation', meaning: 'the assumed annual price increase expressed as a decimal' },
        { symbol: 'years', meaning: 'the number of years between now and the future amount' },
      ],
      basis: 'today',
      note: 'Real inflation varies. This simple formula uses one steady rate so the concept is easy to see.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Brooks household',
      assumptions: [
        { label: 'Base spending', value: '$80,000 in today\'s dollars' },
        { label: 'Baseline inflation', value: '3% a year makes that lifestyle cost about $145,000 in 20 years' },
        { label: 'Stress inflation', value: '4% a year makes it about $175,000 in 20 years' },
      ],
      summary:
        'The 1-point inflation stress adds roughly **$30,000** of annual future-dollar spending by year 20. The lifestyle did not grow; the price tag did.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden stores assumptions in nominal terms, then lets Results show key figures in today\'s dollars for comparison. The projection applies general inflation to spending and other modeled items, while healthcare can also grow with an extra healthcare inflation assumption.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Comparing a future-dollar number to today\'s grocery bill without adjusting for inflation.',
        'Assuming every income source has a full cost-of-living adjustment.',
        'Forgetting that healthcare can grow differently from general spending.',
        'Using one inflation assumption forever without testing a higher path.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Assumptions** to set general inflation and healthcare extra inflation. Use **Results** to toggle today\'s-dollar views, and use **Monte Carlo** or **Scenarios** to test what happens when inflation runs hotter.',
    },
  ],
}
