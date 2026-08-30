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
      'SSDI pays your **full PIA** (the benefit you would get at full retirement age) with no early-retirement reduction, even if your disability began years before 62. Because it already pays the full PIA, waiting earns no delayed-retirement credits.',
      'At full retirement age it **converts automatically** to the retirement benefit at the same dollar amount (no jump, no paperwork).',
      'Before FRA, earning over the **Substantial Gainful Activity (SGA)** limit suspends SSDI; this is not the same as the retirement earnings test.',
    ],
  },
  { type: 'heading', text: 'Why SSDI pays the full PIA' },
  {
    type: 'prose',
    md: 'When you claim *retirement* benefits before full retirement age, your benefit is permanently reduced. SSDI is different: a disabled worker receives their full Primary Insurance Amount (PIA) regardless of age at onset. The PIA is computed the same way (your average indexed monthly earnings through the bend-point formula), but the early reduction does not apply. In practice this means someone disabled at 55 receives the same monthly amount they would have gotten by waiting until FRA.',
  },
  {
    type: 'callout',
    tone: 'note',
    md: 'A "disability freeze" excludes low or zero-earning months during the disability period from the AIME average, so time out of the workforce does not drag your PIA down. RetireGolden uses the PIA you enter or derive from earnings and does not recompute the freeze.',
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
    md: 'On the Social Security step, expand **Disability (SSDI)** and enter your disability onset age. The planner pays your full PIA from that age (instead of your retirement claim age), applies the SGA gate before FRA, and continues the same amount through FRA conversion, flowing into the normal tax, IRMAA, and ACA cascade like any other Social Security income.',
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
