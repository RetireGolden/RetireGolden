import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'aggressive-saver'

export function buildAggressiveSaver(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Aggressive saver to early retirement', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'WA',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Taylor', dob: '1996-01-01', sex: 'average', retirementAge: 45, longevity: { planningAge: 95, source: 'manual' } },
    ],
  }
  plan.accounts = [
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'pretax-401k'),
      name: 'Pre-tax 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 8,
      kind: 'employer',
      balance: 100_000,
      annualContribution: 23_000,
      employerMatch: {
        matchPct: 100,
        capPctOfPay: 5,
      },
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth-ira'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 8,
      kind: 'ira',
      balance: 50_000,
      annualContribution: 7_000,
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'taxable-brokerage'),
      name: 'Taxable Brokerage',
      ownerPersonId: null,
      annualReturnPct: 8,
      balance: 150_000,
      costBasis: 120_000,
      annualContribution: 0,
      contributionSchedule: [
        {
          annualAmount: 30_000,
          fromAge: 30,
          toAge: 45,
          escalationPct: 5,
        },
      ],
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 120_000,
      endAge: null,
      realGrowthPct: 5,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 3_000,
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
    recentAnnualMagi: 120_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 3.5,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`aggressive-saver invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
