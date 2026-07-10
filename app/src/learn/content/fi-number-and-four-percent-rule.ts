import type { LearningArticle } from '../learningRegistry'

export const fiNumberAndFourPercentRuleArticle: LearningArticle = {
  slug: 'fi-number-and-four-percent-rule',
  title: 'The FI number and the 4% rule',
  description: 'How to calculate your Financial Independence target portfolio using safe withdrawal rates.',
  category: 'early-investing-fire',
  tags: ['fi number', '4% rule', 'swr', 'safe withdrawal rate', 'sequence risk'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-29',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.retireby40.org/safe-withdrawal-rate-swr-4-rule/',
  ],
  relatedArticles: [
    'what-is-fire',
    'savings-rate-biggest-lever',
    'sequence-of-returns-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/assumptions'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Your **FI Number** is the total portfolio balance you need to reach financial independence. Once your investable assets reach this target, you can theoretically stop working and live off withdrawals forever.',
    },
    { type: 'heading', text: 'Three key takeaways' },
    {
      type: 'list',
      items: [
        'The 4% rule of thumb states you can safely withdraw 4% of your starting portfolio in year one, and adjust that dollar amount for inflation each year.',
        'SWR stands for Safe Withdrawal Rate. Lowering your SWR (e.g. to 3.5%) increases your FI number but adds safety.',
        'The formula to compute the target portfolio size is: FI Target = Annual Spending ÷ SWR.',
      ],
    },
    {
      type: 'formula',
      expression: 'FI = S / SWR',
      where: [
        { symbol: 'FI', meaning: 'Financial Independence target portfolio (today\'s dollars)' },
        { symbol: 'S', meaning: 'Annual retirement spending plus taxes and penalties' },
        { symbol: 'SWR', meaning: 'Safe Withdrawal Rate (expressed as a decimal, e.g. 0.04)' },
      ],
      basis: 'today',
      note: 'This formula assumes a flat withdrawal rate and does not account for variable spending phases.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the 4% rule as a guarantee instead of a planning lens.',
        'Using spending before taxes when your plan will need taxable withdrawals.',
        'Forgetting that a 40- or 50-year early retirement can be more fragile than a traditional 30-year horizon.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden calculates your **FI Target Portfolio** based on the Safe Withdrawal Rate (SWR) you configure under the Assumptions section. By default, it uses a 4% rate, but you can customize this to see how a more conservative 3.25% or aggressive 4.5% affects your timeline.',
    },
  ],
}
