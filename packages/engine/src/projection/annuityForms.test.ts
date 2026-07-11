/**
 * Annuity payout forms through the exact ledger (annuity-pension-and-home-
 * equity decisions, step 1): period-certain continuation, joint-and-survivor
 * continuation, exclusion-ratio taxation per form against hand-worked IRS
 * Pub 939 General-Rule method examples, feature-off identity, and annuity
 * ladders (multiple dated purchases) as first-class citizens.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type AnnuityPayoutForm, type Plan } from '../model/plan.js'
import { jointLastSurvivorExpectancy } from '../montecarlo/mortality.js'
import { createFlatTaxCalculator } from './flatTax.js'
import { simulatePlan } from './simulate.js'

let counter = 0
const testIds = () => `af-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

/**
 * Couple, both born 1966 → age 60 in 2026 (pre-65: no Medicare noise). The
 * owner (p1) plans to 62 — alive through 2028, dead from 2029 — while p2
 * plans to 95, so survivor/beneficiary years are plentiful. Flat dollars.
 */
function couplePlan(ownerPlanningAge = 62): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.filingStatus = 'marriedFilingJointly'
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: ownerPlanningAge, source: 'manual' },
  }
  plan.household.people.push({
    id: 'p2',
    name: 'Sam',
    dob: '1966-01-01',
    sex: 'average',
    retirementAge: 60,
    longevity: { planningAge: 95, source: 'manual' },
  })
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.accounts = []
  plan.incomes = []
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function cash(balance: number, id = 'cash1'): Account {
  return { type: 'cash', id, name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance, annualContribution: 0 }
}

function spia(payoutForm: AnnuityPayoutForm | undefined, premium = 150_000): Account {
  return {
    type: 'annuity',
    id: 'ann1',
    name: 'SPIA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 60,
    monthlyAmount: 10_000 / 12,
    colaPct: 0,
    taxablePct: 100,
    purchase: { year: 2026, premium, fundingAccountId: 'cash1', taxQualification: 'nonQualified' },
    payoutForm,
  }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

const run = (plan: Plan) => simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })

describe('payout-form feature-off identity', () => {
  it("an explicit 'lifeOnly' form is byte-identical to no form at all", () => {
    const withoutForm = couplePlan()
    withoutForm.accounts = [cash(200_000), spia(undefined)]
    const withForm = couplePlan()
    withForm.accounts = [cash(200_000), spia({ kind: 'lifeOnly' })]
    expect(JSON.stringify(run(withForm).years)).toBe(JSON.stringify(run(withoutForm).years))
  })

  it('life-only payments stop at the owner’s death (legacy behavior)', () => {
    const plan = couplePlan()
    plan.accounts = [cash(200_000), spia(undefined)]
    const result = run(plan)
    expect(result.years.find((y) => y.year === 2028)!.incomes.annuity).toBeCloseTo(10_000, 0)
    expect(result.years.find((y) => y.year === 2029)!.incomes.annuity).toBeCloseTo(0, 0)
  })
})

describe('period-certain form', () => {
  it('continues guaranteed payments to the household after the owner dies, then stops at the window’s end', () => {
    const plan = couplePlan()
    plan.accounts = [cash(200_000), spia({ kind: 'periodCertain', certainYears: 30 })]
    const result = run(plan)
    // Owner (planning age 62) is dead from 2029, but the 30-year guarantee
    // from the 2026 start pays the household through 2055.
    expect(result.years.find((y) => y.year === 2029)!.incomes.annuity).toBeCloseTo(10_000, 0)
    expect(result.years.find((y) => y.year === 2055)!.incomes.annuity).toBeCloseTo(10_000, 0)
    expect(result.years.find((y) => y.year === 2056)!.incomes.annuity).toBeCloseTo(0, 0)
  })

  it('floors the exclusion multiple at the guaranteed years (Pub 939 method, hand-worked)', () => {
    // $150,000 premium, $10,000/yr at age 60. Life multiple (Table V) is 24.2;
    // a 30-year guarantee floors the expected payment years at 30 → expected
    // return $300,000 → exclusion ratio 150,000/300,000 = 0.5 → $5,000 of each
    // payment is taxable while the investment is unrecovered.
    const plan = couplePlan()
    plan.accounts = [cash(200_000), spia({ kind: 'periodCertain', certainYears: 30 })]
    const result = run(plan)
    expect(result.years[0]!.magi).toBeCloseTo(5_000, 0)
    // The beneficiary continues the same excludable share after the owner dies.
    expect(result.years.find((y) => y.year === 2029)!.magi).toBeCloseTo(5_000, 0)
  })

  it('a guarantee shorter than life expectancy leaves the Table V multiple unchanged', () => {
    // 10-year certain < 24.2-year Table V multiple → exclusion ratio identical
    // to life-only: 150,000 / 242,000 → taxable 10,000 × (1 − 0.6198) ≈ 3,802.
    const plan = couplePlan()
    plan.accounts = [cash(200_000), spia({ kind: 'periodCertain', certainYears: 10 })]
    const lifeOnly = couplePlan()
    lifeOnly.accounts = [cash(200_000), spia(undefined)]
    expect(run(plan).years[0]!.magi).toBeCloseTo(run(lifeOnly).years[0]!.magi, 6)
  })
})

describe('joint-and-survivor form', () => {
  it('pays the survivor share after the owner dies, for the survivor’s lifetime', () => {
    const plan = couplePlan()
    plan.accounts = [cash(200_000), spia({ kind: 'jointSurvivor', survivorPct: 50 })]
    const result = run(plan)
    // Full payment while the owner lives …
    expect(result.years.find((y) => y.year === 2028)!.incomes.annuity).toBeCloseTo(10_000, 0)
    // … then 50% to the surviving joint annuitant (p2, alive to 95 = 2061).
    expect(result.years.find((y) => y.year === 2029)!.incomes.annuity).toBeCloseTo(5_000, 0)
    expect(result.years.find((y) => y.year === 2061)!.incomes.annuity).toBeCloseTo(5_000, 0)
    // The projection (and the payments) end with the survivor's life.
    expect(result.endYear).toBe(2061)
  })

  it('weights the exclusion multiple by the survivor share of the joint expectancy (method oracle)', () => {
    // Pub 939 General Rule, expectation decomposition: full payment for the
    // owner's Table V years (24.2 at 60), survivor share for the years the
    // joint annuitant outlives them (joint last-survivor expectancy − 24.2).
    const plan = couplePlan()
    plan.accounts = [cash(200_000), spia({ kind: 'jointSurvivor', survivorPct: 50 })]
    const result = run(plan)
    const lifeMultiple = 24.2
    const jointMultiple = jointLastSurvivorExpectancy(60, 'average', 60, 'average')
    expect(jointMultiple).toBeGreaterThan(lifeMultiple)
    const effective = lifeMultiple + 0.5 * (jointMultiple - lifeMultiple)
    const ratio = Math.min(1, 150_000 / (10_000 * effective))
    expect(result.years[0]!.magi).toBeCloseTo(10_000 * (1 - ratio), 0)
    // Survivor years keep the same excludable share of the reduced payment.
    expect(result.years.find((y) => y.year === 2029)!.magi).toBeCloseTo(5_000 * (1 - ratio), 0)
  })

  it('rejects a joint-and-survivor form on a single-person household', () => {
    const plan = couplePlan()
    plan.household.people = [plan.household.people[0]!]
    plan.household.filingStatus = 'single'
    plan.accounts = [cash(200_000), spia({ kind: 'jointSurvivor', survivorPct: 50 })]
    const parsed = parsePlan(plan)
    expect(parsed.ok).toBe(false)
    if (!parsed.ok) expect(parsed.issues.join(' ')).toContain('two-person household')
  })
})

describe('annuity ladders (multiple dated purchases)', () => {
  it('funds and pays each tranche independently from its own purchase year', () => {
    const plan = couplePlan(95) // owner alive throughout
    const tranche = (id: string, year: number, startAge: number): Account => ({
      type: 'annuity',
      id,
      name: `SPIA ${year}`,
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge,
      monthlyAmount: 500,
      colaPct: 0,
      taxablePct: 100,
      purchase: { year, premium: 50_000, fundingAccountId: 'cash1', taxQualification: 'nonQualified' },
    })
    plan.accounts = [cash(200_000), tranche('ann-a', 2026, 60), tranche('ann-b', 2029, 63)]
    const result = run(plan)
    // 2026: first premium out, first tranche paying.
    const y2026 = result.years.find((y) => y.year === 2026)!
    expect(y2026.incomes.annuity).toBeCloseTo(6_000, 0)
    expect(y2026.balances['cash1']).toBeCloseTo(200_000 - 50_000 + 6_000, 0)
    // 2028: still one tranche.
    expect(result.years.find((y) => y.year === 2028)!.incomes.annuity).toBeCloseTo(6_000, 0)
    // 2029: second premium out, both tranches paying.
    const y2029 = result.years.find((y) => y.year === 2029)!
    expect(y2029.incomes.annuity).toBeCloseTo(12_000, 0)
    // Each tranche's exclusion ratio is priced at its own start age: 50,000 ÷
    // (6,000 × Table V) with 24.2 at 60 and 21.6 at 63.
    expect(result.years[0]!.magi).toBeCloseTo(6_000 * (1 - 50_000 / (6_000 * 24.2)), 0)
    const secondTrancheTaxable = 6_000 * (1 - 50_000 / (6_000 * 21.6))
    expect(y2029.magi).toBeCloseTo(6_000 * (1 - 50_000 / (6_000 * 24.2)) + secondTrancheTaxable, 0)
  })
})
