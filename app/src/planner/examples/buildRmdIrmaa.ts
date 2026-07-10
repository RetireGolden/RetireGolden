/** High balances: RMDs and IRMAA — large traditional balances push MAGI into Medicare tiers. */

import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'rmd-irmaa'

export function buildRmdIrmaa(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'High balances: RMDs & IRMAA', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Dana', dob: '1953-01-01', sex: 'female', retirementAge: 65, longevity: { planningAge: 95, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash', ownerPersonId: null, annualReturnPct: 2, balance: 50_000, annualContribution: 0 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'ira'), name: 'Traditional IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 1_850_000, annualContribution: 0 },
    { type: 'taxable', id: exampleEntityId(EXAMPLE_ID, 'brokerage'), name: 'Brokerage', ownerPersonId: null, annualReturnPct: null, balance: 400_000, costBasis: 280_000, annualContribution: 0 },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 3_200, earnings: null, claimAge: { years: 70, months: 0 } },
  ]
  plan.expenses = {
    baseAnnual: 110_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 350 },
  }
  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'none' },
    qcdAnnual: 15_000,
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
    heirTaxRatePct: 28,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`rmd irmaa invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
