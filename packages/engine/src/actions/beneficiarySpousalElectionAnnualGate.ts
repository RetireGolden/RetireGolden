/**

 * Treas. Reg. 1.408-8(c) annual gate for a surviving-spouse beneficiary.

 *

 * Observed history is deliberately date-qualified.  A projection recommendation

 * or a current-year event that has not happened cannot become opening evidence.

 */

import { parseCivilIsoDate } from './civilDate.js'

import {

  evaluateBeneficiarySpousalElection,

  type BeneficiaryRequiredDistributionYear,

  type BeneficiarySpousalRelationship,

  type EvaluateBeneficiarySpousalElectionResult,

} from './beneficiarySpousalElectionStatus.js'

import type { PersonId } from './identity.js'

import type { UsdCents } from './money.js'

import { packForYear, uniformLifetimeDivisor } from '../params/index.js'



export type VerifiedTriState = 'verifiedYes' | 'verifiedNo' | 'unknown'

export type SpousalElectionDeterminationStage = 'openingOfTaxYear' | 'endOfTaxYear'



export interface ObservedBeneficiaryRequiredDistributionYear

  extends BeneficiaryRequiredDistributionYear {

  /** Statutory deadline for this year's beneficiary amount. */

  readonly legalDeadline: string

  /** Custodian/administrator records are complete through this date. */

  readonly observedThrough: string

  readonly provenance: string

}



export interface ExecutedSpousalElectionEvent {

  readonly executedOn: string

  readonly provenance: string

}



/**

 * The final regulation supplies the catch-up formula.  The 2024 proposed

 * example is used only as a worked illustration of that final recurrence;

 * it is not represented here as final regulatory text.

 */

export type Section402c2j4Determination =

  | {

      readonly status: 'notApplicable'

      readonly reason: 'notTenYearRule' | 'beforeSpouseApplicableAge' | 'beneficiaryDestination'

      readonly factsAsOfDate: string

      readonly provenance: string

    }

  | {

      readonly status: 'notApplicableToOwnedRoth'

      readonly factsAsOfDate: string

      readonly provenance: string

    }

  | {

      readonly status: 'applicable'

      readonly distributionTaxYear: number

      /** §1.402(c)-2(j)(4)(ii)'s calculated non-rollover RMD amount. */

      readonly amountTreatedAsCurrentDistributionRmd: UsdCents

      /** Actual current-year distributions before the election/redesignation. */

      readonly amountActuallyDistributed: UsdCents

      readonly remainingToDistributeBeforeElection: UsdCents

      readonly factsAsOfDate: string

      readonly provenance: string

    }

  | {

      readonly status: 'incomplete'

      readonly reason:

        | 'unknownDistributionMethod'

        | 'invalidBirthDateOrApplicableAge'

        | 'missingCurrentYearReferenceBalance'

        | 'missingPriorYearActualDistribution'

        | 'invalidInput'

    }



/** Inputs to the §1.402(c)-2(j)(4) single-reference-balance recurrence. */

export interface Section402c2j4CatchUpInput {

  readonly accountType: 'traditional' | 'roth'

  /** An affirmative redesignation uses §1.408-8(c)(1)(iii)'s counterfactual. */

  readonly transaction: 'actualOwnPlanRollover' | 'affirmativeTreatAsOwnElection' | 'beneficiaryDestinationRollover'

  readonly preElectionDistributionMethod: 'tenYearRule' | 'lifeExpectancyRule' | 'unknown'

  readonly spouseBirthDate: string

  readonly decedentBirthDate: string

  readonly distributionYear: number

  /** IRA prior-Dec.-31 balance otherwise used for the current-year RMD. */

  readonly currentYearRmdReferenceBalance: UsdCents | 'unknown'

  /** Actual distributions for every prior catch-up year, never shortfall rows. */

  readonly actualPriorYearDistributions: ReadonlyMap<number, UsdCents>

  readonly actualPreElectionDistributionsCurrentYear: UsdCents

  /** Required for an actual rollover; an affirmative election need not invent one. */

  readonly currentDistributionOrRemainingInterest: UsdCents

  readonly factsAsOfDate: string

  readonly provenance: string

}



function compareDate(left: string, right: string): number | null {

  const a = parseCivilIsoDate(left)

  const b = parseCivilIsoDate(right)

  if (a === null || b === null) return null

  const av = a.year * 10_000 + a.month * 100 + a.day

  const bv = b.year * 10_000 + b.month * 100 + b.day

  return av === bv ? 0 : av < bv ? -1 : 1

}



function applicableAgeAttainmentYear(birthDate: string): number | null {

  const birth = parseCivilIsoDate(birthDate)

  if (birth === null) return null

  if (birth.year === 1959) return null // current-law applicable age remains contested.

  if (

    birth.year < 1949 ||

    (birth.year === 1949 && (birth.month < 7))

  ) return birth.year + (birth.month <= 6 ? 70 : 71)

  if (birth.year <= 1950) return birth.year + 72

  if (birth.year <= 1958) return birth.year + 73

  return birth.year + 75

}



function spouseAgeInYear(spouseBirthDate: string, year: number): number | null {

  const birth = parseCivilIsoDate(spouseBirthDate)

  return birth === null ? null : year - birth.year

}



function isNonnegativeCents(value: unknown): value is UsdCents {

  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0

}



/** Round every hypothetical annual RMD to cents before it enters the next deficit. */

function divideCentsRoundToCent(balance: UsdCents, divisor: number): UsdCents {

  return Math.round(balance / divisor) as UsdCents

}



/**

 * Computes §1.402(c)-2(j)(4)(ii)-(v) from one current-year RMD reference

 * balance.  This does not accept prior year-end balances or caller-supplied

 * hypotheticals: those would bypass the regulatory adjusted-balance recurrence.

 */

export function determineSection402c2j4CatchUp(

  input: Readonly<Section402c2j4CatchUpInput>,

): Section402c2j4Determination {

  const evidenceIsValid =

    parseCivilIsoDate(input.factsAsOfDate) !== null && input.provenance.trim().length > 0

  if (

    !Number.isSafeInteger(input.distributionYear) || !evidenceIsValid ||

    !isNonnegativeCents(input.actualPreElectionDistributionsCurrentYear) ||

    !isNonnegativeCents(input.currentDistributionOrRemainingInterest)

  ) return { status: 'incomplete', reason: 'invalidInput' }

  if (input.preElectionDistributionMethod === 'unknown') {

    return { status: 'incomplete', reason: 'unknownDistributionMethod' }

  }

  if (input.preElectionDistributionMethod !== 'tenYearRule') {

    return { status: 'notApplicable', reason: 'notTenYearRule', factsAsOfDate: input.factsAsOfDate, provenance: input.provenance }

  }

  if (input.transaction === 'beneficiaryDestinationRollover') {

    return { status: 'notApplicable', reason: 'beneficiaryDestination', factsAsOfDate: input.factsAsOfDate, provenance: input.provenance }

  }

  if (input.accountType === 'roth') {

    return { status: 'notApplicableToOwnedRoth', factsAsOfDate: input.factsAsOfDate, provenance: input.provenance }

  }

  if (input.transaction === 'actualOwnPlanRollover' && input.currentDistributionOrRemainingInterest === 0) {

    return { status: 'incomplete', reason: 'invalidInput' }

  }

  if (input.currentYearRmdReferenceBalance === 'unknown') {

    return { status: 'incomplete', reason: 'missingCurrentYearReferenceBalance' }

  }

  if (!isNonnegativeCents(input.currentYearRmdReferenceBalance)) {

    return { status: 'incomplete', reason: 'missingCurrentYearReferenceBalance' }

  }



  const spouseApplicableYear = applicableAgeAttainmentYear(input.spouseBirthDate)

  const decedentApplicableYear = applicableAgeAttainmentYear(input.decedentBirthDate)

  if (spouseApplicableYear === null || decedentApplicableYear === null) {

    return { status: 'incomplete', reason: 'invalidBirthDateOrApplicableAge' }

  }

  if (input.distributionYear < spouseApplicableYear) {

    return { status: 'notApplicable', reason: 'beforeSpouseApplicableAge', factsAsOfDate: input.factsAsOfDate, provenance: input.provenance }

  }



  const firstApplicableYear = Math.max(spouseApplicableYear, decedentApplicableYear)

  let hypotheticalTotal = 0

  let priorActualTotal = 0

  for (let year = firstApplicableYear; year <= input.distributionYear; year += 1) {

    const age = spouseAgeInYear(input.spouseBirthDate, year)

    const divisor = age === null ? undefined : uniformLifetimeDivisor(packForYear(year).pack, age)

    if (divisor === undefined || !Number.isFinite(divisor) || divisor <= 0) {

      return { status: 'incomplete', reason: 'invalidBirthDateOrApplicableAge' }

    }

    const priorDeficit = Math.max(0, hypotheticalTotal - priorActualTotal)

    const adjustedBalance = Math.max(0, input.currentYearRmdReferenceBalance - priorDeficit) as UsdCents

    hypotheticalTotal += divideCentsRoundToCent(adjustedBalance, divisor)

    if (year < input.distributionYear) {

      const actual = input.actualPriorYearDistributions.get(year)

      if (!isNonnegativeCents(actual)) {

        return { status: 'incomplete', reason: 'missingPriorYearActualDistribution' }

      }

      priorActualTotal += actual

    }

  }

  const required = Math.max(0, hypotheticalTotal - priorActualTotal) as UsdCents

  return {

    status: 'applicable', distributionTaxYear: input.distributionYear,

    amountTreatedAsCurrentDistributionRmd: required,

    amountActuallyDistributed: input.actualPreElectionDistributionsCurrentYear,

    remainingToDistributeBeforeElection: Math.max(0, required - input.actualPreElectionDistributionsCurrentYear) as UsdCents,

    factsAsOfDate: input.factsAsOfDate, provenance: input.provenance,

  }

}



export interface BeneficiaryElectionFactsForGate {

  readonly soleBeneficiaryStatus: 'verifiedSole' | 'verifiedNotSole' | 'unknown'

  readonly unlimitedWithdrawalRight: VerifiedTriState

  readonly beneficiaryIsDirectSpouseNamedOnIra: VerifiedTriState

  readonly affirmativeRedesignation: Readonly<ExecutedSpousalElectionEvent> | null

  readonly nonRolloverContributions: readonly Readonly<ExecutedSpousalElectionEvent>[]

  readonly postDeathRequiredDistributionHistory: readonly Readonly<ObservedBeneficiaryRequiredDistributionYear>[]

  readonly factsAsOfDate: string

  readonly factsProvenance: string

  readonly section402c2j4: Readonly<Section402c2j4Determination>

}



/** Committed projection results, never custodian-observed facts or proposals. */

export interface SpousalElectionSimulationContext {

  readonly simulationId: string

  readonly committedThroughTaxYear: number

  readonly requiredDistributionHistory: readonly Readonly<BeneficiaryRequiredDistributionYear & {

    legalDeadline: string

    commitId: string

  }>[]

  readonly affirmativeRedesignation?: Readonly<{ executedOn: string; commitId: string }>

  readonly nonRolloverContributions: readonly Readonly<{ executedOn: string; commitId: string }>[]

  readonly section402c2j4?: Readonly<Section402c2j4Determination>

}



export interface GateBeneficiarySpousalElectionInput {

  readonly beneficiaryPersonId: PersonId

  readonly decedentPersonId: PersonId

  readonly relationship: BeneficiarySpousalRelationship

  readonly deathDate: string

  readonly taxYear: number

  readonly determinationStage: SpousalElectionDeterminationStage

  readonly electionFacts: Readonly<BeneficiaryElectionFactsForGate>

  readonly simulationContext?: Readonly<SpousalElectionSimulationContext>

  readonly deathYearDecedentResidualRmd: UsdCents

}



export type GateBeneficiarySpousalElectionResult =

  | { readonly status: 'spousalElectionNotApplicable'; readonly evaluator: Extract<EvaluateBeneficiarySpousalElectionResult, { status: 'spousalElectionNotApplicable' }>; readonly deathYearDecedentResidualRmdDue: UsdCents }

  | { readonly status: 'eligibilityNotMet'; readonly reason: 'notSoleBeneficiary' | 'noUnlimitedWithdrawalRight' | 'notDirectSpouseNamedOnIra'; readonly deathYearDecedentResidualRmdDue: UsdCents }

  | { readonly status: 'missingFacts'; readonly missing: readonly string[]; readonly deathYearDecedentResidualRmdDue: UsdCents }

  | { readonly status: 'lateElectionCatchUpIncomplete'; readonly requiredAmount: UsdCents; readonly observedDistributedAmount: UsdCents; readonly remainingAmount: UsdCents; readonly deathYearDecedentResidualRmdDue: UsdCents }

  | { readonly status: 'evaluated'; readonly evaluator: EvaluateBeneficiarySpousalElectionResult; readonly deathYearDecedentResidualRmdDue: UsdCents; readonly routeToOwnerTreatment: boolean; readonly evaluationContext: 'observed' | 'simulation'; readonly simulationId?: string }



function stageCutoff(input: Readonly<GateBeneficiarySpousalElectionInput>): string | null {

  if (input.determinationStage === 'openingOfTaxYear') return `${input.taxYear}-01-01`

  if (input.simulationContext !== undefined) return `${input.taxYear}-12-31`

  return parseCivilIsoDate(input.electionFacts.factsAsOfDate) === null ? null : input.electionFacts.factsAsOfDate

}



function occurredBy(event: Readonly<ExecutedSpousalElectionEvent>, cutoff: string): boolean | null {

  if (event.provenance.trim().length === 0) return null

  const comparison = compareDate(event.executedOn, cutoff)

  return comparison === null ? null : comparison <= 0

}



function validObservedHistory(

  rows: readonly Readonly<ObservedBeneficiaryRequiredDistributionYear>[],

  factsAsOfDate: string,

  cutoff: string,

  opening: boolean,

): string | undefined {

  if (parseCivilIsoDate(factsAsOfDate) === null) return 'factsAsOfDate'

  for (const row of rows) {

    const observedAfterDeadline = compareDate(row.observedThrough, row.legalDeadline)

    const observedByFacts = compareDate(row.observedThrough, factsAsOfDate)

    const deadlineByCutoff = compareDate(row.legalDeadline, cutoff)

    const observedByCutoff = compareDate(row.observedThrough, cutoff)

    if (row.provenance.trim().length === 0 || observedAfterDeadline === null || observedByFacts === null || deadlineByCutoff === null || observedByCutoff === null) {

      return `history evidence taxYear ${row.taxYear}`

    }

    if (observedAfterDeadline < 0) return `history observed before legal deadline taxYear ${row.taxYear}`

    if (observedByFacts > 0 || (opening ? deadlineByCutoff >= 0 || observedByCutoff >= 0 : deadlineByCutoff > 0 || observedByCutoff > 0)) {

      return `history chronology taxYear ${row.taxYear}`

    }

  }

  return undefined

}



function valid402c2j4(determination: Readonly<Section402c2j4Determination>, taxYear: number): string | undefined {

  if (determination.status === 'incomplete') return `section402c2j4 ${determination.reason}`

  if (parseCivilIsoDate(determination.factsAsOfDate) === null || determination.provenance.trim().length === 0) return 'section402c2j4 evidence'

  if (determination.status === 'applicable' && determination.distributionTaxYear !== taxYear) return 'section402c2j4 distributionTaxYear'

  return undefined

}



/** Eligibility/timing gate before the beneficiary annual coordinator relies on the evaluator. */

export function gateBeneficiarySpousalElectionForAnnualCoordinator(

  input: Readonly<GateBeneficiarySpousalElectionInput>,

): GateBeneficiarySpousalElectionResult {

  const residual = input.deathYearDecedentResidualRmd

  if (input.relationship === 'notSurvivingSpouse') {

    const evaluator = evaluateBeneficiarySpousalElection({ beneficiaryPersonId: input.beneficiaryPersonId, decedentPersonId: input.decedentPersonId, relationship: 'notSurvivingSpouse', deathDate: input.deathDate, taxYear: input.taxYear, requiredDistributionHistory: [], contributionYears: [], affirmativeElectionYear: null })

    if (evaluator.status !== 'spousalElectionNotApplicable') return { status: 'missingFacts', missing: ['unexpected evaluator status for non-spouse'], deathYearDecedentResidualRmdDue: residual }

    return { status: 'spousalElectionNotApplicable', evaluator, deathYearDecedentResidualRmdDue: residual }

  }



  const facts = input.electionFacts

  const missing: string[] = []

  if (facts.soleBeneficiaryStatus === 'unknown') missing.push('soleBeneficiaryStatus')

  if (facts.unlimitedWithdrawalRight === 'unknown') missing.push('unlimitedWithdrawalRight')

  if (facts.beneficiaryIsDirectSpouseNamedOnIra === 'unknown') missing.push('beneficiaryIsDirectSpouseNamedOnIra')

  if (facts.factsProvenance.trim().length === 0) missing.push('factsProvenance')

  if (facts.soleBeneficiaryStatus === 'verifiedNotSole') return { status: 'eligibilityNotMet', reason: 'notSoleBeneficiary', deathYearDecedentResidualRmdDue: residual }

  if (facts.unlimitedWithdrawalRight === 'verifiedNo') return { status: 'eligibilityNotMet', reason: 'noUnlimitedWithdrawalRight', deathYearDecedentResidualRmdDue: residual }

  if (facts.beneficiaryIsDirectSpouseNamedOnIra === 'verifiedNo') return { status: 'eligibilityNotMet', reason: 'notDirectSpouseNamedOnIra', deathYearDecedentResidualRmdDue: residual }



  const cutoff = stageCutoff(input)

  if (cutoff === null) missing.push('factsAsOfDate')

  const opening = input.determinationStage === 'openingOfTaxYear'

  if (cutoff !== null) {

    const historyProblem = validObservedHistory(facts.postDeathRequiredDistributionHistory, facts.factsAsOfDate, cutoff, opening)

    if (historyProblem !== undefined) missing.push(historyProblem)

  }

  const modeled = input.simulationContext

  const combinedHistory: BeneficiaryRequiredDistributionYear[] = [...facts.postDeathRequiredDistributionHistory]

  let affirmative = facts.affirmativeRedesignation

  let determination = facts.section402c2j4

  const modeledContributionYears: number[] = []

  if (modeled !== undefined) {

    const limitYear = opening ? input.taxYear - 1 : input.taxYear

    if (!modeled.simulationId.trim() || !Number.isSafeInteger(modeled.committedThroughTaxYear) ||

        modeled.committedThroughTaxYear > limitYear) missing.push('simulationContext commitment boundary')

    const years = new Set(combinedHistory.map(row => row.taxYear))

    const commits = new Set<string>()

    const validCommit = (id: string) => {

      if (!id.trim() || commits.has(id)) return false

      commits.add(id)

      return true

    }

    for (const row of modeled.requiredDistributionHistory) {

      const deadline = parseCivilIsoDate(row.legalDeadline)

      if (!Number.isSafeInteger(row.taxYear) || row.taxYear > modeled.committedThroughTaxYear ||

          deadline === null || deadline.year < row.taxYear || deadline.year > modeled.committedThroughTaxYear ||

          !validCommit(row.commitId) || years.has(row.taxYear)) {

        missing.push(`simulation history commitment taxYear ${row.taxYear}`)

      } else {

        years.add(row.taxYear)

        combinedHistory.push(row)

      }

    }

    const validModeledEvent = (event: Readonly<{ executedOn: string; commitId: string }>) => {

      const date = parseCivilIsoDate(event.executedOn)

      return date !== null && date.year <= modeled.committedThroughTaxYear && validCommit(event.commitId)

    }

    if (modeled.affirmativeRedesignation !== undefined) {

      if (affirmative !== null || !validModeledEvent(modeled.affirmativeRedesignation)) {

        missing.push('simulation affirmative commitment')

      } else {

        affirmative = { executedOn: modeled.affirmativeRedesignation.executedOn, provenance: modeled.simulationId }

        determination = modeled.section402c2j4 ?? { status: 'incomplete', reason: 'invalidInput' }

      }

    }

    for (const event of modeled.nonRolloverContributions) {

      if (!validModeledEvent(event)) missing.push('simulation contribution commitment')

      else modeledContributionYears.push(parseCivilIsoDate(event.executedOn)!.year)

    }

  }

  const affirmativeOccurred = affirmative === null || cutoff === null

    ? false

    : occurredBy(affirmative, cutoff)

  if (affirmativeOccurred === null) missing.push('affirmativeRedesignation evidence')

  if (affirmativeOccurred === true) {

    const catchUpProblem = valid402c2j4(determination, parseCivilIsoDate(affirmative!.executedOn)!.year)

    if (catchUpProblem !== undefined) missing.push(catchUpProblem)

  }

  const contributionYears: number[] = [...modeledContributionYears]

  if (cutoff !== null) for (const contribution of facts.nonRolloverContributions) {

    const occurred = occurredBy(contribution, cutoff)

    if (occurred === null) missing.push('nonRolloverContribution evidence')

    else if (occurred) {

      const date = parseCivilIsoDate(contribution.executedOn)!

      contributionYears.push(date.year)

    }

  }

  if (missing.length > 0) return { status: 'missingFacts', missing, deathYearDecedentResidualRmdDue: residual }



  // Once a dated act establishes owner treatment, later owned years do not

  // require fictional beneficiary history. Earlier years still prove precedence.

  const throughYear = opening ? input.taxYear - 1 : input.taxYear

  const affirmativeElectionAtTaxYearOpening = affirmativeOccurred === true &&
    affirmative!.executedOn.endsWith('-01-01')
  const datedTriggerYears = [...contributionYears,

    ...combinedHistory.filter(row => row.distributedAmount < row.requiredAmount).map(row => row.taxYear),

    ...(affirmativeOccurred === true ? [parseCivilIsoDate(affirmative!.executedOn)!.year -
      (affirmativeElectionAtTaxYearOpening ? 1 : 0)] : [])]

  const evaluatedThroughTaxYear = Math.min(throughYear, ...datedTriggerYears)

  const evaluator = evaluateBeneficiarySpousalElection({

    beneficiaryPersonId: input.beneficiaryPersonId, decedentPersonId: input.decedentPersonId,

    relationship: 'survivingSpouse', deathDate: input.deathDate, taxYear: input.taxYear,
    completedThroughTaxYear: evaluatedThroughTaxYear,
    affirmativeElectionAtTaxYearOpening,

    requiredDistributionHistory: combinedHistory.filter(row => row.taxYear <= evaluatedThroughTaxYear),

    contributionYears, affirmativeElectionYear: affirmativeOccurred === true ? parseCivilIsoDate(affirmative!.executedOn)!.year : null,

  })

  if (evaluator.status === 'spousalElectionEvidenceIncomplete') return { status: 'missingFacts', missing: [`requiredDistributionHistory taxYear ${evaluator.missingTaxYear}`], deathYearDecedentResidualRmdDue: residual }

  if (evaluator.status === 'spousalElectionEvidenceInconsistent') return { status: 'missingFacts', missing: [`inconsistent: ${evaluator.reason}`], deathYearDecedentResidualRmdDue: residual }



  if (evaluator.status === 'spousalOwnerTreatmentBegun' && evaluator.trigger === 'affirmativeElection' && determination.status === 'applicable' && determination.remainingToDistributeBeforeElection > 0) {

    return { status: 'lateElectionCatchUpIncomplete', requiredAmount: determination.amountTreatedAsCurrentDistributionRmd, observedDistributedAmount: determination.amountActuallyDistributed, remainingAmount: determination.remainingToDistributeBeforeElection, deathYearDecedentResidualRmdDue: residual }

  }

  return { status: 'evaluated', evaluator, deathYearDecedentResidualRmdDue: residual, routeToOwnerTreatment: evaluator.status === 'spousalOwnerTreatmentBegun', evaluationContext: modeled === undefined ? 'observed' : 'simulation', ...(modeled === undefined ? {} : { simulationId: modeled.simulationId }) }

}
