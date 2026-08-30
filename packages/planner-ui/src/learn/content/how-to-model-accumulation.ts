import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'Most retirement calculators start the day you stop working. If you are still saving, the years before that are where the plan is actually built. Salary growth, employer matching, and contribution schedules all change how much is there when you get to the finish line, and RetireGolden models each of them separately.',
  },
  { type: 'heading', text: 'Three key steps' },
  {
    type: 'list',
    items: [
      'Set up real salary growth on your wages in the Income screen.',
      'Configure employer matches and custom contribution schedules in the Accounts screen.',
      'Review the Path to Financial Independence card and SWR under Assumptions and Results.',
    ],
  },
  {
    type: 'scenario',
    name: 'Walkthrough: Dana\'s setup',
    assumptions: [
      { label: 'Step 1 (Income)', value: 'Dana sets a 3% real raise rate on her $80,000 wages.' },
      { label: 'Step 2 (Accounts)', value: 'Dana sets a 100% employer match up to 5% of pay on her 401(k), and schedules brokerage contributions.' },
      { label: 'Step 3 (Results)', value: 'Dana views her FI Number and SWR target (4%) on the Results page.' },
    ],
    summary: 'Dana\'s plan now reflects realistic, compounding career growth rather than flat, static savings.',
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Entering nominal raises in the real raise field. Use the raise above inflation, not the total expected raise.',
      'Turning on a contribution schedule and forgetting that it replaces the flat annual contribution.',
      'Putting an employer match on an IRA. Matches belong on employer retirement accounts such as a 401(k) or 403(b).',
    ],
  },
  { type: 'heading', text: 'Where this shows up in RetireGolden' },
  {
    type: 'prose',
    md: 'Each section has context-specific fields: **Real raise rate** in Income, **Employer match** and **Schedule contributions over time** in Accounts, the **Coast check: stop contributing** template in Scenarios, and the **Path to Financial Independence (FIRE)** chart card in Results.',
  },
]
