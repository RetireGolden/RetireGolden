import type { LearningArticle } from '../learningRegistry'

export const buildingRetirementSpendingBudgetArticle: LearningArticle = {
  slug: 'building-a-retirement-spending-budget',
  title: 'Building a retirement spending budget',
  description: 'What belongs in baseline spending, phases, and one-time goals.',
  category: 'using-retiregolden',
  tags: ['spending', 'budget', 'retirement phases', 'one-time goals', 'retirement smile'],
  audience: 'beginner',
  status: 'ready',
  lastReviewed: '2026-07-02',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.bls.gov/cex/',
    'https://www.bls.gov/cex/tables.htm',
    'https://fred.stlouisfed.org/series/CXUTOTALEXPLB0406M',
    'https://fred.stlouisfed.org/series/CXUTOTALEXPLB0407M',
    'https://www.financialplanningassociation.org/sites/default/files/2020-09/MAY14%20JFP%20Blanchett_0.pdf',
  ],
  relatedArticles: [
    'dynamic-spending-guardrails',
    'three-big-questions-spending-time-risk',
    'todays-dollars-vs-future-dollars',
    'long-term-care-costs-and-insurance',
  ],
  relatedPlannerRoutes: ['/plan/:planId/spending', '/plan/:planId/results', '/plan/:planId/scenarios'],
  currentYearSensitive: true,
  priority: 'P1',
  blocks: [
    {
      type: 'prose',
      md: 'A retirement spending budget is not one giant number. It works better when everyday living costs, planned phases, healthcare premiums, insurance premiums, debt service, and one-time goals each sit in the right place.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'Baseline spending should cover recurring lifestyle costs that do not have a separate input.',
        'Phases let you model a higher early-retirement lifestyle or a later slowdown without changing every year by hand.',
        'One-time goals belong outside baseline spending so they do not repeat forever.',
      ],
    },
    { type: 'heading', text: 'The basic idea' },
    {
      type: 'prose',
      md: 'Start with normal annual living costs in today\'s dollars. Then remove anything RetireGolden already models somewhere else: mortgage payments, property tax, homeowner\'s insurance, health-insurance premiums, life or long-term-care insurance premiums, and care events.\n\nThat separation matters because each item follows a different rule. A mortgage may end. Property carrying costs may continue after the loan is gone. Medicare premiums begin at 65. Insurance premiums may be level instead of inflation-adjusted. One-time goals happen once.',
    },
    {
      type: 'table',
      caption: 'Where spending belongs in RetireGolden.',
      columns: ['Cost', 'Where to enter it', 'Why'],
      rows: [
        ['Groceries, utilities, transportation, routine travel', 'Baseline annual spending', 'Repeats each year and inflates with the plan'],
        ['Health-insurance premiums before 65', 'Healthcare', 'Can interact with the ACA premium tax credit'],
        ['Medicare supplements, Advantage, or Part D premiums', 'Healthcare', 'Part B and IRMAA are modeled separately'],
        ['Mortgage principal and interest', 'Debt account', 'Can end or be paid off in a specific year'],
        ['Property tax and homeowner\'s insurance', 'Property account', 'May continue after a mortgage is gone'],
        ['Life or LTC policy premiums', 'Insurance', 'Policy premiums feed the spending chart and policy value test'],
        ['Large trips, car replacement, family gifts', 'One-time goals', 'Should not repeat forever unless you add more goals'],
      ],
    },
    { type: 'heading', text: 'Phases and the retirement smile' },
    {
      type: 'prose',
      md: 'Many retirees do not spend the same inflation-adjusted amount every year. Some spend more in the go-go years on travel and projects, less in the slow-go years, and more again if care needs rise later. Research often calls that pattern the retirement spending smile.\n\nA phase multiplier changes baseline spending from a selected age forward. It is a planning input, not a prediction. Use it to test the lifestyle you expect and the backup version you could accept.',
    },
    {
      type: 'scenario',
      name: 'The Nguyen household',
      assumptions: [
        { label: 'Baseline spending', value: '$90,000 per year in today\'s dollars' },
        { label: 'Slow-go phase', value: 'At age 75, multiplier falls to 0.90' },
        { label: 'Later phase', value: 'At age 85, multiplier falls to 0.80 before any separate care event' },
        { label: 'One-time goal', value: '$25,000 family trip in 2029' },
      ],
      summary:
        'The phase at 75 turns the recurring lifestyle line into $81,000 before inflation. The family trip stays separate, so it appears once instead of becoming part of every future year.',
    },
    { type: 'heading', text: 'What the data can and cannot tell you' },
    {
      type: 'prose',
      md: 'The Bureau of Labor Statistics Consumer Expenditure Survey shows average spending tends to differ by age. In 2024, the 55-64 age group spent about **$84,946** on average, while the 65-and-older group spent about **$61,432**. Those are broad household averages, not a personal target.\n\nUse outside data as a reasonableness check. Your actual budget should start from your housing, location, family support, travel plans, health needs, and taxes.',
    },
    { type: 'heading', text: 'Common mistakes' },
    {
      type: 'list',
      items: [
        'Putting mortgage payments in baseline spending, then also entering the mortgage as a debt.',
        'Forgetting property tax and homeowner\'s insurance after a mortgage payoff.',
        'Treating every dream trip or car replacement as recurring lifestyle spending.',
        'Using a spending-smile phase to hide a long-term-care cost that should be stress-tested separately.',
      ],
    },
    { type: 'heading', text: 'Where to use this in the app' },
    {
      type: 'prose',
      md: 'Use **Spending** for baseline spending, phases, healthcare premiums, and one-time goals. Use **Accounts** for property and debt costs. Use **Insurance** for life, long-term-care, and care-event modeling. Use **Results** to check the spending-by-category chart for double counting.',
    },
  ],
}
