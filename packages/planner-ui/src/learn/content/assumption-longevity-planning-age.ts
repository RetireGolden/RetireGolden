import type { LearningArticle } from '../learningRegistry'

export const assumptionLongevityPlanningAgeArticle: LearningArticle = {
  slug: 'assumption-longevity-planning-age',
  title: 'How long to plan for (longevity)',
  description: 'Why RetireGolden defaults to planning ages in the mid-to-late 90s, and the difference between life expectancy and planning horizon.',
  category: 'assumptions',
  tags: ['longevity', 'life expectancy', 'planning age', 'planning horizon'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-06-30',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.longevityillustrator.org/',
    'https://www.ssa.gov/oact/STATS/table4c6.html',
    'https://www.soa.org/resources/announcements/press-releases/2024/actuaries-longevity-illustrator-new-look/',
  ],
  relatedArticles: [
    'longevity-risk',
    'planning-for-couples-and-survivor-years',
    'understanding-your-plan-assumptions',
  ],
  relatedPlannerRoutes: ['/plan/:planId/assumptions', '/plan/:planId/household'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: "One of the most difficult questions in retirement planning is: *How long will my money need to last?* Planning to your average \"life expectancy\" is a common trap—it is merely a median, meaning you have a 50% chance of outliving your assets. A secure retirement plan requires planning for a much longer horizon.",
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'RetireGolden defaults your planning age to a floor of **95** per person.',
        'Life expectancy is a 50/50 midpoint. Actuarial guidance is to plan for the **75th to 90th percentile** of survival to protect against outliving your savings.',
        'For couples, joint survival (the probability that at least one partner is still alive) is significantly higher than individual survival, commonly reaching age 95 or 98.',
      ],
    },
    { type: 'heading', text: 'Life expectancy vs. planning horizon' },
    {
      type: 'prose',
      md: "According to the **Actuaries Longevity Illustrator** (sponsored by the American Academy of Actuaries and the Society of Actuaries), a 65-year-old non-smoking male has a median life expectancy of about age 86. However, that means half of all 65-year-old men will live *past* 86. To build a safe plan, you must look at the tail end of the survival curve:",
    },
    {
      type: 'table',
      caption: 'Survival probabilities for 65-year-olds (Non-smokers)',
      columns: ['Percentile of Survival', '65yo Male', '65yo Female', 'Couple (At least one alive)'],
      rows: [
        ['**50% (Median)**', 'Age 86', 'Age 89', 'Age 92'],
        ['**25% (75th percentile)**', 'Age 91', 'Age 93', 'Age 96'],
        ['**10% (90th percentile)**', 'Age 95', 'Age 97', 'Age 99'],
      ],
    },
    {
      type: 'prose',
      md: "As shown, there is a **10% chance** that a couple will have at least one partner live to **age 99**. Planning to age 90 or 95 leaves a significant risk of running out of money in your final years. That is why RetireGolden floors all planning age defaults at **95**.",
    },
    { type: 'heading', text: 'Modeling couples and survivor years' },
    {
      type: 'prose',
      md: "When planning for a couple, the plan must account for the **survivor period**—the years after one spouse passes. This period often sees a drop in household income (losing the smaller of the two Social Security checks) while fixed expenses (like housing and utilities) remain mostly flat. Tying the planning horizon to the longer joint life expectancy ensures the surviving partner is not left underfunded.",
    },
    { type: 'heading', text: 'Watch-outs' },
    {
      type: 'list',
      items: [
        'Life expectancy is not the same as a planning horizon; half of similar people may live longer.',
        'For couples, the relevant horizon is often the last survivor, not either person alone.',
      ],
    },
    { type: 'heading', text: 'Where this shows up in the app' },
    {
      type: 'prose',
      md: 'Your planning age is set per household member on the **Household** step (under the edit icon for each person). While the app defaults to age 95, you can override this manually if you have specific family history or health indications that suggest a different target.',
    },
  ],
}
