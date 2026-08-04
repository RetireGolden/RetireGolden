import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'
import { inheritedForcedAmount, inheritedTenYearDeadline } from './inheritedIra.js'

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

describe('registered rule: the shape of the ten-year window', () => {
  // IRC 401(a)(9)(H)(i) sets the deadline, but 401(a)(9)(B)(i) decides whether
  // anything is required BEFORE it. Where the employee died on or after the
  // required beginning date the at-least-as-rapidly rule survives, so an annual
  // distribution is due in each window year on top of the year-ten sweep; where
  // the employee died before it, the sole obligation is to be empty by the
  // deadline. A fixture asserting only the year-ten total would be identical
  // under both readings and would prove nothing, so the discriminator is the
  // COUNT of window years carrying a forced amount.
  //
  // Owner died 2022, so the window years are 2023 through 2031 and the sweep
  // falls in 2032.
  const windowYears = [2023, 2024, 2025, 2026, 2027, 2028, 2029, 2030, 2031]
  const yearsWithForcedAmount = (decedentHadStartedRmds: boolean): number =>
    windowYears.filter((year) =>
      inheritedForcedAmount({ ...base, decedentHadStartedRmds, year }) > 0).length

  describeRule('irc-401-a-9-H-ii-annual-distributions-inside-ten-year-window', {
    readings: { annualWhenDeathWasOnOrAfterTheRequiredBeginningDate: 9, noneBeforeTheDeadline: 0 },
    accepted: 'annualWhenDeathWasOnOrAfterTheRequiredBeginningDate',
  }, ({ accepted, readings }) => {
    it('requires an annual distribution in every window year after a post-RBD death', () => {
      expect(yearsWithForcedAmount(true)).toBe(accepted)
    })

    it('requires none in the window when the decedent died before that date', () => {
      expect(yearsWithForcedAmount(false)).toBe(readings.noneBeforeTheDeadline)
      // The deadline itself is unaffected: the sweep still empties the account.
      expect(inheritedForcedAmount({ ...base, decedentHadStartedRmds: false, year: 2032 }))
        .toBe(base.balance)
    })
  })
})
