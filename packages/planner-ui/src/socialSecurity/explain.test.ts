import { describe, expect, it } from 'vitest'

import {
  bendTierForAime,
  CREDIT_EARNINGS,
  estimateCredits,
  replaceZeroYearGain,
  summarizeComputation,
} from './explain'
import { computePiaFromEarnings, isPiaFromEarningsError, type PiaFromEarningsResult } from '@retiregolden/engine/socialSecurity/piaFromEarnings'

describe('bendTierForAime', () => {
  // 2015 published bend points: first 826, second 4980.
  it('classifies the next dollar into the right tier', () => {
    expect(bendTierForAime(500, 2015).label).toBe('90%')
    expect(bendTierForAime(2000, 2015).label).toBe('32%')
    expect(bendTierForAime(6000, 2015).label).toBe('15%')
  })

  it('uses 90% at the very bottom and 15% above the second bend', () => {
    expect(bendTierForAime(0, 2015).marginalRate).toBe(0.9)
    expect(bendTierForAime(10_000, 2015).marginalRate).toBe(0.15)
  })
})

describe('computation summary + zero-year replacement', () => {
  const ok = (r: ReturnType<typeof computePiaFromEarnings>): PiaFromEarningsResult => {
    if (isPiaFromEarningsError(r)) throw new Error(`unexpected error: ${r.code}`)
    return r
  }

  it('counts zero years averaged into AIME', () => {
    // DOB 1962-06-15 → base 1984–2023 (40 years); only 2 reported years means
    // the top-35 set is mostly zeros after the 5-year dropout.
    const r = ok(
      computePiaFromEarnings({
        dobYear: 1962,
        dobMonth: 6,
        dobDay: 15,
        earnings: [
          { year: 2020, amount: 40_000 },
          { year: 2021, amount: 40_000 },
        ],
        lastEarningsYear: 2023,
      }),
    )
    const s = summarizeComputation(r)
    expect(s.computationYearCount).toBe(35)
    expect(s.divisorMonths).toBe(420)
    expect(s.zeroYearsInAime).toBe(33)
  })

  it('values replacing a zero year at the marginal bend rate', () => {
    const r = ok(
      computePiaFromEarnings({
        dobYear: 1962,
        dobMonth: 6,
        dobDay: 15,
        earnings: [{ year: 2021, amount: 40_000 }],
        lastEarningsYear: 2023,
      }),
    )
    // Low AIME → still in the 90% tier; gain = (indexed/420) * 0.9.
    const gain = replaceZeroYearGain(r, 42_000)
    expect(gain).toBeCloseTo((42_000 / 420) * 0.9, 5)
    expect(replaceZeroYearGain(r, 0)).toBe(0)
  })
})

describe('estimateCredits', () => {
  it('honors a manual override', () => {
    expect(estimateCredits([], 40)).toEqual({ credits: 40, eligible: true, estimated: false })
    expect(estimateCredits([], 12)).toEqual({ credits: 12, eligible: false, estimated: false })
  })

  it('estimates 4 credits per substantial year, capped at 40', () => {
    const tenYears = Array.from({ length: 10 }, (_, i) => ({ year: 2000 + i, amount: 50_000 }))
    expect(estimateCredits(tenYears, null)).toEqual({ credits: 40, eligible: true, estimated: true })

    const fiveYears = tenYears.slice(0, 5)
    expect(estimateCredits(fiveYears, null)).toEqual({ credits: 20, eligible: false, estimated: true })
  })

  it('awards partial credits for a low-earnings year', () => {
    const r = estimateCredits([{ year: 2020, amount: CREDIT_EARNINGS * 2 + 50 }], null)
    expect(r.credits).toBe(2)
    expect(r.eligible).toBe(false)
  })
})
