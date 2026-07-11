import type { LearningArticle } from '../learningRegistry'

export const assumptionInvestmentReturnsArticle: LearningArticle = {
  slug: 'assumption-investment-returns',
  title: 'Investment returns and volatility',
  description: 'How RetireGolden models investment growth, historical averages, and forward-looking returns.',
  category: 'assumptions',
  tags: ['returns', 'investing', 'volatility', 'stocks', 'bonds', 'monte carlo'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://corporate.vanguard.com/content/corporatesite/us/en/corp/vemo/2026-outlook-economic-upside-stock-market-downside.html',
    'https://am.jpmorgan.com/us/en/asset-management/adv/insights/portfolio-insights/ltcma/',
  ],
  relatedArticles: [
    'sequence-of-returns-risk',
    'historical-vs-random-return-models',
    'inflation-risk',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/accounts'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "Retirement assets grow through compounding investment returns, but the future rate of return is highly uncertain. To build a reliable plan, planners must balance the long-term historical records with forward-looking capital-market expectations.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden defaults to a **5.5%** blended plan-wide nominal return rate.',
        'This represents a balanced, slightly conservative return that sits below long-run historical averages but aligns with forward-looking institutional outlooks.',
        'For individual asset classes, RetireGolden\'s UI estimator uses illustrative nominal returns of **7% for stocks**, **4% for bonds**, and **2.5% for cash**.',
        'Volatility (standard deviation) is modeled around **16%** for stocks and **6%** for bonds, which drives the Monte Carlo uncertainty analysis.',
      ],
    },
    { type: 'heading', text: 'Historical averages vs. forward outlooks' },
    {
      type: 'prose',
      md: "Over the last century (1926–present), a classic US 60/40 balanced portfolio (60% large-cap stocks, 40% intermediate bonds) has averaged nominal returns of **8% to 9%** per year. However, institutional forecasters warn that forward-looking returns over the next 10–15 years may be lower due to higher equity valuations and moderate interest rates:",
    },
    {
      type: 'table',
      caption: '2026 Capital Market Assumptions (Nominal 10-15 Yr Outlook)',
      columns: ['Asset Class', 'Vanguard VEMO 2026', 'J.P. Morgan LTCMA 2026', 'Historical Average'],
      rows: [
        ['**US Large-Cap Equity**', '4.0% – 5.0%', '6.7%', '~10.0%'],
        ['**US Aggregate Bonds**', '~4.0%', '4.6%', '~5.0%'],
        ['**60/40 Balanced Portfolio**', '4.0% – 4.6%', '6.4%', '~8.5%'],
      ],
    },
    {
      type: 'prose',
      md: "RetireGolden's **5.5%** blended default sits at a sensible midpoint. It accounts for potential fees, investment drags, and the possibility of lower-than-average returns over your specific retirement horizon.",
    },
    { type: 'heading', text: 'The role of volatility and sequence risk' },
    {
      type: 'prose',
      md: "Returns never arrive in a smooth, linear fashion. Volatility is the measure of how much returns deviate from the average in any given year. In RetireGolden, the Monte Carlo engine applies standard deviations (σ) representing typical historical swings:",
    },
    {
      type: 'list',
      items: [
        '**US Stocks:** Volatility is modeled at **σ ≈ 16%** (returns generally fall between −9% and +25% in 2 out of 3 years).',
        '**US Bonds:** Volatility is modeled at **σ ≈ 6%** (safer, tighter range of fluctuations).',
      ],
    },
    {
      type: 'prose',
      md: "This volatility is critical because of **sequence-of-returns risk**: suffering a market downturn early in retirement, while you are actively withdrawing money, can deplete a portfolio much faster than experiencing the same downturn later in life.",
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'Do not read the 5.5% default as a forecast for your portfolio.',
        'If account-level return assumptions differ from the plan default, those account-level values take precedence.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'You can adjust the **Default return** on the **Assumptions** screen. This rate applies to any account that does not specify its own expected return. In the **Accounts** step, you can customize returns for individual accounts, or use the estimator to blend returns based on your allocation (using the Stocks/Bonds/Cash returns listed above).',
    },
  ],
}
