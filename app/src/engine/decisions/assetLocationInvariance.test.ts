/**
 * Asset-location invariance (trust-and-transparency-layer, step 4).
 *
 * The community's six-figure Roth bug class: tools that quietly assume Roth
 * dollars grow faster than traditional dollars (e.g. "Roth is invested more
 * aggressively") manufacture conversion benefits out of a hidden allocation
 * change instead of tax law. These fixtures prove RetireGolden doesn't:
 *
 *  1. When source and destination share the same allocation, a zero-tax
 *     conversion leaves every year's investable total and net worth
 *     byte-identical — converted dollars earn exactly what they earned before.
 *  2. The entire after-tax-estate benefit of such a conversion is the heir-tax
 *     term, to the dollar — no phantom growth component.
 *  3. Conversion candidates in the decision engine carry only a schedule,
 *     never an account/allocation patch, so recommendations are evaluated on
 *     an allocation-constant portfolio by construction.
 *  4. Control: giving the Roth a deliberately hotter allocation *does* move
 *     the totals — the engine responds to the user's explicit allocation
 *     choice, not to the account type.
 *
 * Cited by DOCS/product/posture/methodology-and-validation-page.md and the
 * in-app "How RetireGolden is tested" page.
 */
import { describe, expect, it } from 'vitest'

import type { AssetAllocationPolicy, Plan } from '../model/plan'
import { createEmptyPlan } from '../model/plan'
import { summarizeProjection } from '../projection/compare'
import { simulatePlan } from '../projection/simulate'
import { createDecisionContext } from './evaluateCandidate'
import { simpleRothConversionGenerator, noConversionGenerator } from './generators'
import { simOptions, testIds, fixedNow, validate } from './decisionFixtures'

const BALANCED: AssetAllocationPolicy = {
  mode: 'static',
  rebalancing: 'annual',
  weights: { usStocks: 60, intlStocks: 0, bonds: 40, cash: 0 },
}
const ALL_STOCK: AssetAllocationPolicy = {
  mode: 'static',
  rebalancing: 'annual',
  weights: { usStocks: 100, intlStocks: 0, bonds: 0, cash: 0 },
}

const TRAD_ID = 'inv-trad'
const ROTH_ID = 'inv-roth'

/**
 * Retired single filer, 66 in 2026, horizon ends at 72 (before RMDs), no
 * income: a $15k/yr conversion sits under the 65+ standard deduction, so the
 * conversion itself is taxed at exactly $0 — any total-balance difference
 * versus baseline could only come from a hidden growth assumption.
 */
function invariancePlan(rothAllocation: AssetAllocationPolicy): Plan {
  const plan = createEmptyPlan({ newId: testIds, now: fixedNow })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: '1960-01-01',
    sex: 'average',
    retirementAge: 65,
    longevity: { planningAge: 72, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = 0
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.accounts = [
    { type: 'traditional', id: TRAD_ID, name: 'IRA', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 600_000, annualContribution: 0, allocation: BALANCED },
    { type: 'roth', id: ROTH_ID, name: 'Roth', ownerPersonId: 'p1', annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0, allocation: rothAllocation },
    { type: 'cash', id: testIds(), name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 100_000, annualContribution: 0 },
  ]
  return validate(plan)
}

function withConversions(plan: Plan): Plan {
  return validate({
    ...plan,
    strategies: {
      ...plan.strategies,
      rothConversion: {
        mode: 'manual',
        conversions: [
          { year: 2026, amount: 15_000 },
          { year: 2027, amount: 15_000 },
          { year: 2028, amount: 15_000 },
        ],
      },
    },
  })
}

describe('asset-location invariance of Roth conversions', () => {
  it('a zero-tax conversion between identically-allocated accounts leaves every year\'s totals identical', () => {
    const baselinePlan = invariancePlan(BALANCED)
    const conversionPlan = withConversions(baselinePlan)

    const baseline = simulatePlan(baselinePlan, simOptions())
    const converted = simulatePlan(conversionPlan, simOptions())

    expect(converted.years).toHaveLength(baseline.years.length)
    for (let i = 0; i < baseline.years.length; i++) {
      const b = baseline.years[i]!
      const c = converted.years[i]!
      // The premise: the conversion truly is tax-free in both runs.
      expect(b.tax + b.penalties).toBe(0)
      expect(c.tax + c.penalties).toBe(0)
      // The invariance: moving dollars from traditional to Roth changes
      // nothing about how the portfolio grows.
      expect(c.investableTotal).toBeCloseTo(b.investableTotal, 6)
      expect(c.netWorth).toBeCloseTo(b.netWorth, 6)
    }
    // The conversions actually executed (the test isn't vacuous).
    const totalConverted = converted.years.reduce((sum, y) => sum + y.rothConversion, 0)
    expect(totalConverted).toBeCloseTo(45_000, 2)
  })

  it('the estate benefit of that conversion is exactly the heir-tax term — no phantom growth', () => {
    const baselinePlan = invariancePlan(BALANCED)
    const conversionPlan = withConversions(baselinePlan)

    const baseline = simulatePlan(baselinePlan, simOptions())
    const converted = simulatePlan(conversionPlan, simOptions())
    const baselineEstate = summarizeProjection(baselinePlan, baseline).endingAfterTaxEstate
    const convertedEstate = summarizeProjection(conversionPlan, converted).endingAfterTaxEstate

    const lastBaseline = baseline.years[baseline.years.length - 1]!
    const lastConverted = converted.years[converted.years.length - 1]!
    const traditionalShifted = lastBaseline.balances[TRAD_ID]! - lastConverted.balances[TRAD_ID]!
    expect(traditionalShifted).toBeGreaterThan(45_000) // converted principal plus its growth

    // heirTaxRatePct = 25: the whole benefit is tax, priced on the shifted balance.
    const estateDelta = convertedEstate - baselineEstate
    expect(estateDelta).toBeCloseTo(traditionalShifted * 0.25, 2)
  })

  it('conversion candidates patch only the schedule — never accounts or allocations', () => {
    const plan = invariancePlan(BALANCED)
    const ctx = createDecisionContext(plan, simOptions())
    const candidates = [...simpleRothConversionGenerator.generate(ctx), ...noConversionGenerator.generate(ctx)]
    expect(candidates.length).toBeGreaterThan(0)
    for (const candidate of candidates) {
      // A candidate may carry an explicit schedule or patch the conversion
      // strategy — but never accounts, allocations, or return assumptions.
      const patch = candidate.planPatch
      if (patch === undefined) continue
      expect(Object.keys(patch), `${candidate.id} may only patch strategies`).toEqual(['strategies'])
      const strategies = patch.strategies as Record<string, unknown>
      expect(Object.keys(strategies), `${candidate.id} may only patch the conversion strategy`).toEqual(['rothConversion'])
    }
  })

  it('control: an explicitly hotter Roth allocation does change outcomes (user choice, not account type)', () => {
    const baselinePlan = invariancePlan(ALL_STOCK)
    const conversionPlan = withConversions(baselinePlan)

    const baseline = simulatePlan(baselinePlan, simOptions())
    const converted = simulatePlan(conversionPlan, simOptions())

    const last = baseline.years.length - 1
    const diff = converted.years[last]!.investableTotal - baseline.years[last]!.investableTotal
    // Dollars moved into the 100%-stock Roth now compound faster — visible,
    // explicit, and attributable to the user's allocation setting.
    expect(diff).toBeGreaterThan(1_000)
  })
})
