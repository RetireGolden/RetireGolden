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
  // Re-baselined 2026-09-29 (the Medicare IRMAA amounts come from CMS's published
  // table): each tier's Part B premium is CMS's published total (284.10, 405.80,
  // 527.50, 649.20 and 689.90 a month for 2026) instead of the standard premium
  // times the applicable percentage over 25 (284.06, 405.80, 527.54, 649.28 and
  // 689.86). Sixteen examples have an IRMAA year at a tier that differs and move
  // by cents a month a person there, compounded: the ending investable falls
  // where tier 1 or 5 binds (example-couple -12.77, rmd-irmaa -26.65,
  // salary-growth-escalation -85.55) and rises where tier 3 or 4 does
  // (aggressive-saver +470.78, trump-account-head-start +162.65); lifetime tax
  // and conversions move by cents to a few dollars through the funding and
  // bracket-fill feedback. No depletion year moves. The before and after of
  // every year row are in the change's measurement, not repeated here.
  // Re-baselined 2026-09-12 (NEW BASELINE — example-couple and coast-fire only).
  // KY MFJ now carries one joint standard deduction ($3,360, not $6,720); rich
  // state facts count actual conversion/withdrawal sources under per-owner
  // $31,110 retirement caps with no unused-spouse transfer. CO adds high-AGI
  // federal-deduction addback, age 55-64 IRA subtraction, and 65+ taxable-SS
  // consumption of the pension cap; withdrawal and federal-tax funding feedback
  // compound the horizon. Legal authority: stateRichAnnual.rules.test.ts and
  // exampleCoupleStateOwnerCaps.test.ts. Observed long-horizon characterization
  // snapshots only — not new law or future parameter certification.
  //
  // Reviewed 2026-09-08: CA TY2026 standard deduction corrected 5,540 -> 5,706
  // (ca-ftb-2026-540-es-standard-deduction; DOCS/operations/ca-mn-parameter-
  // correction-2026-09-08.md). Five single-filer CA examples move: lower lifetime
  // tax, higher ending wealth; glidepath/static also show fill-to-target Roth
  // feedback. Characterization only -- not a legal oracle.
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
  // NEW BASELINE 2026-09-12: pins above superseded; see header note for KY/CO
  // drivers and stateRichAnnual.rules / exampleCoupleStateOwnerCaps authority.
  'example-couple': { depletionYear: null, endingInvestable: 2_729_440.23, lifetimeTax: 433_211.72, lifetimeRoth: 1_017_093.22 },
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
  //
  // Re-baselined 2026-09-27 (decision D-BRACKET-FILL-ROTH-EXAMPLE): Riley now
  // holds her own Roth IRA, so the paragraphs above describe a household the
  // example no longer has. Both owners' shares convert, and each year fills the
  // 22% bracket the example is named for: in 2026 the whole 183,448.24 converts
  // (Morgan 115,098.46, Riley 68,349.78), and joint taxable income ends at
  // 211,399.99, a cent under the 211,400 top. The IRAs are emptied by 2030
  // (that year's conversion is cut to the 29,390.16 left, and the ledger says
  // so), so the RMDs and the QCDs out of them stop after 2030: lifetime QCDs
  // fall back to 52,563.29 from 165,189.53. Tax moves forward into the
  // conversion years, with Medicare's income surcharge at tier 1 in 2028 and
  // tier 2 in 2029 to 2031 on the MAGI of two years before: lifetime tax
  // 163,853.34 -> 218,889.90, lifetime conversions 472,533.42 -> 808,047.79,
  // ending investable 623,753.79 -> 587,705.63. That is close to where the
  // example stood before the 2026-08-04 owner boundary (conversions 806,028.59,
  // tax 219,203.75, ending 586,419.24, QCDs 52,563.29), when the engine
  // converted both IRAs into Morgan's Roth; now each share lands in its owner's.
  'bracket-fill-roth': { depletionYear: null, endingInvestable: 587_702.26, lifetimeTax: 218_889.95, lifetimeRoth: 808_046.21 },
  // early-retiree-aca retuned 2026-07-30: the old baseline (55k consulting,
  // fill to the 12% bracket) had its only actionable ACA year above 400% FPL,
  // so the example could not show a credit at all. It now converts to the 10%
  // bracket on smaller consulting income, holding the current year below the
  // cliff with a positive credit that a one-bracket raise visibly forfeits.
  // Re-baselined 2026-09-26 (decision D-ACA-2027-TABLE): 2027 is priced on
  // Rev. Proc. 2026-26 and the HHS 2026 guidelines. MAGI 29,212.49 is 183.04% of
  // the 15,960 poverty line, so the credit is 10,925.20 of the 12,660 premium
  // (the walkthrough's 2027 table derives it by hand). The 2027 cash draw falls
  // by that credit, and the larger balances compound: ending investable
  // 539,207.42 -> 579,399.32, and lifetime tax 105,501.55 -> 107,861.71 on the
  // larger later withdrawals. The conversions are sized on taxable income, which
  // the credit does not reach, so lifetime conversions are unchanged.
  // Re-baselined again the same day for the IRS rounding (the table read at the
  // whole-number poverty-line percentage, the rate rounded to 0.01%): the 2026
  // credit goes 10,364.77 -> 10,366.95 (read at 182: 5.73%) and the 2027 one
  // 10,925.20 -> 10,924.78 (read at 183: 5.94%); ending investable
  // 579,399.32 -> 579,405.87, lifetime tax 107,861.71 -> 107,862.17.
  'early-retiree-aca': { depletionYear: null, endingInvestable: 579_405.87, lifetimeTax: 107_862.17, lifetimeRoth: 59_661.87 },
  'rmd-irmaa': { depletionYear: null, endingInvestable: 1_546_168.63, lifetimeTax: 512_839.75, lifetimeRoth: 0 },
  'survivor-years': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 79_020.67, lifetimeRoth: 0 },
  'moving-state-tax': { depletionYear: null, endingInvestable: 3_880_516.31, lifetimeTax: 732_565.75, lifetimeRoth: 0 },
  'ltc-shock': { depletionYear: 2033, endingInvestable: 0, lifetimeTax: 0, lifetimeRoth: 0 },
  // Restated 2026-09-28 (D-2027-PUBLISHED-FIGURES, the survey of every state):
  // California's 10.3%, 11.3% and 12.3% bands end from 2031 (Cal. Const. art.
  // XIII, sec. 36(f)(2)). This California household reaches them only in its
  // 2060 Roth conversion year and from 2085, so 2060's tax falls 200.64 and
  // 2085 to 2091 fall 127.87 to 2,278.21 a year: ending investable
  // 17,028,288.16 -> 17,036,796.98, lifetime tax 2,806,009.29 -> 2,798,420.94.
  'early-career-match': { depletionYear: null, endingInvestable: 17_036_771.42, lifetimeTax: 2_798_420.94, lifetimeRoth: 0 },
  // Reviewed 2026-09-28 (D-2027-PUBLISHED-FIGURES, the survey of every state):
  // Washington taxes income above a 1,000,000 deduction at 9.9% from 2028
  // (ESSB 6346, chapter 238, Laws of 2026; Initiative 645 on the November 3,
  // 2026 ballot would repeal it), and section 316 indexes the deduction every
  // second year from 2029. At this plan's 2.5% the deduction is 2,148,000 for
  // 2089 and 2090 and 2,202,000 for 2091, and the household's Washington base
  // income peaks at 2,023,808 in 2091, so it never owes the tax and nothing
  // here moves.
  'aggressive-saver': { depletionYear: null, endingInvestable: 138_916_712.73, lifetimeTax: 6_849_942.2, lifetimeRoth: 0 },
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
  // NEW BASELINE 2026-09-12: pins above superseded; see header note for CO
  // high-income addback, age 55-64 IRA subtraction, and 65+ SS cap paths.
  'coast-fire': { depletionYear: null, endingInvestable: 8_332_919.94, lifetimeTax: 1_634_909.14, lifetimeRoth: 0 },
  // Reviewed 2026-09-09: Oregon TY2026 LRO Report #1-26 standard deduction $2,835 -> $2,910
  // and indexed breakpoints single $4,050/$10,200 -> $4,550/$11,400 (`or-lro-2026-rate-
  // schedule-and-standard-deduction`). barista-fire is the only curated OR example.
  // Observed characterization only — engine record/fixtures supply the legal oracle.
  'barista-fire': { depletionYear: null, endingInvestable: 14_616_478.79, lifetimeTax: 2_094_166.96, lifetimeRoth: 0 },
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
  //
  // Restated 2026-09-28 (D-2027-PUBLISHED-FIGURES): California's top three
  // bands end from 2031, and this household reaches them only in 2070 and 2071,
  // whose tax falls 178.38 and 370.23: ending investable 11,977,572.35 ->
  // 11,978,172.73, lifetime tax 1,451,864.02 -> 1,451,315.41.
  'bridge-early-retirement': { depletionYear: null, endingInvestable: 11_978_137.11, lifetimeTax: 1_451_315.41, lifetimeRoth: 0 },
  'lean-fat-fire': { depletionYear: null, endingInvestable: 43_545_988.96, lifetimeTax: 2_692_779.67, lifetimeRoth: 0 },
  // Restated 2026-09-28 (D-2027-PUBLISHED-FIGURES): the 2027 HSA limit is the
  // published 4,500 (Rev. Proc. 2026-24), not 4,400 grown to 4,510, and later
  // years grow from it. The capped HSA takes 10 less in 2027 and a little less
  // every later working year: ending investable falls 240.41, lifetime tax and
  // penalties rise 186.04.
  'hsa-stealth-retirement': { depletionYear: null, endingInvestable: 4_493_410.11, lifetimeTax: 808_136.54, lifetimeRoth: 0 },
  'salary-growth-escalation': { depletionYear: null, endingInvestable: 46_295_184.2, lifetimeTax: 2_552_250.15, lifetimeRoth: 0 },
  // New July enhancement examples (positive/negative cases for guardrails, annuities+estate, allocation+MC v2, HSA/property depth)
  'guardrails-flex-goals': { depletionYear: 2041, endingInvestable: 0, lifetimeTax: 7_903.47, lifetimeRoth: 0 },
  'annuity-purchases-estate': { depletionYear: null, endingInvestable: 3_254_271.75, lifetimeTax: 342_232.06, lifetimeRoth: 857_968.22 },
  // Re-baselined 2026-09-26 for the IRS rounding of the ACA applicable
  // percentage (decision D-ACA-2027-TABLE): the 2026 credit, at 180.5% of the
  // 15,650 poverty line, is read at 180 and rounded to 5.64% (unrounded
  // 5.66%), so it rises 8,121.13 -> 8,126.97 and the smaller need draws a
  // little less taxable income: ending investable 1,272,656.33 ->
  // 1,272,697.21, lifetime tax 347,018.53 -> 347,014.81, lifetime conversions
  // 765,919.48 -> 765,933.31.
  'glidepath-allocation': { depletionYear: null, endingInvestable: 1_272_713.1, lifetimeTax: 347_013.89, lifetimeRoth: 765_935.72 },
  // Re-baselined for exact committed Form 8606 line-8 character: generated
  // conversions now size gross dollars against their taxable fraction.
  // Re-baselined 2026-09-26 (decision D-ACA-2027-TABLE): 2027 is priced, a
  // 3,283.50 credit at 336.78% of the 15,960 poverty line (10.22% flat band).
  // The credit cuts the 2027 draw on the traditional IRA from 76,997.66 to
  // 73,369.98, so the IRA left for the 2029 conversion, which empties it, is
  // 184,163.05 rather than 180,171.15: lifetime conversions rise by 3,991.90.
  // Tax falls 344.18 in 2027 and 975.16 in 2032 and rises 775.77 in 2029, so
  // lifetime tax goes 32,843.21 -> 32,299.64; the plan still depletes in 2043.
  'hsa-property-depth': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 32_299.65, lifetimeRoth: 184_163.05 },
  // A-B control variants for direct Plan Compare (fixed target, no annuity, static allocation, no HSA)
  'fixed-target-spending': { depletionYear: 2034, endingInvestable: 0, lifetimeTax: 7_215.17, lifetimeRoth: 0 },
  'no-annuity-brokerage': { depletionYear: null, endingInvestable: 3_684_449.12, lifetimeTax: 278_493.11, lifetimeRoth: 1_230_830.55 },
  'static-allocation-control': { depletionYear: null, endingInvestable: 840_109.18, lifetimeTax: 328_960.07, lifetimeRoth: 759_853.75 },
  'brokerage-no-hsa': { depletionYear: 2043, endingInvestable: 0, lifetimeTax: 24_137.83, lifetimeRoth: 0 },
  // A-B decision pairs (savings location for early retirement; Trump-account IRA head start).
  // The A-vs-B deltas are the story: the all-401(k) control pays $83.3k of
  // early-withdrawal penalties, depleting before the identical-budget bridge
  // version (2068 against 2069); the seeded IRA still compounds into a ~$8.4M
  // larger estate on identical behavior. Neither bridge plan prices an ACA
  // credit in any year (restated 2026-09-27): the bridge years, 2038 on, come
  // after the last coverage year with published ACA figures, and the priced
  // years 2026 and 2027 are working years above the cliff, so the old
  // "loses ACA credits" reading was false; the premiums are identical.
  // Both figures restated 2026-08-03. The estate gap widened from ~$7.6M with
  // the indexing fix, which is the expected shape: the head-start plan carries a
  // larger balance for longer, so it gained more from removing the frozen
  // thresholds. The penalty figure was ALREADY stale before that fix -- it read
  // $64.7k against an actual $97.4k -- and indexing lowered it to $87.0k by
  // shrinking the withdrawals needed to fund the same budget. Neither figure is
  // asserted; they are narration, and they now match the run.
  // Restated 2026-09-28 (D-2027-PUBLISHED-FIGURES): North Carolina's rates are
  // the ones S.L. 2026-41 enacts, 3.49% for 2027-2029, 3.24% for 2030-2032 and
  // 2.99% after 2032, not 3.99% held forward. Both plans pay less state tax from
  // 2027, and each lasts one year longer: the control to 2068 (was 2067), the
  // bridge to 2069 (was 2068). Lifetime tax and penalties: control 950,722.50 ->
  // 934,906.80 (penalties 87,045 -> 83,312), bridge 876,459.16 -> 865,395.15.
  'all-401k-no-bridge': { depletionYear: 2068, endingInvestable: 0, lifetimeTax: 934_906.8, lifetimeRoth: 0 },
  'brokerage-bridge-401k': { depletionYear: 2069, endingInvestable: 0, lifetimeTax: 865_395.15, lifetimeRoth: 0 },
  // Reviewed 2026-09-05: MI ordinary qualifying retirement cap $49,423 -> $67,610
  // under MCL 206.30(10)(d), RAB 2026-1 / Guide 446. Both long-horizon A-B examples
  // move identically: lifetime tax falls $13,913.05, ending investable rises $18,641.07.
  // Pack used as future nominal stand-in, not future statutory certification. Engine
  // record/atomic/full-plan fixtures supply the legal oracle; these numbers only
  // characterize the observed long-horizon result -- not a new oracle.
  'no-head-start-grad': { depletionYear: null, endingInvestable: 17_961_593.53, lifetimeTax: 3_328_628.63, lifetimeRoth: 0 },
  'trump-account-head-start': { depletionYear: null, endingInvestable: 26_331_263.24, lifetimeTax: 4_835_379.54, lifetimeRoth: 0 },
  'inherited-ira-beneficiary': { depletionYear: 2032, endingInvestable: 0, lifetimeTax: 49_647.74, lifetimeRoth: 0 },
}

describe('example plan golden KPIs', () => {
  for (const example of EXAMPLE_PLANS) {
    it(`${example.title} pins headline results`, () => {
      const plan = example.build()
      const result = simulatePlan(plan, { startYear: EXAMPLE_FIXED_YEAR, taxCalculator: taxCalculatorFor(plan) })
      const summary = summarizeProjection(plan, result, { conversionFreeRun: null })
      const expected = EXPECTED[example.id]
      expect(expected, `missing golden fixture for ${example.id}`).toBeDefined()

      expect(summary.depletionYear).toBe(expected!.depletionYear)
      expect(round2(summary.endingInvestable)).toBe(expected!.endingInvestable)
      expect(round2(summary.lifetimeTaxesAndPenalties)).toBe(expected!.lifetimeTax)
      expect(round2(summary.lifetimeRothConversions)).toBe(expected!.lifetimeRoth)
    })
  }
})
