/**
 * A state standard deduction once the IRS's 2027 income-tax figures land on
 * their own (decision D-2027-ROLLOVER; review V1, 2026-09-29).
 *
 * The maintenance schedule lands each publisher when it publishes, the IRS
 * income-tax figures in October. The state calculator used to scale two kinds
 * of deduction by the income-tax figures' projection factor, which becomes 1
 * in a year the IRS has been loaded for:
 *
 * - a deduction that follows the federal one (Colorado's) scaled the state
 *   pack's copy of the 2026 federal basic, so it fell back to $16,100 while
 *   the federal deduction was the loaded $16,500;
 * - a deduction the state's own statute indexes (the District's from 2027,
 *   Washington's from 2029) stopped indexing: the District's fell from $15,350
 *   to $15,000.
 *
 * Now the first conforms to the year's federal basic in the composed parameter
 * view, loaded or projected, and the second indexes at the plan's inflation
 * from the state figures' year (`TaxYearInput.stateIndexingScale`). The
 * optimizer LP's state segments index the same way. The IRS's 2027 figures
 * here are illustrative (the 2026 set with a $16,500 and $33,000 standard
 * deduction), landed through the test seam.
 */
import { describe, expect, it } from 'vitest'

import type { Plan } from '../model/plan.js'
import { componentScale, packForYear, withParameterComponents } from '../params/index.js'
import { flatInflationPath } from '../params/indexingScale.js'
import { buildOptimizerInput } from '../projection/optimizePlan.js'
import { simulatePlan } from '../projection/simulate.js'
import type { TaxCalculator, TaxYearInput } from '../projection/types.js'
import { landedComponents } from '../testing/parameterLanding.js'
import { cashAccount, productionTaxCalculator, singlePersonPlan, traditionalAccount, validatePlan } from '../testing/planFixtures.js'
import { computeStateTaxYearResult, computeStateTaxYearTotal } from './stateTax.js'

const LANDED_DEDUCTION = { single: 16_500, marriedFilingJointly: 33_000 }
const irs2027 = () => landedComponents(['irsIncomeTax'], 2027, { 'federalTax.standardDeduction': LANDED_DEDUCTION })
const path = flatInflationPath(0.025)

/** A single filer with $60,000 of wages in 2027, taxed as the ledger taxes that year. */
function household(state: string): TaxYearInput {
  return {
    year: 2027,
    filingStatus: 'single',
    ordinaryIncome: 60_000,
    capitalGains: 0,
    ssBenefits: 0,
    peopleAged65Plus: 0,
    state,
    agesAlive: [50],
    // The ledger's two scales: the IRS income-tax figures' projection, and the
    // plan's inflation from the state figures' year.
    inflationScale: componentScale(packForYear(2027), 'irsIncomeTax', 2027, path),
    stateIndexingScale: path(2026, 2027),
  }
}

describe('a state deduction when the IRS income-tax figures for 2027 land alone', () => {
  it('Colorado’s federal-following deduction is the loaded federal $16,500, not the 2026 $16,100', () => {
    const projected = computeStateTaxYearResult(household('CO'))
    const landed = withParameterComponents(irs2027(), () => {
      expect(packForYear(2027).pack.federalTax.standardDeduction).toEqual(LANDED_DEDUCTION)
      expect(household('CO').inflationScale).toBe(1)
      return { detail: computeStateTaxYearResult(household('CO')), total: computeStateTaxYearTotal(household('CO')) }
    })
    // Projected: the 2026 $16,100 at 2.5%, $16,502.50. Landed: the IRS's own.
    expect(projected.taxableIncome).toBeCloseTo(60_000 - 16_502.5, 6)
    expect(landed.detail.taxableIncome).toBeCloseTo(60_000 - 16_500, 6)
    // The year total (the ledger's own call) conforms the same way; Colorado's
    // tax is a flat rate on that taxable income.
    const rate = projected.totalTax / projected.taxableIncome
    expect(landed.total).toBeCloseTo((60_000 - 16_500) * rate, 6)
  })

  it('the District’s own indexing continues: $15,350 in 2027 at 2.5%, whether or not the IRS has landed', () => {
    const tax = 10_000 * 0.04 + 30_000 * 0.06 + (60_000 - 15_350 - 40_000) * 0.065
    expect(computeStateTaxYearResult(household('DC')).totalTax).toBeCloseTo(tax, 6)
    expect(computeStateTaxYearTotal(household('DC'))).toBeCloseTo(tax, 6)
    withParameterComponents(irs2027(), () => {
      expect(computeStateTaxYearResult(household('DC')).totalTax).toBeCloseTo(tax, 6)
      expect(computeStateTaxYearTotal(household('DC'))).toBeCloseTo(tax, 6)
    })
  })

  it('the ledger hands the state calculator the plan’s inflation, not the income-tax projection', () => {
    const seen: { inflationScale?: number; stateIndexingScale?: number }[] = []
    const production = productionTaxCalculator()
    const recording: TaxCalculator = {
      compute: (input) => {
        if (input.year === 2027) seen.push({ inflationScale: input.inflationScale, stateIndexingScale: input.stateIndexingScale })
        return production.compute(input)
      },
    }
    const plan = (): Plan => {
      const draft = singlePersonPlan({ dob: '1976-06-15', planningAge: 90, state: 'DC' })
      draft.id = 'dc-landing'
      draft.assumptions.inflationPct = 2.5
      draft.accounts = [cashAccount('cash', 500_000)]
      draft.incomes = [{ type: 'wages', id: 'w1', personId: 'p1', annualGross: 60_000, endAge: null, realGrowthPct: 0 } as Plan['incomes'][number]]
      return validatePlan(draft)
    }
    withParameterComponents(irs2027(), () =>
      simulatePlan(plan(), { startYear: 2026, horizonEndYear: 2027, taxCalculator: recording }),
    )
    expect(seen.length).toBeGreaterThan(0)
    for (const input of seen) {
      expect(input.inflationScale).toBe(1)
      expect(input.stateIndexingScale).toBeCloseTo(1.025, 12)
    }
    // With nothing landed the two scales are the same number, so the published
    // tax input leaves the state scale out and keeps the shape it had.
    const unlanded = simulatePlan(plan(), { startYear: 2026, horizonEndYear: 2027, taxCalculator: productionTaxCalculator() })
    for (const row of unlanded.years) {
      expect(row.acceptedTaxInput).toBeDefined()
      expect(Object.keys(row.acceptedTaxInput!)).not.toContain('stateIndexingScale')
      expect(row.advisoryFederalTax).toBeDefined()
      expect(Object.keys(row.advisoryFederalTax!.input)).not.toContain('stateIndexingScale')
    }
  })

  it('the optimizer LP indexes Washington’s deduction at the plan’s inflation, whether or not the IRS has landed', () => {
    // Washington's $1,000,000 deduction (ESSB 6346, from 2028) is indexed from
    // 2029: $1,025,000 at 2.5%. The LP's first state segment is the part of it
    // above the federal deduction, so the two add up to Washington's figure.
    const plan = (): Plan => {
      const draft = singlePersonPlan({ dob: '1970-06-15', planningAge: 62, state: 'WA' })
      draft.id = 'wa-landing'
      draft.assumptions.inflationPct = 2.5
      draft.accounts = [traditionalAccount('ira', 800_000, 'p1', 'ira'), cashAccount('cash', 200_000)]
      return validatePlan(draft)
    }
    const washington2029 = (): number => {
      const year = buildOptimizerInput(plan(), { startYear: 2029, taxCalculator: productionTaxCalculator() }).years.find((y) => y.year === 2029)!
      const zeroBand = year.stateBrackets![0]!
      expect(zeroBand.rate).toBe(0)
      return zeroBand.width! + year.pack.federalTax.standardDeduction.single
    }
    expect(washington2029()).toBeCloseTo(1_025_000, 6)
    expect(withParameterComponents(irs2027(), washington2029)).toBeCloseTo(1_025_000, 6)
  })
})
