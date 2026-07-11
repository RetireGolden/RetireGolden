/** Long-term-care shock — a care episode and how LTC insurance offsets it. */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'ltc-shock'

export function buildLtcShock(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Long-term-care shock', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Quinn', dob: '1964-01-01', sex: 'female', retirementAge: 62, longevity: { planningAge: 92, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash', ownerPersonId: null, annualReturnPct: 2, balance: 500_000, annualContribution: 0 },
  ]
  plan.careEvents = [
    { id: exampleEntityId(EXAMPLE_ID, 'care'), personId: p1, startAge: 78, durationYears: 3, annualCost: 95_000 },
  ]
  plan.insurance = [
    {
      kind: 'ltc',
      id: exampleEntityId(EXAMPLE_ID, 'ltc'),
      name: 'LTC policy',
      owner: p1,
      annualPremium: 2_800,
      premiumMode: 'lifetime',
      benefitMonthly: 5_000,
      benefitPeriodYears: 3,
      eliminationPeriodDays: 90,
      inflationRiderPct: 3,
    },
  ]
  plan.expenses = {
    baseAnnual: 55_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 650, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 200 },
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
  if (!parsed.ok) throw new Error(`ltc shock invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
