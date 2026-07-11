import type { Detector, InsightCard } from '../types.js'
import { analyzePensionElections, pensionTakeLumpSumPatch } from '../../decisions/pensionElection.js'

/**
 * "A pension lump-sum election is on record and undecided"
 * (annuity-pension-and-home-equity, step 5). Fires when a pension carries a
 * lump-sum offer with no election and the election year hasn't passed. The
 * card quotes the PV comparison at the curve-anchored rate (deterministic
 * math, no simulate calls) and previews the take-the-lump-sum scenario so the
 * exact ledger prices taxes, survivor interplay, and sequence risk — the
 * verdict stays a tradeoff, never advice.
 */
export const pensionElectionPending: Detector = {
  id: 'pension-election-pending',
  category: 'longevity-insurance-geography',
  screen(ctx): InsightCard | null {
    const plan = ctx.plan
    const startYear = ctx.projection.startYear
    const pending = plan.accounts.find(
      (a) =>
        a.type === 'pension' &&
        a.lumpSumOffer !== undefined &&
        a.lumpSumElection === undefined &&
        a.lumpSumOffer.electionYear >= startYear,
    )
    if (!pending || pending.type !== 'pension') return null
    const analysis = analyzePensionElections(plan, startYear).find((a) => a.pensionId === pending.id)
    if (!analysis || analysis.lumpSum <= 0) return null

    const pv = analysis.presentValueAtCurveRate
    const ratio = pv / analysis.lumpSum
    const direction =
      ratio > 1.05
        ? `the annuity's discounted value (~$${Math.round(pv).toLocaleString()}) is above the offer`
        : ratio < 0.95
          ? `the offer is above the annuity's discounted value (~$${Math.round(pv).toLocaleString()})`
          : `the offer and the annuity's discounted value (~$${Math.round(pv).toLocaleString()}) are close`

    // The concrete take-the-lump-sum patch comes from the shared builder so
    // the insight and the decision engine can never disagree about mechanics.
    const patch = pensionTakeLumpSumPatch(plan, pending, startYear)

    return {
      id: 'pension-election-pending',
      category: 'longevity-insurance-geography',
      title: `Pension election pending: $${Math.round(analysis.lumpSum).toLocaleString()} lump sum vs lifetime annuity`,
      rationale:
        `${pending.name} offers a $${Math.round(analysis.lumpSum).toLocaleString()} lump sum in ${analysis.electionYear}. ` +
        `At the ${analysis.curveRatePct.toFixed(1)}% curve-anchored discount rate to your planning age, ${direction}. ` +
        'The Accounts section shows the full sensitivity table (discount rate × longevity, survivor option value); ' +
        'the decision hinges on longevity, survivor needs, and what you would earn on the rollover — tradeoffs, not a verdict.',
      impact: {
        qualitative:
          'Preview taking the lump sum (tax-free rollover to a traditional IRA) against keeping the annuity, priced on the exact ledger.',
      },
      exact: false,
      confidence: 'high',
      learnSlug: 'pensions-and-annuities',
      plannerRoute: 'accounts',
      action: patch
        ? { kind: 'preview-scenario', scenarioName: `Take the ${pending.name} lump sum`, patch }
        : { kind: 'advisory' },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card) throw new Error('Pension election not eligible')
    return { action: card.action, impact: card.impact }
  },
}
