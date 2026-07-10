/**
 * State-relocation detector (extended by the relocation-compare plan —
 * DOCS/enhancements/state-relocation-compare.md, step 3).
 *
 * `screen()` keeps its original cheap conditions: a taxed state, no planned
 * moves. `evaluate()` now quantifies the lifetime tax drag by running the
 * relocation-compare sweep over the modeled zero-income-tax shortlist and
 * previews the top candidate as a scenario. Copy stays neutral — income tax
 * is one relocation factor, so the card says "worth a look", never "move".
 */

import type { Detector } from '../types'
import { stateParamsFor } from '../../params/state'
import {
  compareRelocationCandidates,
  relocationScenarioPatch,
} from '../../projection/relocation'

/** Modeled zero-income-tax candidates the evaluate() sweep prices. */
const ZERO_TAX_SHORTLIST = ['FL', 'TX', 'WA'] as const

export const stateRelocation: Detector = {
  id: 'state-relocation',
  category: 'longevity-insurance-geography',
  screen(ctx) {
    const startYear = ctx.projection.startYear
    const currentState = ctx.plan.household.state

    // If already in a tax-free state and no flat override, it's not applicable
    const params = stateParamsFor(currentState, startYear)
    const currentHasIncomeTax = ctx.plan.assumptions.stateEffectiveTaxPct > 0 || (params ? params.hasIncomeTax : true)

    if (!currentHasIncomeTax) {
      return null
    }

    if (currentState === 'FL') {
      return null
    }

    // Only suggest if they haven't planned any moves yet
    if (ctx.plan.household.stateMoves && ctx.plan.household.stateMoves.length > 0) {
      return null
    }

    return {
      id: 'state-relocation',
      category: 'longevity-insurance-geography',
      title: 'State residence is a tax lever worth a look',
      rationale: `Your plan is based in ${currentState}, which levies an income tax, with no relocation modeled. If a move is ever on the table for other reasons, the state-tax difference is worth quantifying — the Relocation Compare page prices candidate states on your actual plan. Income tax is one factor among many; nothing here says you should move.`,
      impact: { qualitative: 'Preview to quantify the lifetime state-tax drag vs modeled zero-income-tax states on your own plan.' },
      exact: false,
      confidence: 'medium',
      learnSlug: 'state-income-taxes-in-retirement',
      plannerRoute: 'relocation',
      action: {
        kind: 'preview-scenario',
        scenarioName: 'Relocate to a tax-free state',
        // Rough placeholder — evaluate() replaces it with the sweep's top candidate.
        patch: relocationScenarioPatch(ctx.plan, { state: 'FL', moveYear: startYear }, startYear),
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) {
      throw new Error('State relocation not eligible')
    }
    const startYear = ctx.projection.startYear
    try {
      // Deterministic sweep (no Monte Carlo) over the zero-income-tax
      // shortlist, each as a split-year move this July — the same engine the
      // Relocation Compare page runs, so the card and the page can never
      // disagree. Four ledger runs, on par with other detectors' evaluate().
      const comparison = compareRelocationCandidates(
        ctx.plan,
        ZERO_TAX_SHORTLIST.map((state) => ({ state, moveYear: startYear })),
        { startYear },
      )
      const baseline = comparison.rows.find((r) => r.id === 'baseline')
      const candidates = comparison.rows.filter((r) => r.id !== 'baseline' && r.error === null)
      if (!baseline || candidates.length === 0) throw new Error('Relocation sweep produced no valid candidates')
      const best = candidates.reduce((a, b) => (b.lifetimeTaxesAndPenalties < a.lifetimeTaxesAndPenalties ? b : a))

      // Lifetime state-tax drag in today's dollars: deflate the per-year
      // state+local tax delta between staying and the best candidate. This is
      // deliberately qualitative-only — the preview grid's numeric deltas come
      // from the shared exact-ledger evaluator on a different basis (total
      // taxes, nominal), and two numbers on two bases would collide.
      const baseByYear = new Map(baseline.stateTaxByYear.map((l) => [l.year, l.tax]))
      const bestByYear = new Map(best.stateTaxByYear.map((l) => [l.year, l.tax]))
      const years = new Set([...baseByYear.keys(), ...bestByYear.keys()])
      let lifetimeStateTaxDeltaToday = 0
      for (const year of years) {
        lifetimeStateTaxDeltaToday += ctx.projection.deflate(year, (bestByYear.get(year) ?? 0) - (baseByYear.get(year) ?? 0))
      }
      const savings = Math.max(0, -lifetimeStateTaxDeltaToday)

      return {
        action: {
          kind: 'preview-scenario',
          scenarioName: `Relocate to ${best.destinationState} (illustrative)`,
          patch: relocationScenarioPatch(ctx.plan, { state: best.destinationState, moveYear: startYear }, startYear),
        },
        impact: {
          qualitative: `Exact ledger: staying in ${ctx.plan.household.state} costs about $${Math.round(savings).toLocaleString()} of lifetime state+local income tax (today's dollars) vs ${best.destinationState}, the best of ${ZERO_TAX_SHORTLIST.join('/')} on your plan. Income tax is one relocation factor — compare your own shortlist on the Relocation Compare page.`,
        },
      }
    } catch {
      // Degrade to the rough screen-level card instead of erroring the
      // preview; the Relocation Compare page remains the exact surface.
      return { action: card.action, impact: card.impact }
    }
  },
}
