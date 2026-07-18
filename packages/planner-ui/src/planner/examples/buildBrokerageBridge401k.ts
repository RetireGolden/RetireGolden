/** 401(k) + taxable brokerage bridge (A-B pair with all-401k-no-bridge).
 * Identical couple, wages, balances, and $45,000/yr gross savings budget as the
 * control; the only change is where the savings go: 401(k) contributions cover
 * the employer match (slightly above the 6%-of-pay cap so the match stays
 * identical to the control as wages grow 1% real), and the remaining $30,600/yr
 * builds a taxable brokerage "bridge" that funds ages 52–59½ at low MAGI —
 * keeping ACA credits and avoiding penalties, which is enough to turn the
 * control's depletion into a plan that lasts to the planning horizon.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'brokerage-bridge-401k'

export function buildBrokerageBridge401k(): Plan {
  const samId = exampleEntityId(EXAMPLE_ID, 'sam')
  const jordanId = exampleEntityId(EXAMPLE_ID, 'jordan')
  const plan = createEmptyPlan({ name: '401(k) plus brokerage bridge', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'NC',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: samId, name: 'Sam', dob: '1986-03-15', sex: 'average', retirementAge: 52, longevity: { planningAge: 92, source: 'manual' } },
      { id: jordanId, name: 'Jordan', dob: '1986-09-01', sex: 'average', retirementAge: 52, longevity: { planningAge: 92, source: 'manual' } },
    ],
  }

  // Decision under study: same $45,000/yr gross budget, split 401(k)-to-match
  // ($8,400 + $6,000) + taxable brokerage bridge ($30,600). The gross budget is
  // held constant, so this plan pays more current tax during accumulation —
  // that is the honest cost of the bridge.
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash savings', ownerPersonId: null, annualReturnPct: 3, balance: 30_000, annualContribution: 0 },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'sam-401k'),
      name: 'Sam 401(k)',
      ownerPersonId: samId,
      annualReturnPct: 7,
      kind: 'employer',
      balance: 210_000,
      annualContribution: 8_400,
      employerMatch: { matchPct: 50, capPctOfPay: 6 },
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'jordan-401k'),
      name: 'Jordan 401(k)',
      ownerPersonId: jordanId,
      annualReturnPct: 7,
      kind: 'employer',
      balance: 85_000,
      annualContribution: 6_000,
      employerMatch: { matchPct: 50, capPctOfPay: 6 },
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'brokerage'),
      name: 'Joint brokerage (bridge)',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 40_000,
      costBasis: 32_000,
      annualContribution: 30_600,
    },
    // Empty Roth IRA in both halves of the pair: no ledger effect, but it gives
    // the bracket-fill conversion scenario a destination account.
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Sam Roth IRA', ownerPersonId: samId, annualReturnPct: 7, kind: 'ira', balance: 0, annualContribution: 0 },
  ]

  plan.incomes = [
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages-sam'), personId: samId, annualGross: 105_000, endAge: null, realGrowthPct: 1 },
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages-jordan'), personId: jordanId, annualGross: 75_000, endAge: null, realGrowthPct: 1 },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-sam'), personId: samId, piaMonthly: 2_600, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-jordan'), personId: jordanId, piaMonthly: 1_900, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  plan.expenses = {
    baseAnnual: 76_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 850, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 170 },
  }

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'none' },
    qcdAnnual: 0,
  }

  plan.assumptions = {
    inflationPct: 2.4,
    healthcareExtraInflationPct: 3.2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 180_000,
    heirTaxRatePct: 24,
    safeWithdrawalRatePct: 3.8,
  }

  // Conversion levers stay OFF in the base plan so Compare isolates the
  // savings-location decision alone. This scenario is the honest stress test of
  // the popular "convert during the bridge" advice: for this lean plan the
  // conversion tax plus the ACA credits the extra MAGI forfeits drain the
  // bridge fund and hand back most of the strategy's advantage.
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'bridge-conversions'),
      name: 'Bracket-fill Roth conversions during the bridge',
      patch: {
        strategies: {
          rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 12, startYear: EXAMPLE_FIXED_YEAR + 12, endYear: EXAMPLE_FIXED_YEAR + 19 },
        },
      },
    },
  ]

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`brokerage-bridge-401k invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
