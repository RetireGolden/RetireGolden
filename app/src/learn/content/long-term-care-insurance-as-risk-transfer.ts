/**
 * "Long-term-care insurance as risk transfer" - an Insurance and Estate P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const longTermCareInsuranceRiskTransferArticle: LearningArticle = {
  slug: 'long-term-care-insurance-as-risk-transfer',
  title: 'Long-term-care insurance as risk transfer',
  description: 'When paying premiums to offload tail risk can make sense.',
  category: 'insurance-estate',
  tags: ['long-term care', 'ltc insurance', 'risk transfer', 'premiums', 'care event'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://acl.gov/ltc', 'https://acl.gov/ltc/costs-and-who-pays', 'https://www.medicare.gov/coverage/long-term-care'],
  relatedArticles: [
    'long-term-care-costs-and-insurance',
    'longevity-risk',
    'survivor-planning-for-couples',
    'using-scenarios-to-compare-choices',
  ],
  relatedPlannerRoutes: ['/plan/:planId/insurance', '/plan/:planId/scenarios', '/plan/:planId/monte-carlo', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Long-term-care insurance is not mainly a bet that you will "win" against the insurer. It is a way to transfer some late-life care risk away from the household balance sheet. The right question is often whether the premium buys enough protection against an outcome the household cannot comfortably self-fund.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Insurance can be valuable even when the expected payout is less than total premiums.',
        'The policy terms decide how much risk is actually transferred.',
        'RetireGolden compares care with no policy, care with a policy, and a no-care baseline so the premium tradeoff is visible.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A household can self-insure a risk when it has enough assets to absorb the bad outcome. A household transfers risk when it pays premiums so an insurer absorbs some of that bad outcome instead.\n\nLong-term care is a natural risk-transfer topic because costs can be large, uncertain, and emotionally hard to manage. A policy can protect the estate or the surviving spouse, but only up to its benefit cap, after its waiting period, and for its benefit period.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/long-term-care-insurance-risk-transfer.webp' },
      caption:
        'Risk transfer trades steady premiums for a capped insurance response if a large care-cost event occurs.',
      alt: 'A household balance sheet sends small premium streams to an insurance shield, which later absorbs part of a large care-cost wave.',
    },
    {
      type: 'table',
      caption: 'Risk transfer questions to ask before modeling a policy.',
      columns: ['Question', 'Why it matters', 'App input or result'],
      rows: [
        ['Can the plan self-fund care?', 'A strong balance sheet may need less transfer', 'Compare care uninsured with no care'],
        ['Who is protected?', 'Couples may be protecting the survivor more than the first spouse', 'Policy owner and care-event person'],
        ['What is the cap?', 'A small monthly benefit may leave large costs uncovered', 'Monthly benefit and inflation rider'],
        ['How long can benefits last?', 'Long episodes can outlast the policy', 'Benefit period'],
        ['What do premiums cost in paths with no care?', 'Premiums reduce wealth even if no care event happens', 'No-care baseline versus insured case'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Howard household',
      assumptions: [
        { label: 'Concern', value: 'One spouse may need $90,000 a year of paid care for four years' },
        { label: 'Policy', value: '$4,500 annual premium, then up to $6,000 monthly benefit after the waiting period' },
        { label: 'Survivor lens', value: 'Without benefits, the care path spends down roughly $360,000 before inflation' },
      ],
      summary:
        'The policy may lower the no-care estate because of premiums, but it buys protection against a care path that could consume about **$360,000** and weaken the survivor plan.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The **Insurance** screen can show an LTC stress test once a care event exists. RetireGolden compares no care with LTC policies held out, care with policies removed, and care with the plan\'s LTC policies included. The difference makes the raw care shock and the policy value net of premiums easier to see.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Judging the policy only by whether it has a positive expected payout.',
        'Ignoring the elimination period and benefit period.',
        'Assuming Medicare covers long-term custodial care broadly.',
        'Forgetting that premiums are paid in the good paths too.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Insurance** to enter LTC policies and care events. Use **Scenarios** and **Monte Carlo** to test care shocks, then inspect **Results** for estate, spending, premiums, and shortfalls.',
    },
  ],
}
