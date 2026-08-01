/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'

import type { ExactLedgerValidation } from '@retiregolden/engine/projection/optimizePlan'
import type { OptimizedSchedule } from '@retiregolden/engine/strategies/optimizer'
import { recommendationBody, recommendationHeading } from './optimizePageRecommendation'
import {
  actionableTournamentConversions,
  buildOptimizeChartRows,
  shouldShowRecommendedScheduleBars,
} from './optimizePageChart'

function schedule(conversions: { year: number; amount: number }[]): OptimizedSchedule {
  return {
    status: 'optimal',
    endingAfterTax: 0,
    lifetimeTax: 0,
    schedule: [],
    conversions,
    solveMs: 0,
  }
}

describe('OptimizePage tournament display helpers', () => {
  it('describes identity withholding without claiming an execution shortfall', () => {
    const validation = {
      recommendationState: 'identityIncomplete',
      requestedConversionTotal: 5_000,
      executedConversionTotal: 5_000,
      baseline: { endingAfterTaxEstate: 100_000 },
      candidate: { endingAfterTaxEstate: 105_000 },
      lifetimeTaxDelta: 0,
    } as ExactLedgerValidation

    expect(recommendationHeading(validation)).toMatch(/account allocation/i)
    expect(recommendationBody(validation)).toMatch(/priced and executed.*owner.*source IRA.*Roth destination/i)
    expect(recommendationBody(validation)).not.toMatch(/only .* could actually be converted/i)
  })

  it('only exposes a tournament winner schedule for an actionable winner', () => {
    const conversions = [{ year: 2026, amount: 5_000 }]
    const tournament = (winnerSource: 'candidate' | 'milp' | 'incumbent' | 'none') => ({
      winnerSource,
      winnerConversions: conversions,
    })

    expect(actionableTournamentConversions(tournament('candidate'))).toBe(conversions)
    expect(actionableTournamentConversions(tournament('milp'))).toBe(conversions)
    expect(actionableTournamentConversions(tournament('incumbent'))).toEqual([])
    expect(actionableTournamentConversions(tournament('none'))).toEqual([])
    expect(actionableTournamentConversions(null)).toEqual([])
  })

  it('shows recommended bars when a candidate wins even without a cleanup mismatch', () => {
    expect(shouldShowRecommendedScheduleBars(true, false)).toBe(true)
    expect(shouldShowRecommendedScheduleBars(false, true)).toBe(true)
    expect(shouldShowRecommendedScheduleBars(false, false)).toBe(false)
  })

  it('builds chart rows from the winning candidate schedule', () => {
    const rows = buildOptimizeChartRows({
      schedule: schedule([{ year: 2026, amount: 1_000 }]),
      recommendedConversions: [
        { year: 2026, amount: 5_000 },
        { year: 2027, amount: 6_000 },
      ],
      postProcessed: null,
      candidateWins: true,
    })

    expect(rows).toEqual([
      { year: 2026, requested: 1_000, cleaned: 5_000, executed: 5_000 },
      { year: 2027, requested: 0, cleaned: 6_000, executed: 6_000 },
    ])
  })
})
