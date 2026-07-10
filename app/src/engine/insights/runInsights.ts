import { registry, sortCards } from './registry'
import type { Detector, DetectorContext, InsightCard } from './types'

/**
 * Runs the synchronous screening pass of all registered detectors.
 * Filters out nulls and ranks the resulting cards.
 */
export function runScreen(ctx: DetectorContext, detectors: Detector[] = registry): InsightCard[] {
  const cards: InsightCard[] = []
  for (const detector of detectors) {
    const card = detector.screen(ctx)
    if (card) {
      cards.push(card)
    }
  }
  return sortCards(cards)
}
