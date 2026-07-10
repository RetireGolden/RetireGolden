/**
 * "COLA and inflation protection" - a Social Security P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const colaInflationProtectionArticle: LearningArticle = {
  slug: 'cola-and-inflation-protection',
  title: 'COLA and inflation protection',
  description: 'How annual cost-of-living adjustments protect benefit buying power.',
  category: 'social-security',
  tags: ['social security', 'cola', 'inflation', 'purchasing power', 'benefits'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/cola/',
    'https://www.ssa.gov/benefits/retirement/planner/agereduction.html',
    'https://www.ssa.gov/benefits/retirement/planner/delayret.html',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'pia-aime-and-bend-points',
    'inflation-risk',
    'break-even-useful-lens',
    'trust-fund-haircut-scenarios',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'COLA stands for cost-of-living adjustment. It is the annual Social Security increase meant to help benefits keep up with inflation. Without that adjustment, a benefit that looks comfortable at the start of retirement could lose buying power over a long life.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A Social Security COLA raises the benefit amount after claiming; it is not a separate account balance.',
        'COLA protection can make a later, larger benefit especially valuable in very long lives.',
        'RetireGolden can model Social Security COLA as matching inflation or as a fixed annual rate.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Inflation raises the cost of the same lifestyle. A grocery basket, insurance premium, or utility bill may cost more in later years than it costs today. A benefit with a cost-of-living adjustment grows over time, so the income stream has some built-in inflation protection.\n\nThat does not mean Social Security perfectly matches every retiree\'s real expenses. Your personal spending may rise faster or slower than the index used for the COLA. Healthcare can also behave differently from general inflation. But the feature still matters: a COLA-adjusted check is different from a fixed pension check that never rises.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/cola-inflation-protection.webp' },
      caption:
        'A COLA-adjusted benefit can rise with the price path, helping a Social Security check keep more of its buying power over time.',
      alt: 'A benefit stream follows an upward inflation path while a fixed check falls behind, with a retirement timeline and a protected income bucket.',
    },
    {
      type: 'table',
      caption: 'Why COLA changes the claiming-age conversation.',
      columns: ['Planning lens', 'What COLA changes', 'What it does not solve'],
      rows: [
        ['Monthly check', 'The starting benefit can grow after claiming', 'It does not remove the early-claim reduction'],
        ['Long life', 'Later years receive inflation-adjusted dollars', 'It does not guarantee your full lifestyle is covered'],
        ['Couples', 'The larger survivor check can keep growing', 'It does not replace survivor tax planning'],
        ['Stress tests', 'You can compare fixed COLA and inflation-matched assumptions', 'It is still an assumption, not a promise about future law'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Nolan household',
      assumptions: [
        { label: 'Claim-now base', value: '$2,000 monthly benefit' },
        { label: 'Delayed base', value: '$2,640 monthly benefit before future COLAs' },
        { label: 'Illustrative COLA', value: 'At 3% for 20 years, those bases grow to about $3,600 vs $4,800 a month' },
      ],
      summary:
        'Both checks receive the same percentage COLA, but the larger base compounds into about **$1,200** more monthly income 20 years later in this simplified example.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden applies Social Security COLA inside the projection. In **Assumptions**, the Social Security COLA setting can match the general inflation assumption or use a fixed annual rate. That choice affects Results, Social Security analysis, and any scenario that relies heavily on benefits in later years.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Comparing claim ages only by the first monthly check.',
        'Treating a fixed pension and a COLA-adjusted Social Security benefit as if they carry the same inflation risk.',
        'Assuming the official COLA will match your household\'s exact spending inflation.',
        'For couples, ignoring that the surviving spouse may keep the larger benefit.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Social Security** to enter each person\'s benefit and claim age. Use **Assumptions** to set the Social Security COLA behavior, then check **Results** and **Social Security analysis** for the long-run effect.',
    },
  ],
}
