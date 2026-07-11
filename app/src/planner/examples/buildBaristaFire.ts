import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'barista-fire'

export function buildBaristaFire(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Barista FIRE', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'OR',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Robin', dob: '1996-01-01', sex: 'average', retirementAge: 40, longevity: { planningAge: 90, source: 'manual' } },
    ],
  }
  
  // Born 1996. Current year is 2026. Age is 30.
  // Turns 40 in 2036. Turns 65 in 2061.
  const startYear = 2026
  const turn40Year = startYear + 10
  const turn65Year = startYear + 35

  plan.accounts = [
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'pretax-401k'),
      name: 'Pre-tax 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'employer',
      balance: 120_000,
      annualContribution: 18_000,
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth-ira'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: 7.5,
      kind: 'ira',
      balance: 30_000,
      annualContribution: 5_000,
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'taxable-brokerage'),
      name: 'Taxable Brokerage',
      ownerPersonId: null,
      annualReturnPct: 7.5,
      balance: 100_000,
      costBasis: 80_000,
      annualContribution: 10_000,
      contributionSchedule: [
        {
          annualAmount: 10_000,
          fromAge: 30,
          toAge: 40,
          escalationPct: 0,
        },
      ],
    },
  ]
  plan.incomes = [
    {
      type: 'wages',
      id: exampleEntityId(EXAMPLE_ID, 'primary-wages'),
      personId: p1,
      annualGross: 95_000,
      endAge: 40,
      realGrowthPct: 3,
    },
    {
      type: 'socialSecurity',
      id: exampleEntityId(EXAMPLE_ID, 'ss'),
      personId: p1,
      piaMonthly: 2_300,
      earnings: null,
      claimAge: { years: 67, months: 0 },
    },
    {
      type: 'recurring',
      id: exampleEntityId(EXAMPLE_ID, 'barista-job'),
      label: 'Barista part-time work',
      annualAmount: 35_000,
      startYear: turn40Year,
      endYear: turn65Year,
      inflationAdjusted: true,
      taxTreatment: 'ordinary',
    },
  ]
  plan.expenses = {
    baseAnnual: 45_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 550, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 200 },
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 95_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`barista-fire invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
