/**
 * "Why Roth conversions can raise other costs" - a Taxes P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const rothConversionsRaiseOtherCostsArticle: LearningArticle = {
  slug: 'why-roth-conversions-raise-other-costs',
  title: 'Why Roth conversions can raise other costs',
  description: 'How extra income can ripple into IRMAA, ACA, and Social Security taxation.',
  category: 'taxes',
  tags: ['roth conversion', 'magi', 'irmaa', 'aca', 'social security taxation', 'tax cliffs'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.medicare.gov/basics/costs/medicare-costs',
    'https://www.healthcare.gov/income-and-household-information/income/',
    'https://www.irs.gov/taxtopics/tc423',
  ],
  relatedArticles: [
    'roth-conversion-basics',
    'filling-a-tax-bracket-with-roth-conversions',
    'agi-magi-and-taxable-income',
    'irmaa-two-year-lookback',
    'aca-premium-tax-credits-and-magi',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/results', '/plan/:planId/optimize'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'A Roth conversion is not only a tax-bracket event. Because it adds income, it can also affect Medicare premiums, ACA premium tax credits, Social Security taxation, and other income-sensitive parts of the plan.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A conversion usually raises ordinary income and MAGI in the conversion year.',
        'MAGI can affect Medicare IRMAA and ACA premium tax credits.',
        'Extra income can also cause more Social Security benefits to become taxable.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The bracket rate is only the visible part of the cost. A conversion can push on several income-sensitive rules at once. That is why a conversion that looks affordable by bracket alone may still be expensive after the rest of the plan reacts.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/conversion-ripples.webp' },
      caption:
        'Conversion income can ripple beyond the tax bracket, affecting healthcare subsidies, Medicare surcharges, and taxable benefits.',
      alt: 'A Roth conversion stream creates ripples that touch tax, Medicare, healthcare subsidy, Social Security, and warning symbols across a timeline.',
    },
    { type: 'heading', text: 'What can move when conversion income rises' },
    {
      type: 'table',
      caption: 'Common ripple effects from conversion income.',
      columns: ['Interaction', 'Income measure', 'Why it matters'],
      rows: [
        ['Federal bracket', 'Taxable income', 'The next conversion dollar may land in a higher bracket'],
        ['Medicare IRMAA', 'MAGI with a lookback', 'Higher income can raise future Part B and Part D premiums'],
        ['ACA premium tax credit', 'Marketplace household income', 'Higher income can reduce or remove the credit before Medicare age'],
        ['Social Security taxation', 'Combined income-style formula', 'More benefits may become taxable as other income rises'],
        ['State tax', 'State taxable income or state-specific rules', 'A conversion may raise state tax too'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Wilson household',
      assumptions: [
        { label: 'Conversion plan', value: '$35,000 Roth conversion to fill a federal bracket' },
        { label: 'Hidden pressure', value: '$35,000 also raises MAGI for an ACA spouse and a Medicare spouse' },
        { label: 'Added cost estimate', value: '$2,200 more ACA premium this year and $900 more Medicare premium later' },
      ],
      summary:
        'If the conversion creates **$3,100** of healthcare costs on top of income tax, the bracket-fill target may need to shrink. The right number is the whole-plan cost, not just the tax bracket.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden shows tax and MAGI on the **Results** page because those lines explain many ripple effects. The conversion itself appears in the year it happens, but some costs, like IRMAA, may show up later because the rule uses prior income.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Stopping the analysis at the federal bracket rate.',
        'Ignoring MAGI because it is not the same as taxable income.',
        'Forgetting that Medicare premium effects can lag the conversion year.',
        'Treating a cliff or surcharge as a reason to never convert instead of testing whether the lifetime trade still works.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Results** to inspect conversion, tax, MAGI, healthcare, and Medicare-related lines. Use **Optimize** as a starting point, then check whether the proposed schedule creates income-sensitive costs you would rather avoid.',
    },
  ],
}
