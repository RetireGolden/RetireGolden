import type { OwnedNonRothIraAnnualSettlementCommitted } from
  './ownedNonRothIraAnnualAttemptSettlement.js'
import type {
  SimulatorCommittedOwnedNonRothIraAnnualReplay,
  YearResult,
} from '../projection/types.js'

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

/**
 * Convert one private committed settlement into the sole public annual value.
 * Returning null is deliberately fail-closed: a caller can still preserve the
 * committed legacy economics, but it cannot publish a partial or misjoined
 * replay when the final provisional YearResult and replay tail disagree.
 */
export function committedOwnedNonRothIraAnnualReplayPublication(
  settlement: Readonly<OwnedNonRothIraAnnualSettlementCommitted>,
  yearResult: Readonly<YearResult>,
): Readonly<SimulatorCommittedOwnedNonRothIraAnnualReplay> | null {
  if (settlement.status !== 'committed' ||
      settlement.reason !== 'exactReplayEffectsMatched' ||
      settlement.pendingSettlement.settlement !== 'exactEffectsMatched') {
    return null
  }
  const pending = settlement.pendingSettlement
  const replay = pending.replay
  const annualReplay = replay.annualReplays.at(-1)
  if (annualReplay === undefined ||
      replay.endTaxYear !== yearResult.year ||
      pending.endTaxYear !== yearResult.year ||
      annualReplay.taxYear !== yearResult.year ||
      replay.startTaxYear !== pending.projectionStartTaxYear ||
      replay.sourceSeriesEvidenceId.length === 0 ||
      replay.replayEvidenceId.length === 0 ||
      annualReplay.ownerReplays.some((owner) =>
        owner.annualObservation.planId !== pending.planId ||
        owner.taxYear !== yearResult.year)) {
    return null
  }
  return deepFreeze({
    status: 'committedOwnedNonRothIraAnnualReplay' as const,
    settlement: 'exactReplayEffectsMatched' as const,
    evidenceScope: replay.evidenceScope,
    movement: replay.movement,
    actionability: replay.actionability,
    filingCompleteness: replay.filingCompleteness,
    planId: pending.planId,
    projectionStartTaxYear: pending.projectionStartTaxYear,
    taxYear: yearResult.year,
    sourceSeriesEvidenceId: replay.sourceSeriesEvidenceId,
    contiguousReplayEvidenceId: replay.replayEvidenceId,
    annualReplay,
  })
}
