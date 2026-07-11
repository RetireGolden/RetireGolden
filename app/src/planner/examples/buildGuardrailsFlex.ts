/** Guardrails + flexible goals — positive/negative demonstration of required floor protection,
 * discretionary cuts, movable/skippable/partial goals, and layered MC success rates.
 * Exercises spending guardrails enhancement + MC/Insights surfaces.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'guardrails-flex-goals'

export function buildGuardrailsFlex(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Guardrails and flexible goals', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

  plan.household = {
    filingStatus: 'single',
    hasQualifyingDependent: false,
    state: 'KY',
    stateMoves: [],
    capitalLossCarryforward: 0,
    people: [
      { id: p1, name: 'Riley', dob: '1963-06-15', sex: 'female', retirementAge: 62, longevity: { planningAge: 92, source: 'manual' } },
    ],
  }

  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Cash reserve', ownerPersonId: null, annualReturnPct: 2.0, balance: 85_000, annualContribution: 0 },
    { type: 'taxable', id: exampleEntityId(EXAMPLE_ID, 'brokerage'), name: 'Taxable brokerage', ownerPersonId: null, annualReturnPct: null, balance: 420_000, costBasis: 280_000, annualContribution: 0 },
  ]

  // Core spending layers for guardrails demo
  plan.expenses = {
    baseAnnual: 58_000,
    requiredAnnual: 34_000, // protected floor
    idealAnnual: 12_000,    // aspirational layer
    excessAnnual: 6_000,    // opportunistic
    phases: [
      { fromAge: 78, multiplier: 0.92 },
    ],
    oneTimeGoals: [
      // Fixed essential (high priority)
      {
        id: exampleEntityId(EXAMPLE_ID, 'roof'),
        label: 'Roof replacement (required)',
        year: EXAMPLE_FIXED_YEAR + 4,
        amount: 28_000,
        classification: 'required',
        flexibility: 'fixed',
        priority: 1,
      },
      // Movable target goal (can slide in bad markets)
      {
        id: exampleEntityId(EXAMPLE_ID, 'trip'),
        label: 'Big anniversary trip (target)',
        year: EXAMPLE_FIXED_YEAR + 2,
        amount: 18_000,
        classification: 'target',
        flexibility: 'movable',
        earliestYear: EXAMPLE_FIXED_YEAR + 1,
        latestYear: EXAMPLE_FIXED_YEAR + 5,
        priority: 10,
        allowPartialFunding: true,
        minFundingPct: 60,
      },
      // Skippable ideal (low priority)
      {
        id: exampleEntityId(EXAMPLE_ID, 'gift'),
        label: 'Family gift / remodel (ideal)',
        year: EXAMPLE_FIXED_YEAR + 6,
        amount: 35_000,
        classification: 'ideal',
        flexibility: 'skippable',
        earliestYear: EXAMPLE_FIXED_YEAR + 3,
        latestYear: EXAMPLE_FIXED_YEAR + 8,
        priority: 30,
      },
    ],
    healthcare: { pre65MonthlyPremiumPerPerson: 720, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 190 },
    spendingPolicy: {
      mode: 'withdrawalRateGuardrails',
      upperGuardrailPct: 125,
    },
  }

  plan.incomes = [
    { type: 'socialSecurity', id: exampleEntityId(EXAMPLE_ID, 'ss'), personId: p1, piaMonthly: 1850, earnings: null, claimAge: { years: 67, months: 0 } },
  ]

  plan.strategies = {
    withdrawalOrder: { mode: 'sequential' },
    rothConversion: { mode: 'none' },
    qcdAnnual: 0,
  }

  plan.assumptions = {
    inflationPct: 2.4,
    healthcareExtraInflationPct: 3.2,
    defaultReturnPct: 4.8,
    ssCola: { mode: 'matchInflation' },
    ssHaircut: null,
    stateEffectiveTaxPct: 0,
    localIncomeTaxPct: 0,
    recentAnnualMagi: 0,
    heirTaxRatePct: 24,
    safeWithdrawalRatePct: 3.8,
  }

  // Scenario to compare guardrails off (for side-by-side)
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'no-guard'),
      name: 'No guardrails (full target always)',
      patch: { expenses: { spendingPolicy: undefined, requiredAnnual: undefined } },
    },
  ]

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`guardrails-flex-goals invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
