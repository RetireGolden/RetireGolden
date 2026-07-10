/**
 * "Ordinary income vs capital gains" - a Taxes P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const ordinaryIncomeVsCapitalGainsArticle: LearningArticle = {
  slug: 'ordinary-income-vs-capital-gains',
  title: 'Ordinary income vs capital gains',
  description: 'Why two kinds of income are taxed on separate ladders.',
  category: 'taxes',
  tags: ['ordinary income', 'capital gains', 'tax brackets', 'taxable brokerage', 'magi'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.irs.gov/taxtopics/tc409',
    'https://www.irs.gov/forms-pubs/about-publication-550',
  ],
  relatedArticles: [
    'marginal-vs-effective-tax-rate',
    'taxable-brokerage-basis-and-capital-gains',
    'agi-magi-and-taxable-income',
    'withdrawal-order-basics',
    'tax-loss-and-gain-harvesting',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Ordinary income and long-term capital gains can both raise taxable income, but they do not move through the federal tax system the same way. Ordinary income uses ordinary brackets. Long-term capital gains stack on top and may use preferential capital-gain rates.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Wages, taxable traditional withdrawals, pension income, and many conversions are ordinary income.',
        'Long-term gains from taxable investments may use a separate 0%, 15%, or 20% federal rate structure.',
        'Capital gains can still affect MAGI, Social Security taxation, ACA credits, IRMAA, NIIT, and state tax.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The ordinary-income ladder fills first after deductions. Preferential long-term capital gains then stack on top of ordinary taxable income. That means the same capital gain can land in a lower or higher capital-gain layer depending on how much ordinary income is already in the year.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/ordinary-income-vs-capital-gains.webp' },
      caption:
        'Ordinary income fills the first tax ladder, then long-term capital gains stack into their own rate layers above it.',
      alt: 'An ordinary-income ladder fills from the bottom, while a separate capital-gains ribbon stacks above it through three preferential tax layers.',
    },
    {
      type: 'table',
      caption: 'Common income types in retirement planning.',
      columns: ['Income type', 'Usually modeled as', 'Planning note'],
      rows: [
        ['Wages, pensions, annuity taxable share', 'Ordinary income', 'Often fills ordinary brackets before portfolio withdrawals'],
        ['Traditional IRA or 401(k) withdrawals', 'Ordinary income', 'Can raise MAGI and affect brackets, RMDs, and surcharges'],
        ['Roth conversions', 'Ordinary income', 'Voluntary income that may be timed into lower-bracket years'],
        ['Taxable brokerage realized long-term gains', 'Capital gains', 'Stacks on top of ordinary income in the federal calculation'],
        ['Qualified Roth withdrawals', 'Usually outside taxable income', 'Rules matter, especially for early Roth access'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Singh household',
      assumptions: [
        { label: 'Ordinary income', value: '$45,000 pension plus a $25,000 traditional IRA withdrawal' },
        { label: 'Taxable brokerage sale', value: '$30,000 sale with $9,000 of long-term gain' },
        { label: 'Stacking result', value: 'The IRA withdrawal fills ordinary brackets before the gain uses capital-gain layers' },
      ],
      summary:
        'The $25,000 IRA withdrawal is taxed as ordinary income. Only the **$9,000** gain portion of the brokerage sale goes through capital-gain layers, but both amounts can still raise AGI and MAGI.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden tracks ordinary income and realized gains separately. The federal tax engine applies deductions, ordinary brackets, and long-term capital-gain stacking. The projection also uses AGI and MAGI-style totals for rules such as taxable Social Security, ACA credits, IRMAA, and NIIT.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming capital gains are always tax-free when ordinary income is low.',
        'Forgetting that capital gains can make more Social Security taxable.',
        'Ignoring state tax, where gains are often treated more like ordinary income.',
        'Treating every taxable brokerage withdrawal as a gain instead of separating basis from gain.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to enter taxable cost basis and account type correctly. Use **Strategy** to control withdrawals and conversions, then inspect **Results** for ordinary income, realized gains, MAGI, tax, and zero-rate capital-gain headroom.',
    },
  ],
}
