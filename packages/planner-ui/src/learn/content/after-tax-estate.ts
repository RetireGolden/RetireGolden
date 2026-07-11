/**
 * "After-tax estate value" - an Insurance and Estate P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const afterTaxEstateArticle: LearningArticle = {
  slug: 'after-tax-estate',
  title: 'After-tax estate value',
  description: 'Measuring what heirs actually keep once taxes are paid.',
  category: 'insurance-estate',
  tags: ['after-tax estate', 'heirs', 'traditional ira', 'roth', 'estate value', 'optimizer'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'how-the-optimizer-values-after-tax-estate',
    'beneficiaries-and-account-titling',
    'step-up-in-basis',
    'inherited-ira-10-year-rule',
    'permanent-life-insurance-in-a-plan',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/optimize', '/plan/:planId/report'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Net worth is not always the same as what heirs can spend. A dollar left in a traditional IRA may carry future income tax. A dollar left in Roth, cash, or stepped-up taxable property may be more flexible. RetireGolden uses after-tax estate value to compare those buckets more fairly.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'After-tax estate is a planning metric, not a probate or estate-tax calculation.',
        'RetireGolden subtracts an assumed heir tax on leftover traditional balances.',
        'The metric helps Roth conversion and claiming strategies compare what heirs may actually keep.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Imagine two households each end with the same net worth. One has mostly Roth and taxable assets. The other has mostly pre-tax traditional retirement accounts. The second household may leave heirs a larger future tax bill, so the two estates are not equally valuable.\n\nAfter-tax estate value is RetireGolden\'s way to adjust for that difference without pretending to model every estate rule.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/after-tax-estate-value.webp' },
      caption:
        'After-tax estate value compares the estate after applying an assumed tax haircut to inherited pre-tax balances.',
      alt: 'An estate stack separates into Roth, taxable, cash, and traditional buckets, with only the traditional bucket passing through a tax gate before reaching heirs.',
    },
    {
      type: 'formula',
      expression: 'after-tax estate = ending net worth - traditional balance * heir tax rate',
      where: [
        { symbol: 'ending net worth', meaning: 'the modeled end-of-plan net worth' },
        { symbol: 'traditional balance', meaning: 'remaining pre-tax retirement balance' },
        { symbol: 'heir tax rate', meaning: 'the assumed income-tax rate heirs pay on inherited pre-tax dollars' },
      ],
      basis: 'nominal',
      note: 'This is a simplified comparison metric. It does not model estate tax, probate costs, state inheritance tax, trust rules, or each heir\'s actual tax return.',
    },
    { type: 'heading', text: 'How RetireGolden treats buckets' },
    {
      type: 'table',
      caption: 'The estate comparison uses intentionally simple assumptions.',
      columns: ['Bucket', 'After-tax estate treatment', 'Why'],
      rows: [
        ['Traditional', 'Reduced by the heir tax rate', 'Inherited pre-tax dollars often create taxable income for heirs'],
        ['Roth', 'Kept whole', 'Qualified Roth dollars are usually more tax-flexible'],
        ['Taxable', 'Kept whole in the comparison', 'The model assumes a basis step-up for estate comparison'],
        ['Cash, HSA, property', 'Kept whole in the comparison', 'Simplifies the metric so the main pre-tax/Roth trade is visible'],
        ['Life insurance death benefit', 'Included once paid into the plan', 'The model treats death benefit as income-tax-free at death'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Brooks household',
      assumptions: [
        { label: 'Strategy A', value: '$1,000,000 ending net worth, including $600,000 in traditional accounts' },
        { label: 'Strategy B', value: '$960,000 ending net worth, including more Roth and taxable assets' },
        { label: 'Heir tax haircut', value: 'A 25% assumed tax on inherited traditional dollars reduces Strategy A by $150,000' },
      ],
      summary:
        'Strategy A looks $40,000 richer before tax, but the $150,000 heir-tax haircut can make Strategy B the larger after-tax estate. The winning column depends on what heirs keep.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden shows after-tax estate in **Results**, **Social Security analysis**, **Optimize**, and **Report**. The projection applies the plan heir-tax rate internally, while **Optimize** exposes a local heir-tax slider so you can test how sensitive a Roth conversion schedule is to that assumption.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Comparing strategies by ending net worth only.',
        'Assuming the heir tax rate is a fact instead of a sensitivity assumption.',
        'Reading after-tax estate as a legal estate plan.',
        'Ignoring beneficiaries, titling, and real-world estate documents because the metric looks tidy.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Optimize** to compare Roth conversion strategies and test the heir-tax sensitivity used for that optimization run. Use **Results** or **Report** to see ending net worth and after-tax estate side by side.',
    },
  ],
}
