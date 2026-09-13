import { stateParamsFor, type StateTaxParams } from '../params/state/index.js'
import type { StateHouseholdTaxFacts } from './stateRetirementFacts.js'
/**
 * Iowa Code §422.7(19)-(21) retirement-income exclusion limbs.
 *
 * Age-55 path, disabled recipient, eligible survivor, and categorical military /
 * Railroad Retirement routing. Cap each exclusion at the federally included amount.
 *
 * @see https://www.legis.iowa.gov/docs/code/422.7.pdf
 */

import {
  emptyLeafAdjustment,
  isMilitarySource,
  isRailroadSource,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

function warning(partial: Omit<StateTaxExactnessWarning, 'code'> & { code?: string }): StateTaxExactnessWarning {
  return {
    code: partial.code ?? 'ia-retirement-incomplete',
    ruleId: partial.ruleId ?? 'iowa-code-422-7-retirement-exclusion',
    message: partial.message,
    missingFacts: partial.missingFacts,
  }
}

/**
 * Exclusion for one characterized Iowa distribution. Returns 0 when the fact
 * pattern does not qualify; never invents eligibility from aggregate buckets.
 */
export function iowaDistributionExclusion(fact: StateRetirementDistributionFact): StateLeafAdjustment {
  const amount = Math.max(0, fact.federallyIncludedAmount)
  if (amount === 0) return emptyLeafAdjustment()

  // Categorical military / RRB limbs (separate from the age/disability/survivor path).
  if (isMilitarySource(fact.sourceKind) || isRailroadSource(fact.sourceKind)) {
    return { taxableIncomeDelta: -amount, taxCredit: 0, warnings: [] }
  }

  if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') {
    return {
      taxableIncomeDelta: 0,
      taxCredit: 0,
      warnings: [
        warning({
          message:
            'Iowa retirement exclusion withheld: source identity unknown; aggregate public/private buckets are not treated as qualifying.',
          missingFacts: ['sourceKind'],
        }),
      ],
    }
  }

  const ageOk = fact.recipientAgeKnown !== false && fact.recipientAgeYears >= 55
  const disabledOk = fact.recipientDisabled === true
  const survivorOk =
    (fact.cause === 'death' || fact.sourceKind === 'governmentSurvivor') &&
    fact.decedentWouldQualify === true &&
    (fact.survivorSpouse === true || fact.survivorInsurableInterest === true)

  if (ageOk || disabledOk || survivorOk) {
    return { taxableIncomeDelta: -amount, taxCredit: 0, warnings: [] }
  }

  if (fact.recipientAgeKnown === false) return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [warning({ code: 'ia-retirement-age-unknown', message: 'Iowa retirement exclusion requires known age when disability or survivor qualification is not established.', missingFacts: ['recipientAgeYears'] })] }

  if (fact.recipientDisabled === undefined && fact.recipientAgeYears < 55) {
    // Disability not asserted — fail closed rather than guessing.
    // Ordinary under-55 private/IRA/employer distributions are simply ineligible.
  }

  return emptyLeafAdjustment()
}

/** Sum Iowa exclusions across characterized distributions. */
export function iowaRetirementExclusionTotal(
  facts: readonly StateRetirementDistributionFact[],
): StateLeafAdjustment {
  let delta = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of facts) {
    const part = iowaDistributionExclusion(fact)
    delta += part.taxableIncomeDelta
    warnings.push(...part.warnings)
  }
  return { taxableIncomeDelta: delta, taxCredit: 0, warnings }
}

/**
 * Iowa §422.5(2)–(3) low-income / alternate-tax comparison.
 * Requires complete Iowa test-net-income facts; otherwise retains ordinary tax
 * with a disclosure warning.
 */
export function iowaAlternateOrMinimumTax(args: {
  ordinaryTax: number
  filingStatus: 'single' | 'marriedFilingJointly' | 'headOfHousehold' | 'qualifyingSurvivingSpouse' | 'marriedFilingSeparately'
  testNetIncome: number | undefined
  seniorForThreshold: boolean
  config?: StateTaxParams['iowaAlternateTax']
  householdFacts?: StateHouseholdTaxFacts
  taxableIncome?: number
}): StateLeafAdjustment & { tax: number } {
  const { ordinaryTax, filingStatus, testNetIncome, seniorForThreshold } = args
  const result = (tax: number): StateLeafAdjustment & { tax: number } => ({ taxableIncomeDelta: 0, taxCredit: 0, tax, warnings: [] })
  const incomplete = (...missingFacts: string[]): StateLeafAdjustment & { tax: number } => ({ ...result(ordinaryTax), warnings: [warning({ code: 'ia-alternate-tax-incomplete', message: 'Iowa relief requires complete statutory household and worksheet facts; ordinary tax retained.', missingFacts })] })
  const config = args.config ?? stateParamsFor('IA', 2026)?.iowaAlternateTax
  if (!config) return incomplete('iowaAlternateTax')
  if (testNetIncome === undefined) return incomplete('iowaTestNetIncome')
  const facts = args.householdFacts
  if (facts?.iowaClaimedAsDependent === undefined) return incomplete('iowaClaimedAsDependent')
  const singleThreshold = seniorForThreshold ? config.seniorSingleThreshold : config.singleThreshold
  const jointThreshold = seniorForThreshold ? config.seniorJointThreshold : config.jointThreshold
  if (facts.iowaClaimedAsDependent) {
    if (facts.iowaClaimantTestNetIncome === undefined || facts.iowaClaimantJointThreshold === undefined) return incomplete('iowaClaimantTestNetIncome', 'iowaClaimantJointThreshold')
    if (facts.iowaClaimantTestNetIncome > (facts.iowaClaimantJointThreshold ? jointThreshold : singleThreshold)) return result(ordinaryTax)
  }
  const mfs = filingStatus === 'marriedFilingSeparately'
  const married = mfs || filingStatus === 'marriedFilingJointly'
  const needsNol = mfs || (married && testNetIncome > jointThreshold)
  if (needsNol && facts.iowaSpouseNolCarryElection === undefined) return incomplete('iowaSpouseNolCarryElection')
  if (needsNol && facts.iowaSpouseNolCarryElection === true) return result(ordinaryTax)
  if (mfs && facts.iowaCombinedSpouseTestNetIncome === undefined) return incomplete('iowaCombinedSpouseTestNetIncome')
  const testedIncome = mfs ? facts.iowaCombinedSpouseTestNetIncome! : testNetIncome
  if (mfs && testedIncome <= jointThreshold) {
    // Each separate return retains its own other-person minimum; combined
    // spousal income is an additional eligibility gate, never a second allowance.
    return result(Math.min(ordinaryTax, Math.max(0, testNetIncome - singleThreshold)))
  }
  if (filingStatus === 'single') return result(Math.min(ordinaryTax, Math.max(0, testNetIncome - singleThreshold)))
  if (testedIncome <= jointThreshold) return result(0)
  let alternate = config.alternateRate * (testedIncome - jointThreshold)
  if (mfs) {
    if (args.taxableIncome === undefined || facts.iowaSpouseTaxableIncome === undefined) return incomplete('iowaSpouseTaxableIncome', 'iowaTaxableIncome')
    const own = Math.max(0, args.taxableIncome)
    const combined = own + Math.max(0, facts.iowaSpouseTaxableIncome)
    if (combined <= 0) return result(0)
    // DOR alternate worksheet lines7-11 uses Iowa taxable income, not test net.
    alternate *= own / combined
  }
  return result(Math.min(ordinaryTax, alternate))
}
