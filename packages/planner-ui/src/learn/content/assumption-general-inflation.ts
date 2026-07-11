import type { LearningArticle } from '../learningRegistry'

export const assumptionGeneralInflationArticle: LearningArticle = {
  slug: 'assumption-general-inflation',
  title: 'General inflation',
  description: 'Why RetireGolden assumes a 2.5% general inflation rate, and how it impacts your retirement buying power.',
  category: 'assumptions',
  tags: ['inflation', 'cpi', 'buying power', 'purchasing power'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/oact/TR/2025/2025_Long-Range_Economic_Assumptions.pdf',
    'https://www.cbo.gov/publication/62105',
    'https://www.philadelphiafed.org/surveys-and-data/real-time-data-research/spf-q2-2026',
  ],
  relatedArticles: [
    'todays-dollars-vs-future-dollars',
    'understanding-your-plan-assumptions',
    'inflation-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "Inflation is the quiet force that erodes the purchasing power of your money over time. RetireGolden's projection engine runs in future nominal dollars, then the Results view can deflate those figures back into **today's dollars** so you can compare them to prices you recognize.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden defaults to a **2.5%** annual inflation rate, representing a long-term economic baseline.',
        'This default is aligned with the Social Security Trustees long-range CPI-W estimate of 2.4% and professional forecaster surveys (~2.4%).',
        "The engine grows future cash flows in nominal dollars, while today's-dollar displays discount those results back to true buying power.",
      ],
    },
    { type: 'heading', text: 'Why 2.5%?' },
    {
      type: 'prose',
      md: "No one can predict inflation over a 30-year horizon, but we can look to primary economic anchors for a sensible starting point. RetireGolden's default is built on three key benchmarks:",
    },
    {
      type: 'list',
      items: [
        '**Social Security Trustees:** In their 2025 report, the Trustees assume an ultimate long-range annual increase in the CPI-W of **2.4%** under their intermediate cost scenario.',
        '**Congressional Budget Office (CBO):** The CBO\'s long-term economic outlook projects PCE inflation to settle at the Federal Reserve\'s **2.0%** target, with CPI-U averaging roughly **2.2%** to **2.3%** annually.',
        '**Survey of Professional Forecasters:** The Philadelphia Fed\'s Q2 2026 survey indicates a 10-year median CPI expectation of **2.4%**.',
      ],
    },
    {
      type: 'prose',
      md: "RetireGolden adopts **2.5%** as a rounded, slightly conservative default. It sits just above the official long-term forecasts, providing a small safety margin.",
    },
    { type: 'heading', text: 'How inflation affects your plan' },
    {
      type: 'prose',
      md: "If you have fixed income sources that do not adjust for inflation (like many traditional pensions or fixed annuities), a 2.5% inflation rate will cut their purchasing power in half in approximately 29 years. Conversely, cost-of-living adjustments (like Social Security COLA) help protect your buying power by rising in tandem with inflation.",
    },
    {
      type: 'formula',
      expression: 'Buying Power = Nominal Amount / (1 + Inflation Rate)^Years',
      basis: 'today',
      note: 'This formula calculates how much today\'s money is worth in the future under a constant inflation rate.',
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        "Do not compare a nominal future balance directly against today's spending.",
        'A single long-run average can hide short inflation bursts, which is why Scenarios and Monte Carlo still matter.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: "You can adjust the inflation rate on the **Assumptions** screen. The default of 2.5% is applied plan-wide. When you run Monte Carlo simulations, RetireGolden varies the inflation rate around this average to model inflation volatility and the way inflation interacts with market returns.",
    },
  ],
}
