/** @vitest-environment jsdom */
import { describe, expect, it } from 'vitest'

import type { OptimizedSchedule } from '../engine/strategies/optimizer'
import { buildOptimizeChartRows, shouldShowRecommendedScheduleBars } from './optimizePageChart'

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
