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

import { formatEvidencePercent, formatWholeUsd } from '../../internal/evidenceFormat.js'
import type { Detector, InsightEvidence } from '../types.js'
import { stateParamsFor } from '../../params/state/index.js'
import {
  compareRelocationCandidates,
  relocationScenarioPatch,
} from '../../projection/relocation.js'

/** Modeled zero-income-tax candidates the evaluate() sweep prices. */
const ZERO_TAX_SHORTLIST = ['FL', 'TX', 'WA'] as const

/**
 * Insights detector `state-relocation`. `screen()` is unchanged in its cheap
 * conditions (taxed current state, no planned moves). `evaluate()` runs the
 * relocation-compare sweep over the modeled zero-income-tax shortlist and
 * publishes a lifetime state-tax savings figure in today's dollars on the
 * card's qualitative impact (`formatWholeUsd(savings)`).
 *
 * Lifetime state-tax savings identity. For each calendar year in the union of
 * the baseline row's and the best-candidate row's `stateTaxByYear` lines
 * (a year present on only one side counts as $0 nominal tax), take that year's
 * nominal state+local tax (ledger dollars for that calendar year) for the
 * candidate minus the baseline, deflate to `projection.startYear` with
 * `ctx.projection.deflate(year, amount)`, and sum. The published savings is
 * that sum negated and floored at zero — minuend is the baseline's deflated
 * lifetime state+local tax, subtrahend is the candidate's; a positive number
 * is tax saved by moving (staying costs more). A candidate that costs more
 * than staying publishes $0, never a negative penalty. No per-year floor.
 * The qualitative string then rounds to whole dollars (`Math.round`).
 *
 * Formula: savings = max(0, −Σ_year deflate(year, candidateStateTax_year − baselineStateTax_year))
 *
 * Upstream: `compareRelocationCandidates` rows. Baseline is `id === 'baseline'`.
 * Best candidate is the non-baseline row with `error === null` and the lowest
 * `lifetimeTaxesAndPenalties` (all taxes and penalties, nominal — not the
 * state-tax series). The identity then reads each of those two rows'
 * `stateTaxByYear` (nominal state+local tax per calendar year). Sweep failure
 * degrades to the screen card and publishes no dollar figure.
 *
 * Note: the family draft's "candidate minus baseline floored at zero" is the
 * opposite sign; this code publishes baseline minus candidate floored at zero.
 * Note: "best" is chosen on total taxes and penalties, then the savings
 * identity is computed on state+local tax only.
 */
export const stateRelocation: Detector = {
  id: 'state-relocation',
  category: 'longevity-insurance-geography',
  version: 1,
  screen(ctx) {
    const startYear = ctx.projection.startYear
    const currentState = ctx.plan.household.state
    const overridePct = ctx.plan.assumptions.stateEffectiveTaxPct

    // If already in a tax-free state and no flat override, it's not applicable
    const params = stateParamsFor(currentState, startYear)
    // Unknown states price as $0 state tax in the ledger; stay silent rather
    // than assert an income tax the engine does not charge (GOVERNANCE
    // false-positive policy).
    const currentHasIncomeTax = overridePct > 0 || (params?.hasIncomeTax ?? false)

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

    const stateMarginalRatePct = params
      ? Math.max(...params.brackets[ctx.plan.household.filingStatus].map((bracket) => bracket.ratePct))
      : null
    const formatPct = (pct: number): string => (pct >= 0.1 ? pct.toFixed(1) : pct.toPrecision(1))
    const currentStateValue =
      overridePct > 0
        ? `${currentState} (${formatPct(overridePct)}% modeled override)`
        : `${currentState} (up to ${formatEvidencePercent(stateMarginalRatePct!)} top statutory income-tax rate)`
    const evidence: [InsightEvidence, ...InsightEvidence[]] = [
      { label: 'Current state', value: currentStateValue, year: startYear },
    ]
    if (overridePct > 0) {
      evidence.push({ label: 'Modeled state income-tax override', value: `${formatPct(overridePct)}%`, year: startYear })
    } else {
      evidence.push({ label: `${currentState} top statutory income-tax rate`, value: `up to ${formatEvidencePercent(stateMarginalRatePct!)}`, year: startYear })
    }

    return {
      id: 'state-relocation',
      category: 'longevity-insurance-geography',
      title: 'State residence is a tax lever worth a look',
      rationale: `Your plan is based in ${currentState}, which levies an income tax, with no relocation modeled. If a move is ever on the table for other reasons, the state-tax difference is worth quantifying. The Relocation Compare page prices candidate states on your actual plan. Income tax is one factor among many; nothing here says you should move.`,
      impact: { qualitative: 'Preview to quantify the lifetime state-tax drag vs modeled zero-income-tax states on your own plan.' },
      exact: false,
      confidence: 'medium',
      severity: 'info',
      evidence,
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
          qualitative: `On the full year-by-year projection, staying in ${ctx.plan.household.state} costs about ${formatWholeUsd(savings)} of lifetime state+local income tax (today's dollars) vs ${best.destinationState}, the best of ${ZERO_TAX_SHORTLIST.join('/')} on your plan. Income tax is one relocation factor. Compare your own shortlist on the Relocation Compare page.`,
        },
      }
    } catch {
      // Degrade to the rough screen-level card instead of erroring the
      // preview; the Relocation Compare page remains the exact surface.
      return { action: card.action, impact: card.impact }
    }
  },
}
