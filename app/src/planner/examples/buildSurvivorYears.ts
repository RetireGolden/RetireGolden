/** Survivor years (widow's penalty) — first death flips to single brackets and survivor SS. */

import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'survivor-years'

export function buildSurvivorYears(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const p2 = exampleEntityId(EXAMPLE_ID, 'p2')
  const plan = createEmptyPlan({ name: 'Survivor years (widow\'s penalty)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Lee', dob: '1962-06-15', sex: 'female', retirementAge: 65, longevity: { planningAge: 95, source: 'manual' } },
      { id: p2, name: 'Chris', dob: '1960-06-15', sex: 'male', retirementAge: 65, longevity: { planningAge: 78, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash', ownerPersonId: null, annualReturnPct: 2, balance: 100_000, annualContribution: 0 },
    {
      type: 'pension',
      id: exampleEntityId(EXAMPLE_ID, 'pension'),
      name: 'Chris pension',
      ownerPersonId: p2,
      annualReturnPct: 0,
      startAge: 65,
      monthlyAmount: 4_000,
      colaPct: 0,
      survivorPct: 50,
    },
  ]
  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-lee'), personId: p1, piaMonthly: 1_000, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-chris'), personId: p2, piaMonthly: 3_000, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  plan.expenses = {
    baseAnnual: 72_000,
    phases: [{ fromAge: 80, multiplier: 0.9 }],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 0, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 200 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 4.5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 0,
    heirTaxRatePct: 22,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`survivor years invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
