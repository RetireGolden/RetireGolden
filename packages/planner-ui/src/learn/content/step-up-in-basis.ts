/**
 * "Step-up in basis" - an Insurance and Estate P2 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const stepUpInBasisArticle: LearningArticle = {
  slug: 'step-up-in-basis',
  title: 'Step-up in basis',
  description: 'How inherited investments can reset their taxable cost basis.',
  category: 'insurance-estate',
  tags: ['step-up in basis', 'cost basis', 'taxable brokerage', 'inheritance', 'capital gains'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'rule-change',
  sourceUrls: ['https://www.irs.gov/publications/p551', 'https://www.irs.gov/publications/p559'],
  relatedArticles: [
    'taxable-brokerage-basis-and-capital-gains',
    'after-tax-estate',
    'beneficiaries-and-account-titling',
    'ordinary-income-vs-capital-gains',
  ],
  relatedPlannerRoutes: ['/plan/:planId/accounts', '/plan/:planId/results', '/plan/:planId/report'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Cost basis is the tax starting point for measuring capital gain or loss. A step-up in basis means an inherited asset may get a new basis tied to its value around the owner\'s death, reducing the gain an heir would report if they sell soon after inheriting.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A step-up can make taxable brokerage assets more estate-friendly than their embedded gain suggests.',
        'Step-up rules are different from traditional IRA inheritance rules.',
        'RetireGolden uses a simplified step-up assumption in its after-tax estate comparison.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'If you bought an investment for less than it is worth today, selling it during life can create capital gain. If heirs inherit that investment and receive a stepped-up basis, the old unrealized gain may not follow them in the same way.\n\nThat distinction matters when comparing lifetime tax moves. Selling appreciated taxable assets during life is not the same as leaving them to heirs. Converting a traditional IRA is not the same as leaving taxable stock. Each bucket has a different tax shape.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/step-up-in-basis.webp' },
      caption:
        'A basis step-up can reset the tax starting line for inherited taxable assets, while pre-tax retirement accounts keep a different tax character.',
      alt: 'An appreciated taxable asset path reaches an inheritance checkpoint where the basis line resets upward, while a traditional account path continues through an income-tax gate.',
    },
    {
      type: 'table',
      caption: 'Step-up is one reason account type matters for heirs.',
      columns: ['Asset type', 'Common heir tax lens', 'RetireGolden simplification'],
      rows: [
        ['Taxable brokerage', 'Basis may reset at inheritance under step-up rules', 'Kept whole in the after-tax estate metric'],
        ['Traditional IRA or 401(k)', 'Heirs may owe income tax on distributions', 'Reduced by the heir tax rate'],
        ['Roth', 'Often more tax-flexible for heirs when qualified', 'Kept whole in the estate comparison'],
        ['Property', 'May involve basis, sale costs, and local law', 'Modeled at projected net value, not detailed estate tax basis'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Allen household',
      assumptions: [
        { label: 'Taxable account', value: '$250,000 brokerage account with $140,000 of cost basis' },
        { label: 'During life sale', value: 'A full sale would realize about $110,000 of capital gain' },
        { label: 'Inherited asset', value: 'A step-up could reset basis near the date-of-death value' },
      ],
      summary:
        'During life, the embedded gain is about **$110,000**. As an inheritance, the taxable account may avoid that same gain layer, unlike a same-size traditional IRA that remains taxable to heirs.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden tracks cost basis for taxable brokerage accounts during the projection, so lifetime sales can realize gains. For the after-tax estate metric, it uses a simplified assumption that taxable assets pass through without the same heir income-tax haircut applied to traditional balances.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'Step-up rules can depend on ownership, state law, community property rules, estate structure, and law changes. RetireGolden does not replace estate or tax advice.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating taxable brokerage and traditional IRA dollars as equally taxable to heirs.',
        'Assuming step-up applies to every asset or every transfer.',
        'Selling highly appreciated assets during life without comparing the estate tradeoff.',
        'Using RetireGolden\'s simplified estate metric as a legal estate plan.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Accounts** to enter taxable cost basis. Use **Results** to inspect realized gains during life, and use **Report** or **Optimize** to compare ending net worth with after-tax estate value.',
    },
  ],
}
