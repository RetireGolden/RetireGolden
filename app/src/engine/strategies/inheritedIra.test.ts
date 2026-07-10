import { describe, expect, it } from 'vitest'

import { baselineRemainingYears } from '../../longevity/ssaPeriod2022'
import { inheritedForcedAmount, inheritedTenYearDeadline } from './inheritedIra'

const base = {
  ownerDeathYear: 2022,
  decedentHadStartedRmds: true,
  balance: 300_000,
  startBalance: 300_000,
  beneficiaryAge: 50,
  beneficiarySex: 'average' as const,
}

describe('inheritedTenYearDeadline', () => {
  it('is the 10th year after death', () => {
    expect(inheritedTenYearDeadline(2022)).toBe(2032)
  })
})

describe('inheritedForcedAmount', () => {
  it('forces nothing in the year of death or earlier', () => {
    expect(inheritedForcedAmount({ ...base, year: 2022 })).toBe(0)
    expect(inheritedForcedAmount({ ...base, year: 2021 })).toBe(0)
  })

  it('takes a single-life RMD during the window when the decedent had started', () => {
    const le = baselineRemainingYears(50, 'average')
    expect(inheritedForcedAmount({ ...base, year: 2025 })).toBeCloseTo(300_000 / le, 4)
  })

  it('forces no annual RMD when the decedent died before their RBD', () => {
    expect(inheritedForcedAmount({ ...base, decedentHadStartedRmds: false, year: 2025 })).toBe(0)
  })

  it('sweeps the entire balance in the 10th year', () => {
    expect(inheritedForcedAmount({ ...base, year: 2032 })).toBe(300_000)
    // ...even when the decedent had not started RMDs (deadline applies regardless).
    expect(inheritedForcedAmount({ ...base, decedentHadStartedRmds: false, year: 2032, balance: 120_000 })).toBe(120_000)
  })

  it('never exceeds the current balance', () => {
    expect(inheritedForcedAmount({ ...base, year: 2025, balance: 100, startBalance: 300_000 })).toBe(100)
  })

  it('returns 0 for an empty account', () => {
    expect(inheritedForcedAmount({ ...base, year: 2031, balance: 0 })).toBe(0)
  })
})
