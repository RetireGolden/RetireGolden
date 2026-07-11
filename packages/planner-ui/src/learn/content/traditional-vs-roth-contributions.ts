/**
 * "Traditional vs Roth contributions" - an Accounts and Saving P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const traditionalVsRothContributionsArticle: LearningArticle = {
  slug: 'traditional-vs-roth-contributions',
  title: 'Traditional vs Roth contributions',
  description: 'Pay tax now or later, and how to think about the trade-off.',
  category: 'accounts-saving',
  tags: ['traditional', 'roth', 'contributions', 'tax timing', '401k', 'ira'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/plan-participant-employee/retirement-topics-contributions',
    'https://www.irs.gov/retirement-plans/401k-plans',
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras',
  ],
  relatedArticles: [
    'account-types-overview',
    'roth-conversion-basics',
    'marginal-vs-effective-tax-rate',
    'filling-a-tax-bracket-with-roth-conversions',
    'withdrawal-order-basics',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'A traditional contribution and a Roth contribution are two different tax-timing choices. Traditional usually tries to reduce taxable income now. Roth usually accepts tax now in exchange for more tax-free flexibility later, if the rules for qualified withdrawals are met.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Traditional is often attractive when today\'s marginal tax rate is high compared with the rate you expect in retirement.',
        'Roth is often attractive when today\'s rate is low, future rates may be higher, or tax-free flexibility is valuable.',
        'The best answer can change by year, especially around retirement, Social Security, Medicare, RMDs, and survivor years.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Traditional contributions usually move taxable income from today into the future. Roth contributions usually leave today\'s taxable income alone, but future qualified Roth withdrawals may avoid tax. The cleanest comparison asks: would I rather pay tax at today\'s marginal rate, or at the future rate that applies when I withdraw?',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/traditional-vs-roth-contributions.webp' },
      caption:
        'Traditional and Roth contributions are two tax-timing paths: tax later versus tax now.',
      alt: 'A savings dollar reaches a fork. One path enters a traditional account before a future tax gate, and the other passes a current tax gate before reaching a Roth account.',
    },
    {
      type: 'formula',
      expression: 'better choice = lower lifetime tax cost, not lower tax this year',
      where: [
        { symbol: 'traditional', meaning: 'usually lowers taxable income now and creates taxable withdrawals later' },
        { symbol: 'Roth', meaning: 'usually pays tax now and can create tax-free qualified withdrawals later' },
      ],
      note: 'This is a planning lens, not a universal rule. Eligibility, employer plan rules, cash flow, and current law all matter.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Moreno household',
      assumptions: [
        { label: 'Working years', value: '$180,000 household wages while both spouses work' },
        { label: 'Contribution choice', value: '$12,000 pre-tax contribution saves current tax; Roth contribution does not' },
        { label: 'First retirement years', value: 'Lower taxable income creates room to convert some pre-tax dollars later' },
      ],
      summary:
        'The pre-tax contribution can help most in the high-wage year. Later, a planned conversion can move dollars to Roth when the Morenos have more bracket room, so the answer can change by phase.',
    },
    { type: 'heading', text: 'Traditional vs Roth in a plan' },
    {
      type: 'table',
      caption: 'The trade-off is mostly about tax timing.',
      columns: ['Feature', 'Traditional contribution', 'Roth contribution'],
      rows: [
        ['Current taxable income', 'Often lower when the contribution is deductible or pre-tax', 'Usually unchanged by the contribution'],
        ['Future withdrawals', 'Often ordinary income', 'Qualified withdrawals may be tax-free'],
        ['RMD pressure', 'Traditional balances can create future RMDs', 'Roth IRAs do not create lifetime RMDs for the original owner'],
        ['Flexibility', 'Can help manage taxes now', 'Can help manage taxes later'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden applies annual contribution inputs while the account owner has wages and caps modeled contributions by the parameter pack limits. Traditional and HSA contributions reduce taxable income in the projection; Roth contributions add to Roth basis but do not create the same current-year deduction in the ledger.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Choosing Roth because "tax-free" sounds automatically better.',
        'Choosing traditional because this year\'s tax bill is the only number being watched.',
        'Comparing contribution amounts without considering whether the tax savings are also invested.',
        'Ignoring survivor years, when a surviving spouse may file under a smaller bracket structure.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Enter annual traditional and Roth contributions in **Accounts**. Then compare plan versions in **Scenarios**: one with more traditional saving, one with more Roth saving, and one with traditional saving plus later Roth conversions.',
    },
  ],
}
