/**
 * Leaf calculations for state provisions loaded with the survey of every
 * state's enacted law (decision D-2027-PUBLISHED-FIGURES, third round, and
 * D-STATE-TAX-2026-CORRECTIONS): Rhode Island's Social Security modification,
 * Virginia's personal exemptions, Maryland's capital-gain surtax and
 * public-safety retirement subtraction, the federal senior deduction some
 * states carry into their base, California's military exclusions, and the
 * statutory indexing of Washington's standard deduction.
 *
 * Each helper takes the parameter block the state's figures carry for the year
 * and returns a signed change to state taxable income (negative is a
 * subtraction) or, for Maryland's surtax, the additional tax. The figures, not
 * this module, decide which years apply: a block absent from a year's figures
 * means the provision does not apply that year.
 *
 * @see DOCS/calculations/taxes/state-enacted-tax-year-figures.md
 */

import type { StateTaxParams } from '../params/state/types.js'
import {
  emptyLeafAdjustment,
  isMilitarySource,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
} from './stateRetirementFacts.js'

type Defined<K extends keyof StateTaxParams> = NonNullable<StateTaxParams[K]>

/**
 * Rhode Island 44-30-12(c)(8): the Social Security included in federal AGI is
 * subtracted when federal AGI is below the limit for the filing status. Before
 * 2027 the filer (on a joint return, either spouse) must also have reached full
 * retirement age, read as `minAge` at the end of the year; from 2027 the
 * statute drops that test and the block carries no `minAge`.
 *
 * When only one spouse has reached that age, the Division's modification
 * worksheet subtracts only that spouse's share: the included benefits times
 * the qualifying spouse's gross benefits over the couple's (lines 8 to 13).
 * `recipients` carries each person's age and gross benefits when the plan
 * knows them; without them the whole included amount is subtracted.
 */
export function rhodeIslandSocialSecurityModification(args: {
  config: Defined<'rhodeIslandSocialSecurityModification'>
  joint: boolean
  federalAgi: number
  includedSocialSecurity: number
  claimantAges: readonly number[]
  recipients?: readonly { readonly ageYears?: number; readonly grossSocialSecurity: number }[]
}): StateLeafAdjustment {
  const included = Math.max(0, args.includedSocialSecurity)
  if (included === 0) return emptyLeafAdjustment()
  const limit = args.joint ? args.config.jointAgiLimit : args.config.nonjointAgiLimit
  if (!(args.federalAgi < limit)) return emptyLeafAdjustment()
  const minAge = args.config.minAge
  if (minAge !== undefined && !args.claimantAges.some((age) => age >= minAge)) return emptyLeafAdjustment()
  let share = 1
  if (minAge !== undefined && args.joint && args.recipients && args.recipients.length > 0) {
    const total = args.recipients.reduce((sum, row) => sum + Math.max(0, row.grossSocialSecurity), 0)
    const qualifying = args.recipients
      .filter((row) => row.ageYears !== undefined && row.ageYears >= minAge)
      .reduce((sum, row) => sum + Math.max(0, row.grossSocialSecurity), 0)
    const everyoneAged = args.recipients.every((row) => row.ageYears !== undefined && row.ageYears >= minAge)
    if (!everyoneAged && total > 0) share = qualifying / total
  }
  return { taxableIncomeDelta: -included * share, taxCredit: 0, warnings: [] }
}
/**
 * Rhode Island 44-30-12(c)(9)(i): the pension and annuity modification is
 * allowed only when federal AGI is less than the amount used for the Social
 * Security modification in (c)(8)(i)(A) (unmarried, head of household or
 * married filing separately) or (c)(8)(i)(B) (joint or qualifying widow(er)),
 * the limits the figures carry in `rhodeIslandSocialSecurityModification`.
 */
export function rhodeIslandPensionModificationAllowed(args: {
  config: Defined<'rhodeIslandSocialSecurityModification'>
  joint: boolean
  federalAgi: number
}): boolean {
  const limit = args.joint ? args.config.jointAgiLimit : args.config.nonjointAgiLimit
  return args.federalAgi < limit
}

/**
 * Virginia 58.1-322.03(2)(a)-(b): a deduction for each personal exemption the
 * filer could claim federally (the filer, and a spouse on a joint return), and
 * an additional one for each taxpayer 65 or older. Dependents are not modeled.
 */
export function virginiaPersonalExemptions(args: {
  config: Defined<'virginiaPersonalExemptions'>
  exemptionCount: number
  agedTaxpayerCount: number
}): StateLeafAdjustment {
  const deduction =
    args.config.perExemption * Math.max(0, args.exemptionCount) +
    args.config.perAgedTaxpayer * Math.max(0, args.agedTaxpayerCount)
  return { taxableIncomeDelta: -deduction, taxCredit: 0, warnings: [] }
}

/**
 * Maryland Tax-General 10-105(a)(3)-(4): an additional state tax on the net
 * capital gain included in Maryland AGI, for an individual whose federal AGI
 * exceeds the threshold. Returns the additional tax; county tax does not apply
 * to it.
 */
export function marylandCapitalGainSurtax(args: {
  config: Defined<'marylandCapitalGainSurtax'>
  federalAgi: number
  netCapitalGain: number
}): number {
  if (!(args.federalAgi > args.config.federalAgiThreshold)) return 0
  return Math.max(0, args.netCapitalGain) * (args.config.ratePct / 100)
}

/**
 * Maryland Tax-General 10-207(mm): each retiree at or above `minAge` subtracts
 * the first `amount` of retirement income attributable to public-safety
 * service, identified by the pension's state `planSystemCode`. Returns the
 * subtraction and, per owner, the amount taken, which 10-209(d)(2) keeps out of
 * the pension exclusion.
 */
export function marylandPublicSafetySubtraction(args: {
  config: Defined<'marylandPublicSafetySubtraction'>
  distributions: readonly StateRetirementDistributionFact[]
}): StateLeafAdjustment & { subtractedByOwner: ReadonlyMap<string, number> } {
  const byOwner = new Map<string, { income: number; age: number | undefined }>()
  for (const fact of args.distributions) {
    if (fact.planSystemCode !== args.config.planSystemCode) continue
    const row = byOwner.get(fact.ownerPersonId) ?? { income: 0, age: fact.recipientAgeKnown === false ? undefined : fact.recipientAgeYears }
    row.income += Math.max(0, fact.federallyIncludedAmount)
    byOwner.set(fact.ownerPersonId, row)
  }
  const subtractedByOwner = new Map<string, number>()
  const result: StateLeafAdjustment = emptyLeafAdjustment()
  for (const [owner, row] of byOwner) {
    if (row.age === undefined) {
      result.warnings.push({
        code: 'md-public-safety-age-unknown',
        ruleId: 'md-tg-10-207-mm-public-safety-retirement-subtraction',
        message: 'Maryland public-safety retirement subtraction requires the retiree age.',
        missingFacts: ['recipientAgeYears'],
      })
      continue
    }
    if (row.age < args.config.minAge) continue
    const taken = Math.min(args.config.amount, row.income)
    subtractedByOwner.set(owner, taken)
    result.taxableIncomeDelta -= taken
  }
  return { ...result, subtractedByOwner }
}

/**
 * The federal IRC 151(d)(5)(C) senior deduction a state carries into its base
 * (Arizona 43-1022(35); Colorado and Idaho through federal taxable income).
 * The amount is the federal figure for the same return.
 */
export function federalSeniorDeductionSubtraction(args: { federalSeniorDeduction: number }): StateLeafAdjustment {
  return { taxableIncomeDelta: -Math.max(0, args.federalSeniorDeduction), taxCredit: 0, warnings: [] }
}

/**
 * California RTC 17132.9 and 17132.10: military retirement pay, and Survivor
 * Benefit Plan annuities, each excluded up to its cap, for a return whose
 * federal AGI is at or below the limit. Each cap is read per return: the
 * statute defines spouses filing a joint return as one qualified taxpayer.
 */
export function californiaMilitaryExclusions(args: {
  config: Defined<'californiaMilitaryExclusions'>
  joint: boolean
  federalAgi: number
  distributions: readonly StateRetirementDistributionFact[]
}): StateLeafAdjustment {
  const limit = args.joint ? args.config.agiLimitJoint : args.config.agiLimitNonjoint
  if (args.federalAgi > limit) return emptyLeafAdjustment()
  const sum = (kind: StateRetirementDistributionFact['sourceKind']): number =>
    args.distributions
      .filter((fact) => isMilitarySource(fact.sourceKind) && fact.sourceKind === kind)
      .reduce((total, fact) => total + Math.max(0, fact.federallyIncludedAmount), 0)
  const excluded =
    Math.min(args.config.retirementCap, sum('militaryRetirement')) +
    Math.min(args.config.survivorBenefitCap, sum('militarySurvivor'))
  return { taxableIncomeDelta: -excluded, taxCredit: 0, warnings: [] }
}


/**
 * A standard deduction the state's own statute indexes on a schedule of its
 * own, projected past its published amount at the plan's inflation. Washington
 * is the one case (ESSB 6346, chapter 238, Laws of 2026, section 316): from
 * October 2029 and each October of an odd-numbered year after, the deduction
 * is multiplied by one plus the percentage by which the consumer price index
 * exceeds the index for the prior 12-month period, rounded to the nearest
 * $1,000, never reduced, and the adjusted amount "takes effect for taxes due in
 * the following calendar year", read as the tax year of the adjustment (the
 * act's own usage, and the Department's under the same words in RCW
 * 82.87.150). So the amount changes for 2029, 2031 and every second year
 * after, each time by one year's inflation.
 *
 * The District of Columbia's basic standard deduction for 2026 to 2029 (D.C.
 * Code 47-1801.04(3A), D.C. Act 26-416) is the other case: from 2027 it is the
 * 2026 amount increased by the cost-of-living adjustment from a 2025 base year,
 * rounded down to a multiple of $50, which is the published amount times the
 * cumulative inflation factor (`basis: 'cumulative'`).
 *
 * The plan's inflation for a year is read from `inflationScale`, the
 * cumulative factor from the pack year to the year priced, as the rate that
 * compounds to it. That is the plan's rate exactly when its inflation is
 * constant, as in a deterministic projection; along a Monte Carlo series it is
 * the path's average rate to that year. With no projection (a factor of 1, or
 * a year the pack itself prices) the published amount stands.
 */
export function statutorilyIndexedStandardDeduction(
  params: StateTaxParams,
  args: { readonly year: number; readonly packYear: number; readonly inflationScale: number },
): StateTaxParams {
  const rule = params.standardDeductionStatutoryIndexing
  if (!rule || args.year < rule.firstIndexedYear || args.year <= args.packYear) return params
  const scale = Number.isFinite(args.inflationScale) && args.inflationScale > 0 ? args.inflationScale : 1
  // Rounding down allows for binary noise, so an exact multiple such as
  // 30,000 x 1.025 = 30,750 is not taken as 30,749.99... and dropped by $50.
  const round = (amount: number): number =>
    (rule.rounding === 'down' ? Math.floor(amount / rule.roundToNearest + 1e-9) : Math.round(amount / rule.roundToNearest)) * rule.roundToNearest
  const rate = Math.pow(scale, 1 / (args.year - args.packYear)) - 1
  const indexed = (published: number): number => {
    // The District's amount is the base amount times the cumulative change,
    // rounded once, and never below the base.
    if (rule.basis === 'cumulative') return Math.max(published, round(published * scale))
    let amount = published
    for (let applies = rule.firstIndexedYear; applies <= args.year; applies += rule.intervalYears) {
      const adjusted = round(amount * (1 + rate))
      if (adjusted > amount) amount = adjusted
    }
    return amount
  }
  return {
    ...params,
    standardDeduction: {
      single: indexed(params.standardDeduction.single),
      marriedFilingJointly: indexed(params.standardDeduction.marriedFilingJointly),
    },
  }
}
