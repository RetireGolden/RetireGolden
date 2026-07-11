import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import { packForYear } from '../params/index.js'
import { requiredMinimumDistribution } from './rmd.js'
import { jointLifeTableDivisor } from './jointLifeTable.js'

/**
 * Atomic oracle tests for RMDs (Phase 1, calculation-test-plan.md).
 *
 * Divisors are pinned against the IRS Publication 590-B Uniform Lifetime Table
 * (2022+). Each RMD is an independent hand worksheet: prior-year-end balance
 * divided by the published divisor. Start ages follow SECURE 2.0.
 */
const pack = packForYear(2026).pack

describe('RMD golden worksheets', () => {
  it('pins Uniform Lifetime divisors and divides the prior-year balance (Pub 590-B)', () => {
    // [age, divisor, balance chosen so the RMD lands on 10,000].
    const cases = [
      [73, 26.5, 265_000],
      [75, 24.6, 246_000],
      [80, 20.2, 202_000],
      [85, 16.0, 160_000],
      [90, 12.2, 122_000],
      [100, 6.4, 64_000],
    ] as const

    for (const [age, divisor, balance] of cases) {
      expectMoney(requiredMinimumDistribution(pack, 1950, age, balance), balance / divisor)
      // Worksheet cross-check: each case is engineered to a round 10,000 RMD.
      expectMoney(balance / divisor, 10_000)
    }
  })

  it('uses the SECURE 2.0 start age by birth cohort', () => {
    // Pre-1951 cohort starts at 72.
    expect(requiredMinimumDistribution(pack, 1950, 71, 100_000)).toBe(0)
    expectMoney(requiredMinimumDistribution(pack, 1950, 72, 274_000), 274_000 / 27.4)

    // 1951–1959 cohort starts at 73.
    expect(requiredMinimumDistribution(pack, 1955, 72, 100_000)).toBe(0)
    expectMoney(requiredMinimumDistribution(pack, 1955, 73, 265_000), 265_000 / 26.5)

    // 1960+ cohort starts at 75 (boundary year).
    expect(requiredMinimumDistribution(pack, 1960, 74, 100_000)).toBe(0)
    expectMoney(requiredMinimumDistribution(pack, 1960, 75, 246_000), 246_000 / 24.6)
  })

  it('is zero for an empty traditional account', () => {
    expect(requiredMinimumDistribution(pack, 1950, 80, 0)).toBe(0)
  })

  it('uses the joint-life table only when a sole-beneficiary spouse is >10 years younger', () => {
    const balance = 200_000
    const uniform = requiredMinimumDistribution(pack, 1950, 80, balance)

    // Spouse exactly 10 years younger does NOT trigger the joint-life table.
    const tenYears = requiredMinimumDistribution(pack, 1950, 80, balance, {
      ownerSex: 'male',
      spouse: { ageAttained: 70, sex: 'female' },
    })
    expectMoney(tenYears, uniform)

    // Spouse more than 10 years younger -> larger divisor -> strictly smaller RMD.
    const muchYounger = requiredMinimumDistribution(pack, 1950, 80, balance, {
      ownerSex: 'male',
      spouse: { ageAttained: 55, sex: 'female' },
    })
    expect(muchYounger).toBeLessThan(uniform)
  })

  it('uses IRS Table II for qualifying younger sole-beneficiary spouses', () => {
    expect(jointLifeTableDivisor(75, 64)).toBe(25.3)
    expectMoney(
      requiredMinimumDistribution(pack, 1951, 75, 100_000, {
        ownerSex: 'male',
        spouse: { ageAttained: 64, sex: 'female' },
      }),
      100_000 / 25.3,
    )
  })

  it('covers Joint Life Table II spouse ages below 20', () => {
    expect(jointLifeTableDivisor(73, 19)).toBe(66.1)
    expectMoney(
      requiredMinimumDistribution(pack, 1953, 73, 100_000, {
        ownerSex: 'male',
        spouse: { ageAttained: 19, sex: 'female' },
      }),
      100_000 / 66.1,
    )
  })
})
