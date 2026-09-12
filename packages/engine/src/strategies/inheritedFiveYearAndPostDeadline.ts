/**
 * Non-designated-beneficiary five-year emptying schedule and post-deadline
 * entire-remaining-benefit distribution obligation under Treas. Reg.
 * 54.4974-1(c)/(e) and IRC 401(a)(9)(B)(ii).
 *
 * Confirmed classification is an explicit input — this module does not classify
 * trusts. Unknown trust/entity classification remains a typed refusal upstream.
 *
 * Post-deadline leaf returns only a typed distribution obligation. Ordinary
 * 25% / qualifying 10% / waiver excise is computed by the existing validated
 * `computeRmdShortfallExcise` path — not reimplemented from a boolean here.
 */

import { parseCivilIsoDate } from '../actions/civilDate.js'

export type KnownOrUnknownNumber = number | 'unknown'

export type FiveYearBeneficiaryClassification =
  | 'nonDesignatedConfirmed'
  | 'unknownTrustOrEntity'
  | 'designated'
  | 'otherSupportedRegime'

export interface FiveYearScheduleFacts {
  readonly ownerDeathDate: string
  readonly ownerDeathYear: number
  /** Independently established; unknown refuses this pathway. */
  readonly beneficiaryClassification: FiveYearBeneficiaryClassification
  readonly deathBeforeRequiredBeginningDate: boolean | 'unknown'
  readonly classificationProvenance: string
}

export interface FiveYearScheduleResult {
  readonly status: 'supported' | 'refusal' | 'notThisPathway'
  readonly reason?: string
  /** Calendar year by whose Dec 31 the entire interest is due (deathYear + 5). */
  readonly deadlineYear?: number
  /** Required minimum for `taxYear` before any post-deadline residual rule. */
  readonly requiredMinimumForTaxYear?: number
}

function provenanceIsBlank(value: string): boolean {
  return value.trim().length === 0
}

function deathDateEvidenceRefusal(
  facts: Readonly<FiveYearScheduleFacts>,
): string | undefined {
  if (provenanceIsBlank(facts.classificationProvenance)) {
    return 'blankClassificationProvenance'
  }
  const death = parseCivilIsoDate(facts.ownerDeathDate)
  if (death === null) {
    return 'invalidOwnerDeathDate'
  }
  if (death.year !== facts.ownerDeathYear) {
    return 'ownerDeathDateYearMismatch'
  }
  return undefined
}

/**
 * Pre-RBD confirmed five-year case: annual minimum zero until deadline year;
 * full remaining interest due by end of deathYear+5.
 */
export function fiveYearEmptyingRequirement(input: {
  readonly facts: Readonly<FiveYearScheduleFacts>
  readonly taxYear: number
  readonly remainingInterest: number
}): FiveYearScheduleResult {
  const { facts, taxYear, remainingInterest } = input
  if (facts.beneficiaryClassification === 'unknownTrustOrEntity') {
    return { status: 'refusal', reason: 'unknownTrustOrEntityClassification' }
  }
  if (facts.beneficiaryClassification !== 'nonDesignatedConfirmed') {
    return { status: 'notThisPathway', reason: 'notConfirmedNonDesignated' }
  }
  if (facts.deathBeforeRequiredBeginningDate === 'unknown') {
    return { status: 'refusal', reason: 'unknownDeathBeforeRbd' }
  }
  if (facts.deathBeforeRequiredBeginningDate !== true) {
    return { status: 'notThisPathway', reason: 'postRbdUsesSeparateRules' }
  }
  if (!Number.isFinite(remainingInterest) || remainingInterest < 0) {
    return { status: 'refusal', reason: 'invalidRemainingInterest' }
  }

  const evidenceRefusal = deathDateEvidenceRefusal(facts)
  if (evidenceRefusal !== undefined) {
    return { status: 'refusal', reason: evidenceRefusal }
  }

  if (taxYear < facts.ownerDeathYear) {
    return { status: 'refusal', reason: 'taxYearBeforeOwnerDeathYear' }
  }

  const deadlineYear = facts.ownerDeathYear + 5
  if (taxYear <= facts.ownerDeathYear) {
    return {
      status: 'supported',
      deadlineYear,
      requiredMinimumForTaxYear: 0,
    }
  }
  if (taxYear < deadlineYear) {
    return {
      status: 'supported',
      deadlineYear,
      requiredMinimumForTaxYear: 0,
    }
  }
  if (taxYear === deadlineYear) {
    return {
      status: 'supported',
      deadlineYear,
      requiredMinimumForTaxYear: remainingInterest,
    }
  }
  // After deadline: subsection (e) remaining-benefit rule owns the year.
  return {
    status: 'notThisPathway',
    reason: 'postDeadlineRemainingBenefitPathway',
  }
}

export interface PostDeadlineRemainingBenefitInput {
  readonly deadlineYear: number
  readonly taxYear: number
  /**
   * Known remaining account benefit at the start of `taxYear` before that
   * year's distributions (opening measurement). Unknown fails closed. Must
   * not already subtract the current year's qualifying distributions.
   */
  readonly remainingBenefitBeforeCurrentYearDistributions: KnownOrUnknownNumber
  /** Qualifying distributions during `taxYear` toward the remaining-benefit RMD. */
  readonly qualifyingDistributionsThisYear: KnownOrUnknownNumber
}

export type PostDeadlineRemainingBenefitResult =
  | {
      readonly status: 'notApplicable'
      readonly entireRemainingBenefitRequired: false
      readonly requiredAmount: 0
      readonly distributedByDeadline: 0
      readonly shortfall: 0
    }
  | {
      readonly status: 'unknownHistory'
      readonly entireRemainingBenefitRequired: true
      readonly requiredAmount: null
      readonly distributedByDeadline: null
      readonly shortfall: null
    }
  | {
      readonly status: 'invalidHistory'
      readonly reason: 'negativeOrNonfiniteHistory'
      readonly entireRemainingBenefitRequired: true
      readonly requiredAmount: null
      readonly distributedByDeadline: null
      readonly shortfall: null
    }
  | {
      readonly status: 'obligation'
      readonly entireRemainingBenefitRequired: true
      readonly requiredAmount: number
      readonly distributedByDeadline: number
      readonly shortfall: number
    }

/**
 * After the calendar year in which the entire remaining benefit was required to
 * be distributed, each subsequent year's RMD is the entire remaining benefit —
 * not a repeated levy on the original deadline balance, and not a 100% excise.
 *
 * Returns only the distribution obligation. Feed `requiredAmount` /
 * `distributedByDeadline` into `computeRmdShortfallExcise` with complete
 * correction/filing/waiver facts for 25%/10%/waiver results.
 */
export function postDeadlineRemainingBenefitObligation(
  input: Readonly<PostDeadlineRemainingBenefitInput>,
): PostDeadlineRemainingBenefitResult {
  if (input.taxYear <= input.deadlineYear) {
    return {
      status: 'notApplicable',
      entireRemainingBenefitRequired: false,
      requiredAmount: 0,
      distributedByDeadline: 0,
      shortfall: 0,
    }
  }

  if (
    input.remainingBenefitBeforeCurrentYearDistributions === 'unknown' ||
    input.qualifyingDistributionsThisYear === 'unknown'
  ) {
    return {
      status: 'unknownHistory',
      entireRemainingBenefitRequired: true,
      requiredAmount: null,
      distributedByDeadline: null,
      shortfall: null,
    }
  }

  const remaining = input.remainingBenefitBeforeCurrentYearDistributions
  const distributed = input.qualifyingDistributionsThisYear
  if (
    !Number.isFinite(remaining) ||
    !Number.isFinite(distributed) ||
    remaining < 0 ||
    distributed < 0
  ) {
    return {
      status: 'invalidHistory',
      reason: 'negativeOrNonfiniteHistory',
      entireRemainingBenefitRequired: true,
      requiredAmount: null,
      distributedByDeadline: null,
      shortfall: null,
    }
  }

  const requiredAmount = remaining
  const distributedByDeadline = distributed
  const shortfall = Math.max(0, requiredAmount - distributedByDeadline)

  return {
    status: 'obligation',
    entireRemainingBenefitRequired: true,
    requiredAmount,
    distributedByDeadline,
    shortfall,
  }
}
