/** Starting-from-zero control (A-B pair for the Trump-account IRA head start).
 * Identical 22-year-old, wages, spending, and ongoing savings as
 * trump-account-head-start; the only difference is that retirement wealth
 * starts at $0 aside from the shared emergency fund — no seeded IRA.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'no-head-start-grad'

export function buildNoHeadStartGrad(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'nova')
  const plan = createEmptyPlan({ name: 'Starting from zero (no head start)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'MI',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Nova', dob: '2004-05-20', sex: 'average', retirementAge: 60, longevity: { planningAge: 92, source: 'manual' } },
    ],
  }

  // Decision under study: no seeded IRA — the retirement journey starts at $0.
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Emergency fund', ownerPersonId: null, annualReturnPct: 3, balance: 8_000, annualContribution: 0 },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, '401k'),
      name: 'Employer 401(k)',
      ownerPersonId: p1,
      annualReturnPct: 7,
      kind: 'employer',
      balance: 0,
      annualContribution: 8_000,
      employerMatch: { matchPct: 100, capPctOfPay: 4 },
    },
    // Empty Roth IRA in both halves of the pair: no ledger effect, but it gives
    // Roth-conversion scenarios a destination account.
    { type: 'roth', id: exampleEntityId(EXAMPLE_ID, 'roth'), name: 'Roth IRA', ownerPersonId: p1, annualReturnPct: 7, kind: 'ira', balance: 0, annualContribution: 0 },
  ]

  plan.incomes = [
    { type: 'wages', id: exampleEntityId(EXAMPLE_ID, 'wages'), personId: p1, annualGross: 62_000, endAge: null, realGrowthPct: 2.5 },
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 2_000, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  plan.expenses = {
    baseAnnual: 44_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 350, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 150 },
  }

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'none' },
    qcdAnnual: 0,
  }

  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 2,
    defaultReturnPct: 6,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 62_000,
    heirTaxRatePct: 25,
    safeWithdrawalRatePct: 4,
  }

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`no-head-start-grad invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
