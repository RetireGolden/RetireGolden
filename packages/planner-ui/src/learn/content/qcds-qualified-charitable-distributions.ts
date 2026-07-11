/**
 * "QCDs: qualified charitable distributions" - a Withdrawals and Roth P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const qcdsQualifiedCharitableDistributionsArticle: LearningArticle = {
  slug: 'qcds-qualified-charitable-distributions',
  title: 'QCDs: qualified charitable distributions',
  description: 'Giving from an IRA in a way that can lower taxable income.',
  category: 'withdrawals-roth',
  tags: ['qcd', 'qualified charitable distribution', 'rmd', 'charity', 'ira', 'magi'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/retirement-plans/retirement-plans-faqs-regarding-iras-distributions-withdrawals',
    'https://www.irs.gov/retirement-plans/retirement-plan-and-ira-required-minimum-distributions-faqs',
    'https://www.irs.gov/forms-pubs/about-publication-590-b',
  ],
  relatedArticles: [
    'rmds-required-minimum-distributions',
    'withdrawal-order-basics',
    'agi-magi-and-taxable-income',
    'why-roth-conversions-raise-other-costs',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A qualified charitable distribution, or QCD, sends money directly from an IRA to a qualified charity. For people who are eligible, it can satisfy part of an RMD while keeping that donated amount out of taxable income.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A QCD is a direct IRA-to-charity transfer, not a normal withdrawal followed by a personal donation.',
        'QCDs can count toward RMDs while reducing taxable income and MAGI.',
        'RetireGolden models QCDs as a planning-level annual amount routed out of RMDs, capped by the parameter pack.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'If you take an IRA distribution personally and then donate cash, the distribution may still raise AGI or MAGI. A QCD is different: the eligible charitable amount can be excluded from income when done correctly.\n\nThat can matter even for people who do not itemize deductions. Lower income can affect tax brackets, Social Security taxation, Medicare IRMAA, ACA credits before Medicare, and other income-sensitive rules.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/qcds-qualified-charitable-distributions.webp' },
      caption:
        'A QCD routes part of an IRA distribution directly to charity, bypassing the taxable-income path for that amount.',
      alt: 'An RMD ribbon leaves a retirement bucket and splits. One branch goes through a tax gate to spending, while another branch goes directly to a charity basket.',
    },
    { type: 'heading', text: 'QCD versus ordinary donation' },
    {
      type: 'table',
      caption: 'The routing is what makes a QCD different.',
      columns: ['Choice', 'Cash path', 'Planning effect'],
      rows: [
        ['Normal IRA withdrawal, then donation', 'Money comes to you first', 'The withdrawal may still raise income'],
        ['QCD', 'Money goes directly from IRA to charity', 'Eligible amount can be excluded from income'],
        ['Roth or taxable-account gift', 'Money does not satisfy an IRA RMD', 'May still be charitable, but it is not the same planning lever'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Howard household',
      assumptions: [
        { label: 'RMD', value: '$42,000 required distribution for the year' },
        { label: 'Giving habit', value: '$8,000 annual gift to charity' },
        { label: 'Two paths', value: 'Take the full RMD into checking, or send $8,000 directly as a QCD' },
      ],
      summary:
        'With the QCD path, only **$34,000** of the RMD flows into income in this simplified example. The gift still happens, but the tax return does not first absorb the full $42,000 distribution.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden has an annual QCD setting on the Strategy screen. The model routes QCD dollars out of RMDs when an eligible-age person is alive, excludes that amount from income, and caps it using the annual QCD limit in the parameter pack. It does not verify charity eligibility, transfer mechanics, receipts, or tax-form reporting.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Taking the IRA withdrawal personally and assuming a later donation is still a QCD.',
        'Forgetting that QCD rules have eligibility and annual limit details.',
        'Counting a QCD as both excluded income and an itemized charitable deduction.',
        'Using the model as proof that a real charity or transfer qualifies.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Strategy** to enter an annual QCD amount. Use **Results** to compare RMD, QCD, tax, MAGI, and healthcare effects across years.',
    },
  ],
}
