/**
 * Pins usc-42-402-e-survivor-of-worker-who-died-before-claiming on the public
 * path createEmptyPlan (via couplePlan) -> parsePlan (via validatePlan) ->
 * simulatePlan, so one pin covers both halves of the record: when the
 * survivor amount starts (the first year after the death, whatever claim age
 * the plan configured for the worker) and what it is priced on
 * (survivorBenefit.ts#neverClaimedDeceasedFactor: the PIA plus the credits
 * earned up to the death, with no early-claim reduction).
 *
 * Common facts. Start year 2026, no cost-of-living adjustment and no benefit
 * haircut (couplePlan's defaults), so every figure is in 2026 dollars. The
 * worker p2 is born 1962-01-15: PIA 2,000, retirement full retirement age 67
 * (attains 62 in 2024, 42 U.S.C. 416(l)(1)(E)), so the FRA month is January
 * 2029 and he attains 70 in January 2032. The survivor p1 is born 1960-01-15:
 * own PIA 600, configured claim age 67; her survivor FRA is 66y8m (attains 60
 * in 2020, 416(l)(1)(D) and (l)(3)(B): 2/12 x 48 months = 8), reached in
 * September 2026, so no survivor year below is reduced for her age.
 *
 * Death. The engine keeps a person alive through the calendar year in which
 * the planning age is attained, so planning age 64 leaves the worker alive
 * all of 2026 and dead from January 2027. The matching statutory death month
 * is December 2026. The December payment falls outside the engine's
 * whole-year counting and is not pinned.
 *
 * Authority worksheet (by hand, from the record's quoted spans):
 * - Start. 402(e)(1) entitles the widow from the first month in which she is
 *   entitled; nothing in it waits for the worker's planned claim. She is past
 *   survivor FRA, so no month is age-reduced and 20 CFR 404.621(a)(2) lets an
 *   application filed within six months reach back to the death month.
 * - Base. 402(e)(2)(A): the PIA, 2,000. (C) and 20 CFR 404.313(e)(1) count
 *   delayed credits only through the month before death. (D) needs an
 *   old-age benefit the worker was once entitled to in reduced form, and he
 *   never claimed, so no early-claim reduction and no 82.5 percent limit.
 * - Payable. Her own 600 offsets the widow's benefit under 402(k)(3)(A)
 *   (usc-42-402-k-3-a-survivor-own-dual-entitlement-offset), so the monthly
 *   total is the survivor amount.
 *
 * Case A, death at 64 (December 2026), configured claim 70: died before the
 * FRA month, no credits, 2,000 a month from 2027. The rejected reading, the
 * engine before 2026-09-25, waited for the configured claim year: her own 600
 * for 2027-2031, then 2,000 x claimFactor(70y0m) = 2,480 from 2032.
 *
 * Case A2, the same death, configured claim 65: still 2,000. The rejected
 * reading priced a claim never made: 2,000 x claimFactor(65y0m) = 2,000 x
 * (1 - 24 x 5/9 percent) = 1,733.33.
 *
 * Case B, death at 69 (December 2031), configured claim 70: credits from
 * January 2029 through November 2031, 35 months, 2,000 x (1 + 35 x 2/3
 * percent) = 2,466.67 from 2032. The rejected reading counted the 36 months
 * to 70: 2,480. In 2031 the worker is alive and has not claimed, so she has
 * her own 600.
 *
 * Case C, a disability onset the worker never reached: onset age 66 but
 * death at 62 (December 2024, before the projection starts). He was never
 * entitled to disability or retirement benefits, so the base is the PIA,
 * 2,000, from 2027, the first year her own configured claim age (67) lets
 * her be paid. The rejected reading paid nothing until the dead worker's
 * onset year (2028), leaving her own 600 for 2027.
 */
import { describe, expect, it } from 'vitest'

import { describeRule } from '../rules/describeRule.js'
import { simulatePlan } from './simulate.js'
import { neverClaimedDeceasedFactor } from '../socialSecurity/survivorBenefit.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import {
  couplePlan,
  socialSecurityIncome,
  validatePlan,
} from '../testing/planFixtures.js'
import type { IncomeStream } from '../model/plan.js'

/** The survivor stream's monthly amount in each of `years`, rounded to the cent. */
function survivorMonthlyByYear(
  workerPlanningAge: number,
  workerStream: IncomeStream,
  years: readonly number[],
): number[] {
  const plan = couplePlan({
    p1Dob: '1960-01-15',
    p2Dob: '1962-01-15',
    p1PlanningAge: 95,
    p2PlanningAge: workerPlanningAge,
  })
  plan.incomes = [socialSecurityIncome('ss-survivor', 600, 67, 'p1'), workerStream]
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    taxCalculator: createFlatTaxCalculator(0),
  })
  return years.map((year) => {
    const row = result.years.find((candidate) => candidate.year === year)
    if (row === undefined) throw new Error('no projection row for ' + year)
    const survivor = row.people.find((person) => person.personId === 'p1')
    expect(survivor?.alive, 'survivor alive in ' + year).toBe(true)
    const stream = (row.socialSecurityStreams ?? []).find((candidate) => candidate.streamId === 'ss-survivor')
    if (stream === undefined) throw new Error('no survivor stream row for ' + year)
    return Math.round((stream.annualAmount / 12) * 100) / 100
  })
}

const workerDeadIn = (workerPlanningAge: number, year: number): boolean => 1962 + workerPlanningAge < year

describeRule('usc-42-402-e-survivor-of-worker-who-died-before-claiming', {
  note: 'worker dies at 64 with a configured claim age of 70',
  readings: {
    statutePaysThePiaFromTheYearAfterTheDeath: [2_000, 2_000, 2_000, 2_000, 2_000, 2_000],
    waitsForTheConfiguredClaimAgeAndPricesItThere: [600, 600, 600, 600, 600, 2_480],
  },
  accepted: 'statutePaysThePiaFromTheYearAfterTheDeath',
}, ({ accepted, readings }) => {
  it('pays the 2,000 PIA from 2027, not her own 600 until the year he would have turned 70', () => {
    const years = [2027, 2028, 2029, 2030, 2031, 2032]
    expect(years.every((year) => workerDeadIn(64, year))).toBe(true)
    const monthly = survivorMonthlyByYear(64, socialSecurityIncome('ss-worker', 2_000, 70, 'p2'), years)

    expect(monthly).toEqual(accepted)
    expect(monthly).not.toEqual(readings.waitsForTheConfiguredClaimAgeAndPricesItThere)
  })
})

describeRule('usc-42-402-e-survivor-of-worker-who-died-before-claiming', {
  note: 'worker dies at 64 with a configured claim age of 65',
  readings: {
    statutePaysTheWholePia: [2_000, 2_000, 2_000],
    reducesForAClaimNeverMade: [1_733.33, 1_733.33, 1_733.33],
  },
  accepted: 'statutePaysTheWholePia',
}, ({ accepted, readings }) => {
  it('applies no early-claim reduction for a claim the worker never made', () => {
    const monthly = survivorMonthlyByYear(64, socialSecurityIncome('ss-worker', 2_000, 65, 'p2'), [2027, 2028, 2029])

    expect(monthly).toEqual(accepted)
    expect(monthly).not.toEqual(readings.reducesForAClaimNeverMade)
  })
})

describeRule('usc-42-402-e-survivor-of-worker-who-died-before-claiming', {
  note: 'worker dies at 69 with a configured claim age of 70',
  readings: {
    statuteCountsCreditsToTheMonthBeforeDeath: [600, 2_466.67, 2_466.67],
    countsCreditsToTheConfiguredClaimAge: [600, 2_480, 2_480],
  },
  accepted: 'statuteCountsCreditsToTheMonthBeforeDeath',
}, ({ accepted, readings }) => {
  it('counts the 35 credits earned through November 2031, not the 36 to age 70', () => {
    expect(workerDeadIn(69, 2031)).toBe(false)
    expect(workerDeadIn(69, 2032)).toBe(true)
    const monthly = survivorMonthlyByYear(69, socialSecurityIncome('ss-worker', 2_000, 70, 'p2'), [2031, 2032, 2033])

    expect(monthly).toEqual(accepted)
    expect(monthly).not.toEqual(readings.countsCreditsToTheConfiguredClaimAge)
  })
})

describeRule('usc-42-402-e-survivor-of-worker-who-died-before-claiming', {
  note: 'worker dies at 62 before a configured disability onset at 66',
  readings: {
    statutePaysThePiaInEveryYear: [2_000, 2_000, 2_000],
    waitsForTheDeadWorkersOnsetYear: [600, 2_000, 2_000],
  },
  accepted: 'statutePaysThePiaInEveryYear',
}, ({ accepted, readings }) => {
  it('pays the PIA from her first claim year, not from the onset year he never reached', () => {
    const worker = {
      ...socialSecurityIncome('ss-worker', 2_000, 67, 'p2'),
      disability: { onsetAge: 66 },
    } as IncomeStream
    const monthly = survivorMonthlyByYear(62, worker, [2027, 2028, 2029])

    expect(monthly).toEqual(accepted)
    expect(monthly).not.toEqual(readings.waitsForTheDeadWorkersOnsetYear)
  })
})

describe('neverClaimedDeceasedFactor', () => {
  const jan15 = { year: 1962, month: 1, day: 15 }

  it('is 1 for a death before the full-retirement-age month', () => {
    expect(neverClaimedDeceasedFactor(jan15, 2026, 12)).toBe(1)
    // The FRA month itself (January 2029) is not yet a credit month.
    expect(neverClaimedDeceasedFactor(jan15, 2029, 1)).toBe(1)
  })

  it('counts one credit per month from the FRA month to the month before death', () => {
    expect(neverClaimedDeceasedFactor(jan15, 2029, 2)).toBeCloseTo(1 + (2 / 3) / 100, 12)
    expect(neverClaimedDeceasedFactor(jan15, 2031, 12)).toBeCloseTo(1 + (35 * 2 / 3) / 100, 12)
  })

  it('stops before the month the worker attains 70', () => {
    // Attains 70 in January 2032: 36 credits, January 2029 through December 2031.
    expect(neverClaimedDeceasedFactor(jan15, 2032, 1)).toBeCloseTo(1.24, 12)
    expect(neverClaimedDeceasedFactor(jan15, 2033, 12)).toBeCloseTo(1.24, 12)
  })

  it('counts ages as SSA does for a birthday on the 1st', () => {
    // Born 1962-01-01: attains each age on December 31, a month earlier than
    // a mid-January birthday. The effective birth year is 1961, past the
    // ramp, so FRA is 67, reached in December 2028, and 70 is reached in
    // December 2031: a death in December 2031 earns 36 credits (December 2028
    // through November 2031) where the January 15 birthday above earns 35.
    const jan1 = { year: 1962, month: 1, day: 1 }
    expect(neverClaimedDeceasedFactor(jan1, 2028, 12)).toBe(1)
    expect(neverClaimedDeceasedFactor(jan1, 2029, 1)).toBeCloseTo(1 + (2 / 3) / 100, 12)
    expect(neverClaimedDeceasedFactor(jan1, 2031, 12)).toBeCloseTo(1.24, 12)
  })
})
