/**
 * Federal income tax (planning-grade). This is the real calculator callers
 * inject; the flat-rate double at `testing/flatTax.ts` is a test fixture, not a
 * predecessor still awaiting replacement.
 *
 * Computation order per year:
 *   1. Taxable Social Security via provisional income (unindexed thresholds)
 *   2. AGI = ordinary + capital gains + taxable SS. Tax-exempt interest and
 *      income excluded under the §911/§931/§933 foreign and possessions
 *      exclusions affect §86 provisional income without becoming ordinary
 *      income or entering AGI directly. MAGI restores those exclusions
 *      (§1411(d), §151(d)(5)(C)(iii)(II)).
 *   3. Deductions: the greater of the standard deduction (with age-65
 *      additions) or itemized SALT (capped) + mortgage interest + charitable,
 *      plus the OBBBA senior deduction on top of whichever base wins
 *      (2025–2028, per-person 6%-of-MAGI phase-out)
 *   4. Ordinary brackets on non-preferential taxable income
 *   5. LTCG/qualified-dividend stacking at 0/15/20% on top of ordinary
 *   6. NIIT 3.8% on investment income over the (unindexed) MAGI threshold
 *   7. Planning-grade AMT screen: modeled add-backs/preference items (the §63(c)
 *      standard deduction or itemized SALT, plus the §151 senior deduction on
 *      either branch per §56(b)(1)(D)), AMT exemption/phaseout, and
 *      preferential-rate-aware tentative minimum tax.
 *
 * Figures are read from the year's parameter pack, with the exact 2026 §170
 * floor and §68 threshold/rate facts supplied by their authoritative carrier.
 * For a year no pack has been published, the caller supplies `inflationScale`
 * and the annually indexed figures -- rate brackets, standard deduction and
 * age-65 addition, capital-gain breakpoints, AMT exemption/phase-out/28%
 * threshold -- are carried forward with it (`indexFederalTaxPack`). The
 * unindexed ones are not:
 * the section 86 provisional-income tiers and the section 1411 NIIT thresholds
 * stay put by design, which is why more of a benefit becomes taxable and more
 * income meets NIIT as a plan runs on.
 *
 * Out of scope here (see DOCS/features/taxes.md): credits, full Form 6251
 * adjustments, the rest of Schedule A and the OBBBA high-income SALT
 * phase-out, early-withdrawal penalties (projection-level), IRMAA
 * (expense-side), state.
 *
 * @see DOCS/domain/domain-rules-reference.md §§1–3
 */

import { indexFederalTaxPack, packForYear, standardDeduction } from '../params/index.js'
import type { FilingStatus, ParameterPack, TaxBracket } from '../params/types.js'
import { taxParameterFilingStatus, type TaxCalculator, type TaxYearInput } from '../projection/types.js'
import {
  annualCharitableDeductionParameters,
  type AnnualCharitableDeductionParameters2026,
} from './annualCharitableDeductionParameters.js'

export interface FederalTaxDetail {
  year: number
  /** True when this year's figures use a stand-in parameter pack. */
  usesStandInPack: boolean
  taxableSocialSecurity: number
  /** Signed AGI before the return-level zero floor; used by ACA household MAGI assembly. */
  agiBeforeFloor: number
  agi: number
  magi: number
  deduction: number
  seniorDeduction: number
  /** True when the itemized total beat the standard deduction this year. */
  itemized: boolean
  /**
   * IRC §68 reduction applied to the itemized *candidate* this year; 0 when it
   * does not bite or the year predates it. Surfaced because `itemized` alone
   * cannot explain a deduction that shrank — without this the ledger shows a
   * smaller number and no reason for it.
   *
   * It is computed before the election, so it is not necessarily a reduction in
   * the deduction actually taken: a nonzero value alongside `itemized: false`
   * means §68 bit the itemized candidate and the standard deduction still won.
   * Only when `itemized` is true did this figure come out of `deduction`.
   */
  section68Limitation: number
  taxableIncome: number
  /** Taxable income taxed at ordinary rates (after preferential carve-out). */
  ordinaryTaxable: number
  /** LTCG + qualified dividends taxed via stacking. */
  preferentialIncome: number
  ordinaryTax: number
  capitalGainsTax: number
  /** AMT add-backs and preference items included in AMTI. */
  amtPreferenceItems: number
  alternativeMinimumTaxableIncome: number
  amtExemption: number
  tentativeMinimumTax: number
  alternativeMinimumTax: number
  niit: number
  totalTax: number
  /** Additional long-term gains realizable this year still taxed at 0% (gain-harvesting headroom). */
  zeroRateLtcgHeadroom: number
}

/**
 * IRC 164(b)(7) schedules the SALT cap explicitly rather than indexing it: it
 * is 40,000 dollars for 2025, 40,400 for 2026, then 101 percent of the prior
 * year through 2029, and it REVERTS to 10,000 dollars for 2030 and after.
 *
 * The reversion is the part that cannot be approximated. Holding the 2026
 * figure flat, or projecting it at general inflation like an indexed limit,
 * overstates the deduction roughly fourfold for every projected year from 2030
 * on -- which for a retiree in a high-tax state is most of the horizon.
 *
 * The near end of the schedule needs the same care. 164(b)(7)(A)(i) names
 * calendar year 2025 exactly, not "2025 and earlier", so the 40,000 figure must
 * not be carried backwards: for the pre-OBBBA years the applicable limitation
 * was 10,000, and 164(b)(6) reaches no further back than taxable years
 * beginning after 2017 -- before that the deduction was uncapped. Spreading
 * 40,000 across those years overstates the cap fourfold, the same error in the
 * same direction as holding 40,400 past 2029.
 */
export function saltCapForYear(pack: ParameterPack, year: number): number {
  if (year <= 2017) return Number.POSITIVE_INFINITY
  if (year <= 2024) return 10_000
  if (year === 2025) return 40_000
  if (year >= 2030) return 10_000
  const stepped = pack.federalTax.saltCap * Math.pow(1.01, Math.max(0, year - pack.year))
  return stepped
}

/**
 * Itemized-deduction total (SALT capped) from its components, or 0 when none.
 *
 * The cap comes from `saltCapForYear` rather than straight off the pack: for
 * most years the statutory schedule decides it outright, and the pack figure is
 * only the base the 2026-2029 steps compound from. The OBBBA high-income SALT
 * phase-out is not modeled.
 */
function itemizedTotal(
  pack: ParameterPack,
  items: TaxYearInput['itemizedDeductions'],
  year: number,
  contributionBase: number,
  parameters: Readonly<AnnualCharitableDeductionParameters2026> | null,
): number {
  if (!items) return 0
  const salt = Math.min(Math.max(0, items.stateAndLocalTaxes), saltCapForYear(pack, year))
  const charitable = charitableAfterFloor(
    Math.max(0, items.charitable),
    contributionBase,
    year,
    parameters,
  )
  return salt + Math.max(0, items.mortgageInterest) + charitable
}

/**
 * IRC §170(b)(1)(I) floor: a charitable contribution is allowed only to the
 * extent the aggregate exceeds 0.5 percent of the contribution base, which
 * §170(b)(1)(H) defines as adjusted gross income. Added by OBBBA for taxable
 * years beginning after 2025, hence the year gate.
 *
 * Two things this deliberately does not do.
 *
 * It does not apply the §170(b)(1)(I)(i)-(vi) category waterfall, which consumes
 * the floor against the (D) through (A) categories before it reaches (G) cash
 * gifts. `itemizedDeductions.charitable` is one undifferentiated figure, so
 * there are no categories to walk and the whole floor lands on the only line
 * there is. Registered separately rather than hidden here.
 *
 * It does not carry the disallowed amount forward. §170(d)(1)(C)(i) lets
 * floor-disallowed dollars survive only by enlarging an excess that some other
 * carryover rule is already carrying from the same year, so for a household
 * giving below the percentage ceiling — the ordinary retiree — the disallowance
 * is permanent and there is nothing to carry. The ceiling itself is not wired,
 * so no such excess can arise here.
 *
 * The carrier supplies 0.5 percent as an exact integer ratio. Spelling it
 * `0.005 * base` introduces a float intermediate into a figure that feeds an
 * equality comparison against the standard deduction.
 */
function charitableAfterFloor(
  charitable: number,
  contributionBase: number,
  year: number,
  parameters: Readonly<AnnualCharitableDeductionParameters2026> | null,
): number {
  if (year < 2026 || charitable <= 0) return charitable
  // Only 2026 has an authoritative carrier. Later projection years retain the
  // established stand-in computation without asking that carrier to stand in.
  const floor = parameters === null
    ? (Math.max(0, contributionBase) * 5) / 1_000
    : (Math.max(0, contributionBase)
      * Number(parameters.itemizerContributionFloorRate.numerator))
      / Number(parameters.itemizerContributionFloorRate.denominator)
  return Math.max(0, charitable - floor)
}

/**
 * IRC §68 overall limitation on itemized deductions.
 *
 * The base does not depend on the itemized total, and that is the statute's
 * doing rather than a simplification. §68(a)(2) reaches taxable income
 * "(determined without regard to this section and increased by such amount of
 * itemized deductions)". The first parenthetical strips §68's own output from
 * its input; the second adds the itemized deductions back, so they cancel and
 * the base collapses to AGI less the deductions that are not itemized. No fixed
 * point is required here, and none should be introduced — the caller's tax
 * solvers rely on this being a closed form.
 *
 * `qualifiedBusinessIncomeDeduction` is absent from the subtraction because
 * §199A is not modelled anywhere in this engine. That is a genuine zero rather
 * than an omission: there is no QBI figure to subtract.
 *
 * Suspended by TCJA for 2018 through 2025 and replaced — not revived — by
 * OBBBA for 2026 onward, so the year gate is a real statutory boundary. The
 * pre-2018 Pease rule was a different computation (3 percent of excess AGI,
 * capped at 80 percent of deductions, with exempt categories) and is out of
 * scope; a year before 2026 gets no reduction rather than the wrong one.
 */
function section68Reduction(
  pack: ParameterPack,
  filingStatus: TaxYearInput['filingStatus'],
  taxStatus: FilingStatus,
  itemizedBeforeLimitation: number,
  agi: number,
  seniorDeduction: number,
  year: number,
  parameters: Readonly<AnnualCharitableDeductionParameters2026> | null,
): number {
  if (year < 2026 || itemizedBeforeLimitation <= 0) return 0
  let threshold: number
  let numerator: number
  let denominator: number
  if (parameters !== null) {
    threshold = parameters.section68ThresholdByFilingStatusCents[filingStatus] / 100
    numerator = Number(parameters.section68LimitationRate.numerator)
    denominator = Number(parameters.section68LimitationRate.denominator)
  } else {
    const brackets = pack.federalTax.brackets[taxStatus]
    // §68(a)(2) names "the dollar amount at which the 37 percent rate bracket
    // under section 1 begins", so the bracket is found by its rate rather than
    // by being last. If a future stand-in pack ever tops out below 37 percent,
    // its top bracket remains the established honest stand-in.
    const thirtySeven = brackets.find((bracket) => bracket.ratePct === 37)
      ?? brackets[brackets.length - 1]
    if (thirtySeven === undefined) return 0
    threshold = thirtySeven.lowerBound
    numerator = 2
    denominator = 37
  }
  const base = Math.max(0, agi - seniorDeduction - threshold)
  // Multiply by the selected exact-ratio numerator before dividing by its
  // denominator. Evaluating the ratio first can leave a floating intermediate
  // that only rounds back to the right answer by luck. Left unrounded, like
  // every other figure on this path; the exact-cent ledger rounds half-up at
  // the cent and the two agree to within half a cent.
  return (numerator * Math.min(itemizedBeforeLimitation, base)) / denominator
}

/**
 * Room left in the 0% long-term-capital-gains bracket this year: additional
 * preferential income that could be realized and still be taxed at 0%. Gains
 * stack on top of ordinary taxable income, so the 0% layer runs up to the 15%
 * threshold.
 *
 * For retirees on Social Security this is NOT simply `threshold − taxableIncome`:
 * realizing gains raises provisional income, which can make more of the benefit
 * taxable, so taxable income climbs faster than $1 per gain dollar. We solve for
 * the largest additional gain that keeps taxable income at the threshold,
 * modeling that SS phase-in (the dominant interaction). The deduction is held
 * fixed — the second-order senior-deduction MAGI phase-out is not modeled.
 * @see DOCS/domain/domain-rules-reference.md §2
 */
export function zeroRateLtcgHeadroom(
  pack: ParameterPack,
  filingStatus: FilingStatus,
  ordinaryExcludingSs: number,
  currentGains: number,
  currentQualifiedDividends: number,
  ssBenefits: number,
  deduction: number,
  taxExemptInterest = 0,
  foreignExclusionAddback = 0,
): number {
  const threshold = pack.capitalGains.rate15StartsAbove[filingStatus]
  const taxableIncomeAt = (extraGains: number): number => {
    const agiExcludingSs = ordinaryExcludingSs + currentGains + currentQualifiedDividends + extraGains
    const taxableSs = taxableSocialSecurity(
      pack,
      filingStatus,
      agiExcludingSs,
      ssBenefits,
      taxExemptInterest,
      foreignExclusionAddback,
    )
    return Math.max(0, agiExcludingSs + taxableSs - deduction)
  }
  if (taxableIncomeAt(0) >= threshold) return 0
  // Monotonic increasing in extraGains (slope 1–1.85); binary-search the largest
  // gain that keeps taxable income at the threshold. `threshold` brackets the
  // root since the slope is ≥ 1 and taxableIncomeAt(0) ≥ 0.
  let lo = 0
  let hi = threshold
  for (let i = 0; i < 60 && hi - lo > 0.01; i++) {
    const mid = (lo + hi) / 2
    if (taxableIncomeAt(mid) <= threshold) lo = mid
    else hi = mid
  }
  return lo
}

function bracketTax(brackets: TaxBracket[], taxable: number): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const lower = brackets[i]!.lowerBound
    const upper = i + 1 < brackets.length ? brackets[i + 1]!.lowerBound : Infinity
    if (taxable <= lower) break
    tax += (Math.min(taxable, upper) - lower) * (brackets[i]!.ratePct / 100)
  }
  return tax
}

/**
 * Taxable share of Social Security benefits (IRC §86).
 * Provisional income = AGI excluding SS + tax-exempt interest + excluded
 * foreign earned income + 50% of benefits.
 */
export function taxableSocialSecurity(
  pack: ParameterPack,
  filingStatus: FilingStatus,
  agiExcludingSs: number,
  ssBenefits: number,
  taxExemptInterest = 0,
  foreignExclusionAddback = 0,
): number {
  if (ssBenefits <= 0) return 0
  const t50 = pack.ssBenefitTaxation.tier50Start[filingStatus]
  const t85 = pack.ssBenefitTaxation.tier85Start[filingStatus]
  const provisional =
    agiExcludingSs +
    Math.max(0, taxExemptInterest) +
    Math.max(0, foreignExclusionAddback) +
    0.5 * ssBenefits

  if (provisional <= t50) return 0
  if (provisional <= t85) return Math.min(0.5 * ssBenefits, 0.5 * (provisional - t50))
  const tier1 = Math.min(0.5 * ssBenefits, 0.5 * (t85 - t50))
  return Math.min(0.85 * ssBenefits, 0.85 * (provisional - t85) + tier1)
}

/** OBBBA senior deduction (IRC §151(d)(5)(C)), expiring after `lastApplicableYear`. */
function seniorDeductionAmount(
  pack: ParameterPack,
  year: number,
  filingStatus: FilingStatus,
  peopleAged65Plus: number,
  magi: number,
): number {
  const rule = pack.federalTax.seniorDeduction
  if (!rule || peopleAged65Plus <= 0 || year > rule.lastApplicableYear) return 0
  // §151(d)(5)(C)(i) allows the $6,000 "for each qualified individual", and
  // (iii)(I) reduces "the $6,000 amount in clause (i)" by 6% of modified AGI
  // over the threshold. What the phase-out consumes is therefore the
  // per-individual amount, so the reduction is taken once for each qualified
  // individual and not once against the return's combined total. Schedule 1-A
  // Part V works the same way: line 35 computes the reduced amount once, lines
  // 36a and 36b each enter that reduced amount, and line 37 adds them. A joint
  // return with two spouses 65+ consequently runs out at $250,000 of modified
  // AGI, the same point one qualified individual runs out.
  const phaseOut = Math.max(0, magi - rule.magiPhaseOutStart[filingStatus]) * (rule.phaseOutRatePct / 100)
  return Math.max(0, rule.amountPerPerson - phaseOut) * peopleAged65Plus
}

/** LTCG/QDI stacked on top of ordinary taxable income at 0/15/20%. */
function capitalGainsTaxStacked(
  pack: ParameterPack,
  filingStatus: FilingStatus,
  ordinaryTaxable: number,
  preferentialIncome: number,
): number {
  if (preferentialIncome <= 0) return 0
  const t15 = pack.capitalGains.rate15StartsAbove[filingStatus]
  const t20 = pack.capitalGains.rate20StartsAbove[filingStatus]
  const from = ordinaryTaxable
  const to = ordinaryTaxable + preferentialIncome

  // The layer below t15 is the 0% bracket and contributes no tax.
  const at15 = Math.max(0, Math.min(to, t20) - Math.max(from, t15))
  const at20 = Math.max(0, to - Math.max(from, t20))
  return at15 * 0.15 + at20 * 0.2
}

function amtExemptionAmount(pack: ParameterPack, filingStatus: FilingStatus, amti: number): number {
  const rule = pack.federalTax.amt
  const base = rule.exemption[filingStatus]
  const phaseOut = Math.max(0, amti - rule.exemptionPhaseOutStart[filingStatus]) * (rule.exemptionPhaseOutRatePct / 100)
  return Math.max(0, base - phaseOut)
}

function amtOrdinaryRateTax(pack: ParameterPack, taxableExcess: number): number {
  if (taxableExcess <= 0) return 0
  const rule = pack.federalTax.amt
  const firstLayer = Math.min(taxableExcess, rule.rate28StartsAbove) * (rule.rate26Pct / 100)
  const secondLayer = Math.max(0, taxableExcess - rule.rate28StartsAbove) * (rule.rate28Pct / 100)
  return firstLayer + secondLayer
}

function tentativeMinimumTax(
  pack: ParameterPack,
  filingStatus: FilingStatus,
  taxableExcess: number,
  preferentialIncome: number,
): number {
  if (taxableExcess <= 0) return 0
  const amtPreferentialIncome = Math.min(Math.max(0, preferentialIncome), taxableExcess)
  const ordinaryAmtExcess = taxableExcess - amtPreferentialIncome
  return (
    amtOrdinaryRateTax(pack, ordinaryAmtExcess) +
    capitalGainsTaxStacked(pack, filingStatus, ordinaryAmtExcess, amtPreferentialIncome)
  )
}

/** One year's result of applying a capital-loss carryforward to income. */
export interface CarryforwardNetting {
  /** Ordinary income — unchanged; the deductible loss rides the capital line, not ordinary income. */
  ordinaryAfter: number
  /**
   * Net capital gain after the pool absorbs realized gains and the deductible
   * net loss is taken: positive when gains remain, negative (down to
   * −ordinaryOffsetLimit) when a net loss is deducted. Feeds the tax engine's
   * signed `capitalGains` input.
   */
  netCapitalGain: number
  /** Realized gains the pool absorbed this year. */
  usedAgainstGains: number
  /** Net loss deducted against income this year (≤ the annual limit); reduces AGI. */
  usedAgainstOrdinary: number
  /** Pool carried into next year. */
  remaining: number
}

/**
 * Apply a net capital-loss carryforward and the current signed capital result
 * to one year (IRC §1211(b)/§1212): use the opening pool against current gains,
 * add a current loss to what remains, then deduct up to `ordinaryOffsetLimit`
 * ($3,000) of the available loss as a *negative* figure on the
 * return's capital-gain line that reduces AGI (and so provisional income, taxable
 * SS, and MAGI) regardless of how much other income there is, **not** an offset
 * capped at ordinary income. The rest carries forward indefinitely. Pure — the
 * projection threads the depleting pool year-to-year and feeds the netted figures
 * to BOTH the federal and state calculators, so the AGI cascade falls out. Single
 * pool, no short-/long-term split (a documented planning simplification); the
 * §1212 carryover-worksheet preservation of a deduction "wasted" in a year with
 * no taxable income to absorb it is not modeled (immaterial outside zero-income
 * years). @see DOCS/features/taxes.md
 */
export function applyCapitalLossCarryforward(
  carryforward: number,
  ordinaryIncome: number,
  capitalGains: number,
  ordinaryOffsetLimit: number,
): CarryforwardNetting {
  const openingPool = Math.max(0, carryforward)
  const currentGain = Math.max(0, capitalGains)
  const currentLoss = Math.max(0, -capitalGains)
  const ordinary = Math.max(0, ordinaryIncome)
  const usedAgainstGains = Math.min(openingPool, currentGain)
  const availableLoss = openingPool - usedAgainstGains + currentLoss
  const usedAgainstOrdinary = Math.min(
    availableLoss,
    Math.max(0, ordinaryOffsetLimit),
  )
  const remaining = availableLoss - usedAgainstOrdinary
  return {
    ordinaryAfter: ordinary,
    netCapitalGain:
      currentGain - usedAgainstGains - usedAgainstOrdinary,
    usedAgainstGains,
    usedAgainstOrdinary,
    remaining,
  }
}

export function computeFederalTax(input: TaxYearInput): FederalTaxDetail {
  const { year, filingStatus } = input
  const taxStatus = taxParameterFilingStatus(filingStatus)
  const ordinary = Math.max(0, input.ordinaryIncome)
  // `capitalGains` is signed: after a carryforward absorbs realized gains, the
  // deductible net loss (≤ the annual limit) arrives negative — the 1040 carries
  // it on the capital-gain line, so it reduces AGI / provisional income / taxable
  // SS / MAGI even when there is little or no other income.
  const netCapital = input.capitalGains
  const gains = Math.max(0, netCapital)
  const qualifiedDividends = Math.max(0, input.qualifiedDividends ?? 0)
  const ss = Math.max(0, input.ssBenefits)
  const { pack: publishedPack, isStandIn } = packForYear(year)
  // A stand-in pack carries the figures as published for ITS year. The income
  // arriving here is nominal for `year`, so the annually-indexed thresholds have
  // to be carried forward with it; `indexFederalTaxPack` is a no-op at scale 1
  // and leaves the statutorily unindexed figures alone at any scale.
  const pack = indexFederalTaxPack(publishedPack, input.inflationScale ?? 1)
  const charitableParameters = year === 2026
    ? annualCharitableDeductionParameters(2026)
    : null

  const agiExcludingSs = ordinary + netCapital + qualifiedDividends // a net capital loss can drive this below zero
  const taxableSs = taxableSocialSecurity(
    pack,
    taxStatus,
    agiExcludingSs,
    ss,
    input.taxExemptInterest,
    input.foreignExclusionAddback,
  )
  const agiBeforeFloor = agiExcludingSs + taxableSs
  const agi = Math.max(0, agiBeforeFloor) // return-level floor for tax / MAGI / IRMAA
  // Two limits below run off modified AGI rather than the AGI line, and both
  // definitions restore income excluded abroad: §1411(d) is AGI "increased by
  // the excess of (1) the amount excluded from gross income under section
  // 911(a)(1)" over the deductions §911(d)(6) disallows, and
  // §151(d)(5)(C)(iii)(II) is AGI "increased by any amount excluded from gross
  // income under section 911, 931, or 933". The engine carries one
  // excluded-foreign-income figure and applies the broader definition to both
  // — the same figure §86(b)(2)(A) already puts into provisional income above.
  const magi = agi + Math.max(0, input.foreignExclusionAddback ?? 0)

  const senior = seniorDeductionAmount(pack, year, taxStatus, input.peopleAged65Plus, magi)
  // The OBBBA senior deduction applies whether you take the standard deduction or
  // itemize, so it rides on top of whichever base is larger.
  const standardBase = standardDeduction(pack, taxStatus, input.peopleAged65Plus)
  // §170(b)(1)(H) defines the contribution base as adjusted gross income, and
  // the charitable deduction is below the line, so `agi` does not depend on it.
  const itemizedBeforeSection68 = itemizedTotal(
    pack,
    input.itemizedDeductions,
    year,
    agi,
    charitableParameters,
  )
  // §68(b) applies this "after the application of any other limitation on the
  // allowance of any itemized deduction", so it runs on the assembled total and
  // nothing may be added to that total afterwards. The election below compares
  // the reduced figure, because a household elects between the standard
  // deduction and what it may actually deduct, not what it could have.
  const section68Limitation = section68Reduction(
    pack,
    filingStatus,
    taxStatus,
    itemizedBeforeSection68,
    agi,
    senior,
    year,
    charitableParameters,
  )
  const itemized = itemizedBeforeSection68 - section68Limitation
  const useItemized = itemized > standardBase
  const deduction = Math.max(standardBase, itemized) + senior

  const taxableIncome = Math.max(0, agi - deduction)
  const preferentialIncome = Math.min(gains + qualifiedDividends, taxableIncome)
  const ordinaryTaxable = taxableIncome - preferentialIncome

  const ordinaryTax = bracketTax(pack.federalTax.brackets[taxStatus], ordinaryTaxable)
  const capitalGainsTax = capitalGainsTaxStacked(pack, taxStatus, ordinaryTaxable, preferentialIncome)

  // Deliberately the pre-§68 SALT figure. §68 reduces the aggregate of itemized
  // deductions and names no component, so "how much SALT survived" has no
  // answer once it applies. Form 6251 line 2a takes Schedule A line 7, which is
  // the SALT deduction before the overall limitation, so the add-back is
  // measured there too. Prorating §68 across components to answer a question
  // the statute does not ask would invent a number.
  const saltPreference = useItemized
    ? Math.min(Math.max(0, input.itemizedDeductions?.stateAndLocalTaxes ?? 0), saltCapForYear(pack, year))
    : 0
  // §56(b)(1)(D) disallows "the standard deduction under section 63(c), the
  // deduction for personal exemptions under section 151, and the deduction
  // under section 642(b)". Only the first of those turns on the election to
  // itemize. The senior deduction is allowed by §151(d)(5)(C), so it is
  // disallowed on either branch — Form 6251 line 1a removes Schedule 1-A line
  // 37 (the senior deduction alone, not the rest of that schedule) from total
  // deductions with no itemized-or-standard condition attached.
  const disallowedDeductionAddback = (useItemized ? 0 : standardBase) + senior
  const amtPreferenceItems = Math.max(0, input.amtPreferenceItems ?? 0) + saltPreference + disallowedDeductionAddback
  const alternativeMinimumTaxableIncome = Math.max(0, taxableIncome + amtPreferenceItems)
  const amtExemption = amtExemptionAmount(pack, taxStatus, alternativeMinimumTaxableIncome)
  const amtTaxableExcess = Math.max(0, alternativeMinimumTaxableIncome - amtExemption)
  const tmt = tentativeMinimumTax(pack, taxStatus, amtTaxableExcess, gains + qualifiedDividends)
  const regularIncomeTax = ordinaryTax + capitalGainsTax
  const alternativeMinimumTax = Math.max(0, tmt - regularIncomeTax)

  const investmentIncome =
    gains + qualifiedDividends + Math.max(0, input.taxableInterestIncome ?? 0) + Math.max(0, input.ordinaryDividends ?? 0)
  const niitBase = Math.min(investmentIncome, Math.max(0, magi - pack.niit.magiThreshold[taxStatus]))
  const niit = niitBase * (pack.niit.ratePct / 100)

  return {
    year,
    usesStandInPack: isStandIn,
    taxableSocialSecurity: taxableSs,
    agiBeforeFloor,
    agi,
    magi,
    deduction,
    seniorDeduction: senior,
    itemized: useItemized,
    section68Limitation,
    taxableIncome,
    ordinaryTaxable,
    preferentialIncome,
    ordinaryTax,
    capitalGainsTax,
    amtPreferenceItems,
    alternativeMinimumTaxableIncome,
    amtExemption,
    tentativeMinimumTax: tmt,
    alternativeMinimumTax,
    niit,
    totalTax: regularIncomeTax + alternativeMinimumTax + niit,
    zeroRateLtcgHeadroom: zeroRateLtcgHeadroom(
      pack,
      taxStatus,
      ordinary + Math.min(0, netCapital),
      gains,
      qualifiedDividends,
      ss,
      deduction,
      input.taxExemptInterest,
      input.foreignExclusionAddback,
    ),
  }
}

/** Federal engine behind the projection's pluggable interface. */
export function createFederalTaxCalculator(): TaxCalculator {
  return {
    compute: (input) => computeFederalTax(input).totalTax,
  }
}

export function combineTaxCalculators(...calculators: TaxCalculator[]): TaxCalculator {
  return {
    compute: (input) => calculators.reduce((sum, c) => sum + c.compute(input), 0),
  }
}
