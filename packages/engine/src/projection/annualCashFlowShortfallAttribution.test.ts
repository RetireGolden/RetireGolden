/**
 * Discriminating unit tests for residual cash-flow shortfall attribution.
 *
 * Expected values are independent hand worksheets, never taken from running
 * the assembler. Deferred goals are the caller's job: asserted by not passing
 * them in. Does not require `simulatePlan`.
 */
import { describe, expect, it } from 'vitest'

import {
  attributeCashFlowShortfall,
  type CashFlowShortfallLineInput,
} from './annualCashFlowShortfallAttribution.js'

function line(
  id: string,
  layer: CashFlowShortfallLineInput['layer'],
  requested: number,
  attempted: number,
): CashFlowShortfallLineInput {
  return {
    id,
    layer,
    requestedPlanDollars: requested,
    attemptedFundedPlanDollars: attempted,
  }
}

function byId(result: ReturnType<typeof attributeCashFlowShortfall>, id: string) {
  const found = result.lines.find((row) => row.id === id)
  if (found === undefined) throw new Error(`missing line ${id}`)
  return found
}

function expectIdentity(row: { requestedPlanDollars: number; fundedPlanDollars: number; unfundedPlanDollars: number }) {
  expect(row.requestedPlanDollars).toBeCloseTo(row.fundedPlanDollars + row.unfundedPlanDollars, 12)
}

describe('attributeCashFlowShortfall', () => {
  it('books a guardrail-cut lifestyle unfunded before applying the residual', () => {
    // Independent worksheet:
    //   target requested 10,000, attempted (post-guardrail) 7,000 → own-line unfunded 3,000
    //   required requested = attempted 8,000
    //   shortfallAfterHecm 1,000 hits excess first, then ideal, then target
    //   no excess/ideal candidates → residual 1,000 reduces target funded 7,000 → 6,000
    //   required is untouched; own-line 3,000 stays even if residual were 0
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 1_000,
      lines: [
        line('use:excessLifestyle:household', 'excess', 0, 0),
        line('use:idealLifestyle:household', 'ideal', 0, 0),
        line('use:targetLifestyle:household', 'target', 10_000, 7_000),
        line('use:requiredLifestyle:household', 'required', 8_000, 8_000),
      ],
    })
    const target = byId(result, 'use:targetLifestyle:household')
    expect(target.requestedPlanDollars).toBe(10_000)
    expect(target.fundedPlanDollars).toBe(6_000)
    expect(target.unfundedPlanDollars).toBe(4_000)
    const required = byId(result, 'use:requiredLifestyle:household')
    expect(required.fundedPlanDollars).toBe(8_000)
    expect(required.unfundedPlanDollars).toBe(0)
    expect(result.remainingUnattributed).toBe(0)
    for (const row of result.lines) expectIdentity(row)
  })

  it('does not invent a deferred-goal line — callers omit them', () => {
    // Independent worksheet: a deferred goal is excluded from the year
    // entirely. Passing only the funded car goal of 12,000 with 0 residual
    // yields that one line; no deferred-id appears.
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 0,
      lines: [
        line('use:oneTimeGoal:car', 'target', 12_000, 12_000),
      ],
    })
    expect(result.lines.map((row) => row.id)).toEqual(['use:oneTimeGoal:car'])
    expect(result.lines.some((row) => row.id.includes('deferred'))).toBe(false)
  })

  it('applies residual in excess → ideal → target → required order', () => {
    // Independent worksheet:
    //   excess 4,000 attempted, ideal 3,000, target 5,000, required 10,000
    //   shortfallAfterHecm 8,000
    //   excess takes 4,000 (funded 0); remaining 4,000
    //   ideal takes 3,000 (funded 0); remaining 1,000
    //   target takes 1,000 → funded 4,000, unfunded 1,000
    //   required untouched
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 8_000,
      lines: [
        line('use:requiredLifestyle:household', 'required', 10_000, 10_000),
        line('use:targetLifestyle:household', 'target', 5_000, 5_000),
        line('use:idealLifestyle:household', 'ideal', 3_000, 3_000),
        line('use:excessLifestyle:household', 'excess', 4_000, 4_000),
      ],
    })
    expect(byId(result, 'use:excessLifestyle:household')).toEqual({
      id: 'use:excessLifestyle:household',
      requestedPlanDollars: 4_000,
      fundedPlanDollars: 0,
      unfundedPlanDollars: 4_000,
    })
    expect(byId(result, 'use:idealLifestyle:household')).toEqual({
      id: 'use:idealLifestyle:household',
      requestedPlanDollars: 3_000,
      fundedPlanDollars: 0,
      unfundedPlanDollars: 3_000,
    })
    expect(byId(result, 'use:targetLifestyle:household')).toEqual({
      id: 'use:targetLifestyle:household',
      requestedPlanDollars: 5_000,
      fundedPlanDollars: 4_000,
      unfundedPlanDollars: 1_000,
    })
    expect(byId(result, 'use:requiredLifestyle:household')).toEqual({
      id: 'use:requiredLifestyle:household',
      requestedPlanDollars: 10_000,
      fundedPlanDollars: 10_000,
      unfundedPlanDollars: 0,
    })
    expect(result.remainingUnattributed).toBe(0)
  })

  it('allocates within a layer pro rata by remaining funded, last candidate getting IEEE residue', () => {
    // Independent worksheet:
    //   two required debts, attempted 40 and 20, shortfallAfterHecm 30
    //   no excess/ideal/target
    //   take = min(30, 60) = 30
    //   A weight 40 → 30 × 40/60 = 20; B (last) gets 30 − 20 = 10
    //   A funded 20 unfunded 20; B funded 10 unfunded 10
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 30,
      lines: [
        line('use:debtService:mort-a', 'required', 40, 40),
        line('use:debtService:mort-b', 'required', 20, 20),
      ],
    })
    expect(byId(result, 'use:debtService:mort-a')).toEqual({
      id: 'use:debtService:mort-a',
      requestedPlanDollars: 40,
      fundedPlanDollars: 20,
      unfundedPlanDollars: 20,
    })
    expect(byId(result, 'use:debtService:mort-b')).toEqual({
      id: 'use:debtService:mort-b',
      requestedPlanDollars: 20,
      fundedPlanDollars: 10,
      unfundedPlanDollars: 10,
    })
    expect(result.remainingUnattributed).toBe(0)
  })

  it('sends leftover after spending to tax, then penalties, then contributions', () => {
    // Independent worksheet:
    //   required spending attempted 5, tax 4, penalty 3, contribution 8
    //   shortfallAfterHecm 15
    //   required takes 5; remaining 10
    //   tax takes 4; remaining 6
    //   penalty takes 3; remaining 3
    //   contribution takes 3 → funded 5, unfunded 3
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 15,
      lines: [
        line('use:requiredLifestyle:household', 'required', 5, 5),
        line('use:settledTax:household', 'tax', 4, 4),
        line('use:earlyWithdrawalPenalty:account:ira1:traditionalEarly', 'penalty', 3, 3),
        line('use:contribution:401k', 'contribution', 8, 8),
      ],
    })
    expect(byId(result, 'use:requiredLifestyle:household').fundedPlanDollars).toBe(0)
    expect(byId(result, 'use:settledTax:household')).toEqual({
      id: 'use:settledTax:household',
      requestedPlanDollars: 4,
      fundedPlanDollars: 0,
      unfundedPlanDollars: 4,
    })
    expect(byId(result, 'use:earlyWithdrawalPenalty:account:ira1:traditionalEarly').fundedPlanDollars).toBe(0)
    expect(byId(result, 'use:contribution:401k')).toEqual({
      id: 'use:contribution:401k',
      requestedPlanDollars: 8,
      fundedPlanDollars: 5,
      unfundedPlanDollars: 3,
    })
    expect(result.remainingUnattributed).toBe(0)
    for (const row of result.lines) expectIdentity(row)
  })

  it('never reduces surplus', () => {
    // Independent worksheet:
    //   surplus attempted 2,000 with shortfallAfterHecm 500 and no other
    //   funded candidates. Surplus stays fully funded; leftover 500 is
    //   returned (a genuine shortfall cannot coexist with surplus in the
    //   ledger, but the helper still refuses to raid it).
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 500,
      lines: [
        line('use:surplusInvestment:account:cash-1', 'surplus', 2_000, 2_000),
      ],
    })
    expect(byId(result, 'use:surplusInvestment:account:cash-1')).toEqual({
      id: 'use:surplusInvestment:account:cash-1',
      requestedPlanDollars: 2_000,
      fundedPlanDollars: 2_000,
      unfundedPlanDollars: 0,
    })
    expect(result.remainingUnattributed).toBe(500)
  })

  it('returns leftover remaining after the contribution group instead of plugging Other', () => {
    // Independent worksheet:
    //   spending+tax+penalties+contributions attempted funded = 6
    //   shortfallAfterHecm = 10
    //   all four groups go to funded 0; leftover 4 is returned, not assigned
    //   to a synthetic use line
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 10,
      lines: [
        line('use:requiredLifestyle:household', 'required', 1, 1),
        line('use:settledTax:household', 'tax', 2, 2),
        line('use:earlyWithdrawalPenalty:household:traditionalEarly', 'penalty', 1, 1),
        line('use:contribution:ira-1', 'contribution', 2, 2),
      ],
    })
    expect(result.lines.every((row) => row.fundedPlanDollars === 0)).toBe(true)
    expect(result.remainingUnattributed).toBe(4)
    expect(result.lines.some((row) => row.id.includes('other') || row.id.includes('Other'))).toBe(false)
    for (const row of result.lines) expectIdentity(row)
  })

  it('fail-closes when attempted funded of every residual group is less than shortfallAfterHecm', () => {
    // Constructed case the current ledger should not produce: residual 100
    // against 0 attempted funded anywhere. Helper returns remaining 100 and
    // emits no plugged line. Assemble then cashIdentityMismatch.
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 100,
      lines: [
        line('use:requiredLifestyle:household', 'required', 50, 0),
        line('use:settledTax:household', 'tax', 0, 0),
      ],
    })
    expect(result.remainingUnattributed).toBe(100)
    expect(byId(result, 'use:requiredLifestyle:household').unfundedPlanDollars).toBe(50)
    expect(byId(result, 'use:requiredLifestyle:household').fundedPlanDollars).toBe(0)
  })

  it('keeps requested = funded + unfunded at native precision including IEEE residue', () => {
    // Independent worksheet:
    //   two equal required lines of 1, take 1/3
    //   first share = (1/3) × (1/2) = 1/6
    //   last gets 1/3 − 1/6 = 1/6
    const result = attributeCashFlowShortfall({
      shortfallAfterHecm: 1 / 3,
      lines: [
        line('use:debtService:a', 'required', 1, 1),
        line('use:debtService:b', 'required', 1, 1),
      ],
    })
    const a = byId(result, 'use:debtService:a')
    const b = byId(result, 'use:debtService:b')
    expectIdentity(a)
    expectIdentity(b)
    expect(a.unfundedPlanDollars + b.unfundedPlanDollars).toBeCloseTo(1 / 3, 12)
    expect(result.remainingUnattributed).toBe(0)
  })
})
