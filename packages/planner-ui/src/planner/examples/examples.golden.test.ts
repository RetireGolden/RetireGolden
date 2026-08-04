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
  // Re-baselined 2026-08-04 for the IRC 151(d)(5)(C) senior-deduction
  // correction. The phase-out now reduces the per-qualified-individual 6,000
  // rather than the combined base, so a household above the threshold loses the
  // deduction sooner. Only bracket-fill-roth moves: it is the one example whose
  // conversion ladder pushes MAGI into the phase-out band while both spouses are
  // 65 or over. Lifetime tax rises 453.31 and ending investable falls 2,750.88 --
  // more than the tax delta, because the extra tax is paid early and stops
  // compounding. Lifetime conversions rise 5,747.91: the optimizer now sees the
  // true marginal clawback and re-sizes the ladder around it.
  // Re-baselined 2026-07-29 for current-year ACA reconciliation. Curated
  // credit-enabled examples now carry explicit per-year tax-family, coverage,
  // enrollment-premium, and SLCSP assumptions. Their same-year withdrawals,
  // gains, conversions, and premium credits converge on the exact ledger;
  // below-100%-FPL years conservatively fund gross premium.
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
  'under-saved-single': { depletionYear: 2045, endingInvestable: 0, lifetimeTax: 237_089.71, lifetimeRoth: 0 },
  'bracket-fill-roth': { depletionYear: null, endingInvestable: 598_308.02, lifetimeTax: 222_970.66, lifetimeRoth: 824_850.69 },
  // early-retiree-aca retuned 2026-07-30: the old baseline (55k consulting,
  // fill to the 12% bracket) had its only actionable ACA year above 400% FPL,
  // so the example could not show a credit at all. It now converts to the 10%
  // bracket on smaller consulting income, holding the current year below the
  // cliff with a positive credit that a one-bracket raise visibly forfeits.
  'early-retiree-aca': { depletionYear: null, endingInvestable: 456_642.15, lifetimeTax: 153_792.57, lifetimeRoth: 51_986.09 },
  'rmd-irmaa': { depletionYear: null, endingInvestable: 1_404_004.34, lifetimeTax: 606_966.14, lifetimeRoth: 0 },
  'survivor-years': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 120_668.41, lifetimeRoth: 0 },
  'moving-state-tax': { depletionYear: null, endingInvestable: 3_688_834.11, lifetimeTax: 889_265.16, lifetimeRoth: 0 },
  'ltc-shock': { depletionYear: 2033, endingInvestable: 0, lifetimeTax: 0, lifetimeRoth: 0 },
  'early-career-match': { depletionYear: null, endingInvestable: 14_837_980.98, lifetimeTax: 4_063_312.79, lifetimeRoth: 0 },
  'aggressive-saver': { depletionYear: null, endingInvestable: 127_552_583.07, lifetimeTax: 9_647_567.19, lifetimeRoth: 0 },
  // coast-fire reviewed 2026-07-16: CO standard deduction moved to the 2026
  // federal-equivalent ($15,750 -> $16,100) in the state-pack staleness sweep,
  // lowering lifetime CO tax slightly and raising ending assets to match.
  'coast-fire': { depletionYear: null, endingInvestable: 5_229_269.19, lifetimeTax: 2_636_525.34, lifetimeRoth: 0 },
  'barista-fire': { depletionYear: null, endingInvestable: 9_656_052.52, lifetimeTax: 2_609_171.43, lifetimeRoth: 0 },
  'bridge-early-retirement': { depletionYear: null, endingInvestable: 10_498_129.98, lifetimeTax: 1_921_030.97, lifetimeRoth: 0 },
  'lean-fat-fire': { depletionYear: null, endingInvestable: 39_075_995.48, lifetimeTax: 4_443_317.72, lifetimeRoth: 0 },
  'hsa-stealth-retirement': { depletionYear: null, endingInvestable: 2_397_703.7, lifetimeTax: 1_322_396.18, lifetimeRoth: 0 },
  'salary-growth-escalation': { depletionYear: null, endingInvestable: 39_384_123.23, lifetimeTax: 4_383_204.12, lifetimeRoth: 0 },
  // New July enhancement examples (positive/negative cases for guardrails, annuities+estate, allocation+MC v2, HSA/property depth)
  'guardrails-flex-goals': { depletionYear: 2041, endingInvestable: 0, lifetimeTax: 7_903.47, lifetimeRoth: 0 },
  'annuity-purchases-estate': { depletionYear: null, endingInvestable: 3167948.18, lifetimeTax: 394965.43, lifetimeRoth: 827479.46 },
  'glidepath-allocation': { depletionYear: null, endingInvestable: 1_260_922.58, lifetimeTax: 356_793.44, lifetimeRoth: 776_566.11 },
  // Re-baselined for exact committed Form 8606 line-8 character: generated
  // conversions now size gross dollars against their taxable fraction.
  'hsa-property-depth': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 34_800.61, lifetimeRoth: 179_968.99 },
  // A-B control variants for direct Plan Compare (fixed target, no annuity, static allocation, no HSA)
  'fixed-target-spending': { depletionYear: 2034, endingInvestable: 0, lifetimeTax: 7_491.75, lifetimeRoth: 0 },
  'no-annuity-brokerage': { depletionYear: null, endingInvestable: 3610277.06, lifetimeTax: 318495.46, lifetimeRoth: 1242014.22 },
  'static-allocation-control': { depletionYear: null, endingInvestable: 821_727.93, lifetimeTax: 338_005.22, lifetimeRoth: 718_088.16 },
  'brokerage-no-hsa': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 25_634.07, lifetimeRoth: 0 },
  // A-B decision pairs (savings location for early retirement; Trump-account IRA head start).
  // The A-vs-B deltas are the story: the all-401(k) control pays $64.7k of
  // early-withdrawal penalties and loses ACA credits to withdrawal-driven
  // current-year MAGI, depleting before the identical-budget bridge version;
  // the seeded IRA still compounds into a ~$7.6M larger estate on
  // identical behavior.
  'all-401k-no-bridge': { depletionYear: 2060, endingInvestable: 0, lifetimeTax: 1_139_812.12, lifetimeRoth: 0 },
  'brokerage-bridge-401k': { depletionYear: 2062, endingInvestable: 0, lifetimeTax: 1_068_315.12, lifetimeRoth: 0 },
  'no-head-start-grad': { depletionYear: null, endingInvestable: 14_722_864.54, lifetimeTax: 5_275_288.49, lifetimeRoth: 0 },
  'trump-account-head-start': { depletionYear: null, endingInvestable: 22_293_798.15, lifetimeTax: 7_403_311.42, lifetimeRoth: 0 },
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
