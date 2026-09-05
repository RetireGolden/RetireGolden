import { describe, expect, it } from 'vitest'

import { ssClaimMilestone } from '../insights/detectors/ssClaimMilestone.js'
import type { DetectorContext } from '../insights/types.js'
import { describeRule } from '../rules/describeRule.js'
import { singlePersonPlan } from '../testing/planFixtures.js'

import { claimFactor, spousalBenefitFactor } from './claimFactor.js'

// Born June 1960 -> SSA effective birth year 1960 -> FRA 67y0m.
const dob = { y: 1960, m: 6, d: 15 }

describe('spousal benefit and delayed credits', () => {
  // Compact prior-year comparator context for the public screen observation.
  // One 2026 row; published survivor amount is a given insight input (event
  // metadata), not an amount claimed as computed by the half-PIA helper.
  function halfPiaInsightContext(): DetectorContext {
    const plan = singlePersonPlan({ dob: '1956-01-01', planningAge: 95 })
    plan.household.people.push({
      id: 'p2',
      name: 'Sam',
      dob: '1956-01-01',
      sex: 'average',
      retirementAge: null,
      longevity: { planningAge: 69, source: 'manual' },
    })
    plan.household.filingStatus = 'marriedFilingJointly'
    plan.incomes = [
      {
        id: 'ss-claimant',
        type: 'socialSecurity',
        personId: 'p1',
        piaMonthly: 500,
        earnings: null,
        claimAge: { years: 67, months: 0 },
        formerSpouses: [
          {
            id: 'ex-deceased',
            relationship: 'deceased',
            dob: '1950-01-01',
            piaMonthly: 1025,
            marriageYears: 15,
            remarriedAtAge: 60,
          },
        ],
      },
      {
        id: 'ss-decedent',
        type: 'socialSecurity',
        personId: 'p2',
        piaMonthly: 2_000,
        earnings: null,
        claimAge: { years: 67, months: 0 },
      },
    ]
    return {
      plan,
      params: { year: 2026 },
      projection: {
        startYear: 2026,
        result: {
          years: [
            {
              year: 2026,
              people: [
                { personId: 'p1', ageAttained: 70, alive: true, lifeAge: 95 },
                { personId: 'p2', ageAttained: 70, alive: false, lifeAge: 69 },
              ],
              socialSecurityStreams: [
                {
                  personId: 'p1',
                  streamId: 'ss-claimant',
                  source: 'survivor',
                  annualAmount: 24_000,
                  claimInForce: true,
                  preWithholdingAnnual: 24_000,
                  isSpousalSurvivorGateStream: true,
                },
                {
                  personId: 'p2',
                  streamId: 'ss-decedent',
                  source: 'none',
                  annualAmount: 0,
                  claimInForce: false,
                  preWithholdingAnnual: 0,
                  isSpousalSurvivorGateStream: true,
                },
              ],
            },
          ],
        },
      },
    } as unknown as DetectorContext
  }

  // 42 U.S.C. 402(b)(2) measures the spousal benefit against the worker's
  // PRIMARY INSURANCE AMOUNT, not against what the worker actually collects.
  // The PIA does not grow with delay, so a spouse claiming after their own full
  // retirement age gains nothing -- the factor tops out at 1.
  //
  // Born 1960 (full retirement age 67), claiming at 70 is 36 months late:
  //   spousal:                        1.00
  //   retirement-style credits:  1 + 36 x 2/3 percent = 1.24
  //
  // Independent worksheet for the prior-year current-spouse comparator (same
  // statute: half of worker PIA, not worker actual). Both claimant p1 and
  // current worker p2 DOB 1956-01-01, age 70 in 2026, claim 67; p1 alive /
  // life 95, p2 dead-at-start / life 69. SSA Jan-1 rule → effective birth 1955
  // → FRA 66y2m. Own claim 67 is 10 DRC months at 2/3%/mo:
  //   claimant own 500 × (1 + 10×2/3%) = 533.333
  //   worker own 2000 × (1 + 10×2/3%) = 2133.333
  // Statutory current-spouse base 0.5 × 2000 × 1 = 1000; wrong worker-actual
  // base 0.5 × 2133.333 = 1066.667. Former deceased survivor PIA 1025 (DOB
  // 1950-01-01, marriage 15, remarried at 60 — ordinary-widow 9-month path
  // preserved) lies between. Family maximum 3553.70 leaves 1420.366 worker room,
  // so caps do not bind either auxiliary. Readings: statutory half-PIA prior
  // winner is former (deathAtStart false); worker-actual base makes current-
  // spouse the prior winner (deathAtStart true). Published 2026 p1 survivor
  // stream is a given insight input (triggering-event metadata), not claimed
  // as computed by the half-PIA helper; p2 publishes none.
  describeRule('usc-42-402-b-2-spousal-half-of-pia', {
    readings: {
      noDelayedCreditsOnSpousal: { lateSpouseFactor: 1, deathAtStart: false },
      retirementCreditsApplied: { lateSpouseFactor: 1.24, deathAtStart: false },
      workerActualBenefitAsBase: { lateSpouseFactor: 1, deathAtStart: true },
    },
    accepted: 'noDelayedCreditsOnSpousal',
  }, ({ accepted, readings }) => {
    it('stops growing at full retirement age', () => {
      const late = spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 })

      expect(late).toBeCloseTo(accepted.lateSpouseFactor, 10)
      expect(late).not.toBeCloseTo(readings.retirementCreditsApplied.lateSpouseFactor, 6)
      // The worker's own benefit does grow over the same span, which is what
      // makes the difference a rule rather than a rounding artefact.
      expect(claimFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 }))
        .toBeCloseTo(readings.retirementCreditsApplied.lateSpouseFactor, 6)

      const deathAtStart = ssClaimMilestone.screen(halfPiaInsightContext()) !== null
      expect(deathAtStart).toBe(accepted.deathAtStart)
      expect(deathAtStart).not.toBe(readings.workerActualBenefitAsBase.deathAtStart)
    })
  })
})

describe('claimFactor', () => {
  it('is 1 at FRA, reduced before, credited after', () => {
    expect(claimFactor(dob.y, dob.m, dob.d, { years: 67, months: 0 })).toBeCloseTo(1, 10)
    // 60 months early: 36×5/9% + 24×5/12% = 30% reduction.
    expect(claimFactor(dob.y, dob.m, dob.d, { years: 62, months: 0 })).toBeCloseTo(0.7, 10)
    // 36 months DRC at 2/3%/mo = 24%.
    expect(claimFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 })).toBeCloseTo(1.24, 10)
  })
})

describe('spousalBenefitFactor', () => {
  it('is 1 at FRA and never earns delayed credits', () => {
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 67, months: 0 })).toBeCloseTo(1, 10)
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 68, months: 0 })).toBe(1)
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 })).toBe(1)
  })

  it('reduces early claims on the steeper spousal schedule (25/36%/mo)', () => {
    // 36 months early: 36 × 25/36% = 25% reduction -> 0.75 (the classic spousal floor at 3 yrs early).
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 64, months: 0 })).toBeCloseTo(0.75, 10)
    // 60 months early: 36×25/36% + 24×5/12% = 25% + 10% = 35% -> 0.65.
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 62, months: 0 })).toBeCloseTo(0.65, 10)
  })

  it('is steeper than the retirement reduction for the same early claim', () => {
    const early = { years: 63, months: 0 }
    expect(spousalBenefitFactor(dob.y, dob.m, dob.d, early)).toBeLessThan(claimFactor(dob.y, dob.m, dob.d, early))
  })

  it('rejects out-of-range claim ages', () => {
    expect(() => spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 61, months: 0 })).toThrow()
    expect(() => spousalBenefitFactor(dob.y, dob.m, dob.d, { years: 71, months: 0 })).toThrow()
  })
})

describe('worker claim window', () => {
  // 42 U.S.C. 402(a)(2) requires attaining age 62 for entitlement, and
  // 402(w)(2)(A) accrues delayed retirement credit months only prior to the
  // month age 70 is attained. Under the accepted reading, claim ages outside
  // 62y0m-70y0m are refused. Under the rejected reading the window does not
  // exist and the factor keeps pricing: one month below the floor would price
  // 0.7 - 5/12% = 0.6958333..., one month above the ceiling 1.24 + 2/3% =
  // 1.2466666... - values the refusing implementation can never produce.
  describeRule('usc-42-402-worker-claim-window-62-to-70', {
    note: 'claim ages outside 62y0m-70y0m are refused, not priced',
    readings: {
      claimOutsideWindowRefused: 'RangeError',
      claimPricedBeyondWindow: [0.6958333333333333, 1.2466666666666666],
    },
    accepted: 'claimOutsideWindowRefused',
  }, ({ accepted, readings }) => {
    it('refuses one month below the floor and one month above the ceiling', () => {
      const below = () => claimFactor(dob.y, dob.m, dob.d, { years: 61, months: 11 })
      const above = () => claimFactor(dob.y, dob.m, dob.d, { years: 70, months: 1 })
      expect(below).toThrow(RangeError)
      expect(above).toThrow(RangeError)
      let name = ''
      try { below() } catch (err) { name = (err as Error).constructor.name }
      expect(name).toBe(accepted)
      // The refused ages never reach the pricing the rejected reading expects.
      const [beyondFloor, beyondCeiling] = readings.claimPricedBeyondWindow
      expect(claimFactor(dob.y, dob.m, dob.d, { years: 62, months: 0 }))
        .toBeGreaterThan(beyondFloor)
      expect(claimFactor(dob.y, dob.m, dob.d, { years: 70, months: 0 }))
        .toBeLessThan(beyondCeiling)
    })
  })
})
