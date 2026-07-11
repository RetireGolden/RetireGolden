/**
 * "Rule of 55 and 72(t) basics" - a Withdrawals and Roth P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const ruleOf55And72tArticle: LearningArticle = {
  slug: 'rule-of-55-and-72t',
  title: 'Rule of 55 and 72(t) basics',
  description: 'Penalty-free ways to reach retirement money before age 59 1/2.',
  category: 'withdrawals-roth',
  tags: ['rule of 55', '72(t)', 'sepp', 'early withdrawals', 'traditional ira', '401(k)', 'penalty'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-exceptions-to-tax-on-early-distributions',
    'https://www.irs.gov/retirement-plans/substantially-equal-periodic-payments',
    'https://www.irs.gov/publications/p590b',
  ],
  relatedArticles: [
    'withdrawal-order-basics',
    'roth-conversion-basics',
    'paying-conversion-taxes-taxable-vs-ira',
    'inherited-ira-10-year-rule',
    'rmds-required-minimum-distributions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'The Rule of 55 and 72(t) substantially equal periodic payments are two ways early retirees may reach retirement money before the usual 59 1/2 penalty age. They can remove the extra penalty, but they do not make taxable retirement money tax-free.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The Rule of 55 generally applies to an employer plan tied to the job you leave at 55 or later.',
        'A 72(t) SEPP series can apply to IRA or plan money, but the payment schedule must be respected.',
        'Penalty-free does not mean tax-free. Traditional-account distributions are still usually ordinary income.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Early retirement often creates a bridge problem. You may have enough money on paper, but much of it may sit in traditional retirement accounts. Taking that money too early can create income tax plus an extra 10% early-distribution tax unless an exception applies.\n\nThe Rule of 55 is a narrow employer-plan exception. A 72(t) SEPP is a more formal payment series. Both are planning tools with strings attached. They can help bridge a gap, but they should be compared against cash, taxable accounts, Roth contribution basis, conversion ladders, and delaying spending.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/rule-of-55-72t.webp' },
      caption:
        'Early-access rules are bridges across the pre-59 1/2 gap, but each bridge has its own gate and commitment.',
      alt: 'A retirement timeline before age 60 shows two gated bridges from traditional accounts to spending: one employer-plan bridge and one scheduled-payment bridge.',
    },
    {
      type: 'table',
      caption: 'Two penalty exceptions are often confused.',
      columns: ['Path', 'What it can do', 'Main caution'],
      rows: [
        ['Rule of 55', 'May waive the 10% penalty for an employer plan after separating from service at 55 or later', 'Usually does not apply to IRAs or old plans from earlier jobs'],
        ['72(t) SEPP', 'May create penalty-free periodic payments before 59 1/2', 'Changing the series too early can create retroactive penalties'],
        ['Roth basis', 'Direct Roth contributions may be accessible without tax or penalty', 'Conversions and earnings have their own ordering and timing rules'],
        ['Cash or taxable', 'Can fund the bridge without retirement-account penalty rules', 'May reduce liquidity or realize capital gains'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Ortiz household',
      assumptions: [
        { label: 'Retirement age', value: 'One spouse retires at 56' },
        { label: 'Largest account', value: '$480,000 employer plan from the job just left' },
        { label: 'Bridge need', value: '$40,000 a year for four years before the normal penalty age' },
      ],
      summary:
        'The bridge need is about **$160,000** before taxes. Keeping the employer-plan bucket available may matter more than rolling everything into an IRA right away.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden approximates the 59 1/2 penalty boundary as age 60. It can waive the traditional early-withdrawal penalty for an employer plan when the owner separates at age 55 or later, using the person\'s retirement age as the separation-age proxy. It can also model 72(t) SEPP distributions on non-inherited traditional accounts, using either an RMD-style method or an amortization-style method.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'Model note: RetireGolden assumes the 72(t) series is honored. It does not model busting a SEPP schedule, retroactive penalties, plan-specific distribution limits, or every IRS exception.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Rolling an employer plan to an IRA without checking whether the Rule of 55 would have helped.',
        'Treating 72(t) as flexible spending money instead of a payment commitment.',
        'Forgetting that traditional distributions still raise taxable income and MAGI.',
        'Assuming every early-withdrawal exception is modeled in RetireGolden.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Household** for retirement ages, **Accounts** to mark traditional accounts as IRA or employer plan and add 72(t) settings, and **Results** to inspect penalties, withdrawals, tax, and MAGI year by year.',
    },
  ],
}
