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
 * Dollars a card is credited for each percentage point of Monte Carlo success
 * rate, so a success-rate impact can be ranked on the same axis as an estate
 * or lifetime-tax delta. Heuristic, unsourced: it is a presentation
 * tie-breaker with no derivation in the repository's history or in DOCS, and
 * it never enters a projection. Changing it reorders every user's cards.
 */
export const SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT = 10000

/**
 * Ranking discount applied to a card's metric by how much the detector trusts
 * its own estimate. Heuristic, unsourced, and presentation-only: no
 * calibration record exists, and these weights never enter a projection.
 */
export const CONFIDENCE_RANKING_WEIGHTS: Readonly<Record<InsightCard['confidence'], number>> =
  Object.freeze({ high: 1.0, medium: 0.7, low: 0.4 })

export function computeCardScore(card: InsightCard): number {
  const hasQuantified =
    card.impact.endingAfterTaxEstateDelta !== undefined ||
    card.impact.successRateDeltaPct !== undefined ||
    card.impact.lifetimeTaxDelta !== undefined

  if (!hasQuantified) {
    return -1
  }

  let metricValue = 0
  if (card.impact.endingAfterTaxEstateDelta !== undefined) {
    metricValue = Math.abs(card.impact.endingAfterTaxEstateDelta)
  } else if (card.impact.successRateDeltaPct !== undefined) {
    metricValue =
      Math.abs(card.impact.successRateDeltaPct) * SUCCESS_RATE_POINT_DOLLAR_EQUIVALENT
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
