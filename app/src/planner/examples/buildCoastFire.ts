import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'coast-fire'

export function buildCoastFire(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Coast FIRE', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'CO',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Morgan', dob: '1996-01-01', sex: 'average', retirementAge: 60, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  plan.accounts = [
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'ira'),
      name: 'Traditional IRA',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'ira',
      balance: 150_000,
      annualContribution: 0,
      contributionSchedule: [
        {
          annualAmount: 25_000,
          fromAge: 30,
          toAge: 40,
          escalationPct: 0,
        },
      ],
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth-ira'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'ira',
      balance: 50_000,
      annualContribution: 0,
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 90_000,
      endAge: null,
      realGrowthPct: 2,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_500,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  plan.expenses = {
    baseAnnual: 50_000,
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
    recentAnnualMagi: 90_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`coast-fire invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
