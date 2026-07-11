/**
 * "Paying conversion taxes from taxable vs IRA dollars" - a Withdrawals and Roth P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const payingConversionTaxesTaxableVsIraArticle: LearningArticle = {
  slug: 'paying-conversion-taxes-taxable-vs-ira',
  title: 'Paying conversion taxes from taxable vs IRA dollars',
  description: 'Why where you pay the tax on a conversion changes the outcome.',
  category: 'withdrawals-roth',
  tags: ['roth conversion', 'conversion tax', 'taxable account', 'traditional ira', 'roth ira', 'withdrawals'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions',
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras-distributions-withdrawals',
  ],
  relatedArticles: [
    'roth-conversion-basics',
    'filling-a-tax-bracket-with-roth-conversions',
    'why-roth-conversions-raise-other-costs',
    'withdrawal-order-basics',
    'how-the-optimizer-values-after-tax-estate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/optimize', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'A Roth conversion creates a tax bill. That tax has to be paid from somewhere. Paying it from cash or taxable assets usually leaves more of the converted retirement dollars inside the Roth, while paying it from the IRA can reduce the amount that stays invested.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The conversion amount is usually taxable income either way.',
        'Using taxable dollars for the tax can leave more retirement-account dollars converted to Roth.',
        'Using IRA dollars for the tax may create extra distribution issues, especially before penalty-free age.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Think of a conversion as moving pre-tax dollars into Roth and then paying the tax cost. If the tax is paid from a separate taxable account, the full converted amount can land in Roth. If the tax is withheld from the IRA distribution, fewer dollars reach Roth, and the withheld amount may be treated as a distribution rather than a conversion.\n\nThat does not mean taxable dollars should always be used. Spending taxable assets has its own opportunity cost and may realize capital gains. The point is to model both paths honestly.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/conversion-tax-source.webp' },
      caption:
        'The tax-payment source changes what remains invested: taxable dollars can pay the tax outside the conversion path, while IRA dollars reduce what reaches Roth.',
      alt: 'Two side-by-side conversion paths move money from a traditional bucket to a Roth bucket. In one path a taxable bucket pays the tax gate separately; in the other the tax gate takes part of the conversion ribbon.',
    },
    { type: 'heading', text: 'Two paths to compare' },
    {
      type: 'table',
      caption: 'The conversion tax source changes the shape of the trade.',
      columns: ['Tax source', 'What happens', 'Main trade-off'],
      rows: [
        ['Cash or taxable account', 'Tax is paid outside the converted IRA dollars', 'More reaches Roth, but taxable assets are spent or gains may be realized'],
        ['Traditional IRA dollars', 'Part of the IRA distribution may pay the tax', 'Less reaches Roth, and extra distribution rules may apply'],
        ['Roth dollars', 'Usually avoid using Roth to pay conversion tax', 'Spending Roth may defeat part of the reason for converting'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Kim household',
      assumptions: [
        { label: 'Conversion goal', value: 'Convert $50,000 from traditional IRA to Roth' },
        { label: 'Estimated tax', value: '$11,000 due from the conversion year' },
        { label: 'Comparison', value: 'Pay $11,000 from taxable assets or withhold it from the IRA distribution' },
      ],
      summary:
        'If tax is paid from taxable assets, the full **$50,000** reaches Roth. If tax is withheld from the IRA distribution, only about **$39,000** is converted, but taxable liquidity is preserved.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models conversion taxes as part of the normal annual cash-flow need. Taxes on conversions ride the withdrawal flow, so cash and taxable assets are used first under the default order. The converted amount itself moves from traditional to Roth and is not reduced for tax withholding inside the conversion transaction.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Comparing conversions without asking where the tax cash comes from.',
        'Counting the same taxable dollars as both invested and spent on tax.',
        'Ignoring capital gains created by selling taxable assets to pay the tax.',
        'Assuming IRA withholding is harmless before checking penalties and how much reaches Roth.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Strategy** for conversion rules, **Accounts** for taxable basis and cash levels, and **Results** to inspect withdrawals, realized gains, tax, Roth balances, and after-tax estate value.',
    },
  ],
}
