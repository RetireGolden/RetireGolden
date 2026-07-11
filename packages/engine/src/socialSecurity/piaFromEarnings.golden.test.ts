import { describe, expect, it } from 'vitest'

import { expectMoney } from '../testing/money.js'
import {
  computePiaFromEarnings,
  eligibilityYearFromDobParts,
  isPiaFromEarningsError,
  piaMonthlyFromAime,
  type PiaFromEarningsResult,
} from './piaFromEarnings.js'

function compute(input: Parameters<typeof computePiaFromEarnings>[0]): PiaFromEarningsResult {
  const result = computePiaFromEarnings(input)
  if (isPiaFromEarningsError(result)) throw new Error(result.code)
  return result
}

/**
 * Atomic oracle tests for the PIA bend-point formula (Phase 1, calculation-test-plan.md).
 *
 * Worksheets follow the SSA monthly PIA formula
 * (https://www.ssa.gov/oact/COLA/piaformula.html) using the published 2016
 * eligibility-year bend points: first $856, second $5,157. PIA is floored to the
 * next lower dime. The bend-point table is pinned in ssaWageData.ts; these tests
 * verify the formula application, not the published bend points themselves.
 */
describe('PIA bend-point golden worksheets (2016 eligibility year)', () => {
  it('applies only the 90% band below the first bend point', () => {
    // 90% * 500 = 450.00.
    expectMoney(piaMonthlyFromAime(500, 2016), 450)
  })

  it('returns 90% of the first bend point exactly at the bend point', () => {
    // 90% * 856 = 770.40.
    expectMoney(piaMonthlyFromAime(856, 2016), 770.4)
  })

  it('adds the 32% band between bend points and floors to a dime', () => {
    // 90%*856 + 32%*(3,000-856) = 770.40 + 686.08 = 1,456.48 -> floor to dime 1,456.40.
    expectMoney(piaMonthlyFromAime(3_000, 2016), 1_456.4)
  })

  it('adds the 15% band above the second bend point and floors to a dime', () => {
    // 770.40 + 32%*(5,157-856) + 15%*(8,000-5,157)
    //   = 770.40 + 1,376.32 + 426.45 = 2,573.17 -> floor to dime 2,573.10.
    expectMoney(piaMonthlyFromAime(8_000, 2016), 2_573.1)
  })

  it('derives the eligibility year as effective-birth-year + 62 (Jan 1 rule)', () => {
    // Born July 1 1960 -> eligibility 2022.
    expectMoney(eligibilityYearFromDobParts(1960, 7, 1), 2022)
    // Born Jan 1 1960 -> SSA "attain age" rule treats it as 1959 -> eligibility 2021.
    expectMoney(eligibilityYearFromDobParts(1960, 1, 1), 2021)
  })
})

/**
 * AIME worksheets use a worker born 1954-07-01 (eligibility year 2016). Earnings
 * are placed only in 2014 (= eligibility year - 2) and 2015 (= eligibility year - 1),
 * where the wage-indexing factor is exactly 1 (2014 indexes to itself; 2015 is not
 * indexed), so the AIME is hand-auditable without applying AWI ratios. There are
 * always 40 base years (1976-2015); the lowest 5 drop out, leaving 35 computation
 * years (mostly zeros), so AIME = floor(sum of earnings / (12 * 35)).
 */
describe('AIME-from-earnings golden worksheets (born 1954-07-01, eligibility 2016)', () => {
  it('zero-fills sparse earnings across the 35 computation years', () => {
    // 50,400 in 2014 and 2015; 33 zero-fill years. Sum 100,800 / 420 = 240.
    const r = compute({
      dobYear: 1954,
      dobMonth: 7,
      dobDay: 1,
      earnings: [
        { year: 2014, amount: 50_400 },
        { year: 2015, amount: 50_400 },
      ],
      lastEarningsYear: 2015,
    })
    expect(r.eligibilityYear).toBe(2016)
    expect(r.computationYearCount).toBe(35)
    expect(r.projectedYearCount).toBe(0)
    expect(r.aime).toBe(240)
    // PIA: 240 < first bend point 856 -> 90% * 240 = 216.00.
    expectMoney(r.piaMonthly, 216)
  })

  it('caps a single high-earnings year at that year wage base', () => {
    // 150,000 reported in 2015, capped at the 2015 wage base 118,500.
    // AIME = floor(118,500 / 420) = 282 (uncapped would be floor(150,000/420) = 357).
    const r = compute({
      dobYear: 1954,
      dobMonth: 7,
      dobDay: 1,
      earnings: [{ year: 2015, amount: 150_000 }],
      lastEarningsYear: 2015,
    })
    expect(r.aime).toBe(282)
    // PIA: 90% * 282 = 253.80.
    expectMoney(r.piaMonthly, 253.8)
  })

  it('fills projected future years and caps them at the wage base', () => {
    // Reported 50,400 in 2014; project 150,000 for 2015 (capped at 118,500).
    // Sum 50,400 + 118,500 = 168,900 / 420 = floor(402.14) = 402.
    const r = compute({
      dobYear: 1954,
      dobMonth: 7,
      dobDay: 1,
      earnings: [{ year: 2014, amount: 50_400 }],
      lastEarningsYear: 2014,
      projection: { assumedAnnualEarnings: 150_000, throughAge: 62 },
    })
    expect(r.projectedYearCount).toBe(1)
    expect(r.aime).toBe(402)
    // PIA: 90% * 402 = 361.80.
    expectMoney(r.piaMonthly, 361.8)
  })
})
