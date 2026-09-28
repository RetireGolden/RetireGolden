/**
 * "Social Security taxes vs. benefits" - a Social Security article.
 *
 * It describes the ratio the analysis page's paid-in panel computes
 * (@retiregolden/engine socialSecurity/analysis/oasdiReturn.ts, owner decision
 * R8): the OASDI tax paid so far and the tax the projected work the benefit
 * estimate counts will pay, in today's dollars at each year's rate and base,
 * against the benefits already received and the expected value of the rest,
 * a former spouse's benefit included when it is larger.
 */

import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'A natural question: "Did I get back what I put into Social Security?" The answer is more nuanced than dividing your benefits by your taxes, because Social Security is **insurance**, not an investment. A "what you paid in vs. what you get back" view is still a useful illustration, as long as you know what it does and does not capture.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'You pay the **OASDI** payroll tax on covered earnings up to each year’s **taxable wage base**, at that year’s rate: 6.2% as an employee and 12.4% if self-employed today, less in most earlier years.',
      'The tax is counted over the same career your benefit estimate counts: what you have **paid in so far**, and what the **work your estimate projects** will pay.',
      'Both sides are in today’s dollars: past tax is adjusted for price inflation, with no interest added.',
      'The "get back" side is the benefits you have already received plus the **survival-weighted expected value** of the rest, including a former spouse’s benefit when it is larger than your own.',
      'The ratio is an **individual-level illustration**, not the program’s actuarial return. It leaves out the insurance value of disability and survivor protection, benefits paid to others on your record, and Medicare.',
    ],
  },
  { type: 'heading', text: 'What you paid in' },
  {
    type: 'prose',
    md: 'Each paycheck, 6.2% of your covered wages (up to the annual taxable wage base, $184,500 in 2026) goes to the OASDI part of FICA. Your employer pays another 6.2%; the self-employed pay both halves (12.4%) as SECA. The rate was lower in most years before 1990, 5.4% for employees in 1984, and 4.2% for employees in 2011 and 2012; this view applies each year’s rate and wage base, and restates each year’s tax in today’s dollars with the Consumer Price Index, adding no interest. It **intentionally excludes the 1.45% Medicare HI tax**, because the "get back" side is Social Security, not Medicare.',
  },
  {
    type: 'prose',
    md: 'If your benefit estimate projects future work (the earnings projection on the Social Security step fills the years between your last reported year and the age you stop), the benefit side is priced on those years too. So the tax those years will pay is counted as well, at today’s rate and wage cap, and shown on its own line as **what your projected work will pay**. Comparing a whole career’s benefit with half a career’s tax would overstate the ratio. The employer’s share is shown as context, not added to what you paid.',
  },
  { type: 'heading', text: 'What you get back' },
  {
    type: 'prose',
    md: 'The "get back" figure is the **mortality-weighted expected present value** of your benefits at your chosen claim age, the same method used by the actuarial "Benefits only" view. Each future year’s benefit is multiplied by the probability you survive to receive it and discounted to today’s dollars at a real rate. When a former spouse’s record pays you more than your own (a divorced-spouse benefit while you are unmarried, or a widow(er) benefit), that larger benefit is what you get back, as the plan pays it. If you already collect benefits, the ones you have received count too, at today’s benefit amount. This is the *expected* value, not a guarantee; living longer raises it, dying sooner lowers it.',
  },
  {
    type: 'table',
    caption: 'What each side of the ratio does and does not include.',
    columns: ['Side of the ratio', 'What is counted', 'What is left out'],
    rows: [
      [
        'What you paid in',
        'Your OASDI share at each year’s rate (6.2% today), or the self-employment rate if self-employed, on covered wages up to each year’s wage base: the years you have paid so far, plus the projected work your benefit estimate counts, all in today’s dollars',
        'The 1.45% Medicare HI tax, the employer’s share unless you were self-employed, and any interest',
      ],
      [
        'What you get back',
        'Benefits already received, plus future benefits at your claim age, your own or a former spouse’s when larger, weighted by survival probability and discounted to today’s dollars',
        'Disability and survivor protection you have not drawn, and any benefit paid on your record to someone else, such as a current spouse',
      ],
      [
        'Neither side',
        '',
        'Medicare coverage, the program’s transfers toward lower earners, and whatever the rules look like decades from now',
      ],
    ],
  },
  { type: 'heading', text: 'What the ratio does not capture' },
  {
    type: 'list',
    items: [
      '**Insurance value:** the payroll tax also buys disability and survivor protection you may never draw but that has real expected value.',
      '**Benefits paid to others on your record:** a current spouse or a child can receive benefits on your record, which the individual ratio leaves out.',
      '**Employer share:** if you’re an employee, your employer paid half the OASDI tax, not "your" contribution, but part of the cost of your labor.',
      '**The earnings test:** like the rest of the Benefits-only tab, the expected value counts benefits as paid even in years your wages would hold some back.',
      '**Medicare:** the HI tax funds Medicare, which is excluded from both sides here.',
    ],
  },
  {
    type: 'callout',
    tone: 'note',
    md: 'This is why a low lifetime ratio doesn’t mean Social Security is a "bad deal" for you. The program transfers value toward lower earners, the disabled, survivors, and longer-lived spouses in ways a single ratio can’t show.',
  },
  { type: 'heading', text: 'Where to use this in the app' },
  {
    type: 'prose',
    md: 'On **Social Security analysis** (the Benefits-only tab), expand "What you paid in vs. what you get back." It uses the earnings history you entered on the Social Security step, so enter an earnings record (or import your mySSA statement) to see it. A self-employed toggle applies each year’s self-employment rate. If your history cannot give a benefit estimate, the panel still shows what you paid in so far and says why the benefit side is missing.',
  },
]
