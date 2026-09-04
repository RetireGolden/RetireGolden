/**
 * Delegation and live-identity guard for the annual annuity-purchase
 * application phase.
 *
 * Scaffolding and the policy behind it live in
 * `simulate.seamGuard.test-support.ts`; the sentinels stay here. What the
 * purchase costs and what gain a taxable source realizes is
 * `annualAnnuityPurchaseFunding.ts`'s answer and its own suite's business.
 *
 * **What the sentinel is.** The phase returns one value -- the running
 * realized-gain total with this year's purchase folded in -- and the year
 * publishes it inside `realizedGains`. The fixture funds a
 * purchase from a taxable account at a loss, so the natural total is non-zero
 * and a caller that kept its own running total would publish that instead.
 *
 * **And what the identity assertions are for.** Everything else this phase does
 * is a mutation of something the caller owns, so the input side is where a copy
 * would show up: the live physical rows, the live contract-value map and the
 * live investment-in-contract map all have to arrive by identity, because the
 * year publishes from all three after the phase returns.
 */
import { describe, expect, it, vi } from 'vitest'

import type {
  AnnualAnnuityPurchaseApplicationPhaseInput,
  AnnualAnnuityPurchaseApplicationPhaseResult,
} from './internal/annualAnnuityPurchaseApplicationPhase.js'

const seam = await vi.hoisted(
  async () =>
    (
      await import('./simulate.seamGuard.test-support.js')
    ).createSeamRecorder<
      AnnualAnnuityPurchaseApplicationPhaseInput,
      AnnualAnnuityPurchaseApplicationPhaseResult
    >(),
)

vi.mock('./internal/annualAnnuityPurchaseApplicationPhase.js', async (importOriginal) =>
  seam.through(
    await importOriginal<
      typeof import('./internal/annualAnnuityPurchaseApplicationPhase.js')
    >(),
    'annualAnnuityPurchaseApplicationPhase',
    (natural, { ordinal }): AnnualAnnuityPurchaseApplicationPhaseResult => ({
      rebalanceRealizedGains: natural.rebalanceRealizedGains - 1_300 - ordinal,
    }),
  ),
)

import {
  expectDistinctInjections,
  expectSeamRan,
} from './simulate.seamGuard.test-support.js'
import type { Account, Plan } from '../model/plan.js'
import { createFlatTaxCalculator } from '../testing/flatTax.js'
import { basePlan, cash, validate } from './simulate.test-support.js'
import { simulatePlan } from './simulate.js'

const START_YEAR = 2026
const END_YEAR = 2027

/**
 * A taxable-funded purchase at a loss, so the phase's own fold is non-zero in
 * the purchase year and the sentinel cannot be mistaken for it. Nothing here
 * sells property or buys a TIPS ladder, so no later block adds to the running
 * total and the published number is exactly what the seam returned.
 */
function annuityPurchasePlan(): Plan {
  const plan = basePlan()
  const brokerage: Account = {
    type: 'taxable',
    id: 'taxable1',
    name: 'Brokerage',
    ownerPersonId: null,
    annualReturnPct: null,
    balance: 300_000,
    costBasis: 400_000,
    interestYieldPct: 0,
    dividendYieldPct: 0,
    qualifiedRatio: 0.85,
    reinvestDividends: true,
    annualContribution: 0,
  }
  const annuity: Account = {
    type: 'annuity',
    id: 'ann1',
    name: 'SPIA',
    ownerPersonId: 'p1',
    annualReturnPct: null,
    startAge: 62,
    monthlyAmount: 500,
    colaPct: 0,
    taxablePct: 100,
    purchase: {
      year: START_YEAR,
      premium: 100_000,
      fundingAccountId: 'taxable1',
      taxQualification: 'nonQualified',
    },
  }
  plan.accounts = [cash(200_000), brokerage, annuity]
  plan.expenses.baseAnnual = 20_000
  return validate(plan)
}

describe('annual annuity purchase application delegation', () => {
  it('publishes the seam\'s own running realized-gain total', () => {
    seam.reset()
    const result = simulatePlan(annuityPurchasePlan(), {
      startYear: START_YEAR,
      horizonEndYear: END_YEAR,
      taxCalculator: createFlatTaxCalculator(0),
    })

    const calls = expectSeamRan(seam, END_YEAR - START_YEAR + 1)
    expectDistinctInjections(seam)

    for (const [index, call] of calls.entries()) {
      // The caller hands the phase this year's own facts, not a stale copy.
      expect(call.input.year).toBe(START_YEAR + index)
      // Live and by identity: the year publishes from all three of these after
      // the phase returns, so a defensive copy would lose every purchase.
      expect(call.input.balances).toBe(calls[0]?.input.balances)
      expect(call.input.annuityContractValue).toBe(calls[0]?.input.annuityContractValue)
      expect(call.input.annuityInvestmentInContract)
        .toBe(calls[0]?.input.annuityInvestmentInContract)

      const published = result.years[index]
      if (published === undefined) throw new Error('expected a published year')
      // Nothing in this fixture sells a taxable position or executes a
      // retirement action, so the year's total realized gain IS the
      // rebalance component the seam returned.
      expect(published.realizedGains).toBe(call.injected.rebalanceRealizedGains)
      // The natural answer really was different, so the assertion above cannot
      // pass on a value the phase would have produced anyway.
      expect(call.natural.rebalanceRealizedGains)
        .not.toBe(call.injected.rebalanceRealizedGains)
    }
    // The purchase year really did fold a loss, so the fixture exercises the
    // application loop rather than an empty one.
    expect(calls[0]?.natural.rebalanceRealizedGains).toBeLessThan(0)
  })
})
