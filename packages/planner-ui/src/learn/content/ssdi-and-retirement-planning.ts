/**
 * "SSDI and retirement planning" - a Social Security article.
 */

import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'Social Security Disability Insurance (SSDI) is a separate benefit from retirement, but it matters to a retirement planner for one key reason: **at full retirement age, SSDI converts to the retirement benefit at the same dollar amount.** If you become disabled before your retirement-claim age, SSDI is the bridge that pays you until then.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'SSDI pays your **full PIA** with no early-retirement reduction, even if disability began years before 62. Because SSDI already pays the full PIA, waiting earns no delayed-retirement credits.',
      'SSDI pays nothing for the first **five full months** you are disabled. The first payment is for the sixth month after the month your disability began.',
      'At full retirement age it **converts automatically** to the retirement benefit at the same dollar amount (no jump, no paperwork).',
      'Before FRA, earning over the **Substantial Gainful Activity (SGA)** limit suspends SSDI; this is not the same as the retirement earnings test.',
    ],
  },
  { type: 'heading', text: 'Why SSDI pays the full PIA' },
  {
    type: 'prose',
    md: 'When you claim *retirement* benefits before full retirement age, your benefit is permanently reduced. SSDI is different: a disabled worker receives their full Primary Insurance Amount (PIA) regardless of age at onset; the early reduction does not apply. For an actual SSA disability award, PIA can be computed with a different indexing year and computation-year count than an ordinary later retirement claim, and a **disability freeze** can exclude qualifying years from the average (see [20 CFR 404.211](https://www.ssa.gov/OP_Home/cfr20/404/404-0211.htm)). RetireGolden does not adjudicate disability or insured status: the **month and year** you enter only place the SSDI payment path (full PIA from the first month after the waiting period through FRA conversion). If you supply PIA directly, use the figure from your SSA award, not a net monthly payment treated as PIA. If you derive PIA from earnings here, the helper still uses ordinary retirement indexing and year selection, so that estimate may differ from a true disability computation.',
  },
  {
    type: 'callout',
    tone: 'note',
    md: 'Under [20 CFR 404.211](https://www.ssa.gov/OP_Home/cfr20/404/404-0211.htm), a disability freeze generally excludes computation-base years wholly within an established period of disability, and elapsed years wholly or partly within it, unless counting those years would yield a higher PIA. RetireGolden uses the PIA you enter or derive from earnings and does not recompute that freeze.',
  },
  { type: 'heading', text: 'The five-month waiting period' },
  {
    type: 'prose',
    md: 'Social Security pays disability benefits only after you have been disabled for five full calendar months ([42 U.S.C. 423(c)(2)](https://uscode.house.gov/view.xhtml?req=granuleid:USC-prelim-title42-section423&num=0&edition=prelim)). A month counts only if you were disabled for all of it, so if your disability began on March 10, the waiting period is April through August and the first payment is for September. If it began on the 1st of a month, that month counts, and the first payment is one month sooner. There is no waiting period if you were entitled to disability benefits within the last five years, or for ALS; RetireGolden always applies it. If the first payment would fall in or after the month you reach full retirement age, there is no disability benefit, and your retirement claim applies instead.',
  },
  { type: 'heading', text: 'The SGA gate (before FRA)' },
  {
    type: 'prose',
    md: 'While receiving SSDI before FRA, earning above the Substantial Gainful Activity limit generally stops the benefit. In 2026, SGA is $1,690 per month for non-blind work ($2,830 if statutorily blind). SSA also offers a trial work period and extended Medicare, which RetireGolden does not model. The planner applies a simple annual check: if your wages exceed SGA × 12, SSDI is suspended for that year.',
  },
  {
    type: 'table',
    caption: 'SSDI and an early retirement claim, side by side.',
    columns: ['', 'SSDI before FRA', 'Retirement benefit claimed early'],
    rows: [
      ['Monthly amount', 'Your full PIA, with no age reduction', 'PIA reduced permanently for every month before FRA'],
      ['Earnings limit', 'Wages above the SGA limit generally stop the benefit outright', 'The earnings test withholds benefits, then credits them back at FRA'],
      ['Delayed credits', 'None. You are already receiving the full PIA', 'Available only if you have not claimed yet'],
      ['At full retirement age', 'Converts automatically to the retirement benefit at the same amount', 'Stays reduced, except that any months the earnings test withheld are credited back and the benefit is recomputed'],
    ],
  },
  { type: 'heading', text: 'Conversion at FRA' },
  {
    type: 'prose',
    md: 'In the month you reach full retirement age, SSDI automatically becomes a retirement benefit. The dollar amount is unchanged (both are the PIA), so there is no discontinuity in your income. From FRA onward, the usual retirement rules apply: no earnings test (it ends at FRA), but also no further delayed credits, because you are already receiving the benefit.',
  },
  { type: 'heading', text: 'How to use this in RetireGolden' },
  {
    type: 'prose',
    md: 'On the Social Security step, expand **Disability (SSDI)** and enter the month and year your disability began as a planning assumption (not an SSA eligibility determination). The planner pays your full PIA from the sixth month after that month (instead of your retirement claim age), applies the SGA gate before FRA, and continues the same amount through FRA conversion, flowing into the normal tax, IRMAA, and ACA calculations like any other Social Security income. If you are not sure of the month, the plan assumes January 1, so the first payment is for June of that year: the earliest Social Security allows, and so the largest amount for that year.',
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Entering an SSDI benefit as an early retirement claim, which applies a reduction that SSDI does not have.',
      'Expecting delayed-retirement credits to accrue while SSDI is being paid.',
      'Confusing the SGA limit with the retirement earnings test. SGA can stop the benefit; the earnings test only withholds and later credits it back.',
      'Counting on the trial work period or extended Medicare in a projection. RetireGolden does not model either.',
    ],
  },
]
