import { describe, expect, it } from 'vitest'

import { bucketLens, BUCKET_PRESETS, netPortfolioNeed } from './bucketLens'
import { createFlatTaxCalculator } from '../engine/projection/flatTax'
import {
  cashAccount,
  recurringOrdinaryIncome,
  runPlan,
  singlePersonPlan,
} from '../testSupport/planFixtures'

const noTax = createFlatTaxCalculator(0)

function retireePlan() {
  const plan = singlePersonPlan({ dob: '1986-01-01', planningAge: 80 })
  const cash = cashAccount('cash', 800_000)
  cash.annualReturnPct = 3
  plan.accounts = [cash]
  plan.expenses.baseAnnual = 40_000
  return plan
}

describe('bucketLens', () => {
  it('buckets reconcile to the ledger investable total every year (acceptance)', () => {
    const result = runPlan(retireePlan(), noTax)
    for (const preset of BUCKET_PRESETS) {
      const rows = bucketLens(result, preset.spans)
      expect(rows).toHaveLength(result.years.length)
      for (let i = 0; i < rows.length; i++) {
        const sum = rows[i]!.buckets.reduce((a, b) => a + b, 0)
        expect(sum).toBeCloseTo(result.years[i]!.investableTotal, 6)
        expect(rows[i]!.buckets).toHaveLength(preset.spans.length + 1)
        for (const b of rows[i]!.buckets) expect(b).toBeGreaterThanOrEqual(0)
      }
    }
  })

  it('bucket 1 holds exactly the next N years of net need while funds allow', () => {
    const result = runPlan(retireePlan(), noTax)
    const rows = bucketLens(result, [2, 8])
    // Zero inflation, zero tax fixture: need is flat $40k/yr, so bucket 1 = $80k
    // and bucket 2 = $320k until the horizon comes within reach.
    const first = rows[0]!
    expect(first.need).toBeCloseTo(40_000, 6)
    expect(first.buckets[0]).toBeCloseTo(80_000, 6)
    expect(first.buckets[1]).toBeCloseTo(320_000, 6)
    expect(first.buckets[2]).toBeCloseTo(first.investableTotal - 400_000, 6)
  })

  it('income offsets need; needs beyond the horizon count as zero', () => {
    const plan = retireePlan()
    plan.incomes = [recurringOrdinaryIncome('pension', 40_000)]
    const result = runPlan(plan, noTax)
    // Income fully covers lifestyle spending pre-65 (Medicare premiums appear
    // automatically from 65): no net need, everything is the growth bucket.
    // 65 (Medicare) in 2051; bucket 2 looks 9 years ahead, so 2041 is the last
    // row whose whole lookahead window is Medicare-free.
    const rows = bucketLens(result, [2, 8]).filter((row) => row.year <= 2041)
    expect(rows.length).toBeGreaterThan(5)
    for (const row of rows) {
      expect(row.need).toBe(0)
      expect(row.buckets[0]).toBe(0)
      expect(row.buckets[1]).toBe(0)
      expect(row.buckets[2]).toBeCloseTo(row.investableTotal, 6)
    }

    // Near the plan's end the leading buckets only claim the years that exist
    // (one remaining year of lifestyle + Medicare need, not a full 2-year span).
    const bare = runPlan(retireePlan(), noTax)
    const bareRows = bucketLens(bare, [2, 8])
    const last = bareRows[bareRows.length - 1]!
    expect(last.buckets[0]).toBeLessThanOrEqual(last.need + 1e-6)
    expect(netPortfolioNeed(bare.years[bare.years.length - 1]!)).toBeCloseTo(last.need, 6)
  })

  it('caps buckets by what is actually left when the portfolio is small', () => {
    const plan = retireePlan()
    plan.accounts = [cashAccount('cash', 50_000)]
    const result = runPlan(plan, noTax)
    const rows = bucketLens(result, [2, 8])
    const first = rows[0]!
    // $50k cannot fill 2 years of $40k need: bucket 1 gets it all.
    expect(first.buckets[0]).toBeCloseTo(Math.min(80_000, first.investableTotal), 6)
    expect(first.buckets[2]).toBe(0)
  })
})
