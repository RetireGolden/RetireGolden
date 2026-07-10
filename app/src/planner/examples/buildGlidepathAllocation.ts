/** Glidepath allocation + rebalancing + MC v2 — positive demonstration of 4-class allocation,
 * linear glidepath to conservative, annual rebalancing (with taxable realization), class yields,
 * and improved downside risk metrics vs single-return baseline.
 * Also surfaces asset-location opportunities via Insights.
 */

import { createEmptyPlan, parsePlan, type Account, type Plan } from '../../engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'glidepath-allocation'

export function buildGlidepathAllocation(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Glidepath allocation retiree', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'CA',
    stateMoves: [],
    capitalLossCarryforward: 12000,
    people: [
      { id: p1, name: 'Morgan', dob: '1962-09-05', sex: 'male', retirementAge: 63, longevity: { planningAge: 91, source: 'manual' } },
    ],
  }

  const allocAggressive = { usStocks: 55, intlStocks: 15, bonds: 25, cash: 5 }
  const allocMid = { usStocks: 40, intlStocks: 10, bonds: 40, cash: 10 }
  const allocConserv = { usStocks: 25, intlStocks: 5, bonds: 55, cash: 15 }

  plan.accounts = [
    {
      type: 'taxable',
      id: exampleEntityId(EXAMPLE_ID, 'broker'),
      name: 'Taxable brokerage (gliding)',
      ownerPersonId: null,
      annualReturnPct: null,
      balance: 380_000,
      costBasis: 195_000,
      annualContribution: 0,
      // Linear glide from now-ish to later conservative
      allocation: {
        mode: 'linear',
        rebalancing: 'annual',
        startYear: EXAMPLE_FIXED_YEAR,
        endYear: EXAMPLE_FIXED_YEAR + 12,
        from: allocAggressive,
        to: allocConserv,
      },
    },
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 't401k'),
      name: 'Traditional 401(k)',
      ownerPersonId: p1,
      annualReturnPct: null,
      kind: 'employer',
      balance: 920_000,
      annualContribution: 0,
      allocation: {
        mode: 'staged',
        rebalancing: 'annual',
        stages: [
          { fromYear: EXAMPLE_FIXED_YEAR, weights: allocAggressive },
          { fromYear: EXAMPLE_FIXED_YEAR + 8, weights: allocMid },
        ],
      },
    },
    {
      type: 'roth',
      id: exampleEntityId(EXAMPLE_ID, 'roth'),
      name: 'Roth IRA',
      ownerPersonId: p1,
      annualReturnPct: null,
      kind: 'ira',
      balance: 165_000,
      annualContribution: 0,
      allocation: { mode: 'static', rebalancing: 'annual', weights: allocMid },
    },
  ]

  plan.expenses = {
    baseAnnual: 62_000,
    phases: [],
    oneTimeGoals: [],
    healthcare: { pre65MonthlyPremiumPerPerson: 810, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 175 },
  }

  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 2100, earnings: null, claimAge: { years: 70, months: 0 } },
  ]

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 22, startYear: EXAMPLE_FIXED_YEAR + 1, endYear: EXAMPLE_FIXED_YEAR + 9 },
    qcdAnnual: 3000,
  }

  plan.assumptions = {
    inflationPct: 2.5,
    healthcareExtraInflationPct: 3.1,
    defaultReturnPct: 5.0,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 95000,
    heirTaxRatePct: 26,
    safeWithdrawalRatePct: 3.7,
    // Optional class overrides to highlight drag/returns (additive)
    assetClassParams: {
      usStocks: { returnPct: 7.2, volatilityPct: 16 },
      bonds: { returnPct: 4.1, volatilityPct: 6 },
    },
  }

  // Scenario: single-factor (no allocation) to contrast MC risk
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'single-return'),
      name: 'Single return (no allocation)',
      patch: {
        accounts: plan.accounts.map((a: Account) => ({ ...a, allocation: undefined, annualReturnPct: 5.0 })),
      },
    },
  ]

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`glidepath-allocation invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
