import type { LearningArticle } from '../learningRegistry'

export const whatRetirementHealthcareReallyCostsArticle: LearningArticle = {
  slug: 'what-retirement-healthcare-really-costs',
  title: 'What retirement healthcare really costs',
  description: 'How to source the healthcare numbers you enter in Spending.',
  category: 'healthcare',
  tags: ['healthcare costs', 'medicare', 'aca', 'part b', 'part d', 'irmaa', 'premium tax credit'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-02',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.cms.gov/newsroom/fact-sheets/2026-medicare-parts-b-premiums-deductibles',
    'https://www.medicare.gov/basics/costs/medicare-costs',
    'https://www.medicare.gov/publications/11579-medicare-costs.pdf',
    'https://www.kff.org/affordable-care-act/state-indicator/marketplace-average-benchmark-premiums/',
    'https://www.cms.gov/newsroom/fact-sheets/plan-year-2026-marketplace-plans-prices-fact-sheet',
    'https://www.healthcare.gov/retirees/',
    'https://www.kff.org/interactive/subsidy-calculator/',
    'https://newsroom.fidelity.com/pressreleases/fidelity-investments--releases-2025-retiree-health-care-cost-estimate--a-timely-reminder-for-all-gen/s/3c62e988-12e2-4dc8-afb4-f44b06c6d52e',
  ],
  relatedArticles: [
    'healthcare-before-65',
    'healthcare-after-65',
    'aca-premium-tax-credits-and-magi',
    'irmaa-two-year-lookback',
    'assumption-healthcare-inflation',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Healthcare is one of the easiest retirement costs to understate because the bill is split across premiums, deductibles, copays, drug costs, and income-based surcharges. RetireGolden separates the recurring premium inputs from the costs it can model from published rules.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Before 65, start with the full marketplace or retiree-plan premium before any subsidy.',
        'At 65 and later, RetireGolden already adds standard Medicare Part B and IRMAA; enter the extra recurring coverage you choose.',
        'Healthcare cost guidance changes every year, so use current quotes and treat national averages as a check, not a quote.',
      ],
    },
    { type: 'heading', text: 'The current numbers to anchor on' },
    {
      type: 'prose',
      md: 'For 2026, CMS set the standard Medicare Part B premium at **$202.90 per month** and the annual Part B deductible at **$283**. Medicare.gov lists the same Part B premium and notes that Part D, Medicare Advantage, and Medigap costs vary by plan.\n\nFor pre-65 marketplace coverage, KFF reports a **$625 monthly national average benchmark premium for 2026** for a 40-year-old second-lowest-cost Silver plan, weighted by county selections. Older early retirees usually cost more than a 40-year-old, and premiums vary by state and county, so use a quote for your household when you can.',
    },
    {
      type: 'table',
      caption: 'How to fill the Spending healthcare fields.',
      columns: ['Spending field', 'What to enter', 'Where the number comes from'],
      rows: [
        [
          'Pre-65 premium / person / month',
          'The full unsubsidized monthly premium for one person before any premium tax credit.',
          'Marketplace quote, retiree-plan quote, COBRA bill, or KFF benchmark data as a rough check.',
        ],
        [
          'Apply ACA premium credit',
          'Turn on only when modeling marketplace coverage that can receive the premium tax credit.',
          'HealthCare.gov eligibility rules and your household MAGI; the final credit is reconciled on Form 8962.',
        ],
        [
          'Medicare extras / person / month',
          'Recurring coverage beyond Part B: Part D, Medigap, Medicare Advantage, dental, vision, or similar premiums.',
          'Medicare Plan Finder, insurer quote, employer retiree plan materials, or current plan notices.',
        ],
        [
          'Baseline annual spending',
          'Routine out-of-pocket healthcare not entered elsewhere: copays, deductibles, dental, vision, hearing, and over-the-counter costs.',
          'Your recent spending, HSA records, insurer statements, or a conservative household estimate.',
        ],
      ],
    },
    { type: 'heading', text: 'Premium tax credits and MAGI' },
    {
      type: 'prose',
      md: 'The ACA premium tax credit lowers marketplace premiums for eligible households. HealthCare.gov explains that retirees who lose job-based coverage can use the Marketplace, and that eligibility for credits depends on income and household size. KFF summarizes the current subsidy schedule as a household contribution toward the benchmark Silver plan, with the government paying the rest through the credit.\n\nThat is why Roth conversions, IRA withdrawals, capital gains, and Social Security taxation can change healthcare costs before 65. They can raise modified adjusted gross income (MAGI), which can reduce or eliminate the credit.',
    },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Ages', value: '63 and 61, not yet on Medicare' },
        { label: 'Marketplace quote', value: '$1,850 per month for both before credits' },
        { label: 'Subsidized estimate', value: '$620 per month after projected premium tax credit' },
        { label: 'Planning entry', value: '$925 per person per month, with Apply ACA premium credit turned on' },
      ],
      summary:
        'They enter the full premium so RetireGolden can test the credit against MAGI. The subsidized premium is useful for budgeting, but the full premium is the right input for the field.',
    },
    { type: 'heading', text: 'How this fits healthcare inflation' },
    {
      type: 'prose',
      md: 'RetireGolden\'s healthcare inflation assumption is an extra rate on top of general inflation. The default extra rate is **3%**, so a 2.5% general-inflation assumption means healthcare costs grow at about 5.5% nominal before any rule-specific changes.\n\nThat does not replace current-year values. Start with current quotes and published Medicare values, then let the assumption carry those costs forward in the projection.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Entering the subsidized ACA premium as the full pre-65 premium, then turning on the credit again.',
        'Adding Part B manually in Medicare extras even though RetireGolden already adds it at 65+.',
        'Ignoring the two-year IRMAA lookback when planning conversions around age 63 and later.',
        'Using Fidelity or other lifetime estimates as a monthly premium quote. They are useful scale checks, not a plan-specific bill.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** for pre-65 premiums, the ACA credit switch, and Medicare extras. Use **Assumptions** for healthcare inflation and recent MAGI. Use **Results** to inspect annual healthcare costs, taxes, and MAGI-sensitive premiums together.',
    },
  ],
}
