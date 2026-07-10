/**
 * "Social Security claiming age basics" - a Social Security P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const socialSecurityClaimingAgeArticle: LearningArticle = {
  slug: 'social-security-claiming-age-basics',
  title: 'Social Security claiming age basics',
  description: 'How the age you claim changes your monthly benefit for life.',
  category: 'social-security',
  tags: ['social security', 'claiming age', 'full retirement age', 'delayed credits', 'retirement benefit'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/benefits/retirement/planner/agereduction.html',
    'https://www.ssa.gov/benefits/retirement/planner/delayret.html',
  ],
  relatedArticles: [
    'pia-aime-and-bend-points',
    'break-even-useful-lens',
    'spousal-and-survivor-benefits',
    'cola-and-inflation-protection',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/social-security-analysis'],
  currentYearSensitive: true,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'Your Social Security claiming age is the age you start retirement benefits. It does not change the work record that created your benefit, but it does change the monthly check built from that record.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Claiming before full retirement age starts checks sooner, but with a permanent monthly reduction.',
        'Claiming at full retirement age gives your base retirement benefit, also called your primary insurance amount.',
        'Waiting after full retirement age can add delayed retirement credits until age 70.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Social Security has a timing tradeoff. An earlier claim can help cash flow now. A later claim can raise the monthly benefit for the rest of your life.\n\nThat tradeoff is not only about one person living to a certain age. Taxes, portfolio withdrawals, Roth conversions, survivor years, and inflation protection can all change which claiming age fits the full plan.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/social-security-claiming-age.webp' },
      caption:
        'Claiming age trades smaller checks sooner against larger checks later, with full retirement age as the base checkpoint.',
      alt: 'A timeline with three gates showing early, base, and later claiming choices, where the later path produces a larger benefit stream.',
    },
    { type: 'heading', text: 'Before, at, and after full retirement age' },
    {
      type: 'table',
      caption: 'How claiming age changes the retirement benefit.',
      columns: ['Claim timing', 'What happens', 'Planning question'],
      rows: [
        [
          'Before full retirement age',
          'Checks begin sooner, but the monthly benefit is reduced.',
          'Do you need income now, and what does the smaller lifetime check cost later?',
        ],
        [
          'At full retirement age',
          'The monthly benefit equals the base benefit from your earnings record.',
          'Is the base check a good balance between current cash flow and later protection?',
        ],
        [
          'After full retirement age',
          'Delayed credits raise the monthly benefit until age 70.',
          'Can the portfolio bridge the gap, and does the larger check help survivor years?',
        ],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Harris household',
      assumptions: [
        { label: 'Age 62 claim', value: '$1,700 a month, starting sooner' },
        { label: 'Age 67 claim', value: '$2,400 a month, but requires five bridge years' },
        { label: 'Age 70 claim', value: '$3,000 a month, but uses even more portfolio before checks begin' },
      ],
      summary:
        'The age 70 check is $1,300 more per month than age 62, but the Harrises must fund the waiting years first. RetireGolden compares both the bridge cost and the later income floor.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'On the **Social Security** screen, you enter each person\'s benefit source and claim age. On the **Social Security analysis** screen, RetireGolden sweeps claim-age combinations through the full plan and ranks them by ending after-tax estate. It also has a benefits-only view that isolates the Social Security value of the choice.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming the largest monthly check is always the best plan choice.',
        'Ignoring the years before the later claim starts, when the portfolio must cover more spending.',
        'For couples, looking only at the first spouse instead of the survivor check after one death.',
        'Using break-even age as the whole answer instead of one useful lens.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Start on **Social Security** to enter the benefit and claim age. Then open **Social Security analysis** to compare claim ages in the full plan, the benefits-only view, and the break-even view.',
    },
  ],
}
