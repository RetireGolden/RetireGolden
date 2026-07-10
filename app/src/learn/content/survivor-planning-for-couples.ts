/**
 * "Survivor planning for couples" - an Insurance and Estate P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const survivorPlanningForCouplesArticle: LearningArticle = {
  slug: 'survivor-planning-for-couples',
  title: 'Survivor planning for couples',
  description: 'Making sure the surviving spouse is financially secure.',
  category: 'insurance-estate',
  tags: ['survivor planning', 'couples', 'life insurance', 'social security', 'widow penalty', 'beneficiaries'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/benefits/survivors/',
    'https://www.irs.gov/forms-pubs/about-publication-501',
    'https://www.irs.gov/filing/federal-income-tax-rates-and-brackets',
  ],
  relatedArticles: [
    'planning-for-couples-and-survivor-years',
    'widows-penalty-and-survivor-brackets',
    'spousal-and-survivor-benefits',
    'permanent-life-insurance-in-a-plan',
    'beneficiaries-and-account-titling',
  ],
  relatedPlannerRoutes: [
    '/plan/:planId/household',
    '/plan/:planId/social-security',
    '/plan/:planId/insurance',
    '/plan/:planId/survivor',
    '/plan/:planId/results',
    '/plan/:planId/report',
  ],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Survivor planning asks whether the plan still works after the first spouse dies. It is not only about life insurance. It includes Social Security, pensions, account ownership, beneficiaries, taxes, spending, healthcare, and how easy the plan is for one person to manage.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The surviving spouse may keep less income but still carry many fixed expenses.',
        'Social Security claiming can affect the survivor income floor.',
        'Insurance and beneficiary choices should be tested against the survivor years, not only the couple years.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A couple plan can look strong while both people are alive because two Social Security checks, two pensions, or two work histories support one household. After the first death, income may fall and tax brackets may narrow. The survivor may also have less capacity or desire to manage a complex withdrawal strategy.\n\nGood survivor planning turns that vague worry into a checklist: income floor, tax shape, liquidity, insurance, beneficiaries, and simplicity.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/survivor-planning-couples.webp' },
      caption:
        'Survivor planning follows the plan after one spouse dies, checking income, tax, liquidity, and protection for the remaining spouse.',
      alt: 'A couple retirement path splits after one spouse dies, with the survivor path supported by Social Security, insurance, liquidity, and beneficiary markers.',
    },
    {
      type: 'table',
      caption: 'A practical survivor-planning checklist.',
      columns: ['Area', 'Question', 'RetireGolden lens'],
      rows: [
        ['Income floor', 'What income continues after the first death?', 'Social Security, pensions, annuities, wages'],
        ['Taxes', 'Does the survivor face narrower brackets?', 'Filing status, RMDs, MAGI, after-tax estate'],
        ['Liquidity', 'Can the survivor pay near-term bills without forced sales?', 'Cash, taxable accounts, withdrawal order'],
        ['Insurance', 'Does a death benefit or LTC policy protect the weak point?', 'Permanent life, LTC stress test'],
        ['Beneficiaries', 'Will assets reach the intended person efficiently?', 'Account ownership and policy beneficiary fields'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Nguyen household',
      assumptions: [
        { label: 'Higher earner', value: '$3,100 monthly Social Security benefit and a $250,000 life policy' },
        { label: 'Survivor risk', value: 'The surviving spouse keeps the house and about 75% of spending' },
        { label: 'Policy cost', value: '$4,000 annual premium lowers couple-year cash flow' },
      ],
      summary:
        'The policy costs $4,000 a year while both are alive, but the $250,000 death benefit can protect survivor years when one Social Security check stops and tax brackets narrow.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden continues the projection through each person\'s planning age. It models the Social Security survivor step-up, survivor filing status, insurance premiums and death benefits, account ownership, and spending through the later years. That makes survivor years visible in **Results** and **Report**.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Stopping the analysis when the first spouse dies.',
        'Assuming one spouse\'s death cuts spending by half.',
        'Ignoring the survivor effect when deciding Social Security claiming ages.',
        'Treating beneficiary forms as paperwork instead of part of the plan.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Household** for planning ages, **Social Security** for benefits and claiming, **Insurance** for life and LTC protection, and **Results** to read the survivor years after the first death.',
    },
  ],
}
