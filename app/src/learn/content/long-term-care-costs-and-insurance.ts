/**
 * "Long-term-care costs and insurance" - a Healthcare P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const longTermCareCostsInsuranceArticle: LearningArticle = {
  slug: 'long-term-care-costs-and-insurance',
  title: 'Long-term-care costs and insurance',
  description: 'The size of the long-term-care risk and ways to plan for it.',
  category: 'healthcare',
  tags: ['long-term care', 'ltc', 'insurance', 'care event', 'healthcare spending'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://acl.gov/ltc', 'https://acl.gov/ltc/costs-and-who-pays', 'https://www.medicare.gov/coverage/long-term-care'],
  relatedArticles: [
    'healthcare-after-65',
    'longevity-risk',
    'using-scenarios-to-compare-choices',
    'long-term-care-insurance-as-risk-transfer',
  ],
  relatedPlannerRoutes: ['/plan/:planId/insurance', '/plan/:planId/spending', '/plan/:planId/scenarios', '/plan/:planId/monte-carlo'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Long-term care means help with daily living or supervision over an extended period. It can happen at home, in assisted living, or in a nursing facility. The planning problem is that the cost can be large, uneven, and concentrated late in life.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Medicare generally is not a broad long-term custodial-care plan.',
        'A care event is a stress test: when care starts, how long it lasts, and how much it costs.',
        'An LTC insurance policy transfers some risk, but premiums, elimination periods, caps, and benefit periods matter.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Most retirement budgets are built around recurring spending: food, housing, taxes, insurance, travel, and healthcare premiums. Long-term care is different. It may not happen, but if it does, it can add a large cost for several years.\n\nInsurance is one way to handle that tail risk. It does not make care free. It trades premiums now for a contract that may pay part of a future care cost, subject to the policy terms.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/long-term-care-costs-insurance.webp' },
      caption:
        'Long-term-care planning compares a late-life care-cost spike with the premiums and capped benefits of an LTC policy.',
      alt: 'A retirement spending path has a late care-cost spike, while an LTC policy bucket pays a capped benefit after a waiting-period gate.',
    },
    {
      type: 'table',
      caption: 'LTC policy terms that shape the planning result.',
      columns: ['Term', 'Plain meaning', 'Why it matters'],
      rows: [
        ['Annual premium', 'What you pay for the policy', 'Reduces cash flow even if care never happens'],
        ['Elimination period', 'The waiting period before benefits begin', 'The first part of a care episode may be out of pocket'],
        ['Monthly benefit', 'The maximum monthly policy benefit', 'Care costs above the cap still hit the plan'],
        ['Benefit period', 'How long benefits can last', 'A long episode can outlast a limited policy'],
        ['Inflation rider', 'Growth in the benefit cap', 'Can help the cap keep up with future care costs'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Garcia household',
      assumptions: [
        { label: 'Care event', value: '$95,000 a year of extra care costs for three late-retirement years' },
        { label: 'Policy', value: '$5,000 monthly benefit after a waiting period, paid for up to three years' },
        { label: 'Premium drag', value: '$3,600 a year of premiums before any care event occurs' },
      ],
      summary:
        'The care event costs about **$285,000** before inflation. The policy can offset part of that shock, but the $3,600 annual premium reduces wealth in years when care never happens.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models deterministic care events and LTC insurance policies. A care event adds today-dollar annual costs for a chosen person, start age, and duration. An LTC policy on that person can offset the event after the elimination period, up to the monthly benefit cap, inflation rider, and benefit-period limit.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Monte Carlo can also sample an optional long-term-care shock. That sampled episode is added as a care event, so the same policy mechanics apply.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming Medicare will cover an extended custodial-care need.',
        'Comparing an LTC policy only by premium, without modeling benefit caps and waiting periods.',
        'Forgetting that a couple may face care risk for either spouse.',
        'Treating one deterministic care event as the only possible future.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Insurance** to enter LTC policies and care events. Use **Scenarios** for a deterministic long-term-care shock, and **Monte Carlo** if you want to include optional sampled LTC shocks in the risk view.',
    },
  ],
}
