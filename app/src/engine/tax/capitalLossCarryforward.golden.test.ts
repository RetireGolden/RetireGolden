import { describe, it } from 'vitest'

import { expectMoney } from '../../testSupport/money'
import {
  recurringOrdinaryIncome,
  runPlan,
  singlePersonPlan,
} from '../../testSupport/planFixtures'
import { createFederalTaxCalculator } from './federalTax'
import { applyCapitalLossCarryforward } from './federalTax'
import { packForYear } from '../params'

/**
 * Atomic oracle tests for the capital-loss carryforward (Phase 1, calculation-test-plan.md).
 *
 * IRC Section 1211(b)/1212: a net loss pool offsets realized capital gains first,
 * then deducts up to the annual ordinary-offset limit ($3,000) of the remaining
 * net loss as a negative capital-gain line that reduces AGI; the rest carries
 * forward. Worksheets are hand-computed from those rules.
 */
const LIMIT = packForYear(2026).pack.federalTax.capitalLossOrdinaryOffsetLimit // 3,000

describe('capital-loss carryforward golden worksheets', () => {
  it('absorbs realized gains first, then takes the ordinary-offset deduction', () => {
    // Pool 20,000; gains 8,000. Absorb 8,000 of gains -> 12,000 left;
    // deduct 3,000 against ordinary -> 9,000 carries forward; net capital line -3,000.
    const r = applyCapitalLossCarryforward(20_000, 50_000, 8_000, LIMIT)
    expectMoney(r.usedAgainstGains, 8_000)
    expectMoney(r.usedAgainstOrdinary, 3_000)
    expectMoney(r.netCapitalGain, -3_000)
    expectMoney(r.remaining, 9_000)
  })

  it('takes only the annual deduction when there are no gains to absorb', () => {
    // Pool 10,000; no gains. Deduct 3,000 against ordinary -> 7,000 carries forward.
    const r = applyCapitalLossCarryforward(10_000, 50_000, 0, LIMIT)
    expectMoney(r.usedAgainstGains, 0)
    expectMoney(r.usedAgainstOrdinary, 3_000)
    expectMoney(r.netCapitalGain, -3_000)
    expectMoney(r.remaining, 7_000)
  })

  it('leaves no deduction or carryforward when the pool is smaller than the gains', () => {
    // Pool 5,000; gains 8,000. Pool fully absorbed by gains -> 3,000 of gains remain taxable.
    const r = applyCapitalLossCarryforward(5_000, 50_000, 8_000, LIMIT)
    expectMoney(r.usedAgainstGains, 5_000)
    expectMoney(r.usedAgainstOrdinary, 0)
    expectMoney(r.netCapitalGain, 3_000)
    expectMoney(r.remaining, 0)
  })

  it('is exactly inert with a zero pool', () => {
    // No pool -> gains pass through unchanged, nothing deducted or carried.
    const r = applyCapitalLossCarryforward(0, 50_000, 6_000, LIMIT)
    expectMoney(r.usedAgainstGains, 0)
    expectMoney(r.usedAgainstOrdinary, 0)
    expectMoney(r.netCapitalGain, 6_000)
    expectMoney(r.remaining, 0)
  })

  it('depletes the pool across years through simulatePlan, reducing AGI/MAGI', () => {
    // 8,000 pool, 50,000 ordinary income, no gains. Each year deducts 3,000 (then 2,000)
    // as a negative capital line: AGI = 50,000 - deduction.
    const plan = singlePersonPlan({ dob: '1966-01-01', planningAge: 62, state: 'FL' })
    plan.household.capitalLossCarryforward = 8_000
    plan.incomes = [recurringOrdinaryIncome('consulting', 50_000, 2026)]

    const result = runPlan(plan, createFederalTaxCalculator())

    // 2026: deduct 3,000 -> remaining 5,000; MAGI 47,000.
    expectMoney(result.years[0]!.capitalLossUsedAgainstOrdinary, 3_000)
    expectMoney(result.years[0]!.capitalLossCarryforwardRemaining, 5_000)
    expectMoney(result.years[0]!.magi, 47_000)

    // 2027: deduct 3,000 -> remaining 2,000; MAGI 47,000.
    expectMoney(result.years[1]!.capitalLossUsedAgainstOrdinary, 3_000)
    expectMoney(result.years[1]!.capitalLossCarryforwardRemaining, 2_000)
    expectMoney(result.years[1]!.magi, 47_000)

    // 2028: only 2,000 left -> deduct 2,000, pool exhausted; MAGI 48,000.
    expectMoney(result.years[2]!.capitalLossUsedAgainstOrdinary, 2_000)
    expectMoney(result.years[2]!.capitalLossCarryforwardRemaining, 0)
    expectMoney(result.years[2]!.magi, 48_000)
  })
})
