/** Moving in retirement — mid-plan relocation changes state tax. */

import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'moving-state-tax'

export function buildMovingStateTax(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Moving in retirement (state tax)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [{ fromYear: EXAMPLE_FIXED_YEAR + 3, fromMonth: 7, state: 'KY' }],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Avery', dob: '1966-01-01', sex: 'average', retirementAge: 62, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash', ownerPersonId: null, annualReturnPct: 2, balance: 150_000, annualContribution: 0 },
    { type: 'taxable', id: exampleEntityId(EXAMPLE_ID, 'brokerage'), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 600_000, costBasis: 400_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'recurring', id: exampleEntityId(EXAMPLE_ID, 'consulting'), label: 'Consulting', annualAmount: 100_000, startYear: EXAMPLE_FIXED_YEAR, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
  ]
  plan.expenses = {
    baseAnnual: 65_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 700, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 },
  }
  plan.scenarios = [
    { id: exampleEntityId(EXAMPLE_ID, 'stay-fl'), name: 'Stay in Florida', patch: { household: { stateMoves: [] } } },
    { id: exampleEntityId(EXAMPLE_ID, 'move-ky'), name: 'Move to Kentucky sooner', patch: { household: { stateMoves: [{ fromYear: EXAMPLE_FIXED_YEAR + 1, fromMonth: 7, state: 'KY' }] } } },
  ]
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 95_000,
    heirTaxRatePct: 22,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`moving state tax invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
