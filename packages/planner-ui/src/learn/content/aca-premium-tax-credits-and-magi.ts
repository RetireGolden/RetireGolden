/**
 * "ACA premium tax credits and MAGI" - a Healthcare P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const acaPremiumTaxCreditsAndMagiArticle: LearningArticle = {
  slug: 'aca-premium-tax-credits-and-magi',
  title: 'ACA premium tax credits and MAGI',
  description: 'How income controls the subsidy for pre-Medicare health coverage.',
  category: 'healthcare',
  tags: ['aca', 'premium tax credit', 'magi', 'marketplace', 'healthcare before 65', 'tax cliff'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-29',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.healthcare.gov/lower-costs/',
    'https://www.healthcare.gov/income-and-household-information/income/',
    'https://www.irs.gov/forms-pubs/about-publication-974',
  ],
  relatedArticles: [
    'agi-magi-and-taxable-income',
    'healthcare-before-65',
    'why-roth-conversions-raise-other-costs',
    'filling-a-tax-bracket-with-roth-conversions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/strategy'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Before Medicare, many early retirees use an ACA marketplace plan. The premium tax credit can lower the monthly premium, but it depends heavily on household income. In planning, that means MAGI is not just a tax line. It can also be a healthcare-cost line.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'ACA premium tax credits are income-tested.',
        'Roth conversions, IRA withdrawals, wages, and realized gains can raise MAGI.',
        'Managing MAGI can matter most in the gap years before Medicare starts.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The marketplace looks at household income for the coverage year. A lower income can mean a larger credit; a higher income can mean a smaller credit or no credit under the rules being modeled. That is why one extra dollar of income can sometimes cost more than one extra dollar of tax.\n\nThe premium tax credit is not a reason to keep income artificially low at all costs. It is a signal to compare choices carefully: taxable withdrawals, capital gains, part-time wages, and Roth conversions all push on the same income measure.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/aca-magi-premium-credit.webp' },
      caption:
        'Marketplace subsidies are driven by household income: income flows into MAGI, and MAGI controls how much premium help remains.',
      alt: 'Income ribbons flow into a MAGI funnel, which controls an amber subsidy ribbon that lowers a healthcare premium bucket near a cliff edge.',
    },
    { type: 'heading', text: 'What raises ACA MAGI in retirement' },
    {
      type: 'table',
      caption: 'Common income sources that can affect the credit.',
      columns: ['Income source', 'Why it matters', 'Planning note'],
      rows: [
        ['Traditional IRA withdrawal', 'Usually raises ordinary income and MAGI', 'Needed spending can reduce subsidy room'],
        ['Roth conversion', 'Raises income even if you do not spend the converted dollars', 'Often worth testing before choosing a target'],
        ['Taxable investment sale', 'Realized gains can raise MAGI', 'Basis and gain size matter'],
        ['Part-time wages', 'Usually raise MAGI', 'May still be worth it for cash flow and benefits'],
        ['Tax-free Roth withdrawal', 'Usually does not raise MAGI', 'Can be useful flexibility when rules are met'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Ages', value: 'Both spouses are 62, three years before Medicare' },
        { label: 'Marketplace estimate', value: '$1,350 monthly premium before a $650 credit' },
        { label: 'Conversion test', value: 'An extra $20,000 Roth conversion cuts the estimated credit to $350 a month' },
      ],
      summary:
        'The conversion may cost more than the income tax alone. In this estimate, the Patels pay tax on the $20,000 conversion and about **$3,600** more for the year of coverage because the credit is smaller.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden reconciles an evidenced Marketplace year against that same year\'s final household MAGI, including withdrawals, conversions, gains, and required ACA add-backs. The standard planner can request ACA modeling but cannot yet author the annual tax-family, enrollment-premium, and SLCSP evidence contract. Without complete evidence—or when tax-year parameters are not sourced—the projection funds the gross enrollment premium and marks the year non-actionable.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Thinking taxable income and ACA MAGI are always the same number.',
        'Testing Roth conversions without checking healthcare costs.',
        'Ignoring realized gains in taxable accounts.',
        'Treating a marketplace subsidy estimate as a final insurance quote or tax filing result.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** to enter the gross pre-65 premium and request ACA modeling. Use **Results** to verify annual evidence readiness, MAGI, and healthcare cost; a requested credit is not an applied credit. Use **Strategy** only when the exact ledger shows an actionable ACA year.',
    },
  ],
}
