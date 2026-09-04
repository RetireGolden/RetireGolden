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
  // Restated 2026-08-04 after rebasing onto the merged 151(d)(5)(C)
  // senior-deduction correction (#169). That fix re-baselined bracket-fill-roth
  // on its own; the figures below are the combined effect of both changes, not
  // of this one alone. Against the post-#169 baseline this branch moves only
  // that example further: ending investable 603,886.68 to 607,663.76, lifetime
  // tax 222,821.59 to 220,841.91, conversions 809,898.99 to 815,673.60. The tax
  // now falls rather than rising, because a wider indexed 22 percent bracket
  // more than offsets the deduction the senior correction takes away.
  // A paragraph that stood here claimed the opposite signs for bracket-fill-roth
  // -- tax rising, conversions falling. It was left behind by a rebase, described
  // a baseline that no longer exists, and contradicted both the paragraph above
  // and the values pinned below. Deleted rather than restated: nothing pins its
  // superseded per-year figures, so there is nothing to re-derive them from.
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
  // Re-baselined 2026-08-04 for the 408(d)(8) pre-RMD QCD window. bracket-fill-roth
  // is the only example with a QCD that also has pre-RMD years -- annuity-estate
  // has one too but holds RMDs throughout its eligible span. Its 10,000 a year
  // now leaves the IRA in the years between 70 1/2 and the applicable age, where
  // the old rmdTotal > 0 gate gave zero. Ending investable falls 21,244.52 and
  // conversions fall 9,645.01 because the dollars are gone to charity rather than
  // retained or converted; lifetime tax falls 1,638.17 because the gift never
  // enters income. Lower ending wealth is the correct outcome of giving more away.
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
  // Re-baselined 2026-08-04 for the IRC 408(d)(3)(A)(i) owner boundary. The
  // aggregate conversion strategy used to pick one destination -- the first
  // Roth in Plan order, no owner predicate -- and drain every convertible
  // traditional account into it. It now slices the sized amount by each owner's
  // gross convertible balance, snapshotted after the RMD block, and converts
  // each slice into that owner's own Roth; an owner with no Roth of their own
  // converts nothing, and the run says so by name. Exactly two examples have
  // that shape and exactly two move.
  //
  // example-couple: Alex holds an 820k 401(k) and the household's only Roth,
  // Sam a 310k IRA and no Roth. Only Alex's slice converts, so lifetime
  // conversions fall 450,105.66 to 1,014,366.37 -- Alex's share of the
  // convertible pool, drifting above the opening 72.6% as the 401(k) grows.
  // Lifetime tax falls 19,858.85, and that net figure hides the shape that
  // matters: conversion tax drops 166,185 across 2028-2033 and only 146,326
  // comes back, as tax on the balances that were never converted, spread over
  // 2034-2041. The early saving compounds for another two decades to 2059,
  // which is why ending investable rises 451,989.99 -- the year-by-year tax
  // delta compounded at the portfolio's realized rate, near 6.7% rather than
  // the 5.5% default because these accounts follow a glidepath.
  'example-couple': { depletionYear: null, endingInvestable: 2_724_918.11, lifetimeTax: 431_348.91, lifetimeRoth: 1_014_366.37 },
  'under-saved-single': { depletionYear: 2046, endingInvestable: 0, lifetimeTax: 183_713.99, lifetimeRoth: 0 },
  // bracket-fill-roth: Morgan holds a 700k IRA and the only Roth, Riley a 400k
  // IRA and none. 2026 is the arithmetic in the open: the same 183,448.24
  // target, Morgan's post-RMD balance 673,584.91 against Riley's untouched
  // 400,000, gives Morgan 62.742% of it -- 115,098.46, which is what the engine
  // converts. Lifetime conversions fall 333,495.17 to 472,533.42 and lifetime
  // tax falls 55,350.41.
  //
  // Ending investable rises only 37,334.55, far less than that tax saving
  // compounds to, and the difference is charity rather than a puzzle. This is
  // the one example with an annual QCD. The old run converted Morgan's IRA away
  // entirely by 2030 and had no IRA left to give from; Riley's now survives the
  // horizon, so the 10,000 a year keeps going out. Total QCDs rise 112,626.24,
  // from 52,563.29 to 165,189.53. Compounded tax saving less compounded extra
  // giving is the small positive left over -- lower ending wealth from giving
  // more away is the correct outcome, the same reading the 408(d)(8) pre-RMD
  // window note above records.
  'bracket-fill-roth': { depletionYear: null, endingInvestable: 623_753.79, lifetimeTax: 163_853.34, lifetimeRoth: 472_533.42 },
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
  // Re-baselined 2026-08-04 for IRC 63(c)(7)(B)(ii) conformity. Colorado does
  // not publish a standard deduction: it taxes federal taxable income, so the
  // pack's $16,100 IS the federal figure, carried here to convert the engine's
  // gross base. The federal original has been projected past the pack year
  // since the 1(j)(3)(B) indexing fix while this copy stayed frozen, so the
  // engine held two values for one amount and taxed the whole growing gap at
  // 4.4%. coast-fire is the only example resident in any of the nine conforming
  // states, and it is the only one that moves. Lifetime tax FALLS $66,035.44
  // (1,782,760.83 -> 1,716,725.39) and ending investable RISES $190,823.74
  // (7,891,262.40 -> 8,082,086.14), which are the two directions a larger
  // deduction can produce. The rise exceeds the tax fall because each year's
  // unpaid tax stays invested for the rest of the horizon.
  //
  // Re-baselined again 2026-08-04 for the SECOND half of that same conformity:
  // the federal standard deduction of IRC 63(c)(1) is the basic amount PLUS the
  // additional amount for age 65 or older, and the copy carried only the basic
  // one. Same example, same reason it is the only one that moves.
  //
  // The state-tax effect is exact and hand-checkable, because Colorado is flat:
  // in every year the household is 65 or over, Colorado tax falls by
  //   2,050 (the 2026 single age-65 addition) x inflationScale x 4.4%.
  // Morgan turns 65 in 2061 (born 1996) and the plan runs to 2086, so it is 26
  // years, from $214.06 in 2061 (scale 2.3732051860662366) to $396.86 in 2086
  // (scale 4.399789748815026), summing to about $7,709 of nominal Colorado tax.
  // 2059 and 2060 are unchanged to the penny: at 63 and 64 there is no addition.
  //
  // Lifetime tax FALLS $9,221.03 (1,716,725.39 -> 1,707,504.36) -- the ~$7,709
  // of Colorado tax plus ~$1,512 of federal, because a household that owes less
  // state tax withdraws less from the traditional IRA to pay it, and the
  // withdrawal it no longer takes is not federally taxed either. That induced
  // share is a constant 19.6% of the state saving in all 26 years, which is what
  // a fixed marginal rate on the funding withdrawal looks like.
  //
  // Ending investable RISES $25,629.07 (8,082,086.14 -> 8,107,715.21): $9,221 of
  // tax not paid, left in accounts returning 6-7.5% for the balance of a horizon
  // that runs 25 more years past the first of those savings.
  'coast-fire': { depletionYear: null, endingInvestable: 8_107_715.21, lifetimeTax: 1_707_504.36, lifetimeRoth: 0 },
  'barista-fire': { depletionYear: null, endingInvestable: 14_569_925.04, lifetimeTax: 2_091_401.98, lifetimeRoth: 0 },
  // bridge-early-retirement re-baselined 2026-08-04 for the Notice 2022-6
  // section 3.02(a) correction. It is the one example carrying a 72(t) SEPP
  // election, and its payment was sized from the engine's SSA period table
  // rather than from one of the three tables the notice permits. At the
  // election age of 45 the permitted Single Life divisor is 41.0 years against
  // the SSA average of 35.285. Amortizing the same $1.2M IRA at 5% over the
  // longer divisor drops the level payment from 73,062.64 to 69,386.75 a year,
  // and the series runs 15 years (ages 45 through 59, 2026-2040), so about
  // 55,138 less is forced out of the IRA during the bridge window. Nothing else
  // in this example moves: it pays no early-withdrawal penalty in either
  // baseline, because the SEPP alone covers the spend.
  //
  // Both directions follow from that and they are not in tension. Ending
  // investable RISES 115,437.76: dollars not forced out early stay in a
  // tax-deferred account and compound there for the rest of a 55-year horizon.
  // Lifetime tax RISES 24,678.80 for the same reason, one step later: the
  // income was deferred rather than avoided, so it is taxed on the way out of a
  // larger balance instead of at ages 45-59. A smaller forced distribution
  // buying more estate and more nominal lifetime tax is the expected shape for
  // a household this far from depletion.
  'bridge-early-retirement': { depletionYear: null, endingInvestable: 11_972_870.71, lifetimeTax: 1_452_039, lifetimeRoth: 0 },
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
  'inherited-ira-beneficiary': { depletionYear: 2032, endingInvestable: 0, lifetimeTax: 49_647.74, lifetimeRoth: 0 },
}

describe('example plan golden KPIs', () => {
  for (const example of EXAMPLE_PLANS) {
    it(`${example.title} pins headline results`, () => {
      const plan = example.build()
      const result = simulatePlan(plan, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(plan) })
      const summary = summarizeProjection(plan, result)
      const expected = EXPECTED[example.id]
      expect(expected, `missing golden fixture for ${example.id}`).toBeDefined()

      expect(summary.depletionYear).toBe(expected.depletionYear)
      expect(round2(summary.endingInvestable)).toBe(expected.endingInvestable)
      expect(round2(summary.lifetimeTaxesAndPenalties)).toBe(expected.lifetimeTax)
      expect(round2(summary.lifetimeRothConversions)).toBe(expected.lifetimeRoth)
    })
  }
})
