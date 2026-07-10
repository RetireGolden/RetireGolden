/**
 * "Tax-loss harvesting and gain harvesting" - a Taxes P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const taxLossGainHarvestingArticle: LearningArticle = {
  slug: 'tax-loss-and-gain-harvesting',
  title: 'Tax-loss harvesting and gain harvesting',
  description: 'Deliberately realizing losses or gains to manage lifetime tax.',
  category: 'taxes',
  tags: ['tax-loss harvesting', 'gain harvesting', 'capital gains', 'cost basis', 'wash sale', 'taxable brokerage'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/taxtopics/tc409',
    'https://www.irs.gov/forms-pubs/about-publication-550',
  ],
  relatedArticles: [
    'taxable-brokerage-basis-and-capital-gains',
    'ordinary-income-vs-capital-gains',
    'niit-high-income-investment-tax',
    'tax-cliffs-and-bracket-edges',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Harvesting means deliberately realizing a tax result instead of waiting for a sale to happen by accident. Tax-loss harvesting realizes losses that may offset gains or other income under the rules. Gain harvesting realizes gains in a year when the tax cost may be low enough to be worth locking in.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Tax-loss harvesting can create useful losses, but wash-sale and replacement-investment rules matter.',
        'Gain harvesting can use low-income years or 0% capital-gain room to reset basis.',
        'RetireGolden estimates realized gains from taxable withdrawals and reports zero-rate gain headroom; it does not choose tax lots or execute harvesting trades.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A taxable account contains basis and unrealized gain or loss. Harvesting changes the tax record by selling something. If you sell at a loss, the loss may offset gains and potentially a limited amount of other income. If you sell at a gain in a low-tax year, you may increase basis and reduce future gain. Both strategies depend on current law, holding period, tax lots, state tax, and what you buy next.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/tax-loss-gain-harvesting.webp' },
      caption:
        'Harvesting chooses when gains or losses leave the taxable account instead of letting tax timing happen by accident.',
      alt: 'A taxable account splits into two planned harvest paths, one collecting a loss leaf and one collecting a gain tile, before both rejoin a future basis path.',
    },
    {
      type: 'table',
      caption: 'Two different harvesting goals.',
      columns: ['Strategy', 'Typical goal', 'Planning caution'],
      rows: [
        ['Tax-loss harvesting', 'Use losses to offset gains or create a deduction under limits', 'Wash-sale and replacement rules can undo the intended tax result'],
        ['Gain harvesting', 'Realize gains in a low-tax year and increase basis', 'The gain can still raise MAGI, taxable Social Security, ACA costs, IRMAA, NIIT, or state tax'],
        ['Do nothing', 'Keep tax deferral and avoid transaction complexity', 'Future sales may happen in a higher-tax year'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Kim household',
      assumptions: [
        { label: 'Harvested loss', value: '$12,000 loss from selling one taxable fund lot' },
        { label: 'Realized gain', value: '$8,000 long-term gain from rebalancing another holding' },
        { label: 'Leftover loss', value: '$4,000 remains after offsetting the gain; about $3,000 can offset ordinary income' },
      ],
      summary:
        'The loss does not create $12,000 of immediate tax savings. It first wipes out the $8,000 gain, then about **$3,000** can reduce ordinary income this year, leaving roughly **$1,000** to carry forward.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models taxable and equity-comp withdrawals using aggregate cost basis, so realized gains appear when those accounts are sold for spending. The federal tax detail also calculates advisory 0% long-term capital-gain headroom. RetireGolden does not model individual tax lots, wash sales, short-term gain timing, or broker-level harvesting transactions.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Harvesting a loss and accidentally creating a wash sale.',
        'Harvesting gains because the federal rate is low while ignoring ACA, IRMAA, NIIT, state tax, or Social Security taxation.',
        'Assuming a modeled average cost basis can replace tax-lot records.',
        'Letting tax savings drive an investment change that no longer fits the portfolio plan.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to keep taxable basis realistic. Use **Results** to inspect realized gains and zero-rate gain headroom. Use **Scenarios** or one-time capital-gain inputs to approximate a planned harvest year, then verify the real transaction details outside the planner.',
    },
  ],
}
