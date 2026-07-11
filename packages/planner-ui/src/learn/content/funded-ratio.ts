import type { LearningArticle } from '../learningRegistry'

export const fundedRatioArticle: LearningArticle = {
  slug: 'funded-ratio',
  title: 'The funded ratio: pension accounting for your household',
  description:
    'What share of your essential retirement spending is already guaranteed? Discounting the floor on the TIPS curve answers it the way a pension actuary would.',
  category: 'risk-uncertainty',
  tags: ['funded ratio', 'safety-first', 'income floor', 'present value', 'tips', 'essential spending'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-07-08',
  reviewCadence: 'stable',
  sourceUrls: [
    'https://retirementresearcher.com/what-is-a-funded-ratio/',
    'https://www.financialplanningassociation.org/article/journal/JAN14-safety-first-retirement-planning',
    'https://home.treasury.gov/resource-center/data-chart-center/interest-rates',
  ],
  relatedArticles: ['tips-ladders', 'social-security-bridge', 'understanding-monte-carlo-success-rate', 'building-a-retirement-spending-budget'],
  relatedPlannerRoutes: ['/plan/:planId/results', '/plan/:planId/income-floor', '/plan/:planId/spending'],
  currentYearSensitive: false,
  priority: 'P2',
  featured: false,
  blocks: [
    {
      type: 'prose',
      md: 'A pension fund never describes itself with a success percentage. It states a **funded ratio**: the value of what it owns against the present value of what it has promised to pay. Wade Pfau and the safety-first school apply the same lens to a household: treat your essential spending as the pension you have promised *yourself*, value it honestly, and ask how much of it is already covered by income that arrives no matter what markets do.',
    },
    {
      type: 'formula',
      expression: 'funded ratio = PV(guaranteed real income) ÷ PV(essential spending)',
      where: [
        { symbol: 'PV', meaning: 'present value, discounting each future real dollar at the Treasury real-yield curve' },
        { symbol: 'guaranteed income', meaning: 'Social Security, pensions, annuities, and TIPS-ladder payouts' },
        { symbol: 'essential spending', meaning: 'the required floor: must-fund lifestyle plus healthcare, debt, property costs' },
      ],
      basis: 'today',
      note: 'Discounting at TIPS yields is the honest rate: it is what a guaranteed real dollar actually costs today.',
    },
    { type: 'heading', text: 'Why the TIPS curve is the right discount rate' },
    {
      type: 'prose',
      md: 'Discounting essential spending at an assumed portfolio return (say 6%) quietly assumes the portfolio delivers — which is precisely what cannot be assumed about spending you *must* fund. The defensible question is: **what would it cost today to guarantee this dollar?** That price is set by the Treasury real-yield curve, because a TIPS of matching maturity is the instrument that actually delivers a guaranteed real dollar on that date. Higher real yields make the floor cheaper to defease; lower ones make it dearer. Your funded ratio therefore moves with the bond market even when your spending doesn\'t — exactly like a real pension\'s.',
    },
    { type: 'heading', text: 'Reading your number' },
    {
      type: 'table',
      columns: ['Funded ratio', 'What it says', 'Typical response'],
      rows: [
        ['≥ 100%', 'The essential floor is fully defeased by guaranteed income', 'Invest the rest for growth/legacy with a clear conscience'],
        ['80–100%', 'Most of the floor is guaranteed; the gap rides on the portfolio', 'Decide deliberately how much of the gap to lock in (ladder, delayed SS, annuity)'],
        ['< 80%', 'A large share of essentials depends on market outcomes', 'Look hard at the levers: delay Social Security, trim the floor, or dedicate assets'],
      ],
    },
    {
      type: 'prose',
      md: 'RetireGolden computes both sides from your own projection — the same yearly ledger that already knows your Social Security (after any trust-fund haircut you assume), pensions, annuities, TIPS ladders, survivor years, healthcare, and debt — deflates them to today\'s dollars, and discounts on the embedded TIPS curve. The Results page shows the ratio, both present values, and the unfunded gap; the Insights page raises a card when the floor is materially underfunded.',
    },
    { type: 'heading', text: 'Funded ratio vs. Monte Carlo success' },
    {
      type: 'prose',
      md: 'The two lenses answer different questions and disagree in useful ways. Monte Carlo asks *"how often does the whole plan work across simulated markets?"* — it rewards expected growth. The funded ratio asks *"how much of the essential part is guaranteed regardless of markets?"* — it ignores expected growth on purpose. A plan can show 95% success and a 60% funded ratio: it will probably work, **and** its essentials lean heavily on that "probably". Neither number is the verdict; together they tell you whether risk is being taken with money that can afford it.',
    },
    {
      type: 'callout',
      tone: 'note',
      md: 'The ratio is only as meaningful as your floor definition. If you have not separated required spending from lifestyle on the Spending page, the "floor" is your entire budget and the ratio will read pessimistically low.',
    },
  ],
}
