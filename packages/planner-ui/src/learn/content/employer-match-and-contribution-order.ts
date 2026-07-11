/**
 * "Employer match and contribution order" - an Accounts and Saving P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const employerMatchAndContributionOrderArticle: LearningArticle = {
  slug: 'employer-match-and-contribution-order',
  title: 'Employer match and contribution order',
  description: 'A common priority order for where each saved dollar should go.',
  category: 'accounts-saving',
  tags: ['employer match', 'contribution order', '401k', 'hsa', 'ira', 'saving priority'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-contributions',
    'https://www.irs.gov/retirement-plans/401k-plans',
    'https://www.irs.gov/forms-pubs/about-publication-969',
  ],
  relatedArticles: [
    'traditional-vs-roth-contributions',
    'hsas-as-retirement-accounts',
    'account-types-overview',
    'fees-expense-ratios-and-compounding-drag',
    'taxable-brokerage-basis-and-capital-gains',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/scenarios', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Contribution order is the order in which a household directs new savings. It is not only about return. It is also about employer match, tax treatment, fees, liquidity, contribution limits, and whether the money may be needed before retirement.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'An employer match is often the first retirement-savings target because it can add money you would otherwise leave behind.',
        'Tax-advantaged accounts have rules, limits, and access constraints, so the best order depends on the household.',
        'After the match, compare HSA, IRA, employer plan, debt payoff, cash reserves, and taxable brokerage by purpose and flexibility.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A common savings order starts with enough cash to avoid forced bad decisions, then captures the full employer match, then weighs high-interest debt, HSA eligibility, IRA or 401(k) contributions, and taxable brokerage. That order is a framework. A household with unstable income, large medical expenses, or unusually good employer-plan options may reasonably choose a different path.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/employer-match-contribution-order.webp' },
      caption:
        'A contribution order helps each saved dollar climb from urgent needs toward long-term investment buckets.',
      alt: 'A savings dollar climbs a staircase from cash reserve to employer match, HSA, retirement accounts, and taxable brokerage, with a small employer match marker near the bottom.',
    },
    {
      type: 'table',
      caption: 'One practical order to test, not a universal rule.',
      columns: ['Priority', 'Why it often comes early', 'Why it might move'],
      rows: [
        ['Cash buffer', 'Prevents emergencies from becoming expensive withdrawals or debt', 'A household with secure income may need a smaller buffer'],
        ['Employer match', 'Can add employer dollars on top of your own contribution', 'Vesting, plan quality, and cash-flow limits still matter'],
        ['High-interest debt', 'A guaranteed avoided cost can beat risky investment return', 'Low-rate debt may be less urgent'],
        ['HSA if eligible', 'Can combine tax benefits with healthcare flexibility', 'Only available with qualifying coverage and rules'],
        ['IRA or 401(k)', 'Tax-advantaged compounding and payroll simplicity', 'Fees, investment menu, tax rate, and access rules vary'],
        ['Taxable brokerage', 'Flexible and not tied to retirement-account withdrawal rules', 'Less tax-sheltered than retirement accounts'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Wilson household',
      assumptions: [
        { label: 'Employer plan', value: 'Matches 100% of the first 4% of pay' },
        { label: 'Pay', value: '$100,000 salary, so the first $4,000 contribution earns a $4,000 match' },
        { label: 'Next dollars', value: 'After the match, compare HSA contributions and taxable bridge savings' },
      ],
      summary:
        'The first $4,000 contribution effectively adds **$8,000** to retirement savings before investment returns. After that, unmatched 401(k), HSA, and taxable bridge dollars need a normal plan comparison.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden does not currently calculate an employer match from a payroll formula. Enter only the employee contribution you expect to make in the account\'s annual contribution field. Do not add future employer match there: the engine treats that field as an employee contribution subject to contribution limits and, for pre-tax accounts, as a deduction from taxable income. Include already-vested match dollars in the current balance instead.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Missing the match while contributing elsewhere first.',
        'Maxing an account with poor investment options while ignoring an HSA or IRA that better fits the plan.',
        'Putting every dollar into retirement accounts and leaving no flexible bridge money.',
        'Forgetting that contribution limits apply across account groups, not always one account at a time.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** for annual contribution inputs. Create one scenario with the current savings order and another with the next dollar redirected to HSA, Roth, traditional, or taxable savings. Then compare taxes, depletion year, and Monte Carlo results.',
    },
  ],
}
