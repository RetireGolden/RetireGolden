import type { LearningArticle } from '../learningRegistry'

export const riskBasedGuardrailsArticle: LearningArticle = {
  slug: 'risk-based-guardrails',
  title: 'Risk-based guardrails',
  description:
    'Guardrails triggered by your plan’s probability of success — in dollars — and why they cut less than withdrawal-rate rules in bad markets.',
  category: 'risk-uncertainty',
  tags: ['guardrails', 'spending', 'monte carlo', 'probability of success', 'sequence risk', 'flexibility'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-08',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://www.kitces.com/blog/probability-of-success-driven-guardrails-advantages-monte-carlo-simulations-analysis-communication/',
    'https://www.kitces.com/blog/monte-carlo-guardrails-probability-of-adjustment-success-client-communication-dynamic-retirement-spending/',
    'https://www.kitces.com/blog/renaming-the-outcomes-of-a-monte-carlo-retirement-projection/',
    'https://www.onefpa.org/journal/Pages/Decision-Rules-and-Portfolio-Management-for-Retirees.aspx',
  ],
  relatedArticles: [
    'dynamic-spending-guardrails',
    'understanding-monte-carlo-success-rate',
    'sequence-of-returns-risk',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/monte-carlo', '/plan/:planId/results'],
  currentYearSensitive: false,
  priority: 'P1',
  featured: false,
  blocks: [
    {
      type: 'prose',
      md: 'Withdrawal-rate guardrails (Guyton–Klinger style) adjust spending when your current withdrawal rate drifts too far from where it started. Risk-based guardrails ask a different question: **has the plan’s probability of success actually left the band I’m comfortable with?** Spending changes only when the answer is yes — and the trigger is expressed in dollars, so you know in advance exactly what portfolio balance calls for a change.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        '**Triggers on plan odds, not a ratio**: A withdrawal rate can look alarming while the plan is still overwhelmingly likely to work — especially late in retirement, when a shorter horizon safely supports a higher rate.',
        '**Dollar-denominated**: The rule reads like an instruction, not a formula: "if the portfolio falls below $X, trim spending; above $Z, a raise is safe."',
        '**Usually cuts less in crashes**: Published practitioner research replaying 2007 retirees found withdrawal-rate rules forced cuts an order of magnitude deeper than probability-based triggers, because the rate rule keeps cutting while the ratio stays elevated even when the odds have stabilized.',
      ],
    },
    { type: 'heading', text: 'How the thresholds are found' },
    {
      type: 'prose',
      md: 'You pick a target success band — say 70–95%. RetireGolden then re-runs your plan’s Monte Carlo simulation at progressively lower (and higher) starting balances, on the same seeded market paths each time, and searches for the balance where the probability of success crosses each edge of the band.\n\nBelow the lower threshold, the flexible slice of spending (everything above your required floor) is trimmed in steps; above the upper threshold it is restored, and can rise into ideal/excess layers if you allow raises. The required floor is never cut. The solver also sizes the adjustment: the dollars per month of spending change that would bring the plan back to the middle of your band.',
    },
    { type: 'heading', text: 'Why "78% success" was the wrong headline anyway' },
    {
      type: 'prose',
      md: 'A single probability-of-success number reads like a grade, and it hides what actually matters: **what happens in the failing paths**. A plan with flexible spending rarely "fails" outright — it adjusts. The more useful questions are how likely an adjustment is, how big it tends to be, and how long it lasts. RetireGolden’s Monte Carlo page reports exactly that for guardrail plans: the share of paths that ever needed a cut, the median and 90th-percentile depth of the deepest cut, the typical years spent below target, and the probability the plan ends with a surplus (or clears your bequest target).',
    },
    {
      type: 'table',
      columns: ['Question', 'Old answer', 'Adjustment-focused answer'],
      rows: [
        ['Will my plan work?', '"78% success"', 'P(any spending cut), and its typical size and duration'],
        ['What do I do in a crash?', 'Re-run the plan and guess', 'A pre-agreed dollar threshold and a pre-sized cut'],
        ['What if things go well?', 'Nothing changes', 'A dollar threshold above which a raise is safe'],
        ['What is left at the end?', 'Implied by the success %', 'P(surplus) and P(estate clears the bequest target)'],
      ],
    },
    { type: 'heading', text: 'A worked example' },
    {
      type: 'scenario',
      name: 'The Okafor household',
      assumptions: [
        { label: 'Starting portfolio', value: '$1,200,000' },
        { label: 'Target success band', value: '70–95%' },
        { label: 'Solved cut threshold', value: '$780,000 (65% of the starting portfolio, today’s dollars)' },
        { label: 'Solved raise threshold', value: '$1,560,000 (130%)' },
        {
          label: 'A 2008-scale drawdown arrives',
          value: 'The portfolio falls to $850,000. A withdrawal-rate rule would already be cutting — the rate is ~40% above where it started — but the plan’s success probability is still inside the band, so risk-based guardrails hold.',
        },
        {
          label: 'The drawdown deepens',
          value: 'Below $780,000 the odds genuinely leave the band; flexible spending is trimmed in 10% steps until markets recover.',
        },
      ],
      summary:
        'Both rules protect the plan. The difference is how often they interrupt your lifestyle to do it: the risk-based trigger tolerates drawdowns the plan can genuinely afford.',
    },
    { type: 'heading', text: 'Honest boundaries' },
    {
      type: 'list',
      items: [
        '**Thresholds are solved for today’s conditions**: They are computed from your current plan, horizon, and market model. Re-solve after meaningful changes (spending, accounts, retirement date) — RetireGolden stores them with your plan and shows when they exist.',
        '**A model, not a promise**: The probability of success is itself a Monte Carlo estimate under an assumed market model. The dollar thresholds inherit those assumptions.',
        '**Inside the simulation, thresholds stay fixed in real terms**: A full re-solve every projected year would be another layer of modeling; RetireGolden applies your solved thresholds (inflation-adjusted) across the horizon — a documented simplification.',
        '**Flexibility has to be real**: The rule only helps if the flexible slice of your budget is genuinely cuttable. Set your required floor honestly.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'On **Spending**, choose *Risk-based guardrails (success band)* as the spending policy, set your band, and press *Solve dollar thresholds*. **Results** shows the thresholds in dollars and marks the years the rule acted. **Monte Carlo** reports the adjustment outlook — probability, size, and duration of cuts, plus the chance of ending with a surplus — alongside the classic success rate.',
    },
  ],
}
