/** Under-saved single retiree — spending outpaces savings toward a depletion year. */

import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'under-saved-single'

export function buildUnderSavedSingle(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Under-saved single retiree', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Jordan', dob: '1962-01-01', sex: 'average', retirementAge: 62, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Savings', ownerPersonId: null, annualReturnPct: 2, balance: 75_000, annualContribution: 0 },
    { type: 'taxable', id: exampleEntityId(EXAMPLE_ID, 'brokerage'), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 250_000, costBasis: 180_000, annualContribution: 0 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'ira'), name: 'Traditional IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 300_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'recurring', id: exampleEntityId(EXAMPLE_ID, 'consulting'), label: 'Part-time consulting', annualAmount: 20_000, startYear: null, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  plan.expenses = {
    baseAnnual: 72_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 650, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 200 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 35_000,
    heirTaxRatePct: 22,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`under-saved single invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
