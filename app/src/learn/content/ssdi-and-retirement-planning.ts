/**
 * "SSDI and retirement planning" - a Social Security article.
 */

import type { LearningArticle } from '../learningRegistry'

export const ssdiAndRetirementPlanningArticle: LearningArticle = {
  slug: 'ssdi-and-retirement-planning',
  title: 'SSDI and retirement planning',
  description: 'How Social Security disability bridges to retirement at full retirement age.',
  category: 'social-security',
  tags: ['social security', 'ssdi', 'disability', 'full retirement age', 'sga', 'pia'],
  audience: 'intermediate',
  status: 'ready',
  lastReviewed: '2026-06-29',
  reviewCadence: 'annual',
  sourceUrls: [
    'https://www.ssa.gov/benefits/disability/',
    'https://www.ssa.gov/oact/cola/sga.html',
    'https://www.ssa.gov/oact/ProgData/nra.html',
  ],
  relatedArticles: [
    'social-security-claiming-age-basics',
    'pia-aime-and-bend-points',
    'spousal-and-survivor-benefits',
    'earnings-test-before-fra',
  ],
  relatedPlannerRoutes: ['/plan/:planId/social-security'],
  currentYearSensitive: true,
  priority: 'P2',
  blocks: [
    {
      type: 'prose',
      md: 'Social Security Disability Insurance (SSDI) is a separate benefit from retirement, but it matters to a retirement planner for one key reason: **at full retirement age, SSDI converts to the retirement benefit at the same dollar amount.** If you become disabled before your retirement-claim age, SSDI is the bridge that pays you until then.',
    },
    { type: 'heading', text: 'Quick takeaways' },
    {
      type: 'list',
      items: [
        'SSDI pays your **full PIA** — the benefit you would get at full retirement age — with no early-retirement reduction, even if your disability began years before 62.',
        'At full retirement age it **converts automatically** to the retirement benefit at the same dollar amount (no jump, no paperwork).',
        'Before FRA, earning over the **Substantial Gainful Activity (SGA)** limit suspends SSDI; this is not the same as the retirement earnings test.',
        'Because SSDI pays the full PIA, you do **not** earn delayed-retirement credits by "waiting" — the benefit is already being paid.',
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
      md: 'While receiving SSDI before FRA, earning above the Substantial Gainful Activity limit generally stops the benefit. In 2026, SGA is $1,620 per month for non-blind work ($2,700 if statutorily blind). SSA also offers a trial work period and extended Medicare, which RetireGolden does not model — the planner applies a simple annual check: if your wages exceed SGA × 12, SSDI is suspended for that year.',
    },
    { type: 'heading', text: 'Conversion at FRA' },
    {
      type: 'prose',
      md: 'In the month you reach full retirement age, SSDI automatically becomes a retirement benefit. The dollar amount is unchanged — both are the PIA — so there is no discontinuity in your income. From FRA onward, the usual retirement rules apply: no earnings test (it ends at FRA), but also no further delayed credits, because you are already receiving the benefit.',
    },
    { type: 'heading', text: 'How to use this in RetireGolden' },
    {
      type: 'prose',
      md: 'On the Social Security step, expand **Disability (SSDI)** and enter your disability onset age. The planner pays your full PIA from that age (instead of your retirement claim age), applies the SGA gate before FRA, and continues the same amount through FRA conversion — flowing into the normal tax, IRMAA, and ACA cascade like any other Social Security income.',
    },
  ],
}
