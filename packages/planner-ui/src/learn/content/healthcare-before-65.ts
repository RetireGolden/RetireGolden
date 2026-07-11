/**
 * "Healthcare before age 65" - a Healthcare P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const healthcareBefore65Article: LearningArticle = {
  slug: 'healthcare-before-65',
  title: 'Healthcare before age 65',
  description: 'Covering the gap years before Medicare eligibility.',
  category: 'healthcare',
  tags: ['healthcare before 65', 'aca', 'marketplace', 'cobra', 'early retirement', 'magi'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.healthcare.gov/retirees/',
    'https://www.healthcare.gov/have-job-based-coverage/cobra/',
    'https://www.healthcare.gov/lower-costs/',
  ],
  relatedArticles: [
    'aca-premium-tax-credits-and-magi',
    'agi-magi-and-taxable-income',
    'why-roth-conversions-raise-other-costs',
    'healthcare-after-65',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/assumptions'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Retiring before 65 often means solving a healthcare bridge. Medicare has not started yet, but employer coverage may have ended. The bridge can be affordable, expensive, or fragile depending on coverage options and income.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The pre-65 years need their own healthcare plan, not just a spending estimate.',
        'Marketplace premiums may be reduced by ACA premium tax credits, depending on MAGI.',
        'Roth conversions and withdrawals can change healthcare costs in the same years they change taxes.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A pre-65 retiree may use retiree coverage, a spouse\'s employer plan, COBRA continuation, a marketplace plan, or a direct plan outside the marketplace. Those options have different premium costs, networks, deductibles, and subsidy rules.\n\nFor retirement planning, the big question is cash flow: what full premium should the plan assume, and does income qualify the household for a premium tax credit?',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/healthcare-before-65.webp' },
      caption:
        'The pre-65 healthcare bridge can use several coverage paths before Medicare begins.',
      alt: 'A bridge of coverage stations connects work coverage to a later Medicare bucket, with marketplace, continuation, spouse, and household icons along the way.',
    },
    { type: 'heading', text: 'Common bridge options' },
    {
      type: 'table',
      caption: 'Pre-65 coverage choices to model or compare.',
      columns: ['Option', 'What to check', 'Planning pressure'],
      rows: [
        ['Spouse or partner employer plan', 'Eligibility, premium share, networks', 'May be simpler if available'],
        ['Retiree coverage', 'Employer rules and whether it coordinates with Medicare later', 'Can be valuable but is not universal'],
        ['COBRA continuation', 'Duration and full premium cost', 'Can bridge a short gap but may be expensive'],
        ['ACA marketplace plan', 'Premium tax credit, networks, deductibles', 'MAGI management can matter'],
        ['Direct non-marketplace plan', 'Premium and coverage terms', 'May not qualify for marketplace credits'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Lee household',
      assumptions: [
        { label: 'Retirement age', value: '62' },
        { label: 'Bridge length', value: 'Three years before Medicare at age 65' },
        { label: 'Coverage estimate', value: '$1,200 monthly marketplace premium before any credit' },
        { label: 'Income choice', value: '$18,000 Roth withdrawal does not raise MAGI, but an $18,000 IRA withdrawal does' },
      ],
      summary:
        'The same $18,000 of spending money can land differently. If it comes from the IRA, the Lees may owe tax and may lose part of the healthcare credit; if it comes from Roth, the premium estimate may stay lower.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets you enter the full pre-65 monthly premium per person and decide whether to apply the ACA credit. The model estimates premiums annually, not plan-by-plan. It does not choose networks, deductibles, providers, or drug coverage.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Using today\'s employer payroll deduction as if it were the full retiree premium.',
        'Ignoring deductibles and out-of-pocket risk.',
        'Testing Roth conversions without checking MAGI-driven premiums.',
        'Assuming the same option will be best for every year before Medicare.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** to enter pre-65 premiums and ACA credit settings. Use **Assumptions** for healthcare inflation and recent MAGI. Use **Results** to inspect healthcare costs year by year.',
    },
  ],
}
