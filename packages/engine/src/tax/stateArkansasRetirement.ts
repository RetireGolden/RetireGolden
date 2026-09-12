/**
 * Arkansas A.C.A. §26-51-307 retirement exclusion with IRA age-59½ gate.
 *
 * Employer-plan path has no age gate. IRA path qualifies only after age 59½ or
 * on death/disability. Aggregate ordinary qualifying amounts share one $6,000
 * per-person ceiling. Military/SS/RRB do not consume the ordinary cap.
 *
 * @see Act 141 of 2017 §3; AR1000 instructions line 18A
 */

import {
  isMilitarySource,
  isRailroadSource,
  type StateLeafAdjustment,
  type StateRetirementDistributionFact,
  type StateTaxExactnessWarning,
} from './stateRetirementFacts.js'

const IRA_AGE_GATE = 59.5

function iraQualifies(fact: StateRetirementDistributionFact): boolean {
  if (fact.cause === 'death' || fact.cause === 'disability' || fact.recipientDisabled === true) {
    return true
  }
  const age = fact.ageAtDistributionYears ?? fact.minimumAgeAtDistributionYears
  return age !== undefined && age >= IRA_AGE_GATE
}

/**
 * Ordinary §307(a) exclusion for characterized Arkansas distributions.
 * Military and railroad amounts are excluded fully outside the $6,000 pool.
 */
export function arkansasRetirementExclusion(
  facts: readonly StateRetirementDistributionFact[],
  ordinaryCapOrLegacyEligibleCount: number | undefined,
  legacyCap?: number,
): StateLeafAdjustment {
  const warnings: StateTaxExactnessWarning[] = []
  // The two-argument form is the pack-backed production API. Retain the
  // former third positional cap only for callers compiled during migration;
  // its eligible-count value is deliberately ignored because the cap is per
  // current recipient, not multiplied by household size.
  const ordinaryCapPerPerson = legacyCap ?? ordinaryCapOrLegacyEligibleCount
  if (ordinaryCapPerPerson === undefined) {
    return { taxableIncomeDelta: 0, taxCredit: 0, warnings: [{ code: 'ar-cap-pack-missing', ruleId: 'aca-26-51-307-six-thousand-retirement-exemption', message: 'Arkansas retirement exclusion requires its versioned annual cap.', missingFacts: ['retirementPrivate.capPerPerson'] }] }
  }
  const byOwner = new Map<string, { military: number; railroad: number; ordinary: number }>()

  for (const fact of facts) {
    const amount = Math.max(0, fact.federallyIncludedAmount)
    if (amount === 0) continue

    const owner = byOwner.get(fact.ownerPersonId) ?? { military: 0, railroad: 0, ordinary: 0 }
    if (isRailroadSource(fact.sourceKind)) {
      owner.railroad += amount
      byOwner.set(fact.ownerPersonId, owner)
      continue
    }
    if (isMilitarySource(fact.sourceKind)) {
      owner.military += amount
      byOwner.set(fact.ownerPersonId, owner)
      continue
    }

    if (fact.sourceKind === 'unknownPublic' || fact.sourceKind === 'unknownPrivate') {
      warnings.push({
        code: 'ar-retirement-source-unknown',
        ruleId: 'aca-26-51-307-six-thousand-retirement-exemption',
        message:
          'Arkansas ordinary retirement exclusion withheld for unknown source identity; no deduction granted by guess.',
        missingFacts: ['sourceKind'],
      })
      continue
    }

    if (fact.sourceKind === 'ira') {
      if (fact.ageAtDistributionYears === undefined && (fact.minimumAgeAtDistributionYears === undefined || fact.minimumAgeAtDistributionYears < IRA_AGE_GATE) && fact.cause !== 'death' && fact.cause !== 'disability' && fact.recipientDisabled !== true) {
        warnings.push({ code: 'ar-ira-age-unknown', message: 'Arkansas IRA exclusion requires known distribution age or death/disability qualification.', missingFacts: ['ageAtDistributionYears'] })
        continue
      }
      if (!iraQualifies(fact)) continue
      owner.ordinary += amount
      byOwner.set(fact.ownerPersonId, owner)
      continue
    }

    // Employer plan / ordinary private / federal or state-local public share the $6k pool.
    if (
      fact.sourceKind === 'employerPlan' ||
      fact.sourceKind === 'ordinaryPrivatePension' ||
      fact.sourceKind === 'federalCivilService' ||
      fact.sourceKind === 'stateLocalPublic'
    ) {
      owner.ordinary += amount
      byOwner.set(fact.ownerPersonId, owner)
    }
  }

  let total = 0
  for (const owner of byOwner.values()) {
    // Act 358 of 2023 adds the military-below-cap ordinary remainder
    // in subsection (f)(2), effective for TY2023 and later.
    total += owner.railroad + owner.military + Math.min(owner.ordinary, Math.max(0, ordinaryCapPerPerson - owner.military))
  }
  return {
    taxableIncomeDelta: total === 0 ? 0 : -total,
    taxCredit: 0,
    warnings,
  }
}

/** Discriminator: IRA exclusion amount alone under the age/cause gate (no employer mixing). */
export function arkansasIraExclusionAmount(
  fact: StateRetirementDistributionFact,
  ordinaryCapPerPerson: number,
): number {
  if (fact.sourceKind !== 'ira') return 0
  const amount = Math.max(0, fact.federallyIncludedAmount)
  if (!iraQualifies(fact)) return 0
  return Math.min(amount, ordinaryCapPerPerson)
}
