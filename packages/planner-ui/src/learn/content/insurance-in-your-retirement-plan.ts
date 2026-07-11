import type { LearningArticle } from '../learningRegistry'

export const insuranceInYourRetirementPlanArticle: LearningArticle = {
  slug: 'insurance-in-your-retirement-plan',
  title: 'Insurance in your retirement plan',
  description: 'How permanent life and long-term-care insurance change retirement cash flows and risks.',
  category: 'insurance-estate',
  tags: ['insurance', 'permanent life', 'whole life', 'long-term care', 'ltc', 'risk transfer'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-02',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/faqs/interest-dividends-other-types-of-income/life-insurance-disability-insurance-proceeds',
    'https://www.law.cornell.edu/uscode/text/26/7702',
    'https://content.naic.org/consumer/life-insurance.htm',
    'https://content.naic.org/insurance-topics/life-insurance',
    'https://www.medicare.gov/coverage/long-term-care',
    'https://www.carescout.com/cost-of-care',
    'https://investor.genworth.com/news-events/press-releases/detail/1054/carescout-releases-2025-cost-of-care-survey-results',
  ],
  relatedArticles: [
    'permanent-life-insurance-in-a-plan',
    'long-term-care-insurance-as-risk-transfer',
    'long-term-care-costs-and-insurance',
    'after-tax-estate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/insurance', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Insurance belongs in a retirement plan when it changes a risk the household cannot easily carry alone. RetireGolden focuses on two products that can change long-run outcomes: permanent life insurance and long-term-care (LTC) insurance.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Permanent life is both protection and an asset-like cash value, but the premium drag matters.',
        'LTC insurance is risk transfer: premiums in ordinary years for help if a large care event happens.',
        'The right question is not whether a product is good or bad; it is what job it does in this plan.',
      ],
    },
    { type: 'heading', text: 'The two products RetireGolden models' },
    {
      type: 'table',
      caption: 'Planning role, upside, and tradeoff.',
      columns: ['Product', 'Planning role', 'Potential upside', 'Main tradeoff'],
      rows: [
        [
          'Permanent life',
          'Survivor protection, estate liquidity, or conservative cash-value asset.',
          'Cash value can support net worth while living; death benefit can support heirs or a survivor.',
          'Premiums may crowd out saving, and policy cash value is not the same as a simple investment account.',
        ],
        [
          'Long-term-care insurance',
          'Transfer part of a late-life care shock away from the household.',
          'Can protect a survivor or estate if care costs arrive.',
          'Premiums are paid even in no-care paths, and benefits are capped by policy terms.',
        ],
      ],
    },
    { type: 'heading', text: 'Is permanent life an investment?' },
    {
      type: 'prose',
      md: 'Sometimes, but that label can confuse the decision. A cash-value policy can build value over time, and NAIC consumer guidance describes whole life and universal life as cash-value policies with savings or investment features. But the policy also has insurance costs, fees, surrender rules, loan rules, and a death benefit.\n\nRetireGolden treats permanent life as a planning asset plus an insurance payout. Cash value counts while the insured is alive. At death, the model pays the larger modeled death benefit or cash value into the plan and avoids counting both. The IRS generally excludes death-benefit proceeds paid because of the insured person\'s death from gross income, though interest and some transfer-for-value situations can be taxable.',
    },
    { type: 'heading', text: 'What LTC insurance transfers' },
    {
      type: 'prose',
      md: 'Medicare.gov says Medicare does not pay for most non-medical long-term care or custodial care. That is why a care event can be a large household risk. CareScout\'s 2025 national median figures put assisted living at **$6,200 per month**, a semi-private nursing-home room at **$9,581 per month**, and a private nursing-home room at **$10,798 per month**.\n\nAn LTC policy does not make those costs disappear. It offsets costs after the elimination period, up to the monthly benefit, benefit period, and inflation rider. The stress test asks whether that transfer is worth the premiums in this plan.',
    },
    {
      type: 'scenario',
      name: 'The Alvarez household',
      assumptions: [
        { label: 'Permanent life', value: '$250,000 death benefit, $70,000 cash value, $4,800 annual premium' },
        { label: 'LTC policy', value: '$5,500 monthly benefit, 3-year benefit period, 90-day elimination period' },
        { label: 'Care event', value: '$110,000 per year for 3 years starting at age 86' },
        { label: 'Planning question', value: 'Does the insured care path protect the survivor enough to justify no-care premiums?' },
      ],
      summary:
        'The policy values are not judged in isolation. The plan compares the premium drag, survivor protection, care shock, and ending estate together.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating permanent-life cash value as if it were a free investment account with no insurance cost.',
        'Counting both cash value and death benefit after the insured person dies.',
        'Assuming Medicare broadly covers long-term custodial care.',
        'Entering an LTC benefit but forgetting the elimination period, benefit period, or inflation rider.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Insurance** to enter permanent-life policies, LTC policies, and care events. Add a care event to turn on the LTC stress test. Use **Results** to see premium spending, insurance cash value, death benefits, care costs, and ending net worth.',
    },
  ],
}
