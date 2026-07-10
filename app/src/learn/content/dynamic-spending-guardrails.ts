import type { LearningArticle } from '../learningRegistry'

export const dynamicSpendingGuardrailsArticle: LearningArticle = {
  slug: 'dynamic-spending-guardrails',
  title: 'Dynamic spending guardrails',
  description: 'How flexible spending rules can reduce sequence risk without pretending risk disappears.',
  category: 'risk-uncertainty',
  tags: ['guardrails', 'spending', 'sequence risk', 'monte carlo', 'flexibility'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-06',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.onefpa.org/journal/Pages/Decision-Rules-and-Portfolio-Management-for-Retirees.aspx',
    'https://www.onefpa.org/journal/Pages/COLA-Rules-and-Portfolio-Management-for-Retirees.aspx',
  ],
  relatedArticles: [
    'risk-based-guardrails',
    'sequence-of-returns-risk',
    'understanding-monte-carlo-success-rate',
    'three-big-questions-spending-time-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/insights', '/plan/:planId/spending', '/plan/:planId/monte-carlo'],
  currentYearSensitive: false,
  priority: 'P1',
  featured: false,
  blocks: [
    {
      type: 'prose',
      md: 'Dynamic spending guardrails are rules for temporarily adjusting retirement spending when a portfolio is under stress or running ahead. Rather than taking the same inflation-adjusted withdrawal every year, you define ahead of time when you would trim flexible spending and when you would allow raises.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        '**Can reduce sequence risk**: Spending less during weak markets can reduce the need to sell investments after losses.',
        '**Makes flexibility explicit**: Guardrails turn "we could cut back if needed" into a rule you can test and discuss before stress arrives.',
        '**Does not remove risk**: A flexible plan can still fail if spending is too high, markets are unusually poor, or large care costs arrive.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'In a fixed-spending retirement plan, you choose a starting budget and increase it by inflation every year. If markets fall early in retirement, the plan may need to sell more shares from a smaller portfolio to fund that same budget.\n\nGuardrail methods set rules before that happens. A capital-preservation rule might trim spending when the current withdrawal rate climbs too far above the starting rate. A prosperity rule might allow a raise when the portfolio grows enough that the withdrawal rate falls.',
    },
    {
      type: 'table',
      columns: ['Strategy', 'During a market drop', 'Monte Carlo success rate', 'Lifetime spending'],
      rows: [
        ['Fixed spending', 'Withdraw the same amount from a smaller portfolio', 'Often lower', 'Steadier lifestyle, higher depletion risk'],
        ['Dynamic guardrails', 'Temporarily trim flexible spending', 'Often higher', 'More variable, but with more built-in response'],
      ],
    },
    { type: 'heading', text: 'Why it matters in RetireGolden' },
    {
      type: 'prose',
      md: "RetireGolden models guardrails directly inside the same annual ledger used by Results and Monte Carlo. In Spending, you can enter a required floor, target spending, optional ideal/excess annual upside, and flexible goals with earliest/latest windows, priority, and partial-funding rules. When withdrawal-rate guardrails are active, the engine cuts flexible layers before the required floor and can restore target spending or fund upside layers in strong paths.",
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Ortiz household',
      assumptions: [
        { label: 'Starting portfolio', value: '$1,000,000' },
        { label: 'Baseline spending', value: '$50,000 / year' },
        { label: 'Market drop', value: 'Portfolio drops to $750,000 in year 2' },
        { label: 'Current withdrawal rate', value: '$50,000 / $750,000 = 6.67% (originally 5.0%)' },
        {
          label: 'Guardrail trigger',
          value: 'Because 6.67% is more than 20% above the starting 5% rate, they trim spending by 10% to $45,000 until the portfolio recovers.',
        },
      ],
      summary: 'The rule does not predict markets. It defines a response the household is willing to take if weak markets arrive early.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        '**Waiting too long to cut**: Cuts are most effective when made soon after the guardrail is crossed, not years later.',
        '**Pretending all spending is flexible**: A temporary 10% cut is easier when it comes from travel, gifts, dining, or upgrades than from housing, insurance, or medical needs.',
        '**Treating a research rule as a promise**: Guardrails can improve modeled resilience, but they still depend on market returns, taxes, inflation, health costs, and whether the household can follow the rule.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** to set the required floor, upside layers, flexible goals, and guardrail policy. Use **Results** to audit annual guardrail actions and layer shortfalls. Use **Monte Carlo** to compare required-floor success, target-lifestyle success, target attainment, and flexible-goal outcomes across many market paths.',
    },
  ],
}
