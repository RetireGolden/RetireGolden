import type { LearningArticle } from '../learningRegistry'

export const assumptionSocialSecurityColaArticle: LearningArticle = {
  slug: 'assumption-social-security-cola',
  title: 'The Social Security COLA',
  description: 'How RetireGolden models the Social Security Cost-of-Living Adjustment (COLA) and how it protects your benefits.',
  category: 'assumptions',
  tags: ['social security', 'cola', 'inflation', 'cpi-w'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/cola/',
    'https://www.ssa.gov/news/en/cola/factsheets/2026.html',
    'https://www.ssa.gov/oact/TR/2025/2025_Long-Range_Economic_Assumptions.pdf',
  ],
  relatedArticles: [
    'cola-and-inflation-protection',
    'assumption-general-inflation',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/social-security'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "Social Security is one of the few retirement income sources that is legally guaranteed to rise with inflation. This protection is delivered through the annual **Cost-of-Living Adjustment (COLA)**, which adjusts monthly benefits to keep pace with rising consumer prices.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'By default, RetireGolden\'s Social Security COLA is set to **match inflation** (automatically syncing with the general inflation rate, which is 2.5% by default).',
        'Social Security COLA is statutorily tied to the annual change in the **CPI-W** (Consumer Price Index for Urban Wage Earners and Clerical Workers).',
        'The official COLA for **2026 is 2.8%**. Over the long term, the Social Security Trustees assume an ultimate COLA of **2.4%**.',
      ],
    },
    { type: 'heading', text: 'How COLA is calculated' },
    {
      type: 'prose',
      md: "Every October, the Social Security Administration measures price changes using the CPI-W. It compares the average CPI-W from the third quarter (July, August, September) of the current year to the third quarter of the prior year. The percentage increase is the COLA applied to benefits starting the following January. If prices do not rise (or fall), the COLA is 0%.",
    },
    {
      type: 'prose',
      md: "Because COLA is designed to keep your real buying power flat, RetireGolden's neutral default is **Match Inflation**. This means that if you change your plan's general inflation rate, your projected Social Security benefit increases accordingly in nominal terms, keeping its real value in today's dollars constant.",
    },
    {
      type: 'table',
      caption: 'How the COLA setting changes the projection.',
      columns: ['Setting', 'What RetireGolden does', 'When it is useful'],
      rows: [
        ['Match inflation', 'Benefits grow with the general inflation assumption', 'Neutral baseline; keeps real Social Security buying power flat'],
        ['Fixed rate', 'Benefits grow at the annual rate you enter', 'Stress-testing policy changes or a gap between benefit COLA and personal inflation'],
      ],
    },
    { type: 'heading', text: 'When to override the default' },
    {
      type: 'prose',
      md: "RetireGolden allows you to set a **Fixed Rate** COLA override. This is useful for modeling specific policy changes or personal expectations:",
    },
    {
      type: 'list',
      items: [
        '**Chained CPI Reform:** Some policymakers propose switching to the ' +
          '"Chained CPI" index, which typically runs about 0.25 percentage points ' +
          'lower than traditional CPI-W. You can model this by setting a fixed COLA rate ' +
          'slightly below your inflation assumption (e.g., a 2.2% COLA under 2.5% inflation).',
        '**Fixed Divergence:** If you believe inflation indexes understate your ' +
          'personal expenses or that healthcare costs will outpace your benefit growth, ' +
          'adjusting the COLA mode can reveal the long-term impact on your income.',
      ],
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'A fixed COLA is a scenario assumption, not a forecast of future SSA announcements.',
        'Changing COLA can matter most for households that rely heavily on Social Security late in retirement.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'You can adjust the **Social Security COLA** mode on the **Assumptions** screen. It defaults to "Match inflation," but you can toggle it to "Fixed rate" and enter a custom percentage.',
    },
  ],
}
