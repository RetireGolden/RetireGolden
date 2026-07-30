/**
 * Wording guarantees for the shared ACA-actionability-veto copy: year lists
 * merge and read naturally, the parameter-gap cause is named when the codes
 * say so, and the positive-row caveat only appears when a row was actually
 * blocked (no scary caveat on fallbacks with nothing positive to explain).
 */
import { describe, expect, it } from 'vitest'

import type { AcaActionabilityVeto } from '@retiregolden/engine/projection/optimizePlan'
import { acaVetoExplanation, acaVetoYears } from './acaVetoCopy'

function veto(overrides: Partial<AcaActionabilityVeto> = {}): AcaActionabilityVeto {
  return {
    baselineNonActionableYears: [2027, 2028],
    candidateNonActionableYears: [],
    supportCodes: ['tax-year-parameters-unsupported'],
    vetoedCandidateIds: ['bracket-10'],
    vetoedMilp: false,
    ...overrides,
  }
}

describe('acaVetoYears', () => {
  it('merges baseline and candidate-only years, deduplicated and ascending', () => {
    expect(
      acaVetoYears(veto({ baselineNonActionableYears: [2028, 2027], candidateNonActionableYears: [2029, 2027] })),
    ).toEqual([2027, 2028, 2029])
  })
})

describe('acaVetoExplanation', () => {
  it('names the unpublished-parameters cause and the blocked row caveat', () => {
    const text = acaVetoExplanation(veto())
    expect(text).toContain('marketplace (ACA) coverage in 2027 and 2028')
    expect(text).toContain('sourced ACA tax parameters for those years are not yet published')
    expect(text).toContain('no conversion schedule is presented as actionable')
    expect(text).toContain('leave the unpriced ACA effect out')
  })

  it('uses singular phrasing for one year and a generic cause for other codes', () => {
    const text = acaVetoExplanation(
      veto({
        baselineNonActionableYears: [2026],
        supportCodes: ['other-material-facts-unsupported'],
        vetoedCandidateIds: [],
      }),
    )
    expect(text).toContain('evidence for 2026 could not be priced as actionable')
    expect(text).toContain('cannot measure that change in that year')
    expect(text).toContain('while it stays unpriced')
    // Nothing improving was blocked, so no caveat about blocked rows.
    expect(text).not.toContain('blocked candidate row')
  })

  it('falls back to the generic cause when codes are mixed across years', () => {
    // 2026 is non-actionable for unknown tax-exempt interest; only 2027 waits
    // on parameters — claiming both years wait on parameters would be false.
    const text = acaVetoExplanation(
      veto({
        baselineNonActionableYears: [2026, 2027],
        supportCodes: ['other-material-facts-unsupported', 'tax-year-parameters-unsupported'],
      }),
    )
    expect(text).toContain('The marketplace (ACA) evidence for 2026 and 2027 could not be priced as actionable')
    expect(text).not.toContain('not yet published')
  })

  it('lists three or more years with commas', () => {
    const text = acaVetoExplanation(veto({ baselineNonActionableYears: [2026, 2027, 2028] }))
    expect(text).toContain('2026, 2027, and 2028')
  })
})
