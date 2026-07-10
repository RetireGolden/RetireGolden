/**
 * "HSAs and qualified medical expenses" - a Healthcare P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const hsasQualifiedMedicalExpensesArticle: LearningArticle = {
  slug: 'hsas-and-qualified-medical-expenses',
  title: 'HSAs and qualified medical expenses',
  description: 'How to use HSA dollars tax-free for healthcare costs.',
  category: 'healthcare',
  tags: ['hsa', 'health savings account', 'qualified medical expenses', 'healthcare', 'tax-free'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/forms-pubs/about-publication-969',
    'https://www.irs.gov/publications/p969',
    'https://www.irs.gov/forms-pubs/about-publication-502',
    'https://www.irs.gov/publications/p502',
  ],
  relatedArticles: [
    'hsas-as-retirement-accounts',
    'healthcare-before-65',
    'healthcare-after-65',
    'withdrawal-order-basics',
    'account-types-overview',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/spending', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A health savings account can be powerful because HSA money used for qualified medical expenses can come out tax-free. The word "qualified" is doing real work. Good HSA planning needs both a retirement model and a receipt trail.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Qualified medical expenses are defined by tax rules, not by whether a cost feels health-related.',
        'Keeping receipts matters if you plan to reimburse yourself later from the HSA.',
        'RetireGolden models the HSA account bucket, but it does not verify individual medical receipts.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'An HSA is not just another savings account. Contributions can be tax-advantaged, growth can be tax-deferred, and withdrawals for qualified medical expenses can be tax-free. That makes the HSA attractive for future healthcare costs.\n\nThe planning catch is documentation. If you pay a qualified medical bill from cash now and reimburse yourself from the HSA years later, you need records that connect the withdrawal to the eligible expense. RetireGolden can help model the account, but it is not a tax recordkeeping system.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/hsa-qualified-medical-expenses.webp' },
      caption:
        'The HSA planning path works best when eligible medical costs, receipts, and future reimbursements stay connected.',
      alt: 'Medical cost icons create receipt tiles that connect to an HSA bucket and then to a future tax-free reimbursement path.',
    },
    {
      type: 'table',
      caption: 'Three different HSA questions.',
      columns: ['Question', 'Planning answer', 'RetireGolden treatment'],
      rows: [
        ['Can I contribute?', 'Depends on HSA eligibility and annual limits', 'Contributions are capped by the parameter pack'],
        ['Can money grow?', 'Yes, depending on the account and investments chosen', 'Balance grows using the account return assumption'],
        ['Can I withdraw tax-free?', 'Only for qualified medical expenses with proper records', 'The app does not certify expenses or store receipts'],
        ['What if I use it for non-medical needs?', 'Tax and penalties can apply, especially before age 65', 'Forced pre-65 non-medical HSA withdrawals can trigger a modeled penalty'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Bennett household',
      assumptions: [
        { label: 'Current bill', value: '$1,800 qualified dental expense paid from checking' },
        { label: 'Documentation', value: 'Keeps the receipt and proof of payment with the tax file' },
        { label: 'Later year', value: 'Can reimburse up to $1,800 from the HSA if rules are still met' },
      ],
      summary:
        'The plan can show the HSA balance staying invested, but it cannot prove the $1,800 withdrawal is qualified. The receipt is what connects the future reimbursement to the old medical expense.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden treats HSA accounts as their own bucket. HSA contributions reduce taxable income in the projection when allowed, and the default withdrawal order keeps HSA dollars last. Healthcare spending is modeled separately from HSA receipt tracking, so do not read the projection as proof that any specific withdrawal is qualified.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'Model note: RetireGolden v1 treats HSA dollars spent by the withdrawal engine as non-medical. If the HSA is forced to fund general spending before age 65, the projection can apply a 20% penalty. Use the HSA account to model the bucket, not as a qualified-expense substantiation tool.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming every insurance premium or wellness purchase is qualified.',
        'Waiting years to reimburse yourself without keeping receipts.',
        'Counting the same medical expense twice for tax purposes.',
        'Treating the HSA as automatically tax-free for any retirement expense.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Enter the HSA in **Accounts** and healthcare spending in **Spending**. Use **Results** to see whether the HSA is preserved, depleted, or penalized, then keep real-world HSA tax records outside the app.',
    },
  ],
}
