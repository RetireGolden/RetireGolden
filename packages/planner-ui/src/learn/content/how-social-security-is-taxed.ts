/**
 * "How Social Security is taxed" - a Taxes P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const howSocialSecurityIsTaxedArticle: LearningArticle = {
  slug: 'how-social-security-is-taxed',
  title: 'How Social Security is taxed',
  description: 'Why up to 85% of benefits can become taxable income.',
  category: 'taxes',
  tags: ['social security', 'taxable benefits', 'provisional income', 'combined income', 'magi'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.irs.gov/forms-pubs/about-publication-915'],
  relatedArticles: [
    'agi-magi-and-taxable-income',
    'ordinary-income-vs-capital-gains',
    'tax-cliffs-and-bracket-edges',
    'why-roth-conversions-raise-other-costs',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security', '/plan/:planId/results', '/plan/:planId/strategy'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Social Security benefits are not automatically tax-free and they are not automatically fully taxable. Federal tax law uses a formula that looks at benefits plus other income. As other income rises, more of the benefit can become taxable, up to a cap.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The taxable share of Social Security depends on benefits plus other income.',
        'Extra IRA withdrawals, Roth conversions, wages, or capital gains can make more benefits taxable.',
        'RetireGolden models taxable Social Security as part of the federal tax calculation, not as a flat percentage.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The Social Security tax formula uses a combined-income style calculation: other income plus a portion of benefits. When that measure crosses certain thresholds, part of the benefits enters taxable income. This can make the next dollar of other income cost more than expected, because it may bring some Social Security income along with it.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/social-security-taxation.webp' },
      caption:
        'Other income can pull more Social Security benefits into taxable income as the year fills up.',
      alt: 'A Social Security ribbon runs beside other income streams toward a tax gate, with rising steps showing more of the benefit becoming taxable.',
    },
    {
      type: 'formula',
      expression: 'provisional income = income excluding Social Security + 50% of Social Security benefits',
      where: [
        { symbol: 'income excluding Social Security', meaning: 'ordinary income and gains before adding taxable benefits in RetireGolden\'s planning model' },
        { symbol: '50% of Social Security benefits', meaning: 'half of the annual Social Security benefit used in the federal formula' },
      ],
      note: 'Tax-exempt interest and several form-level details are not separately modeled in RetireGolden.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Martin household',
      assumptions: [
        { label: 'Benefits', value: 'Social Security begins at 67' },
        { label: 'Other income', value: '$30,000 traditional IRA withdrawal fills the spending gap' },
        { label: 'Tax ripple', value: 'The withdrawal also makes about $12,000 more Social Security taxable' },
      ],
      summary:
        'The tax return does not just see a $30,000 IRA withdrawal. It can also pull roughly **$12,000** more benefits into taxable income, so taxable income rises faster than the withdrawal alone.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden computes taxable Social Security inside the federal tax engine each year. The taxable portion feeds AGI, MAGI, deductions, taxable income, and the final tax calculation. The Results ledger shows the pieces so you can see when benefits start affecting taxes.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming no Social Security is taxable because payroll tax was already paid.',
        'Assuming exactly 85% is always taxable. That is only a maximum federal share.',
        'Ignoring the effect of capital gains or Roth conversions on taxable benefits.',
        'Forgetting that state treatment of Social Security can differ from federal treatment.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Social Security** to set claiming assumptions. Use **Results** to inspect Social Security income, taxable Social Security, AGI, MAGI, taxable income, and tax. Use **Strategy** to test whether different withdrawal or conversion choices change the taxable share.',
    },
  ],
}
