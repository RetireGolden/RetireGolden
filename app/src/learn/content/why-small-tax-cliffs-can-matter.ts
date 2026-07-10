/**
 * "Why small tax cliffs can matter" - a Start Here P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const whySmallTaxCliffsCanMatterArticle: LearningArticle = {
  slug: 'why-small-tax-cliffs-can-matter',
  title: 'Why small tax cliffs can matter',
  description: 'How crossing an invisible threshold by a dollar can cost far more than a dollar.',
  category: 'start-here',
  tags: ['tax cliffs', 'magi', 'irmaa', 'aca', 'brackets', 'roth conversions'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.irs.gov/affordable-care-act/individuals-and-families/the-premium-tax-credit-the-basics',
    'https://www.medicare.gov/basics/costs/medicare-costs',
    'https://www.healthcare.gov/income-and-household-information/income/',
  ],
  relatedArticles: [
    'why-roth-conversions-raise-other-costs',
    'irmaa-two-year-lookback',
    'aca-premium-tax-credits-and-magi',
    'marginal-vs-effective-tax-rate',
    'agi-magi-and-taxable-income',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/results',
    '/plan/:planId/strategy',
    '/plan/:planId/optimize',
    '/plan/:planId/assumptions',
  ],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Not every tax threshold behaves like a smooth bracket. Some thresholds act more like ledges: a little more income can trigger a surcharge, reduce a credit, or change how much of another benefit is taxed.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Tax brackets are usually marginal, but some income-sensitive rules can still feel cliff-like.',
        'MAGI is often the number to watch for ACA credits and Medicare IRMAA.',
        'A Roth conversion, capital gain, or withdrawal can be good on its own and still create a costly side effect.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A marginal bracket means only the next slice of income is taxed at the higher rate. A cliff-like rule is different: crossing a threshold can change a premium, credit, or taxable-benefit calculation. That does not mean you should always avoid the threshold. It means the real cost of the next dollar may be larger than the bracket rate suggests.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/small-tax-cliffs.webp' },
      caption:
        'Some thresholds are smooth slopes, while others behave like ledges that deserve a closer look.',
      alt: 'A retirement income path approaches several illustrated ledges labeled by icons for tax, healthcare, Medicare, and Social Security.',
    },
    {
      type: 'table',
      caption: 'Where cliff-like effects can show up in retirement planning.',
      columns: ['Area', 'Income measure', 'What can change'],
      rows: [
        ['Federal brackets', 'Taxable income', 'The next dollars can enter a higher marginal bracket'],
        ['ACA premium tax credit', 'Marketplace household income or MAGI-style income', 'A credit can shrink or disappear as income rises'],
        ['Medicare IRMAA', 'MAGI from a prior tax year', 'Part B and Part D premiums can rise in tiers'],
        ['Social Security taxation', 'Combined-income style formula', 'More of the benefit can become taxable'],
        ['Roth conversions', 'Taxable income and MAGI', 'The conversion can push on several of these rules at once'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Goal', value: 'Convert $24,000 of traditional IRA money in a low-bracket year' },
        { label: 'Hidden threshold', value: '$26,000 conversion crosses a healthcare-cost line in the estimate' },
        { label: 'Cost difference', value: 'The extra $2,000 conversion triggers about $1,100 of additional annual premium' },
      ],
      summary:
        'The last $2,000 of conversion is unusually expensive in this example: about **$1,100** of premium plus tax. That does not mean never cross the line; it means cross it on purpose.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden shows tax, MAGI, healthcare costs, IRMAA-related effects, Social Security benefits, conversions, and withdrawals in the annual ledger. That makes it possible to spot whether a surprising cost is coming from tax brackets or from another income-sensitive rule.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming the tax bracket is the full cost of a Roth conversion.',
        'Using taxable income when the rule actually looks at MAGI or marketplace household income.',
        'Avoiding every threshold automatically instead of comparing lifetime tradeoffs.',
        'Missing the lag between income and a later Medicare premium effect.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Results** to watch MAGI, tax, healthcare, and conversion rows year by year. Use **Strategy** or **Optimize** to adjust conversion amounts, then compare the years immediately around the threshold.',
    },
  ],
}
