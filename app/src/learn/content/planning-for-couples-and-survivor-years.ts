/**
 * "Planning for couples and survivor years" - a Start Here P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const planningForCouplesAndSurvivorYearsArticle: LearningArticle = {
  slug: 'planning-for-couples-and-survivor-years',
  title: 'Planning for couples and survivor years',
  description: 'Why the years after one spouse dies deserve their own attention.',
  category: 'start-here',
  tags: ['couples', 'survivor', 'widow penalty', 'social security', 'planning horizon'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'rule-change',
  sourceUrls: [
    'https://www.ssa.gov/benefits/survivors/',
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
  ],
  relatedArticles: [
    'spousal-and-survivor-benefits',
    'widows-penalty-and-survivor-brackets',
    'how-assumptions-change-the-answer',
    'survivor-planning-for-couples',
    'social-security-claiming-age-basics',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/household',
    '/plan/:planId/social-security',
    '/plan/:planId/insurance',
    '/plan/:planId/results',
    '/plan/:planId/scenarios',
  ],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A couple plan has two phases: the years when both spouses are alive and the years when one person may be managing the household alone. The second phase can look financially different even when the lifestyle feels similar.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A survivor may keep only the larger Social Security check, not both checks.',
        'Taxes can rise because the survivor often moves from joint brackets to single brackets.',
        'Some expenses fall after the first death, but housing, taxes, insurance, and healthcare may not fall by half.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The surviving spouse is still paying for a household, but with fewer income streams and a different tax shape. This is why a plan that looks comfortable for two people can still deserve a survivor-year check. It is not pessimism. It is protecting the person who may have fewer choices later.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/couples-survivor-years.webp' },
      caption:
        'A couple plan should inspect both the joint years and the one-spouse survivor years.',
      alt: 'Two retirement paths travel together, then one continues alone with Social Security, tax, and spending markers still ahead.',
    },
    {
      type: 'table',
      caption: 'What often changes after the first death.',
      columns: ['Item', 'Joint years', 'Survivor years'],
      rows: [
        ['Social Security', 'Two checks may be paid', 'Usually the survivor keeps the larger eligible check'],
        ['Tax filing', 'Married filing jointly may apply', 'Single brackets may apply after transition rules'],
        ['Spending', 'Two-person household costs', 'Some costs fall, but fixed household costs remain'],
        ['Healthcare', 'Two people insured', 'One person remains exposed to premiums, care costs, and inflation'],
        ['Decision load', 'Shared decisions', 'One person may need simpler records and safer liquidity'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Rivera household',
      assumptions: [
        { label: 'Joint years', value: '$72,000 of combined Social Security while both spouses are alive' },
        { label: 'Survivor income', value: '$44,000 larger benefit continues after the smaller check stops' },
        { label: 'Survivor cost', value: 'Spending falls 25%, not 50%, because housing and insurance remain' },
      ],
      summary:
        'Income falls by about **$28,000**, while spending falls only 25%. The survivor years need their own read because the gap can widen even when the couple-year plan looks comfortable.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden tracks each person in the household, each person\'s planning age, Social Security claim age, account ownership, insurance, and tax filing status. That lets the projection show the years after one spouse dies instead of stopping at the first death.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Planning only to the older spouse or the first life expectancy.',
        'Assuming expenses fall in half when one spouse dies.',
        'Ignoring which Social Security benefit protects the survivor.',
        'Missing the tax effect of moving from joint brackets to single brackets.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Household** to set each planning age, **Social Security** to enter benefits and claim ages, **Insurance** for survivor protection, and **Results** to inspect late years after one spouse is no longer alive.',
    },
  ],
}
