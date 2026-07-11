import type { LearningArticle } from '../learningRegistry'

export const assumptionSocialSecurityTrustFundArticle: LearningArticle = {
  slug: 'assumption-social-security-trust-fund',
  title: 'The Social Security trust-fund shortfall',
  description: 'Why RetireGolden allows you to model a Social Security benefit cut, and the data behind the solvency projections.',
  category: 'assumptions',
  tags: ['social security', 'trust fund', 'haircut', 'solvency', 'benefit cut'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-08',
  reviewCadence: 'rule-change',
  sourceUrls: [
    'https://www.ssa.gov/news/en/press/releases/2026-06-09.html',
    'https://www.ssa.gov/oact/TR/2026/',
    'https://www.everycrsreport.com/reports/IF13256.html',
  ],
  relatedArticles: [
    'trust-fund-haircut-scenarios',
    'social-security-claiming-age-basics',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/social-security'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "One of the most common anxieties in retirement planning is the long-term solvency of Social Security. RetireGolden includes a built-in toggle that allows you to stress-test your plan against a statutory benefit cut if Congress does not act to resolve the trust fund shortfall.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'By default, RetireGolden\'s solvency cut toggle is **off** (modeling scheduled benefits).',
        'When turned on, the default settings model a **17% cut starting in 2034**, directly matching the findings of the **2026 Social Security Trustees Report**.',
        'If the retirement-only fund (OASI) is viewed in isolation, reserves deplete in **2032** with a **22% cut** required to match ongoing revenues.',
      ],
    },
    { type: 'heading', text: 'Solvency data from the 2026 Trustees Report' },
    {
      type: 'prose',
      md: "Social Security is funded on a pay-as-you-go basis, supplemented by reserves held in trust funds. Due to demographic shifts (a larger retiree cohort relative to workers), the system is paying out more than it collects. According to the 2026 Trustees Report:",
    },
    {
      type: 'list',
      items: [
        '**Combined OASDI Depletion:** The Old-Age and Survivors Insurance (OASI) and Disability Insurance (DI) trust funds, if combined, will exhaust their reserves in **2034**. At that point, ongoing tax revenues will cover **83%** of scheduled benefits, requiring a **17% cut** across the board.',
        '**Retirement-Only (OASI) Depletion:** If the DI fund is not merged with OASI, the retirement fund alone depletes in **2032** — one quarter earlier than the prior year\'s projection — with ongoing revenues covering **78%** of benefits (a **22% cut**).',
        '**Year-over-year movement:** the combined depletion year has held at 2034 across recent reports, while the payable share moves a point or two as economic assumptions update — which is why RetireGolden re-verifies these defaults against each annual report.',
      ],
    },
    { type: 'heading', text: 'How to model this in RetireGolden' },
    {
      type: 'prose',
      md: "Many planners choose to model a cut to be conservative. In RetireGolden, you can toggle this on to see how a benefit cut affects your overall retirement success rate. If you turn on the haircut, the engine will pay your full scheduled benefit up to the specified year, then reduce all benefits (including spousal and survivor benefits) by the haircut percentage for the remaining years of your projection.",
    },
    {
      type: 'scenario',
      name: 'solvency haircut scenarios',
      assumptions: [
        { label: 'Standard Plan', value: '100% scheduled benefits' },
        { label: 'Combined OASDI (Trustees Default)', value: '17% cut starting in 2034' },
        { label: 'OASI Isolation (Conservative)', value: '22% cut starting in 2032' },
        { label: 'Custom Stress Test', value: 'e.g., 25% or 30% cut' },
      ],
      summary: 'Modeling a 17% or 22% cut helps identify if your plan relies too heavily on Social Security and whether you need to increase savings or delay claiming.',
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'The haircut toggle is a stress test, not a prediction of what Congress will do.',
        'Scheduled benefits remain the default because current law has not changed benefits yet.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'Under the **Social Security trust fund** heading on the **Assumptions** screen, check "Model a benefit cut." Once checked, you can customize the start year and the cut percentage.',
    },
  ],
}
