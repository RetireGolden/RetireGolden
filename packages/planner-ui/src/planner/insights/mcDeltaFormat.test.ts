/**
 * Insights Monte Carlo delta label (#527): only a delta the one-decimal
 * display would print as 0.0 is "no change"; 0.3 pts keeps its sign and
 * color. The finding was 0.0% painted success-green.
 */
import { describe, expect, it } from 'vitest'

import { formatMcDelta, MC_DELTA_FLAT_PTS } from './mcDeltaFormat'

describe('formatMcDelta (#527)', () => {
  it('reads a rounding remainder as no change, with no verdict', () => {
    expect(formatMcDelta(0)).toEqual({ flat: true })
    expect(formatMcDelta(0.0004)).toEqual({ flat: true })
    expect(formatMcDelta(-0.0004)).toEqual({ flat: true })
    expect(MC_DELTA_FLAT_PTS).toBe(0.05)
  })

  it('takes the engine fraction and prints points, a small real delta signed and colored', () => {
    expect(formatMcDelta(0.003)).toEqual({ flat: false, good: true, text: '+0.3 pts' })
    expect(formatMcDelta(0.004)).toEqual({ flat: false, good: true, text: '+0.4 pts' })
    expect(formatMcDelta(-0.003)).toEqual({ flat: false, good: false, text: '−0.3 pts' })
    expect(formatMcDelta(-0.12)).toEqual({ flat: false, good: false, text: '−12.0 pts' })
    expect(formatMcDelta(0.0325)).toEqual({ flat: false, good: true, text: '+3.3 pts' })
    // The worksheet's cases Y and AB: 948 against 912 successes of 1,000, and 500 against 501.
    expect(formatMcDelta(0.948 - 0.912)).toEqual({ flat: false, good: true, text: '+3.6 pts' })
    expect(formatMcDelta(0.5 - 0.501)).toEqual({ flat: false, good: false, text: '−0.1 pts' })
  })
})
