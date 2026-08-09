/** Inherited IRA beneficiary details — contrasts a classified spouse schedule with a legacy account. */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'inherited-ira-beneficiary'

export function buildInheritedIraBeneficiary(): Plan {
  const spouse = exampleEntityId(EXAMPLE_ID, 'spouse')
  const plan = createEmptyPlan({
    name: 'Inherited IRA beneficiary schedules',
    now: exampleFixedNow,
    newId: exampleIdFactory(EXAMPLE_ID),
  })
  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      {
        id: spouse,
        name: 'Robin',
        dob: '1947-06-15',
        sex: 'female',
        retirementAge: 65,
        longevity: { planningAge: 95, source: 'manual' },
      },
    ],
  }
  plan.accounts = [
    {
      type: 'cash',
      id: exampleEntityId(EXAMPLE_ID, 'cash'),
      name: 'Cash',
      ownerPersonId: null,
      annualReturnPct: 2,
      balance: 80_000,
      annualContribution: 0,
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'classified-spouse-ira'),
      name: 'Inherited IRA, classified spouse schedule',
      ownerPersonId: spouse,
      annualReturnPct: null,
      kind: 'ira',
      balance: 300_000,
      annualContribution: 0,
      inherited: {
        ownerDeathYear: 2024,
        decedentHadStartedRmds: true,
        beneficiary: {
          beneficiaryClass: 'designated-individual',
          edbCategory: 'surviving-spouse',
          beneficiaryBirthYear: 1947,
          soleBeneficiary: true,
          election: 'remain-beneficiary',
          ownerBirthYear: 1945,
          ownerYearOfDeathRmdSatisfied: true,
          provenance: { source: 'example household', asOf: '2026-06-29' },
        },
      },
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'legacy-ira'),
      name: 'Inherited IRA, planning estimate',
      ownerPersonId: spouse,
      annualReturnPct: null,
      kind: 'ira',
      balance: 150_000,
      annualContribution: 0,
      inherited: { ownerDeathYear: 2024, decedentHadStartedRmds: true },
    },
  ]
  plan.expenses = {
    baseAnnual: 72_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: {
      pre65MonthlyPremiumPerPerson: 0,
      applyAcaCredit: false,
      medicareExtrasMonthlyPerPerson: 200,
    },
  }
  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'none' },
    qcdAnnual: 0,
    retirementActions: [],
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 4.5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 0,
    heirTaxRatePct: 22,
    safeWithdrawalRatePct: 4,
  }

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`inherited IRA beneficiary invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
