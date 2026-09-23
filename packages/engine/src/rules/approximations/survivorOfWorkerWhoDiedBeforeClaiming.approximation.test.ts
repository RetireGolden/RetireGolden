/**
 * Pins usc-42-402-e-survivor-of-worker-who-died-before-claiming on the public
 * path createEmptyPlan (via couplePlan) -> parsePlan (via validatePlan) ->
 * simulatePlan, so one pin covers both halves of the record: when the
 * survivor amount starts (annualSocialSecurity's step-up waits for the dead
 * worker's configured claim year, via annualSocialSecurityPayableMonths) and
 * what it is priced on (claimFactor at that configured age, then
 * survivorBenefitMonthly's 82.5 percent floor). The produced vectors were
 * observed on this path, not predicted from the helpers.
 *
 * Common facts. Start year 2026, no cost-of-living adjustment and no benefit
 * haircut (couplePlan's defaults), so every figure is in 2026 dollars. The
 * worker p2 is born 1962-01-15: PIA 2,000, retirement full retirement age 67
 * (attains 62 in 2024, 42 U.S.C. 416(l)(1)(E)), so the FRA month is January
 * 2029. The survivor p1 is born 1960-01-15: own PIA 600, configured claim age
 * 67; her survivor FRA is 66y8m (attains 60 in 2020, 416(l)(1)(D) and
 * (l)(3)(B): 2/12 x 48 months = 8), reached in September 2026.
 *
 * Death. The engine keeps a person alive through the calendar year in which
 * the planning age is attained, so planning age 64 leaves the worker alive
 * all of 2026 and dead from January 2027. The matching statutory death month
 * is December 2026 (worker 64y11m, survivor 66y11m). The December 2026
 * payment falls outside the engine's whole-year counting and is not pinned;
 * the vectors run 2027 through 2032.
 *
 * Authority worksheet (by hand, from the record's quoted spans):
 * - Start. 402(e)(1) entitles the widow from the first month in which she is
 *   entitled; nothing in it waits for the worker's planned claim. She is past
 *   survivor FRA, so no month is age-reduced and 20 CFR 404.621(a)(2) lets an
 *   application filed by June 2027 reach back to December 2026.
 * - Base. 402(e)(2)(A): the PIA, 2,000. (C) and 20 CFR 404.313(e)(1) count
 *   delayed credits only through the month before death; the worker died
 *   before his FRA month, so there are none. (D) needs an old-age benefit the
 *   worker was once entitled to in reduced form, and he never claimed, so no
 *   early-claim reduction and no 82.5 percent limit. No 402(q) reduction on
 *   her side either: she is past survivor FRA.
 * - Payable. From January 2027 her own 600 offsets the widow's benefit under
 *   402(k)(3)(A) (usc-42-402-k-3-a-survivor-own-dual-entitlement-offset), so
 *   the monthly total is 2,000 in every year from 2027 through 2032.
 *
 * Case A, configured claim 70. Engine: the dead worker's amount is recorded
 * only from 2032, the year he would attain 70, at 2,000 x claimFactor(70y0m)
 * = 2,000 x (1 + 36 x 2/3 percent) = 2,480. Until then the step-up has
 * nothing to compare, so she keeps her own 600 for 2027-2031.
 *
 * Case A2, configured claim 65, the same death. Engine: recorded from 2027 at
 * 2,000 x claimFactor(65y0m) = 2,000 x (1 - 24 x 5/9 percent) = 1,733.33,
 * above the 1,650 floor, for life. The statute is unchanged: 2,000.
 */
import { expect, it } from 'vitest'

import { describeRule } from '../describeRule.js'
import { simulatePlan } from '../../projection/simulate.js'
import { createFlatTaxCalculator } from '../../testing/flatTax.js'
import {
  couplePlan,
  socialSecurityIncome,
  validatePlan,
} from '../../testing/planFixtures.js'

const YEARS = [2027, 2028, 2029, 2030, 2031, 2032] as const

/** The survivor stream's monthly amount in each of YEARS, rounded to the cent. */
function survivorMonthlyByYear(workerClaimAge: number): number[] {
  const plan = couplePlan({
    p1Dob: '1960-01-15',
    p2Dob: '1962-01-15',
    p1PlanningAge: 95,
    p2PlanningAge: 64,
  })
  plan.incomes = [
    socialSecurityIncome('ss-survivor', 600, 67, 'p1'),
    socialSecurityIncome('ss-worker', 2_000, workerClaimAge, 'p2'),
  ]
  const result = simulatePlan(validatePlan(plan), {
    startYear: 2026,
    taxCalculator: createFlatTaxCalculator(0),
  })
  return YEARS.map((year) => {
    const row = result.years.find((candidate) => candidate.year === year)
    if (row === undefined) throw new Error('no projection row for ' + year)
    // The facts the worksheet assumes, checked rather than trusted: the
    // worker is dead and the survivor alive in every pinned year.
    const worker = row.people.find((person) => person.personId === 'p2')
    const survivor = row.people.find((person) => person.personId === 'p1')
    expect(worker?.alive, 'worker alive in ' + year).toBe(false)
    expect(survivor?.alive, 'survivor alive in ' + year).toBe(true)
    const stream = (row.socialSecurityStreams ?? []).find((candidate) => candidate.streamId === 'ss-survivor')
    if (stream === undefined) throw new Error('no survivor stream row for ' + year)
    return Math.round((stream.annualAmount / 12) * 100) / 100
  })
}

describeRule('usc-42-402-e-survivor-of-worker-who-died-before-claiming', {
  note: 'worker dies at 64 with a configured claim age of 70',
  readings: {
    statutePaysThePiaFromTheDeath: [2_000, 2_000, 2_000, 2_000, 2_000, 2_000],
    engineWaitsForTheConfiguredClaimAgeAndPricesItThere: [600, 600, 600, 600, 600, 2_480],
  },
  accepted: 'statutePaysThePiaFromTheDeath',
  produced: 'engineWaitsForTheConfiguredClaimAgeAndPricesItThere',
}, ({ accepted, produced }) => {
  it('pays her own 600 until the year the worker would have turned 70, then his age-70 amount of 2,480', () => {
    const monthly = survivorMonthlyByYear(70)

    expect(monthly).toEqual(produced)
    expect(monthly).not.toEqual(accepted)
  })
})

describeRule('usc-42-402-e-survivor-of-worker-who-died-before-claiming', {
  note: 'worker dies at 64 with a configured claim age of 65',
  readings: {
    statutePaysTheWholePia: [2_000, 2_000, 2_000, 2_000, 2_000, 2_000],
    engineReducesForAClaimNeverMade: [1_733.33, 1_733.33, 1_733.33, 1_733.33, 1_733.33, 1_733.33],
  },
  accepted: 'statutePaysTheWholePia',
  produced: 'engineReducesForAClaimNeverMade',
}, ({ accepted, produced }) => {
  it('prices the survivor base at the age-65 early-claim factor the worker never took', () => {
    const monthly = survivorMonthlyByYear(65)

    expect(monthly).toEqual(produced)
    expect(monthly).not.toEqual(accepted)
  })
})
