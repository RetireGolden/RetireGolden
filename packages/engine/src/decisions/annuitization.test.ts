/**
 * Annuitization sweep solver (annuity-pension-and-home-equity decisions,
 * step 2): bounded grid, reproducible frontier on shared paths, premium
 * sizing, user-quote override, and the Kitces glidepath-attribution controls
 * (present with a static-allocation funding account, skipped otherwise).
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { buildAnnuitizationSweep } from './annuitization.js'

let counter = 0
const testIds = () => `ann-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

const opts = {
  startYear: 2026,
  taxCalculator: noTax,
  model: { type: 'lognormal', inflationMeanPct: 2.5, returnVolPct: 14 } as const,
  pathCount: 40,
  seed: 77,
}

function basePlan(withAllocation: boolean): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-06-15',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 2.5
  plan.assumptions.defaultReturnPct = 5
  plan.expenses.baseAnnual = 48_000
  const taxable: Account = {
    type: 'taxable',
    id: 'brok1',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 700_000,
    costBasis: 700_000,
    annualContribution: 0,
    allocation: withAllocation
      ? { mode: 'static', rebalancing: 'annual', weights: { usStocks: 50, intlStocks: 0, bonds: 45, cash: 5 } }
      : undefined,
  }
  plan.accounts = [taxable]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('buildAnnuitizationSweep', () => {
  it('builds a bounded, reproducible frontier with sized premiums', () => {
    const sweep = buildAnnuitizationSweep(basePlan(false), opts, { allocationPcts: [0, 10, 20] })
    expect(sweep.points).toHaveLength(3)
    expect(sweep.points[0]!.allocationPct).toBe(0)
    expect(sweep.points[0]!.premium).toBe(0)
    // 10% of the $700k investable, capped by the funding account.
    expect(sweep.points[1]!.premium).toBeCloseTo(70_000, 0)
    expect(sweep.points[2]!.premium).toBeCloseTo(140_000, 0)
    // Uncapped points: the effective annuitized share equals the grid value.
    expect(sweep.points[1]!.effectiveAllocationPct).toBeCloseTo(10, 5)
    expect(sweep.points[2]!.effectiveAllocationPct).toBeCloseTo(20, 5)
    // Payout rate comes from the sourced default table at the start age (65).
    expect(sweep.rateSource).toBe('default-table')
    expect(sweep.payoutRatePct).toBeCloseTo(6.1, 5)
    expect(sweep.points[1]!.annualIncome).toBeCloseTo(70_000 * 0.061, 0)
    // Same seed → identical frontier.
    const again = buildAnnuitizationSweep(basePlan(false), opts, { allocationPcts: [0, 10, 20] })
    expect(again.points.map((p) => p.metrics.successRate)).toEqual(sweep.points.map((p) => p.metrics.successRate))
    for (const p of sweep.points) {
      expect(p.metrics.successRate).toBeGreaterThanOrEqual(0)
      expect(p.metrics.successRate).toBeLessThanOrEqual(1)
      expect(Number.isFinite(p.metrics.medianEndingAfterTaxEstate)).toBe(true)
    }
  })

  it('a user-entered quote overrides the default payout table', () => {
    const sweep = buildAnnuitizationSweep(basePlan(false), opts, { allocationPcts: [0, 10], quotedPayoutRatePct: 7.2 })
    expect(sweep.rateSource).toBe('user-quote')
    expect(sweep.payoutRatePct).toBeCloseTo(7.2, 10)
    expect(sweep.points[1]!.annualIncome).toBeCloseTo(70_000 * 0.072, 0)
  })

  it('skips glidepath controls (with a note) when the funding account has no static allocation', () => {
    const sweep = buildAnnuitizationSweep(basePlan(false), opts, { allocationPcts: [0, 10] })
    expect(sweep.attributionAvailable).toBe(false)
    expect(sweep.points[1]!.glidepathControl).toBeUndefined()
    expect(sweep.notes.some((n) => n.includes('attribution'))).toBe(true)
  })

  it('builds allocation-matched glidepath controls when the funding account is statically allocated', () => {
    const sweep = buildAnnuitizationSweep(basePlan(true), opts, { allocationPcts: [0, 10, 20] })
    expect(sweep.attributionAvailable).toBe(true)
    const p10 = sweep.points.find((p) => p.allocationPct === 10)!
    expect(p10.glidepathControl).toBeDefined()
    // The control is a different plan than both the baseline and the SPIA
    // variant, so its metrics are finite and generally distinct.
    expect(Number.isFinite(p10.glidepathControl!.successRate)).toBe(true)
  })

  it('reports the effective (funded) share and a note when the funding account caps a point', () => {
    // $700k taxable funding + $300k traditional: an 80% request wants $800k
    // but the funding account can pay only 95% of $700k = $665k → the point's
    // effective share is 66.5% of the $1M investable, with a visible note.
    const plan = basePlan(false)
    const withIra = {
      ...plan,
      accounts: [
        ...plan.accounts,
        {
          type: 'traditional' as const,
          id: 'ira1',
          name: 'IRA',
          ownerPersonId: 'p1',
          annualReturnPct: null,
          kind: 'ira' as const,
          balance: 300_000,
          annualContribution: 0,
        },
      ],
    }
    const sweep = buildAnnuitizationSweep(withIra as Plan, opts, { allocationPcts: [0, 80] })
    const capped = sweep.points.find((p) => p.allocationPct === 80)!
    expect(capped.premium).toBeCloseTo(700_000 * 0.95, 0)
    expect(capped.effectiveAllocationPct).toBeCloseTo(66.5, 1)
    expect(sweep.notes.some((n) => n.includes('capped by the funding account'))).toBe(true)
  })

  it('degrades gracefully when the plan has no liquid funding account', () => {
    const plan = basePlan(false)
    const noLiquid = { ...plan, accounts: [] }
    const sweep = buildAnnuitizationSweep(noLiquid as Plan, opts)
    expect(sweep.points).toHaveLength(0)
    expect(sweep.notes.length).toBeGreaterThan(0)
  })
})
