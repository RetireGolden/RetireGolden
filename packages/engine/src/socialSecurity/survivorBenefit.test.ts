import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import {
  SURVIVOR_EARLIEST_AGE,
  SURVIVOR_MAX_REDUCTION,
  WIDOW_LIMIT_PIA_FRACTION,
  survivorReductionFactor,
  survivorBenefitMonthly,
} from './survivorBenefit.js'
import { fraTotalMonths, survivorFraForBirthYear } from './nra.js'

// Survivor FRA for born 1960 is 66y8m = 66*12 + 8 = 800 months (416(l)(1)(D): age 60 in 2020).
const SURVIVOR_FRA_1960 = 66 * 12 + 8
// Survivor FRA for born 1951–56 is 66y0m = 792 months.
const SURVIVOR_FRA_1951TO56 = 66 * 12
const age = (years: number, months = 0) => ({ years, months })

describe('widow benefit base', () => {
  // 42 U.S.C. 402(e)(2)(A) sets the widow benefit at the deceased's PRIMARY
  // INSURANCE AMOUNT -- the whole of it. The one-half fraction of 402(b)(2)
  // belongs to a spouse of a LIVING worker, and carrying it across to the
  // survivor case halves the benefit at exactly the point a household can
  // least afford it.
  //
  // Deceased PIA 2,000 who claimed at their own full retirement age, so no
  // delayed credits are deemed in under 402(e)(2)(C) and the 82.5 percent
  // widow limit of 402(e)(2)(D) sits below the PIA without binding. The
  // survivor claims at 67y0m against a survivor FRA of 66y8m -- four months
  // PAST it, not at it, so the widow(er) reduction factor is 1 and the base
  // reaches the assertion untouched. Deliberately past rather than exactly on
  // the boundary: this fixture is about what the base IS, and parking it on
  // the at-or-after comparison would let an unrelated off-by-one in the
  // reduction schedule break it for a reason that has nothing to do with
  // 402(e)(2)(A). The boundary itself is covered by survivorReductionFactor
  // below.
  //   402(e)(2)(A):        2,000
  //   spousal half:        1,000
  describeRule('usc-42-402-e-2-widow-full-pia', {
    readings: { fullPrimaryInsuranceAmount: 2_000, halfAsForALivingWorkerSpouse: 1_000 },
    accepted: 'fullPrimaryInsuranceAmount',
  }, ({ accepted, readings }) => {
    it('pays the whole primary insurance amount to an unreduced survivor', () => {
      const monthly = survivorBenefitMonthly({
        deceasedPiaMonthly: 2_000,
        deceasedActualMonthly: 2_000,
        survivorClaimAge: { years: 67, months: 0 },
        survivorFraMonths: SURVIVOR_FRA_1960,
      })

      expect(monthly).toBeCloseTo(accepted, 6)
      expect(monthly).not.toBeCloseTo(readings.halfAsForALivingWorkerSpouse, 6)
    })
  })

  // 20 CFR 404.338(b)'s survivor limb is deliberately a separate,
  // discriminating fixture: it decides whether the deceased's delayed credits
  // remain in the survivor base, rather than re-testing the whole-PIA limb
  // above. The survivor is past survivor FRA, so no survivor reduction is
  // involved: 2,000 x 1.24 = 2,480, versus a flat-PIA reading of 2,000.
  describeRule('cfr-20-404-338-survivor-deceased-drc-pass-through', {
    note: 'deceased delayed retirement credits',
    readings: { deceasedDelayedCreditsIncluded: 2_480, flatPrimaryInsuranceAmount: 2_000 },
    accepted: 'deceasedDelayedCreditsIncluded',
  }, ({ accepted, readings }) => {
    it('carries the deceased worker’s delayed credits into the unreduced survivor amount', () => {
      const monthly = survivorBenefitMonthly({
        deceasedPiaMonthly: 2_000,
        deceasedActualMonthly: 2_480,
        survivorClaimAge: { years: 67, months: 0 },
        survivorFraMonths: SURVIVOR_FRA_1960,
      })

      expect(monthly).toBeCloseTo(accepted, 6)
      expect(monthly).not.toBeCloseTo(readings.flatPrimaryInsuranceAmount, 6)
    })
  })
})

describeRule('usc-42-402-q-1-widow-survivor-early-reduction-schedule', {
  // At 60, the 28.5 percent maximum reduction leaves 71.5 percent of a
  // 2,000-dollar deceased base: 2,000 x (1 - .285) = 1,430. The rejected
  // reading treats a survivor claim like a post-FRA claim and pays 2,000.
  readings: { statutoryAgeSixtyReduction: 1_430, noSurvivorAgeReduction: 2_000 },
  accepted: 'statutoryAgeSixtyReduction',
}, ({ accepted, readings }) => {
  it('reduces a non-disabled age-60 survivor to 71.5 percent of the base', () => {
    const monthly = survivorBenefitMonthly({
      deceasedPiaMonthly: 2_000,
      deceasedActualMonthly: 2_000,
      survivorClaimAge: age(60),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })

    expect(monthly).toBeCloseTo(accepted, 6)
    expect(monthly).not.toBeCloseTo(readings.noSurvivorAgeReduction, 6)
  })
})

describeRule('usc-42-402-q-1-widow-survivor-early-reduction-schedule', {
  // Claim 63 against FRA 792 months: months early = 36. The accepted reading
  // is the POMS varying fraction — the 28.5 percent maximum spread over the
  // 72-month period, 28.5% x 36/72 = 14.25 percent → 2,000 x .8575 = 1,715.
  // The rejected reading applies 402(q)(1)(A)'s literal 19/40 of 1 percent per
  // month, 0.475% x 36 = 17.1 percent → 2,000 x .829 = 1,658 — rejected on the
  // quoted POMS RS 00615.301 B.1.b authority that the maximum stays 28.5
  // percent and the monthly fraction varies with the period instead.
  note: 'midpoint claim at 63',
  readings: { pomsVaryingFractionMidpoint: 1_715, literalNineteenFortiethsPerMonth: 1_658 },
  accepted: 'pomsVaryingFractionMidpoint',
}, ({ accepted, readings }) => {
  it('prorates the widow reduction by the varying fraction at a midpoint before survivor FRA', () => {
    const monthly = survivorBenefitMonthly({
      deceasedPiaMonthly: 2_000,
      deceasedActualMonthly: 2_000,
      survivorClaimAge: age(63),
      survivorFraMonths: SURVIVOR_FRA_1951TO56,
    })

    expect(monthly).toBeCloseTo(accepted, 6)
    expect(monthly).not.toBeCloseTo(readings.literalNineteenFortiethsPerMonth, 6)
  })
})

describeRule('poms-rs-00615-320-rib-lim-after-survivor-reduction', {
  // POMS applies the limit only after the ordinary widow amount has been
  // reduced for age. At 63 with survivor FRA 66, the ordinary amount is
  // 2,000 x .8575 = 1,715, which exceeds both 1,400 and 82.5 percent of PIA
  // (1,650), so the statutory limit is 1,650. The rejected engine ordering
  // chooses 1,650 first and then applies the .8575 age factor. Its observed
  // amount is 1,650 x .8575 = 1,414.875.
  readings: {
    pomsLimitAfterSurvivorReduction: 1_650,
    engineReducesTheLimitAgain: 1_414.875,
  },
  accepted: 'pomsLimitAfterSurvivorReduction',
  produced: 'engineReducesTheLimitAgain',
}, ({ accepted, produced }) => {
  it('pins the engine’s pre-reduction RIB-LIM ordering', () => {
    const monthly = survivorBenefitMonthly({
      deceasedPiaMonthly: 2_000,
      deceasedActualMonthly: 1_400,
      survivorClaimAge: age(63),
      survivorFraMonths: SURVIVOR_FRA_1951TO56,
    })

    expect(monthly).toBeCloseTo(produced, 6)
    expect(monthly).not.toBeCloseTo(accepted, 6)
  })
})

// Section 416(l)(1) keys retirement age to the calendar year a person attains
// early retirement age, and (l)(2) sets that age at 60 for a widow(er). By
// hand, from the record's quoted spans, for effective birth years 1939-1962:
//   1939 and earlier: age 60 before 2000, (l)(1)(A): 65 = 780 months.
//   1940-1944: age 60 in 2000-2004, (l)(1)(B) with (l)(3)(A), two-twelfths of
//     the 12, 24, 36, 48, 60 months from January 2000: 65y2m ... 65y10m.
//   1945-1956: age 60 in 2005-2016, (l)(1)(C): 66 = 792.
//   1957-1961: age 60 in 2017-2021, (l)(1)(D) with (l)(3)(B): 66y2m ... 66y10m.
//   1962 and later: age 60 in 2022 or later, (l)(1)(E): 67 = 804.
// 20 CFR 404.409(b) prints the same rows by date of birth. The rejected
// reading is the table the engine kept until 2026-09-25: the early rows moved
// six birth years late (65y0m through 1945, 65y2m ... 65y10m for 1946-1950)
// and a cap at 66y8m from 1960 on.
const SURVIVOR_COHORTS = Array.from({ length: 24 }, (_, index) => 1939 + index)

describeRule('usc-42-416-l-survivor-fra-age-60-attainment-cohorts', {
  note: 'age-60 cohorts born 1939 to 1962',
  readings: {
    statutorySurvivorFraMonths: [
      780,
      782, 784, 786, 788, 790,
      792, 792, 792, 792, 792, 792, 792, 792, 792, 792, 792, 792,
      794, 796, 798, 800, 802,
      804,
    ],
    tableCappedAtSixtySixEightAndLateEarlyRows: [
      780,
      780, 780, 780, 780, 780,
      780, 782, 784, 786, 788, 790, 792, 792, 792, 792, 792, 792,
      794, 796, 798, 800, 800,
      800,
    ],
  },
  accepted: 'statutorySurvivorFraMonths',
}, ({ accepted, readings }) => {
  it('follows the statutory schedule for every cohort from 1939 to 1962', () => {
    const months = SURVIVOR_COHORTS.map((year) => fraTotalMonths(survivorFraForBirthYear(year)))

    expect(months).toEqual(accepted)
    expect(months).not.toEqual(readings.tableCappedAtSixtySixEightAndLateEarlyRows)
  })

  it('stays at 67 after 1962', () => {
    expect(fraTotalMonths(survivorFraForBirthYear(1970))).toBe(804)
    expect(fraTotalMonths(survivorFraForBirthYear(2026))).toBe(804)
  })
})

describeRule('usc-42-402-e-2-a-survivor-own-delay-no-drc', {
  // The deceased has no delayed credits in either reading. At survivor FRA or
  // later, the statute leaves the survivor rate at the 2,000-dollar base; the
  // rejected retirement-benefit reading adds 48 months of 2/3-percent credits
  // from FRA 66y0m through age 70, producing 2,000 x 1.32 = 2,640.
  readings: { survivorStopsAtTheBaseAtFra: 2_000, survivorEarnsOwnDrcsToSeventy: 2_640 },
  accepted: 'survivorStopsAtTheBaseAtFra',
}, ({ accepted, readings }) => {
  it('does not add credits when the survivor waits from FRA to 70', () => {
    const monthly = survivorBenefitMonthly({
      deceasedPiaMonthly: 2_000,
      deceasedActualMonthly: 2_000,
      survivorClaimAge: age(70),
      survivorFraMonths: SURVIVOR_FRA_1951TO56,
    })

    expect(monthly).toBeCloseTo(accepted, 6)
    expect(monthly).not.toBeCloseTo(readings.survivorEarnsOwnDrcsToSeventy, 6)
  })
})

describe('survivorReductionFactor', () => {
  it('is 1.0 at/after the survivor FRA', () => {
    expect(survivorReductionFactor(67 * 12, SURVIVOR_FRA_1960)).toBe(1)
    expect(survivorReductionFactor(70 * 12, SURVIVOR_FRA_1960)).toBe(1)
  })

  it('is 1.0 at the survivor FRA in months (66y8m for born 1960)', () => {
    // A survivor who claims in the very month of the survivor FRA is not
    // reduced.
    expect(survivorReductionFactor(66 * 12 + 8, SURVIVOR_FRA_1960)).toBe(1)
  })

  it('is reduced just below the survivor FRA (66y7m when FRA is 66y8m)', () => {
    expect(survivorReductionFactor(66 * 12 + 7, SURVIVOR_FRA_1960)).toBeLessThan(1)
  })

  it('applies the full 28.5% reduction at the earliest age (60)', () => {
    expect(survivorReductionFactor(SURVIVOR_EARLIEST_AGE * 12, SURVIVOR_FRA_1960)).toBeCloseTo(1 - SURVIVOR_MAX_REDUCTION, 10)
    expect(survivorReductionFactor(SURVIVOR_EARLIEST_AGE * 12, SURVIVOR_FRA_1960)).toBeCloseTo(0.715, 6)
  })

  it('clamps below 60 to the same floor', () => {
    expect(survivorReductionFactor(50 * 12, SURVIVOR_FRA_1960)).toBeCloseTo(0.715, 6)
  })

  it('reduces linearly at a midpoint between 60 and FRA', () => {
    // FRA 66y0m = 792 months; earliest 60y = 720 months. Age 63 = 756 months.
    // frac = (756 - 720) / (792 - 720) = 0.5 → reduction = 28.5% × 0.5 = 14.25% → factor 0.8575.
    expect(survivorReductionFactor(63 * 12, SURVIVOR_FRA_1951TO56)).toBeCloseTo(0.8575, 4)
  })

  it('uses the survivor FRA, not the retirement FRA', () => {
    // A 66-year-old survivor born 1960 is still below the 66y8m survivor FRA
    // and is reduced.
    expect(survivorReductionFactor(66 * 12, SURVIVOR_FRA_1960)).toBeLessThan(1)
    // But a 66-year-old whose survivor FRA is 66y0m (born 1951–56) is at FRA → 1.0.
    expect(survivorReductionFactor(66 * 12, SURVIVOR_FRA_1951TO56)).toBe(1)
  })
})

describe('survivorBenefitMonthly', () => {
  it('returns 0 when the deceased had no PIA', () => {
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: 0,
      deceasedActualMonthly: 0,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })).toBe(0)
  })

  it('is unreduced when claiming at exactly the survivor FRA (66y8m)', () => {
    const pia = 2000
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia,
      survivorClaimAge: age(66, 8),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })).toBeCloseTo(pia, 6)
  })

  it('floors the survivor at 82.5% of PIA (RIB-LIM) when the deceased claimed early', () => {
    // Deceased claimed at 62: actual = 70% of PIA. RIB-LIM floor = 82.5%.
    const pia = 2000
    const actual = pia * 0.70
    const atFra = survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: actual,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })
    expect(atFra).toBeCloseTo(WIDOW_LIMIT_PIA_FRACTION * pia, 6)
    expect(atFra).toBeGreaterThan(actual) // RIB-LIM lifts the survivor above the deceased's reduced benefit
  })

  it('applies the widow reduction on top of the RIB-LIM floor', () => {
    // Deceased claimed at 62 (70% PIA); survivor claims at 60.
    // base = max(70%, 82.5%) = 82.5% of PIA; × 0.715 = 58.9875% of PIA.
    const pia = 2000
    const actual = pia * 0.70
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: actual,
      survivorClaimAge: age(60),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })).toBeCloseTo(WIDOW_LIMIT_PIA_FRACTION * pia * 0.715, 6)
  })

  it('at survivor FRA: deceased claimed at FRA → 100% of PIA', () => {
    const pia = 2000
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })).toBeCloseTo(pia, 6)
  })

  it('is monotonic in the deceased PIA', () => {
    const claim = (pia: number) => survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia, // claimed at FRA
      survivorClaimAge: age(60),
      survivorFraMonths: SURVIVOR_FRA_1960,
    })
    expect(claim(1000)).toBeLessThanOrEqual(claim(2000))
    expect(claim(2000)).toBeLessThanOrEqual(claim(3000))
  })
})
