import { describe, expect, it } from 'vitest'

import { packForYear } from '../params'
import { expectMoney, expectPercent } from '../../testSupport/money'
import { acaApplicablePct, acaNetAnnualPremium } from './aca'

const pack = packForYear(2026).pack

describe('ACA pack arithmetic fixtures', () => {
  it('matches every encoded applicable-percentage breakpoint', () => {
    // Pack contract: at an exact breakpoint, the piecewise-linear schedule
    // returns the encoded applicable percentage. External validation of the
    // 2026 table itself is tracked separately as ORACLE-003.
    const breakpoints = [
      [0, 2.1],
      [133, 2.1],
      [134, 3.14],
      [150, 4.19],
      [200, 6.6],
      [250, 8.44],
      [300, 9.96],
      [400, 9.96],
    ] as const

    for (const [fplPct, applicablePct] of breakpoints) {
      expectPercent(acaApplicablePct(pack, fplPct), applicablePct)
    }
  })

  it('linearly interpolates inside each non-flat band', () => {
    // Independent worksheets:
    // 133.5% FPL is halfway from 133@2.10 to 134@3.14 -> 2.62.
    // 175% FPL is halfway from 150@4.19 to 200@6.60 -> 5.395.
    // 225% FPL is halfway from 200@6.60 to 250@8.44 -> 7.52.
    // 275% FPL is halfway from 250@8.44 to 300@9.96 -> 9.20.
    expectPercent(acaApplicablePct(pack, 133.5), 2.62)
    expectPercent(acaApplicablePct(pack, 175), 5.395)
    expectPercent(acaApplicablePct(pack, 225), 7.52)
    expectPercent(acaApplicablePct(pack, 275), 9.2)
  })

  it('calculates household-size FPL and the 400% cliff from first principles', () => {
    // 2026 FPL: first person 15,650 + 5,500 per additional person.
    // Household of 2: FPL = 21,150. MAGI 84,600 is exactly 400% FPL.
    const atCliff = acaNetAnnualPremium(pack, 2, 84_600, 18_000)
    expectPercent(atCliff.fplPct, 400)
    expect(atCliff.overCliff).toBe(false)
    expectMoney(atCliff.expectedContribution, 84_600 * 0.0996)
    expectMoney(atCliff.credit, 18_000 - 84_600 * 0.0996)

    const overCliff = acaNetAnnualPremium(pack, 2, 84_601, 18_000)
    expect(overCliff.overCliff).toBe(true)
    expectMoney(overCliff.credit, 0)
    expectMoney(overCliff.netAnnualPremium, 18_000)
  })

  it('floors the credit at zero when the expected contribution exceeds the full premium', () => {
    // Single at MAGI 55,000: fplPct ~= 351.44%, applicable percentage is the
    // flat 9.96% cap, so expected contribution = 5,478, above a $3,000 premium.
    const result = acaNetAnnualPremium(pack, 1, 55_000, 3_000)
    expect(result.overCliff).toBe(false)
    expectMoney(result.expectedContribution, 5_478)
    expectMoney(result.credit, 0)
    expectMoney(result.netAnnualPremium, 3_000)
  })

  it('returns zero net premium and zero credit when the annual premium is zero', () => {
    // Independent worksheet: the credit cannot exceed the benchmark premium.
    // With a $0 premium, both the credit and net premium must be $0 even when
    // MAGI is otherwise subsidy-eligible.
    const result = acaNetAnnualPremium(pack, 1, 30_000, 0)
    expect(result.overCliff).toBe(false)
    expectMoney(result.credit, 0)
    expectMoney(result.netAnnualPremium, 0)
  })
})
