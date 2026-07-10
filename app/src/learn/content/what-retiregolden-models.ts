/**
 * "What RetireGolden models and what it does not" - a Start Here P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const whatRetireGoldenModelsArticle: LearningArticle = {
  slug: 'what-retiregolden-models',
  title: 'What RetireGolden models and what it does not',
  description: 'A plain map of what the engine simulates and where it stops.',
  category: 'start-here',
  tags: ['model', 'scope', 'limitations', 'assumptions', 'privacy'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'about-retiregolden',
    'how-to-read-a-retirement-projection',
    'reading-the-results-page',
    'todays-dollars-vs-future-dollars',
  ],
  relatedPlannerRoutes: ['/', '/plan/:planId/assumptions', '/plan/:planId/results', '/plan/:planId/report'],
  currentYearSensitive: false,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Every planning tool has a boundary. RetireGolden models the parts of retirement that can be represented as yearly cash flows, taxes, balances, and assumptions. It does not know your preferences, your exact tax return, or the future.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden is strongest when you use it to compare choices under clear assumptions.',
        'The engine models common retirement mechanics at planning precision, not return-filing precision.',
        'Anything outside the model should still be considered, especially personal advice, legal documents, health, family obligations, and behavior.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A model is a simplified version of reality. The simplification is not a flaw by itself. It is what lets you see the moving parts clearly. The important thing is knowing which simplifications are in play before you trust a result too much.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/model-boundary.webp' },
      caption:
        'RetireGolden models the planning mechanics inside the boundary; personal judgment, exact filing details, and real-life uncertainty remain outside it.',
      alt: 'A protected central planning model contains account, tax, healthcare, insurance, and risk tiles, separated from outside personal, legal, tax filing, and uncertainty symbols.',
    },
    {
      type: 'table',
      caption: 'The main boundary lines in RetireGolden.',
      columns: ['Area', 'Modeled', 'Not modeled'],
      rows: [
        ['Household timeline', 'Ages, retirement timing, planning ages, survivor years, and filing status', 'Personal health diagnosis, family obligations, or exact date-of-death prediction'],
        ['Cash flow', 'Income streams, spending, goals, debt service, healthcare, insurance premiums, and withdrawals', 'Every possible irregular purchase or emergency unless you add it as a goal or assumption'],
        ['Accounts', 'Cash, taxable, equity compensation, traditional, Roth, HSA, property, debt, and insurance values', 'Every custodian-specific rule, fee, investment product, or trading detail'],
        ['Taxes', 'Federal and state estimates at planning precision, including common retirement interactions', 'A tax return, tax advice, audit support, or every deduction and credit edge case'],
        ['Risk', 'Monte Carlo market paths, optional longevity variation, and optional long-term-care shock', 'A prediction of actual market returns or your personal life span'],
      ],
    },
    { type: 'heading', text: 'How to use the boundary well' },
    {
      type: 'scenario',
      name: 'Mina and Jordan',
      assumptions: [
        { label: 'Question', value: 'Should they retire at 62 or 64?' },
        { label: 'Good model use', value: 'Compare age 62 vs 64 with the same spending, return, inflation, and tax assumptions' },
        { label: 'Outside the model', value: 'Whether they are emotionally ready to stop working' },
      ],
      summary:
        'RetireGolden can show the money difference between 62 and 64, such as two more saving years and two fewer withdrawal years. It cannot decide how those two work years feel.',
    },
    { type: 'heading', text: 'Planning precision, not personal advice' },
    {
      type: 'prose',
      md: 'Planning precision means the model is detailed enough to compare strategies and spot pressure points. It is not a substitute for professional tax, legal, investment, insurance, or healthcare advice. A result can be directionally useful and still need review before you act.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'Use RetireGolden to understand trade-offs. Do not use it as the only basis for irreversible tax, investment, insurance, or estate decisions.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating a model limitation as a reason to ignore the model entirely.',
        'Treating a clean chart as proof that real life will be clean too.',
        'Changing several assumptions at once and then attributing the result to only one change.',
        'Forgetting that private, browser-only storage also means you control your own backups.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use this article before you interpret **Results**, **Monte Carlo**, **Scenarios**, or **Optimize**. When a screen gives you a strong answer, ask which assumptions made that answer possible and which real-world issues sit outside the model.',
    },
  ],
}
