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
  // Re-baselined 2026-08-03 for the IRC 1(j)(3)(B) indexing correction. The
  // projection is nominal, but the federal rate brackets, standard deduction,
  // capital-gain breakpoints and AMT amounts were read off the 2026 pack for
  // every projected year. Congress re-prescribes all of them annually, so the
  // engine was measuring inflated income against frozen thresholds and inventing
  // bracket creep the statute does not create. Removing it moves 26 of the 28
  // examples, and the size of each move is essentially how many years of
  // compounding the household spends past the pack year.
  //
  // Directions are uniform where the statute says they must be. Lifetime tax
  // falls everywhere it moves at all; ending investable rises everywhere it is
  // not pinned at zero by depletion; and the three depletion years that move,
  // move LATER -- under-saved-single 2045 to 2046, all-401k-no-bridge 2060 to
  // 2067, brokerage-bridge-401k 2062 to 2068. Nothing depletes sooner. The two
  // long-horizon A-B examples move most because they run ~34 years past the
  // pack, where the cumulative index is ~2.3x and the frozen-threshold error is
  // correspondingly largest.
  //
  // Only bracket-fill-roth's lifetime tax rises (+304.24), and it rises for the
  // right reason: it is the one example with a fill-to-bracket ladder, so a
  // wider bracket is an instruction to convert MORE. It converts +5,823 in 2027,
  // +12,092 in 2028 and +19,881 in 2029 -- the indexed 22% ceiling compounding
  // away from the frozen one -- which drains both IRAs a year sooner and leaves
  // only 9,330 for the 2030 mop-up year instead of 56,329. Lifetime conversions
  // therefore FALL 9,203.79: the ladder finishes earlier, so less traditional
  // balance ever compounds into being converted. The extra nominal tax buys a
  // larger Roth position at a lower effective rate (17.51% of MAGI in 2029
  // against 17.58% before), which is why ending investable still rises 2,827.78.
  //
  // Two examples do not move, and neither can. ltc-shock has zero MAGI in every
  // projected year -- there is no taxable income for a threshold to bind on.
  // guardrails-flex-goals pays zero FEDERAL tax in every year (its income sits
  // under the standard deduction once section 86 is applied); its entire
  // 7,903.47 is Kentucky income tax, and state brackets are deliberately left
  // nominal here (see params/state/index.ts -- indexing is a per-state question
  // and a known modeling gap, not a federal-law parallel).
  //
  // The A-B narratives below survive: all-401k-no-bridge still depletes before
  // its bridge twin and still pays more lifetime tax, and the seeded-IRA estate
  // gap widens with the horizon. Both prose figures are restated at their
  // comments.
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
  'example-couple': { depletionYear: null, endingInvestable: 2_272_928.12, lifetimeTax: 451_207.76, lifetimeRoth: 1_464_472.03 },
  'under-saved-single': { depletionYear: 2046, endingInvestable: 0, lifetimeTax: 183_713.99, lifetimeRoth: 0 },
  'bracket-fill-roth': { depletionYear: null, endingInvestable: 603_886.68, lifetimeTax: 222_821.59, lifetimeRoth: 809_898.99 },
  // early-retiree-aca retuned 2026-07-30: the old baseline (55k consulting,
  // fill to the 12% bracket) had its only actionable ACA year above 400% FPL,
  // so the example could not show a credit at all. It now converts to the 10%
  // bracket on smaller consulting income, holding the current year below the
  // cliff with a positive credit that a one-bracket raise visibly forfeits.
  'early-retiree-aca': { depletionYear: null, endingInvestable: 539_207.42, lifetimeTax: 105_501.55, lifetimeRoth: 59_661.87 },
  'rmd-irmaa': { depletionYear: null, endingInvestable: 1_546_195.28, lifetimeTax: 512_837.64, lifetimeRoth: 0 },
  'survivor-years': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 79_020.67, lifetimeRoth: 0 },
  'moving-state-tax': { depletionYear: null, endingInvestable: 3_880_516.31, lifetimeTax: 732_565.75, lifetimeRoth: 0 },
  'ltc-shock': { depletionYear: 2033, endingInvestable: 0, lifetimeTax: 0, lifetimeRoth: 0 },
  'early-career-match': { depletionYear: null, endingInvestable: 17_025_657.14, lifetimeTax: 2_806_799.12, lifetimeRoth: 0 },
  'aggressive-saver': { depletionYear: null, endingInvestable: 138_916_241.94, lifetimeTax: 6_849_942.2, lifetimeRoth: 0 },
  // coast-fire reviewed 2026-07-16: CO standard deduction moved to the 2026
  // federal-equivalent ($15,750 -> $16,100) in the state-pack staleness sweep,
  // lowering lifetime CO tax slightly and raising ending assets to match.
  'coast-fire': { depletionYear: null, endingInvestable: 7_891_262.4, lifetimeTax: 1_782_760.83, lifetimeRoth: 0 },
  'barista-fire': { depletionYear: null, endingInvestable: 14_569_925.04, lifetimeTax: 2_091_401.98, lifetimeRoth: 0 },
  'bridge-early-retirement': { depletionYear: null, endingInvestable: 11_857_432.95, lifetimeTax: 1_427_360.2, lifetimeRoth: 0 },
  'lean-fat-fire': { depletionYear: null, endingInvestable: 43_545_918.82, lifetimeTax: 2_692_779.67, lifetimeRoth: 0 },
  'hsa-stealth-retirement': { depletionYear: null, endingInvestable: 4_484_178.89, lifetimeTax: 808_157.31, lifetimeRoth: 0 },
  'salary-growth-escalation': { depletionYear: null, endingInvestable: 46_295_269.76, lifetimeTax: 2_552_250.15, lifetimeRoth: 0 },
  // New July enhancement examples (positive/negative cases for guardrails, annuities+estate, allocation+MC v2, HSA/property depth)
  'guardrails-flex-goals': { depletionYear: 2041, endingInvestable: 0, lifetimeTax: 7_903.47, lifetimeRoth: 0 },
  'annuity-purchases-estate': { depletionYear: null, endingInvestable: 3_254_253.2, lifetimeTax: 342_232.06, lifetimeRoth: 857_968.22 },
  'glidepath-allocation': { depletionYear: null, endingInvestable: 1_272_036.74, lifetimeTax: 347_184.45, lifetimeRoth: 765_715.27 },
  // Re-baselined for exact committed Form 8606 line-8 character: generated
  // conversions now size gross dollars against their taxable fraction.
  'hsa-property-depth': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 32_843.21, lifetimeRoth: 180_171.15 },
  // A-B control variants for direct Plan Compare (fixed target, no annuity, static allocation, no HSA)
  'fixed-target-spending': { depletionYear: 2034, endingInvestable: 0, lifetimeTax: 7_215.17, lifetimeRoth: 0 },
  'no-annuity-brokerage': { depletionYear: null, endingInvestable: 3_684_430.57, lifetimeTax: 278_493.11, lifetimeRoth: 1_230_830.55 },
  'static-allocation-control': { depletionYear: null, endingInvestable: 839_732.49, lifetimeTax: 329_064.48, lifetimeRoth: 759_692.67 },
  'brokerage-no-hsa': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 24_137.83, lifetimeRoth: 0 },
  // A-B decision pairs (savings location for early retirement; Trump-account IRA head start).
  // The A-vs-B deltas are the story: the all-401(k) control pays $87.0k of
  // early-withdrawal penalties and loses ACA credits to withdrawal-driven
  // current-year MAGI, depleting before the identical-budget bridge version
  // (2067 against 2068); the seeded IRA still compounds into a ~$8.4M larger
  // estate on identical behavior.
  // Both figures restated 2026-08-03. The estate gap widened from ~$7.6M with
  // the indexing fix, which is the expected shape: the head-start plan carries a
  // larger balance for longer, so it gained more from removing the frozen
  // thresholds. The penalty figure was ALREADY stale before that fix -- it read
  // $64.7k against an actual $97.4k -- and indexing lowered it to $87.0k by
  // shrinking the withdrawals needed to fund the same budget. Neither figure is
  // asserted; they are narration, and they now match the run.
  'all-401k-no-bridge': { depletionYear: 2067, endingInvestable: 0, lifetimeTax: 950_722.5, lifetimeRoth: 0 },
  'brokerage-bridge-401k': { depletionYear: 2068, endingInvestable: 0, lifetimeTax: 876_459.16, lifetimeRoth: 0 },
  'no-head-start-grad': { depletionYear: null, endingInvestable: 17_943_027.61, lifetimeTax: 3_342_541.68, lifetimeRoth: 0 },
  'trump-account-head-start': { depletionYear: null, endingInvestable: 26_312_459.52, lifetimeTax: 4_849_292.59, lifetimeRoth: 0 },
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
