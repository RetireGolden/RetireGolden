/**
 * "After-tax estate value" - an Insurance and Estate P1 article.
 */

import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'Net worth is not always the same as what heirs can spend. A dollar left in a traditional IRA may carry future income tax. A dollar left in Roth, cash, or stepped-up taxable property may be more flexible. An HSA depends on whether the modeled destination is a spouse or a non-spouse. RetireGolden uses after-tax estate value to compare those buckets more fairly.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'After-tax estate is a planning-horizon comparison, not a death tax return, probate calculation, or legal beneficiary designation.',
      'Estimated heir income tax depends on account type, remaining basis, and beneficiary choice.',
      'The metric helps Roth conversion and claiming strategies compare what heirs may keep.',
    ],
  },
  { type: 'heading', text: 'The basic idea' },
  {
    type: 'prose',
    md: 'Imagine two households each end with the same net worth. One has mostly Roth and taxable assets. The other has mostly pre-tax traditional retirement accounts. The second household may leave heirs a larger future tax bill, so the two estates are not equally valuable.\n\nAfter-tax estate value is RetireGolden\'s way to adjust for that difference without pretending to model every estate rule.\n\nA spouse-designated HSA, or the legacy default, gets no estimated heir income tax. An explicit non-spouse HSA is priced on the ending gross at the assumed heir rate, without the qualifying pre-death medical-expense reduction.',
  },
  {
    type: 'figure',
    image: { src: '/learn/images/after-tax-estate-value.webp' },
    caption:
      'A simplified traditional vs Roth case: only leftover traditional dollars pass through an assumed tax haircut.',
    alt: 'An estate stack separates into Roth, taxable, cash, and traditional buckets, with only the traditional bucket passing through a tax gate before reaching heirs.',
  },
  { type: 'heading', text: 'A simplified example' },
  {
    type: 'formula',
    expression: 'after-tax estate = ending net worth - traditional balance * heir tax rate',
    where: [
      { symbol: 'ending net worth', meaning: 'the modeled end-of-plan net worth' },
      { symbol: 'traditional balance', meaning: 'remaining fully pre-tax traditional balance' },
      { symbol: 'heir tax rate', meaning: 'the assumed income-tax rate a non-spouse heir pays on those inherited pre-tax dollars' },
    ],
    basis: 'nominal',
    note: 'Limited example only: a fully pre-tax traditional balance, a non-spouse heir, and no HSA, charity, spouse destination, or basis adjustments. This is not the engine\'s general formula. It does not model estate tax, probate costs, state inheritance tax, trust rules, or each heir\'s actual tax return.',
  },
  { type: 'heading', text: 'How RetireGolden treats buckets' },
  {
    type: 'table',
    caption: 'Planning simplifications by bucket.',
    columns: ['Bucket', 'After-tax estate treatment', 'Why'],
    rows: [
      ['Traditional', 'Reduced by the class heir rate after remaining basis', 'Inherited pre-tax dollars often create taxable income for heirs'],
      ['Roth', 'Kept whole', 'Qualified Roth dollars are usually more tax-flexible'],
      ['Taxable', 'Kept whole in the comparison', 'The model assumes a basis step-up for estate comparison'],
      ['HSA', 'Spouse or legacy default: no estimated heir income tax. Explicit non-spouse: ending gross at the assumed heir rate; qualifying pre-death medical-expense reduction omitted', 'Planning-horizon comparison, not an actual death return. The default is not a legal designation.'],
      ['Cash, property', 'Kept whole in the comparison', 'Simplifies the metric so the main pre-tax/Roth trade is visible'],
      ['Life insurance death benefit', 'Included once paid into the plan', 'The model treats death benefit as income-tax-free at death'],
    ],
  },
  { type: 'heading', text: 'A worked example' },
  {
    type: 'scenario',
    name: 'The Brooks household',
    assumptions: [
      { label: 'Scope', value: 'Simplified traditional vs Roth case: fully pre-tax traditional balance, non-spouse heir, no HSA, charity, spouse destination, or basis adjustments' },
      { label: 'Strategy A', value: '$1,000,000 ending net worth, including $600,000 in traditional accounts' },
      { label: 'Strategy B', value: '$960,000 ending net worth, including more Roth and taxable assets' },
      { label: 'Heir tax haircut', value: 'A 25% assumed tax on inherited traditional dollars reduces Strategy A by $150,000' },
    ],
    summary:
      'In this simplified traditional vs Roth case, Strategy A looks $40,000 richer before tax, but the $150,000 heir-tax haircut can make Strategy B the larger after-tax estate.',
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
      'Treating the assumed heir income tax rate as if it were each heir\'s actual marginal rate.',
      'Ignoring beneficiary designation forms and assuming the modeled destination matches the legal paperwork.',
      'Reading the simplified example as the full engine formula.',
      'Reading after-tax estate as a legal estate plan or an actual death tax return.',
    ],
  },
  { type: 'heading', text: 'Where to use this in the app' },
  {
    type: 'prose',
    md: 'Use **Optimize** to compare Roth conversion strategies and test the heir-tax sensitivity used for that optimization run. Use **Results** or **Report** to see ending net worth and after-tax estate side by side.',
  },
]
