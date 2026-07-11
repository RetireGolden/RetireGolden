/**
 * "Roth conversion basics" - a Withdrawals and Roth P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const rothConversionBasicsArticle: LearningArticle = {
  slug: 'roth-conversion-basics',
  title: 'Roth conversion basics',
  description: 'What a Roth conversion is and why people do them in retirement.',
  category: 'withdrawals-roth',
  tags: ['roth conversion', 'traditional ira', 'taxable income', 'roth ira', 'withdrawals'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/retirement-plans/plan-participant-employee/rollovers-of-retirement-plan-and-ira-distributions',
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras',
  ],
  relatedArticles: [
    'traditional-vs-roth-contributions',
    'filling-a-tax-bracket-with-roth-conversions',
    'why-roth-conversions-raise-other-costs',
    'how-the-optimizer-values-after-tax-estate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/optimize', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'A Roth conversion moves money from a pre-tax retirement account into a Roth account. The converted amount usually counts as taxable income now. In exchange, future qualified Roth withdrawals can be tax-free.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A conversion is a **tax timing trade**: pay tax now to potentially avoid tax later.',
        'The best conversion year is often a low-income year before required distributions, Medicare surcharges, or survivor-year tax brackets bite.',
        'More conversion is not automatically better. Extra income can push on other tax and healthcare rules.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Traditional IRA and traditional 401(k) dollars usually have not been taxed yet. A Roth conversion deliberately brings some of those dollars into income now, then moves the after-tax retirement asset into the Roth bucket.\n\nThat can make sense when today\'s tax cost is lower than the tax cost you expect later: future required minimum distributions, survivor tax brackets, higher heir tax rates, or a long runway for Roth growth.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/roth-conversion-flow.webp' },
      caption:
        'A Roth conversion moves pre-tax dollars through today\'s tax gate into the Roth bucket, where future qualified withdrawals may be tax-free.',
      alt: 'A traditional account bucket sends money through a tax gate into a Roth bucket, with a timeline showing tax paid now and future Roth flexibility.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Nguyen household',
      assumptions: [
        { label: 'Current year', value: 'Retired at 62, before Social Security and RMDs' },
        { label: 'Traditional IRA', value: '$700,000 balance that could create future RMD pressure' },
        { label: 'Conversion test', value: '$30,000 conversion while taxable income is relatively low' },
      ],
      summary:
        'The $30,000 conversion raises tax this year, but it also moves $30,000 into Roth and shrinks the account future RMDs are based on. The example is about timing, not free money.',
    },
    { type: 'heading', text: 'What changes when you convert' },
    {
      type: 'table',
      caption: 'A simple before-and-after view of a conversion.',
      columns: ['Part of the plan', 'Before conversion', 'After conversion'],
      rows: [
        ['Traditional balance', 'Higher; future withdrawals are usually taxable', 'Lower; future RMD pressure may be smaller'],
        ['Roth balance', 'Lower or unchanged', 'Higher; qualified withdrawals may be tax-free'],
        ['Current-year income', 'Lower', 'Higher by the converted amount'],
        ['Current-year tax', 'Lower', 'Often higher because the conversion is income'],
        ['Future flexibility', 'More money still trapped in pre-tax form', 'More money available from Roth if rules are met'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models Roth conversions in the annual ledger. Conversions raise ordinary income in the conversion year, move dollars from traditional to Roth, and then affect later taxes, RMDs, account balances, and after-tax estate value.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Judging the conversion only by this year\'s tax bill.',
        'Converting so much that Medicare, ACA, or Social Security tax interactions swamp the intended benefit.',
        'Forgetting that paying conversion tax from the IRA itself can leave less money invested.',
        'Assuming a conversion is reversible. Modern Roth conversions generally need to be planned as final decisions.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use the **Strategy** screen for manual or fill-to-target conversion rules. Use **Optimize** when you want RetireGolden to search for a multi-year schedule and then re-check it in **Results** and **Monte Carlo**.',
    },
  ],
}
