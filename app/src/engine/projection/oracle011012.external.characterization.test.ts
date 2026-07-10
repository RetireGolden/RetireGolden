import { describe, expect, it } from 'vitest'

import {
  cashAccount,
  singlePersonPlan,
  traditionalAccount,
  validatePlan,
} from '../../testSupport/planFixtures'
import { createFederalTaxCalculator } from '../tax/federalTax'
import { summarizeProjection } from './compare'
import { optimizePlan, withOptimizedConversions } from './optimizePlan'
import { simulatePlan } from './simulate'
import type { YearResult } from './types'

const federal = createFederalTaxCalculator()
const opts = { startYear: 2026, taxCalculator: federal }

function dollars(value: number): number {
  return Math.round(value * 100) / 100
}

function picked(y: YearResult) {
  return {
    year: y.year,
    age: y.people[0]!.ageAttained,
    withdrawals: dollars(y.withdrawals.total),
    traditionalWithdrawals: dollars(y.withdrawals.traditional),
    cashWithdrawals: dollars(y.withdrawals.cash),
    rmd: dollars(y.rmd),
    rothConversion: dollars(y.rothConversion),
    tax: dollars(y.tax),
    magi: dollars(y.magi),
    investable: dollars(y.investableTotal),
    traditional: dollars(y.balances.trad ?? y.balances.ira ?? 0),
    roth: dollars(y.balances.roth ?? 0),
    cash: dollars(y.balances.cash ?? 0),
    shortfall: dollars(y.shortfall),
  }
}

/**
 * ORACLE-011 (external-oracle-comparisons.md) - optimizer direction vs Owl.
 *
 * Oracle: Owl - Optimal wealth lab (https://github.com/mdlacasse/Owl)
 * Commit: 266c87b96e5dcd672a236026fb1fdc9a0ec11a7e
 * Source fixture: examples/Case_chris+pat.toml description.
 * Access date: 2026-06-30. License note: Owl source is GPLv3; this test uses
 * Owl as a black-box benchmark only and copies no code or formulas.
 *
 * Oracle output:
 *   The public chris+pat case documents roughly $300k of Roth conversions in
 *   the early low-income window before Social Security and RMDs arrive.
 *
 * Comparable RetireGolden output:
 *   RetireGolden's optimizer objective, annual timing, and tax model are not
 *   identical to Owl's, so exact per-year conversion dollars are intentionally
 *   not asserted against Owl. The comparable assertions are directional:
 *   (1) conversions are proposed in the low-income pre-RMD bridge years,
 *   (2) bridge-year conversions dominate RMD-year conversions, and
 *   (3) the accepted schedule is judged by RetireGolden's exact ledger, where it
 *   must not reduce the ending after-tax estate versus no conversions.
 */
describe('ORACLE-011: Roth bridge optimizer direction vs Owl', () => {
  it('front-loads bridge-year conversions and preserves the exact-ledger estate', async () => {
    const plan = singlePersonPlan({ dob: '1958-06-15', planningAge: 75, state: 'FL' })
    plan.accounts = [
      {
        type: 'traditional',
        id: 'trad',
        name: 'Traditional IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 500_000,
        annualContribution: 0,
      },
      {
        type: 'roth',
        id: 'roth',
        name: 'Roth IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 0,
        annualContribution: 0,
      },
      cashAccount('cash', 150_000),
    ]
    plan.expenses.baseAnnual = 35_000
    plan.assumptions.defaultReturnPct = 4
    plan.assumptions.heirTaxRatePct = 25

    const valid = validatePlan(plan)
    const baselineResult = simulatePlan(valid, opts)
    const baseline = summarizeProjection(valid, baselineResult)

    const { schedule } = await optimizePlan(valid, opts)
    const optimizedPlan = validatePlan(
      withOptimizedConversions(valid, schedule.conversions, '2026-06-30T00:00:00.000Z'),
    )
    const exactResult = simulatePlan(optimizedPlan, opts)
    const exact = summarizeProjection(optimizedPlan, exactResult)

    const rmdStartYear = 1958 + 73
    const bridgeRequested = schedule.conversions
      .filter((c) => c.year < rmdStartYear)
      .reduce((sum, c) => sum + c.amount, 0)
    const rmdYearRequested = schedule.conversions
      .filter((c) => c.year >= rmdStartYear)
      .reduce((sum, c) => sum + c.amount, 0)
    const baselineRmd = baselineResult.years.reduce((sum, y) => sum + y.rmd, 0)
    const exactRmd = exactResult.years.reduce((sum, y) => sum + y.rmd, 0)

    expect(schedule.status).toBe('optimal')
    expect(bridgeRequested).toBeGreaterThan(0)
    expect(bridgeRequested).toBeGreaterThan(rmdYearRequested)
    expect(exact.lifetimeRothConversions).toBeGreaterThan(0)
    expect(exact.endingAfterTaxEstate).toBeGreaterThanOrEqual(baseline.endingAfterTaxEstate - 1)
    expect(exactRmd).toBeLessThan(baselineRmd)

    expect({
      requestedConversions: dollars(schedule.conversions.reduce((sum, c) => sum + c.amount, 0)),
      bridgeRequested: dollars(bridgeRequested),
      rmdYearRequested: dollars(rmdYearRequested),
      exactConversions: dollars(exact.lifetimeRothConversions),
      baselineEstate: dollars(baseline.endingAfterTaxEstate),
      exactEstate: dollars(exact.endingAfterTaxEstate),
      baselineRmd: dollars(baselineRmd),
      exactRmd: dollars(exactRmd),
      firstConversions: schedule.conversions.slice(0, 5).map((c) => ({
        year: c.year,
        amount: dollars(c.amount),
      })),
    }).toEqual({
      // Re-baselined for the OBBBA senior deduction in-solve (ground-truth
      // 2026 law sync, Step 2): 2027–28 bridge conversions fill the 12%
      // bracket plus the $6k senior deduction (74,550 = 50,400 + 24,150); the
      // exact-ledger estate improved ~$1.2k over the deduction-blind solve.
      requestedConversions: 538_917.7,
      bridgeRequested: 348_881.5,
      rmdYearRequested: 190_036.2,
      exactConversions: 423_639.46,
      baselineEstate: 381_703.4,
      exactEstate: 444_059.14,
      baselineRmd: 64_428.89,
      exactRmd: 5_393.75,
      firstConversions: [
        { year: 2026, amount: 62_681.5 },
        { year: 2027, amount: 74_550 },
        { year: 2028, amount: 74_550 },
        { year: 2029, amount: 68_550 },
        { year: 2030, amount: 68_550 },
      ],
    })
  })
})

/**
 * ORACLE-012 (external-oracle-comparisons.md) - five-year RMD bridge.
 *
 * Oracle: hand worksheet from IRS Pub 590-B Uniform Lifetime divisors and the
 * RetireGolden 2026 federal pack. No external software is needed because the
 * scenario is deliberately small: zero return, zero inflation, no state tax, no
 * Social Security, no ACA, and RMDs remain below the senior standard deduction,
 * so federal income tax is $0 in every year. RetireGolden still includes standard
 * Medicare Part B for the age-65+ retiree: 2026 pack monthly premium $202.90,
 * or $2,434.80 annually, in each row.
 *
 * Input summary:
 *   Single retiree born 1954-01-01, age 72 in 2026, RMDs start at 73 in 2027.
 *   Opening cash $100,000; opening traditional IRA $265,000; base spending
 *   $20,000 plus $2,434.80 Medicare Part B. Heir tax rate 25% for the ending
 *   after-tax-estate haircut.
 *
 * Worksheet:
 *   2026: no RMD. Cash funds $22,434.80 spending.
 *   2027: RMD = 265,000 / 26.5 = 10,000; cash funds the other $12,434.80.
 *   2028: RMD = 255,000 / 25.5 = 10,000; cash funds the other $12,434.80.
 *   2029: RMD = 245,000 / 24.6 = 9,959.35; cash funds $12,475.45.
 *   2030: RMD = 235,040.65 / 23.7 = 9,917.33; cash funds $12,517.47.
 */
describe('ORACLE-012: five-year retirement bridge with RMD start', () => {
  it('matches the hand worksheet rows and ending after-tax estate', () => {
    const plan = singlePersonPlan({ dob: '1954-01-01', planningAge: 76, state: 'FL' })
    plan.accounts = [cashAccount('cash', 100_000), traditionalAccount('ira', 265_000)]
    plan.expenses.baseAnnual = 20_000
    plan.assumptions.heirTaxRatePct = 25

    const valid = validatePlan(plan)
    const result = simulatePlan(valid, opts)
    const summary = summarizeProjection(valid, result)

    expect({
      depletionYear: result.depletionYear,
      endingNetWorth: dollars(summary.endingNetWorth),
      endingAfterTaxEstate: dollars(summary.endingAfterTaxEstate),
      endingTraditional: dollars(summary.endingByCategory.traditional),
      endingCash: dollars(summary.endingByCategory.cash),
      totalRmd: dollars(result.years.reduce((sum, y) => sum + y.rmd, 0)),
      totalTax: dollars(summary.lifetimeTaxesAndPenalties),
      rows: result.years.map(picked),
    }).toEqual({
      depletionYear: null,
      endingNetWorth: 252_826,
      endingAfterTaxEstate: 196_545.17,
      endingTraditional: 225_123.32,
      endingCash: 27_702.68,
      totalRmd: 39_876.68,
      totalTax: 0,
      rows: [
        {
          year: 2026,
          age: 72,
          withdrawals: 22_434.8,
          traditionalWithdrawals: 0,
          cashWithdrawals: 22_434.8,
          rmd: 0,
          rothConversion: 0,
          tax: 0,
          magi: 0,
          investable: 342_565.2,
          traditional: 265_000,
          roth: 0,
          cash: 77_565.2,
          shortfall: 0,
        },
        {
          year: 2027,
          age: 73,
          withdrawals: 22_434.8,
          traditionalWithdrawals: 10_000,
          cashWithdrawals: 12_434.8,
          rmd: 10_000,
          rothConversion: 0,
          tax: 0,
          magi: 10_000,
          investable: 320_130.4,
          traditional: 255_000,
          roth: 0,
          cash: 65_130.4,
          shortfall: 0,
        },
        {
          year: 2028,
          age: 74,
          withdrawals: 22_434.8,
          traditionalWithdrawals: 10_000,
          cashWithdrawals: 12_434.8,
          rmd: 10_000,
          rothConversion: 0,
          tax: 0,
          magi: 10_000,
          investable: 297_695.6,
          traditional: 245_000,
          roth: 0,
          cash: 52_695.6,
          shortfall: 0,
        },
        {
          year: 2029,
          age: 75,
          withdrawals: 22_434.8,
          traditionalWithdrawals: 9_959.35,
          cashWithdrawals: 12_475.45,
          rmd: 9_959.35,
          rothConversion: 0,
          tax: 0,
          magi: 9_959.35,
          investable: 275_260.8,
          traditional: 235_040.65,
          roth: 0,
          cash: 40_220.15,
          shortfall: 0,
        },
        {
          year: 2030,
          age: 76,
          withdrawals: 22_434.8,
          traditionalWithdrawals: 9_917.33,
          cashWithdrawals: 12_517.47,
          rmd: 9_917.33,
          rothConversion: 0,
          tax: 0,
          magi: 9_917.33,
          investable: 252_826,
          traditional: 225_123.32,
          roth: 0,
          cash: 27_702.68,
          shortfall: 0,
        },
      ],
    })
  })
})
