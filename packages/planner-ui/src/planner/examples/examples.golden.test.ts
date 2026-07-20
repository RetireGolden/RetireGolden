import { describe, expect, it } from 'vitest'

import { summarizeProjection } from '@retiregolden/engine/projection/compare'
import { simulatePlan } from '@retiregolden/engine/projection/simulate'
import { combineTaxCalculators, createFederalTaxCalculator } from '@retiregolden/engine/tax/federalTax'
import { createStateTaxCalculator } from '@retiregolden/engine/tax/stateTax'
import { EXAMPLE_FIXED_YEAR } from './buildContext'
import { EXAMPLE_PLANS } from './registry'

function taxCalculatorFor(plan: ReturnType<(typeof EXAMPLE_PLANS)[0]['build']>) {
  return combineTaxCalculators(
    createFederalTaxCalculator(),
    createStateTaxCalculator({
      overridePct: plan.assumptions.stateEffectiveTaxPct,
      localPct: plan.assumptions.localIncomeTaxPct,
    }),
  )
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

const EXPECTED: Record<string, { depletionYear: number | null; endingInvestable: number; lifetimeTax: number; lifetimeRoth: number }> = {
  // Re-baselined 2026-07-20 for the tax/withdrawal fixed-point correction.
  // These example KPIs are characterization snapshots: the engine now commits
  // the withdrawal plan that produced the accepted tax and penalties, rather
  // than re-planning once more from those values. Depletion outcomes are
  // unchanged; the small lifetime deltas are the cumulative effect of keeping
  // each year's realized withdrawals and assessed tax internally consistent.
  // Re-baselined 2026-07-01 for age-65 birth-month ACA/Medicare proration: both
  // spouses have mid-year birthdays, so their transition years now carry
  // marketplace months (at $950/mo) that the old full-year Medicare switch
  // skipped, lowering the ending balance.
  'example-couple': { depletionYear: null, endingInvestable: 2_230_556.28, lifetimeTax: 466_877.85, lifetimeRoth: 1_351_214.42 },
  'under-saved-single': { depletionYear: 2044, endingInvestable: 0, lifetimeTax: 236_526.2, lifetimeRoth: 0 },
  'bracket-fill-roth': { depletionYear: null, endingInvestable: 601_058.9, lifetimeTax: 222_517.35, lifetimeRoth: 819_102.78 },
  'early-retiree-aca': { depletionYear: null, endingInvestable: 2_218_626.86, lifetimeTax: 464_950.3, lifetimeRoth: 47_501.93 },
  'rmd-irmaa': { depletionYear: null, endingInvestable: 1_404_004.34, lifetimeTax: 606_966.14, lifetimeRoth: 0 },
  'survivor-years': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 120_668.41, lifetimeRoth: 0 },
  'moving-state-tax': { depletionYear: null, endingInvestable: 3_688_834.11, lifetimeTax: 889_265.16, lifetimeRoth: 0 },
  'ltc-shock': { depletionYear: 2034, endingInvestable: 0, lifetimeTax: 0, lifetimeRoth: 0 },
  'early-career-match': { depletionYear: null, endingInvestable: 15041257.78, lifetimeTax: 4063312.79, lifetimeRoth: 0 },
  'aggressive-saver': { depletionYear: null, endingInvestable: 134029647.06, lifetimeTax: 9624637.38, lifetimeRoth: 0 },
  // coast-fire reviewed 2026-07-16: CO standard deduction moved to the 2026
  // federal-equivalent ($15,750 -> $16,100) in the state-pack staleness sweep,
  // lowering lifetime CO tax slightly and raising ending assets to match.
  'coast-fire': { depletionYear: null, endingInvestable: 5229269.19, lifetimeTax: 2636525.34, lifetimeRoth: 0 },
  'barista-fire': { depletionYear: null, endingInvestable: 13354913.97, lifetimeTax: 3238330.53, lifetimeRoth: 0 },
  'bridge-early-retirement': { depletionYear: null, endingInvestable: 11161008.01, lifetimeTax: 2016773.72, lifetimeRoth: 0 },
  'lean-fat-fire': { depletionYear: null, endingInvestable: 42683404.3, lifetimeTax: 4430220.75, lifetimeRoth: 0 },
  'hsa-stealth-retirement': { depletionYear: null, endingInvestable: 3919830.6, lifetimeTax: 1356755.17, lifetimeRoth: 0 },
  'salary-growth-escalation': { depletionYear: null, endingInvestable: 40933990.75, lifetimeTax: 4373753.46, lifetimeRoth: 0 },
  // New July enhancement examples (positive/negative cases for guardrails, annuities+estate, allocation+MC v2, HSA/property depth)
  'guardrails-flex-goals': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 8448.08, lifetimeRoth: 0 },
  'annuity-purchases-estate': { depletionYear: null, endingInvestable: 3167948.18, lifetimeTax: 394965.43, lifetimeRoth: 827479.46 },
  'glidepath-allocation': { depletionYear: null, endingInvestable: 1250371.42, lifetimeTax: 355572.13, lifetimeRoth: 777333.6 },
  'hsa-property-depth': { depletionYear: 2044, endingInvestable: 0, lifetimeTax: 34408.39, lifetimeRoth: 201001.82 },
  // A-B control variants for direct Plan Compare (fixed target, no annuity, static allocation, no HSA)
  'fixed-target-spending': { depletionYear: 2035, endingInvestable: 0, lifetimeTax: 7697.48, lifetimeRoth: 0 },
  'no-annuity-brokerage': { depletionYear: null, endingInvestable: 3610277.06, lifetimeTax: 318495.46, lifetimeRoth: 1242014.22 },
  'static-allocation-control': { depletionYear: null, endingInvestable: 819501.53, lifetimeTax: 336850.25, lifetimeRoth: 718088.16 },
  'brokerage-no-hsa': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 33448.86, lifetimeRoth: 0 },
  // A-B decision pairs (savings location for early retirement; Trump-account IRA head start).
  // The A-vs-B deltas are the story: the all-401(k) control pays $64.7k of
  // early-withdrawal penalties, loses ACA credits to withdrawal-driven MAGI,
  // and depletes at 83, while the identical-budget bridge version reaches the
  // planning horizon; the seeded IRA compounds into a ~$7.6M larger estate on
  // identical behavior.
  'all-401k-no-bridge': { depletionYear: 2069, endingInvestable: 0, lifetimeTax: 1490577.34, lifetimeRoth: 0 },
  'brokerage-bridge-401k': { depletionYear: null, endingInvestable: 953835.68, lifetimeTax: 2118334.66, lifetimeRoth: 0 },
  'no-head-start-grad': { depletionYear: null, endingInvestable: 14990224.64, lifetimeTax: 5275288.49, lifetimeRoth: 0 },
  'trump-account-head-start': { depletionYear: null, endingInvestable: 22561799.59, lifetimeTax: 7402872.99, lifetimeRoth: 0 },
}

describe('example plan golden KPIs', () => {
  for (const example of EXAMPLE_PLANS) {
    it(`${example.title} pins headline results`, () => {
      const plan = example.build()
      const result = simulatePlan(plan, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(plan) })
      const summary = summarizeProjection(plan, result)
      const expected = EXPECTED[example.id]
      expect(expected, `missing golden fixture for ${example.id}`).toBeDefined()

      expect(summary.depletionYear).toBe(expected!.depletionYear)
      expect(round2(summary.endingInvestable)).toBe(expected!.endingInvestable)
      expect(round2(summary.lifetimeTaxesAndPenalties)).toBe(expected!.lifetimeTax)
      expect(round2(summary.lifetimeRothConversions)).toBe(expected!.lifetimeRoth)
    })
  }
})
