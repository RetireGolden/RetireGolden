import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'hsa-stealth-retirement'

export function buildHsaStealthRetirement(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'HSA stealth retirement', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'CA',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Chris', dob: '1986-01-01', sex: 'average', retirementAge: 50, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  plan.accounts = [
    {
      type: 'hsa',
      id: exampleEntityId(EXAMPLE_ID, 'hsa'),
      name: 'Stealth HSA',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      balance: 25_000,
      annualContribution: 4_400,
      contributionSchedule: [
        {
          annualAmount: 4_400,
          fromAge: null,
          toAge: 50,
          escalationPct: 2,
        },
      ],
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'traditional-401k'),
      name: 'Employer 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'employer',
      balance: 180_000,
      annualContribution: 23_000,
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'brokerage'),
      name: 'Taxable Brokerage',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 100_000,
      costBasis: 75_000,
      annualContribution: 5_000,
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'wages'),
      personId: p1,
      annualGross: 110_000,
      endAge: 50,
      realGrowthPct: 3,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_700,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
  ]
  plan.expenses = {
    baseAnnual: 50_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 450, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 180 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 110_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`hsa-stealth-retirement invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
