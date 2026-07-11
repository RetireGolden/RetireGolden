import type { LearningArticle } from '../learningRegistry'

export const assumptionHealthcareInflationArticle: LearningArticle = {
  slug: 'assumption-healthcare-inflation',
  title: 'Healthcare cost inflation',
  description: 'Why RetireGolden assumes healthcare costs rise faster than general inflation, and how it impacts your plan.',
  category: 'assumptions',
  tags: ['healthcare', 'inflation', 'medicare', 'medical costs'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://hvsfinancial.com/wp-content/uploads/2026/02/2026-Data-Report.pdf',
    'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles',
  ],
  relatedArticles: [
    'medicare-part-b-vs-part-d-irmaa',
    'healthcare-after-65',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/spending'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "Healthcare is one of the largest expenses in retirement, and historically, medical costs have risen significantly faster than general consumer prices. To prevent planners from underestimating their future expenses, RetireGolden applies a separate, higher inflation rate to healthcare costs.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden defaults to a **+3.0%** healthcare extra inflation rate over the general CPI (totaling 5.5% annual growth at 2.5% inflation).',
        'Studies indicate long-term retiree healthcare inflation will average **5.8%** per year, which is roughly twice the general inflation rate.',
        'Medicare Part B premiums alone are projected to increase by about **7%** annually over the long term.',
      ],
    },
    { type: 'heading', text: 'Sourcing the healthcare premium spread' },
    {
      type: 'prose',
      md: "According to the **HealthView Services 2026 Retirement Healthcare Costs Data Report**, long-term retiree healthcare inflation is projected to average **5.8%** per year. HealthView describes this as 'approximately twice the rate of CPI.' The report highlights key drivers:",
    },
    {
      type: 'list',
      items: [
        '**Medicare Part B and D Premiums:** Driven by healthcare utilization and clinical advancements, Part B premiums are expected to increase at a long-term rate of ~7.0% per year.',
        '**Age-Rating Surcharges:** Private supplemental policies (Medigap) typically include age-rating adjustments that add ~3.5% per year as you age.',
      ],
    },
    {
      type: 'prose',
      md: "RetireGolden uses a spread approach: `General Inflation + Healthcare Extra Inflation`. With a 2.5% general inflation default, adding a **+3.0%** extra inflation default yields a total healthcare growth rate of **5.5%** per year. This approximately doubles general CPI, matching the consensus long-term projections.",
    },
    { type: 'heading', text: 'The compounding impact' },
    {
      type: 'prose',
      md: "Because healthcare inflation compounds, a premium that seems manageable at age 65 can become a substantial cash-flow demand by age 85. For instance, a $5,000 annual healthcare premium growing at 5.5% will more than double to $14,500 (in future nominal dollars) in 20 years, representing a significant real-dollar increase.",
    },
    {
      type: 'scenario',
      name: 'The healthcare spread comparison',
      assumptions: [
        { label: 'General Inflation', value: '2.5%' },
        { label: 'Healthcare Premium at Age 65', value: '$6,000 / year' },
        { label: 'Option A: Grows at CPI (+0% extra)', value: 'Age 85 Premium: $6,000 (today\'s dollars)' },
        { label: 'Option B: Grows at CPI + 3% default', value: 'Age 85 Premium: $10,837 (today\'s dollars)' },
      ],
      summary: 'Under the default +3.0% extra inflation assumption, your projected age-85 premium is 80% higher in real buying power than if you assumed it only matched general inflation.',
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'Healthcare extra inflation applies on top of general inflation, so 3% means 5.5% total when general inflation is 2.5%.',
        'The default is a planning baseline, not a prediction of your own premiums, carrier, supplement, or care needs.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'You can adjust the **Healthcare extra inflation** rate on the **Assumptions** screen. The default is +3.0%. This rate is automatically applied to all healthcare expenses entered under the **Spending** step, including base premiums and Medicare supplemental costs.',
    },
  ],
}
