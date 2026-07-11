/**
 * "Taxable brokerage cost basis and capital gains" - an Accounts and Saving P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const taxableBrokerageBasisAndCapitalGainsArticle: LearningArticle = {
  slug: 'taxable-brokerage-basis-and-capital-gains',
  title: 'Taxable brokerage cost basis and capital gains',
  description: 'What basis is and why it changes the tax on selling investments.',
  category: 'accounts-saving',
  tags: ['taxable brokerage', 'cost basis', 'capital gains', 'realized gains', 'tax lots'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/taxtopics/tc409',
    'https://www.irs.gov/forms-pubs/about-publication-550',
  ],
  relatedArticles: [
    'account-types-overview',
    'ordinary-income-vs-capital-gains',
    'withdrawal-order-basics',
    'marginal-vs-effective-tax-rate',
    'tax-loss-and-gain-harvesting',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A taxable brokerage balance is not all taxed the same way. Part of the balance may be cost basis: money already taxed and invested. The rest may be unrealized gain. When you sell, the gain portion can become taxable capital gain.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Cost basis is the after-tax investment amount that usually comes back tax-free when shares are sold.',
        'Capital gain is generally the sale value above basis, subject to capital-gain rules.',
        'RetireGolden uses aggregate cost basis and realizes gains pro-rata when taxable investments are sold.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'If a taxable account is worth $100,000 and its cost basis is $70,000, the account has $30,000 of unrealized gain. Selling part of the account does not mean the whole sale is taxable. It usually means part basis and part gain leave the account together.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/taxable-basis-capital-gains.webp' },
      caption:
        'A taxable account contains both basis and gain; selling part of it can realize only the gain portion.',
      alt: 'A taxable brokerage bucket is split into a basis layer and a gain layer, with a partial sale flowing through a capital-gain tax gate.',
    },
    {
      type: 'formula',
      expression: 'capital gain = sale proceeds - cost basis sold',
      where: [
        { symbol: 'sale proceeds', meaning: 'the amount received from selling the investment' },
        { symbol: 'cost basis sold', meaning: 'the portion of original after-tax investment assigned to what was sold' },
      ],
      note: 'Real portfolios have tax lots and holding periods. RetireGolden uses aggregate basis as a planning simplification.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Harris household',
      assumptions: [
        { label: 'Taxable account value', value: '$300,000' },
        { label: 'Aggregate cost basis', value: '$210,000' },
        { label: 'Sale needed for spending', value: '$30,000' },
      ],
      summary:
        'The account is 70% basis and 30% gain. A pro-rata $30,000 sale would realize about $9,000 of gain in the simplified model, not $30,000 of taxable income.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The Accounts screen asks for taxable account cost basis. During projection, RetireGolden uses aggregate basis and realizes gains pro-rata as taxable holdings are sold. New taxable contributions add basis. This is useful for planning, but it does not replace brokerage-level tax-lot accounting.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Entering market value as basis when the account has embedded gains.',
        'Leaving basis at zero, which can overstate taxable gains.',
        'Assuming every taxable withdrawal is ordinary income.',
        'Expecting RetireGolden to choose specific tax lots or optimize harvesting automatically.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to enter taxable balance and cost basis. Then inspect **Results** for realized gains, MAGI, income tax, and withdrawal flows when taxable assets are sold.',
    },
  ],
}
