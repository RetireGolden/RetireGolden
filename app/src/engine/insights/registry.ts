import type { Detector, InsightCard } from './types'
import { annuitizationHeadroom } from './detectors/annuitizationHeadroom'
import { assetLocation } from './detectors/assetLocation'
import { hecmBufferCandidate } from './detectors/hecmBufferCandidate'
import { incomeFloorFunded } from './detectors/incomeFloorFunded'
import { irmaaTierEdge } from './detectors/irmaaTierEdge'
import { pensionElectionPending } from './detectors/pensionElectionPending'
import { qcdEfficiency } from './detectors/qcdEfficiency'
import { rothBridgeHeadroom } from './detectors/rothBridgeHeadroom'
import { spendingGuardrails } from './detectors/spendingGuardrails'
import { spendingHeadroom } from './detectors/spendingHeadroom'
import { ssBridgeGap } from './detectors/ssBridgeGap'
import { stateRelocation } from './detectors/stateRelocation'
import { widowsPenalty } from './detectors/widowsPenalty'

export const registry: Detector[] = [
  annuitizationHeadroom,
  assetLocation,
  hecmBufferCandidate,
  incomeFloorFunded,
  irmaaTierEdge,
  pensionElectionPending,
  qcdEfficiency,
  rothBridgeHeadroom,
  spendingGuardrails,
  spendingHeadroom,
  ssBridgeGap,
  stateRelocation,
  widowsPenalty,
]

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
    // Heuristic: scale 1% Monte Carlo success rate to $10,000
    metricValue = Math.abs(card.impact.successRateDeltaPct) * 10000
  } else if (card.impact.lifetimeTaxDelta !== undefined) {
    metricValue = Math.abs(card.impact.lifetimeTaxDelta)
  }

  const confidenceWeight = { high: 1.0, medium: 0.7, low: 0.4 }[card.confidence]
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
