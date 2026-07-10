/**
 * "Marginal vs effective tax rate" - a Taxes P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const marginalVsEffectiveTaxRateArticle: LearningArticle = {
  slug: 'marginal-vs-effective-tax-rate',
  title: 'Marginal vs effective tax rate',
  description: 'The difference between your top bracket and your average tax rate.',
  category: 'taxes',
  tags: ['marginal tax rate', 'effective tax rate', 'tax bracket', 'income tax', 'roth conversion'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.irs.gov/filing/federal-income-tax-rates-and-brackets'],
  relatedArticles: [
    'filling-a-tax-bracket-with-roth-conversions',
    'ordinary-income-vs-capital-gains',
    'what-retiregolden-models',
    'why-roth-conversions-raise-other-costs',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/strategy', '/plan/:planId/optimize'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Your marginal tax rate is the rate on the next dollar of taxable income. Your effective tax rate is your total tax divided by your total income. They answer different questions.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        '**Marginal rate** helps you judge one more dollar of income, such as one more dollar converted to Roth.',
        '**Effective rate** helps you understand the average tax burden across the whole year.',
        'A Roth conversion decision usually cares more about the marginal cost than the average rate.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Tax brackets are layered. Early dollars are taxed at lower rates, later dollars at higher rates. Being "in" a bracket does not mean all your income is taxed at that top rate. It means the next taxable dollar may be taxed at that rate until the next bracket begins.',
    },
    {
      type: 'formula',
      expression: 'effective tax rate = total tax / total income',
      where: [
        { symbol: 'total tax', meaning: 'tax paid for the year' },
        { symbol: 'total income', meaning: 'the income measure you are using for the comparison' },
      ],
      note: 'Different reports may use different income measures. RetireGolden focuses on planning comparisons, not return-filing presentation.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Alvarez household',
      assumptions: [
        { label: 'Total income', value: '$100,000' },
        { label: 'Total tax', value: '$12,000' },
        { label: 'Next-dollar bracket', value: '22%' },
      ],
      summary:
        'Their effective rate is about 12%, but an extra dollar of taxable income may cost about 22 cents before other interactions. A Roth conversion should be judged against the next-dollar cost, not the 12% average.',
    },
    {
      type: 'table',
      caption: 'Which tax rate answers which question?',
      columns: ['Rate', 'Question it answers', 'Common use'],
      rows: [
        ['Marginal', 'What happens to the next dollar?', 'Sizing Roth conversions, gain harvesting, extra work income'],
        ['Effective', 'How much tax did the whole year carry on average?', 'Understanding overall tax burden'],
        ['Blended conversion cost', 'What did this specific conversion actually cost?', 'Comparing conversion strategies after all interactions'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The optimizer and fill-to-target strategies care about where extra income lands. A conversion may partly fill a lower bracket and partly spill into a higher one. It may also change how much Social Security is taxable or whether MAGI crosses another threshold.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Thinking every dollar is taxed at the top bracket rate.',
        'Using effective rate to judge one more dollar of income.',
        'Ignoring non-bracket interactions that create a higher real marginal cost.',
        'Comparing plans by tax rate alone instead of after-tax wealth, risk, and cash flow.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Results** to inspect annual tax and MAGI. Use **Strategy** and **Optimize** when you want to test how extra conversion income changes the plan.',
    },
  ],
}
