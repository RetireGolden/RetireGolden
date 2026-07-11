import type { LearningArticle } from '../learningRegistry'

export const assumptionHeirTaxRateArticle: LearningArticle = {
  slug: 'assumption-heir-tax-rate',
  title: 'The heir tax rate',
  description: 'Why RetireGolden assumes a 25% tax rate on inherited traditional balances, and how the SECURE Act affects your estate.',
  category: 'assumptions',
  tags: ['estate', 'heir', 'taxes', 'traditional ira', 'secure act', '10-year rule'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
  ],
  relatedArticles: [
    'inherited-ira-10-year-rule',
    'after-tax-estate',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "When planning your legacy, it is important to realize that not all accounts are inherited equally. While taxable accounts receive a step-up in basis and Roth accounts pass to heirs tax-free, traditional tax-deferred accounts (like traditional IRAs and 401ks) carry a built-in income tax liability for your beneficiaries.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden defaults the **heir tax rate** to **25%** for the after-tax estate metric.',
        'This default reflects the typical tax bracket of adult beneficiaries who are forced to withdraw inherited tax-deferred funds under the SECURE Act.',
        'Roth accounts and taxable accounts are modeled as passing to heirs with **0%** tax drag (taxable accounts receive a step-up in basis to eliminate capital gains).',
      ],
    },
    { type: 'heading', text: 'The SECURE Act 10-year rule' },
    {
      type: 'prose',
      md: "Prior to 2020, heirs could stretch withdrawals from inherited IRAs over their own lifetimes, keeping tax bills minimal. Under the **SECURE Act (and SECURE 2.0)**, most non-spouse beneficiaries (like adult children) must fully distribute and pay tax on the entire inherited traditional account within **10 years** of the owner's death.",
    },
    {
      type: 'prose',
      md: "Because these distributions are treated as ordinary income and must occur within a tight 10-year window—often during the heirs' peak earning years—the tax rate can be substantial. A flat **25%** assumption represents a typical mid-range federal tax bracket (22% or 24%) plus a modest buffer for state income taxes.",
    },
    {
      type: 'formula',
      expression: 'After-Tax Estate = Taxable + Roth + [Traditional * (1 - Heir Tax Rate)]',
      basis: 'today',
      note: 'RetireGolden applies the heir tax rate ONLY to traditional pre-tax balances when estimating the after-tax value of your estate.',
    },
    { type: 'heading', text: 'Estate planning implications' },
    {
      type: 'prose',
      md: "If you have a large pre-tax balance, your heirs may face a significant \"tax bomb.\" To optimize your legacy, you might consider:",
    },
    {
      type: 'list',
      items: [
        '**Roth Conversions:** Converting traditional balances to Roth during your lifetime, particularly if you are in a lower bracket than your heirs will be.',
        '**Charitable Bequests:** Leaving traditional accounts to tax-exempt charities, which pay 0% tax, and leaving tax-free taxable or Roth accounts to heirs.',
      ],
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'The heir tax rate affects the after-tax estate metric; it does not change your lifetime income-tax bill.',
        'A single flat rate is a simplification. Actual heirs may face different federal, state, and timing outcomes.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'You can customize the **Heir tax rate** on the **Assumptions** screen. This percentage is used to compute the after-tax estate metric shown on the **Results** page, letting you compare the legacy impact of different withdrawal strategies.',
    },
  ],
}
