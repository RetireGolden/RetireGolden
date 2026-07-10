import type { LearningArticle } from '../learningRegistry'

export const assumptionStateTaxOverrideArticle: LearningArticle = {
  slug: 'assumption-state-tax-override',
  title: 'The state tax override',
  description: 'How RetireGolden models state income taxes in retirement and when to apply a flat-rate override.',
  category: 'assumptions',
  tags: ['taxes', 'state tax', 'effective tax', 'override'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://taxfoundation.org/data/all/state/state-income-tax-rates/',
  ],
  relatedArticles: [
    'state-income-taxes-in-retirement',
    'marginal-vs-effective-tax-rate',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "State income taxes can vary widely. While some states have progressive brackets similar to the federal system, others have flat rates, and several have no income tax at all. In addition, many states exempt or partially exclude retirement income (like Social Security or pensions) from taxation.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden defaults the **state effective tax override** to **0%**, which commands the engine to use its modeled, state-specific brackets.',
        'If you set the override to a rate greater than 0% (e.g., 4%), the engine will ignore the per-state models and apply that flat rate to all taxable income.',
        'Use the override if you live in a state that is not yet modeled in RetireGolden, or if you want to approximate a complex local tax structure.',
      ],
    },
    { type: 'heading', text: 'How RetireGolden models state taxes' },
    {
      type: 'prose',
      md: "By default, the RetireGolden engine uses the state of residence entered on the **Household** screen to apply the correct progressive tax brackets, standard deductions, and retirement exclusions for that state. This data is updated annually from sources like the Tax Foundation.",
    },
    {
      type: 'table',
      caption: 'How to choose the state-tax setting.',
      columns: ['Choice', 'What happens', 'Best use'],
      rows: [
        ['Leave at 0%', 'RetireGolden uses the modeled state tax rules', 'Your state is modeled and the built-in rules fit your plan'],
        ['Enter a flat rate', 'The flat override replaces the modeled state calculation', 'Your state is unmodeled, local taxes matter, or you want a rough move scenario'],
      ],
    },
    { type: 'heading', text: 'When to use the override' },
    {
      type: 'prose',
      md: "A flat rate override is a useful planning shortcut in several scenarios:",
    },
    {
      type: 'list',
      items: [
        '**Unmodeled States:** If your state has complex rules that are not yet fully represented in RetireGolden, you can estimate your average state tax burden and enter it as a flat override.',
        '**Simplifying Moves:** If you plan to move to a different state during retirement and want to approximate the tax change without setting up multi-state movement plans, a flat rate override is a fast way to test the impact.',
        '**Local Taxes:** The built-in state models do not include county or municipal income taxes (such as city tax in New York or local taxes in Ohio/Pennsylvania). You can add a 1% or 2% override to represent these local levies on top of your state brackets.',
      ],
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'The override is a broad effective rate, not a second state tax layered on top of modeled brackets.',
        'A flat rate cannot capture brackets, deductions, retirement-income exclusions, or local quirks with precision.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'You can enter a flat percentage under **State effective tax (override)** on the **Assumptions** screen. Leave this field at 0% to use the built-in state brackets. If you choose to override, keep in mind that the flat rate is applied to ordinary taxable income after federal deductions.',
    },
  ],
}
