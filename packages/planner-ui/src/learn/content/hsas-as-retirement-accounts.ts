/**
 * "HSAs as retirement accounts" - an Accounts and Saving P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const hsasAsRetirementAccountsArticle: LearningArticle = {
  slug: 'hsas-as-retirement-accounts',
  title: 'HSAs as retirement accounts',
  description: 'Why a health savings account can be one of the strongest retirement tools.',
  category: 'accounts-saving',
  tags: ['hsa', 'health savings account', 'qualified medical expenses', 'retirement healthcare', 'tax-free'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/forms-pubs/about-publication-969',
    'https://www.irs.gov/publications/p969',
  ],
  relatedArticles: [
    'account-types-overview',
    'hsas-and-qualified-medical-expenses',
    'healthcare-before-65',
    'healthcare-after-65',
    'withdrawal-order-basics',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/spending', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'An HSA is a health savings account tied to specific eligibility rules. When used for qualified medical expenses, it can combine tax benefits on the way in, while invested, and on the way out. That is why planners often treat a good HSA as both a healthcare tool and a retirement asset.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'HSA eligibility, contribution limits, and qualified medical expense rules matter every year.',
        'HSA dollars used for qualified medical expenses can be unusually tax-efficient.',
        'RetireGolden treats HSA balances as a distinct account bucket and keeps them last in the default spending order.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A taxable brokerage account is flexible, but it can create taxable investment income and gains. A traditional retirement account can defer tax, but later withdrawals are often ordinary income. A Roth can create tax-free qualified retirement withdrawals. An HSA can be even more targeted: when the HSA rules are met and the withdrawal pays qualified medical expenses, the withdrawal can be tax-free for healthcare.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/hsa-retirement-account.webp' },
      caption:
        'An HSA can connect retirement saving directly to future healthcare costs when qualified medical expense rules are met.',
      alt: 'A health savings account bucket feeds a retirement healthcare path, with medical icons and tax gates showing contribution, growth, and qualified medical spending.',
    },
    {
      type: 'table',
      caption: 'Why HSAs get special attention.',
      columns: ['Stage', 'Planning lens', 'Caution'],
      rows: [
        ['Contribution', 'Can be tax-advantaged when eligibility rules are met', 'Limits and eligibility depend on coverage and current law'],
        ['Growth', 'Can compound for future healthcare needs', 'Investment risk still matters'],
        ['Qualified medical withdrawal', 'Can be tax-free when used under HSA rules', 'Documentation and qualified-expense rules matter'],
        ['Non-medical withdrawal', 'May lose the special treatment and can face penalties before age 65', 'Do not model it as a generic Roth substitute'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Lee household',
      assumptions: [
        { label: 'Coverage', value: 'Eligible for $7,500 of HSA contributions while working' },
        { label: 'Current medical bills', value: '$2,400 a year, affordable from cash' },
        { label: 'Later reserve', value: 'Investing the HSA preserves $7,500 plus growth for future healthcare spending' },
      ],
      summary:
        'If the Lees pay the $2,400 bill from cash, the HSA can stay invested. The trade is less cash today in exchange for a healthcare bucket that may be more valuable later.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden models HSA accounts separately from cash, taxable, traditional, and Roth accounts. Annual HSA contributions are capped by the parameter pack and reduce taxable income in the projection. The default withdrawal order spends HSA dollars last, and early non-medical HSA withdrawals can trigger a modeled pre-65 penalty.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the HSA as available without checking annual eligibility.',
        'Spending HSA dollars first when other accounts could cover non-medical needs.',
        'Assuming all healthcare-related costs automatically qualify.',
        'Forgetting that an HSA is still an invested account if you choose investments inside it.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Enter HSA balance and contributions in **Accounts**. Put expected healthcare costs in **Spending** and healthcare assumptions, then use **Results** to see whether the HSA is being preserved or spent.',
    },
  ],
}
