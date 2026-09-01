/** Early retiree and the ACA cliff — pre-65 MAGI vs premium-credit cliff. */

import type { Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, createExamplePlan, exampleEntityId, parseExamplePlan } from './buildContext'

const EXAMPLE_ID = 'early-retiree-aca'

export function buildEarlyRetireeAca(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createExamplePlan({
    exampleId: EXAMPLE_ID,
    name: 'Early retiree & the ACA cliff',
    strategies: {
      // The baseline must keep MAGI under 400% FPL for a single filer so the
      // current year shows a positive credit; filling the 12% bracket lands MAGI
      // above the cliff regardless of other income, so the demo (raise the
      // bracket, watch the credit vanish) only works from the 10% baseline.
      rothConversion: {
        mode: 'fillToTarget',
        target: 'topOfBracket',
        targetValue: 10,
        startYear: EXAMPLE_FIXED_YEAR,
        endYear: EXAMPLE_FIXED_YEAR + 4,
      },
    },
    assumptions: {
      healthcareExtraInflationPct: 3,
      defaultReturnPct: 5,
      recentAnnualMagi: 50_000,
      heirTaxRatePct: 22,
    },
  })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Casey', dob: '1964-01-01', sex: 'female', retirementAge: 58, longevity: { planningAge: 92, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash', ownerPersonId: null, annualReturnPct: 2, balance: 200_000, annualContribution: 0 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'ira'), name: 'Traditional IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 450_000, annualContribution: 0 },
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Roth IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 120_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'recurring', id: exampleEntityId(EXAMPLE_ID, 'consulting'), label: 'Consulting', annualAmount: 18_000, startYear: EXAMPLE_FIXED_YEAR, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
  ]
  plan.expenses = {
    baseAnnual: 40_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 },
  }
  const parsed = parseExamplePlan(plan)
  if (!parsed.ok) throw new Error(`early retiree ACA invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
