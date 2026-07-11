/**
 * "Standard deduction, senior deduction, and itemizing" - a Taxes P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const standardDeductionSeniorDeductionItemizingArticle: LearningArticle = {
  slug: 'standard-deduction-senior-deduction-and-itemizing',
  title: 'Standard deduction, senior deduction, and itemizing',
  description: 'How deductions lower taxable income and when itemizing wins.',
  category: 'taxes',
  tags: ['standard deduction', 'senior deduction', 'itemized deductions', 'salt', 'taxable income'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-20',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.irs.gov/filing/federal-income-tax-rates-and-brackets'],
  relatedArticles: [
    'agi-magi-and-taxable-income',
    'marginal-vs-effective-tax-rate',
    'ordinary-income-vs-capital-gains',
    'tax-cliffs-and-bracket-edges',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/assumptions', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Deductions do not erase income. They reduce the income that federal brackets apply to. In retirement, deductions matter because they can change the tax cost of withdrawals, Roth conversions, capital gains, and Social Security taxation.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The standard deduction is the default deduction amount based on filing status and age.',
        'Itemizing can win when deductible expenses are larger than the standard deduction.',
        'RetireGolden compares standard and itemized deductions, then applies the modeled senior deduction when current-law rules allow it.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Taxable income is generally income after deductions. The standard deduction is simple and available to many households. Itemized deductions are specific expenses, such as deductible state and local taxes, mortgage interest, and charitable giving. The better choice is usually the larger deduction, but the exact rules and limits change over time.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/deductions-itemizing.webp' },
      caption:
        'Deductions sit between income and taxable income; the larger standard or itemized base wins before brackets apply.',
      alt: 'Income flows into a deduction filter with two competing paths, one standard and one itemized, before a smaller stream reaches a tax-bracket ladder.',
    },
    {
      type: 'table',
      caption: 'How deduction pieces affect the modeled tax year.',
      columns: ['Deduction piece', 'What it means', 'Planning note'],
      rows: [
        ['Standard deduction', 'A filing-status amount with age-based additions', 'Often wins when itemized expenses are modest'],
        ['Itemized deductions', 'Specific deductible expenses entered in the plan', 'Can win in high property-tax, mortgage-interest, or giving years'],
        ['SALT cap', 'A limit on deductible state and local tax in the itemized total', 'RetireGolden caps the SALT component using the year\'s parameter pack'],
        ['Senior deduction', 'A current-law extra deduction for eligible older taxpayers', 'Modeled with phaseout and expiration rules from the parameter pack'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Alvarez household',
      assumptions: [
        { label: 'Retirement income', value: 'Pension, IRA withdrawals, and $12,000 of taxable gains' },
        { label: 'Itemized total', value: '$21,000 of property tax, mortgage interest, and giving' },
        { label: 'Standard deduction estimate', value: '$30,000 for their filing status and ages' },
      ],
      summary:
        'Because $21,000 is below the $30,000 standard deduction estimate, itemizing would not lower taxable income here. A later year with a larger gift could flip that comparison.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'RetireGolden uses the federal parameter pack for the standard deduction, age-65 additions, SALT cap, and senior deduction. The tax engine compares standard and itemized deductions, adds the modeled senior deduction when applicable, and then applies ordinary-income and capital-gain tax rules to taxable income.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Using AGI or MAGI as if deductions had already been applied.',
        'Assuming itemizing wins just because one deductible expense is large.',
        'Forgetting that deduction rules can expire or change.',
        'Expecting RetireGolden to replace tax-preparation software for every form-level limitation.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Strategy** for itemized-deduction inputs such as deductible state and local tax, mortgage interest, and charitable giving. Use **Results** to inspect deduction, taxable income, ordinary tax, and capital-gain tax by year.',
    },
  ],
}
