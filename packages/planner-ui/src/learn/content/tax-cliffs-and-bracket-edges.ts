/**
 * "Tax cliffs and bracket edges" - a Taxes P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const taxCliffsBracketEdgesArticle: LearningArticle = {
  slug: 'tax-cliffs-and-bracket-edges',
  title: 'Tax cliffs and bracket edges',
  description: 'Where one more dollar of income triggers an outsized cost.',
  category: 'taxes',
  tags: ['tax cliffs', 'tax brackets', 'magi', 'irmaa', 'aca', 'social security taxation'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.irs.gov/affordable-care-act/individuals-and-families/the-premium-tax-credit-the-basics',
    'https://www.medicare.gov/basics/costs/medicare-costs',
    'https://www.healthcare.gov/income-and-household-information/income/',
  ],
  relatedArticles: [
    'why-small-tax-cliffs-can-matter',
    'marginal-vs-effective-tax-rate',
    'why-roth-conversions-raise-other-costs',
    'irmaa-two-year-lookback',
    'aca-premium-tax-credits-and-magi',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/optimize', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A bracket edge is where the next dollars of taxable income enter a higher marginal bracket. A cliff is harsher: crossing a threshold can change a premium, credit, surcharge, or taxable-benefit calculation. Retirement planning has both.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Higher tax brackets usually apply only to the next slice of taxable income.',
        'Some rules behave more like steps, where a little extra MAGI can change a larger cost.',
        'Good planning tests the years near an edge instead of assuming the optimizer target is the whole answer.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Edges are not automatically bad. Filling a low bracket with Roth conversions can be wise if it avoids larger RMDs later. Harvesting gains in a low-income year can also make sense. The goal is to know what else moves when income rises: Social Security taxation, ACA credits, Medicare IRMAA, NIIT, state tax, and capital-gain layers.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/tax-cliffs-bracket-edges.webp' },
      caption:
        'Bracket edges are slopes; cliff-like thresholds can add ledges that deserve extra testing.',
      alt: 'A retirement income path climbs a stepped tax landscape with smooth bracket slopes, sudden ledges, and small warning markers near thresholds.',
    },
    {
      type: 'table',
      caption: 'Common edges to inspect in a retirement projection.',
      columns: ['Edge or cliff', 'Income measure', 'What to inspect'],
      rows: [
        ['Ordinary bracket edge', 'Taxable income', 'Ordinary tax on withdrawals, pensions, and conversions'],
        ['Capital-gain layer', 'Taxable income after ordinary income stacks first', '0%, 15%, and 20% gain-room interactions'],
        ['Social Security taxation', 'Provisional-income style formula', 'Taxable benefit share as other income rises'],
        ['ACA credit change', 'Marketplace income measure', 'Net pre-65 healthcare premium'],
        ['IRMAA tier', 'MAGI with a two-year lookback', 'Later Medicare Part B and Part D premiums'],
        ['NIIT threshold', 'MAGI and investment income', 'Extra 3.8% investment-income layer'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Ellis household',
      assumptions: [
        { label: 'Plan', value: 'Convert $45,000 of traditional IRA dollars up to a federal bracket edge' },
        { label: 'Second edge', value: 'A $50,000 conversion may cross an IRMAA-style premium tier two years later' },
        { label: 'Comparison', value: '$45,000 conversion saves future RMD tax; $50,000 conversion adds about $900 of later premium' },
      ],
      summary:
        'The extra $5,000 conversion is not automatically bad, but its price is not just federal tax. The comparison needs the bracket result plus the roughly **$900** delayed premium effect.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden shows annual MAGI, taxable income, ordinary tax, capital-gain tax, NIIT, healthcare costs, and Social Security taxation in the projection. The Roth optimizer can find useful conversion targets, but the Results ledger is where you inspect whether an income-sensitive edge was crossed.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Calling every bracket edge a cliff.',
        'Avoiding every threshold without measuring the lifetime benefit of crossing it.',
        'Checking federal tax but not healthcare, state tax, or taxable Social Security.',
        'Forgetting the IRMAA lookback when testing conversions before or during Medicare years.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Strategy**, **Optimize**, and **Scenarios** to test nearby income levels. Use **Results** to compare the year of the income event and the following years when delayed effects can appear.',
    },
  ],
}
