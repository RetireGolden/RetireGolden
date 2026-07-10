/**
 * "NIIT and high-income investment tax" - a Taxes P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const niitHighIncomeInvestmentTaxArticle: LearningArticle = {
  slug: 'niit-high-income-investment-tax',
  title: 'NIIT and high-income investment tax',
  description: 'The extra 3.8% tax on investment income above certain thresholds.',
  category: 'taxes',
  tags: ['niit', 'net investment income tax', 'capital gains', 'magi', 'high income'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/newsroom/net-investment-income-tax',
    'https://www.irs.gov/forms-pubs/about-publication-550',
  ],
  relatedArticles: [
    'ordinary-income-vs-capital-gains',
    'agi-magi-and-taxable-income',
    'taxable-brokerage-basis-and-capital-gains',
    'tax-loss-and-gain-harvesting',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'The net investment income tax, often called NIIT, is an extra federal tax that can apply when investment income and modified adjusted gross income are high enough. It is separate from ordinary tax and long-term capital-gain tax.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'NIIT is a 3.8% tax tied to net investment income and MAGI thresholds.',
        'Realized taxable gains can trigger NIIT even when the capital-gain rate itself looks manageable.',
        'RetireGolden models NIIT on realized gains as the investment-income piece it currently tracks separately.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Capital gains can face more than one federal layer. First, they stack into the capital-gain brackets. Then, for higher-income households, NIIT can add another 3.8% on the smaller of net investment income or the MAGI amount above the threshold. That extra layer can change the cost of selling taxable investments or harvesting gains.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/niit-high-income-investment-tax.webp' },
      caption:
        'NIIT is an added layer that can sit on top of capital-gain tax when MAGI and investment income are high enough.',
      alt: 'A capital-gain ribbon stacks into a tax tower, then an extra thin investment-tax layer appears above a high-income threshold marker.',
    },
    {
      type: 'formula',
      expression: 'NIIT = 3.8% x smaller of net investment income or MAGI above the threshold',
      where: [
        { symbol: 'net investment income', meaning: 'investment income covered by the NIIT rules' },
        { symbol: 'MAGI above the threshold', meaning: 'modified adjusted gross income above the filing-status threshold' },
      ],
      note: 'RetireGolden currently approximates investment income using realized gains because interest and dividends are not separately tracked in the projection.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Shah household',
      assumptions: [
        { label: 'Taxable sale', value: '$180,000 stock sale with $70,000 of long-term gain' },
        { label: 'Other income', value: '$210,000 of pension, wages, and IRA withdrawals already in MAGI' },
        { label: 'NIIT estimate', value: 'If $30,000 of the gain falls above the threshold, 3.8% adds about $1,140' },
      ],
      summary:
        'The sale is not just a capital-gain-bracket question. The same $70,000 gain can also create a separate **$1,140** NIIT layer when it lands on top of already-high MAGI.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden computes NIIT inside the federal tax detail. In the current model, realized gains are the separately tracked investment-income input. The Results ledger can show when a taxable sale or portfolio withdrawal raises MAGI enough for the NIIT layer to appear.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Looking only at the 0%, 15%, or 20% capital-gain bracket.',
        'Forgetting that MAGI from pensions, wages, IRA withdrawals, or conversions can help trigger NIIT.',
        'Assuming NIIT applies to every dollar of income instead of the formula base.',
        'Expecting RetireGolden to model every category of net investment income separately.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to enter taxable cost basis. Use **Strategy** and **Scenarios** to test gain-heavy years, then inspect **Results** for realized gains, MAGI, capital-gain tax, NIIT, and total federal tax.',
    },
  ],
}
