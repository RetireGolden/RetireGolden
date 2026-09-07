import { describe, expect, it } from 'vitest'

import { portfolioReturnPct, type HistoricalYear } from './historicalReturns.js'

/**
 * Synthetic arithmetic inputs — validates portfolioReturnPct percent-weight blending only.
 * Not historical-data transcription certification or full Monte Carlo model coverage.
 *
 * Positive: 43.8 × 0.60 + 0.8 × 0.40 = 26.60.
 * Negative: -43.8 × 0.60 + -2.6 × 0.40 = -26.28 + -1.04 = -27.32.
 */
describe('portfolioReturnPct blend arithmetic', () => {
  it('blends synthetic rows at bond-only, stock-only, and 60% equity weights', () => {
    const cases: { year: HistoricalYear; endpoints: [number, number]; blend60: number }[] = [
      { year: { year: 9001, stocksPct: 43.8, bondsPct: 0.8, inflationPct: 0 }, endpoints: [0.8, 43.8], blend60: 26.6 },
      { year: { year: 9002, stocksPct: -43.8, bondsPct: -2.6, inflationPct: 0 }, endpoints: [-2.6, -43.8], blend60: -27.32 },
    ]
    for (const { year, endpoints, blend60 } of cases) {
      expect(portfolioReturnPct(year, 0)).toBeCloseTo(endpoints[0], 10)
      expect(portfolioReturnPct(year, 100)).toBeCloseTo(endpoints[1], 10)
      expect(portfolioReturnPct(year, 60)).toBeCloseTo(blend60, 10)
    }
  })
})
