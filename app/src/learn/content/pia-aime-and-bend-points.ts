/**
 * "PIA, AIME, and bend points" - a Social Security P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const piaAimeBendPointsArticle: LearningArticle = {
  slug: 'pia-aime-and-bend-points',
  title: 'PIA, AIME, and bend points',
  description: 'How your earnings history becomes a base benefit amount.',
  category: 'social-security',
  tags: ['social security', 'pia', 'aime', 'bend points', 'earnings record', 'wage indexing'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/oact/COLA/Benefits.html',
    'https://www.ssa.gov/oact/COLA/piaformula.html',
    'https://www.ssa.gov/oact/COLA/bendpoints.html',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'earnings-test-before-fra',
    'break-even-useful-lens',
    'cola-and-inflation-protection',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/social-security-analysis'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Primary insurance amount (PIA) is the monthly Social Security retirement benefit you would receive if you claim at full retirement age. RetireGolden can take PIA directly from your SSA statement or estimate it from covered earnings.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'AIME means average indexed monthly earnings: a wage-indexed monthly average of your strongest earning years.',
        'Bend points are the tiers that turn AIME into PIA.',
        'The first AIME tier is replaced at a higher percentage than later tiers, so extra earnings help most when they replace low or zero years.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Social Security does not simply pay back what you paid in. It first indexes covered earnings to account for national wage growth, averages the strongest years into AIME, then applies a tiered formula.\n\nThe formula is progressive. A dollar of AIME in the first tier counts more than a dollar in the later tiers. That is why replacing a zero year can matter a lot for one person and barely move the answer for another.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/pia-aime-bend-points.webp' },
      caption:
        'Covered earnings are indexed and averaged into AIME, then passed through bend-point tiers to produce the base benefit.',
      alt: 'Many annual earnings tiles flow through a funnel into an average bucket, then through a three-tier bend-point container into a benefit stream.',
    },
    { type: 'heading', text: 'The formula path' },
    {
      type: 'formula',
      expression: 'PIA = 90% of the first AIME tier + 32% of the middle tier + 15% of AIME above the second bend point',
      where: [
        { symbol: 'PIA', meaning: 'Primary insurance amount, the monthly benefit at full retirement age' },
        { symbol: 'AIME', meaning: 'Average indexed monthly earnings' },
        { symbol: 'bend points', meaning: 'Dollar thresholds for the tiered Social Security formula' },
      ],
      note:
        "This is the simplified retirement-benefit formula. SSA applies bend points for the worker's eligibility year, so AIME and PIA are in that formula year's basis, not necessarily current-year or today's dollars.",
    },
    { type: 'heading', text: 'What each term means' },
    {
      type: 'table',
      caption: 'The earnings-record path in plain language.',
      columns: ['Term', 'Plain-language meaning', 'Why it matters'],
      rows: [
        ['Covered earnings', 'Wages or self-employment income taxed for Social Security', 'Only covered earnings count toward the retirement benefit'],
        ['Wage indexing', 'Older earnings are adjusted using national wage growth', 'A dollar earned decades ago is not treated like a current dollar'],
        ['AIME', 'The monthly average after indexing and selecting the strongest years', 'This is the number fed into the benefit formula'],
        ['Bend points', 'The tier thresholds for the formula', 'The same extra AIME can have different value depending on the tier'],
        ['PIA', 'The base monthly benefit at full retirement age', 'Claiming age then reduces or increases this base amount'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden lets you use **Quick** mode by entering PIA directly, or **Earnings record** mode by pasting or importing covered earnings. Earnings mode computes AIME and PIA, shows whether zero years are dragging the average down, and warns when future SSA tables are not yet published.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Entering the monthly check at a planned claim age instead of PIA at full retirement age.',
        'Assuming every extra year of work raises the benefit by the same amount.',
        'Forgetting that an SSA statement may assume future earnings continue if you have not retired yet.',
        'Treating a future-year PIA estimate as final before SSA publishes the wage and bend-point tables for that year.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Social Security** to enter PIA directly or switch to the earnings-record mode. If you use earnings mode, read the AIME and bend-point explainer below the entry box before comparing claim ages.',
    },
  ],
}
