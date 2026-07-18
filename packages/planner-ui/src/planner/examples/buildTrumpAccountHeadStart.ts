/** Trump-account IRA head start (A-B pair with no-head-start-grad).
 * Illustrative by design: the library clock is fixed at 2026, and a 22-year-old
 * in 2026 could not actually have had a Trump account (contributions began
 * July 4, 2026). The plan shows what a child born under the program will
 * experience at 22: the childhood account — $1,000 federal seed at birth plus
 * $2,500/yr family contributions to 18 at 7% (≈ $88,400) — became a traditional
 * IRA at 18 by operation of law, then grew untouched to ≈ $115,800 at 22.
 * Family contributions are after-tax, so the IRA carries $45,000 (18 × $2,500)
 * of Form 8606 nondeductible basis; the seed, employer dollars, and earnings
 * are the pre-tax portion. Everything else is identical to the control.
 */

import { createEmptyPlan, parsePlan, type Plan } from '@retiregolden/engine/model/plan'
import { EXAMPLE_FIXED_YEAR, exampleEntityId, exampleFixedNow, exampleIdFactory } from './buildContext'

const EXAMPLE_ID = 'trump-account-head-start'

export function buildTrumpAccountHeadStart(): Plan {
  const p1 = exampleEntityId(EXAMPLE_ID, 'nova')
  const plan = createEmptyPlan({ name: 'Trump account IRA head start', now: exampleFixedNow, newId: exampleIdFactory(EXAMPLE_ID) })

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

  // Decision under study: the seeded IRA. The former Trump account is an
  // ordinary traditional IRA post-18 — no special account type needed; the
  // engine's nondeductibleBasis pro-rata machinery prices any withdrawal or
  // conversion.
  plan.accounts = [
    { type: 'cash', id: exampleEntityId(EXAMPLE_ID, 'cash'), name: 'Emergency fund', ownerPersonId: null, annualReturnPct: 3, balance: 8_000, annualContribution: 0 },
    // Listed before the 401(k) so sequential withdrawals and the conversion
    // scenario draw from the seeded IRA (and its Form 8606 basis) first.
    {
      type: 'traditional',
      id: exampleEntityId(EXAMPLE_ID, 'headstart-ira'),
      name: 'Traditional IRA (former Trump account)',
      ownerPersonId: p1,
      annualReturnPct: 7,
      kind: 'ira',
      balance: 115_800,
      nondeductibleBasis: 45_000,
      annualContribution: 0,
    },
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
    // the low-income conversion scenario a destination account.
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

  // The CNBC "legal backdoor" teaching point: converting in early low-bracket
  // years is cheap — the $45,000 basis converts tax-free (pro-rata) and the
  // pre-tax portion fills only the 12% bracket. OFF in the base plan so Compare
  // isolates the head start itself; kiddie-tax caveat lives in the article.
  plan.scenarios = [
    {
      id: exampleEntityId(EXAMPLE_ID, 'low-income-conversions'),
      name: 'Convert to Roth in low-income years',
      patch: {
        strategies: {
          rothConversion: { mode: 'fillToTarget', target: 'topOfBracket', targetValue: 12, startYear: EXAMPLE_FIXED_YEAR, endYear: EXAMPLE_FIXED_YEAR + 4 },
        },
      },
    },
  ]

  const parsed = parsePlan(plan)
  if (!parsed.ok) throw new Error(`trump-account-head-start invalid: ${parsed.issues.join('; ')}`)
  return parsed.plan
}
