/**
 * South Carolina retirement deductions:
 * - §12-6-1170(A) source-based $3,000 / $10,000 tiers
 * - §12-6-1171 military retirement full deduction
 * - §12-6-1170(B) age-65 deduction ordered after retirement/military
 *
 * Blanket PUBLIC_PENSION_OVERRIDES full is overbroad; nonmilitary public stays
 * in the §1170 pool.
 */

import {
  emptyLeafAdjustment,
  isMilitarySource,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

const SC_RETIREMENT_TIER_UNDER_65 = 3_000
const SC_RETIREMENT_TIER_65_PLUS = 10_000
const SC_AGE65_DEDUCTION = 15_000

function prematureDisqualified(fact: StateRetirementDistributionFact): boolean {
  return (
    fact.earlyDistributionDisqualifier === 'true' ||
    fact.cause === 'earlyDistributionCode1'
  )
}

function prematureUnknown(fact: StateRetirementDistributionFact): boolean {
  return fact.earlyDistributionDisqualifier === 'unknown' && fact.cause !== 'death' && fact.cause !== 'disability'
}

/** §1171 military deduction for one owner. */
export function scMilitaryDeduction(facts: readonly StateRetirementDistributionFact[]): StateLeafAdjustment {
  let total = 0
  const warnings: StateTaxExactnessWarning[] = []
  for (const fact of facts) {
    if (!isMilitarySource(fact.sourceKind)) {
      if (fact.sourceKind === 'unknownPublic') {
        warnings.push({
          code: 'sc-military-unknown-public',
          ruleId: 'sc-code-12-6-1171-military-retirement',
          message:
            'South Carolina §1171 military deduction withheld: public source is unknown; aggregate publicPensionIncome is not treated as military.',
          missingFacts: ['sourceKind'],
        })
      }
      continue
    }
    if (prematureDisqualified(fact)) continue
    if (prematureUnknown(fact)) {
      warnings.push({ code: 'sc-military-premature-unknown', message: 'South Carolina military deduction requires absence of a premature distribution penalty.', missingFacts: ['earlyDistributionDisqualifier'] })
      continue
    }
    total += Math.max(0, fact.federallyIncludedAmount)
  }
  return { taxableIncomeDelta: -total, taxCredit: 0, warnings }
}

/**
 * §1170(A) retirement-income deduction for one owner.
 * Eligible qualified-plan / IRA amounts only; premature-penalty distributions
 * are excluded. Unknown premature status fails closed (no deduction).
 */
export function scSection1170Deduction(args: {
  facts: readonly StateRetirementDistributionFact[]
  recipientAgeYears: number
}): StateLeafAdjustment {
  const { facts, recipientAgeYears } = args
  const warnings: StateTaxExactnessWarning[] = []
  let eligible = 0

  for (const fact of facts) {
    if (isMilitarySource(fact.sourceKind)) continue // handled under §1171
    if (fact.sourceKind === 'railroadTier1' || fact.sourceKind === 'railroadTier2') continue
    if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') {
      warnings.push({
        code: 'sc-1170-unknown-source',
        ruleId: 'sc-code-12-6-1170-retirement-income-deduction',
        message: 'South Carolina §1170 deduction withheld for unknown source identity.',
        missingFacts: ['sourceKind'],
      })
      continue
    }
    if (
      fact.sourceKind !== 'ira' &&
      fact.sourceKind !== 'employerPlan' &&
      fact.sourceKind !== 'ordinaryPrivatePension' &&
      fact.sourceKind !== 'federalCivilService' &&
      fact.sourceKind !== 'stateLocalPublic' &&
      fact.sourceKind !== 'governmentSurvivor'
    ) {
      continue
    }
    if (prematureDisqualified(fact)) continue
    if (prematureUnknown(fact)) {
      warnings.push({
        code: 'sc-1170-premature-unknown',
        ruleId: 'sc-code-12-6-1170-retirement-income-deduction',
        message:
          'South Carolina §1170 deduction withheld: early-distribution / premature-penalty status is unknown.',
        missingFacts: ['earlyDistributionDisqualifier'],
      })
      continue
    }
    eligible += Math.max(0, fact.federallyIncludedAmount)
  }

  const cap = recipientAgeYears >= 65 ? SC_RETIREMENT_TIER_65_PLUS : SC_RETIREMENT_TIER_UNDER_65
  const deduction = Math.min(eligible, cap)
  return { taxableIncomeDelta: -deduction, taxCredit: 0, warnings }
}

/**
 * §1170(B) age-65 deduction: max(0, min(remaining SC income, 15000 - ownRetirement - ownMilitary)).
 * Surviving-spouse retirement deduction does not reduce the survivor's own age-65 room.
 */
export function scAge65Deduction(args: {
  recipientAgeYears: number
  remainingScIncome: number
  ownRetirementDeduction: number
  ownMilitaryDeduction: number
  /** Surviving-spouse retirement deduction claimed — does NOT reduce own age-65 room. */
  survivingSpouseRetirementDeduction?: number
}): StateLeafAdjustment {
  if (args.recipientAgeYears < 65) return emptyLeafAdjustment()
  const room = Math.max(0, SC_AGE65_DEDUCTION - args.ownRetirementDeduction - args.ownMilitaryDeduction)
  // survivingSpouseRetirementDeduction intentionally unused in the reduction (statutory exception).
  void args.survivingSpouseRetirementDeduction
  const deduction = Math.min(Math.max(0, args.remainingScIncome), room)
  return { taxableIncomeDelta: -deduction, taxCredit: 0, warnings: [] }
}

/**
 * Act 110 SCIAD phaseout. Reduction floors to the next lower $10.
 * Do not map HOH onto single.
 */
export function scSciadDeduction(args: {
  filingStatus: 'single' | 'marriedFilingJointly' | 'marriedFilingSeparately' | 'headOfHousehold' | 'qualifyingSurvivingSpouse'
  federalAgi: number
  config?: Record<typeof args.filingStatus, { base: number; phaseoutStart: number; phaseoutRange: number; reductionIncrement: number }>
}): { deduction: number; base: number } {
  if (!args.config) return { deduction: 0, base: 0 }
  const row = args.config[args.filingStatus]
  const fraction = Math.min(1, Math.max(0, (args.federalAgi - row.phaseoutStart) / row.phaseoutRange))
  const rawReduction = row.base * fraction
  const roundedReduction = Math.floor(rawReduction / row.reductionIncrement) * row.reductionIncrement
  return { deduction: Math.max(0, row.base - roundedReduction), base: row.base }
}
