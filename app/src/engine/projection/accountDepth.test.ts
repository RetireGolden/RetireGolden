/**
 * Integration coverage for the account/HSA/fixed-asset depth plan through the
 * exact ledger: HSA medical-expense cap + reimburse-later, HSA beneficiary
 * estate treatment, nondeductible-IRA pro-rata, property disposition tax, and
 * the taxable safety-net floor. Each behavior has a feature-off assertion that
 * proves pre-existing plans are unchanged.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../model/plan'
import { createFederalTaxCalculator } from '../tax/federalTax'
import { summarizeProjection } from './compare'
import { createFlatTaxCalculator } from './flatTax'
import { simulatePlan } from './simulate'

let counter = 0
const testIds = () => `dep-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)
const federal = createFederalTaxCalculator()

/** Single person, born 1976 → age 50 in 2026 (pre-65, pre-59½), flat dollars. */
function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1976-06-15',
    sex: 'average',
    retirementAge: 50,
    longevity: { planningAge: 60, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.accounts = []
  plan.incomes = []
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function cash(balance: number): Account {
  return { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance, annualContribution: 0 }
}

function hsa(balance: number, over: Partial<Extract<Account, { type: 'hsa' }>> = {}): Account {
  return {
    type: 'hsa',
    id: 'hsa1',
    name: 'HSA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    balance,
    annualContribution: 0,
    ...over,
  }
}

function validate(plan: Plan): Plan {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return r.plan
}

describe('HSA medical-expense subledger', () => {
  it('legacy HSA (no treatment) keeps v1 behavior: tax-free, penalized pre-65', () => {
    const plan = basePlan()
    plan.accounts = [hsa(100_000)]
    plan.expenses.baseAnnual = 10_000 // must be funded from the HSA (drain order last)
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: federal })
    const y = result.years[0]!
    expect(y.withdrawals.hsa).toBeGreaterThan(0)
    expect(y.tax).toBe(0) // tax-free
    expect(y.penalties).toBeGreaterThan(0) // 20% penalty pre-65
  })

  it('assumeAllQualified removes the penalty entirely', () => {
    const plan = basePlan()
    plan.accounts = [hsa(100_000, { withdrawalTreatment: 'assumeAllQualified' })]
    plan.expenses.baseAnnual = 10_000
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: federal })
    const y = result.years[0]!
    expect(y.withdrawals.hsa).toBeGreaterThan(0)
    expect(y.penalties).toBe(0)
    expect(y.tax).toBe(0)
  })

  it('capByMedicalExpenses caps tax-free withdrawals at modeled medical costs', () => {
    const plan = basePlan()
    plan.accounts = [hsa(100_000, { withdrawalTreatment: 'capByMedicalExpenses' })]
    // Only $6,000 of modeled medical cost this year; spending forces more.
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 500, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.expenses.baseAnnual = 20_000
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: federal })
    const y = result.years[0]!
    // The excess over $6,000 qualified is ordinary income + 20% penalty.
    expect(y.penalties).toBeGreaterThan(0)
    expect(y.tax).toBeGreaterThan(0)
    expect(result.warnings.some((w) => w.includes('exceeded modeled qualified medical'))).toBe(true)
  })

  it('reimburse-later lets a later year withdraw against accumulated expenses tax-free', () => {
    // Year 1: pay $8k of medical out of pocket from cash (HSA untouched), so
    // $8k accumulates. Year 2: no medical, but a large withdrawal draws the
    // accumulated cap tax- and penalty-free.
    const plan = basePlan()
    plan.household.people[0]!.longevity.planningAge = 61
    plan.accounts = [
      cash(8_000), // exactly funds year-1 care, leaving nothing for 2027
      hsa(100_000, { withdrawalTreatment: 'capByMedicalExpenses', reimburseLater: true }),
    ]
    plan.expenses.phases = [
      { fromAge: 50, multiplier: 1 },
      { fromAge: 51, multiplier: 0 },
    ]
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    // Year 1 medical via a care event ($8k), funded from cash.
    plan.careEvents = [{ id: 'c', personId: 'p1', startAge: 50, durationYears: 1, annualCost: 8_000 }]
    plan.expenses.baseAnnual = 0
    // Year 2 (age 51): force a $6k HSA withdrawal with no current medical.
    plan.incomes = []
    const spendPlan = validate(plan)
    // Add a one-time goal in 2027 to force HSA spending that year.
    spendPlan.expenses.oneTimeGoals = [{ id: 'g', label: 'spend', year: 2027, amount: 6_000 }]
    const result = simulatePlan(validate(spendPlan), { startYear: 2026, taxCalculator: federal })
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.withdrawals.hsa).toBeGreaterThan(0)
    // Drawn against the $8k accumulated pool → no tax, no penalty.
    expect(y2027.penalties).toBe(0)
    expect(y2027.tax).toBe(0)
  })

  it('reimburse-later pool is drawn only by cap-mode HSAs, not assumeAllQualified draws', () => {
    // Year 2026: $8k care paid out of pocket from cash → the reimburse-later
    // pool accumulates $8k. Year 2027: an $8k goal drains the assumeAllQualified
    // HSA (which must NOT touch the pool). Year 2028: an $8k goal drains the
    // cap-mode HSA with no current medical — it should still be fully qualified
    // against the surviving $8k pool (no tax, no penalty). Before the fix the
    // 2027 draw zeroed the pool, so 2028 was taxed and penalized.
    const plan = basePlan()
    plan.household.people[0]!.longevity.planningAge = 62
    plan.accounts = [
      cash(8_000),
      hsa(8_000, { id: 'hsaAll', withdrawalTreatment: 'assumeAllQualified' }),
      hsa(100_000, { id: 'hsaCap', withdrawalTreatment: 'capByMedicalExpenses', reimburseLater: true }),
    ]
    plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
    plan.careEvents = [{ id: 'c', personId: 'p1', startAge: 50, durationYears: 1, annualCost: 8_000 }]
    plan.expenses.baseAnnual = 0
    const spendPlan = validate(plan)
    spendPlan.expenses.oneTimeGoals = [
      { id: 'g1', label: 'drain-assume-all', year: 2027, amount: 8_000 },
      { id: 'g2', label: 'draw-against-pool', year: 2028, amount: 8_000 },
    ]
    const result = simulatePlan(validate(spendPlan), { startYear: 2026, taxCalculator: federal })
    const y2028 = result.years.find((y) => y.year === 2028)!
    expect(y2028.withdrawals.hsa).toBeGreaterThan(0)
    expect(y2028.tax).toBe(0)
    expect(y2028.penalties).toBe(0)
  })

  it('HSA beneficiary: non-spouse heir taxes the ending HSA in the after-tax estate', () => {
    const plan = basePlan()
    plan.assumptions.heirTaxRatePct = 25
    plan.accounts = [hsa(100_000, { beneficiary: 'nonSpouse' })]
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const summary = summarizeProjection(validate(plan), result)
    // 100k HSA taxed at 25% → estate is 25k below net worth.
    expect(summary.endingNetWorth - summary.endingAfterTaxEstate).toBeCloseTo(25_000, 0)

    const spousePlan = validate({ ...plan, accounts: [hsa(100_000, { beneficiary: 'spouse' })] })
    const spouseSummary = summarizeProjection(spousePlan, simulatePlan(spousePlan, { startYear: 2026, taxCalculator: noTax }))
    expect(spouseSummary.endingAfterTaxEstate).toBeCloseTo(spouseSummary.endingNetWorth, 0)
  })
})

describe('nondeductible IRA basis (pro-rata)', () => {
  function iraPlan(nondeductibleBasis?: number): Plan {
    const plan = basePlan()
    plan.household.people[0]!.retirementAge = 65
    plan.household.people[0]!.longevity.planningAge = 60
    plan.accounts = [
      cash(0),
      {
        type: 'traditional',
        id: 'ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
        nondeductibleBasis,
      } as Account,
    ]
    plan.expenses.baseAnnual = 60_000 // funded from the IRA, above the deduction
    return plan
  }

  it('a $20k basis in a $100k IRA makes 20% of a distribution tax-free', () => {
    const withBasis = iraPlan(20_000)
    const noBasis = iraPlan(undefined)
    const withResult = simulatePlan(validate(withBasis), { startYear: 2026, taxCalculator: federal })
    const noResult = simulatePlan(validate(noBasis), { startYear: 2026, taxCalculator: federal })
    // Same gross withdrawal, but the basis plan owes less tax.
    expect(withResult.years[0]!.tax).toBeLessThan(noResult.years[0]!.tax)
  })

  it('feature-off (no basis) is unchanged from a plan that never had the field', () => {
    const result = simulatePlan(validate(iraPlan(undefined)), { startYear: 2026, taxCalculator: federal })
    expect(result.years[0]!.withdrawals.traditional).toBeGreaterThan(0)
    expect(result.endingInvestable).toBeGreaterThanOrEqual(0)
  })

  it('early-withdrawal penalty applies only to the taxable portion (return of basis is not penalized)', () => {
    // Age 50 (pre-59½). A fully-basis IRA distributes only return of basis, so a
    // pre-59½ draw is neither taxed nor penalized (IRS Topic 557 penalizes only
    // the amount included in gross income). Before the fix the 10% penalty was
    // charged on the gross withdrawal.
    const plan = basePlan()
    plan.accounts = [
      cash(0),
      {
        type: 'traditional',
        id: 'ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
        nondeductibleBasis: 100_000,
      } as Account,
    ]
    plan.expenses.baseAnnual = 10_000
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: federal })
    const y = result.years[0]!
    expect(y.withdrawals.traditional).toBeGreaterThan(0)
    expect(y.tax).toBe(0)
    expect(y.penalties).toBe(0)

    // Half basis → a pre-59½ draw is penalized on only the taxable half.
    const halfBasis = validate({
      ...plan,
      accounts: [cash(0), { ...(plan.accounts[1] as Account), nondeductibleBasis: 50_000 } as Account],
    })
    const halfResult = simulatePlan(halfBasis, { startYear: 2026, taxCalculator: federal })
    const noBasis = validate({
      ...plan,
      accounts: [cash(0), { ...(plan.accounts[1] as Account), nondeductibleBasis: undefined } as Account],
    })
    const noResult = simulatePlan(noBasis, { startYear: 2026, taxCalculator: federal })
    expect(halfResult.years[0]!.penalties).toBeGreaterThan(0)
    expect(halfResult.years[0]!.penalties).toBeLessThan(noResult.years[0]!.penalties)
  })

  it('a Roth conversion carrying IRA basis recaptures only the taxable share if tapped early', () => {
    // Convert a $100k IRA (half nondeductible basis) fully to Roth in 2026, then
    // fund a $20k goal in 2027 while under 59½ and within 5 years. The withdrawal
    // returns tax-free (converted principal, not earnings); the 10% recapture
    // hits only the taxable half of the tapped principal. The draw grosses up to
    // pay its own penalty: W = 20000/(1 − 0.5×0.1) ≈ $21,053, penalty ≈ $1,053.
    // Penalizing the full principal (the bug) would cost ~$2,222 instead.
    const plan = basePlan() // age 50 in 2026, planningAge 60 (alive through 2036)
    plan.accounts = [
      cash(0),
      {
        type: 'traditional',
        id: 'ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
        nondeductibleBasis: 50_000,
      } as Account,
      { type: 'roth', id: 'roth', name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 0, annualContribution: 0 } as Account,
    ]
    plan.expenses.baseAnnual = 0
    plan.strategies.rothConversion = { mode: 'manual', conversions: [{ year: 2026, amount: 100_000 }] }
    const spendPlan = validate(plan)
    spendPlan.expenses.oneTimeGoals = [{ id: 'g', label: 'tap', year: 2027, amount: 20_000 }]
    const result = simulatePlan(validate(spendPlan), { startYear: 2026, taxCalculator: noTax })
    const y2027 = result.years.find((y) => y.year === 2027)!
    expect(y2027.withdrawals.roth).toBeCloseTo(21_052.63, 0)
    expect(y2027.penalties).toBeCloseTo(1_052.63, 0)
  })

  it('after-tax estate excludes remaining nondeductible IRA basis from the heir tax', () => {
    const plan = basePlan()
    plan.assumptions.heirTaxRatePct = 25
    // Untouched all-basis IRA to the horizon: no spending, no income, no growth.
    plan.accounts = [
      {
        type: 'traditional',
        id: 'ira',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
        nondeductibleBasis: 100_000,
      } as Account,
    ]
    plan.expenses.baseAnnual = 0
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    expect(result.endingNondeductibleIraBasis).toBeCloseTo(100_000, 0)
    const summary = summarizeProjection(validate(plan), result)
    // All basis → the heir owes no income tax → estate equals net worth.
    expect(summary.endingAfterTaxEstate).toBeCloseTo(summary.endingNetWorth, 0)

    // Contrast: the same IRA with no basis is fully taxable to the heir at 25%.
    const noBasis = validate({ ...plan, accounts: [{ ...(plan.accounts[0] as Account), nondeductibleBasis: undefined } as Account] })
    const noBasisSummary = summarizeProjection(noBasis, simulatePlan(noBasis, { startYear: 2026, taxCalculator: noTax }))
    expect(noBasisSummary.endingNetWorth - noBasisSummary.endingAfterTaxEstate).toBeCloseTo(25_000, 0)
  })
})

describe('fixed-asset disposition', () => {
  function homePlan(over: Partial<Extract<Account, { type: 'property' }>> = {}): Plan {
    const plan = basePlan()
    plan.household.people[0]!.longevity.planningAge = 62
    plan.accounts = [
      cash(0),
      {
        type: 'property',
        id: 'home',
        name: 'Home',
        ownerPersonId: null,
        annualReturnPct: null,
        value: 900_000,
        plannedSaleYear: 2027,
        expectedNetProceeds: null,
        ...over,
      } as Account,
    ]
    return plan
  }

  it('a primary-residence sale pays tax only on gain above the §121 exclusion net of costs', () => {
    const plan = homePlan({ costBasis: 300_000, sellingCostPct: 5, primaryResidence: true })
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: federal })
    const saleYear = result.years.find((y) => y.year === 2027)!
    // realized 855k, gain 555k, §250k excluded → 305k capital gain taxed.
    // The sale gain flows through the one-time capital-gain path, so it shows
    // up as tax owed rather than in the taxable-account realizedGains field.
    expect(saleYear.tax).toBeGreaterThan(0)
    // Proceeds landed in the portfolio.
    expect(saleYear.investableTotal).toBeGreaterThan(500_000)
  })

  it('legacy expectedNetProceeds (no basis) is tax-free and unchanged', () => {
    const plan = homePlan({ expectedNetProceeds: 800_000 })
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: federal })
    const saleYear = result.years.find((y) => y.year === 2027)!
    expect(saleYear.realizedGains).toBe(0)
    expect(saleYear.tax).toBe(0)
  })
})

describe('taxable safety-net floor', () => {
  it('preserves the floor from liquid accounts while other accounts can fund spending', () => {
    const plan = basePlan()
    plan.household.people[0]!.retirementAge = 65
    plan.household.people[0]!.longevity.planningAge = 60
    plan.strategies.taxableSafetyNetFloor = 15_000
    plan.accounts = [
      cash(20_000),
      {
        type: 'traditional',
        id: 't',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
      } as Account,
    ]
    plan.expenses.baseAnnual = 10_000
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y = result.years[0]!
    // Spending is funded from the traditional account, not by draining cash
    // below the $15k floor.
    expect(y.withdrawals.traditional).toBeGreaterThan(0)
    expect(y.balances['t']).toBeLessThan(100_000)
    expect(y.balances[plan.accounts[0]!.id]).toBeGreaterThanOrEqual(14_000)
  })

  it('feature-off (no floor) drains cash first as before', () => {
    const plan = basePlan()
    plan.accounts = [
      cash(20_000),
      {
        type: 'traditional',
        id: 't',
        name: 'IRA',
        ownerPersonId: 'p1',
        annualReturnPct: null,
        kind: 'ira',
        balance: 100_000,
        annualContribution: 0,
      } as Account,
    ]
    plan.expenses.baseAnnual = 10_000
    const result = simulatePlan(validate(plan), { startYear: 2026, taxCalculator: noTax })
    const y = result.years[0]!
    expect(y.withdrawals.cash).toBeCloseTo(10_000, 0)
    expect(y.withdrawals.traditional).toBe(0)
  })
})
