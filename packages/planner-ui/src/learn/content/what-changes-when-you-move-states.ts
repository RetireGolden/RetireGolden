/**
 * "What changes when you move states" - a Taxes P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const whatChangesWhenYouMoveStatesArticle: LearningArticle = {
  slug: 'what-changes-when-you-move-states',
  title: 'What changes when you move states',
  description: 'How domicile, split-year moves, pension source rules, and model boundaries affect a relocation comparison.',
  category: 'taxes',
  tags: ['state tax', 'relocation', 'domicile', 'part-year resident', 'pension', 'retirement income'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-09',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.irs.gov/businesses/small-businesses-self-employed/state-government-websites',
    'https://www.law.cornell.edu/uscode/text/4/114',
    'https://www.tax.ny.gov/pit/file/pit_definitions.htm',
    'https://www.ftb.ca.gov/file/personal/residency-status/part-year-and-nonresident.html',
  ],
  relatedArticles: [
    'state-income-taxes-in-retirement',
    'using-scenarios-to-compare-choices',
    'assumption-state-tax-override',
    'real-estate-home-equity-and-debt',
  ],
  relatedPlannerRoutes: ['/plan/:planId/relocation', '/plan/:planId/household'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'Moving to another state can change which state income-tax rules apply to your plan, but it does not turn relocation into a simple tax ranking. This article explains what RetireGolden can price, what depends on legal residency facts, and what belongs outside the model.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'A move changes your state of residence for future years only if your real-world domicile and filing facts support it.',
        'A split-year move can put part of a calendar year under the old state and part under the new state.',
        'RetireGolden compares modeled state and local **income tax** effects; property tax, sales tax, insurance, healthcare access, and lifestyle tradeoffs still need separate judgment.',
      ],
    },
    { type: 'heading', text: 'What actually changes' },
    {
      type: 'prose',
      md: 'State income tax is not one universal rule. A state may tax Social Security differently, exclude some retirement income, treat public pensions differently from private retirement income, tax capital gains like wages, or have no broad income tax at all. When you compare states, RetireGolden reruns your actual year-by-year plan through the destination state rules instead of using a generic "tax friendly" list.',
    },
    {
      type: 'table',
      caption: 'Pieces to separate before treating a move as a tax win.',
      columns: ['Moving piece', 'Why it matters', 'RetireGolden lens'],
      rows: [
        [
          'Domicile and residence',
          'States decide who counts as a resident under their own rules. Intent, homes, days, and records can matter.',
          'You enter the current state and planned state moves; RetireGolden does not prove legal domicile.',
        ],
        [
          'Split-year move',
          'The move year may be taxed partly by each state, and source income can still belong to the old state.',
          'A Relocation Compare move year models a July split-year move, matching the Household screen.',
        ],
        [
          'Retirement-income rules',
          'Social Security, IRA withdrawals, private pensions, and public pensions may not all get the same state treatment.',
          'Modeled packs price Social Security treatment and retirement-income exclusions through the normal tax ledger.',
        ],
        [
          'Local rate and spending knobs',
          'City income tax or cost of living can overwhelm a state-tax headline.',
          'Optional flat inputs let you approximate them, but they are broad assumptions you control.',
        ],
        [
          'Out-of-model costs',
          'Property tax, sales tax, homeowners insurance, healthcare networks, family support, and climate risk can dominate the decision.',
          'The comparison names these boundaries instead of pretending income tax chooses the best state.',
        ],
      ],
    },
    { type: 'heading', text: 'Domicile is more than an address' },
    {
      type: 'prose',
      md: 'For tax purposes, a state move usually turns on facts, not just the mailing address on an account. State guidance commonly describes domicile as your permanent home and the place you intend to return to after being away. Some states also have statutory-residency tests tied to days in the state and a maintained home.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'Practical translation: if a plan says "move to Florida in 2030," that is a modeling assumption. Your actual filing position may depend on leases or deeds, voter registration, driver license, doctors, professional ties, days present, and records showing where your life is centered.',
    },
    { type: 'heading', text: 'Pension source rules have a special federal limit' },
    {
      type: 'prose',
      md: 'A former state generally cannot tax certain retirement income after you are no longer a resident or domiciliary of that state. Federal law covers many common retirement-payment categories, including qualified plans, individual retirement plans, 403(b) arrangements, eligible 457 plans, and governmental plans. That does not mean the old state loses every possible tax claim: real estate income, business income, wages earned there, and other source items can still have their own rules.',
    },
    {
      type: 'callout',
      tone: 'warn',
      md: 'RetireGolden models retirement-plan income inside a household projection. It is not a state residency audit tool, and it does not allocate every possible nonresident source-income item.',
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Hill household',
      assumptions: [
        { label: 'Current plan', value: 'Resident in a taxed state with IRA withdrawals, Social Security, taxable gains, and a public pension' },
        { label: 'Candidate A', value: 'Move to a no-broad-income-tax state in 2030' },
        { label: 'Candidate B', value: 'Move to a state that taxes income but excludes more retirement income' },
        { label: 'Lifestyle adjustment', value: 'Candidate B is closer to family, but spending is modeled 6% higher' },
      ],
      summary:
        'The lowest state-income-tax row is not automatically the best life choice. The table helps isolate the tax difference, while scenarios and spending assumptions capture the tradeoffs the tax model cannot know.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'The Relocation Compare page takes candidate states and runs each one as a scenario patch over existing plan fields: household state, planned state moves, local income-tax rate, and baseline spending. The row you see is the same kind of plan run you would get by editing the plan by hand, which makes "Add as scenario" a clean way to keep a candidate for side-by-side comparison.',
    },
    {
      type: 'prose',
      md: 'Driver details explain major state income-tax levers by re-pricing the state tax line with one rule neutralized at a time: Social Security treatment, retirement-income exclusions, separate public-pension rules when modeled, and capital-gain treatment. Those drivers explain the state-tax line; they do not claim to measure housing, healthcare, property tax, or quality of life.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating a no-income-tax state as automatically cheaper after housing, property tax, insurance, sales tax, and travel are counted.',
        'Assuming the old state stops mattering on the exact day you change your address, even when source income or residency facts are complicated.',
        'Comparing states with different spending assumptions and then reading the result as a pure tax difference.',
        'Forgetting that a flat state-tax override can mask the modeled state packs. Clear or document the override before relying on a state-by-state comparison.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Household** to set your current state and any planned move already in the baseline plan. Use **Relocation Compare** to test up to five candidate states without changing the plan. Use **Add as scenario** when a candidate is worth keeping, then review **Scenarios** and **Results** for the full plan tradeoff.',
    },
  ],
}
