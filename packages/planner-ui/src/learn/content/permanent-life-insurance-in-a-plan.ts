/**
 * "Permanent life insurance in a retirement plan" - an Insurance and Estate P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const permanentLifeInsurancePlanArticle: LearningArticle = {
  slug: 'permanent-life-insurance-in-a-plan',
  title: 'Permanent life insurance in a retirement plan',
  description: 'How cash-value life insurance interacts with a retirement plan.',
  category: 'insurance-estate',
  tags: ['permanent life insurance', 'whole life', 'cash value', 'death benefit', 'estate'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'rule-change',
  sourceUrls: [
    'https://www.irs.gov/faqs/interest-dividends-other-types-of-income/life-insurance-disability-insurance-proceeds/life-insurance-disability-insurance-proceeds-1',
    'https://www.irs.gov/publications/p525',
  ],
  relatedArticles: [
    'after-tax-estate',
    'beneficiaries-and-account-titling',
    'survivor-planning-for-couples',
    'long-term-care-insurance-as-risk-transfer',
  ],
  relatedPlannerRoutes: ['/plan/:planId/insurance', '/plan/:planId/results'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Permanent life insurance combines an insurance death benefit with a cash-value component. In a retirement plan, that makes it different from term life insurance, which is mostly pure protection for a period of years.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The premium is a spending drag while the policy is active.',
        'Cash value can count as an asset while the insured is alive.',
        'The death benefit can protect a survivor or estate, but RetireGolden uses a planning-level policy model, not a policy illustration engine.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Permanent life can play several roles: survivor protection, estate liquidity, a conservative asset-like cash value, or a legacy tool. Those roles should be separated. A policy that is useful for survivor protection may not be attractive as an investment. A policy with strong cash value may still be expensive if premiums crowd out other saving.\n\nThe planning question is not "Is permanent life good or bad?" It is "What job is this policy doing in this household, and what does it cost?"',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/permanent-life-insurance-plan.webp' },
      caption:
        'Permanent life insurance has two modeled paths: cash value while living and a death benefit when the insured dies.',
      alt: 'A policy container splits into a growing cash-value path during life and a shielded death-benefit path at the insured death point.',
    },
    {
      type: 'table',
      caption: 'Permanent life inputs in a planning model.',
      columns: ['Input', 'What it represents', 'Planning caution'],
      rows: [
        ['Annual premium', 'The cost of keeping the policy in force', 'Premiums reduce cash flow even if no claim occurs soon'],
        ['Cash value', 'Policy value while the insured is alive', 'Actual values depend on the policy illustration and contract'],
        ['Cash-value schedule', 'Age-by-age policy values from an illustration', 'Usually better than assuming a flat growth rate'],
        ['Death benefit', 'Amount paid at death in the model', 'Real-world tax and estate details can depend on ownership and beneficiary structure'],
        ['Beneficiary', 'Estate or another person in the plan', 'RetireGolden does not model trusts, probate, or estate tax'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Wallace household',
      assumptions: [
        { label: 'Policy purpose', value: '$300,000 death benefit if the higher earner dies first' },
        { label: 'Cost', value: '$6,000 level annual premium paid for life' },
        { label: 'Asset side', value: '$85,000 current cash value growing from the policy illustration' },
      ],
      summary:
        'The same policy both costs and supports the plan: $6,000 leaves cash flow each year, while $85,000 of cash value and a $300,000 death benefit can support estate or survivor outcomes.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models permanent life on the **Insurance** screen. Premiums are level nominal costs. Cash value can grow at a flat rate or follow an age-by-age schedule. In the insured person\'s death year, the model pays the larger of the death benefit or cash value into the plan and zeroes the cash value so it is not counted twice.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Model note: RetireGolden does not model policy loans, surrender charges, dividends, modified endowment contract rules, trust ownership, estate tax, or premium funding strategies. Use it to understand plan-level cash flows, not to evaluate a specific policy contract.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating cash value as liquid cash without considering policy rules.',
        'Forgetting the premium drag in no-claim years.',
        'Counting both cash value and death benefit at death.',
        'Using a flat growth rate when an actual illustration schedule is available.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Insurance** to enter permanent life policies, cash value, death benefit, premium mode, and beneficiary. Use **Results** to see insurance premiums in the spending chart, and download the **Results CSV** when you need year-by-year insurance cash value and death benefit columns.',
    },
  ],
}
