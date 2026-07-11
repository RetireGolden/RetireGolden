/**
 * "What AGI, MAGI, and taxable income mean" - a Taxes P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const agiMagiAndTaxableIncomeArticle: LearningArticle = {
  slug: 'agi-magi-and-taxable-income',
  title: 'What AGI, MAGI, and taxable income mean',
  description: 'Three income numbers that drive different costs in a plan.',
  category: 'taxes',
  tags: ['agi', 'magi', 'taxable income', 'deductions', 'irmaa', 'aca', 'tax planning'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/e-file-providers/definition-of-adjusted-gross-income',
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.healthcare.gov/income-and-household-information/income/',
    'https://www.medicare.gov/basics/costs/medicare-costs',
  ],
  relatedArticles: [
    'marginal-vs-effective-tax-rate',
    'why-roth-conversions-raise-other-costs',
    'irmaa-two-year-lookback',
    'aca-premium-tax-credits-and-magi',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/strategy', '/plan/:planId/assumptions'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Retirement planning uses several income numbers. They sound similar, but they answer different questions. AGI, MAGI, and taxable income can move together, but they are not interchangeable.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'AGI is a tax-return building block before standard or itemized deductions.',
        'MAGI means AGI with certain items added back, but the exact add-backs depend on the rule.',
        'Taxable income is what federal tax brackets apply to after deductions.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Start with income. Some adjustments can reduce it to adjusted gross income, or AGI. Some programs then add certain items back to create modified adjusted gross income, or MAGI. Finally, deductions reduce income to taxable income, which is the number used for federal tax brackets.\n\nA Roth conversion can raise all three measures in different ways. A deduction can lower taxable income but may not lower MAGI for every program. That is why a plan can show a modest tax bracket while still crossing a healthcare or Medicare threshold.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/agi-magi-income-map.webp' },
      caption:
        'Income measures are related layers: deductions can reduce taxable income, while program-specific add-backs can still keep MAGI high.',
      alt: 'A broad income stream enters stacked containers, deductions branch away, add-backs loop toward MAGI, and a smaller stream reaches a tax-bracket ladder.',
    },
    { type: 'heading', text: 'A simple map' },
    {
      type: 'formula',
      expression: 'taxable income = AGI - deductions',
      where: [
        { symbol: 'AGI', meaning: 'adjusted gross income after certain adjustments' },
        { symbol: 'deductions', meaning: 'standard or itemized deductions and other applicable deductions' },
      ],
      note: 'This is a planning simplification. Tax forms have details, ordering rules, credits, and special cases that RetireGolden does not try to reproduce line by line.',
    },
    {
      type: 'table',
      caption: 'Which income number answers which question?',
      columns: ['Income measure', 'Plain-language meaning', 'Common planning use'],
      rows: [
        ['AGI', 'Income after selected adjustments', 'Starting point for many tax and benefit rules'],
        ['MAGI', 'AGI plus rule-specific add-backs', 'ACA credits, IRMAA, and other income tests'],
        ['Taxable income', 'Income after deductions', 'Federal ordinary-income brackets'],
        ['Gross income', 'Broad income before adjustments', 'A rough starting point, not usually the final planning measure'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Morgan household',
      assumptions: [
        { label: 'Income event', value: '$20,000 Roth conversion plus $8,000 realized long-term gain' },
        { label: 'Taxable-income effect', value: 'A $30,000 standard deduction lowers the income used for brackets' },
        { label: 'MAGI effect', value: 'The full $28,000 income event can still count for ACA or IRMAA-style tests' },
      ],
      summary:
        'The deduction can reduce the tax-bracket bill, but it does not make the income event disappear. A plan can show lower taxable income while MAGI-sensitive costs still react to the $28,000 increase.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden records MAGI in the annual ledger because it drives several planning interactions. In the current projection, MAGI is a planning approximation built from realized ordinary income, realized gains, and taxable Social Security. It is meant to capture the big levers, not replace tax-preparation software.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Using taxable income as if it were always MAGI.',
        'Assuming a deduction prevents IRMAA or ACA effects.',
        'Forgetting that realized capital gains can raise MAGI.',
        'Treating one program\'s MAGI definition as universal.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Results** to inspect MAGI, tax, conversions, withdrawals, and realized gains by year. Use **Strategy** and **Optimize** when you want to test how extra income changes both tax and income-sensitive costs.',
    },
  ],
}
