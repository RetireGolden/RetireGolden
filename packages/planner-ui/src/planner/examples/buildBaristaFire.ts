import type { Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, createExamplePlan, exampleEntityId, parseExamplePlan } from './buildContext'

const EXAMPLE_ID = 'barista-fire'

export function buildBaristaFire(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createExamplePlan({
    exampleId: EXAMPLE_ID,
    name: 'Barista FIRE',
    assumptions: { recentAnnualMagi: 95_000 },
  })
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
  
  // Born 1996, so 30 in the example's year (EXAMPLE_FIXED_YEAR, 2026): 40 in
  // 2036 and 65 in 2061. Relative to the example's year so a yearly re-date
  // moves these with the date of birth.
  const startYear = EXAMPLE_FIXED_YEAR
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
  const parsed = parseExamplePlan(plan)
  if (!parsed.ok) throw new Error(`barista-fire invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
