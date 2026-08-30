import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'A pension fund never describes itself with a success percentage. It states a **funded ratio**: the value of what it owns against the present value of what it has promised to pay. Wade Pfau and the safety-first school apply the same lens to a household: treat your essential spending as the pension you have promised *yourself*, value it honestly, and ask how much of it is already covered by income that arrives no matter what markets do.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'The funded ratio compares the present value of your guaranteed real income against the present value of the spending you treat as essential.',
      'It is discounted on the Treasury real-yield curve, because that is what a guaranteed future dollar actually costs today.',
      'It answers a different question than a Monte Carlo success rate, so the two are worth reading side by side.',
    ],
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
    md: 'Discounting essential spending at an assumed portfolio return (say 6%) quietly assumes the portfolio delivers, which is precisely what cannot be assumed about spending you *must* fund. The defensible question is: **what would it cost today to guarantee this dollar?** That price is set by the Treasury real-yield curve, because a TIPS of matching maturity is the instrument that actually delivers a guaranteed real dollar on that date. Higher real yields make the floor cheaper to defease; lower ones make it dearer. Your funded ratio therefore moves with the bond market even when your spending doesn\'t, exactly like a real pension\'s.',
  },
  { type: 'heading', text: 'Reading your number' },
  {
    type: 'table',
    columns: ['Funded ratio', 'What it says', 'What households commonly weigh next'],
    rows: [
      ['≥ 100%', 'The essential floor is fully covered by guaranteed income', 'How much of the remainder to hold for growth or legacy'],
      ['80–100%', 'Most of the floor is guaranteed; the gap rides on the portfolio', 'Whether to lock in part of the gap with a ladder, a delayed claim, or an annuity'],
      ['< 80%', 'A large share of essentials depends on market outcomes', 'The available levers: claim timing, the size of the floor, or dedicating assets to it'],
    ],
  },
  {
    type: 'prose',
    md: 'RetireGolden computes both sides from your own projection. That is the same yearly ledger that already knows your Social Security (after any trust-fund haircut you assume), pensions, annuities, TIPS ladders, survivor years, healthcare, and debt. It deflates those flows to today\'s dollars and discounts them on the embedded TIPS curve. The Results page shows the ratio, both present values, and the unfunded gap; the Insights page raises a card when the floor is materially underfunded.',
  },
  { type: 'heading', text: 'Funded ratio vs. Monte Carlo success' },
  {
    type: 'prose',
    md: 'The two lenses answer different questions and disagree in useful ways. Monte Carlo asks *"how often does the whole plan work across simulated markets?"*, and it rewards expected growth. The funded ratio asks *"how much of the essential part is guaranteed regardless of markets?"*, and it ignores expected growth on purpose. A plan can show 95% success and a 60% funded ratio: it will probably work, **and** its essentials lean heavily on that "probably". Neither number is the verdict; together they tell you whether risk is being taken with money that can afford it.',
  },
  {
    type: 'callout',
    tone: 'note',
    md: 'The ratio is only as meaningful as your floor definition. If you have not separated required spending from lifestyle on the Spending page, the "floor" is your entire budget and the ratio will read pessimistically low.',
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Treating the whole budget as the floor, which makes almost any plan look underfunded.',
      'Reading a ratio below 100% as a failing grade. It is a statement about how much of the floor is guaranteed, not about whether the plan works.',
      'Comparing ratios quoted on different discount rates. A portfolio-return discount rate produces a flattering number that a TIPS rate will not.',
      'Forgetting that the ratio moves when real yields move, even in a year when nothing about your plan changed.',
    ],
  },
  { type: 'heading', text: 'Where to use this in the app' },
  {
    type: 'prose',
    md: 'Set the required portion of your budget on **Spending**, then read the ratio, both present values, and the unfunded gap on **Results**. **Income floor** shows what is already guaranteed, and **Insights** raises a card when the floor is materially underfunded. Compare the number against the success rate on **Monte Carlo** rather than instead of it.',
  },
]
