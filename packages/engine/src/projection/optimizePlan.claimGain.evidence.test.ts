import { expect, it } from 'vitest'

import { describeCalculation, withinTolerance } from '../rules/describeCalculation.js'
import { createEmptyPlan, parsePlan, type Plan } from '../model/plan.js'
import { compareScalars } from '../scenarios/scalarComparison.js'
import { createFederalTaxCalculator } from '../tax/federalTax.js'
import { socialSecurityIncome } from '../testing/planFixtures.js'
import { optimizePlanCoOptimizingClaimAge } from './optimizePlan.js'
import { simulatePlan, type SimulateOptions } from './simulate.js'

/** The production federal tax stack from 2026, the co-optimizer's own inputs. */
function federalOptions(): SimulateOptions {
  return { startYear: 2026, taxCalculator: createFederalTaxCalculator() }
}

/**
 * One person with a cash balance and nothing to convert, so every conversion
 * schedule is empty and no retirement-action readiness question arises; only
 * the claim age can move the after-tax estate.
 */
function cashClaimPlan(options: { dob: string; planningAge: number; claimAgeYears: number; baseAnnual: number }): Plan {
  let counter = 0
  const plan = createEmptyPlan({
    newId: () => `claim-gain-${++counter}`,
    now: () => new Date('2026-06-11T00:00:00.000Z'),
  })
  plan.household.people[0] = {
    id: 'p1',
    name: 'Pat',
    dob: options.dob,
    sex: 'average',
    retirementAge: 62,
    longevity: { planningAge: options.planningAge, source: 'manual' },
  }
  plan.assumptions.inflationPct = 0
  plan.assumptions.healthcareExtraInflationPct = 0
  plan.assumptions.defaultReturnPct = 0
  plan.assumptions.stateEffectiveTaxPct = 0
  plan.expenses.baseAnnual = options.baseAnnual
  plan.expenses.healthcare = { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 0 }
  plan.incomes = [socialSecurityIncome('ss', 2_600, options.claimAgeYears)]
  plan.accounts = [
    { type: 'cash', id: 'cash', name: 'Cash', ownerPersonId: null, annualReturnPct: 0, balance: 400_000, annualContribution: 0 },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(parsed.issues.join('; '))
  return parsed.plan
}

describeCalculation(
  'claim-change-estate-gain',
  {
    example: {
      inputs: {
        caseR: { currentClaimExactEstate: 1_000_000, jointExactEstate: 1_118_000 },
        caseS: { dob: '1956-01-01', planningAge: 70, claimAgeYears: 70, baseAnnual: 20_000 },
        caseT: { currentClaimExactEstate: 2_103_456.78, jointExactEstate: 2_109_001.02 },
        winningPlan: { dob: '1964-01-01', planningAge: 95, claimAgeYears: 62, baseAnnual: 20_000 },
        switchMarginDollars: 1_000,
      },
      expected: {
        caseR: 118_000,
        caseS: 0,
        caseT: 5_544.2400000002235,
        caseSEstateYear: 2026,
        winningEstateYear: 2059,
      },
      tolerance: { abs: 0 },
    },
    worksheet: 'DOCS/calculations/optimizer-and-comparisons/claim-age-co-optimization-estate-gain.md',
    mutation: 'DOCS/calculations/optimizer-and-comparisons/claim-age-co-optimization-estate-gain.mutation.md',
  },
  ({ example }) => {
    const inputs = example.inputs as Record<string, Record<string, number | string>>
    const expected = example.expected as Record<string, number>

    it('cases R and T: the gain is the joint estate minus the current-claim estate, never the reverse', () => {
      for (const key of ['caseR', 'caseT']) {
        const c = inputs[key] as { currentClaimExactEstate: number; jointExactEstate: number }
        const gain = compareScalars(c.currentClaimExactEstate, c.jointExactEstate).delta
        expect(withinTolerance(gain, expected[key]!, example.tolerance), `${key}: ${gain}`).toBe(true)
        // Current minus joint reads the gain as a loss on a card that says "more".
        expect(c.currentClaimExactEstate - c.jointExactEstate).toBe(-expected[key]!)
      }
    })

    it('case S: with nothing to convert and the claim already at 70, no candidate clears the margin and the gain is exactly 0', async () => {
      const plan = cashClaimPlan(inputs.caseS as { dob: string; planningAge: number; claimAgeYears: number; baseAnnual: number })
      const joint = await optimizePlanCoOptimizingClaimAge(plan, federalOptions())
      expect(joint.claimAge.winningClaimPatch).toBeNull()
      expect(joint.claimAge.jointExactEstate).toBe(joint.claimAge.currentClaimExactEstate)
      expect(Object.is(joint.claimAge.claimChangeEstateGain, expected.caseS)).toBe(true)
      expect(joint.claimAge.estateYear).toBe(expected.caseSEstateYear)
    })

    it('a plan whose claim change wins publishes the joint minus current estate, more than the $1,000 margin, in its last year\'s dollars', async () => {
      const plan = cashClaimPlan(inputs.winningPlan as { dob: string; planningAge: number; claimAgeYears: number; baseAnnual: number })
      const joint = await optimizePlanCoOptimizingClaimAge(plan, federalOptions())
      const claim = joint.claimAge
      expect(claim.winningClaimLabel).not.toBeNull()
      expect(claim.winningClaimPatch).not.toBeNull()
      expect(claim.claimChangeEstateGain).toBe(claim.jointExactEstate - claim.currentClaimExactEstate)
      expect(claim.claimChangeEstateGain).toBeGreaterThan(inputs.switchMarginDollars as unknown as number)
      expect(claim.estateYear).toBe(expected.winningEstateYear)
      expect(claim.estateYear).toBe(simulatePlan(plan, federalOptions()).endYear)
    })
  },
)
