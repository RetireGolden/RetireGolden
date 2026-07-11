/**
 * "Beneficiaries and account titling basics" - an Insurance and Estate P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const beneficiariesAccountTitlingArticle: LearningArticle = {
  slug: 'beneficiaries-and-account-titling',
  title: 'Beneficiaries and account titling basics',
  description: 'Why beneficiary forms and titling can override a will.',
  category: 'insurance-estate',
  tags: ['beneficiaries', 'account titling', 'estate planning', 'inherited ira', 'life insurance'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'rule-change',
  sourceUrls: ['https://www.irs.gov/publications/p559', 'https://www.irs.gov/publications/p590b'],
  relatedArticles: [
    'inherited-ira-10-year-rule',
    'step-up-in-basis',
    'permanent-life-insurance-in-a-plan',
    'survivor-planning-for-couples',
    'after-tax-estate',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/insurance', '/plan/:planId/household', '/plan/:planId/report'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'A retirement plan can show enough money and still fail operationally if assets do not reach the intended people. Beneficiary forms and account titling are the plumbing of an estate plan: quiet when correct, painful when stale or inconsistent.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Beneficiary designations often control retirement accounts and life insurance directly.',
        'Account titling can affect who can act, what happens at death, and whether probate is involved.',
        'RetireGolden models ownership and some beneficiaries, but it does not model legal title, probate, trusts, or state law.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A will is important, but many financial assets pass by contract or account form. Retirement accounts, life insurance, transfer-on-death accounts, joint accounts, and trust-owned assets may follow their own paperwork. If that paperwork is out of date, the math in the retirement plan may not match what actually happens.\n\nBeneficiary and titling reviews are especially important after marriage, divorce, death, births, moves, new accounts, and major tax-law changes.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/beneficiaries-account-titling.webp' },
      caption:
        'Beneficiary forms and account titles are routing instructions for where assets go when the owner dies.',
      alt: 'Account buckets route through beneficiary forms and title gates toward spouse, heirs, estate, and trust containers, with one stale route marked for review.',
    },
    {
      type: 'table',
      caption: 'Common planning records to keep aligned.',
      columns: ['Record', 'What it controls', 'Why it matters'],
      rows: [
        ['Retirement account beneficiary', 'Who receives IRA or workplace-plan assets', 'Can drive inherited-account rules and tax timing'],
        ['Life insurance beneficiary', 'Who receives the death benefit', 'Can protect a spouse or flow to the estate in the model'],
        ['Account owner', 'Whose age, tax, and RMD rules may apply', 'RetireGolden uses ownership for account behavior'],
        ['Property title', 'Who owns real estate or other titled property', 'May affect control, transfer, and basis treatment'],
        ['Estate or trust documents', 'Fallback and legal structure', 'Not modeled directly in RetireGolden'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Martin household',
      assumptions: [
        { label: 'Old form', value: '$240,000 retirement account still names a prior beneficiary' },
        { label: 'Current plan', value: 'The surviving spouse needs about $35,000 a year from that account' },
        { label: 'Risk', value: 'The projection assumes spouse support, but the form could route the asset elsewhere' },
      ],
      summary:
        'RetireGolden can show the spouse needs the $240,000 account to cover a $35,000 annual gap. The beneficiary review makes sure the real-world form sends the money where the plan assumes.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden uses account ownership for RMDs, penalties, HSA limits, Roth basis ordering, and survivor modeling. It also tracks permanent-life beneficiaries as either a person in the plan or the estate. It does not replace actual beneficiary forms, account titles, trusts, wills, or attorney review.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming a will updates every beneficiary form automatically.',
        'Forgetting old employer plans, old IRAs, or old life policies.',
        'Ignoring account ownership when modeling RMDs or survivor years.',
        'Treating RetireGolden\'s estate numbers as proof that legal documents are aligned.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to confirm owners, inherited-account status, and account types. Use **Insurance** to set permanent-life beneficiaries. Use **Report** as a checklist prompt, then verify the real documents outside the app.',
    },
  ],
}
