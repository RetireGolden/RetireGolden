import { parseCivilIsoDate } from './civilDate.js'
import type { PersonId } from './identity.js'
import { usdCentsSchema, type UsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'

/**
 * Treas. Reg. 1.408-8(c) — whether a surviving-spouse beneficiary has become the
 * IRA owner, by election or by operation of the deemed-election rules.
 *
 * This exists because IRC 408(d)(3)(C)(ii) excludes the surviving spouse from
 * the definition of an inherited IRA by name. Every other module in the
 * beneficiary chain is written for a beneficiary the statute *does* treat as
 * holding an inherited account, and applies beneficiary treatment
 * unconditionally: a zero section 72(t) rate, a basis pool keyed to
 * (beneficiary, decedent), and Form 8606 line 8 pinned to zero. For a surviving
 * spouse who has become the owner, all three are wrong.
 *
 * The deemed election under 1.408-8(c)(2) is the sharp edge. It is not an act
 * the spouse takes; it happens *to* them when a beneficiary RMD for a year
 * following the year of death goes undistributed. So a plan that simply fails
 * to distribute crosses into owner treatment silently, and the following year's
 * distributions carry the additional tax the beneficiary path reports as zero.
 */

/** Whether the beneficiary is the decedent's surviving spouse. */
export type BeneficiarySpousalRelationship =
  | 'survivingSpouse'
  | 'notSurvivingSpouse'

/** What caused owner treatment to begin. */
export type SpousalElectionTrigger =
  /** 1.408-8(c)(1) — the spouse affirmatively elected. */
  | 'affirmativeElection'
  /** 1.408-8(c)(2)(i) — a post-death-year beneficiary RMD went undistributed. */
  | 'undistributedRequiredAmount'
  /** 1.408-8(c)(2)(ii) — a non-rollover contribution was made to the IRA. */
  | 'contributionMade'

/**
 * One calendar year of the beneficiary required-distribution record, for a year
 * strictly after the year of death. The year of death is excluded because
 * 1.408-8(c)(2)(i) reaches only an amount required to be distributed "for a
 * calendar year following the calendar year of the IRA owner's death".
 */
export interface BeneficiaryRequiredDistributionYear {
  readonly taxYear: number
  readonly requiredAmount: UsdCents
  readonly distributedAmount: UsdCents
}

export interface EvaluateBeneficiarySpousalElectionInput {
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly relationship: BeneficiarySpousalRelationship
  readonly deathDate: string
  /** The year whose treatment is being resolved. */
  readonly taxYear: number
  /**
   * Consecutive years from deathYear + 1 through taxYear. A gap is refused
   * rather than assumed satisfied: an unobserved year is exactly the year a
   * deemed election would have occurred in.
   */
  readonly requiredDistributionHistory:
    readonly Readonly<BeneficiaryRequiredDistributionYear>[]
  /** Years in which a non-rollover contribution was made to the IRA. */
  readonly contributionYears: readonly number[]
  /** Year of an affirmative 1.408-8(c)(1) election, when one was made. */
  readonly affirmativeElectionYear: number | null
}

export type EvaluateBeneficiarySpousalElectionResult =
  /**
   * The beneficiary is not the surviving spouse, so 1.408-8(c) never applies
   * and beneficiary treatment is correct for every year.
   */
  | {
    readonly status: 'spousalElectionNotApplicable'
    readonly relationship: 'notSurvivingSpouse'
    readonly evidenceId: string
  }
  /**
   * Surviving spouse who has not become the owner as of `taxYear`. Beneficiary
   * treatment is correct, but only for this year — the answer can change.
   */
  | {
    readonly status: 'spousalOwnerTreatmentNotBegun'
    readonly evaluatedThroughTaxYear: number
    readonly evidenceId: string
  }
  /**
   * Owner treatment has begun. Per 1.408-8(c)(3) the spouse is the IRA owner
   * "for all purposes under the Internal Revenue Code (including section
   * 72(t))", so the beneficiary chain must not characterize this year.
   */
  | {
    readonly status: 'spousalOwnerTreatmentBegun'
    readonly trigger: SpousalElectionTrigger
    readonly effectiveTaxYear: number
    readonly evidenceId: string
  }
  /** Fail-closed arms. */
  | { readonly status: 'spousalElectionEvidenceIncomplete'; readonly missingTaxYear: number }
  | { readonly status: 'spousalElectionEvidenceInconsistent'; readonly reason: string }

function inconsistent(reason: string): EvaluateBeneficiarySpousalElectionResult {
  return { status: 'spousalElectionEvidenceInconsistent', reason }
}

/**
 * Resolves whether the beneficiary chain may characterize `taxYear`, or whether
 * owner treatment has begun and the owned-IRA path owns the year instead.
 */
export function evaluateBeneficiarySpousalElection(
  input: Readonly<EvaluateBeneficiarySpousalElectionInput>,
): EvaluateBeneficiarySpousalElectionResult {
  const death = parseCivilIsoDate(input.deathDate)
  if (death === null) return inconsistent('deathDate is not a civil ISO date')
  if (!Number.isSafeInteger(input.taxYear)) return inconsistent('taxYear is not an integer')
  if (input.taxYear < death.year) return inconsistent('taxYear precedes the year of death')

  if (input.relationship === 'notSurvivingSpouse') {
    if (input.affirmativeElectionYear !== null) {
      return inconsistent('a non-spouse beneficiary cannot elect owner treatment')
    }
    return {
      status: 'spousalElectionNotApplicable',
      relationship: 'notSurvivingSpouse',
      evidenceId: deriveActionStructuralId('beneficiarySpousalElection', [
        'spousalElectionNotApplicable',
        input.beneficiaryPersonId,
        input.decedentPersonId,
        input.deathDate,
        input.taxYear,
        null,
        null,
      ]),
    }
  }

  if (input.beneficiaryPersonId === input.decedentPersonId) {
    return inconsistent('beneficiary and decedent are the same person')
  }

  // 1.408-8(c)(2)(i) reaches only years after the year of death, so that is the
  // first year the history must cover.
  const firstObservedYear = death.year + 1
  const byYear = new Map<number, Readonly<BeneficiaryRequiredDistributionYear>>()
  for (const entry of input.requiredDistributionHistory) {
    if (!Number.isSafeInteger(entry.taxYear)) return inconsistent('history year is not an integer')
    if (entry.taxYear < firstObservedYear) {
      return inconsistent('history covers a year at or before the year of death')
    }
    if (entry.taxYear > input.taxYear) return inconsistent('history covers a year after taxYear')
    if (byYear.has(entry.taxYear)) return inconsistent('history repeats a year')
    if (usdCentsSchema.safeParse(entry.requiredAmount).success !== true) {
      return inconsistent('history requiredAmount is not usd cents')
    }
    if (usdCentsSchema.safeParse(entry.distributedAmount).success !== true) {
      return inconsistent('history distributedAmount is not usd cents')
    }
    byYear.set(entry.taxYear, entry)
  }

  const candidates: { year: number; trigger: SpousalElectionTrigger }[] = []
  if (input.affirmativeElectionYear !== null) {
    if (input.affirmativeElectionYear < death.year) {
      return inconsistent('affirmative election precedes the year of death')
    }
    candidates.push({ year: input.affirmativeElectionYear, trigger: 'affirmativeElection' })
  }
  for (const year of input.contributionYears) {
    if (!Number.isSafeInteger(year)) return inconsistent('contribution year is not an integer')
    if (year < death.year) return inconsistent('contribution precedes the year of death')
    candidates.push({ year, trigger: 'contributionMade' })
  }

  for (let year = firstObservedYear; year <= input.taxYear; year += 1) {
    const entry = byYear.get(year)
    if (entry === undefined) {
      return { status: 'spousalElectionEvidenceIncomplete', missingTaxYear: year }
    }
    if (entry.distributedAmount < entry.requiredAmount) {
      candidates.push({ year, trigger: 'undistributedRequiredAmount' })
    }
  }

  // The earliest trigger governs: once owner treatment begins it does not lapse,
  // so a later trigger cannot restate its effective year.
  let earliest: { year: number; trigger: SpousalElectionTrigger } | null = null
  for (const candidate of candidates) {
    if (candidate.year > input.taxYear) continue
    if (earliest === null || candidate.year < earliest.year) earliest = candidate
  }

  if (earliest === null) {
    return {
      status: 'spousalOwnerTreatmentNotBegun',
      evaluatedThroughTaxYear: input.taxYear,
      evidenceId: deriveActionStructuralId('beneficiarySpousalElection', [
        'spousalOwnerTreatmentNotBegun',
        input.beneficiaryPersonId,
        input.decedentPersonId,
        input.deathDate,
        input.taxYear,
        null,
        null,
      ]),
    }
  }

  return {
    status: 'spousalOwnerTreatmentBegun',
    trigger: earliest.trigger,
    effectiveTaxYear: earliest.year,
    evidenceId: deriveActionStructuralId('beneficiarySpousalElection', [
        'spousalOwnerTreatmentBegun',
        input.beneficiaryPersonId,
        input.decedentPersonId,
        input.deathDate,
        input.taxYear,
        earliest.trigger,
        earliest.year,
      ]),
  }
}
