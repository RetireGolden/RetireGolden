/**
 * Projection summaries and the convert-vs-don't comparison (roadmap V3).
 * Scenario diffing generalizes in V4; this covers the headline question.
 */

import type { Account, Plan } from '../model/plan'
import { simulatePlan, type SimulateOptions } from './simulate'
import type { ProjectionResult } from './types'

function isoYear(isoDate: string): number {
  return Number(isoDate.slice(0, 4))
}

export type EstateDestination = 'spouse' | 'nonSpouse' | 'charity'

/** How one account's ending balance is discounted on the way to heirs/charity. */
export interface EstateAccountBreakdown {
  accountId: string
  name: string
  category: 'cash' | 'taxable' | 'traditional' | 'roth' | 'hsa'
  grossBalance: number
  destination: EstateDestination
  /** Pre-tax portion exposed to heir income tax (traditional net of 8606 basis; non-spouse HSA). */
  taxablePretaxBase: number
  heirTaxRatePct: number
  /** Portion passing to charity, untaxed. */
  charityAmount: number
  heirTax: number
  /** grossBalance − charityAmount − heirTax. */
  netToHeirs: number
}

/**
 * Resolve an account's estate destination for the after-tax estate metric.
 * Explicit `estateBeneficiary` wins; otherwise the legacy defaults reproduce the
 * old flat haircut exactly: pre-tax (traditional) balances go to a taxed heir,
 * an HSA follows its legacy `beneficiary` shorthand, and everything else passes
 * to a (untaxed) spouse-equivalent.
 */
function resolveEstateDestination(account: Account): { destination: EstateDestination; charityPct: number } {
  if ('estateBeneficiary' in account && account.estateBeneficiary) {
    return {
      destination: account.estateBeneficiary.destination,
      charityPct: account.estateBeneficiary.charityPct ?? 0,
    }
  }
  if (account.type === 'hsa') {
    return { destination: account.beneficiary === 'nonSpouse' ? 'nonSpouse' : 'spouse', charityPct: 0 }
  }
  if (account.type === 'traditional') return { destination: 'nonSpouse', charityPct: 0 }
  return { destination: 'spouse', charityPct: 0 }
}

export interface ProjectionSummary {
  /** Sum of taxes and penalties over the whole projection. */
  lifetimeTaxesAndPenalties: number
  lifetimeRothConversions: number
  endingInvestable: number
  endingNetWorth: number
  /**
   * Ending net worth net of the income tax heirs owe on inherited pre-tax
   * (traditional) balances, at the plan's assumed heir tax rate. Nondeductible
   * (after-tax) IRA basis remaining at the horizon is excluded — the heir
   * inherits it tax-free and files a separate Form 8606. Roth, taxable
   * (stepped-up at death), cash, and property are treated as passing through
   * untaxed — the standard simplification for an estate comparison. An HSA
   * left to a non-spouse beneficiary is fully taxable in the death year (IRC
   * §223(f)(8)(B)), so its ending balance is also taxed at the heir rate; an
   * HSA inherited by a spouse (or with no beneficiary set) passes untaxed.
   */
  endingAfterTaxEstate: number
  /** Total heir income tax discounted from the estate (sum of the breakdown's heirTax). */
  endingEstateHeirTax: number
  /** Total passing to charity untaxed (sum of the breakdown's charityAmount). */
  endingEstateToCharity: number
  /** Per-account estate discounting, so the summary can explain each class's haircut. */
  estateBreakdown: EstateAccountBreakdown[]
  /** End-of-plan balance by account category. */
  endingByCategory: { cash: number; taxable: number; traditional: number; roth: number; hsa: number }
  depletionYear: number | null
  warnings: string[]
  // Derived FIRE metrics
  savingsRates: Array<{ year: number; ratePct: number }>
  averagePreRetirementSavingsRatePct: number
  fiNumber: number
  fiYear: number | null
  fiAge: number | null
  coastFireNumber: number
}

export function summarizeProjection(plan: Plan, result: ProjectionResult): ProjectionSummary {
  let taxes = 0
  let conversions = 0
  for (const y of result.years) {
    taxes += y.tax + y.penalties
    conversions += y.rothConversion
  }
  const endingByCategory = { cash: 0, taxable: 0, traditional: 0, roth: 0, hsa: 0 }
  const last = result.years[result.years.length - 1]
  if (last) {
    for (const account of plan.accounts) {
      if (account.type in endingByCategory) {
        endingByCategory[account.type as keyof typeof endingByCategory] += last.balances[account.id] ?? 0
      }
    }
  }

  // --- estate depth (guaranteed-income-and-estate-depth) --------------------
  // Discount each account's ending balance on the way to heirs/charity, so the
  // summary can explain how every class was treated. Pre-tax classes are taxed
  // at a class heir rate (heirTaxByClass override, else the flat heirTaxRatePct);
  // charity carve-outs pass untaxed; Roth/taxable (stepped-up)/cash pass free.
  // With no beneficiary fields set anywhere the defaults reproduce the old flat
  // haircut exactly, so existing plans stay byte-identical.
  // Scope: the breakdown covers investable account classes only. Property,
  // debts, TIPS-ladder face, insurance cash value, and any HECM loan (already
  // netted into endingNetWorth with its non-recourse cap) ride through
  // netWorth without per-account rows here, so the breakdown's rows sum to
  // the investable slice of the estate, not the whole headline figure.
  const flatHeirRate = plan.assumptions.heirTaxRatePct / 100
  const heirRateFor = (category: EstateAccountBreakdown['category']): number => {
    const byClass = plan.assumptions.heirTaxByClass
    if (category === 'traditional' && byClass?.traditional !== undefined) return byClass.traditional / 100
    if (category === 'hsa' && byClass?.hsa !== undefined) return byClass.hsa / 100
    return flatHeirRate
  }
  // Nondeductible IRA basis passes to the heir tax-free (Form 8606); allocate it
  // across traditional accounts by balance so per-account heir tax nets it out.
  const basisTotal = Math.min(result.endingNondeductibleIraBasis, endingByCategory.traditional)
  const estateBreakdown: EstateAccountBreakdown[] = []
  if (last) {
    for (const account of plan.accounts) {
      // Equity comp is stepped-up at death like a taxable account, and it is part
      // of ending net worth, so it must appear in the breakdown (and honor a
      // charity destination) to keep endingAfterTaxEstate consistent — otherwise
      // it would silently pass untaxed but be un-markable and invisible here.
      const category = (account.type === 'equityComp' ? 'taxable' : account.type) as EstateAccountBreakdown['category']
      if (!(category in endingByCategory)) continue
      const grossBalance = last.balances[account.id] ?? 0
      if (grossBalance <= 0) continue
      const { destination, charityPct } = resolveEstateDestination(account)
      let taxablePretaxBase = 0
      if (category === 'traditional') {
        const allocatedBasis = endingByCategory.traditional > 0 ? basisTotal * (grossBalance / endingByCategory.traditional) : 0
        taxablePretaxBase = Math.max(0, grossBalance - allocatedBasis)
      } else if (category === 'hsa' && destination !== 'spouse') {
        // An HSA passing to anyone but a spouse is a fully taxable distribution.
        taxablePretaxBase = grossBalance
      }
      const heirTaxRatePct = heirRateFor(category) * 100
      const charityFraction = destination === 'charity' ? Math.min(1, charityPct / 100) : 0
      const charityAmount = grossBalance * charityFraction
      // A spouse rollover is untaxed; otherwise the non-charity slice of the
      // pre-tax base is taxed at the class heir rate.
      const heirTax = destination === 'spouse' ? 0 : taxablePretaxBase * (1 - charityFraction) * heirRateFor(category)
      estateBreakdown.push({
        accountId: account.id,
        name: account.name,
        category,
        grossBalance,
        destination,
        taxablePretaxBase,
        heirTaxRatePct,
        charityAmount,
        heirTax,
        netToHeirs: grossBalance - charityAmount - heirTax,
      })
    }
  }
  const heirTax = estateBreakdown.reduce((sum, b) => sum + b.heirTax, 0)
  const estateToCharity = estateBreakdown.reduce((sum, b) => sum + b.charityAmount, 0)

  // FIRE metrics computation
  const startYear = result.startYear
  const inflationRate = plan.assumptions.inflationPct / 100
  const defaultReturn = plan.assumptions.defaultReturnPct / 100
  const realReturn = defaultReturn - inflationRate

  const primary = plan.household.people[0]
  const birthYear = primary ? isoYear(primary.dob) : 1980
  const retirementAge = primary?.retirementAge ?? 65
  const targetYear = birthYear + retirementAge

  // 1. Savings rates
  const savingsRates = result.years.map((y) => {
    const savings = y.contributions + y.employerMatch + y.surplusInvested
    const gross = y.incomes.total
    const ratePct = gross > 0 ? Math.max(0, Math.min(100, (savings / gross) * 100)) : 0
    return { year: y.year, ratePct }
  })

  // 2. Average pre-retirement savings rate
  const preRetirementRates = savingsRates.filter((r) => r.year < targetYear)
  const averagePreRetirementSavingsRatePct =
    preRetirementRates.length > 0
      ? preRetirementRates.reduce((acc, r) => acc + r.ratePct, 0) / preRetirementRates.length
      : 0

  // 3. FI Number
  const targetResult = result.years.find((y) => y.year === Math.max(startYear, targetYear)) ?? result.years[0]
  const nominalSpendingAtFI = targetResult
    ? targetResult.expenses.total + targetResult.tax + targetResult.penalties
    : plan.expenses.baseAnnual
  const yearsToFIYear = targetResult ? targetResult.year - startYear : 0
  const annualSpendingAtFIToday = nominalSpendingAtFI / Math.pow(1 + inflationRate, yearsToFIYear)
  const swr = (plan.assumptions.safeWithdrawalRatePct ?? 4) / 100
  const fiNumber = annualSpendingAtFIToday / swr

  // 4. FI Year and Age
  let fiYear: number | null = null
  let fiAge: number | null = null
  for (const y of result.years) {
    const deflatedInvestable = y.investableTotal / Math.pow(1 + inflationRate, y.year - startYear)
    if (deflatedInvestable >= fiNumber) {
      fiYear = y.year
      fiAge = y.year - birthYear
      break
    }
  }

  // 5. Coast FIRE Number
  const currentAge = startYear - birthYear
  const yearsToRetire = Math.max(0, retirementAge - currentAge)
  const coastFireNumber = fiNumber / Math.pow(1 + realReturn, yearsToRetire)

  return {
    lifetimeTaxesAndPenalties: taxes,
    lifetimeRothConversions: conversions,
    endingInvestable: result.endingInvestable,
    endingNetWorth: result.endingNetWorth,
    // What heirs receive: net worth less heir tax and less any charitable
    // bequests (charity leaves the heirs' estate but is never taxed). With no
    // charity destination this equals net worth − heir tax, as before.
    endingAfterTaxEstate: result.endingNetWorth - estateToCharity - heirTax,
    endingEstateHeirTax: heirTax,
    endingEstateToCharity: estateToCharity,
    estateBreakdown,
    endingByCategory,
    depletionYear: result.depletionYear,
    warnings: result.warnings,
    savingsRates,
    averagePreRetirementSavingsRatePct,
    fiNumber,
    fiYear,
    fiAge,
    coastFireNumber,
  }
}

export interface RothComparison {
  withConversions: ProjectionSummary
  withoutConversions: ProjectionSummary
}

/** Runs the plan as-is and with conversions disabled, for side-by-side display. */
export function compareRothConversion(plan: Plan, opts: SimulateOptions): RothComparison {
  const disabled: Plan = {
    ...plan,
    strategies: { ...plan.strategies, rothConversion: { mode: 'none' } },
  }
  return {
    withConversions: summarizeProjection(plan, simulatePlan(plan, opts)),
    withoutConversions: summarizeProjection(disabled, simulatePlan(disabled, opts)),
  }
}

export interface LtcStressComparison {
  /** No care episode, LTC policies held out — the premium-neutral baseline. */
  noCare: ProjectionSummary
  /** The care episode occurs and is fully self-funded (LTC policies removed). */
  careUninsured: ProjectionSummary
  /** The care episode occurs with the plan's LTC policies (premiums + benefits). */
  careInsured: ProjectionSummary
  hasCareEvents: boolean
  hasLtcPolicy: boolean
}

/**
 * The "LTC stress" comparison: how a deterministic care episode hits the plan,
 * and what the LTC policy does about it.
 *
 * noCare and careUninsured both hold LTC out, so they differ only by the care
 * episode — `noCare − careUninsured` is the raw care shock, free of premium
 * effects. careInsured adds the policies back, so `careInsured − careUninsured`
 * is the policy's value *net of its premiums* (it can be negative if lifetime
 * premiums exceed the benefits paid). The UI labels it as such.
 */
export function compareLtcStress(plan: Plan, opts: SimulateOptions): LtcStressComparison {
  const run = (p: Plan) => summarizeProjection(p, simulatePlan(p, opts))
  const withoutLtc = plan.insurance.filter((i) => i.kind !== 'ltc')
  const noCare: Plan = { ...plan, careEvents: [], insurance: withoutLtc }
  const careUninsured: Plan = { ...plan, insurance: withoutLtc }
  return {
    noCare: run(noCare),
    careUninsured: run(careUninsured),
    careInsured: run(plan),
    hasCareEvents: plan.careEvents.length > 0,
    hasLtcPolicy: plan.insurance.some((i) => i.kind === 'ltc'),
  }
}
