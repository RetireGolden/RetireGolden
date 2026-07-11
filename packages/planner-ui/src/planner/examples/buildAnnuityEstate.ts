/** Annuity purchases + estate beneficiaries — demonstrates guaranteed income (SPIA/QLAC),
 * purchase funding, exclusion ratio / RMD relief, and per-account beneficiary modeling for
 * estate calculations (spouse rollover vs charity vs non-spouse).
 * Positive case for estate/guaranteed-income depth enhancement.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'annuity-purchases-estate'

export function buildAnnuityEstate(): Plan {
  const me = exampleEntityId(EXAMPLE_ID, 'me')
  const partner = exampleEntityId(EXAMPLE_ID, 'partner')
  const plan = createEmptyPlan({ name: 'Annuity ladder with estate planning', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

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

  // Accounts including annuity purchases funded correctly per rules
  const cashId = exampleEntityId(EXAMPLE_ID, 'cash')
  const tiraId = exampleEntityId(EXAMPLE_ID, 'tira')
  plan.accounts = [
    { type: 'cash', id: cashId, name: 'Emergency cash', ownerPersonId: null, annualReturnPct: 2, balance: 315_000, annualContribution: 0 },
    { type: 'traditional', id: tiraId, name: 'Jordan traditional IRA', ownerPersonId: me, annualReturnPct: null, kind: 'ira', balance: 915_000, annualContribution: 0, estateBeneficiary: { destination: 'spouse' } },
    // SPIA non-qualified funded from cash
    {
      type: 'annuity',
      id: exampleEntityId(EXAMPLE_ID, 'spiA'),
      name: 'SPIA (non-qualified)',
      ownerPersonId: null,
      annualReturnPct: null,
      startAge: 66,
      monthlyAmount: 1450,
      colaPct: 0,
      taxablePct: 35,
      purchase: {
        year: EXAMPLE_FIXED_YEAR + 1,
        premium: 220_000,
        fundingAccountId: cashId,
        taxQualification: 'nonQualified',
      },
      estateBeneficiary: { destination: 'charity', charityPct: 100 },
    },
    // QLAC qualified funded from traditional
    {
      type: 'annuity',
      id: exampleEntityId(EXAMPLE_ID, 'qlac'),
      name: 'QLAC (qualified deferred)',
      ownerPersonId: null,
      annualReturnPct: null,
      startAge: 80,
      monthlyAmount: 920,
      colaPct: 2.5,
      taxablePct: 100,
      purchase: {
        year: EXAMPLE_FIXED_YEAR + 2,
        premium: 135_000,
        fundingAccountId: tiraId,
        taxQualification: 'qualified',
        qlac: true,
      },
    },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, '401k'), name: 'Jordan 401k', ownerPersonId: me, annualReturnPct: null, kind: 'employer', balance: 310_000, annualContribution: 0, estateBeneficiary: { destination: 'nonSpouse' } },
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Roth IRA', ownerPersonId: me, annualReturnPct: null, kind: 'ira', balance: 50_000, annualContribution: 0 },
  ]

  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-j'), personId: me, piaMonthly: 2650, earnings: null, claimAge: { years: 70, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-t'), personId: partner, piaMonthly: 1720, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  // Pension as account (not income)
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

  // Scenario: no Roth conversions (for A-B comparison of annuity effect)
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'no-conversion'),
      name: 'No Roth conversions (manual compare)',
      patch: { strategies: { rothConversion: { mode: 'none' } } },
    },
  ]

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`annuity-purchases-estate invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
