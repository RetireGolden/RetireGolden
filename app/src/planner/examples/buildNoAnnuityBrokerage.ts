/** Brokerage / no-annuity control (A-B pair for annuity comparison).
 * Same couple, incomes, expenses, and starting balances *before* any purchase.
 * The premium money stays invested in cash + traditional IRA (taxable growth assumed).
 * Compare to annuity-purchases-estate using Plan Compare to see income security,
 * RMD impact, and estate outcome differences.
 */

import { createEmptyPlan, parsePlan, type Plan } from '../../engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'no-annuity-brokerage'

export function buildNoAnnuityBrokerage(): Plan {
  const me = exampleEntityId(EXAMPLE_ID, 'me')
  const partner = exampleEntityId(EXAMPLE_ID, 'partner')
  const plan = createEmptyPlan({ name: 'Brokerage only (no annuities)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'FL',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: me, name: 'Jordan', dob: '1961-03-10', sex: 'male', retirementAge: 65, longevity: { planningAge: 90, source: 'manual' } },
      { id: partner, name: 'Taylor', dob: '1963-11-22', sex: 'female', retirementAge: 64, longevity: { planningAge: 93, source: 'manual' } },
    ],
  }

  // Same starting point, but keep the money that would have bought annuities
  // (220k in cash + 135k in tira instead of spent on purchases)
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Emergency cash (includes would-be premium)', ownerPersonId: null, annualReturnPct: 2, balance: 95_000 + 220_000, annualContribution: 0 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'tira'), name: 'Jordan traditional IRA (includes would-be premium)', ownerPersonId: me, annualReturnPct: null, kind: 'ira', balance: 780_000 + 135_000, annualContribution: 0, estateBeneficiary: { destination: 'spouse' } },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, '401k'), name: 'Jordan 401k', ownerPersonId: me, annualReturnPct: null, kind: 'employer', balance: 310_000, annualContribution: 0, estateBeneficiary: { destination: 'nonSpouse' } },
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Roth IRA', ownerPersonId: me, annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 },
  ]

  // Simpler beneficiaries set inline above (flat)

  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-j'), personId: me, piaMonthly: 2650, earnings: null, claimAge: { years: 70, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-t'), personId: partner, piaMonthly: 1720, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  // Pension as account
  type PensionAccount = Extract<Plan['accounts'][number], { type: 'pension' }>
  const pension: PensionAccount = {
    type: 'pension',
    id: exampleEntityId(EXAMPLE_ID, 'pension'),
    name: 'Pension (Jordan)',
    ownerPersonId: me,
    annualReturnPct: null,
    startAge: 65,
    monthlyAmount: 1500,
    colaPct: 2.0,
    survivorPct: 50,
  }
  plan.accounts.push(pension)

  plan.expenses = {
    baseAnnual: 78_000,
    phases: [
      { fromAge: 75, multiplier: 0.88 },
    ],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 880, applyAcaCredit: false, medicareExtrasMonthlyPerPerson: 210 },
  }

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 24, startYear: EXAMPLE_FIXED_YEAR + 1, endYear: EXAMPLE_FIXED_YEAR + 7 },
    qcdAnnual: 5000,
  }

  plan.assumptions = {
    inflationPct: 2.3,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5.2,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 120_000,
    heirTaxRatePct: 28,
    safeWithdrawalRatePct: 3.5,
  }

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`no-annuity-brokerage invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
