import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'Most people claim Social Security early, and researchers estimate the habit costs retirees **trillions of dollars of lifetime benefits** in aggregate. The usual reason is immediate and human: *"I retired, the paycheck stopped, and I need income now."* The **bridge** is the standard fix. Instead of claiming at 62, you pay yourself the benefit you would have received (the same monthly amount, inflation-adjusted) out of a dedicated pot of savings, until your delayed claim starts at 67 or 70.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'A bridge is a pot of savings that pays you the benefit you gave up, so delaying the claim does not mean living on less.',
      'Every year of delay raises the benefit permanently, and delaying the higher earner in a couple also raises the survivor benefit.',
      'The honest comparison is bridge plus a delayed claim against claiming early and keeping the savings invested, run through the same plan.',
    ],
  },
  { type: 'heading', text: 'Why delaying is worth bridging' },
  {
    type: 'list',
    items: [
      '**The delay "buys" an annuity at government prices**: every year of delay permanently raises the benefit (roughly 7–8% per year, plus COLAs on the bigger base). No insurer sells inflation-indexed lifetime income that cheaply.',
      '**It is longevity insurance**: the bigger check lasts exactly as long as you do. If you live to 95, the age-70 claim pays enormously more; if you die early, the bridge money you did not spend stays in your estate.',
      '**It protects the survivor**: for couples, the higher earner\'s delayed benefit becomes the survivor benefit. Delaying is often worth more to the widow(er) than to the worker.',
    ],
  },
  { type: 'heading', text: 'What the bridge looks like' },
  {
    type: 'scenario',
    name: 'Maria bridges to 70',
    assumptions: [
      { label: 'PIA (benefit at full retirement age 67)', value: '$2,400/mo' },
      { label: 'Age-62 benefit (70% of PIA)', value: '$1,680/mo → $20,160/yr' },
      { label: 'Retires at 62, claims at 70', value: '8 gap years' },
      { label: 'Bridge', value: 'Pays herself $20,160/yr (inflation-adjusted) from 62 to 69' },
      { label: 'Age-70 benefit (124% of PIA)', value: '$2,976/mo, 77% larger than claiming at 62, for life' },
    ],
    summary:
      'Maria\'s lifestyle never dips in the gap years (the bridge replaces exactly what claiming early would have paid), and from 70 on she holds the largest inflation-indexed life annuity she could get.',
  },
  {
    type: 'prose',
    md: 'The bridge can be a cash bucket, but the natural instrument is a **[TIPS ladder](/learn/tips-ladders)** maturing across the gap years: the income is then guaranteed in real terms, exactly matching the inflation-indexed benefit it replaces. RetireGolden\'s Social Security Optimizer sizes the bridge from your own numbers (the forgone age-62 benefit, your retirement year, and your chosen claim age), quotes the ladder cost on the current real-yield curve, and can add it to your plan as a funded artifact you can see, stress-test, and compare.',
  },
  { type: 'heading', text: 'Bridge vs. claim early: how to compare honestly' },
  {
    type: 'prose',
    md: 'The right comparison is not "delay vs. claim early" in isolation. It is **bridge + delayed claim vs. claim early and keep the savings invested**, run through your full plan on the same market paths. The claim-early path keeps more money compounding but locks in the smaller check forever; the bridge path spends savings now to buy a much larger guaranteed floor later. RetireGolden runs both through the same ledger and Monte Carlo so the success-rate and estate differences are priced, not asserted. Break-even ages are a useful sanity check, but the plan-level comparison is the decision-grade one.',
  },
  {
    type: 'callout',
    tone: 'warn',
    md: 'A bridge only makes sense with money to bridge from: if funding it would leave you without a liquid reserve, or push you into selling assets at depressed prices, the early claim can genuinely be the better plan. Health and family longevity matter too. The delayed claim is insurance against a *long* life, and insurance you may reasonably decline.',
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Comparing claim ages on benefits alone. The bridge withdrawals change taxes, IRMAA, and ACA credits in the gap years too.',
      'Sizing the bridge off the benefit you would claim later instead of the benefit you are giving up now.',
      'Funding a bridge that leaves no liquid reserve for a bad market or a care shock.',
      'Reading a break-even age as the answer. It ignores taxes, survivor benefits, and everything else the plan is carrying.',
    ],
  },
  { type: 'heading', text: 'Where to use this in the app' },
  {
    type: 'prose',
    md: 'Set claim ages on the **Social Security** step, then open **Social Security analysis** to rank claim combinations on your whole plan and size a bridge from your own numbers. **Income floor** shows what the bridge guarantees, and **Monte Carlo** prices the claim-early alternative on the same market simulations.',
  },
]
