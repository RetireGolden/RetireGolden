/**
 * Asset-location detector (asset-allocation-and-return-model-v2, step 5).
 *
 * Surfaces the shared `assetLocationGenerator` when a plan opts into static
 * allocation on multiple accounts. `screen()` is cheap and pure; `evaluate()`
 * prices every bounded swap on the exact ledger and previews the winner.
 */

import { planUsesAssetAllocation } from '../../allocation/assetClasses.js'
import { createDecisionContext, evaluateCandidate } from '../../decisions/evaluateCandidate.js'
import { assetLocationGenerator } from '../../decisions/generators.js'
import type { DecisionCandidate, DecisionContext } from '../../decisions/types.js'
import { combineTaxCalculators, createFederalTaxCalculator } from '../../tax/federalTax.js'
import { createStateTaxCalculator } from '../../tax/stateTax.js'
import type { Detector, DetectorContext } from '../types.js'

function decisionContextFromDetector(ctx: DetectorContext): DecisionContext {
  const taxCalculator = combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: ctx.plan.assumptions.stateEffectiveTaxPct,
      localPct: ctx.plan.assumptions.localIncomeTaxPct,
    }),
  )
  return createDecisionContext(
    ctx.plan,
    { startYear: ctx.projection.startYear, taxCalculator },
    { result: ctx.projection.result, summary: ctx.projection.summary },
  )
}

function pickBestBeneficialCandidate(
  decisionCtx: DecisionContext,
  candidates: DecisionCandidate[],
): { candidate: DecisionCandidate; delta: number } | null {
  let best: { candidate: DecisionCandidate; delta: number } | null = null
  for (const candidate of candidates) {
    const evaluation = evaluateCandidate(decisionCtx, candidate)
    if (evaluation.recommendationState !== 'beneficial') continue
    const delta = evaluation.deltas.endingAfterTaxEstate
    if (best === null || delta > best.delta) best = { candidate, delta }
  }
  return best
}

export const assetLocation: Detector = {
  id: 'asset-location',
  category: 'accounts-contributions',
  screen(ctx) {
    if (!planUsesAssetAllocation(ctx.plan)) return null

    const candidates = assetLocationGenerator.generate({ plan: ctx.plan } as DecisionContext)
    if (candidates.length === 0) return null

    const preferred =
      candidates.find((candidate) => candidate.id === 'asset-location-bonds-to-traditional') ?? candidates[0]!
    const swapped = (preferred.metadata?.swappedDollars as number | undefined) ?? 0

    return {
      id: 'asset-location',
      category: 'accounts-contributions',
      title: 'Improve asset location across accounts',
      rationale:
        'Your plan uses class-level allocation on multiple accounts. Preview moving bonds toward tax-deferred wrappers and stocks toward taxable or Roth accounts while keeping the household stock/bond mix unchanged.',
      impact: {
        qualitative:
          swapped > 0
            ? `Up to $${Math.round(swapped).toLocaleString()} of class exposure could be relocated; expand to preview the exact after-tax estate impact.`
            : 'Preview bounded location swaps priced on your full projection.',
      },
      exact: false,
      confidence: 'medium',
      learnSlug: 'assumption-investment-returns',
      plannerRoute: 'accounts',
      action: {
        kind: 'preview-scenario',
        scenarioName: preferred.label,
        patch: preferred.planPatch as Record<string, unknown>,
      },
    }
  },
  evaluate(ctx) {
    const card = this.screen(ctx)
    if (!card || card.action.kind !== 'preview-scenario') throw new Error('Asset location not eligible')

    const decisionCtx = decisionContextFromDetector(ctx)
    const candidates = assetLocationGenerator.generate(decisionCtx)
    const best = pickBestBeneficialCandidate(decisionCtx, candidates)
    if (!best) {
      throw new Error(
        'No beneficial asset-location swap was found once taxes, taxable drag, and rebalancing were priced in.',
      )
    }

    return {
      action: {
        kind: 'preview-scenario',
        scenarioName: best.candidate.label,
        patch: best.candidate.planPatch as Record<string, unknown>,
      },
      impact: {
        qualitative: `Exact ledger: "${best.candidate.label}" improves after-tax estate by about $${Math.round(best.delta).toLocaleString()} (today's dollars).`,
        endingAfterTaxEstateDelta: best.delta,
      },
    }
  },
}