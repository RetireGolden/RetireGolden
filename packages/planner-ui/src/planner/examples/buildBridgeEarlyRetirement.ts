import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'bridge-early-retirement'

export function buildBridgeEarlyRetirement(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Bridge to 59½ (SEPP)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'CA',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Jordan', dob: '1981-01-01', sex: 'average', retirementAge: 45, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  plan.accounts = [
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'traditional-401k'),
      name: 'Traditional IRA (SEPP)',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'ira',
      balance: 1_200_000,
      annualContribution: 0,
      sepp: {
        startAge: 45,
        method: 'amortization',
      },
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth-ira'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'ira',
      balance: 125_000,
      annualContribution: 0,
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'taxable-brokerage'),
      name: 'Taxable Brokerage',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 250_000,
      costBasis: 200_000,
      annualContribution: 0,
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 140_000,
      endAge: 44,
      realGrowthPct: 4,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_900,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  plan.expenses = {
    baseAnnual: 50_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 600, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 200 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 60_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`bridge-early-retirement invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
