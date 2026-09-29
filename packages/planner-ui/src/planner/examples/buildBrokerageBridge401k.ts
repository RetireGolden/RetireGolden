/** 401(k) + taxable brokerage bridge (A-B pair with all-401k-no-bridge).
 * Identical couple, wages, balances, and $45,000/yr gross savings budget as the
 * control; the only change is where the savings go: 401(k) contributions cover
 * the employer match (slightly above the 6%-of-pay cap so the match stays
 * identical to the control as wages grow 1% real), and the remaining $30,600/yr
 * builds a taxable brokerage "bridge" that, after the cash, funds ages 52–59½
 * at low MAGI and avoids the control's early-withdrawal penalties ($83,312
 * over 2042–2045). That buys one year, not the horizon: this plan runs out in
 * 2069 and the control in 2068 (examples.golden.test.ts pins both), both
 * before the planning horizon (2078). No premium tax credit is priced in either plan:
 * the bridge years (2038 on) come after the last coverage year whose ACA
 * figures are published, so both budget the full marketplace premium, and in
 * the priced years (2026, 2027) the couple's wages put them above the cliff.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, createExamplePlan, exampleEntityId, parseExamplePlan } from './buildContext'

const EXAMPLE_ID = 'brokerage-bridge-401k'

export function buildBrokerageBridge401k(): Plan {
  const samId = exampleEntityId(EXAMPLE_ID, 'sam')
  const jordanId = exampleEntityId(EXAMPLE_ID, 'jordan')
  const plan = createExamplePlan({
    exampleId: EXAMPLE_ID,
    name: '401(k) plus brokerage bridge',
    assumptions: {
      inflationPct: 2.4,
      healthcareExtraInflationPct: 3.2,
      recentAnnualMagi: 180_000,
      heirTaxRatePct: 24,
      safeWithdrawalRatePct: 3.8,
    },
  })

  plan.household = {
    filingStatus: 'marriedFilingJointly',
    hasQualifyingDependent: false,
    state: 'NC',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: samId, name: 'Sam', dob: '1986-03-15', sex: 'average', retirementAge: 52, longevity: { planningAge: 92, source: 'manual' } },
      { id: jordanId, name: 'Jordan', dob: '1986-09-01', sex: 'average', retirementAge: 52, longevity: { planningAge: 92, source: 'manual' } },
    ],
  }

  // Decision under study: same $45,000/yr gross budget, split 401(k)-to-match
  // ($8,400 + $6,000) + taxable brokerage bridge ($30,600). The gross budget is
  // held constant, so this plan pays more current tax during accumulation —
  // that is the honest cost of the bridge.
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash savings', ownerPersonId: null, annualReturnPct: 3, balance: 30_000, annualContribution: 0 },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'sam-401k'),
      name: 'Sam 401(k)',
      ownerPersonId: samId,
      annualReturnPct: 7,
      kind: 'employer',
      balance: 210_000,
      annualContribution: 8_400,
      employerMatch: { matchPct: 50, capPctOfPay: 6 },
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'jordan-401k'),
      name: 'Jordan 401(k)',
      ownerPersonId: jordanId,
      annualReturnPct: 7,
      kind: 'employer',
      balance: 85_000,
      annualContribution: 6_000,
      employerMatch: { matchPct: 50, capPctOfPay: 6 },
    },
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'brokerage'),
      name: 'Joint brokerage (bridge)',
      ownerPersonId: null,
      annualReturnPct: 7,
      balance: 40_000,
      costBasis: 32_000,
      annualContribution: 30_600,
    },
    // Empty Roth IRA in both halves of the pair: no ledger effect, but it gives
    // the bracket-fill conversion scenario a destination account. Only Sam
    // holds one, so the scenario converts only his share of each year's sized
    // amount and says Jordan's share was skipped.
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Sam Roth IRA', ownerPersonId: samId, annualReturnPct: 7, kind: 'ira', balance: 0, annualContribution: 0 },
  ]

  plan.incomes = [
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages-sam'), personId: samId, annualGross: 105_000, endAge: null, realGrowthPct: 1 },
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages-jordan'), personId: jordanId, annualGross: 75_000, endAge: null, realGrowthPct: 1 },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-sam'), personId: samId, piaMonthly: 2_600, earnings: null, claimAge: { years: 67, months: 0 } },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss-jordan'), personId: jordanId, piaMonthly: 1_900, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  plan.expenses = {
    baseAnnual: 76_000,
    phases: [],
    // No phases; named anyway, as every two-person plan is (schema v7), so a
    // scenario that adds phases follows a named person's age.
    phasesAgeOf: samId,
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 850, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 170 },
  }


  // Conversion levers stay OFF in the base plan so Compare isolates the
  // savings-location decision alone. This scenario tests the popular "convert
  // during the bridge" advice: conversions sized to the top of the 12% bracket
  // in 2038-2045 (Sam's share only, see the Roth account above). It was written
  // expecting the conversion tax, plus any ACA credit the extra MAGI forfeits,
  // to drain the bridge fund; the projection says otherwise. No ACA year in the
  // bridge is priced, the brokerage still lasts into 2046, and lifetime tax
  // falls from 865,395 to 534,028 while the money lasts to 2071 instead of 2069.
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'bridge-conversions'),
      name: 'Bracket-fill Roth conversions during the bridge',
      patch: {
        strategies: {
          rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 12, startYear: EXAMPLE_FIXED_YEAR + 12, endYear: EXAMPLE_FIXED_YEAR + 19 },
        },
      },
    },
  ]

  const parsed = parseExamplePlan(plan)
  if (!parsed.ok) throw new Error(`brokerage-bridge-401k invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
