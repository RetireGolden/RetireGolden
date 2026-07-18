/** All-in 401(k) control (A-B pair for the brokerage bridge).
 * Same couple, wages, balances, and $45,000/yr gross savings budget as
 * brokerage-bridge-401k, but every savings dollar goes into pre-tax 401(k)s.
 * Retiring at 52 leaves nearly all wealth inaccessible before 59½: once cash
 * and the small brokerage run dry, penalized traditional withdrawals carry the
 * bridge, their MAGI wipes out ACA credits, and the identical savings budget
 * depletes years before the bridge version does.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'all-401k-no-bridge'

export function buildAll401kNoBridge(): Plan {
  const samId = exampleEntityId(EXAMPLE_ID, 'sam')
  const jordanId = exampleEntityId(EXAMPLE_ID, 'jordan')
  const plan = createEmptyPlan({ name: 'All-in 401(k) (no bridge)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

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

  // Decision under study: the full $45,000/yr savings budget goes pre-tax.
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
      annualContribution: 24_000,
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
      annualContribution: 21_000,
      employerMatch: { matchPct: 50, capPctOfPay: 6 },
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'brokerage'),
      name: 'Joint brokerage',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 40_000,
      costBasis: 32_000,
      annualContribution: 0,
    },
    // Empty Roth IRA in both halves of the pair: no ledger effect, but it gives
    // Roth-conversion scenarios a destination account.
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

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`all-401k-no-bridge invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
