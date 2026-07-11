import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'lean-fat-fire'

export function buildLeanFatFire(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Lean vs Fat FIRE', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'TX',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Jessie', dob: '1991-01-01', sex: 'average', retirementAge: 45, longevity: { planningAge: 95, source: 'manual' } },
    ],
  }
  plan.accounts = [
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'pretax-401k'),
      name: 'Pre-tax 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'employer',
      balance: 200_000,
      annualContribution: 23_000,
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth-ira'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'ira',
      balance: 80_000,
      annualContribution: 7_000,
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'taxable-brokerage'),
      name: 'Taxable Brokerage',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 300_000,
      costBasis: 220_000,
      annualContribution: 20_000,
      contributionSchedule: [
        {
          annualAmount: 20_000,
          fromAge: null,
          toAge: 45,
          escalationPct: 0,
        },
      ],
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 135_000,
      endAge: 45,
      realGrowthPct: 3,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_800,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  plan.expenses = {
    baseAnnual: 45_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 500, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 200 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 135_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'fat-fire'),
      name: 'Fat FIRE ($80,000 spending)',
      patch: {
        expenses: {
          baseAnnual: 80_000,
        },
      },
    },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`lean-fat-fire invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
