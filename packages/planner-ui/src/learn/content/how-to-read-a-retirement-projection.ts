/**
 * "How to read a retirement projection" - a Start Here P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const howToReadProjectionArticle: LearningArticle = {
  slug: 'how-to-read-a-retirement-projection',
  title: 'How to read a retirement projection',
  description: 'What the lines, balances, and end-of-plan numbers in a projection actually tell you.',
  category: 'start-here',
  tags: ['projection', 'cash flow', 'results', 'shortfall', 'net worth'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'stable',
  sourceUrls: [],
  relatedArticles: [
    'todays-dollars-vs-future-dollars',
    'reading-the-results-page',
    'understanding-monte-carlo-success-rate',
    'what-retiregolden-models',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/monte-carlo', '/plan/:planId/assumptions'],
  currentYearSensitive: false,
  priority: 'P0',
  featured: true,
  blocks: [
    {
      type: 'prose',
      md: 'A retirement projection is not a forecast of what will happen. It is a year-by-year story of what could happen **if your assumptions are close enough**. The useful question is not "is this exact?" It is "what is driving the result?"',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Start with the **spending gap**: what income covers, and what the portfolio must cover.',
        'Then look for the first stress year: a shortfall, a tax spike, a healthcare jump, or a balance that falls faster than expected.',
        'Read the final number as a comparison tool, not a promise about your exact future wealth.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'A projection turns your inputs into a ledger. Each year starts with balances, adds income and investment growth, subtracts spending, taxes, premiums, debt, and withdrawals, then carries the remaining balances into the next year.\n\nThat simple rhythm matters because retirement plans usually fail in the middle, not on the last line. A plan can look fine at age 67 and strain at age 74 because Social Security is delayed, healthcare changes, Roth conversions raise income, or early market losses leave fewer dollars to recover.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/projection-flow.webp' },
      caption:
        'A projection turns account and income inputs into yearly balances, spending needs, taxes, healthcare costs, and possible stress points.',
      alt: 'Teal income and account streams flow into stacked account buckets, then branch toward spending, tax, healthcare, and warning symbols across a retirement timeline.',
    },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Spending need', value: '$90,000 a year in today\'s dollars' },
        { label: 'Income floor', value: '$55,000 from Social Security and a pension' },
        { label: 'Portfolio role', value: 'Cover the $35,000 annual gap, taxes, and one-time goals' },
      ],
      summary:
        'Their projection is not mainly about the final balance. It is about whether the portfolio can cover a **$35,000** yearly gap plus taxes without creating a shortfall too early.',
    },
    { type: 'heading', text: 'Follow the cash gap first' },
    {
      type: 'prose',
      md: 'The most important line is often the gap between spending and income. If income covers most spending, the portfolio has a lighter job. If income starts later or spending is front-loaded, the portfolio has to bridge more years.',
    },
    {
      type: 'formula',
      expression: 'portfolio gap = spending + taxes + penalties + contributions - income',
      where: [
        { symbol: 'spending', meaning: 'base spending, goals, healthcare, insurance premiums, and debt service' },
        { symbol: 'income', meaning: 'wages, Social Security, pensions, annuities, and other income streams' },
        { symbol: 'portfolio gap', meaning: 'the rough amount accounts must cover before the withdrawal-order details' },
      ],
      basis: 'nominal',
      note: 'The app uses the full annual ledger, account order, taxable gains, RMDs, Roth conversions, and surplus investing. This quick formula is only a reading aid.',
    },
    { type: 'heading', text: 'Read the projection in layers' },
    {
      type: 'table',
      caption: 'A practical order for reading a projection.',
      columns: ['Layer', 'Question to ask', 'What to look for'],
      rows: [
        ['Inputs', 'Does the plan describe the household accurately?', 'Ages, spending, retirement dates, accounts, Social Security, and assumptions'],
        ['Cash flow', 'Which years need portfolio withdrawals?', 'Income vs spending, taxes, healthcare, goals, and debt'],
        ['Balances', 'Which account types are doing the work?', 'Taxable, traditional, Roth, HSA, cash, and whether one bucket empties early'],
        ['Stress points', 'Where does the plan bend?', 'Shortfalls, depletion year, tax spikes, MAGI jumps, or sudden spending increases'],
        ['Ending value', 'What is left at the end?', 'Ending investable assets, net worth, and after-tax estate for comparisons'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden gives you both the summary view and the year-by-year detail. The summary tells you whether the plan lasts through the modeled horizon. The detail shows **why**. When the headline result surprises you, the table is usually where the explanation lives.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the final balance as the only grade on the plan.',
        'Ignoring whether numbers are shown in today\'s dollars or nominal dollars.',
        'Missing one-time stress years because the long-term ending value still looks comfortable.',
        'Comparing two plans without checking whether assumptions changed at the same time.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use this reading order on the **Results** screen first. Then use **Monte Carlo** to ask how the same plan behaves when returns and inflation vary, and **Scenarios** to compare deliberate changes side by side.',
    },
  ],
}
