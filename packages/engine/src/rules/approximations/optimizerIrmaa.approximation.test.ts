/**
 * Pins for the two optimizer IRMAA `approximated` records in the health shard.
 *
 * Each fixture drives real `optimizeSchedule` / HiGHS. Expected local LP
 * Medicare surcharge cost is the independent planning increment at held 2026
 * pack prices, not a solver dump and not CMS's published first-tier combined
 * $95.70 (the 4¢ residual is the standard-premium sibling).
 */
import { expect, it } from 'vitest'

import { packForYear } from '../../params/index.js'
import type { FilingStatus } from '../../params/types.js'
import {
  buildOptimizerModel,
  optimizeSchedule,
  type OptimizerInput,
  type OptimizerYear,
} from '../../strategies/optimizer.js'
import { expectMoney } from '../../testing/money.js'
import { describeRule } from '../describeRule.js'

const PACK_2026 = packForYear(2026).pack

function year(over: Partial<OptimizerYear> & Pick<OptimizerYear, 'year'>): OptimizerYear {
  return {
    pack: packForYear(over.year).pack,
    filingStatus: 'single',
    ordinaryIncomeBase: 0,
    spendingNeed: 0,
    exogenousCash: 0,
    rmdDivisor: null,
    inheritedDistribution: 0,
    inheritedDistributionDivisor: null,
    peopleAged65Plus: 0,
    inflationScale: 1,
    growth: 0,
    stateRate: 0,
    tradInflow: 0,
    otherInflow: 0,
    ...over,
  }
}

function input(years: OptimizerYear[]): OptimizerInput {
  return {
    years,
    openingTrad: 0,
    openingInheritedTrad: 0,
    openingOther: 1_000_000,
    openingTaxable: 0,
    taxableBasisRatio: 1,
    ltcgRate: 0,
    irmaaLookback: true,
    seniorDeduction: false,
    liquidationRate: 1,
    realDollarFactor: 1,
    options: { timeLimitSec: 5, maxConversionPerYear: 0 },
  }
}

async function solve(optInput: OptimizerInput) {
  expect(buildOptimizerModel(optInput).binaryCount).toBe(5)
  const result = await optimizeSchedule(optInput)
  expect(result.status).toBe('optimal')
  expect(result.schedule).toHaveLength(3)
  for (const row of result.schedule) {
    expect(row.taxableOrdinary).toBeCloseTo(0, 10)
    expect(row.conversion).toBeCloseTo(0, 10)
    expect(row.withdrawTraditional).toBeCloseTo(0, 10)
    expect(row.withdrawInheritedTraditional).toBeCloseTo(0, 10)
    expect(row.withdrawTaxable).toBeCloseTo(0, 10)
  }
  return result
}

function expectCostVector(actual: readonly number[], expected: readonly number[]): void {
  expect(actual).toHaveLength(expected.length)
  for (let i = 0; i < expected.length; i++) expectMoney(actual[i]!, expected[i]!)
}

// Planning combined surcharge at held 2026 prices (one person, 12 months):
// Part B increment = 202.90 × (applicablePct − 25) / 25
// Part D = pack monthly surcharge
// tier 1: 202.90 × 0.40 + 14.50 = 95.66/mo → 1,147.92  (CMS published combined 95.70)
// tier 4 cumulative 6,356.16; tier 5 cumulative 6,935.52
const TIER4_ANNUAL = 6_356.16
const TIER5_ANNUAL = 6_935.52

describeRule('usc-42-1395r-i-5-optimizer-uniform-threshold-indexing', {
  readings: {
    // 2028 top = nearest $1,000 after 4% one-year-earlier factor = 520,000.
    // 2027/510k/1.04: freeze 500k → 5; uniform 520k → 4
    // 2028/530k/1.04²: resumed 520k → 5; uniform 540,800 → 4
    // 2028/510k/1.04²: resumed 520k → 4; uniform 540,800 → 4; freeze-forever → 5
    // 2027/490k/0.96: freeze 500k → 4; uniform 480k → 5
    statute: [TIER5_ANNUAL, TIER5_ANNUAL, TIER4_ANNUAL, TIER4_ANNUAL],
    uniformlyScaled: [TIER4_ANNUAL, TIER4_ANNUAL, TIER4_ANNUAL, TIER5_ANNUAL],
    freezeForever: [TIER5_ANNUAL, TIER5_ANNUAL, TIER5_ANNUAL, TIER4_ANNUAL],
  },
  accepted: 'statute',
  produced: 'uniformlyScaled',
}, ({ accepted, produced, readings }) => {
  const cases: readonly { premiumYear: number; sourceMagi: number; premiumScale: number }[] = [
    { premiumYear: 2027, sourceMagi: 510_000, premiumScale: 1.04 },
    { premiumYear: 2028, sourceMagi: 530_000, premiumScale: 1.04 ** 2 },
    { premiumYear: 2028, sourceMagi: 510_000, premiumScale: 1.04 ** 2 },
    { premiumYear: 2027, sourceMagi: 490_000, premiumScale: 0.96 },
  ]

  it('uniformly scales every MAGI floor, including the frozen top row', async () => {
    const costs: number[] = []
    for (const c of cases) {
      const sourceYear = c.premiumYear - 2
      const result = await solve(input([
        year({ year: sourceYear, magiTaxExemptInterest: c.sourceMagi, peopleAged65Plus: 1 }),
        year({ year: sourceYear + 1, peopleAged65Plus: 1 }),
        year({
          year: c.premiumYear,
          pack: PACK_2026,
          peopleAged65Plus: 1,
          inflationScale: c.premiumScale,
        }),
      ]))
      costs.push(result.lifetimeTax)
    }
    expectCostVector(costs, produced as readonly number[])
    expect(costs).not.toEqual(accepted)
    expect(costs).not.toEqual(readings.freezeForever)
  })
})

describeRule('usc-42-1395r-i-3-1395w-113-a-7-optimizer-beneficiary-month-exposure', {
  readings: {
    // Stipulated actual B+D beneficiary-months 0 / 12 / 24 / 6 (July start).
    // Months are fixture metadata; the engine has no field for them.
    statute: [0, 1_147.92, 2_295.84, 573.96],
    fullYearHousehold: [1_147.92, 1_147.92, 1_147.92, 1_147.92],
    fullYearPerPerson: [0, 1_147.92, 2_295.84, 1_147.92],
    anyEligibleHousehold: [0, 1_147.92, 1_147.92, 1_147.92],
  },
  accepted: 'statute',
  produced: 'fullYearHousehold',
}, ({ accepted, produced, readings }) => {
  const mfj: FilingStatus = 'marriedFilingJointly'
  const people = [0, 1, 2, 1] as const

  it('prices one 12-month household coefficient regardless of stipulated months', async () => {
    const costs: number[] = []
    for (const n of people) {
      const result = await solve(input([
        year({
          year: 2026,
          pack: PACK_2026,
          filingStatus: mfj,
          magiTaxExemptInterest: 220_000,
          peopleAged65Plus: n,
        }),
        year({ year: 2027, pack: PACK_2026, filingStatus: mfj, peopleAged65Plus: n }),
        year({ year: 2028, pack: PACK_2026, filingStatus: mfj, peopleAged65Plus: n }),
      ]))
      expect(result.schedule[2]!.irmaaTier).toBe(1)
      costs.push(result.lifetimeTax)
    }
    expectCostVector(costs, produced as readonly number[])
    expect(costs).not.toEqual(accepted)
    expect(costs).not.toEqual(readings.fullYearPerPerson)
    expect(costs).not.toEqual(readings.anyEligibleHousehold)
  })
})
