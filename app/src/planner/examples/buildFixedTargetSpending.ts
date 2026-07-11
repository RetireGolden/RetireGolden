/** Fixed target spending control (A-B pair for guardrails comparison).
 * Identical household, balances, and target lifestyle as guardrails-flex-goals,
 * but uses classic fixed target spending (no required floor, no guardrails policy,
 * no classified/movable goals). Use with the guardrails example in Compare Plans
 * to see success rate / depletion differences.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'fixed-target-spending'

export function buildFixedTargetSpending(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'p1')
  const plan = createEmptyPlan({ name: 'Fixed target spending (control)', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

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

  // Classic fixed target spending — no layers, no policy, simple goals
  plan.expenses = {
    baseAnnual: 58_000,
    phases: [
      { fromAge: 78, multiplier: 0.92 },
    ],
    oneTimeGoals: [
      { id: exampleEntityId(EXAMPLE_ID, 'roof'), label: 'Roof replacement', year: EXAMPLE_FIXED_YEAR + 4, amount: 28_000 },
      { id: exampleEntityId(EXAMPLE_ID, 'trip'), label: 'Big anniversary trip', year: EXAMPLE_FIXED_YEAR + 2, amount: 18_000 },
      { id: exampleEntityId(EXAMPLE_ID, 'gift'), label: 'Family gift / remodel', year: EXAMPLE_FIXED_YEAR + 6, amount: 35_000 },
    ],
    healthcare: { pre65MonthlyPremiumPerPerson: 720, applyAcaCredit: true, medicareExtrasMonthlyPerPerson: 190 },
    // No spendingPolicy, no required/ideal/excess
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

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`fixed-target-spending invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
