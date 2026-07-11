/**
 * State income tax (V5, "big levers"). State taxable income starts from
 * ordinary income plus capital gains (most states tax gains as ordinary) plus
 * the federally taxable Social Security amount only where the state taxes SS,
 * minus the major retirement-income exclusion and the state standard
 * deduction; brackets then apply.
 *
 * A single calculator instance resolves the right state+year from each
 * TaxYearInput, so mid-retirement moves and year-specific packs work without
 * rebuilding it. The plan's flat effective-rate override takes precedence when
 * set above zero (a manual correction); otherwise a modeled pack is used, and
 * unmodeled states contribute zero until their pack ships.
 *
 * @see DOCS/features/taxes.md
 */

import { stateParamsFor, type StateRetirementExclusion, type StateTaxBracket, type StateTaxParams } from '../params/state/index.js'
import { taxableSocialSecurity } from './federalTax.js'
import { packForYear } from '../params/index.js'
import { taxParameterFilingStatus, type TaxCalculator, type TaxYearInput } from '../projection/types.js'

function bracketTax(brackets: StateTaxBracket[], taxable: number): number {
  let tax = 0
  for (let i = 0; i < brackets.length; i++) {
    const lower = brackets[i]!.lowerBound
    const upper = i + 1 < brackets.length ? brackets[i + 1]!.lowerBound : Infinity
    if (taxable <= lower) break
    tax += (Math.min(taxable, upper) - lower) * (brackets[i]!.ratePct / 100)
  }
  return tax
}

/** Retirement income excluded from state taxable income, per the state's rule. */
function retirementExclusion(rule: StateRetirementExclusion, retirementIncome: number, agesAlive: number[]): number {
  const r = rule
  const income = Math.max(0, retirementIncome)
  if (r.kind === 'none' || income === 0) return 0
  const eligibleCount = r.minAge === undefined ? agesAlive.length : agesAlive.filter((a) => a >= r.minAge!).length
  if (eligibleCount === 0) return 0
  if (r.kind === 'full') return income
  return Math.min(income, (r.capPerPerson ?? 0) * eligibleCount)
}

export interface ComputeStateTaxOptions {
  /**
   * Pre-computed federally taxable Social Security to add to the state base
   * instead of recomputing it here. Split-year residency uses this: taxable SS
   * must be derived once from full-year income against full-year federal
   * thresholds, then apportioned to each state — recomputing it per partial-year
   * slice against annual thresholds would understate it.
   */
  taxableSocialSecurityOverride?: number
  /** Optional flat local rate (percent) applied to computed state taxable income. */
  localRatePct?: number
}

export interface StateTaxDetail {
  taxableIncome: number
  stateTax: number
  localTax: number
  totalTax: number
}

export function computeStateTaxableIncome(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): number {
  if (!params.hasIncomeTax) return 0
  const taxStatus = taxParameterFilingStatus(input.filingStatus)
  const ordinary = Math.max(0, input.ordinaryIncome)
  const qualifiedDividends = Math.max(0, input.qualifiedDividends ?? 0)
  // Signed: a capital-loss carryforward arrives as a negative net capital gain,
  // which reduces state taxable income (and its SS base) just like it does federally.
  const netCapital =
    params.capitalLossCarryforwardConformity === 'currentYearOnly'
      ? Math.max(0, input.realizedCapitalGainsBeforeCarryforward ?? input.capitalGains)
      : input.capitalGains
  const taxableCapitalPct = (params.capitalGainsTaxablePct ?? (params.capitalGainsAsOrdinary ? 100 : 0)) / 100
  const ss = Math.max(0, input.ssBenefits)
  // Interest on U.S. government obligations (Treasury/TIPS) is exempt from
  // state income tax in every state (31 U.S.C. §3124). It arrives inside
  // ordinaryIncome, so subtract it from the state base here.
  const usGovInterest = Math.min(ordinary, Math.max(0, input.usGovernmentInterest ?? 0))

  let taxable = ordinary - usGovInterest + qualifiedDividends
  if (taxableCapitalPct > 0) taxable += netCapital * taxableCapitalPct
  if (params.taxesSocialSecurity && ss > 0) {
    if (opts.taxableSocialSecurityOverride !== undefined) {
      taxable += Math.max(0, opts.taxableSocialSecurityOverride)
    } else {
      const { pack } = packForYear(input.year)
      taxable += taxableSocialSecurity(pack, taxStatus, ordinary + qualifiedDividends + netCapital, ss)
    }
  }
  const privateRetirement = input.privateRetirementIncome ?? input.retirementIncome ?? 0
  const publicPension = input.publicPensionIncome ?? 0
  const agesAlive = input.agesAlive ?? []
  if (params.retirementRuleShared) {
    // One all-retirement rule copied into both buckets: a capped exclusion
    // applies once to the combined retirement income, not once per bucket.
    taxable -= retirementExclusion(params.retirementPrivate, privateRetirement + publicPension, agesAlive)
  } else {
    taxable -= retirementExclusion(params.retirementPrivate, privateRetirement, agesAlive)
    taxable -= retirementExclusion(params.retirementPublic, publicPension, agesAlive)
  }
  taxable -= params.standardDeduction[taxStatus]

  return Math.max(0, taxable)
}

export function computeStateTaxDetail(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): StateTaxDetail {
  const taxableIncome = computeStateTaxableIncome(params, input, opts)
  const taxStatus = taxParameterFilingStatus(input.filingStatus)
  const stateTax = params.hasIncomeTax ? bracketTax(params.brackets[taxStatus], taxableIncome) : 0
  const localTax = taxableIncome * (Math.max(0, opts.localRatePct ?? 0) / 100)
  return { taxableIncome, stateTax, localTax, totalTax: stateTax + localTax }
}

export function computeStateTax(
  params: StateTaxParams,
  input: TaxYearInput,
  opts: ComputeStateTaxOptions = {},
): number {
  return computeStateTaxDetail(params, input, opts).stateTax
}

function scaleExclusion(rule: StateRetirementExclusion, scale: number): StateRetirementExclusion {
  return rule.capPerPerson === undefined ? rule : { ...rule, capPerPerson: rule.capPerPerson * scale }
}

function prorateParams(params: StateTaxParams, scale: number): StateTaxParams {
  return {
    ...params,
    standardDeduction: {
      single: params.standardDeduction.single * scale,
      marriedFilingJointly: params.standardDeduction.marriedFilingJointly * scale,
    },
    brackets: {
      single: params.brackets.single.map((b) => ({ ...b, lowerBound: b.lowerBound * scale })),
      marriedFilingJointly: params.brackets.marriedFilingJointly.map((b) => ({ ...b, lowerBound: b.lowerBound * scale })),
    },
    retirementPrivate: scaleExclusion(params.retirementPrivate, scale),
    retirementPublic: scaleExclusion(params.retirementPublic, scale),
  }
}

function prorateInput(input: TaxYearInput, scale: number, state: string): TaxYearInput {
  return {
    ...input,
    state,
    stateResidency: undefined,
    ordinaryIncome: input.ordinaryIncome * scale,
    capitalGains: input.capitalGains * scale,
    realizedCapitalGainsBeforeCarryforward:
      input.realizedCapitalGainsBeforeCarryforward === undefined
        ? undefined
        : input.realizedCapitalGainsBeforeCarryforward * scale,
    taxableInterestIncome: (input.taxableInterestIncome ?? 0) * scale,
    usGovernmentInterest: input.usGovernmentInterest === undefined ? undefined : input.usGovernmentInterest * scale,
    ordinaryDividends: (input.ordinaryDividends ?? 0) * scale,
    qualifiedDividends: (input.qualifiedDividends ?? 0) * scale,
    ssBenefits: input.ssBenefits * scale,
    retirementIncome: input.retirementIncome === undefined ? undefined : input.retirementIncome * scale,
    privateRetirementIncome: input.privateRetirementIncome === undefined ? undefined : input.privateRetirementIncome * scale,
    publicPensionIncome: input.publicPensionIncome === undefined ? undefined : input.publicPensionIncome * scale,
  }
}

export interface StateTaxOptions {
  /** Flat effective rate (percent). When > 0 it overrides modeled packs. */
  overridePct?: number
  /** Flat local income-tax rate (percent), applied to state taxable income. */
  localPct?: number
}

export interface StateTaxYearOptions extends StateTaxOptions {
  /**
   * Transform the resolved state params before computing. Used by the
   * relocation-compare driver attribution to re-price a year with one state
   * feature neutralized (e.g. "as if this state taxed Social Security");
   * with no transform the result is exactly what the calculator charged.
   */
  mapParams?: (params: StateTaxParams) => StateTaxParams
}

/**
 * Full state+local tax for one TaxYearInput — the single computation behind
 * `createStateTaxCalculator`, exported so callers can re-price a recorded
 * ledger year (relocation-compare drivers) through the identical path,
 * including the flat override and split-year residency proration.
 */
export function computeStateTaxYearTotal(input: TaxYearInput, opts: StateTaxYearOptions = {}): number {
  const overrideRate = Math.max(0, opts.overridePct ?? 0) / 100
  const localRatePct = Math.max(0, opts.localPct ?? 0)
  const localRate = localRatePct / 100
  const resolveParams = (code: string): StateTaxParams | undefined => {
    const params = stateParamsFor(code, input.year)
    return params && opts.mapParams ? opts.mapParams(params) : params
  }
  if (overrideRate > 0) {
    // The flat effective rate approximates a state return, so it still
    // honors the universal U.S.-government-interest exemption.
    const base =
      Math.max(0, Math.max(0, input.ordinaryIncome) - Math.max(0, input.usGovernmentInterest ?? 0)) +
      Math.max(0, input.capitalGains) +
      Math.max(0, input.qualifiedDividends ?? 0)
    return base * (overrideRate + localRate)
  }
  if (input.stateResidency && input.stateResidency.length > 0) {
    // Taxable SS is a full-year federal computation: derive it once from
    // annual income and thresholds, then apportion it to each state by
    // months of residency (recomputing per slice would understate it).
    let annualTaxableSs = 0
    if (input.ssBenefits > 0) {
      const { pack } = packForYear(input.year)
      annualTaxableSs = taxableSocialSecurity(
        pack,
        taxParameterFilingStatus(input.filingStatus),
        Math.max(0, input.ordinaryIncome) + Math.max(0, input.qualifiedDividends ?? 0) + input.capitalGains,
        input.ssBenefits,
      )
    }
    return input.stateResidency.reduce((sum, segment) => {
      const months = Math.min(12, Math.max(0, segment.months))
      if (months <= 0) return sum
      const params = resolveParams(segment.state)
      if (!params) return sum
      const scale = months / 12
      const detail = computeStateTaxDetail(prorateParams(params, scale), prorateInput(input, scale, segment.state), {
        taxableSocialSecurityOverride: annualTaxableSs * scale,
        localRatePct,
      })
      return sum + detail.totalTax
    }, 0)
  }
  if (!input.state) return 0
  const params = resolveParams(input.state)
  return params ? computeStateTaxDetail(params, input, { localRatePct }).totalTax : 0
}

/**
 * State tax behind the projection's pluggable interface. Resolves residence
 * (input.state) and year per call so it composes with the federal calculator
 * via combineTaxCalculators and handles mid-plan relocation.
 */
export function createStateTaxCalculator(opts: StateTaxOptions = {}): TaxCalculator {
  return {
    compute(input) {
      return computeStateTaxYearTotal(input, opts)
    },
  }
}
