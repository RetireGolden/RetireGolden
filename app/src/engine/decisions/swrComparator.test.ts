/**
 * SWR comparator tests (spending-paths & SWR-lenses plan, Goal 3 acceptance):
 * each rule's parameterization matches its citation, and same-path deltas are
 * stable (deterministic ledger, insensitive to the plan's own spending shape).
 */

import { describe, expect, it } from 'vitest'

import { simOptions, noTraditionalPlan } from './decisionFixtures'
import { compareSwrRules, SWR_DEFAULT_CAPE, SWR_RULES } from './swrComparator'
import { startingInvestableOf } from '../montecarlo/riskBasedGuardrails'

describe('SWR rule parameterizations', () => {
  it('match their citations', () => {
    const byId = new Map(SWR_RULES.map((r) => [r.id, r]))
    expect(byId.get('bengen-2025')!.initialRatePct(SWR_DEFAULT_CAPE)).toBe(4.7)
    expect(byId.get('morningstar-2026')!.initialRatePct(SWR_DEFAULT_CAPE)).toBe(3.9)
    // ERN: 1.75 + 0.5 × (100/25) = 3.75; richer valuations ⇒ lower rate.
    expect(byId.get('ern-cape')!.initialRatePct(25)).toBeCloseTo(3.75, 10)
    expect(byId.get('ern-cape')!.initialRatePct(35)).toBeLessThan(byId.get('ern-cape')!.initialRatePct(25))
  })
})

describe('compareSwrRules', () => {
  it('prices each rule on the plan starting balance with a deterministic ledger run', () => {
    const plan = noTraditionalPlan()
    const results = compareSwrRules(plan, simOptions())
    const investable = startingInvestableOf(plan)

    expect(results).toHaveLength(SWR_RULES.length)
    for (const r of results) {
      expect(r.initialAnnualSpend).toBeCloseTo((r.initialRatePct / 100) * investable, 6)
      expect(r.endYear).toBeGreaterThan(2026)
      expect(r.citation.length).toBeGreaterThan(10)
    }

    // Same-path stability: identical inputs reproduce identical deltas.
    const again = compareSwrRules(plan, simOptions())
    expect(again).toEqual(results)

    // Higher rates spend more, leaving less estate (or depleting earlier).
    const byId = new Map(results.map((r) => [r.id, r]))
    const bengen = byId.get('bengen-2025')!
    const morningstar = byId.get('morningstar-2026')!
    expect(bengen.initialAnnualSpend).toBeGreaterThan(morningstar.initialAnnualSpend)
    if (bengen.depletionYear === null && morningstar.depletionYear === null) {
      expect(bengen.endingAfterTaxEstate).toBeLessThan(morningstar.endingAfterTaxEstate)
    }
  })

  it("is insensitive to the plan's own spending shape and policy (rules are constant-real)", () => {
    const base = noTraditionalPlan()
    const shaped = {
      ...base,
      expenses: {
        ...base.expenses,
        phases: [{ fromAge: 75, multiplier: 0.5 }],
        spendingPolicy: { mode: 'withdrawalRateGuardrails' as const },
      },
    }
    expect(compareSwrRules(shaped, simOptions())).toEqual(compareSwrRules(base, simOptions()))
  })

  it('does not inherit the annual upside layers (a rule spends exactly its rate)', () => {
    // In fixed-target mode ideal/excess fund on top of baseAnnual; a rule
    // advertised as rate × portfolio must not carry them (Codex review P2).
    const base = noTraditionalPlan()
    const withUpside = {
      ...base,
      expenses: { ...base.expenses, idealAnnual: 20_000, excessAnnual: 10_000 },
    }
    expect(compareSwrRules(withUpside, simOptions())).toEqual(compareSwrRules(base, simOptions()))
  })

  it('does not mutate the input plan', () => {
    const plan = noTraditionalPlan()
    const snapshot = JSON.stringify(plan)
    compareSwrRules(plan, simOptions())
    expect(JSON.stringify(plan)).toBe(snapshot)
  })
})
