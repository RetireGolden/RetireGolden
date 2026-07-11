/**
 * Funded-ratio consistency: the ratio must be a pure PV of the ledger's own
 * years (acceptance: "ratio consistent with ledger PV"), so these fixtures
 * assert it against hand-discounted flows from the same projection.
 */
import { describe, expect, it } from 'vitest'

import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { EMBEDDED_REAL_YIELD_CURVE } from '../params/index.js'
import { createFlatTaxCalculator } from '../projection/flatTax.js'
import { simulatePlan } from '../projection/simulate.js'
import { computeFundedRatio } from './fundedRatio.js'
import { realPresentValue, realYieldAt } from './ladderMath.js'

let counter = 0
const testIds = () => `fr-${++counter}`
const fixedNow = () => new Date('2026-06-11T00:00:00.000Z')
const noTax = createFlatTaxCalculator(0)

function basePlan(): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1961-01-01', // 65 in 2026
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 85, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.accounts = [
    { type: 'cash', id: 'cash1', name: 'Cash', ownerPersonId: null, annualReturnPct: null, balance: 2_000_000, annualContribution: 0 },
  ]
  plan.incomes = []
  plan.expenses.baseAnnual = 60_000
  plan.expenses.requiredAnnual = 40_000
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  return plan
}

function run(plan: Plan) {
  const r = parsePlan(plan)
  if (!r.ok) throw new Error(r.issues.join('; '))
  return simulatePlan(r.plan, { startYear: 2026, taxCalculator: noTax })
}

const flatDeflate = (_year: number, amount: number) => amount // 0% inflation fixtures

describe('computeFundedRatio', () => {
  it('matches a hand-discounted PV of the ledger years', () => {
    const plan = basePlan()
    plan.incomes = [
      { type: 'socialSecurity', id: 'ss1', personId: 'p1', piaMonthly: 2_500, earnings: null, claimAge: { years: 66, months: 0 } },
    ]
    const result = run(plan)
    const fr = computeFundedRatio({
      years: result.years,
      startYear: 2026,
      deflate: flatDeflate,
      curve: EMBEDDED_REAL_YIELD_CURVE,
    })!
    expect(fr).not.toBeNull()
    const essentialByHand = realPresentValue(
      result.years.map((y) => ({ yearsFromNow: y.year - 2026, realAmount: y.expenses.requiredSpending })),
      EMBEDDED_REAL_YIELD_CURVE,
    )
    const guaranteedByHand = realPresentValue(
      result.years.map((y) => ({ yearsFromNow: y.year - 2026, realAmount: y.incomes.socialSecurity })),
      EMBEDDED_REAL_YIELD_CURVE,
    )
    expect(fr.essentialSpendingPv).toBeCloseTo(essentialByHand, 6)
    expect(fr.guaranteedIncomePv).toBeCloseTo(guaranteedByHand, 6)
    expect(fr.fundedRatioPct).toBeCloseTo((guaranteedByHand / essentialByHand) * 100, 6)
    expect(fr.unfundedPv).toBeCloseTo(Math.max(0, essentialByHand - guaranteedByHand), 6)
  })

  it('a full floor of guaranteed income reads ~100% funded', () => {
    const plan = basePlan()
    // Pre-65 window (no automatic Medicare premiums in required spending) with
    // a pension exactly covering the required floor from day one.
    plan.household.people[0]!.dob = '1971-01-01' // 55 in 2026
    plan.household.people[0]!.retirementAge = 55
    plan.household.people[0]!.longevity = { planningAge: 64, source: 'manual' }
    plan.accounts.push({
      type: 'pension',
      id: 'pen1',
      name: 'Pension',
      ownerPersonId: 'p1',
      annualReturnPct: null,
      startAge: 55,
      monthlyAmount: 40_000 / 12,
      colaPct: 0,
      survivorPct: 0,
    })
    const result = run(plan)
    const fr = computeFundedRatio({ years: result.years, startYear: 2026, deflate: flatDeflate, curve: EMBEDDED_REAL_YIELD_CURVE })!
    expect(fr.fundedRatioPct).toBeCloseTo(100, 1)
    expect(fr.unfundedPv).toBeLessThan(fr.essentialSpendingPv * 0.01)
  })

  it('a TIPS ladder lifts the funded ratio through the same ledger flows', () => {
    const withLadder = basePlan()
    withLadder.incomeFloor = {
      ladders: [
        { id: 'lad1', name: 'Floor', purpose: 'floor', startYear: 2027, endYear: 2045, annualRealAmount: 20_000, purchase: { year: 2026, fundingAccountId: 'cash1' } },
      ],
    }
    const bare = computeFundedRatio({ years: run(basePlan()).years, startYear: 2026, deflate: flatDeflate, curve: EMBEDDED_REAL_YIELD_CURVE })!
    const laddered = computeFundedRatio({ years: run(withLadder).years, startYear: 2026, deflate: flatDeflate, curve: EMBEDDED_REAL_YIELD_CURVE })!
    expect(laddered.fundedRatioPct).toBeGreaterThan(bare.fundedRatioPct + 20)
  })

  it('returns null when there is nothing to measure', () => {
    expect(computeFundedRatio({ years: [], startYear: 2026, deflate: flatDeflate, curve: EMBEDDED_REAL_YIELD_CURVE })).toBeNull()
  })

  it('sanity: the curve actually discounts (later dollars are cheaper)', () => {
    expect(realYieldAt(EMBEDDED_REAL_YIELD_CURVE, 30)).toBeGreaterThan(0)
  })
})
