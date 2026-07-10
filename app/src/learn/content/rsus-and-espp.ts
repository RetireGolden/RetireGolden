/**
 * "RSUs and ESPP in retirement planning" - an Accounts and Saving P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const rsusAndEsppArticle: LearningArticle = {
  slug: 'rsus-and-espp',
  title: 'RSUs and ESPP in retirement planning',
  description: 'How equity compensation translates into retirement savings.',
  category: 'accounts-saving',
  tags: ['rsu', 'espp', 'equity compensation', 'vesting', 'cost basis', 'concentration risk'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/taxtopics/tc427',
    'https://www.irs.gov/forms-pubs/about-publication-525',
  ],
  relatedArticles: [
    'account-types-overview',
    'taxable-brokerage-basis-and-capital-gains',
    'ordinary-income-vs-capital-gains',
    'tax-loss-and-gain-harvesting',
    'fees-expense-ratios-and-compounding-drag',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Equity compensation can become a powerful retirement asset, but it is rarely as simple as a plain brokerage balance. Vesting, taxes, cost basis, concentration risk, and selling decisions all affect how much of the award really supports the plan.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Restricted stock units (RSUs) and employee stock purchase plan (ESPP) shares can turn compensation into investable assets.',
        'The retirement-plan value depends on what is already vested, what may vest later, and what tax basis the shares carry.',
        'RetireGolden models equity comp as a taxable-like account with an availability date, not as payroll, withholding, or grant-level tax accounting.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Once company shares are vested and available, they can often be sold like taxable investments. Before that point, they may be promised but not spendable. A good plan distinguishes confirmed assets from future compensation, and it asks whether too much of the household balance sheet depends on one employer or one stock.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/rsus-espp.webp' },
      caption:
        'Equity compensation moves from future vesting to taxable-like investable wealth only after it becomes available.',
      alt: 'Company-share tiles move along a vesting path into an available investment bucket, with a caution badge for concentration risk beside the path.',
    },
    {
      type: 'table',
      caption: 'Planning lens for equity compensation.',
      columns: ['Question', 'Why it matters', 'RetireGolden input'],
      rows: [
        ['What is already available?', 'Available shares can be sold to fund the plan', 'Balance and cost basis'],
        ['What vests later?', 'Unvested value may not be spendable yet', 'Vesting mode and vest date'],
        ['What is the tax basis?', 'Basis affects capital gains when shares are sold', 'Aggregate cost basis'],
        ['How concentrated is the position?', 'Employer stock can add job and portfolio risk at the same time', 'Return and scenario assumptions'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Brooks household',
      assumptions: [
        { label: 'Equity comp', value: '$120,000 expected to vest near retirement' },
        { label: 'Bridge need', value: '$55,000 of spending before pension and Social Security begin' },
        { label: 'Risk check', value: 'A 40% stock decline would cut the vesting value to about $72,000' },
      ],
      summary:
        'At $120,000, the award covers the $55,000 bridge with room left over. At $72,000, it still covers one year but leaves far less cushion for taxes, delays, or another weak market year.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden includes an **Equity comp** account type on **Accounts**. It stores balance, aggregate cost basis, annual contribution, vesting mode, and vest date. When cliff vesting is selected, the balance is unavailable for spending before the vest date. After it is available, withdrawals realize gains pro-rata like a taxable account.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Counting unvested awards as fully spendable today.',
        'Leaving cost basis blank when shares have basis that affects taxable gains.',
        'Ignoring the risk of holding a large employer-stock position near retirement.',
        'Expecting the planner to model grant-by-grant withholding, disqualifying ESPP dispositions, or tax-lot selection.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to add equity comp and its vesting assumption. Use **Scenarios** to test a lower stock value or delayed availability, then use **Results** to inspect withdrawals, gains, MAGI, and taxes.',
    },
  ],
}
