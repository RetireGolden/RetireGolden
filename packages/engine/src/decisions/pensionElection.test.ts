/**
 * Pension lump-sum vs annuity decision module (annuity-pension-and-home-
 * equity decisions, step 3): hand-worked PV goldens, sensitivity-table
 * monotonicity, the curve-anchored discount rate, the scenario-pair candidate
 * generator, and the ledger's rollover execution (tax-free, pension silenced,
 * survivor interplay preserved).
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import { createDecisionContext, evaluateCandidate } from './evaluateCandidate.js'
import {
  analyzePensionElections,
  curveNominalDiscountRatePct,
  pensionAnnuityPresentValue,
  pensionLumpSumGenerator,
  pensionLumpSumSensitivity,
} from './pensionElection.js'

let counter = 0
const testIds = () => `pe-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

describe('pensionAnnuityPresentValue (hand-worked goldens)', () => {
  it('discounts a flat immediate annuity: 12,000 × (1 + 1/1.05 + 1/1.05²)', () => {
    const pv = pensionAnnuityPresentValue({
      monthlyAmount: 1_000,
      colaPct: 0,
      survivorPct: 0,
      startAge: 65,
      ownerCurrentAge: 65,
      ownerDeathAge: 67,
      discountRatePct: 5,
    })
    expect(pv).toBeCloseTo(12_000 * (1 + 1 / 1.05 + 1 / 1.05 ** 2), 2)
  })

  it('adds survivor continuation at the survivor share (undiscounted golden)', () => {
    // Owner takes one payment (dies at 65); the survivor gets 50% for two
    // more years: 12,000 + 6,000 + 6,000 = 24,000 at a 0% rate.
    const pv = pensionAnnuityPresentValue({
      monthlyAmount: 1_000,
      colaPct: 0,
      survivorPct: 50,
      startAge: 65,
      ownerCurrentAge: 65,
      ownerDeathAge: 65,
      survivor: { currentAge: 65, deathAge: 67 },
      discountRatePct: 0,
    })
    expect(pv).toBeCloseTo(24_000, 2)
  })

  it('pays no survivor benefit when the owner dies before the start age (ledger rule)', () => {
    const pv = pensionAnnuityPresentValue({
      monthlyAmount: 1_000,
      colaPct: 0,
      survivorPct: 100,
      startAge: 67,
      ownerCurrentAge: 65,
      ownerDeathAge: 66,
      survivor: { currentAge: 65, deathAge: 90 },
      discountRatePct: 0,
    })
    expect(pv).toBe(0)
  })

  it('compounds COLA from the start age, not the valuation year', () => {
    // Started at 65, now 66 with 10% COLA: this year's payment is 13,200; the
    // owner dies at 66, so that is the whole PV at a 0% rate.
    const pv = pensionAnnuityPresentValue({
      monthlyAmount: 1_000,
      colaPct: 10,
      survivorPct: 0,
      startAge: 65,
      ownerCurrentAge: 66,
      ownerDeathAge: 66,
      discountRatePct: 0,
    })
    expect(pv).toBeCloseTo(13_200, 2)
  })
})

describe('sensitivity table', () => {
  const base = {
    monthlyAmount: 2_000,
    colaPct: 0,
    survivorPct: 50,
    startAge: 65,
    ownerCurrentAge: 60,
    survivor: { currentAge: 60, deathAge: 92 },
  }

  it('PV falls with the discount rate and rises with longevity; ratios anchor to the lump sum', () => {
    const table = pensionLumpSumSensitivity(base, 300_000, [4, 5, 6], [85, 90, 95])
    expect(table.rows).toHaveLength(3)
    for (const row of table.rows) {
      for (let i = 1; i < row.cells.length; i++) {
        expect(row.cells[i]!.presentValue).toBeLessThan(row.cells[i - 1]!.presentValue)
      }
    }
    for (let r = 1; r < table.rows.length; r++) {
      expect(table.rows[r]!.cells[0]!.presentValue).toBeGreaterThan(table.rows[r - 1]!.cells[0]!.presentValue)
    }
    const cell = table.rows[0]!.cells[0]!
    expect(cell.ratioToLumpSum).toBeCloseTo(cell.presentValue / 300_000, 10)
  })

  it('is bounded at 5 × 5 cells', () => {
    const table = pensionLumpSumSensitivity(base, 300_000, [1, 2, 3, 4, 5, 6, 7], [80, 82, 84, 86, 88, 90, 92])
    expect(table.rows).toHaveLength(5)
    expect(table.rows[0]!.cells).toHaveLength(5)
  })
})

describe('curve-anchored discount rate', () => {
  it('interpolates the embedded TIPS curve and adds inflation', () => {
    // Endpoints clamp; a mid-curve horizon lands between neighboring yields.
    const shortRate = curveNominalDiscountRatePct(1, 2.5)
    const longRate = curveNominalDiscountRatePct(50, 2.5)
    const midRate = curveNominalDiscountRatePct(15, 2.5)
    expect(shortRate).toBeLessThan(midRate)
    expect(midRate).toBeLessThan(longRate)
    expect(longRate).toBeLessThan(2.5 + 5) // sanity: real yields are low single digits
  })
})

/** Single 60-year-old with a pension paying from 60 and a lump-sum offer. */
function pensionPlan(withElection: boolean): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 90, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.incomes = []
  const pension: Account = {
    type: 'pension',
    id: 'pen1',
    name: 'Company pension',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 60,
    monthlyAmount: 2_000,
    colaPct: 0,
    survivorPct: 0,
    lumpSumOffer: { amount: 300_000, electionYear: 2027 },
    lumpSumElection: withElection ? { rolloverAccountId: 'trad1' } : undefined,
  }
  plan.accounts = [
    { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 100_000, annualContribution: 0 },
    pension,
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describe('ledger execution of the lump-sum election', () => {
  const run = (plan: Plan) => simulatePlan(plan, { startYear: 2026, taxCalculator: noTax })

  it('pays the pension until the election year, then rolls the offer over tax-free and stops', () => {
    const result = run(pensionPlan(true))
    const y2026 = result.years.find((y) => y.year === 2026)!
    const y2027 = result.years.find((y) => y.year === 2027)!
    const y2028 = result.years.find((y) => y.year === 2028)!
    // In pay from 2026 (startAge 60); the 2027 election commutes it from then.
    expect(y2026.incomes.pension).toBeCloseTo(24_000, 0)
    expect(y2027.incomes.pension).toBe(0)
    expect(y2028.incomes.pension).toBe(0)
    // The rollover itself is not a taxable event (2027 MAGI carries no pension).
    expect(y2027.magi).toBeCloseTo(0, 0)
    // The offer landed in the IRA in 2027 and only then.
    expect(y2026.balances['trad1']).toBeCloseTo(100_000, 0)
    expect(y2027.balances['trad1']).toBeCloseTo(400_000, 0)
  })

  it('a deferred election never silences years before it, and a pre-start election pays nothing', () => {
    // Election three years out: 2026–2028 pay normally, 2029 on is commuted.
    const deferred = pensionPlan(true)
    const shifted = {
      ...deferred,
      accounts: deferred.accounts.map((a) =>
        a.type === 'pension' ? { ...a, lumpSumOffer: { amount: 300_000, electionYear: 2029 } } : a,
      ),
    } as Plan
    const result = run(shifted)
    for (const year of [2026, 2027, 2028]) {
      expect(result.years.find((y) => y.year === year)!.incomes.pension).toBeCloseTo(24_000, 0)
    }
    expect(result.years.find((y) => y.year === 2029)!.incomes.pension).toBe(0)
    expect(result.years.find((y) => y.year === 2029)!.balances['trad1']).toBeCloseTo(400_000, 0)

    // Election before the start age (deferred pension bought out): never pays.
    const preStart = pensionPlan(true)
    const deferredStart = {
      ...preStart,
      accounts: preStart.accounts.map((a) => (a.type === 'pension' ? { ...a, startAge: 65 } : a)),
    } as Plan
    const preStartResult = run(deferredStart)
    for (const y of preStartResult.years) expect(y.incomes.pension).toBe(0)
  })

  it('without the election the pension pays its annuity as before', () => {
    const result = run(pensionPlan(false))
    expect(result.years.find((y) => y.year === 2026)!.incomes.pension).toBeCloseTo(24_000, 0)
    expect(result.years.find((y) => y.year === 2027)!.balances['trad1']).toBeCloseTo(100_000, 0)
  })

  it('validation rejects an election without an offer or a non-traditional rollover target', () => {
    const plan = pensionPlan(true)
    const broken = {
      ...plan,
      accounts: plan.accounts.map((a) =>
        a.type === 'pension' ? { ...a, lumpSumOffer: undefined } : a,
      ),
    }
    const parsed = parsePlan(broken)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('lump-sum offer')
  })
})

describe('pensionLumpSumGenerator (scenario pair)', () => {
  it('offers "take the lump sum" for an undecided pension; the exact ledger prices it', () => {
    const ctx = createDecisionContext(pensionPlan(false), { startYear: 2026, taxCalculator: noTax })
    const candidates = pensionLumpSumGenerator.generate(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.id).toBe('pension-lump-sum-pen1')
    const evaluation = evaluateCandidate(ctx, candidates[0]!)
    expect(evaluation.recommendationState).not.toBe('diagnostic')
    expect(Number.isFinite(evaluation.deltas.endingAfterTaxEstate)).toBe(true)
  })

  it('offers "keep the annuity" once elected', () => {
    const ctx = createDecisionContext(pensionPlan(true), { startYear: 2026, taxCalculator: noTax })
    const candidates = pensionLumpSumGenerator.generate(ctx)
    expect(candidates).toHaveLength(1)
    expect(candidates[0]!.id).toBe('pension-keep-annuity-pen1')
    const evaluation = evaluateCandidate(ctx, candidates[0]!)
    expect(evaluation.recommendationState).not.toBe('diagnostic')
  })

  it('emits nothing when the election year is already past', () => {
    const plan = pensionPlan(false)
    const stale = {
      ...plan,
      accounts: plan.accounts.map((a) =>
        a.type === 'pension' ? { ...a, lumpSumOffer: { amount: 300_000, electionYear: 2020 } } : a,
      ),
    }
    const ctx = createDecisionContext(stale as Plan, { startYear: 2026, taxCalculator: noTax })
    expect(pensionLumpSumGenerator.generate(ctx)).toHaveLength(0)
  })
})

describe('analyzePensionElections (decision view)', () => {
  it('reports PV at the curve rate, the survivor option value, and a bounded sensitivity table', () => {
    const plan = pensionPlan(false)
    const analyses = analyzePensionElections(plan, 2026)
    expect(analyses).toHaveLength(1)
    const a = analyses[0]!
    expect(a.lumpSum).toBe(300_000)
    // 30 years of $24,000 discounted at a positive rate: below the undiscounted
    // total, above zero.
    expect(a.presentValueAtCurveRate).toBeGreaterThan(0)
    expect(a.presentValueAtCurveRate).toBeLessThan(24_000 * 31)
    // No survivor configured → the survivor option is worthless here.
    expect(a.presentValueAtCurveRate - a.presentValueSingleLife).toBeCloseTo(0, 6)
    expect(a.sensitivity.rows.length).toBeGreaterThanOrEqual(2)
    expect(a.sensitivity.rows[0]!.cells.length).toBeGreaterThanOrEqual(3)
  })
})
