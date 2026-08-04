import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'

import { baselineRemainingYears } from '../longevity/ssaPeriod2022.js'
import { packForYear, uniformLifetimeDivisor } from '../params/index.js'
import { seppActive, seppAnnualAmount, SEPP_AMORTIZATION_RATE_PCT } from './sepp.js'

const { pack } = packForYear(2026)

/** Cents, so a reading can be written as the figure a practitioner would check. */
function round2(value: number): number {
  return Math.round(value * 100) / 100
}

describe('seppActive — longer of 5 years or until 59½', () => {
  it('is inactive before the start age', () => {
    expect(seppActive(55, 54)).toBe(false)
  })
  it('is active in the start year and through age 59', () => {
    expect(seppActive(55, 55)).toBe(true)
    expect(seppActive(55, 59)).toBe(true)
  })
  it('stops at 60 once five years have elapsed', () => {
    // Started at 55: by 60, five years are up AND past 59½ -> stop.
    expect(seppActive(55, 60)).toBe(false)
  })
  it('continues past 60 when five years are not yet up', () => {
    // Started at 58: must run to age 63 (5 years) even though past 59½.
    expect(seppActive(58, 60)).toBe(true)
    expect(seppActive(58, 62)).toBe(true)
    expect(seppActive(58, 63)).toBe(false)
  })
})

describe('seppAnnualAmount', () => {
  // The divisor is the Single Life Table entry for the age, and nothing else:
  // 31.6 years at 55 under Treas. Reg. 1.401(a)(9)-9(b). These are the plain
  // mechanics; the table choice itself is settled by the fixture below.
  const SINGLE_LIFE_YEARS_AT_55 = 31.6

  it('rmd method divides the current balance by the Single Life Table divisor', () => {
    expect(seppAnnualAmount(pack, 'rmd', 500_000, 55))
      .toBeCloseTo(500_000 / SINGLE_LIFE_YEARS_AT_55, 4)
  })

  it('amortization pays more than the rmd method at the same age (interest front-loads it)', () => {
    const rmd = seppAnnualAmount(pack, 'rmd', 500_000, 55)
    const amort = seppAnnualAmount(pack, 'amortization', 500_000, 55)
    expect(amort).toBeGreaterThan(rmd)
  })

  it('amortization matches the level-payment formula', () => {
    const r = SEPP_AMORTIZATION_RATE_PCT / 100
    const expected = (500_000 * r) / (1 - Math.pow(1 + r, -SINGLE_LIFE_YEARS_AT_55))
    expect(seppAnnualAmount(pack, 'amortization', 500_000, 55)).toBeCloseTo(expected, 2)
  })

  it('amortization at 0% interest equals balance ÷ life expectancy', () => {
    expect(seppAnnualAmount(pack, 'amortization', 300_000, 55, 0))
      .toBeCloseTo(300_000 / SINGLE_LIFE_YEARS_AT_55, 4)
  })

  it('returns 0 for an empty balance', () => {
    expect(seppAnnualAmount(pack, 'rmd', 0, 55)).toBe(0)
  })
})

describeRule('notice-2022-6-3-02-a-permitted-life-expectancy-tables', {
  note: 'the table must be one of the three the notice permits',
  // The annual payment a $500,000 balance produces under the required minimum
  // distribution method for a 55-year-old, in dollars and cents.
  //
  // Notice 2022-6 section 3.02(a) lists the tables that MAY be used, and the
  // list is closed: the Uniform Lifetime Table in its Appendix A, the Single
  // Life Table in Treas. Reg. 1.401(a)(9)-9(b), and the Joint and Last Survivor
  // Table in 1.401(a)(9)-9(d). The Single Life entry at 55 is 31.6 years, so
  // 500,000 / 31.6 = 15,822.78.
  //
  // The rejected reading is the SSA 2022 period table this engine carries for
  // longevity modelling, averaged across the male and female columns:
  // 26.64 years at 55, so 500,000 / 26.64 = 18,768.77. It is not a table the
  // notice permits, it is not unisex as published, and the payment it sizes is
  // 18.6 percent larger than the largest the notice would allow on these facts
  // — which is penalty-free early income the exception does not cover.
  readings: {
    singleLifeTablePermittedByTheNotice: 15_822.78,
    ssaPeriodTableNotAmongThePermittedThree: 18_768.77,
  },
  accepted: 'singleLifeTablePermittedByTheNotice',
}, ({ accepted, readings }) => {
  it('sizes the payment from a permitted table rather than the SSA period table', () => {
    expect(round2(seppAnnualAmount(pack, 'rmd', 500_000, 55))).toBe(accepted)
    expect(round2(seppAnnualAmount(pack, 'rmd', 500_000, 55)))
      .not.toBe(readings.ssaPeriodTableNotAmongThePermittedThree)
  })

  it('carries the published Single Life divisor, not an approximation of it', () => {
    // 500,000 / payment recovers the divisor the engine used. The notice says
    // to take "the entry from the table", so the recovered number has to be the
    // regulation's 31.6 exactly, not something near it.
    expect(500_000 / seppAnnualAmount(pack, 'rmd', 500_000, 55)).toBeCloseTo(31.6, 10)
    expect(pack.rmd.singleLifeTable[55]).toBe(31.6)
  })

  it('takes the birthday-age entry whole rather than interpolating between rows', () => {
    // Section 3.02(a) uses "the entry from the table for the employee's age on
    // the employee's birthday in that distribution year" — a row, not a blend.
    // A fractional age therefore has to resolve to the row already attained.
    expect(seppAnnualAmount(pack, 'rmd', 500_000, 55.9))
      .toBe(seppAnnualAmount(pack, 'rmd', 500_000, 55))
    expect(seppAnnualAmount(pack, 'rmd', 500_000, 56))
      .not.toBe(seppAnnualAmount(pack, 'rmd', 500_000, 55))
  })

  it('is unisex, so the SSA table cannot be recovered for either sex', () => {
    // All three permitted tables are published as single unisex columns. The
    // SSA table is not, and the engine no longer has a sex to give it: the
    // payment matches neither the male nor the female column at 55.
    const payment = seppAnnualAmount(pack, 'rmd', 500_000, 55)
    for (const sex of ['male', 'female', 'average'] as const) {
      expect(payment).not.toBeCloseTo(500_000 / baselineRemainingYears(55, sex), 2)
    }
  })
})

describeRule('notice-2022-6-3-02-a-permitted-life-expectancy-tables', {
  note: 'direction: which permitted table sizes the larger payment',
  // The annual payment a $500,000 balance produces under the required minimum
  // distribution method for a 72-year-old, in dollars and cents.
  //
  // This fixture settles a different question from the one above it. That one
  // asks whether the divisor comes from a table section 3.02(a) permits at all.
  // This one asks which way the choice among the permitted three cuts, because
  // four texts in this engine once claimed Single Life was chosen for producing
  // the SMALLEST permitted payment and that is backwards. The payment is the
  // balance over the divisor, so the SHORTEST table sizes the LARGEST payment.
  //
  // Both readings below are permitted numbers — that is the whole point. At 72
  // the Single Life Table of Treas. Reg. 1.401(a)(9)-9(b) gives 17.2 years, so
  // 500,000 / 17.2 = 29,069.77. The Uniform Lifetime Table in Appendix A of
  // Notice 2022-6 gives 27.4 years at the same age, so 500,000 / 27.4 =
  // 18,248.18. Section 3.02(a) would allow either; the engine takes the first,
  // and the participant draws 10,821.59 a year more penalty-free income than
  // the other permitted table would have given them.
  //
  // Single Life is the accepted reading because section 3.02(b) confines the
  // Joint and Last Survivor Table to an actual designated beneficiary of the
  // account and leaves Single Life as the table for a distribution year with
  // none, and the election modelled here carries no beneficiary. It is NOT
  // accepted as a safety choice: nothing about it is conservative, and a
  // fixture that let the reversed rationale stand would be pinning a sentence
  // the arithmetic contradicts.
  readings: {
    singleLifeShortestTableSizesTheLargestPermittedPayment: 29_069.77,
    uniformLifetimeLongestTableWouldSizeTheSmallestPermittedPayment: 18_248.18,
  },
  accepted: 'singleLifeShortestTableSizesTheLargestPermittedPayment',
}, ({ accepted, readings }) => {
  const UNIFORM = 'uniformLifetimeLongestTableWouldSizeTheSmallestPermittedPayment' as const

  it('pays the Single Life figure, which EXCEEDS the Uniform Lifetime figure', () => {
    const paid = round2(seppAnnualAmount(pack, 'rmd', 500_000, 72))
    expect(paid).toBe(accepted)
    // The rejected reading is not wrong law, it is the other permitted table,
    // and the direction between them is the thing under test.
    expect(paid).toBeGreaterThan(readings[UNIFORM])
    expect(paid).not.toBe(readings[UNIFORM])
  })

  it('reads the other permitted table off the same pack, so neither figure is a guess', () => {
    const uniform = uniformLifetimeDivisor(pack, 72)
    expect(uniform).toBe(27.4)
    expect(round2(500_000 / uniform!)).toBe(readings[UNIFORM])
    expect(pack.rmd.singleLifeTable[72]).toBe(17.2)
  })

  it('holds the same direction at every age both tables publish a row for', () => {
    // The Uniform Lifetime Table starts at 72 and runs to 120. Wherever the two
    // overlap, Single Life is the shorter divisor and therefore the larger
    // payment — so "shortest table" and "smallest payment" cannot both be said
    // of it at any age at all.
    for (let age = 72; age <= 120; age += 1) {
      const uniform = uniformLifetimeDivisor(pack, age)
      if (uniform === undefined) continue
      const singleLife = pack.rmd.singleLifeTable[age]!
      expect(singleLife, `Single Life divisor at ${age}`).toBeLessThan(uniform)
      expect(
        seppAnnualAmount(pack, 'rmd', 500_000, age),
        `Single Life payment at ${age}`,
      ).toBeGreaterThan(500_000 / uniform)
    }
  })
})

describeRule('notice-2022-6-3-01-b-level-amortization', {
  // The fixed amortization payment for a $500,000 balance at 55, in dollars and
  // cents, at the 5% rate section 3.02(c) permits.
  //
  // Section 3.01(b) asks for "the level amortization of the account balance
  // over a specified number of years determined using the chosen life
  // expectancy table ... and an interest rate that is permitted". Both halves
  // are load-bearing, and each has its own way of going wrong.
  //
  //  - Level amortization over the permitted 31.6-year Single Life divisor at
  //    5%: 500,000 x 0.05 / (1 - 1.05^-31.6) = 31,806.70. This is the rule.
  //  - Dropping the interest rate turns the method into straight-line division
  //    and collapses it onto the required minimum distribution method's first
  //    year: 500,000 / 31.6 = 15,822.78. The notice would not need two separate
  //    methods if that were the reading.
  //  - Keeping level amortization but taking the years from the SSA period
  //    table rather than a permitted one: 500,000 x 0.05 / (1 - 1.05^-26.64) =
  //    34,368.73. Right formula, impermissible divisor.
  readings: {
    levelAmortizationOverThePermittedDivisor: 31_806.70,
    straightLineIgnoringThePermittedInterestRate: 15_822.78,
    levelAmortizationOverANonPermittedDivisor: 34_368.73,
  },
  accepted: 'levelAmortizationOverThePermittedDivisor',
}, ({ accepted, readings }) => {
  it('amortizes the balance at the permitted rate over the permitted divisor', () => {
    expect(round2(seppAnnualAmount(pack, 'amortization', 500_000, 55))).toBe(accepted)
  })

  it('is not the straight-line figure the rmd method produces in its first year', () => {
    expect(round2(seppAnnualAmount(pack, 'amortization', 500_000, 55)))
      .not.toBe(readings.straightLineIgnoringThePermittedInterestRate)
    // The rate is what separates them, and only the rate: at 0% the method
    // really does degenerate to the rejected figure.
    expect(round2(seppAnnualAmount(pack, 'amortization', 500_000, 55, 0)))
      .toBe(readings.straightLineIgnoringThePermittedInterestRate)
  })

  it('does not amortize over a divisor the notice never permitted', () => {
    expect(round2(seppAnnualAmount(pack, 'amortization', 500_000, 55)))
      .not.toBe(readings.levelAmortizationOverANonPermittedDivisor)
    expect(seppAnnualAmount(pack, 'amortization', 500_000, 55))
      .toBeLessThan(readings.levelAmortizationOverANonPermittedDivisor)
  })
})

describeRule('notice-2022-6-3-02-c-interest-rate-ceiling', {
  // The rate the engine applies to the fixed amortization method, in percent.
  // Notice 2022-6 section 3.02(c) caps it at the GREATER of 5% or 120% of the
  // federal mid-term rate, so 5% clears the ceiling in every rate environment.
  // The superseded Rev. Rul. 2002-62 section 2.02(c) had no 5% leg at all: in a
  // month when the mid-term rate was 0.5%, its ceiling was 0.6% and a flat 5%
  // was impermissible. The two readings therefore price the same series
  // differently, and only one of them is still law.
  readings: {
    notice2022_6GreaterOf5PctOr120PctMidTerm: 5,
    revRul2002_62OneHundredTwentyPctMidTermOnly: 0.6,
  },
  accepted: 'notice2022_6GreaterOf5PctOr120PctMidTerm',
}, ({ accepted, readings }) => {
  it('uses the 5% floor of the ceiling, which no rate environment can breach', () => {
    expect(SEPP_AMORTIZATION_RATE_PCT).toBe(accepted)
    expect(SEPP_AMORTIZATION_RATE_PCT)
      .not.toBe(readings.revRul2002_62OneHundredTwentyPctMidTermOnly)
  })

  it('prices the series above what the superseded 120% ceiling would allow', () => {
    const atNoticeCeiling = seppAnnualAmount(pack, 'amortization', 500_000, 55)
    const atSupersededCeiling = seppAnnualAmount(
      pack, 'amortization', 500_000, 55,
      readings.revRul2002_62OneHundredTwentyPctMidTermOnly,
    )
    // Not a rounding difference: the readings disagree by thousands a year.
    expect(atNoticeCeiling).toBeGreaterThan(atSupersededCeiling + 1_000)
  })

  it('defaults to the ceiling floor rather than requiring a rate argument', () => {
    expect(seppAnnualAmount(pack, 'amortization', 500_000, 55))
      .toBe(seppAnnualAmount(pack, 'amortization', 500_000, 55, accepted))
  })
})
