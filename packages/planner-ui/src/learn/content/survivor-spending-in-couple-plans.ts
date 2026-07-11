/**
 * "Survivor spending in couple plans" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const survivorSpendingInCouplePlansArticle: LearningArticle = {
  slug: 'survivor-spending-in-couple-plans',
  title: 'Survivor spending in couple plans',
  description: 'How the survivor spending percentage changes recurring lifestyle costs after the first death.',
  category: 'using-retiregolden',
  tags: ['survivor', 'couples', 'spending', 'widow penalty', 'budget'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-06',
  reviewCadence: 'rule-change',
  sourceUrls: [
    'https://www.ssa.gov/benefits/survivors/',
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
    'https://www.bls.gov/cex/',
  ],
  relatedArticles: [
    'planning-for-couples-and-survivor-years',
    'survivor-planning-for-couples',
    'widows-penalty-and-survivor-brackets',
    'spousal-and-survivor-benefits',
    'building-a-retirement-spending-budget',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/spending',
    '/plan/:planId/household',
    '/plan/:planId/insurance',
    '/plan/:planId/survivor',
    '/plan/:planId/results',
    '/plan/:planId/scenarios',
  ],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A couple plan can look strong while both spouses are alive and still deserve a separate survivor-year check. Income often falls, filing status may change, and household costs usually do not fall in half.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Survivor spending applies only in years when exactly one spouse is alive.',
        'It scales baseline spending and phase-adjusted lifestyle spending, not every cost in the ledger.',
        'One-time goals, healthcare premiums, debt payments, property costs, and insurance premiums keep their own schedules.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The survivor spending field answers a practical question: what share of the couple lifestyle budget would one spouse still need? A value of 100% means no change. A value of 75% means the recurring lifestyle portion falls by one quarter in survivor years.\n\nThis is separate from Social Security survivor benefits, tax filing status, pensions, insurance, and healthcare. RetireGolden models those items through their own inputs so the survivor percentage does not double-count them.',
    },
    {
      type: 'table',
      caption: 'What survivor spending changes.',
      columns: ['Cost type', 'Scaled by survivor spending?', 'Why'],
      rows: [
        ['Baseline lifestyle spending', 'Yes', 'It is the recurring household lifestyle budget'],
        ['Spending phases', 'Yes', 'The phase multiplier applies first, then the survivor percentage scales the result'],
        ['One-time goals', 'No', 'A named goal happens on its own schedule unless you edit or remove it'],
        ['Healthcare premiums', 'No', 'Healthcare is per-person or rule-driven elsewhere in the model'],
        ['Debt, property, and insurance costs', 'No', 'Those costs follow the account or policy inputs you entered'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Moreno household',
      assumptions: [
        { label: 'Couple baseline spending', value: '$88,000 per year in today\'s dollars' },
        { label: 'Survivor spending setting', value: '75%' },
        { label: 'Survivor-year lifestyle spending', value: '$66,000 before inflation and before separate costs' },
        { label: 'Still separate', value: 'Medicare, property tax, debt service, and a planned car replacement' },
      ],
      summary:
        'The survivor setting lowers the recurring lifestyle budget, but the ledger still includes separate costs that may not fall just because one person has died.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming one-person spending should be exactly 50% of couple spending.',
        'Lowering survivor spending and also manually removing costs that RetireGolden already stops or changes elsewhere.',
        'Forgetting that a surviving spouse may face smaller Social Security income and different tax brackets at the same time.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** to set the survivor percentage. Use **Results** to inspect survivor years in the ledger, and use **Scenarios** if you want to compare 100%, 80%, and 70% survivor-spending assumptions before deciding what belongs in the base plan.',
    },
  ],
}
