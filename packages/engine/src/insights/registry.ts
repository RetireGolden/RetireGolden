import type { Detector, InsightCard } from './types.js'
import { acaThresholdProximity } from './detectors/acaThresholdProximity.js'
import { annuitizationHeadroom } from './detectors/annuitizationHeadroom.js'
import { assetLocation } from './detectors/assetLocation.js'
import { hecmBufferCandidate } from './detectors/hecmBufferCandidate.js'
import { incomeFloorFunded } from './detectors/incomeFloorFunded.js'
import { irmaaTierEdge } from './detectors/irmaaTierEdge.js'
import { lawPackDrift } from './detectors/lawPackDrift.js'
import { missingDataBasis } from './detectors/missingDataBasis.js'
import { pensionElectionPending } from './detectors/pensionElectionPending.js'
import { qcdEfficiency } from './detectors/qcdEfficiency.js'
import { rothBridgeHeadroom } from './detectors/rothBridgeHeadroom.js'
import { spendingGuardrails } from './detectors/spendingGuardrails.js'
import { spendingHeadroom } from './detectors/spendingHeadroom.js'
import { ssBridgeGap } from './detectors/ssBridgeGap.js'
import { ssClaimMilestone } from './detectors/ssClaimMilestone.js'
import { stalePlanData } from './detectors/stalePlanData.js'
import { stateRelocation } from './detectors/stateRelocation.js'
import { widowsPenalty } from './detectors/widowsPenalty.js'

export const registry: Detector[] = [
  acaThresholdProximity,
  annuitizationHeadroom,
  assetLocation,
  hecmBufferCandidate,
  incomeFloorFunded,
  irmaaTierEdge,
  lawPackDrift,
  missingDataBasis,
  pensionElectionPending,
  qcdEfficiency,
  rothBridgeHeadroom,
  spendingGuardrails,
  spendingHeadroom,
  ssBridgeGap,
  ssClaimMilestone,
  stalePlanData,
  stateRelocation,
  widowsPenalty,
]

/**
 * Editorial ranking weights, in the dollars computeCardScore ranks by, for
 * detectors whose card carries no measured estate delta but which the product
 * places as if it carried one. Presentation choices, not estimates: they never
 * enter a projection or a card's published impact. Changing one reorders every
 * user's cards.
 *
 * spending-guardrails: until B2-P1 slice 3 the detector published a constant
 * 12 as InsightImpact.successRateDeltaPct ("change in Monte Carlo success
 * rate") and ranking credited it at $10,000 a point. It was never a measured
 * change, and RetireGolden-Pro printed it as one, so the field is gone
 * (decision of 2026-09-26, recorded among slice 3's open calls in
 * decisions-2026-09-25.md; rule 3). This weight keeps the card exactly where
 * it ranked: 12 × $10,000 = $120,000, times the medium confidence weight, $84,000.
 */
export const EDITORIAL_RANKING_WEIGHT_DOLLARS: Readonly<Record<string, number>> = Object.freeze({
  'spending-guardrails': 120_000,
})

/**
 * Ranking discount applied to a card's metric by how much the detector trusts
 * its own estimate. Heuristic, unsourced, and presentation-only: no
 * calibration record exists, and these weights never enter a projection.
 */
export const CONFIDENCE_RANKING_WEIGHTS: Readonly<Record<InsightCard['confidence'], number>> =
  Object.freeze({ high: 1.0, medium: 0.7, low: 0.4 })

export function computeCardScore(card: InsightCard): number {
  const editorialWeight = Object.hasOwn(EDITORIAL_RANKING_WEIGHT_DOLLARS, card.id)
    ? EDITORIAL_RANKING_WEIGHT_DOLLARS[card.id]
    : undefined
  const hasQuantified =
    card.impact.endingAfterTaxEstateDelta !== undefined ||
    editorialWeight !== undefined ||
    card.impact.lifetimeTaxDelta !== undefined

  if (!hasQuantified) {
    return -1
  }

  // The editorial weight sits where the retired success-rate figure sat: after
  // a measured estate delta and before a lifetime-tax delta.
  let metricValue = 0
  if (card.impact.endingAfterTaxEstateDelta !== undefined) {
    metricValue = Math.abs(card.impact.endingAfterTaxEstateDelta)
  } else if (editorialWeight !== undefined) {
    metricValue = editorialWeight
  } else if (card.impact.lifetimeTaxDelta !== undefined) {
    metricValue = Math.abs(card.impact.lifetimeTaxDelta)
  }

  const confidenceWeight = CONFIDENCE_RANKING_WEIGHTS[card.confidence]
  return metricValue * confidenceWeight
}

export function sortCards(cards: InsightCard[]): InsightCard[] {
  return [...cards].sort((a, b) => {
    const scoreA = computeCardScore(a)
    const scoreB = computeCardScore(b)
    if (scoreA !== scoreB) {
      return scoreB - scoreA // descending
    }
    const catComp = a.category.localeCompare(b.category)
    if (catComp !== 0) return catComp
    return a.title.localeCompare(b.title)
  })
}
