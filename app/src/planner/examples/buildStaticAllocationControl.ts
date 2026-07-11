/** Static / no-glidepath allocation control (A-B pair).
 * Exact same starting balances and household as glidepath-allocation,
 * but NO allocation policies on any account (falls back to single defaultReturnPct).
 * Same starting dollar amounts. Compare the two in Plan Compare to see
 * the effect of glidepath + rebalancing + class MC on risk metrics and ending values.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'static-allocation-control'

export function buildStaticAllocationControl(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Static allocation control', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'CA',
    stateMoves: [],
    capitalLossCarryforward: 12000,
    people: [
      { id: p1, name: 'Morgan', dob: '1962-09-05', sex: 'male', retirementAge: 63, longevity: { planningAge: 91, source: 'manual' } },
    ],
  }

  // Identical starting balances, NO allocation objects
  plan.accounts = [
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'broker'),
      name: 'Taxable brokerage',
      ownerPersonId: null,
      annualReturnPct: 5.0,  // explicit single return (matches what glide would average-ish)
      balance: 380_000,
      costBasis: 195_000,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 't401k'),
      name: 'Traditional 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 5.0,
      kind: 'employer',
      balance: 920_000,
      annualContribution: 0,
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 5.0,
      kind: 'ira',
      balance: 165_000,
      annualContribution: 0,
    },
  ]

  plan.expenses = {
    baseAnnual: 62_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 810, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 175 },
  }

  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 2100, earnings: null, claimAge: { years: 70, months: 0 } },
  ]

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: EXAMPLE_FIXED_YEAR + 1, endYear: EXAMPLE_FIXED_YEAR + 9 },
    qcdAnnual: 3000,
  }

  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3.1,
    defaultReturnPct: 5.0,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 95000,
    heirTaxRatePct: 26,
    safeWithdrawalRatePct: 3.7,
    // No special assetClassParams needed for the control
  }

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`static-allocation-control invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
