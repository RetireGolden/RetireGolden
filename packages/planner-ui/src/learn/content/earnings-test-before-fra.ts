/**
 * "Earnings test before full retirement age" - a Social Security P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const earningsTestBeforeFraArticle: LearningArticle = {
  slug: 'earnings-test-before-fra',
  title: 'Earnings test before full retirement age',
  description: 'How working while claiming early can temporarily reduce benefits.',
  category: 'social-security',
  tags: ['social security', 'earnings test', 'full retirement age', 'working while claiming', 'wages'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/benefits/retirement/planner/whileworking.html',
    'https://www.ssa.gov/oact/COLA/rtea.html',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'pia-aime-and-bend-points',
    'break-even-useful-lens',
    'how-social-security-is-taxed',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/social-security-analysis'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'If you claim Social Security before full retirement age and keep working, the retirement earnings test can temporarily withhold part of your benefit. This is about earned wages, not investment income or withdrawals.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The earnings test applies before full retirement age when wages are above the annual exempt amount.',
        'Different withholding rates apply before the year you reach full retirement age and during that year.',
        'After full retirement age, the earnings test no longer withholds benefits, and withheld months can raise the later benefit calculation.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The earnings test is easy to misread as a permanent tax. It is better to think of it as temporary withholding. If early benefits are withheld because you worked, Social Security later adjusts the benefit as if some of those early months had not been claimed.\n\nThat does not mean the timing is painless. You still have less cash in the years when benefits are withheld, and that can change portfolio withdrawals, taxes, and Roth conversion room.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/earnings-test-before-fra.webp' },
      caption:
        'Before full retirement age, wages can cause temporary benefit withholding; later, withheld months can be credited back.',
      alt: 'A work-income ribbon crosses a checkpoint, part of the benefit stream is held in a reserve bucket, and a later stream continues after full retirement age.',
    },
    { type: 'heading', text: 'What changes when you work and claim early' },
    {
      type: 'table',
      caption: 'Earnings-test treatment by timing.',
      columns: ['Timing', 'What SSA looks at', 'What can happen'],
      rows: [
        ['Before the year you reach full retirement age', 'Wages above the annual exempt amount', 'Part of the benefit can be withheld'],
        ['During the year you reach full retirement age', 'A higher exempt amount before the FRA month', 'Withholding can still happen, but under a different rule'],
        ['After full retirement age', 'The earnings test no longer applies', 'Working does not withhold retirement benefits under this test'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Rivera household',
      assumptions: [
        { label: 'Claim choice', value: 'Starts a $22,000 annual benefit before full retirement age' },
        { label: 'Work choice', value: '$35,000 of part-time wages for several years' },
        { label: 'Cash-flow effect', value: 'Illustrative earnings-test withholding reduces the first-year benefit by about $5,000' },
      ],
      summary:
        'Even if withheld months are later credited, the Rivera plan still needs about **$5,000** more from wages, cash, or the portfolio in that early year.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden runs wages before Social Security in each projection year, applies the annual earnings-test limits from the parameter pack, withholds benefits when needed, and credits whole withheld months back at full retirement age. This is an annual planning approximation, not a month-by-month SSA filing model.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Thinking the earnings test applies after full retirement age.',
        'Applying it to investment income, IRA withdrawals, pensions, or Roth conversions instead of wages.',
        'Ignoring the cash-flow strain in the years when benefits are withheld.',
        'Assuming the RetireGolden annual approximation will match SSA month-by-month administration exactly.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Social Security** to set claim age and **Income** to enter wages. Then inspect **Results** and **Social Security analysis** to see whether early claiming while working helps or hurts the whole plan.',
    },
  ],
}
