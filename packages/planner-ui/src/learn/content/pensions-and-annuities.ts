/**
 * "Pensions and annuities" - an Accounts and Saving P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const pensionsAndAnnuitiesArticle: LearningArticle = {
  slug: 'pensions-and-annuities',
  title: 'Pensions and annuities',
  description: 'How guaranteed income streams fit into a retirement plan.',
  category: 'accounts-saving',
  tags: ['pension', 'annuity', 'guaranteed income', 'cola', 'survivor benefit', 'ordinary income'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/forms-pubs/about-publication-575',
    'https://www.investor.gov/introduction-investing/investing-basics/investment-products/insurance-products/annuities',
  ],
  relatedArticles: [
    'account-types-overview',
    'ordinary-income-vs-capital-gains',
    'planning-for-couples-and-survivor-years',
    'state-income-taxes-in-retirement',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/income', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A pension or annuity can change a retirement plan because it pays an income stream instead of sitting in an account balance. The planning question is not only "how much is it worth?" It is also "when does the payment start, how long does it last, how is it taxed, and what happens to a survivor?"',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Guaranteed income can reduce the amount a portfolio must supply each year.',
        'Pensions and annuities are usually modeled by start age, monthly payment, inflation adjustment, and tax treatment.',
        'Survivor benefits, taxable share, and cost-of-living adjustments can matter more than the headline monthly amount.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A portfolio withdrawal is flexible: you choose how much to draw, and the account balance changes. A pension or annuity is different. It creates a scheduled payment that may arrive for life, for a term, or under contract-specific rules. In a plan, that income can cover part of the spending target before the withdrawal order starts selling investments.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/pensions-annuities.webp' },
      caption:
        'Pensions and annuities add scheduled income streams that can reduce how much the portfolio must cover.',
      alt: 'Two steady income ribbons from a pension column and an annuity contract flow into a retirement spending path before the portfolio bucket is tapped.',
    },
    {
      type: 'table',
      caption: 'Inputs that shape a guaranteed-income stream.',
      columns: ['Input', 'What it changes', 'Planning question'],
      rows: [
        ['Start age', 'The first year payments appear', 'Does the income arrive before or after the portfolio bridge years?'],
        ['Monthly amount', 'The baseline annual income', 'How much spending does it cover before withdrawals?'],
        ['Cost-of-living adjustment', 'Whether payments grow over time', 'Does the stream keep up with inflation or shrink in buying power?'],
        ['Survivor benefit', 'What remains after the owner dies', 'Can the surviving spouse still cover fixed costs?'],
        ['Taxable share', 'How much annuity income is ordinary income in the model', 'Is the contract fully taxable or partly return of basis?'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Rivera household',
      assumptions: [
        { label: 'Pension', value: '$2,500 per month starting at 65 with a survivor percentage' },
        { label: 'Annuity', value: '$900 per month starting at 70 with a taxable-share estimate' },
        { label: 'Portfolio role', value: 'Guaranteed income adds $40,800 a year once both streams are active' },
      ],
      summary:
        'Once both streams are active, the portfolio has **$40,800** less annual spending to cover before taxes. The survivor setting tests whether that gap reopens after one death.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets you add pension and annuity accounts on **Accounts**. Pension income is modeled as ordinary income once payments start, with an optional survivor percentage. Annuity income is modeled while the owner is alive, and the taxable share controls how much of the payment enters ordinary income. Both can have a cost-of-living adjustment.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Entering only the monthly payment and ignoring whether it grows with inflation.',
        'Assuming a pension continues at the same amount for the survivor when the plan has a reduced survivor option.',
        'Treating every annuity payment as fully taxable when part may represent return of basis, or the reverse.',
        'Comparing an annuity to a portfolio without considering liquidity, fees, guarantees, and insurer risk.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to add pensions and annuities. Then use **Results** to inspect pension income, annuity income, ordinary income, taxes, and the spending gap before and after those streams begin.',
    },
  ],
}
