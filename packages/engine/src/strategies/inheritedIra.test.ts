import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'
import { packForYear } from '../params/index.js'
import {
  beneficiaryRemainingLifeExpectancy,
  inheritedForcedAmount,
  inheritedTenYearDeadline,
} from './inheritedIra.js'

const { pack } = packForYear(2026)

/**
 * The owner died in 2022, so the first distribution calendar year is 2023, the
 * window runs 2023–2031 and the sweep falls in 2032. The beneficiary was born
 * in 1972, so they reach 51 in that first distribution year — which is the one
 * age Treas. Reg. 1.401(a)(9)-5(d)(3)(iii) ever reads the table at.
 */
const OWNER_DEATH_YEAR = 2022
const BENEFICIARY_BIRTH_YEAR = 1972
/** Single Life Table entry at 51, Treas. Reg. 1.401(a)(9)-9(b) Table 1. */
const SINGLE_LIFE_YEARS_AT_51 = 35.3

const base = {
  pack,
  ownerDeathYear: OWNER_DEATH_YEAR,
  decedentHadStartedRmds: true,
  balance: 300_000,
  startBalance: 300_000,
  beneficiaryAge: 50,
}

/** The beneficiary ages with the projection, as they do in the simulator. */
function forcedIn(year: number, overrides: Partial<typeof base> = {}): number {
  return inheritedForcedAmount({
    ...base,
    year,
    beneficiaryAge: year - BENEFICIARY_BIRTH_YEAR,
    ...overrides,
  })
}

/** Cents, so a reading can be written as the figure a practitioner would check. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

describe('inheritedTenYearDeadline', () => {
  it('is the 10th year after death', () => {
    expect(inheritedTenYearDeadline(2022)).toBe(2032)
  })
})

describe('inheritedForcedAmount', () => {
  it('forces nothing in the year of death or earlier', () => {
    expect(forcedIn(2022)).toBe(0)
    expect(forcedIn(2021)).toBe(0)
  })

  it('takes a single-life RMD during the window when the decedent had started', () => {
    // 2023 is the first distribution calendar year, so the expectancy is the
    // Single Life Table entry at 51 with nothing yet subtracted.
    expect(forcedIn(2023)).toBeCloseTo(300_000 / SINGLE_LIFE_YEARS_AT_51, 4)
  })

  it('forces no annual RMD when the decedent died before their RBD', () => {
    expect(forcedIn(2025, { decedentHadStartedRmds: false })).toBe(0)
  })

  it('sweeps the entire balance in the 10th year', () => {
    expect(forcedIn(2032)).toBe(300_000)
    // ...even when the decedent had not started RMDs (deadline applies regardless).
    expect(forcedIn(2032, { decedentHadStartedRmds: false, balance: 120_000 })).toBe(120_000)
  })

  it('never exceeds the current balance', () => {
    expect(forcedIn(2025, { balance: 100, startBalance: 300_000 })).toBe(100)
  })

  it('returns 0 for an empty account', () => {
    expect(forcedIn(2031, { balance: 0 })).toBe(0)
  })

  it('takes the whole interest once the fixed expectancy has run out', () => {
    // A beneficiary who reaches 119 in the first distribution year carries an
    // expectancy of 1.1 years, and the subtract-one method drives it past zero
    // two years later. There is then nothing left to divide by, so the whole
    // remaining interest is due.
    expect(inheritedForcedAmount({
      ...base, year: 2025, beneficiaryAge: 121, balance: 40_000, startBalance: 50_000,
    })).toBe(40_000)
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
    windowYears.filter((year) => forcedIn(year, { decedentHadStartedRmds }) > 0).length

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
      expect(forcedIn(2032, { decedentHadStartedRmds: false })).toBe(base.balance)
    })
  })
})

// CORRECTED FIXTURE. Until this commit the suite above carried this test:
//
//     const le = baselineRemainingYears(50, 'average')
//     expect(inheritedForcedAmount({ ...base, year: 2025 })).toBeCloseTo(300_000 / le, 4)
//
// It called the very function the implementation called, on the very table the
// implementation used. It was green for exactly as long as the module and the
// test agreed with each other, and it would have stayed green had the SSA table
// been swapped for any other wrong one. It asserted nothing whatever about
// Treas. Reg. 1.401(a)(9)-5(d), and encoded the misreading it was there to
// catch. The two fixtures below assert the regulation's published numbers.
describeRule('treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator', {
  note: 'which table supplies the expectancy',
  // The forced distribution from a $300,000 start-of-year balance in the first
  // distribution calendar year, in dollars and cents.
  //
  // Treas. Reg. 1.401(a)(9)-5(d)(3)(i) admits one table and names it: "all life
  // expectancies are determined using the Single Life Table in
  // § 1.401(a)(9)-9(b)". Its entry at 51 is 35.3 years, so 300,000 / 35.3 =
  // 8,498.58.
  //
  // The rejected reading is the SSA 2022 period table this engine carries for
  // longevity modelling, averaged across the male and female columns: 30.03
  // years at 51, so 300,000 / 30.03 = 9,990.01. It is not the prescribed table,
  // it is not unisex as published, and the distribution it sizes is 17.6
  // percent larger than the regulation requires — forced ordinary income pulled
  // into the early years of the window.
  readings: {
    singleLifeTableOfTheRegulation: 8_498.58,
    rejectedSsaPeriodTable: 9_990.01,
  },
  accepted: 'singleLifeTableOfTheRegulation',
}, ({ accepted, readings }) => {
  it('sizes the annual amount from the Single Life Table, not the SSA period table', () => {
    expect(round2(forcedIn(2023))).toBe(accepted)
    expect(round2(forcedIn(2023))).not.toBe(readings.rejectedSsaPeriodTable)
  })

  it('carries the published divisor, not an approximation of it', () => {
    // 300,000 / amount recovers the divisor the engine used. The regulation
    // says the expectancy IS the table entry, so the recovered number has to be
    // 35.3 exactly, not something near it.
    expect(300_000 / forcedIn(2023)).toBeCloseTo(SINGLE_LIFE_YEARS_AT_51, 10)
    expect(pack.rmd.singleLifeTable[51]).toBe(SINGLE_LIFE_YEARS_AT_51)
  })

  it('is unisex, so no SSA column can be recovered from the amount', () => {
    // Every table under 1.401(a)(9)-9 is published as a single unisex column.
    // The SSA table is not, and the engine no longer has a sex to give it.
    const amount = forcedIn(2023)
    for (const sex of ['male', 'female', 'average'] as const) {
      expect(amount).not.toBeCloseTo(300_000 / baselineRemainingYears(51, sex), 2)
    }
  })
})

describeRule('treas-reg-1-401-a-9-5-d-3-beneficiary-single-life-denominator', {
  note: 'fixed at the first distribution year or redetermined each year',
  // The forced distribution from a $300,000 start-of-year balance in 2031, the
  // last window year, in dollars and cents. Both readings take the Single Life
  // Table, so the table is held fixed here and only the method varies.
  //
  // Treas. Reg. 1.401(a)(9)-5(d)(3)(iii) fixes a non-spouse designated
  // beneficiary's expectancy "using the beneficiary's age as of the
  // beneficiary's birthday in the calendar year following the calendar year of
  // the employee's death", then reduces it "by one for each calendar year that
  // has elapsed after that first calendar year". Read at 51 in 2023 that is
  // 35.3; by 2031 eight years have elapsed, leaving 27.3, so
  // 300,000 / 27.3 = 10,989.01.
  //
  // The rejected reading re-reads the table at the age attained in the current
  // year — 59 in 2031, giving 28.0 and 300,000 / 28.0 = 10,714.29. Annual
  // redetermination is the (d)(3)(iv) treatment, which the regulation reserves
  // for a surviving spouse who is the sole beneficiary; a surviving spouse does
  // not hold an inherited IRA at all under IRC 408(d)(3)(C)(ii). It understates
  // the required amount, and by more with each year of the window.
  readings: {
    fixedAtTheYearAfterDeathThenReducedByOne: 10_989.01,
    rejectedRedeterminedAtTheCurrentAge: 10_714.29,
  },
  accepted: 'fixedAtTheYearAfterDeathThenReducedByOne',
}, ({ accepted, readings }) => {
  it('reduces the initial expectancy by one a year rather than re-reading the table', () => {
    expect(round2(forcedIn(2031))).toBe(accepted)
    expect(round2(forcedIn(2031))).not.toBe(readings.rejectedRedeterminedAtTheCurrentAge)
  })

  it('reads the table once, at the age reached in the year after death', () => {
    const at = (year: number): number =>
      beneficiaryRemainingLifeExpectancy(pack, {
        year,
        ownerDeathYear: OWNER_DEATH_YEAR,
        beneficiaryAge: year - BENEFICIARY_BIRTH_YEAR,
      })
    expect(at(2023)).toBeCloseTo(SINGLE_LIFE_YEARS_AT_51, 10)
    // Whole-year steps down from that one entry, never a fresh lookup: the
    // table's own steps between 51 and 59 are 0.9 and 1.0, not a flat 1.
    expect(at(2024)).toBeCloseTo(SINGLE_LIFE_YEARS_AT_51 - 1, 10)
    expect(at(2031)).toBeCloseTo(SINGLE_LIFE_YEARS_AT_51 - 8, 10)
    expect(at(2031)).not.toBeCloseTo(pack.rmd.singleLifeTable[59]!, 6)
  })

  it('does not turn on the age the beneficiary happens to be now', () => {
    // Two beneficiaries who are the same age in 2031 but inherited in different
    // years hold different fixed expectancies. The rejected reading would give
    // them the same amount, which is what makes this the discriminating case.
    const sameAgeLaterDeath = inheritedForcedAmount({
      ...base,
      year: 2031,
      ownerDeathYear: 2028,
      beneficiaryAge: 2031 - BENEFICIARY_BIRTH_YEAR,
    })
    expect(round2(sameAgeLaterDeath)).not.toBe(accepted)
    // ...and it is the later inheritance that carries the longer expectancy,
    // because the table was read at 57 rather than at 51 minus eight years.
    expect(sameAgeLaterDeath).toBeLessThan(forcedIn(2031))
  })
})

describe('unmodelled: the greater-of test of Treas. Reg. 1.401(a)(9)-5(d)(1)(ii)', () => {
  // Registered as treas-reg-1-401-a-9-5-d-1-ii-greater-of-employee-life-expectancy
  // and out of scope: the plan model records the year the owner died but never
  // their age, so the employee's remaining life expectancy cannot be looked up.
  // This pins the gap instead of leaving it silent — the divisor is the
  // beneficiary's alone, so an older beneficiary is forced to distribute faster
  // than the regulation requires.
  it('takes the beneficiary expectancy whether or not it is the greater one', () => {
    // A beneficiary of 81 in the first distribution year carries 10.5 years
    // against the 35.3 of a beneficiary of 51, and nothing about the decedent
    // can lift the older one back up: no decedent age is an input at all.
    expect(inheritedForcedAmount({ ...base, year: 2023, beneficiaryAge: 81 }))
      .toBeCloseTo(300_000 / 10.5, 6)
    expect(pack.rmd.singleLifeTable[81]).toBe(10.5)
  })
})
