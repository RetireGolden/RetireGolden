/**
 * "Longevity risk" - a Risk and Uncertainty P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const longevityRiskArticle: LearningArticle = {
  slug: 'longevity-risk',
  title: 'Longevity risk',
  description: 'The planning challenge of not knowing how long money must last.',
  category: 'risk-uncertainty',
  tags: ['longevity', 'life expectancy', 'planning age', 'survivor years', 'monte carlo'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: ['https://www.ssa.gov/oact/STATS/table4c6.html'],
  relatedArticles: [
    'planning-for-couples-and-survivor-years',
    'spousal-and-survivor-benefits',
    'widows-penalty-and-survivor-brackets',
    'what-monte-carlo-proves',
    'long-term-care-costs-and-insurance',
  ],
  relatedPlannerRoutes: ['/plan/:planId/household', '/plan/:planId/monte-carlo', '/plan/:planId/results', '/plan/:planId/scenarios'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Longevity risk is the risk of living longer than the plan can support. It is a good problem to have personally, but it is a hard planning problem because nobody knows the exact number of years the portfolio must cover.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Life expectancy is an average, not an expiration date.',
        'Couples need to plan for survivor years, not just a single shared life span.',
        'Longer life can increase portfolio withdrawals, RMD years, healthcare exposure, and the value of inflation-protected income.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A plan that ends at age 85 asks a different question from a plan that ends at age 95 or 100. The longer horizon gives investments more time to compound, but it also gives expenses, inflation, taxes, healthcare, and withdrawals more years to accumulate.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/longevity-risk.webp' },
      caption:
        'Longevity risk is an uncertain finish line, not a single known date.',
      alt: 'A retirement path stretches toward several possible finish lines at later ages, with one household walking through survivor-year markers.',
    },
    {
      type: 'table',
      caption: 'What longer life can change.',
      columns: ['Area', 'Why longevity matters', 'Planning response'],
      rows: [
        ['Spending', 'More years of expenses must be funded', 'Test later planning ages and flexible spending'],
        ['Inflation', 'Prices have more years to compound', 'Use today\'s-dollar views and inflation stress tests'],
        ['Social Security', 'Delayed claiming and survivor benefits can matter more over longer lives', 'Compare household-level claiming outcomes'],
        ['Taxes', 'More RMD years and survivor filing years can change lifetime tax', 'Inspect Results by year, not only ending balance'],
        ['Healthcare', 'Later years may include larger healthcare and care costs', 'Model healthcare and long-term-care risk explicitly'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Franklin household',
      assumptions: [
        { label: 'Baseline planning ages', value: 'One spouse to 90, one spouse to 94' },
        { label: 'Stress test', value: 'Both live 5 years longer than the baseline' },
        { label: 'Extra funding need', value: '$70,000 of annual spending must be covered for 5 more years' },
      ],
      summary:
        'The stress test adds about **$350,000** of before-tax spending need before inflation. It also exposes whether survivor taxes and per-person costs tighten late in the plan.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden uses each person\'s planning age in the deterministic projection. On **Monte Carlo**, you can optionally model longevity so each path draws lifespans from mortality tables instead of assuming everyone lives exactly to the fixed planning age.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating life expectancy as the year the plan can safely end.',
        'Planning only until the first spouse dies.',
        'Ignoring the tax and benefit changes that happen in survivor years.',
        'Using a very late planning age without also checking whether spending flexibility is realistic.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Set planning ages in **Household**, inspect year-by-year effects in **Results**, and use **Monte Carlo** with longevity modeling when you want a distribution of possible lifespans instead of one fixed horizon.',
    },
  ],
}
