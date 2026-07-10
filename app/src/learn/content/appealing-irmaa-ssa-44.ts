/**
 * "Appealing IRMAA after a life change (Form SSA-44)" - a Healthcare P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const appealingIrmaaSsa44Article: LearningArticle = {
  slug: 'appealing-irmaa-ssa-44',
  title: 'Appealing IRMAA after a life change (Form SSA-44)',
  description: 'How a retirement or the death of a spouse can qualify you to have Medicare premiums re-priced on current income.',
  category: 'healthcare',
  tags: ['medicare', 'irmaa', 'ssa-44', 'life-changing event', 'widow penalty', 'survivor', 'retirement', 'magi'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-09',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/medicare/lower-irmaa',
    'https://www.ssa.gov/forms/ssa-44.pdf',
    'https://www.medicare.gov/basics/costs/medicare-costs',
  ],
  relatedArticles: [
    'irmaa-two-year-lookback',
    'medicare-part-b-vs-part-d-irmaa',
    'widows-penalty-and-survivor-brackets',
    'healthcare-after-65',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/survivor', '/plan/:planId/results'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "Medicare's income surcharge (IRMAA) is normally based on your tax return from two years earlier. When your income has just dropped because of a major life change — you stopped working, or your spouse died — that lookback can charge you a premium your current income no longer justifies. Form SSA-44 is the one-page form that asks Social Security to use this year's estimated income instead.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'IRMAA usually looks at MAGI from two tax years ago, so an income drop takes two years to show up in premiums.',
        'After a qualifying life-changing event, Form SSA-44 lets you request a redetermination based on the current year\'s estimated income.',
        'Work stoppage (retirement) and the death of a spouse are two of the eight qualifying events — and the two most common in retirement planning.',
        'The request only helps: if your estimate is not lower, Social Security keeps the normal determination.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'The two-year lookback exists because Social Security prices premiums from the most recent tax return the IRS has on file. That works fine when income is steady, and badly when it just fell.\n\nCongress anticipated this: when one of eight **life-changing events** reduces your income, you can report the event and your current-year income estimate on Form SSA-44 (or by calling or visiting Social Security). If granted, that year\'s premium is re-priced on the estimate instead of the two-year-old return. The events include marriage, divorce or annulment, death of a spouse, work stoppage, work reduction, loss of income-producing property, loss of pension income, and an employer settlement payment.\n\nTwo of these are routine retirement-planning moments. Someone who retires at 66 with a strong final salary would otherwise pay two years of IRMAA priced on paychecks that have stopped. A surviving spouse faces the same lag on top of the single-filer thresholds — part of the "widow\'s penalty."',
    },
    { type: 'heading', text: 'What a redetermination is worth' },
    {
      type: 'table',
      caption: 'The surcharge tiers are cliffs, so relief is worth the whole tier, not a sliver.',
      columns: ['Situation', 'Without SSA-44', 'With a granted SSA-44'],
      rows: [
        ['Retired last year, final-salary MAGI on record', 'Premiums priced on working income for up to two years', 'Premiums priced on this year\'s (retirement) income'],
        ['Widowed, joint income on record, single thresholds now', 'Lookback MAGI from joint years meets single-filer tiers', 'Premiums priced on the survivor\'s own income'],
        ['Income did not actually fall', 'Normal determination', 'No change — the request cannot raise your premium'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Alvarez household',
      assumptions: [
        { label: 'Event', value: 'One spouse dies in 2030; the survivor files as single from 2031' },
        { label: 'On record', value: 'Joint MAGI of roughly $150,000 from 2029, over the single-filer IRMAA threshold' },
        { label: 'Current income', value: 'The survivor\'s own 2031 income is about $60,000, under every tier' },
      ],
      summary:
        'Without a redetermination, the 2031 premium is priced on the couple\'s 2029 income against single-filer thresholds — a surcharge tier the survivor\'s actual income never touches. Reporting the death of spouse on Form SSA-44 with the 2031 estimate removes the surcharge for that year, and the same logic applies in 2032.',
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: 'On the **Spending** screen, the healthcare section has opt-in toggles to model SSA-44 relief in survivor years and in retirement years. When enabled, the projection prices IRMAA in the two years after the event on the *lower* of the normal lookback MAGI and the prior year\'s MAGI (the planning-grade stand-in for a current-year estimate). The Roth & Tax Optimizer sees the same treatment, so conversion advice accounts for it.\n\nThe stand-in makes the model deliberately conservative in the **first** year after the event: its estimate still references the event year itself (a death year is a full joint year), where a real filing could use the survivor\'s own current income. It also leaves the event year on the plain lookback. So the modeled relief is a floor, not a ceiling — an actual redetermination can do somewhat better.\n\nRetireGolden models the *effect* of a granted redetermination. Actually filing Form SSA-44 — with the event date and your income estimate — is your task, and Social Security decides each request.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Assuming the premium relief is automatic. Social Security does not know your income dropped until you tell them.',
        'Waiting out the lookback instead of filing. Each affected year can be worth a full surcharge tier per person.',
        'Forgetting the second year. The lookback can reference pre-event income for two premium years, and each can be redetermined.',
        "Treating a Roth conversion as a qualifying event. Only the eight listed life-changing events qualify — a conversion that raised MAGI doesn't.",
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Turn the toggles on under **Spending → Healthcare**, then compare premiums by year in **Results**. For couples, the **Survivor transition** view shows the IRMAA difference with and without SSA-44 for each death timing.',
    },
  ],
}
