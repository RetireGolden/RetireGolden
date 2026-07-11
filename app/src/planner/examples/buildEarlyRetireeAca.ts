/** Early retiree and the ACA cliff — pre-65 MAGI vs premium-credit cliff. */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'early-retiree-aca'

export function buildEarlyRetireeAca(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Early retiree & the ACA cliff', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
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
    { type: 'recurring', id: exampleEntityId(EXAMPLE_ID, 'consulting'), label: 'Consulting', annualAmount: 55_000, startYear: EXAMPLE_FIXED_YEAR, endYear: null, inflationAdjusted: true, taxTreatment: 'ordinary' },
  ]
  plan.expenses = {
    baseAnnual: 48_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 1_000, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 0 },
  }
  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 12,
      startYear: EXAMPLE_FIXED_YEAR,
      endYear: EXAMPLE_FIXED_YEAR + 4,
    },
    qcdAnnual: 0,
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 50_000,
    heirTaxRatePct: 22,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`early retiree ACA invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
