import { describe, expect, it } from 'vitest'

import { parsePlan } from '@retiregolden/engine/model/plan'
import { seedPlanFromTenForty, type TenFortyInputs } from './tenForty'

let n = 0
const testIds = () => `tf-${++n}`
const fixedNow = () => new Date('2026-07-08T00:00:00.000Z')

const RETIREE_1040: TenFortyInputs = {
  filingStatus: 'marriedFilingJointly',
  state: 'nc',
  primaryDob: '1958-03-10',
  spouseDob: '1960-08-22',
  wages: 0,
  taxExemptInterest: 1200,
  taxableInterest: 3000,
  qualifiedDividends: 8000,
  ordinaryDividends: 9500,
  iraDistributions: 40000,
  pensionsAndAnnuities: 18000,
  socialSecurityBenefits: 36000,
  capitalGain: 12000,
  agi: 110000,
}

const WORKER_1040: TenFortyInputs = {
  filingStatus: 'single',
  state: 'KY',
  primaryDob: '1980-05-01',
  wages: 95000,
  taxExemptInterest: 0,
  taxableInterest: 150,
  qualifiedDividends: 0,
  ordinaryDividends: 0,
  iraDistributions: 0,
  pensionsAndAnnuities: 0,
  socialSecurityBenefits: 0,
  capitalGain: 0,
  agi: 95150,
}

describe('seedPlanFromTenForty', () => {
  it('seeds a coherent, valid draft plan for a retired MFJ household', () => {
    const r = seedPlanFromTenForty(RETIREE_1040, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(parsePlan(r.plan).ok).toBe(true)
    expect(r.plan.name).toBe('Seeded from your 1040')
    expect(r.plan.household.filingStatus).toBe('marriedFilingJointly')
    expect(r.plan.household.state).toBe('NC')
    expect(r.plan.household.people).toHaveLength(2)
    expect(r.plan.household.people[0]!.dob).toBe('1958-03-10')
    expect(r.plan.household.people[1]!.dob).toBe('1960-08-22')

    // Interest+dividends → estimated taxable account at the assumed yield.
    const taxable = r.plan.accounts.find((a) => a.type === 'taxable')!
    expect(taxable.balance).toBe(500000) // (3000 + 9500) / 2.5%
    if (taxable.type === 'taxable') {
      expect(taxable.qualifiedRatio).toBeCloseTo(0.84, 2)
      expect(taxable.interestYieldPct).toBeCloseTo(0.6, 2)
      expect(taxable.dividendYieldPct).toBeCloseTo(1.9, 2)
    }

    // Pension → pension account starting at the current age.
    const pension = r.plan.accounts.find((a) => a.type === 'pension')!
    expect(pension).toMatchObject({ monthlyAmount: 1500, startAge: 68, survivorPct: 50 })

    // SS benefits → benefit basis with the FRA-claim simplification.
    const ss = r.plan.incomes.find((i) => i.type === 'socialSecurity')!
    expect(ss).toMatchObject({ piaMonthly: 3000, claimAge: { years: 67, months: 0 } })

    // AGI + tax-exempt interest → IRMAA-lookback MAGI.
    expect(r.plan.assumptions.recentAnnualMagi).toBe(111200)

    // No wages line → no wages income stream.
    expect(r.plan.incomes.some((i) => i.type === 'wages')).toBe(false)
  })

  it('marks every prefilled value as from the 1040 and reports what a 1040 cannot provide', () => {
    const r = seedPlanFromTenForty(RETIREE_1040, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    // Every line-value item names its 1040 line.
    const lineItems = r.review.filter((i) => i.source.startsWith('From your 1040'))
    expect(lineItems.length).toBeGreaterThanOrEqual(5)
    // IRA distributions cannot become an account balance — explicit unmapped item.
    expect(r.review.some((i) => i.status === 'unmapped' && i.source.includes('line 4b'))).toBe(true)
    // Spending is never on a tax return.
    expect(r.review.some((i) => i.status === 'unmapped' && i.source.includes('Spending'))).toBe(true)
    // Estimates are flagged for review, not passed off as facts.
    expect(r.review.some((i) => i.status === 'defaulted' && i.detail.includes('estimate'))).toBe(true)
  })

  it('warns joint filers that line 6a is the couple total placed on one person', () => {
    const joint = seedPlanFromTenForty(RETIREE_1040, testIds, fixedNow)
    expect(joint.ok).toBe(true)
    if (!joint.ok) return
    const ssItem = joint.review.find((i) => i.source.includes('line 6a'))!
    expect(ssItem.status).toBe('defaulted')
    expect(ssItem.detail).toContain('joint total')
    expect(ssItem.detail).toContain('split it into one stream per person')

    // Single filers get no such warning — the whole benefit really is theirs.
    const single = seedPlanFromTenForty({ ...WORKER_1040, socialSecurityBenefits: 24000 }, testIds, fixedNow)
    expect(single.ok).toBe(true)
    if (!single.ok) return
    expect(single.review.find((i) => i.source.includes('line 6a'))!.detail).not.toContain('joint total')
  })

  it('seeds a working-years single filer with wages and MAGI only', () => {
    const r = seedPlanFromTenForty(WORKER_1040, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    expect(r.plan.household.people).toHaveLength(1)
    const wages = r.plan.incomes.find((i) => i.type === 'wages')!
    expect(wages).toMatchObject({ annualGross: 95000 })
    expect(r.plan.assumptions.recentAnnualMagi).toBe(95150)
    // $150 of interest still produces a (small) estimated account, flagged as an estimate.
    const taxable = r.plan.accounts.find((a) => a.type === 'taxable')
    expect(taxable?.type === 'taxable' && taxable.balance).toBe(6000)
    expect(r.plan.accounts.some((a) => a.type === 'pension')).toBe(false)
  })

  it('handles a capital loss with a carryforward pointer', () => {
    const r = seedPlanFromTenForty({ ...WORKER_1040, capitalGain: -3000 }, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.review.some((i) => i.source.includes('line 7') && i.detail.includes('carryforward'))).toBe(true)
  })

  it('clamps the estimated taxable balance so sub-dollar investment income never divides by zero', () => {
    const r = seedPlanFromTenForty({ ...WORKER_1040, taxableInterest: 0.25, pensionsAndAnnuities: 100 }, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const taxable = r.plan.accounts.find((a) => a.type === 'taxable')!
    expect(taxable.type === 'taxable' && taxable.balance).toBeGreaterThanOrEqual(1)
    expect(taxable.type === 'taxable' && Number.isFinite(taxable.interestYieldPct)).toBe(true)
  })

  it('rejects impossible calendar dates up front, not as a generic validation failure', () => {
    for (const dob of ['2026-13-40', '2020-02-30', '1970-00-10']) {
      const r = seedPlanFromTenForty({ ...WORKER_1040, primaryDob: dob, pensionsAndAnnuities: 100 }, testIds, fixedNow)
      expect(r.ok, dob).toBe(false)
      if (!r.ok) expect(r.message).toContain('calendar date')
    }
  })

  it('rejects invalid inputs with actionable messages', () => {
    expect(seedPlanFromTenForty({ ...WORKER_1040, primaryDob: 'yesterday' }, testIds, fixedNow).ok).toBe(false)
    expect(seedPlanFromTenForty({ ...WORKER_1040, state: 'Kentucky' }, testIds, fixedNow).ok).toBe(false)
    expect(seedPlanFromTenForty({ ...WORKER_1040, wages: -5 }, testIds, fixedNow).ok).toBe(false)
    expect(seedPlanFromTenForty({ ...WORKER_1040, agi: Number.NaN }, testIds, fixedNow).ok).toBe(false)
    expect(seedPlanFromTenForty({ ...WORKER_1040, wages: 1e15 }, testIds, fixedNow).ok).toBe(false)
    const noSpouse = seedPlanFromTenForty(
      { ...RETIREE_1040, spouseDob: undefined },
      testIds,
      fixedNow,
    )
    expect(noSpouse.ok).toBe(false)
    if (!noSpouse.ok) expect(noSpouse.message).toContain('spouse')
  })
})

describe('tenForty provenance (WS1)', () => {
  it('gives every review item a form-1040 locator and a confidence', () => {
    for (const inputs of [RETIREE_1040, WORKER_1040]) {
      const r = seedPlanFromTenForty(inputs, testIds, fixedNow)
      expect(r.ok).toBe(true)
      if (!r.ok) return
      for (const item of r.review) {
        expect(item.locator, item.source).toBeDefined()
        expect(item.confidence, item.source).toBeDefined()
      }
    }
  })

  it('locates the wages line at 1a and grades a verbatim line exact', () => {
    const r = seedPlanFromTenForty(WORKER_1040, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const wages = r.review.find((i) => i.source.includes('line 1a'))!
    expect(wages.locator).toEqual({ kind: 'form1040', line: '1a' })
    expect(wages.confidence).toBe('exact')
  })

  it('marks the yield-implied taxable balance estimated and the MAGI derived', () => {
    const r = seedPlanFromTenForty(RETIREE_1040, testIds, fixedNow)
    expect(r.ok).toBe(true)
    if (!r.ok) return

    const taxable = r.review.find((i) => i.source.includes('lines 2b/3a/3b'))!
    expect(taxable.confidence).toBe('estimated')
    expect(taxable.locator?.kind).toBe('derived')
    if (taxable.locator?.kind === 'derived') {
      expect(taxable.locator.from).toContainEqual({ kind: 'form1040', line: '2b' })
    }

    const magi = r.review.find((i) => i.source.includes('lines 11 + 2a'))!
    expect(magi.confidence).toBe('derived')
    expect(magi.locator?.kind).toBe('derived')
    if (magi.locator?.kind === 'derived') {
      expect(magi.locator.from).toEqual([
        { kind: 'form1040', line: '11' },
        { kind: 'form1040', line: '2a' },
      ])
    }
  })
})
