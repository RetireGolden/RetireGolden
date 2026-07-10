/**
 * "RMDs: required minimum distributions" - a Withdrawals and Roth P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const rmdsRequiredMinimumDistributionsArticle: LearningArticle = {
  slug: 'rmds-required-minimum-distributions',
  title: 'RMDs: required minimum distributions',
  description: 'The withdrawals the IRS eventually forces from pre-tax accounts.',
  category: 'withdrawals-roth',
  tags: ['rmd', 'required minimum distribution', 'traditional ira', '401k', 'secure 2.0', 'withdrawals'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
    'https://www.irs.gov/forms-pubs/about-publication-590-b',
  ],
  relatedArticles: [
    'withdrawal-order-basics',
    'qcds-qualified-charitable-distributions',
    'roth-conversion-basics',
    'how-the-optimizer-values-after-tax-estate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A required minimum distribution, or RMD, is the minimum amount the tax rules require you to withdraw each year from many pre-tax retirement accounts after a certain age. It can turn a quiet traditional IRA into taxable income whether or not you need the cash.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RMDs usually apply to traditional pre-tax retirement accounts, not Roth IRAs during the original owner\'s lifetime.',
        'The basic formula uses the prior year-end balance divided by a life-expectancy factor.',
        'RMDs happen before Roth conversions in the model because an RMD cannot be converted to Roth.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Traditional retirement accounts often got a tax break on the way in. RMDs are one way the tax system eventually pulls some of that deferred income onto the tax return. The amount generally grows when balances are high or the life-expectancy divisor gets smaller with age.\n\nThis is why Roth conversions before RMD age can matter. If they reduce the future traditional balance, they may reduce future RMD pressure.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/rmds-required-minimum-distributions.webp' },
      caption:
        'After the RMD start point, a required flow leaves the traditional bucket each year and enters the taxable cash-flow system.',
      alt: 'A traditional retirement bucket sits beside a timeline. After a checkpoint, an amber required-flow ribbon moves from the bucket toward a tax building and spending basket.',
    },
    { type: 'heading', text: 'A simple formula' },
    {
      type: 'formula',
      expression: 'RMD = prior year-end balance / distribution divisor',
      where: [
        { symbol: 'prior year-end balance', meaning: 'the account balance used as the base for the distribution' },
        { symbol: 'distribution divisor', meaning: 'the IRS life-expectancy factor for the applicable table and age' },
      ],
      basis: 'nominal',
      note: 'This is the simplified annual planning formula. Real administration can include first-year timing, account aggregation rules, inherited-account rules, plan-specific details, and penalties for missed RMDs.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Nguyen household',
      assumptions: [
        { label: 'Traditional IRA', value: '$900,000 projected balance before RMD age' },
        { label: 'Estimated first RMD', value: 'About $33,000 if no earlier conversions reduce the balance' },
        { label: 'Conversion test', value: 'A $40,000 annual conversion for five years lowers future RMD pressure' },
      ],
      summary:
        'Five $40,000 conversions move **$200,000** out of the pre-tax bucket before RMD age. That can lower forced withdrawals later, but only if the earlier tax cost is worth it.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden applies RMDs to traditional accounts using the SECURE 2.0 start ages in the parameter logic and the Uniform Lifetime Table. If a spouse is marked as the sole beneficiary and is more than 10 years younger, the model can use a larger joint-life divisor. RetireGolden takes the RMD in the age-attained year and does not model the first-year April 1 deferral.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Planning withdrawals as if all future traditional-account withdrawals are optional.',
        'Forgetting that RMDs can raise MAGI, Medicare premiums, Social Security taxation, or survivor-year taxes.',
        'Trying to convert the RMD itself to Roth.',
        'Assuming the app is handling every plan-administration detail for a real tax filing.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to classify traditional accounts and set spouse beneficiary details when relevant. Use **Results** to inspect the RMD column, traditional withdrawals, tax, and MAGI by year.',
    },
  ],
}
