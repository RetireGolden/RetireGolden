/**
 * "How the Optimize tab thinks about Roth conversions" - a Using RetireGolden P0 article.
 */

import type { ArticleBlock } from '../learningRegistry'

export const blocks: ArticleBlock[] = [
  {
    type: 'prose',
    md: 'The Optimize tab searches for a multi-year Roth conversion schedule, then compares candidate schedules on the exact RetireGolden ledger. The default objective is after-tax estate, but the **Optimize for** selector can rank the same evaluated candidates by other goals.',
  },
  { type: 'heading', text: 'Quick takeaways' },
  {
    type: 'list',
    items: [
      'Optimize starts from a no-conversion baseline and searches every plan year at once with a simplified math model, then trims the raw candidate schedule to what your full year-by-year projection can actually execute.',
      'Objective modes change what "better" means after candidates have been evaluated; they do not bypass that projection.',
      'A proposed schedule should still be checked in Results and Monte Carlo before you treat it as a good idea.',
    ],
  },
  { type: 'heading', text: 'The basic idea' },
  {
    type: 'prose',
    md: 'Roth conversions have timing effects. A conversion raises income and tax now, but can lower future traditional balances, RMDs, survivor-year pressure, and taxes owed by heirs. Optimize searches years together because the best year for one conversion depends on the conversions before and after it.\n\nAfter candidates are evaluated, the selected objective policy decides how to rank them. The default maximizes after-tax estate. Other modes can favor money lasting longer, lifetime tax savings while preserving an estate floor, survivor-year liquidity, or bridge-year resilience.',
  },
  {
    type: 'figure',
    image: { src: '/learn/images/optimizer-thinks-roth-conversions.webp' },
    caption:
      'Optimize searches a full conversion schedule, then measures the candidate against the exact RetireGolden ledger.',
    alt: 'A conversion scheduler machine places bars across a timeline, then sends the proposed schedule through a detailed ledger check before reaching an after-tax estate comparison.',
  },
  {
    type: 'table',
    caption: 'What happens when Optimize runs.',
    columns: ['Stage', 'What RetireGolden does', 'Why it matters'],
    rows: [
      ['Baseline probe', 'Runs the plan with conversions stripped out to capture spending, income, RMDs, and tax context', 'Gives the solver a clean starting point'],
      ['Search', 'Uses a linearized model to test conversion amounts across years', 'Makes a multi-year search fast enough for the browser'],
      ['Exact cleanup', 'Runs the raw schedule through the projection ledger, trims conversions the ledger cannot execute, and re-runs the cleaned schedule', 'Keeps the schedule applyable and tied to the same engine used by Results'],
      ['Objective ranking', 'Ranks the full-projection evaluations under the selected objective policy', 'Lets the same candidates answer different planning questions without a second ranking system'],
      ['Risk check', 'Runs a Monte Carlo success estimate for the proposed schedule', 'Shows whether the schedule appears to strain the plan under market variation'],
    ],
  },
  { type: 'heading', text: 'A worked example' },
  {
    type: 'scenario',
    name: 'The Ortega household',
    assumptions: [
      { label: 'Early retirement window', value: 'Six low-income years before Social Security and RMDs' },
      { label: 'Later pressure', value: '$850,000 traditional balance could create large future RMDs' },
      { label: 'Optimizer result', value: '$35,000 conversions for several early years, then little or none later' },
    ],
    summary:
      'The optimizer may accept higher tax on each $35,000 early conversion if it lowers later RMD pressure and improves after-tax estate. The value comes from the whole timeline, not one year.',
  },
  { type: 'heading', text: 'Why it matters in RetireGolden' },
  {
    type: 'prose',
    md: 'The Optimize tab shows after-tax estate delta, lifetime tax delta, success rate, and proposed conversions by year. When you choose a non-default objective, the page calls out that estate and tax deltas are context rather than the ranking metric. If the raw solver request is larger than the projection can execute, the chart shows the cleaned schedule. "Apply optimized schedule" keeps the cleaned schedule labeled as optimizer output. "Accept as manual" copies the same cleaned amounts into an editable manual schedule under Strategy.',
  },
  { type: 'heading', text: 'Common mistakes' },
  {
    type: 'list',
    items: [
      'Thinking the optimizer minimizes lifetime tax. It may raise taxes while improving after-tax estate.',
      'Switching objectives without reading the objective hint; a survivor-liquidity winner may not also be the largest-estate winner.',
      'Applying a schedule without noticing whether the projection cleaned or rejected part of the raw solver request.',
      'Ignoring MAGI, IRMAA, ACA, and cash-flow effects in Results.',
      'Assuming an infeasible result means Optimize is broken; often the plan has a spending shortfall before any conversion strategy matters.',
      'Forgetting to test the heir tax rate assumption, which changes how valuable leftover traditional dollars appear.',
    ],
  },
  { type: 'heading', text: 'Where to use this in the app' },
  {
    type: 'prose',
    md: 'Use **Optimize** after the base plan works in **Results**. Then inspect the proposed years, check any raw-versus-cleaned differences, run **Monte Carlo**, and only then decide whether to apply or copy the schedule into **Strategy**.',
  },
]
