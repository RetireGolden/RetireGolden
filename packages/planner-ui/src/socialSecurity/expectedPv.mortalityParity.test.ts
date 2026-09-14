import { describe, expect, it } from 'vitest'

import { annualMortality } from '@retiregolden/engine/montecarlo/mortality'

import { survivalCurve } from './expectedPv'

/**
 * Parity between this package's copy of the SSA e(x) -> q(x) identity (the
 * module-private `oneYearSurvival`, reached through `survivalCurve`) and the
 * engine's `annualMortality`. The engine's calculation-catalog record
 * `mortality-ex-to-qx-identity` names the UI copy as a DUPLICATION in its
 * limits and this file as where the two are proved to agree; moving the UI
 * copy into the engine is relocation packet B2-P1 of the bidirectional
 * validation plan. The comparison lives here rather than in the engine's
 * evidence suite so the engine's tests never load a planner-ui module.
 */
describe('expectedPv survivalCurve parity with the engine mortality identity', () => {
  it('survival(x, x + 1) equals 1 - annualMortality(x) for x = 65, 66, 67 (male, multiplier 1) within 1e-12', () => {
    // Multiplier 1 so the UI's optional e(x) scaling is the identity; the
    // worksheet rows are the SSA 2022 male e(65..68).
    const curve = survivalCurve('male', 1)
    for (const x of [65, 66, 67]) {
      const uiSurvival = curve.survival(x, x + 1)
      const engineSurvival = 1 - annualMortality(x, 'male')
      expect(Math.abs(uiSurvival - engineSurvival)).toBeLessThanOrEqual(1e-12)
    }
  })
})
