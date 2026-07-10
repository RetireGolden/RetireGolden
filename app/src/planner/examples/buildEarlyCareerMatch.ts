import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'early-career-match'

export function buildEarlyCareerMatch(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Just getting started', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'CA',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Alex', dob: '2001-01-01', sex: 'average', retirementAge: 60, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  plan.accounts = [
    {
      type: 'cash',
      id: exampleEntityId(EXAMPLE_ID, 'savings'),
      name: 'Emergency Fund',
      ownerPersonId: null,
      annualReturnPct: 3,
      balance: 10_000,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'traditional-401k'),
      name: 'Employer 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 7,
      kind: 'employer',
      balance: 5_000,
      annualContribution: 6_000,
      employerMatch: {
        matchPct: 100,
        capPctOfPay: 4,
      },
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth-ira'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 7,
      kind: 'ira',
      balance: 2_000,
      annualContribution: 3_000,
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 65_000,
      endAge: null,
      realGrowthPct: 3,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_000,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  plan.expenses = {
    baseAnnual: 45_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 350, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 150 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 65_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`early-career-match invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
