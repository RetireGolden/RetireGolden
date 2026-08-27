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

// The engine's current survivor FRA for born 1962+ is 66y8m = 66*12 + 8 = 800 months.
const SURVIVOR_FRA_1962PLUS = 66 * 12 + 8
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
        survivorFraMonths: SURVIVOR_FRA_1962PLUS,
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
        survivorFraMonths: SURVIVOR_FRA_1962PLUS,
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
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })

    expect(monthly).toBeCloseTo(accepted, 6)
    expect(monthly).not.toBeCloseTo(readings.noSurvivorAgeReduction, 6)
  })
})

describeRule('usc-42-402-q-1-widow-survivor-early-reduction-schedule', {
  // Claim 63 against FRA 792 months: months early = 36. Statutory reduction is
  // 19/40 of 1 percent x 36 months = 14.25 percent → 2,000 x .8575 = 1,715.
  // The rejected flat-maximum reading applies the full 28.5 percent whenever
  // the claim is early and pays 2,000 x .715 = 1,430.
  note: 'midpoint claim at 63',
  readings: { statutoryLinearMidpoint: 1_715, flatMaximumWheneverEarly: 1_430 },
  accepted: 'statutoryLinearMidpoint',
}, ({ accepted, readings }) => {
  it('prorates the widow reduction linearly at a midpoint before survivor FRA', () => {
    const monthly = survivorBenefitMonthly({
      deceasedPiaMonthly: 2_000,
      deceasedActualMonthly: 2_000,
      survivorClaimAge: age(63),
      survivorFraMonths: SURVIVOR_FRA_1951TO56,
    })

    expect(monthly).toBeCloseTo(accepted, 6)
    expect(monthly).not.toBeCloseTo(readings.flatMaximumWheneverEarly, 6)
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

describeRule('usc-42-416-l-survivor-fra-age-60-attainment-cohorts', {
  // A 1962 survivor attains the section 416(l)(2) early-retirement age of 60
  // in 2022, so section 416(l)(1)(E) yields 67 years = 804 months. The
  // rejected engine schedule observably returns 66y8m = 800 months.
  // A 1961 survivor attains 60 in 2021, so 416(l)(1)(D) + (l)(3)(B):
  // 2/12 × 60 months = 10 → statutory 66y10m = 802 months. The engine table
  // still caps at 66y8m = 800, so a blanket-67 repair cannot go green while
  // 1961 stays wrong.
  readings: {
    statutory1962SurvivorFraMonths: 804,
    statutory1961SurvivorFraMonths: 802,
    engineCappedAtSixtySixEight: 800,
  },
  accepted: 'statutory1962SurvivorFraMonths',
  produced: 'engineCappedAtSixtySixEight',
}, ({ accepted, produced, readings }) => {
  it('pins the separate survivor-FRA table for the 1962 age-60 cohort', () => {
    const months = fraTotalMonths(survivorFraForBirthYear(1962))

    expect(months).toBe(produced)
    expect(months).not.toBe(accepted)
  })

  it('pins the 1961 age-60 cohort at the engine’s 66y8m cap, not statutory 66y10m', () => {
    const months = fraTotalMonths(survivorFraForBirthYear(1961))

    expect(months).toBe(produced)
    expect(months).not.toBe(readings.statutory1961SurvivorFraMonths)
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
    expect(survivorReductionFactor(67 * 12, SURVIVOR_FRA_1962PLUS)).toBe(1)
    expect(survivorReductionFactor(70 * 12, SURVIVOR_FRA_1962PLUS)).toBe(1)
  })

  it('is 1.0 at the current engine-table survivor FRA in months (66y8m for born 1962+)', () => {
    // The current-table boundary is 66y8m. The statutory 1962+ correction is
    // deliberately pinned separately as an approximation above.
    expect(survivorReductionFactor(66 * 12 + 8, SURVIVOR_FRA_1962PLUS)).toBe(1)
  })

  it('is reduced just below the survivor FRA (66y7m when FRA is 66y8m)', () => {
    expect(survivorReductionFactor(66 * 12 + 7, SURVIVOR_FRA_1962PLUS)).toBeLessThan(1)
  })

  it('applies the full 28.5% reduction at the earliest age (60)', () => {
    expect(survivorReductionFactor(SURVIVOR_EARLIEST_AGE * 12, SURVIVOR_FRA_1962PLUS)).toBeCloseTo(1 - SURVIVOR_MAX_REDUCTION, 10)
    expect(survivorReductionFactor(SURVIVOR_EARLIEST_AGE * 12, SURVIVOR_FRA_1962PLUS)).toBeCloseTo(0.715, 6)
  })

  it('clamps below 60 to the same floor', () => {
    expect(survivorReductionFactor(50 * 12, SURVIVOR_FRA_1962PLUS)).toBeCloseTo(0.715, 6)
  })

  it('reduces linearly at a midpoint between 60 and FRA', () => {
    // FRA 66y0m = 792 months; earliest 60y = 720 months. Age 63 = 756 months.
    // frac = (756 - 720) / (792 - 720) = 0.5 → reduction = 28.5% × 0.5 = 14.25% → factor 0.8575.
    expect(survivorReductionFactor(63 * 12, SURVIVOR_FRA_1951TO56)).toBeCloseTo(0.8575, 4)
  })

  it('uses the current engine survivor FRA, not the retirement FRA', () => {
    // Under the current engine table, a 66-year-old survivor is still below
    // 66y8m and is reduced; the statutory 1962+ schedule is separately pinned.
    expect(survivorReductionFactor(66 * 12, SURVIVOR_FRA_1962PLUS)).toBeLessThan(1)
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
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBe(0)
  })

  it('is unreduced when claiming at exactly the survivor FRA (66y8m)', () => {
    const pia = 2000
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia,
      survivorClaimAge: age(66, 8),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
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
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
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
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBeCloseTo(WIDOW_LIMIT_PIA_FRACTION * pia * 0.715, 6)
  })

  it('at survivor FRA: deceased claimed at FRA → 100% of PIA', () => {
    const pia = 2000
    expect(survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia,
      survivorClaimAge: age(67),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })).toBeCloseTo(pia, 6)
  })

  it('is monotonic in the deceased PIA', () => {
    const claim = (pia: number) => survivorBenefitMonthly({
      deceasedPiaMonthly: pia,
      deceasedActualMonthly: pia, // claimed at FRA
      survivorClaimAge: age(60),
      survivorFraMonths: SURVIVOR_FRA_1962PLUS,
    })
    expect(claim(1000)).toBeLessThanOrEqual(claim(2000))
    expect(claim(2000)).toBeLessThanOrEqual(claim(3000))
  })
})
