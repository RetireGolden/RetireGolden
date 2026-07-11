/** HSA medical sub-ledger + fixed asset (property) tax depth + nondeductible basis.
 * Positive modeling of qualified medical caps + reimburse-later, §121 primary residence
 * sale with basis/exclusion/recapture, and pro-rata on IRA conversions.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'hsa-property-depth'

export function buildHsaPropertyDepth(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'HSA medical + home sale depth', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'TX',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Harper', dob: '1964-02-28', sex: 'female', retirementAge: 61, longevity: { planningAge: 89, source: 'manual' } },
    ],
  }

  plan.accounts = [
    {
      type: 'hsa',
      id: exampleEntityId(EXAMPLE_ID, 'hsa'),
      name: 'HSA (cap + reimburse)',
      ownerPersonId: p1,
      annualReturnPct: 5.5,
      balance: 48_000,
      annualContribution: 4150,
      contributionSchedule: [{ annualAmount: 4150, fromAge: 61, toAge: 65, escalationPct: 0 }],
      withdrawalTreatment: 'capByMedicalExpenses',
      reimburseLater: true,
      // estateBeneficiary inherited default ok
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'tira'),
      name: 'Traditional IRA (mixed basis)',
      ownerPersonId: p1,
      annualReturnPct: null,
      kind: 'ira',
      balance: 310_000,
      nondeductibleBasis: 68000, // triggers pro-rata
      annualContribution: 0,
    },
    {
      type: 'property',
      id: exampleEntityId(EXAMPLE_ID, 'home'),
      name: 'Primary residence',
      ownerPersonId: null,
      annualReturnPct: null,
      value: 385_000,
      plannedSaleYear: EXAMPLE_FIXED_YEAR + 7,
      expectedNetProceeds: null, // using costBasis path for exact tax treatment
      costBasis: 172_000,
      sellingCostPct: 6,
      primaryResidence: true,
      depreciationRecapture: 12000, // small recapture example
      propertyTaxAnnual: 4800,
      insuranceAnnual: 2100,
    },
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash', ownerPersonId: null, annualReturnPct: 1.8, balance: 62_000, annualContribution: 0 },
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Roth IRA', ownerPersonId: p1, annualReturnPct: null, kind: 'ira', balance: 20_000, annualContribution: 0 },
  ]

  // Care + healthcare drive the medical cap for HSA
  plan.careEvents = [
    { id: exampleEntityId(EXAMPLE_ID, 'care'), personId: p1, startAge: 82, durationYears: 2, annualCost: 72000 },
  ]

  plan.expenses = {
    baseAnnual: 51_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 690, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 165 },
  }

  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 1720, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 24, startYear: EXAMPLE_FIXED_YEAR + 3, endYear: EXAMPLE_FIXED_YEAR + 11 },
    qcdAnnual: 0,
  }

  plan.assumptions = {
    inflationPct: 2.6,
    healthcareExtraInflationPct: 3.4,
    defaultReturnPct: 4.9,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 42000,
    heirTaxRatePct: 22,
    safeWithdrawalRatePct: 3.6,
  }

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`hsa-property-depth invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
