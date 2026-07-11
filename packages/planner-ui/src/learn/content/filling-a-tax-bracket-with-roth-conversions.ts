/**
 * "Filling a tax bracket with Roth conversions" - a Withdrawals and Roth P0 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const fillingTaxBracketArticle: LearningArticle = {
  slug: 'filling-a-tax-bracket-with-roth-conversions',
  title: 'Filling a tax bracket with Roth conversions',
  description: 'Converting just enough to use up a low bracket without spilling over.',
  category: 'withdrawals-roth',
  tags: ['roth conversion', 'tax bracket', 'taxable income', 'marginal rate', 'fill to target'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-19',
  reviewCadence: 'annual',
  sourceUrls: ['https://www.irs.gov/filing/federal-income-tax-rates-and-brackets'],
  relatedArticles: [
    'roth-conversion-basics',
    'marginal-vs-effective-tax-rate',
    'why-roth-conversions-raise-other-costs',
    'tax-cliffs-and-bracket-edges',
  ],
  relatedPlannerRoutes: ['/plan/:planId/strategy', '/plan/:planId/results', '/plan/:planId/optimize'],
  currentYearSensitive: true,
  priority: 'P0',
  blocks: [
    {
      type: 'prose',
      md: 'Filling a tax bracket means converting enough pre-tax money to use the remaining room in a chosen tax bracket, then stopping before the next bracket starts. It is a controlled way to ask: "How much can I convert before the next dollar gets more expensive?"',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'The target is usually **taxable income**, not gross income.',
        'The conversion fills the space between your baseline taxable income and the top of the chosen bracket.',
        'Bracket filling is only one lens. MAGI cliffs, IRMAA, ACA credits, and Social Security taxation can matter more than the bracket line.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Imagine taxable income as a stack of shelves. Your wages, pensions, taxable Social Security, RMDs, and other income already fill part of the stack. A Roth conversion adds more income. Filling a bracket means adding conversion dollars until the current shelf is full, then stopping.',
    },
    {
      type: 'figure',
      image: { src: '/learn/images/tax-bracket-fill.webp' },
      caption:
        'Bracket filling uses the remaining space in a lower tax bracket before conversion income spills into the next bracket.',
      alt: 'A stack of tax bracket shelves is partly filled by baseline income, with conversion dollars filling the remaining space below a higher bracket marker.',
    },
    { type: 'heading', text: 'A quick formula' },
    {
      type: 'formula',
      expression: 'conversion room = bracket ceiling - baseline taxable income',
      where: [
        { symbol: 'bracket ceiling', meaning: 'the top of the tax bracket you are willing to fill' },
        { symbol: 'baseline taxable income', meaning: 'taxable income before the discretionary conversion' },
        { symbol: 'conversion room', meaning: 'the rough conversion amount that fits before crossing that ceiling' },
      ],
      basis: 'nominal',
      note: 'The app uses the federal tax engine and year-specific plan details. This formula is only the mental model; Social Security taxation and deductions can make the real result kinked.',
    },
    { type: 'heading', text: 'Why RetireGolden sizes it carefully' },
    {
      type: 'prose',
      md: 'RetireGolden\'s fill-to-target strategy sizes conversions by testing the federal tax result, not by using a one-line estimate. That matters because deductions, taxable Social Security, and other inputs can make taxable income move differently than the conversion amount itself.',
    },
    {
      type: 'table',
      caption: 'What can change the bracket-filling answer.',
      columns: ['Input', 'Why it matters', 'Where to check'],
      rows: [
        ['Filing status', 'Bracket ceilings differ by filing status', 'Household'],
        ['Existing income', 'Wages, pensions, RMDs, and taxable benefits may already fill the bracket', 'Income and Results'],
        ['Deductions', 'Taxable income starts after deductions', 'Assumptions and Results'],
        ['Capital gains', 'They sit on a separate ladder but can still interact with taxable income', 'Results'],
        ['MAGI-sensitive costs', 'A bracket target can still cross an IRMAA or ACA boundary', 'Results and healthcare inputs'],
      ],
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Using gross income when the strategy targets taxable income.',
        'Stopping at the bracket line but ignoring MAGI-based costs.',
        'Assuming this year\'s best bracket-fill is the best lifetime strategy.',
        'Forgetting that tax brackets and other thresholds can change over time.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Strategy** to set a fill-to-target Roth conversion rule. Then use **Results** to inspect taxable income, tax, MAGI, conversions, and later RMDs year by year.',
    },
  ],
}
