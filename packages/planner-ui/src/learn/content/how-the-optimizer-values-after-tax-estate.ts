/**
 * "How RetireGolden's optimizer values after-tax estate" - a Withdrawals and Roth P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const optimizerAfterTaxEstateArticle: LearningArticle = {
  slug: 'how-the-optimizer-values-after-tax-estate',
  title: "How RetireGolden's optimizer values after-tax estate",
  description: 'Why the optimizer compares plans on what heirs keep after tax.',
  category: 'withdrawals-roth',
  tags: ['optimizer', 'after-tax estate', 'heir tax', 'roth conversion', 'traditional ira'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'roth-conversion-basics',
    'filling-a-tax-bracket-with-roth-conversions',
    'why-roth-conversions-raise-other-costs',
    'after-tax-estate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/optimize', '/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'The optimizer is not trying to minimize this year\'s taxes. It is trying to leave the highest after-tax estate at the end of the plan, after accounting for the tax heirs might owe on inherited pre-tax money.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A traditional IRA dollar and a Roth dollar are not equally valuable to heirs.',
        'The optimizer applies a user-controlled heir tax rate to leftover traditional balances.',
        'The proposed schedule is checked by re-running the exact RetireGolden ledger; if the raw request cannot be fully executed, RetireGolden measures the cleaned schedule instead.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A pre-tax account can look larger than a Roth account, but some of that balance may really belong to future tax. For estate comparison, RetireGolden treats leftover traditional dollars as partly taxable to heirs, while Roth, taxable, cash, HSA, property, and life-insurance death benefit use simpler pass-through assumptions.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/after-tax-estate.webp' },
      caption:
        'The optimizer compares what is left after the assumed tax on inherited pre-tax dollars, not just the largest ending balance.',
      alt: 'Two ending estate buckets are compared: a traditional bucket loses a slice to a tax gate while a Roth bucket passes through more fully to heirs.',
    },
    { type: 'heading', text: 'A quick formula' },
    {
      type: 'formula',
      expression: 'after-tax estate = ending net worth - traditional balance * heir tax rate',
      where: [
        { symbol: 'ending net worth', meaning: 'the plan\'s modeled end-of-plan net worth' },
        { symbol: 'traditional balance', meaning: 'leftover pre-tax retirement balance at the end of the plan' },
        { symbol: 'heir tax rate', meaning: 'the assumed income-tax rate heirs pay on inherited pre-tax dollars' },
      ],
      basis: 'nominal',
      note: 'This is a planning simplification for comparing strategies. The optimizer uses the assumption you set, then RetireGolden re-runs the full ledger and applies only a cleaned schedule that the ledger can execute.',
    },
    { type: 'heading', text: 'Why conversions can help the estate' },
    {
      type: 'prose',
      md: 'A conversion can look bad in the year it happens because it raises tax. It can still help the after-tax estate if it moves money from a future-taxed bucket into a Roth bucket at a lower lifetime cost. The optimizer searches across years because one conversion can change later RMDs, taxes, Medicare costs, and ending balances.',
    },
    {
      type: 'table',
      caption: 'How the optimizer thinks about account buckets.',
      columns: ['Bucket', 'How the optimizer treats it', 'Why it matters'],
      rows: [
        ['Traditional', 'Haircut by the heir tax rate at the end', 'A larger balance may not all belong to heirs'],
        ['Roth', 'Kept whole in the estate comparison', 'Future qualified Roth dollars are more flexible'],
        ['Taxable, cash, HSA, property', 'Simplified as passing through untaxed in the estate comparison', 'Keeps the optimizer focused on the pre-tax vs Roth trade'],
        ['Current taxes', 'Counted through the exact ledger re-run', 'A good schedule must survive the real plan math'],
      ],
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Expecting the optimizer to minimize lifetime tax. It may raise lifetime tax while still improving after-tax estate.',
        'Leaving the heir tax rate at a default that does not match the question you want to test.',
        'Applying a proposed schedule without checking Monte Carlo risk and yearly cash flow.',
        'Treating the optimizer\'s math model as the final answer instead of the cleaned exact-ledger re-run shown in the app.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Optimize** to search for a conversion schedule. Use the heir tax rate slider to test sensitivity, then inspect **Results** for taxes, MAGI, RMDs, and ending after-tax estate.',
    },
  ],
}
