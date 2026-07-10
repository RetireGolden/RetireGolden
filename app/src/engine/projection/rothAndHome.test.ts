/**
 * Engine tests for the V8-depth additions surfaced from a planning session:
 *   - Roth ordering + 5-year rules (contributions free, conversion recapture,
 *     pre-59½ earnings taxed + penalized).
 *   - Debt lump-sum payoff year.
 *   - Property carrying costs (tax + insurance) that outlive the mortgage.
 */

import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { createFlatTaxCalculator } from './flatTax'
import { simulatePlan } from './simulate'

let counter = 0
const ids = () => `rh-${++counter}`
const noTax = createFlatTaxCalculator(0)

function basePlan(age: number): Plan {
  const plan = createEmptyPlan({ newId: ids, now: () => new Date('2026-06-11T00:00:00.000Z') })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: `${2026 - age}-03-15`,
    sex: 'average',
    retirementAge: age,
    longevity: { planningAge: Math.max(60, age + 8), source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function run(plan: Plan) {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return simulatePlan(r.plan, { startYear: 2026, taxCalculator: noTax })
}

describe('Roth ordering + 5-year rules', () => {
  it('withdraws contributions tax- and penalty-free before 59½', () => {
    const plan = basePlan(50)
    plan.expenses.baseAnnual = 20_000
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 200_000, annualContribution: 0, contributionBasis: 200_000 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeCloseTo(20_000, 0)
    expect(y.penalties).toBe(0)
    expect(y.magi).toBeCloseTo(0, 0) // contributions are not income
  })

  it('penalizes a conversion tapped within 5 years before 59½ (the ladder rule)', () => {
    const plan = basePlan(55)
    plan.expenses.baseAnnual = 20_000
    // Convert the whole traditional balance into the (empty) Roth this year, then
    // live on it — so spending drains the freshly converted, unseasoned principal.
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 50_000 }] }
    plan.accounts = [
      { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 } as Account,
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0, contributionBasis: 0 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeGreaterThan(20_000) // had to gross up for the penalty
    expect(y.penalties).toBeCloseTo(y.withdrawals.roth * 0.1, 0) // 10% recapture on the conversion
  })

  it('waives the conversion recapture once age 60 is attained', () => {
    const plan = basePlan(62)
    plan.expenses.baseAnnual = 20_000
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 50_000 }] }
    plan.accounts = [
      { type: 'traditional', id: 'trad1', name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 } as Account,
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0, contributionBasis: 0 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeCloseTo(20_000, 0)
    expect(y.penalties).toBe(0)
  })

  it('taxes and penalizes Roth earnings withdrawn before 59½', () => {
    const plan = basePlan(50)
    plan.expenses.baseAnnual = 20_000
    // contributionBasis 0 → the entire balance is earnings.
    plan.accounts = [
      { type: 'roth', id: 'roth1', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 200_000, annualContribution: 0, contributionBasis: 0 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.penalties).toBeCloseTo(y.withdrawals.roth * 0.1, 0)
    expect(y.magi).toBeCloseTo(y.withdrawals.roth, 0) // earnings are ordinary income → MAGI
  })

  it("aggregates an owner's Roth IRAs so basis in one covers a draw from another", () => {
    const plan = basePlan(50)
    plan.expenses.baseAnnual = 40_000
    plan.accounts = [
      // Roth A is drained first and has zero basis of its own (all earnings)…
      { type: 'roth', id: 'rothA', name: 'Roth A', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0, contributionBasis: 0 } as Account,
      // …but the owner still has ample contribution basis in Roth B.
      { type: 'roth', id: 'rothB', name: 'Roth B', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 150_000, annualContribution: 0, contributionBasis: 150_000 } as Account,
    ]
    const y = run(plan).years.find((r) => r.year === 2026)!
    expect(y.withdrawals.roth).toBeCloseTo(40_000, 0)
    expect(y.penalties).toBe(0) // aggregated basis covers it — no spurious earnings penalty
    expect(y.magi).toBeCloseTo(0, 0)
  })
})

describe('Debt lump-sum payoff', () => {
  function mortgagePlan(payoffYear: number | null): Plan {
    const plan = basePlan(62)
    plan.accounts = [
      { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 300_000, annualContribution: 0 } as Account,
      { type: 'debt', id: 'mort', name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 100_000, interestPct: 5, monthlyPayment: 1_000, payoffYear } as Account,
    ]
    return plan
  }

  it('clears the whole balance in the payoff year and stops servicing it after', () => {
    const result = run(mortgagePlan(2028))
    const y2028 = result.years.find((r) => r.year === 2028)!
    const y2029 = result.years.find((r) => r.year === 2029)!
    expect(y2028.expenses.debtService).toBeGreaterThan(80_000) // ~remaining balance, not the 12k level payment
    expect(y2028.balances['mort'] ?? 0).toBeCloseTo(0, 2)
    expect(y2029.expenses.debtService).toBe(0)
  })

  it('runs to term at the level payment when no payoff year is set', () => {
    const y2028 = run(mortgagePlan(null)).years.find((r) => r.year === 2028)!
    expect(y2028.expenses.debtService).toBeCloseTo(12_000, 0)
    expect(y2028.balances['mort'] ?? 0).toBeGreaterThan(50_000)
  })
})

describe('Property carrying costs', () => {
  it('charges tax + insurance while owned and stops at the sale year', () => {
    const plan = basePlan(62)
    plan.accounts = [
      { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 100_000, annualContribution: 0 } as Account,
      { type: 'property', id: 'home', name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 400_000, plannedSaleYear: 2028, expectedNetProceeds: null, propertyTaxAnnual: 6_000, insuranceAnnual: 2_000 } as Account,
    ]
    const years = run(plan).years
    expect(years.find((r) => r.year === 2026)!.expenses.propertyCosts).toBeCloseTo(8_000, 0)
    expect(years.find((r) => r.year === 2027)!.expenses.propertyCosts).toBeCloseTo(8_000, 0)
    expect(years.find((r) => r.year === 2028)!.expenses.propertyCosts).toBe(0) // sold
  })
})
