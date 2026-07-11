/** Bracket-fill Roth conversions — converting up to a bracket top. */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'bracket-fill-roth'

export function buildBracketFillRoth(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const p2 = exampleEntityId(EXAMPLE_ID, 'p2')
  const plan = createEmptyPlan({ name: 'Bracket-fill Roth conversions', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Morgan', dob: '1953-01-01', sex: 'male', retirementAge: 65, longevity: { planningAge: 92, source: 'manual' } },
      { id: p2, name: 'Riley', dob: '1955-01-01', sex: 'female', retirementAge: 65, longevity: { planningAge: 94, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash reserve', ownerPersonId: null, annualReturnPct: 2, balance: 80_000, annualContribution: 0 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'ira-m'), name: 'Morgan IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 700_000, annualContribution: 0 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'ira-r'), name: 'Riley IRA', ownerPersonId: p2, annualReturnPct: null, kind: 'ira', balance: 400_000, annualContribution: 0 },
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Morgan Roth IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-m'), personId: p1, piaMonthly: 2_500, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-r'), personId: p2, piaMonthly: 1_800, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  plan.expenses = {
    baseAnnual: 90_000,
    phases: [{ fromAge: 80, multiplier: 0.85 }],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 250 },
  }
  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 22,
      startYear: EXAMPLE_FIXED_YEAR,
      endYear: EXAMPLE_FIXED_YEAR + 8,
    },
    qcdAnnual: 10_000,
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 0,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`bracket-fill roth invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
