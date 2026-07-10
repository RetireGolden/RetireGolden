/**
 * "Fees, expense ratios, and compounding drag" - an Accounts and Saving P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const feesExpenseRatiosCompoundingDragArticle: LearningArticle = {
  slug: 'fees-expense-ratios-and-compounding-drag',
  title: 'Fees, expense ratios, and compounding drag',
  description: 'Why a small annual fee can quietly cost a large share of growth.',
  category: 'accounts-saving',
  tags: ['fees', 'expense ratio', 'returns', 'compounding', 'investment costs', 'assumptions'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.investor.gov/introduction-investing/getting-started/fees-and-expenses',
    'https://www.investor.gov/introduction-investing/investing-basics/glossary/expense-ratio',
  ],
  relatedArticles: [
    'account-types-overview',
    'historical-vs-random-return-models',
    'how-assumptions-change-the-answer',
    'sensitivity-testing-what-changes-the-answer',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/assumptions', '/plan/:planId/scenarios'],
  currentYearSensitive: false,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Investment fees can feel small because they are often quoted as annual percentages. In a retirement plan, the problem is not only this year\'s fee. It is the growth that never happens because the fee was removed before it could compound.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Fees reduce the return you actually keep, even when the market return is unchanged.',
        'A small expense ratio can become meaningful over decades because the lost dollars also stop compounding.',
        'RetireGolden does not have a separate fee field today, so the planning input is usually a net-of-fee return assumption.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'If two investments earn the same gross return but one costs more to own, the lower-cost investment leaves more return in the account. That difference compounds. Over a short period, the gap may look modest. Over a full retirement horizon, it can change ending assets, withdrawal room, and estate value.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/fees-compounding-drag.webp' },
      caption:
        'Fees act like a steady leak from the growth path, reducing both current balance and future compounding.',
      alt: 'Two investment growth paths climb across a timeline, while one path loses small droplets through a fee valve and ends lower than the low-fee path.',
    },
    {
      type: 'formula',
      expression: 'net return = gross return - investment costs',
      where: [
        { symbol: 'gross return', meaning: 'the return before fund expenses, advisory fees, or other recurring costs' },
        { symbol: 'investment costs', meaning: 'recurring costs that reduce what the investor keeps' },
      ],
      note: 'Real investments have taxes, trading costs, changing allocations, and timing risk. Use this as a planning lens, not a performance promise.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Allen household',
      assumptions: [
        { label: 'Portfolio assumption', value: '6% expected return before recurring costs' },
        { label: 'Cost drag test', value: 'Compare a 5.8% net return with a 5.0% net return' },
        { label: 'Question', value: 'Does the plan still work after lower net growth?' },
      ],
      summary:
        'The fee is not modeled as a separate bill. It is reflected by lowering the return assumption to what the household expects to keep after costs.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden return fields are planning assumptions. If your investments carry meaningful fund expenses, advisory fees, or platform costs, enter expected returns after those recurring costs. Use **Scenarios** or **Sensitivity** to compare a low-cost version and a high-cost version of the same plan.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Using a gross market return as if every investor keeps all of it.',
        'Focusing only on one-year fee dollars instead of the compounding drag.',
        'Comparing funds by return without checking whether the return is before or after expenses.',
        'Assuming lower cost automatically means lower risk. Fees and risk are separate questions.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** and **Assumptions** to set expected returns that already reflect recurring costs. Use **Scenarios** to test how sensitive the plan is to lower net returns.',
    },
  ],
}
