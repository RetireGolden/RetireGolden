/**
 * "Spending profiles and the retirement smile" - a Using RetireGolden P1 article.
 */

import type { LearningArticle } from '../learningRegistry'

export const spendingProfilesAndRetirementSmileArticle: LearningArticle = {
  slug: 'spending-profiles-and-the-retirement-smile',
  title: 'Spending profiles and the retirement smile',
  description: 'How flat, smile, and front-loaded spending profiles become editable phase rows.',
  category: 'using-retiregolden',
  tags: ['spending', 'retirement smile', 'phases', 'travel', 'budget'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-06',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.financialplanningassociation.org/sites/default/files/2020-09/MAY14%20JFP%20Blanchett_0.pdf',
    'https://www.bls.gov/cex/',
  ],
  relatedArticles: [
    'building-a-retirement-spending-budget',
    'dynamic-spending-guardrails',
    'using-scenarios-to-compare-choices',
    'three-big-questions-spending-time-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/scenarios'],
  currentYearSensitive: false,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A spending profile is a starting shape for recurring lifestyle spending. Instead of asking you to enter every future year, RetireGolden can write a few phase rows that change baseline spending at selected ages.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Profiles are shortcuts, not hidden model settings: they write ordinary Spending phase rows.',
        'The retirement smile preset lowers recurring lifestyle spending at ages 75 and 85.',
        'Front-loaded travel raises early retirement spending, then returns to baseline at 75.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Many retirement plans are easier to understand as phases. Some households want a flat real budget. Others expect higher go-go spending early in retirement, lower slow-go spending later, or a front-loaded travel window before age 75.\n\nRetireGolden keeps this simple: choosing a profile replaces the current phase rows with visible rows you can edit or remove. The engine still sees only baseline spending plus phase multipliers.',
    },
    {
      type: 'table',
      caption: 'What each Spending profile writes.',
      columns: ['Profile', 'Rows RetireGolden creates', 'Use when'],
      rows: [
        ['Flat', 'No phase rows', 'You want recurring lifestyle spending to stay level in real terms'],
        ['Retirement smile', '0.90 from age 75, then 0.80 from age 85', 'You want to test lower slow-go and no-go lifestyle spending'],
        ['Front-loaded travel', '1.10 from retirement until age 75, then 1.00 from age 75', 'You want a larger early travel or project budget that later settles back'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Patel household',
      assumptions: [
        { label: 'Baseline spending', value: '$100,000 per year in today\'s dollars' },
        { label: 'Profile', value: 'Retirement smile' },
        { label: 'Age 75 phase', value: 'Recurring lifestyle spending becomes $90,000 before inflation' },
        { label: 'Age 85 phase', value: 'Recurring lifestyle spending becomes $80,000 before inflation' },
      ],
      summary:
        'The profile changes only recurring lifestyle spending. Healthcare premiums, debt payments, property costs, insurance premiums, and one-time goals keep their own schedules.',
    },
    { type: 'heading', text: 'Why this is not a prediction' },
    {
      type: 'prose',
      md: 'The retirement smile is a planning pattern, not a promise that your spending will decline. Travel may fall, but gifts, housing, taxes, healthcare, or care needs may not. Use profiles to test a version of the plan, then check Results and Monte Carlo to see whether the plan still has room if the shape is wrong.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Treating the smile preset as automatic advice instead of a scenario to test.',
        'Forgetting that a new profile replaces existing phase rows.',
        'Using a lower phase multiplier to hide a known healthcare, debt, insurance, or long-term-care cost that belongs in its own input.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** to choose a profile or edit the phase rows directly. Use **Scenarios** to compare flat, smile, and front-loaded versions side by side before changing the base plan.',
    },
  ],
}
