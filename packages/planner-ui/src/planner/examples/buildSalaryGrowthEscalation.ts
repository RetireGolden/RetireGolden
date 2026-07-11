import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'salary-growth-escalation'

export function buildSalaryGrowthEscalation(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Salary growth & escalation', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'TX',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Dana', dob: '1996-01-01', sex: 'average', retirementAge: 55, longevity: { planningAge: 95, source: 'manual' } },
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
      balance: 40_000,
      annualContribution: 10_000,
      contributionSchedule: [
        {
          annualAmount: 10_000,
          fromAge: null,
          toAge: 55,
          escalationPct: 3,
        },
      ],
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'taxable-brokerage'),
      name: 'Taxable Brokerage',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 30_000,
      costBasis: 25_000,
      annualContribution: 5_000,
      contributionSchedule: [
        {
          annualAmount: 5_000,
          fromAge: null,
          toAge: 55,
          escalationPct: 3,
        },
      ],
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 80_000,
      endAge: null,
      realGrowthPct: 3,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_400,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  plan.expenses = {
    baseAnnual: 45_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 400, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 150 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 80_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`salary-growth-escalation invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
