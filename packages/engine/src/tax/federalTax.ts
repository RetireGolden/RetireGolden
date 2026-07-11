/**
 * Federal income tax (planning-grade), replacing the V1 flat placeholder.
 *
 * Computation order per year:
 *   1. Taxable Social Security via provisional income (unindexed thresholds)
 *   2. AGI = ordinary + capital gains + taxable SS; MAGI ≈ AGI (no foreign
 *      exclusions or tax-exempt interest modeled)
 *   3. Deductions: standard + age-65 additions + OBBBA senior deduction
 *      (2025–2028, 6%-of-MAGI phase-out); itemized not modeled in v1
 *   4. Ordinary brackets on non-preferential taxable income
 *   5. LTCG/qualified-dividend stacking at 0/15/20% on top of ordinary
 *   6. NIIT 3.8% on investment income over the (unindexed) MAGI threshold
 *   7. Planning-grade AMT screen: modeled add-backs/preference items (notably
 *      standard deduction or itemized SALT), AMT exemption/phaseout, and
 *      preferential-rate-aware tentative minimum tax.
 *
 * Out of scope here (see DOCS/features/taxes.md): credits, full Form 6251
 * adjustments, early-withdrawal penalties (projection-level), IRMAA
 * (expense-side), state.
 *
 * @see DOCS/domain/domain-rules-reference.md §§1–3
 */

import { packForYear, standardDeduction } from '../params/index.js'
import type { FilingStatus, ParameterPack, TaxBracket } from '../params/types.js'
import { taxParameterFilingStatus, type TaxCalculator, type TaxYearInput } from '../projection/types.js'

export interface FederalTaxDetail {
  year: number
  /** True when this year's figures use a stand-in parameter pack. */
  usesStandInPack: boolean
  taxableSocialSecurity: number
  agi: number
  magi: number
  deduction: number
  seniorDeduction: number
  /** True when the itemized total beat the standard deduction this year. */
  itemized: boolean
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
 * Itemized-deduction total (SALT capped) from its components, or 0 when none.
 * The OBBBA high-income SALT phase-out is not modeled (see pack `saltCap`).
 */
function itemizedTotal(pack: ParameterPack, items: TaxYearInput['itemizedDeductions']): number {
  if (!items) return 0
  const salt = Math.min(Math.max(0, items.stateAndLocalTaxes), pack.federalTax.saltCap)
  return salt + Math.max(0, items.mortgageInterest) + Math.max(0, items.charitable)
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
): number {
  const threshold = pack.capitalGains.rate15StartsAbove[filingStatus]
  const taxableIncomeAt = (extraGains: number): number => {
    const agiExcludingSs = ordinaryExcludingSs + currentGains + currentQualifiedDividends + extraGains
    const taxableSs = taxableSocialSecurity(pack, filingStatus, agiExcludingSs, ssBenefits)
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
 * Provisional income = AGI excluding SS + 50% of benefits (tax-exempt interest not modeled).
 */
export function taxableSocialSecurity(
  pack: ParameterPack,
  filingStatus: FilingStatus,
  agiExcludingSs: number,
  ssBenefits: number,
): number {
  if (ssBenefits <= 0) return 0
  const t50 = pack.ssBenefitTaxation.tier50Start[filingStatus]
  const t85 = pack.ssBenefitTaxation.tier85Start[filingStatus]
  const provisional = agiExcludingSs + 0.5 * ssBenefits

  if (provisional <= t50) return 0
  if (provisional <= t85) return Math.min(0.5 * ssBenefits, 0.5 * (provisional - t50))
  const tier1 = Math.min(0.5 * ssBenefits, 0.5 * (t85 - t50))
  return Math.min(0.85 * ssBenefits, 0.85 * (provisional - t85) + tier1)
}

/** OBBBA senior deduction (per person 65+, 6% MAGI phase-out, expires after lastApplicableYear). */
function seniorDeductionAmount(
  pack: ParameterPack,
  year: number,
  filingStatus: FilingStatus,
  peopleAged65Plus: number,
  magi: number,
): number {
  const rule = pack.federalTax.seniorDeduction
  if (!rule || peopleAged65Plus <= 0 || year > rule.lastApplicableYear) return 0
  const base = rule.amountPerPerson * peopleAged65Plus
  const phaseOut = Math.max(0, magi - rule.magiPhaseOutStart[filingStatus]) * (rule.phaseOutRatePct / 100)
  return Math.max(0, base - phaseOut)
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
 * Apply a net capital-loss carryforward to one year (IRC §1211(b)/§1212): net
 * against this year's realized gains first, then deduct up to `ordinaryOffsetLimit`
 * ($3,000) of the remainder as a net capital loss — a *negative* figure on the
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
  const pool = Math.max(0, carryforward)
  const netGains = Math.max(0, capitalGains)
  const ordinary = Math.max(0, ordinaryIncome)
  const usedAgainstGains = Math.min(pool, netGains)
  let remaining = pool - usedAgainstGains
  const usedAgainstOrdinary = Math.min(remaining, Math.max(0, ordinaryOffsetLimit))
  remaining -= usedAgainstOrdinary
  return {
    ordinaryAfter: ordinary,
    netCapitalGain: netGains - usedAgainstGains - usedAgainstOrdinary,
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
  const { pack, isStandIn } = packForYear(year)

  const agiExcludingSs = ordinary + netCapital + qualifiedDividends // a net capital loss can drive this below zero
  const taxableSs = taxableSocialSecurity(pack, taxStatus, agiExcludingSs, ss)
  const agi = Math.max(0, agiExcludingSs + taxableSs) // floor for reporting / MAGI / IRMAA / ACA
  const magi = agi

  const senior = seniorDeductionAmount(pack, year, taxStatus, input.peopleAged65Plus, magi)
  // The OBBBA senior deduction applies whether you take the standard deduction or
  // itemize, so it rides on top of whichever base is larger.
  const standardBase = standardDeduction(pack, taxStatus, input.peopleAged65Plus)
  const itemized = itemizedTotal(pack, input.itemizedDeductions)
  const useItemized = itemized > standardBase
  const deduction = Math.max(standardBase, itemized) + senior

  const taxableIncome = Math.max(0, agi - deduction)
  const preferentialIncome = Math.min(gains + qualifiedDividends, taxableIncome)
  const ordinaryTaxable = taxableIncome - preferentialIncome

  const ordinaryTax = bracketTax(pack.federalTax.brackets[taxStatus], ordinaryTaxable)
  const capitalGainsTax = capitalGainsTaxStacked(pack, taxStatus, ordinaryTaxable, preferentialIncome)

  const saltPreference = useItemized ? Math.min(Math.max(0, input.itemizedDeductions?.stateAndLocalTaxes ?? 0), pack.federalTax.saltCap) : 0
  const standardDeductionAddback = useItemized ? 0 : deduction
  const amtPreferenceItems = Math.max(0, input.amtPreferenceItems ?? 0) + saltPreference + standardDeductionAddback
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
    agi,
    magi,
    deduction,
    seniorDeduction: senior,
    itemized: useItemized,
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
