/**
 * "Withdrawal order basics" - a Withdrawals and Roth P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const withdrawalOrderBasicsArticle: LearningArticle = {
  slug: 'withdrawal-order-basics',
  title: 'Withdrawal order basics',
  description: 'Which accounts to draw from first and why the order matters.',
  category: 'withdrawals-roth',
  tags: ['withdrawal order', 'cash', 'taxable account', 'traditional ira', 'roth ira', 'hsa', 'tax planning'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras-distributions-withdrawals',
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
  ],
  relatedArticles: [
    'rmds-required-minimum-distributions',
    'qcds-qualified-charitable-distributions',
    'roth-conversion-basics',
    'paying-conversion-taxes-taxable-vs-ira',
    'marginal-vs-effective-tax-rate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'Withdrawal order is the order in which a retirement plan spends from accounts when income is not enough to cover expenses. It sounds mechanical, but it can change taxes, Medicare costs, Roth balances, and how long each account lasts.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Different account types create different tax effects when you spend from them.',
        'RMDs and other forced distributions usually happen before the flexible withdrawal order.',
        'The best order is not universal. It depends on taxes, healthcare cliffs, heirs, and which accounts you want to preserve.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Cash is usually simple: spending it does not create taxable income. Taxable brokerage accounts may create capital gains when sold. Traditional retirement accounts usually create ordinary income when withdrawn. Roth accounts can be valuable later because qualified withdrawals may be tax-free. HSAs can be especially valuable for medical costs.\n\nA withdrawal order is a rule for deciding which bucket supplies the next spending dollar. A simple order can be useful, but retirement planning often needs to test alternatives because the tax cost changes by year.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/withdrawal-order-basics.webp' },
      caption:
        'A withdrawal order chooses which account buckets feed the spending basket after income and forced distributions are considered.',
      alt: 'Cash, taxable, traditional, Roth, and HSA buckets send ribbons toward one spending basket, with small tax markers on taxable and traditional flows.',
    },
    { type: 'heading', text: 'Common account buckets' },
    {
      type: 'table',
      caption: 'Account type often matters more than account name.',
      columns: ['Bucket', 'Typical withdrawal effect', 'Planning question'],
      rows: [
        ['Cash', 'Usually no new taxable income', 'How much cash buffer is useful?'],
        ['Taxable brokerage', 'May realize capital gains as investments are sold', 'How much embedded gain is in the account?'],
        ['Traditional IRA or 401(k)', 'Usually ordinary income', 'Will this fill a bracket or trigger another cost?'],
        ['Roth', 'Qualified withdrawals may be tax-free', 'Is it better saved for later flexibility or heirs?'],
        ['HSA', 'Tax-free for qualified medical expenses', 'Should it be reserved for healthcare?'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Daniels household',
      assumptions: [
        { label: 'Spending gap', value: '$36,000 needed after Social Security and pension income' },
        { label: 'Taxable option', value: '$36,000 brokerage sale with about $9,000 of embedded gain' },
        { label: 'Traditional option', value: '$36,000 IRA withdrawal counts as ordinary income' },
      ],
      summary:
        'The taxable sale puts about **$9,000** into income, while the IRA withdrawal puts the full **$36,000** into ordinary income. Roth may avoid income now, but spends a flexible asset.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden supports sequential, proportional, and bracket-targeted withdrawal strategies. The default sequential order drains cash, taxable, equity compensation, traditional, Roth, and then HSA. RMDs, QCDs, inherited-IRA distributions, and 72(t) payments are handled before the need-based withdrawal flow.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming one textbook order is always best.',
        'Ignoring RMDs because they are not optional once they apply.',
        'Spending Roth too early when it may be useful for survivor years, healthcare cliffs, or heirs.',
        'Looking only at income tax and missing MAGI-sensitive costs.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to classify balances correctly. Use **Strategy** to choose the withdrawal order, and use **Results** to inspect withdrawals, realized gains, tax, MAGI, and shortfalls by year.',
    },
  ],
}
