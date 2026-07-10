/**
 * Spending-headroom detector (sustainable-spending plan, Step 6).
 *
 * Two-phase per the detector contract: `screen()` is cheap and pure — it only
 * reads the baseline projection (never depleting + a large ending estate above
 * the bequest target ⇒ the plan is leaving lifestyle on the table) and offers
 * a ROUGH estimate. `evaluate()` runs the exact-ledger sustainable-spending
 * solver under the same fixed budget the "How much can I spend?" page uses,
 * so the card and that surface report the same solved level.
 */

import type { Detector } from '../types'
import {
  createDecisionContext,
  solveMaxSustainableSpending,
  SPENDING_SOLVER_UI_BUDGET,
} from '../../decisions'
import { combineTaxCalculators, createFederalTaxCalculator } from '../../tax/federalTax'
import { createStateTaxCalculator } from '../../tax/stateTax'

/** Screen only when the excess estate could fund a meaningful lifestyle bump. */
const MIN_EXCESS_ESTATE_TODAY_DOLLARS = 250_000
const MIN_ROUGH_HEADROOM_PER_YEAR = 2_000

export const spendingHeadroom: Detector = {
  id: 'spending-headroom',
  category: 'sequence-risk',
  screen(ctx) {
    const summary = ctx.projection.summary
    if (summary.depletionYear !== null) return null
    // Amortized spending (ABW) already spends the portfolio down by design; a
    // "raise your fixed baseline" headroom card (and the base-spending solver
    // behind it) doesn't apply — the solver refuses ABW plans with a diagnostic.
    if (ctx.plan.expenses.spendingPolicy?.mode === 'abw') return null

    const endYear = ctx.projection.result.endYear
    const yearsRemaining = Math.max(1, endYear - ctx.projection.startYear)
    const bequestTarget = ctx.plan.expenses.bequestTargetDollars ?? 0
    const endingEstateToday = ctx.projection.deflate(endYear, summary.endingAfterTaxEstate)
    const excessEstateToday = endingEstateToday - bequestTarget
    if (excessEstateToday < MIN_EXCESS_ESTATE_TODAY_DOLLARS) return null

    // Rough (pre-tax, straight-line) reading of the excess: what spreading it
    // evenly over the remaining years would add to annual spending. The exact
    // answer needs the solver — taxes, cliffs, and sequencing always shrink it.
    const roughHeadroomPerYear = excessEstateToday / yearsRemaining
    if (roughHeadroomPerYear < MIN_ROUGH_HEADROOM_PER_YEAR) return null

    const baseAnnual = ctx.plan.expenses.baseAnnual
    return {
      id: 'spending-headroom',
      category: 'sequence-risk',
      title: 'Your plan may support more spending',
      rationale: `Your plan is projected to end with roughly $${Math.round(endingEstateToday).toLocaleString()} of after-tax estate in today's dollars${bequestTarget > 0 ? ` — well above your $${Math.round(bequestTarget).toLocaleString()} bequest target` : ' with no bequest target set'}. Previewing the max-sustainable spending level shows how much lifestyle that margin could fund.`,
      impact: {
        qualitative: `≈ $${Math.round(roughHeadroomPerYear).toLocaleString()}/yr of rough headroom before taxes; preview for the precise answer.`,
      },
      exact: false,
      confidence: 'medium',
      learnSlug: 'building-a-retirement-spending-budget',
      plannerRoute: 'spending-solver',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Spend closer to plan capacity',
        // Conservative placeholder — evaluate() replaces it with the solved level.
        patch: { expenses: { baseAnnual: Math.round(baseAnnual + roughHeadroomPerYear / 2) } },
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('Spending headroom not eligible')

    const taxCalculator = combineTaxCalculators(
      createFederalTaxCalculator(),
      createStateTaxCalculator({
        overridePct: ctx.plan.assumptions.stateEffectiveTaxPct,
        localPct: ctx.plan.assumptions.localIncomeTaxPct,
      }),
    )
    const decisionCtx = createDecisionContext(
      ctx.plan,
      { startYear: ctx.projection.startYear, taxCalculator },
      { result: ctx.projection.result, summary: ctx.projection.summary },
    )
    const solved = solveMaxSustainableSpending(decisionCtx, {
      maxSimulations: SPENDING_SOLVER_UI_BUDGET,
      estateFloorTodayDollars: ctx.plan.expenses.bequestTargetDollars ?? 0,
    })
    const maxBaseAnnual = solved.maxBaseAnnual
    const slack = solved.spendingSlackDollars ?? 0
    if (maxBaseAnnual === null || slack < 1_000) {
      throw new Error(
        'The spending solver found no meaningful headroom once taxes, healthcare cliffs, and sequencing were priced in.',
      )
    }
    return {
      action: {
        kind: 'preview-scenario',
        scenarioName: `Spend $${Math.round(maxBaseAnnual).toLocaleString()}/yr (max sustainable)`,
        patch: { expenses: { baseAnnual: maxBaseAnnual } },
      },
      impact: {
        qualitative: `Exact ledger sustains about $${Math.round(maxBaseAnnual).toLocaleString()}/yr of baseline spending — $${Math.round(slack).toLocaleString()}/yr above your current level (today's dollars).`,
      },
    }
  },
}
