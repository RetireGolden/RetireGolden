/**
 * "Medicare, IRMAA, and the two-year lookback" - a Healthcare P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const irmaaTwoYearLookbackArticle: LearningArticle = {
  slug: 'irmaa-two-year-lookback',
  title: 'Medicare, IRMAA, and the two-year lookback',
  description: "How income from two years ago can raise this year's Medicare premiums.",
  category: 'healthcare',
  tags: ['medicare', 'irmaa', 'magi', 'part b', 'part d', 'roth conversion', 'tax cliff'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.medicare.gov/basics/costs/medicare-costs', 'https://www.ssa.gov/medicare/lower-irmaa'],
  relatedArticles: [
    'agi-magi-and-taxable-income',
    'why-roth-conversions-raise-other-costs',
    'healthcare-after-65',
    'roth-conversion-basics',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/strategy', '/plan/:planId/assumptions'],
  currentYearSensitive: true,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'IRMAA stands for income-related monthly adjustment amount. It is an extra Medicare premium for higher-income households. The tricky part is timing: Medicare usually looks at income from two years earlier.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'IRMAA can raise Medicare Part B and Part D premiums.',
        'The income test usually uses MAGI from two tax years earlier.',
        'A Roth conversion or large gain can affect Medicare premiums later, not just tax in the conversion year.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Most Medicare planning starts with the standard Part B premium. IRMAA adds a surcharge when income is above certain brackets. Those brackets work more like steps than a smooth slope: crossing a tier can increase premiums for the year.\n\nBecause the test looks back, a high-income year at 63 can matter at 65. A high-income year at 66 can matter at 68. That delay is why IRMAA can surprise people who focus only on the tax year in front of them.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/irmaa-lookback.webp' },
      caption:
        'IRMAA is a delayed cost: a higher-income year can raise Medicare premiums two years later.',
      alt: 'An income stream crosses a threshold on a timeline, and a delayed arrow points to a later Medicare premium bucket with a surcharge ribbon.',
    },
    { type: 'heading', text: 'How the lookback works' },
    {
      type: 'table',
      caption: 'The timing is the part that most often causes surprises.',
      columns: ['Planning question', 'What Medicare looks at', 'Why it matters'],
      rows: [
        ['What premium do I pay this year?', 'Usually MAGI from two tax years ago', 'Current income may not show up in premiums yet'],
        ['What if my income recently fell?', 'A prior high-income year may still be on record', 'You may need to understand appeal rules or wait for the lookback to roll forward'],
        ['What if I convert to Roth?', 'The conversion can raise MAGI in the conversion year', 'The premium effect may arrive later'],
        ['What if I am under 65 now?', 'Income before Medicare can still enter the later lookback', 'A pre-Medicare conversion window is not automatically IRMAA-free'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Carter household',
      assumptions: [
        { label: 'Age', value: 'One spouse is 63 and planning Medicare at 65' },
        { label: 'Strategy', value: 'Considers an $85,000 Roth conversion before Medicare starts' },
        { label: 'Delayed cost', value: 'The conversion could add about $150 a month of Medicare premium two years later' },
      ],
      summary:
        'The tax bill is only year one of the decision. If the premium increase lasts 12 months, the conversion also carries about **$1,800** of delayed Medicare cost in this simplified estimate.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models Medicare starting at age 65. It adds the standard Part B premium, applies IRMAA from the parameter pack, and uses a two-year MAGI lookback. The **Recent annual MAGI** assumption seeds years before the projection has its own MAGI history.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Looking only at this year\'s federal tax bracket.',
        'Forgetting that IRMAA can lag the income spike.',
        'Treating every IRMAA tier as a reason to avoid conversions, instead of comparing lifetime after-tax results.',
        'Assuming RetireGolden is a Medicare enrollment or appeal tool. It models planning costs, not the administrative process.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Assumptions** to set recent MAGI and healthcare inflation. Use **Strategy** or **Optimize** for conversion choices, then inspect **Results** for MAGI and healthcare-cost changes in later years.',
    },
  ],
}
