/**
 * "Mortality-weighted Social Security analysis" - a Social Security P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const mortalityWeightedSocialSecurityArticle: LearningArticle = {
  slug: 'mortality-weighted-social-security',
  title: 'Mortality-weighted Social Security analysis',
  description: 'Weighing claiming choices by the odds of living to each age.',
  category: 'social-security',
  tags: ['social security', 'mortality', 'expected present value', 'claiming age', 'life expectancy'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/oact/STATS/table4c6.html',
    'https://www.ssa.gov/benefits/retirement/planner/agereduction.html',
    'https://www.ssa.gov/benefits/retirement/planner/delayret.html',
  ],
  relatedArticles: [
    'reading-the-social-security-analysis-page',
    'social-security-claiming-age-basics',
    'break-even-useful-lens',
    'longevity-risk',
    'planning-for-couples-and-survivor-years',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security-analysis', '/plan/:planId/social-security'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Mortality-weighted analysis asks: if each future benefit payment is weighted by the chance of being alive to receive it, which claiming age has the strongest expected value? It is an actuarial lens, not a complete retirement-plan answer.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Expected value gives more weight to years you are more likely to reach and less weight to very late years.',
        'A real discount rate reflects how much you value money sooner versus later.',
        'RetireGolden shows benefits-only expected present value separately from the full in-your-plan sweep.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A simple break-even chart treats the future as if you will definitely live to each plotted age. Mortality-weighted analysis is more careful. It says that a payment at age 72 should count more than a payment at age 98 because more people reach 72 than 98.\n\nIt also discounts future dollars. Social Security benefits are inflation-adjusted, so RetireGolden uses a real discount-rate lens for the benefits-only view. A higher real discount rate tends to favor earlier cash flow; a lower rate tends to favor delayed, larger checks.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/mortality-weighted-social-security.webp' },
      caption:
        'Mortality-weighted analysis combines benefit size, survival odds, and a real discount rate into one benefits-only lens.',
      alt: 'Social Security benefit streams flow through a survival-probability curve and a discount-rate filter into an expected-value scale.',
    },
    {
      type: 'formula',
      expression: 'expected value = sum of each future benefit x survival probability x discount factor',
      where: [
        { symbol: 'future benefit', meaning: 'the annual Social Security payment for that future year' },
        { symbol: 'survival probability', meaning: 'the chance the person is alive to receive that year\'s benefit' },
        { symbol: 'discount factor', meaning: 'the real-rate adjustment for money received later' },
      ],
      basis: 'today',
      note: 'RetireGolden uses annual cash flows in this lens. Monthly claim precision, taxes, and portfolio effects belong in the full plan sweep.',
    },
    { type: 'heading', text: 'Benefits only versus in your plan' },
    {
      type: 'table',
      caption: 'The two Social Security analysis lenses answer different questions.',
      columns: ['Lens', 'Includes', 'Leaves out'],
      rows: [
        ['Benefits only', 'Benefit size, survival odds, real discount rate, simplified spousal and survivor effects', 'Taxes, withdrawals, Roth conversions, IRMAA, ACA, RMDs, estate value'],
        ['In your plan', 'The full projection and ending after-tax estate', 'It depends on the quality of all plan inputs'],
        ['Break-even', 'Cumulative benefit timing', 'Mortality odds and most whole-plan interactions'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Rivera household',
      assumptions: [
        { label: 'Benefits-only result', value: 'Claiming at 70 is about $18,000 better on expected present value' },
        { label: 'Whole-plan result', value: 'Claiming at 67 leaves ending estate within about $5,000' },
        { label: 'Interpretation', value: 'The actuarial winner and the full-plan winner are nearly tied' },
      ],
      summary:
        'The benefits-only view favors delay by about **$18,000**, but the full plan narrows the estate difference to about **$5,000**. That is close enough for household priorities to matter.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Social Security analysis** page separates the benefits-only actuarial view from the full projection. For couples, the benefits-only view includes simplified spousal and survivor effects and assumes independent lifetimes. The full in-your-plan view reruns the actual plan for each claiming strategy.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating expected value as a guarantee for one household.',
        'Using the benefits-only ranking to ignore taxes, IRMAA, and portfolio withdrawals.',
        'For couples, forgetting that survivor protection can matter more than first-death totals.',
        'Changing the real discount rate until it confirms a preferred answer.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Open **Social Security analysis** after entering benefits on **Social Security**. Use the benefits-only view for an actuarial read, then compare it with the in-your-plan ranking before changing claim ages.',
    },
  ],
}
