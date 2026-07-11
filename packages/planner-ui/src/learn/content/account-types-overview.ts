/**
 * "Account types: taxable, traditional, Roth, HSA, cash" - an Accounts and Saving P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const accountTypesOverviewArticle: LearningArticle = {
  slug: 'account-types-overview',
  title: 'Account types: taxable, traditional, Roth, HSA, cash',
  description: 'How each account is taxed and why the differences matter in retirement.',
  category: 'accounts-saving',
  tags: ['accounts', 'taxable brokerage', 'traditional ira', 'roth ira', 'hsa', 'cash', 'tax treatment'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/roth-iras',
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras',
    'https://www.irs.gov/forms-pubs/about-publication-969',
    'https://www.irs.gov/taxtopics/tc409',
    'https://www.irs.gov/forms-pubs/about-publication-550',
  ],
  relatedArticles: [
    'withdrawal-order-basics',
    'traditional-vs-roth-contributions',
    'hsas-as-retirement-accounts',
    'taxable-brokerage-basis-and-capital-gains',
    'roth-conversion-basics',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'A retirement plan is easier to understand when every dollar lives in the right bucket. Cash, taxable brokerage, traditional retirement, Roth, and HSA accounts can hold similar investments, but they do not create the same tax result when money goes in, grows, or comes out.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Account type is about tax treatment, not just where the account is held.',
        'The same investment can behave differently inside a taxable account, traditional account, Roth account, or HSA.',
        'RetireGolden uses account type to model contributions, withdrawals, gains, RMDs, penalties, and after-tax estate value.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Think of account type as the rules printed on the side of a bucket. Cash is usually simple. Taxable brokerage can create capital gains when investments are sold. Traditional IRA and 401(k) dollars are usually pre-tax, so later withdrawals often become ordinary income. Roth dollars usually trade a tax cost now for tax-free qualified withdrawals later. HSA dollars can be tax-free for qualified medical expenses when the HSA rules are met.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/account-types-overview.webp' },
      caption:
        'Each account bucket can feed the same retirement plan, but the tax gate on each bucket is different.',
      alt: 'Five labeled-style account buckets for cash, taxable, traditional, Roth, and HSA feed a central retirement path through different tax gates.',
    },
    {
      type: 'table',
      caption: 'A plain-language map of the main account buckets.',
      columns: ['Account type', 'Main tax idea', 'What RetireGolden needs from you'],
      rows: [
        ['Cash', 'Usually no taxable gain when spent', 'Balance, owner if applicable, and return assumption'],
        ['Taxable brokerage', 'Sales may realize capital gains based on cost basis', 'Balance, aggregate cost basis, contributions, and return assumption'],
        ['Traditional IRA or 401(k)', 'Contributions may be pre-tax; withdrawals are often ordinary income', 'Balance, owner, account kind, contributions, and inherited/RMD details when relevant'],
        ['Roth IRA or Roth 401(k)', 'Qualified withdrawals may be tax-free', 'Balance, owner, account kind, contributions, and contribution basis when early access matters'],
        ['HSA', 'Tax-free for qualified medical expenses when rules are met', 'Balance, owner, contribution amount, and return assumption'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Cash', value: '$25,000 emergency reserve and near-term spending buffer' },
        { label: 'Taxable brokerage', value: '$120,000 account with $80,000 of cost basis' },
        { label: 'Traditional and Roth', value: '$500,000 traditional IRA and $90,000 Roth IRA' },
      ],
      summary:
        'A $20,000 withdrawal from cash is not a tax event. A $20,000 taxable sale realizes about **$6,700** of gain in this simplified basis mix, while a $20,000 traditional IRA withdrawal is ordinary income.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The Accounts screen stores the type for each balance. The projection engine then uses that type when it applies IRS contribution limits, realizes taxable gains pro-rata from taxable accounts, forces traditional-account RMDs when applicable, tracks Roth basis and conversion layers, and keeps HSA withdrawals last in the default order.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Entering a Roth 401(k) as traditional because it is held at the same employer plan.',
        'Leaving taxable cost basis at zero when the account has after-tax investment basis.',
        'Treating cash and taxable brokerage as interchangeable when one may realize gains.',
        'Forgetting that an inherited traditional account follows different distribution rules than your own traditional IRA.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Start in **Accounts** and classify each balance before you study **Results**. If the tax picture looks surprising, return to Accounts and check whether the type, cost basis, owner, and annual contribution fields match the real account.',
    },
  ],
}
