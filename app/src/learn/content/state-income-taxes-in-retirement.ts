/**
 * "State income taxes in retirement" - a Taxes P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const stateIncomeTaxesRetirementArticle: LearningArticle = {
  slug: 'state-income-taxes-in-retirement',
  title: 'State income taxes in retirement',
  description: 'How state rules on retirement income vary and why they matter.',
  category: 'taxes',
  tags: ['state tax', 'retirement income', 'capital gains', 'social security', 'state residence'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.irs.gov/filing/state-government-websites'],
  relatedArticles: [
    'ordinary-income-vs-capital-gains',
    'how-social-security-is-taxed',
    'tax-cliffs-and-bracket-edges',
    'real-estate-home-equity-and-debt',
  ],
  relatedPlannerRoutes: ['/plan/:planId/household', '/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Federal tax gets most of the attention, but state income tax can change the after-tax value of withdrawals, pensions, Social Security, capital gains, and a possible move. Two households with the same federal plan can see different results because they live in different states.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Some states have no broad income tax, while others tax retirement income in different ways.',
        'State rules can treat Social Security, pensions, IRA withdrawals, and capital gains differently from federal rules.',
        'RetireGolden uses state parameter packs when available and lets you enter a flat override when your situation needs a manual correction.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'State income tax is not just a smaller version of federal tax. A state may exempt Social Security, offer a retirement-income exclusion, tax capital gains as ordinary income, use different deductions, or have no income tax at all. Moving in retirement can also change which rules apply in later years.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/state-income-taxes-retirement.webp' },
      caption:
        'The same retirement income stream can pass through different state tax filters depending on where the household lives.',
      alt: 'A retirement income ribbon splits through several state-shaped tax filters, with some paths narrowing and others passing through mostly unchanged.',
    },
    {
      type: 'table',
      caption: 'State tax questions to check before relying on a result.',
      columns: ['Question', 'Why it matters', 'RetireGolden lens'],
      rows: [
        ['Does the state tax retirement income?', 'Pensions and IRA withdrawals may not all be treated the same', 'Modeled retirement-income exclusions where available'],
        ['Does the state tax Social Security?', 'Federal taxable benefits may not match state treatment', 'State pack determines whether taxable benefits are included'],
        ['How are gains treated?', 'Many states tax capital gains like ordinary income', 'State pack setting for capital gains as ordinary income'],
        ['Will you move?', 'Later years may use different rules', 'Household residence by year and plan assumptions'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Garcia household',
      assumptions: [
        { label: 'Current state', value: 'About $4,800 of state tax on IRA withdrawals and gains' },
        { label: 'Possible move', value: 'Move near family at age 68, reducing state tax by about $3,200 a year' },
        { label: 'Other cost change', value: 'Housing and insurance rise by about $2,400 a year in the new location' },
      ],
      summary:
        'The move is not a pure $3,200 tax win. After the $2,400 cost increase, the plan improves by only about **$800** a year before considering lifestyle and family reasons.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden combines the federal tax calculator with a state tax calculator. The state model starts from ordinary income, capital gains when the state taxes gains as ordinary, and federally taxable Social Security when the state taxes Social Security. It then applies major retirement-income exclusions, state standard deductions, and brackets from the state pack. A flat effective-rate override in **Assumptions** takes precedence when you need a manual approximation.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming state tax follows federal taxable income exactly.',
        'Forgetting that a no-income-tax state may still have property tax, sales tax, insurance, or housing tradeoffs.',
        'Modeling a move only as a tax change without changing spending and property assumptions.',
        'Treating a planning pack as a state tax return. Always verify unusual facts with state guidance or a tax professional.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Household** and **Assumptions** to set residence and any state-tax override. Use **Scenarios** to compare a move, then inspect **Results** for state tax, total tax, spending, and ending assets.',
    },
  ],
}
