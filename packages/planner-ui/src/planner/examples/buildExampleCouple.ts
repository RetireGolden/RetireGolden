/** Example couple — the full picture: accounts, SS, Roth strategy, insurance, scenarios. */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { TRUSTEES_DEFAULT_SS_HAIRCUT } from '@retiregolden/engine/params'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'example-couple'

export function buildExampleCouple(): Plan {
  const meId = exampleEntityId(EXAMPLE_ID, 'alex')
  const partnerId = exampleEntityId(EXAMPLE_ID, 'sam')
  const plan = createEmptyPlan({ name: 'Example couple', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })
  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'KY',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: meId, name: 'Alex', dob: '1962-04-15', sex: 'male', retirementAge: 66, longevity: { planningAge: 92, source: 'manual' } },
      { id: partnerId, name: 'Sam', dob: '1964-09-02', sex: 'female', retirementAge: 64, longevity: { planningAge: 95, source: 'manual' } },
    ],
  }
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'savings'), name: 'Savings', ownerPersonId: null, annualReturnPct: 2, balance: 60_000, annualContribution: 0 },
    { type: 'taxable', id: exampleEntityId(EXAMPLE_ID, 'brokerage'), name: 'Joint brokerage', ownerPersonId: null, annualReturnPct: null, balance: 650_000, costBasis: 420_000, annualContribution: 12_000 },
    { type: 'equityComp', id: exampleEntityId(EXAMPLE_ID, 'rsu'), name: 'Alex RSUs', ownerPersonId: meId, annualReturnPct: null, balance: 120_000, costBasis: 95_000, annualContribution: 0, vestingMode: 'cliff', vestDate: '2028-03-15' },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, '401k'), name: 'Alex 401(k)', ownerPersonId: meId, annualReturnPct: null, kind: 'employer', balance: 820_000, annualContribution: 24_000 },
    { type: 'traditional', id: exampleEntityId(EXAMPLE_ID, 'sam-ira'), name: 'Sam IRA', ownerPersonId: partnerId, annualReturnPct: null, kind: 'ira', balance: 310_000, annualContribution: 0 },
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Alex Roth IRA', ownerPersonId: meId, annualReturnPct: null, kind: 'ira', balance: 145_000, annualContribution: 7_500, contributionBasis: 80_000 },
    { type: 'property', id: exampleEntityId(EXAMPLE_ID, 'home'), name: 'Home', ownerPersonId: null, annualReturnPct: null, value: 420_000, plannedSaleYear: null, expectedNetProceeds: null, propertyTaxAnnual: 6_000, insuranceAnnual: 1_800 },
    { type: 'debt', id: exampleEntityId(EXAMPLE_ID, 'mortgage'), name: 'Mortgage', ownerPersonId: null, annualReturnPct: null, balance: 180_000, interestPct: 3, monthlyPayment: 1_100 },
  ]
  plan.insurance = [
    {
      kind: 'permanentLife', id: exampleEntityId(EXAMPLE_ID, 'wl'), name: 'Alex whole life', insured: meId, beneficiary: 'estate',
      annualPremium: 3_600, premiumMode: 'lifetime', deathBenefit: 350_000,
      cashValue: 85_000, cashValueMode: 'flatRate', cashValueGrowthPct: 4,
    },
    {
      kind: 'ltc', id: exampleEntityId(EXAMPLE_ID, 'ltc-alex'), name: 'Alex LTC', owner: meId,
      annualPremium: 2_400, premiumMode: 'lifetime', benefitMonthly: 6_000, benefitPeriodYears: 3,
      eliminationPeriodDays: 90, inflationRiderPct: 3,
    },
    {
      kind: 'ltc', id: exampleEntityId(EXAMPLE_ID, 'ltc-sam'), name: 'Sam LTC', owner: partnerId,
      annualPremium: 2_200, premiumMode: 'lifetime', benefitMonthly: 6_000, benefitPeriodYears: 3,
      eliminationPeriodDays: 90, inflationRiderPct: 3,
    },
  ]
  plan.careEvents = [
    { id: exampleEntityId(EXAMPLE_ID, 'care'), personId: meId, startAge: 88, durationYears: 3, annualCost: 90_000 },
  ]
  plan.incomes = [
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages-alex'), personId: meId, annualGross: 140_000, endAge: null, realGrowthPct: 0 },
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages-sam'), personId: partnerId, annualGross: 85_000, endAge: null, realGrowthPct: 0 },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-alex'), personId: meId, piaMonthly: 2_900, earnings: null, claimAge: { years: 70, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-sam'), personId: partnerId, piaMonthly: 1_950, earnings: null, claimAge: { years: 67, months: 0 } },
  ]
  plan.expenses = {
    baseAnnual: 96_000,
    phases: [
      { fromAge: 75, multiplier: 0.9 },
      { fromAge: 85, multiplier: 0.8 },
    ],
    oneTimeGoals: [{ id: exampleEntityId(EXAMPLE_ID, 'remodel'), label: 'Kitchen remodel', year: EXAMPLE_FIXED_YEAR + 3, amount: 45_000 }],
    healthcare: { pre65MonthlyPremiumPerPerson: 950, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 180 },
  }
  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: {
      mode: 'fillToTarget',
      target: 'topOfBracket',
      targetValue: 22,
      startYear: EXAMPLE_FIXED_YEAR + 2,
      endYear: EXAMPLE_FIXED_YEAR + 10,
    },
    qcdAnnual: 0,
  }
  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3,
    defaultReturnPct: 5.5,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 225_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'ss-cut'),
      name: `${TRUSTEES_DEFAULT_SS_HAIRCUT.cutPct}% Social Security cut in ${TRUSTEES_DEFAULT_SS_HAIRCUT.fromYear}`,
      patch: { assumptions: { ssHaircut: { ...TRUSTEES_DEFAULT_SS_HAIRCUT } } },
    },
    { id: exampleEntityId(EXAMPLE_ID, 'spend-more'), name: 'Spend 15% more', patch: { expenses: { baseAnnual: Math.round(96_000 * 1.15) } } },
  ]
  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`example couple invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
