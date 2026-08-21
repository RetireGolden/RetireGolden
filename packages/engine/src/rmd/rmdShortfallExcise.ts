/**
 * IRC §4974 excise tax on a required-minimum-distribution shortfall.
 *
 * This module prices the tax only. A corrective distribution is a separate
 * account movement with its own income character in the year received; the
 * evidence accepted here cannot create cash, income, MAGI, or an RMD payment.
 */

export const RMD_SHORTFALL_DEFAULT_RATE = 0.25
export const RMD_SHORTFALL_CORRECTED_RATE = 0.10
export const RMD_SHORTFALL_PRE_SECURE_2_RATE = 0.50

/** The plan or legally aggregable plan group to which an RMD belongs. */
export type RmdApplicablePlan =
  | Readonly<{
      kind: 'ownedTraditionalIras'
      payeePersonId: string
    }>
  | Readonly<{
      kind: 'employerPlan'
      accountId: string
    }>
  | Readonly<{
      kind: 'aggregable403bPlans'
      payeePersonId: string
    }>
  | Readonly<{
      kind: 'inheritedIras'
      payeePersonId: string
      /** Explicit identity proving that this beneficiary's IRAs share a decedent. */
      decedentId: string
      /** Traditional and Roth inherited IRAs are separate aggregation pools. */
      iraType: 'traditional' | 'roth'
    }>
  | Readonly<{
      /** Account-only fallback when no decedent identity was supplied. */
      kind: 'inheritedIraAccount'
      payeePersonId: string
      accountId: string
    }>
  | Readonly<{
      /** An inherited employer plan remains particular to that plan. */
      kind: 'inheritedEmployerPlan'
      payeePersonId: string
      accountId: string
    }>

export type RmdShortfallRequirementKind =
  | 'ownedAnnual'
  | 'inheritedAnnualLifeExpectancy'
  | 'inheritedYearOfDeath'
  | 'inheritedFinalSweep'
  | 'inheritedLegacy'
  | 'mixedInheritedRequirements'

export interface RmdShortfallObligation {
  readonly obligationId: string
  /** Calendar year whose §401(a)(9) amount this is. */
  readonly distributionCalendarYear: number
  /** Tax year in which §4974 is imposed; the RBD year for an April 1 miss. */
  readonly taxYear: number
  /** The statutory deadline and the first day of the correction window. */
  readonly taxImposedOn: string
  readonly applicablePlan: RmdApplicablePlan
  /** The §401(a)(9) requirement that produced this obligation. */
  readonly requirementKind: RmdShortfallRequirementKind
  readonly requiredAmount: number
  readonly distributedByDeadline: number
}

export interface RmdCorrectiveDistributionElection {
  readonly amount: number
  readonly receivedOn: string
  readonly sourceApplicablePlan: RmdApplicablePlan
  readonly form5329FiledOn: string
  /** Filing a return is insufficient unless that return reflects the reduced §4974 tax. */
  readonly returnReflectsReducedTax: boolean
  /** IRC §4974(e)(2)(A), when one was mailed. */
  readonly noticeOfDeficiencyMailedOn?: string
  /** IRC §4974(e)(2)(B), when the tax was assessed. */
  readonly assessedOn?: string
}

export type RmdDiscretionaryWaiverStatus =
  | 'none'
  | 'requested'
  | 'denied'
  | 'granted'

export type RmdAutomaticWaiverEvidence =
  | Readonly<{
      kind: 'edbTenYearElection'
      ownerDeathYear: number
      electionMadeOn: string
      ownerDiedBeforeRequiredBeginningDate: boolean
      eligibleDesignatedBeneficiary: boolean
      defaultLifeExpectancyApplied: boolean
      affirmativeLifeExpectancyElectionMade: boolean
      commissionerDeterminedOtherwise?: boolean
    }>
  | Readonly<{
      kind: 'yearOfDeath'
      ownerDeathYear: number
      beneficiaryReturnDueDateIncludingExtensions: string
      correctiveDistribution: Readonly<{
        amount: number
        receivedOn: string
        sourceApplicablePlan: RmdApplicablePlan
      }>
      commissionerDeterminedOtherwise?: boolean
    }>

export interface RmdShortfallReliefElection {
  readonly obligationId: string
  readonly correctiveDistribution?: RmdCorrectiveDistributionElection
  readonly discretionaryWaiver?: RmdDiscretionaryWaiverStatus
  readonly automaticWaiver?: RmdAutomaticWaiverEvidence
}

export type RmdShortfallExciseReason =
  | 'noShortfall'
  | 'preSecure2Default50Percent'
  | 'default25Percent'
  | 'corrected10Percent'
  | 'discretionaryWaiverGranted'
  | 'automaticEdbTenYearElectionWaiver'
  | 'automaticYearOfDeathWaiver'

export interface RmdShortfallExciseResult {
  readonly obligationId: string
  readonly distributionCalendarYear: number
  readonly taxYear: number
  readonly requiredAmount: number
  readonly distributedByDeadline: number
  readonly shortfall: number
  readonly rate: number
  readonly tax: number
  readonly reason: RmdShortfallExciseReason
}

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/u

function isCivilIsoDate(value: string): boolean {
  const match = ISO_DATE.exec(value)
  if (match === null) return false
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  const date = new Date(Date.UTC(year, month - 1, day))
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
}

function earlierDate(left: string, right: string): string {
  return left <= right ? left : right
}

function laterDate(left: string, right: string): string {
  return left >= right ? left : right
}

/** Stable public key for one applicable plan or legally aggregable group. */
export function rmdApplicablePlanKey(applicablePlan: RmdApplicablePlan): string {
  switch (applicablePlan.kind) {
    case 'ownedTraditionalIras':
      return JSON.stringify(['owned-iras', applicablePlan.payeePersonId])
    case 'employerPlan':
      return JSON.stringify(['employer-plan', applicablePlan.accountId])
    case 'aggregable403bPlans':
      return JSON.stringify(['403b-group', applicablePlan.payeePersonId])
    case 'inheritedIras':
      return JSON.stringify([
        'inherited-iras',
        applicablePlan.payeePersonId,
        applicablePlan.decedentId,
        applicablePlan.iraType,
      ])
    case 'inheritedIraAccount':
      return JSON.stringify([
        'inherited-ira-account',
        applicablePlan.payeePersonId,
        applicablePlan.accountId,
      ])
    case 'inheritedEmployerPlan':
      return JSON.stringify([
        'inherited-employer-plan',
        applicablePlan.payeePersonId,
        applicablePlan.accountId,
      ])
  }
}

/** Stable public identifier for one distribution-year obligation. */
export function rmdShortfallObligationId(
  applicablePlan: RmdApplicablePlan,
  distributionCalendarYear: number,
  taxYear: number = distributionCalendarYear,
): string {
  return `rmd-shortfall:${rmdApplicablePlanKey(applicablePlan)}:${distributionCalendarYear}:tax-${taxYear}`
}

export function sameRmdApplicablePlan(
  left: RmdApplicablePlan,
  right: RmdApplicablePlan,
): boolean {
  return rmdApplicablePlanKey(left) === rmdApplicablePlanKey(right)
}

/**
 * IRC §4974(e)(2): earliest of NOD mailing, assessment, or the end of the
 * second taxable year beginning after the tax year. Invalid optional dates
 * fail closed by returning `null`.
 */
export function rmdCorrectionWindowEnd(
  taxYear: number,
  correction: Pick<
    RmdCorrectiveDistributionElection,
    'noticeOfDeficiencyMailedOn' | 'assessedOn'
  >,
): string | null {
  let end = `${taxYear + 2}-12-31`
  for (const candidate of [
    correction.noticeOfDeficiencyMailedOn,
    correction.assessedOn,
  ]) {
    if (candidate === undefined) continue
    if (!isCivilIsoDate(candidate)) return null
    end = earlierDate(end, candidate)
  }
  return end
}

function correctedRateApplies(
  obligation: RmdShortfallObligation,
  shortfall: number,
  correction: RmdCorrectiveDistributionElection | undefined,
): boolean {
  // SECURE 2.0 §302 made the 10-percent corrected rate available only for
  // taxable years beginning after December 29, 2022. Historical projections
  // retain the former 50-percent default even when handed modern correction
  // evidence.
  if (obligation.taxYear < 2023) return false
  if (correction === undefined) return false
  if (!Number.isFinite(correction.amount) || !(correction.amount >= shortfall)) return false
  if (!sameRmdApplicablePlan(obligation.applicablePlan, correction.sourceApplicablePlan)) return false
  if (correction.returnReflectsReducedTax !== true) return false
  if (!isCivilIsoDate(obligation.taxImposedOn) ||
      !isCivilIsoDate(correction.receivedOn) ||
      !isCivilIsoDate(correction.form5329FiledOn)) return false
  const windowEnd = rmdCorrectionWindowEnd(obligation.taxYear, correction)
  if (windowEnd === null || windowEnd < obligation.taxImposedOn) return false
  return correction.receivedOn >= obligation.taxImposedOn &&
    correction.receivedOn <= windowEnd &&
    correction.form5329FiledOn >= obligation.taxImposedOn &&
    correction.form5329FiledOn <= windowEnd
}

function automaticWaiverReason(
  obligation: RmdShortfallObligation,
  shortfall: number,
  evidence: RmdAutomaticWaiverEvidence | undefined,
): Extract<
  RmdShortfallExciseReason,
  'automaticEdbTenYearElectionWaiver' | 'automaticYearOfDeathWaiver'
> | null {
  if (evidence === undefined || evidence.commissionerDeterminedOtherwise === true) return null
  // Treas. Reg. §54.4974-1(h) applies the final regulation's two automatic
  // waivers only to taxable years beginning on or after January 1, 2025.
  if (obligation.taxYear < 2025) return null
  if (
    obligation.applicablePlan.kind !== 'inheritedIras' &&
    obligation.applicablePlan.kind !== 'inheritedIraAccount' &&
    obligation.applicablePlan.kind !== 'inheritedEmployerPlan'
  ) return null
  if (evidence.kind === 'edbTenYearElection') {
    if (!isCivilIsoDate(evidence.electionMadeOn)) return null
    const electionYear = Number(evidence.electionMadeOn.slice(0, 4))
    const electionWindowStart = `${evidence.ownerDeathYear}-01-01`
    const deadline = `${evidence.ownerDeathYear + 9}-12-31`
    if (obligation.requirementKind !== 'inheritedAnnualLifeExpectancy' ||
        obligation.taxYear >= electionYear ||
        evidence.ownerDiedBeforeRequiredBeginningDate !== true ||
        evidence.eligibleDesignatedBeneficiary !== true ||
        evidence.defaultLifeExpectancyApplied !== true ||
        evidence.affirmativeLifeExpectancyElectionMade === true ||
        evidence.electionMadeOn < electionWindowStart ||
        evidence.electionMadeOn > deadline) return null
    return 'automaticEdbTenYearElectionWaiver'
  }

  const correction = evidence.correctiveDistribution
  if (!isCivilIsoDate(evidence.beneficiaryReturnDueDateIncludingExtensions) ||
      !isCivilIsoDate(correction.receivedOn) ||
      obligation.requirementKind !== 'inheritedYearOfDeath' ||
      evidence.ownerDeathYear !== obligation.distributionCalendarYear ||
      !Number.isFinite(correction.amount) ||
      correction.amount < shortfall ||
      !sameRmdApplicablePlan(obligation.applicablePlan, correction.sourceApplicablePlan)) return null
  const followingYearEnd = `${evidence.ownerDeathYear + 1}-12-31`
  const deadline = laterDate(
    evidence.beneficiaryReturnDueDateIncludingExtensions,
    followingYearEnd,
  )
  return correction.receivedOn <= deadline
    ? 'automaticYearOfDeathWaiver'
    : null
}

/** Price one §4974 obligation without changing income or account balances. */
export function computeRmdShortfallExcise(
  obligation: RmdShortfallObligation,
  relief?: RmdShortfallReliefElection,
): RmdShortfallExciseResult {
  const requiredAmount = Math.max(0, obligation.requiredAmount)
  const distributedByDeadline = Math.max(0, obligation.distributedByDeadline)
  const shortfall = Math.max(0, requiredAmount - distributedByDeadline)

  let rate = 0
  let reason: RmdShortfallExciseReason = 'noShortfall'
  if (shortfall > 0) {
    const matchingRelief = relief?.obligationId === obligation.obligationId
      ? relief
      : undefined
    const waiverReason = automaticWaiverReason(
      obligation,
      shortfall,
      matchingRelief?.automaticWaiver,
    )
    if (matchingRelief?.discretionaryWaiver === 'granted') {
      reason = 'discretionaryWaiverGranted'
    } else if (waiverReason !== null) {
      reason = waiverReason
    } else if (correctedRateApplies(
      obligation,
      shortfall,
      matchingRelief?.correctiveDistribution,
    )) {
      rate = RMD_SHORTFALL_CORRECTED_RATE
      reason = 'corrected10Percent'
    } else if (obligation.taxYear < 2023) {
      rate = RMD_SHORTFALL_PRE_SECURE_2_RATE
      reason = 'preSecure2Default50Percent'
    } else {
      rate = RMD_SHORTFALL_DEFAULT_RATE
      reason = 'default25Percent'
    }
  }

  return {
    obligationId: obligation.obligationId,
    distributionCalendarYear: obligation.distributionCalendarYear,
    taxYear: obligation.taxYear,
    requiredAmount,
    distributedByDeadline,
    shortfall,
    rate,
    tax: shortfall * rate,
    reason,
  }
}
