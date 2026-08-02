import { addCalendarMonths, formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import { exactCentProRataNearestHalfUp } from './exactCentProRata.js'
import { accountIdSchema, actionIdSchema, allocationIdSchema, personIdSchema,
  type AccountId, type ActionId, type AllocationId, type PersonId } from './identity.js'
import { asUsdCents, positiveUsdCentsSchema, usdCentsSchema, type UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import type { QualifiedDisabilityEventEvidence, RejectedDisabilityStatusEvidence } from './ownedNonRothIraPenaltyPrerequisite.js'
import type { AcceptedTraditionalEmployerPlanWithdrawalClassification } from './traditionalEmployerPlanWithdrawalCharacter.js'

type EmployerPenaltyIdentity = {
  actionId: ActionId; allocationId: AllocationId
  sourceAccountId: AccountId; participantPersonId: PersonId
  evaluationDate: string
}

export interface TraditionalEmployerPlanPenaltyParticipantEvidence {
  predicate: 'employerPlanParticipantBirthDateForPenalty'
  participantPersonId: PersonId
  birthDate: string
  birthDateEvidenceId: string
}

export interface TraditionalEmployerPlanSeparationEvidence {
  predicate: 'sponsoringEmployerSeparationForPenalty'
  sourceAccountId: AccountId
  participantPersonId: PersonId
  separationDate: string
  authoritative: true
  separationEvidenceId: string
}

interface EmployerPlanSeppBinding extends EmployerPenaltyIdentity {
  predicate: 'employerPlanSeppStatusForWithdrawal'
}

export interface TraditionalEmployerPlanNoSeppEvidence
  extends EmployerPlanSeppBinding {
  status: 'none'
  electionId: null
  scheduleId: null
  seppStatusEvidenceId: string
}

export interface TraditionalEmployerPlanSeppCurrentPaymentEvidence
  extends EmployerPlanSeppBinding {
  status: 'currentPayment'
  election: Readonly<{
    electionId: string
    scheduleId: string
    method: 'rmd' | 'amortization' | 'fixedAnnuitization'
    electionStartDate: string
    participantPersonId: PersonId
    sourceAccountId: AccountId
    electionEvidenceId: string
  }>
  payment: Readonly<{
    currentDistributionEvidenceId: string
    scheduledPaymentSequence: number
    scheduleTaxYear: number
    scheduledAnnualAmount: UsdCents
    scheduledGrossAmountThroughBefore: UsdCents
    actualQualifyingGrossAmountPaidBefore: UsdCents
    currentScheduledGrossAmount: UsdCents
    currentDistributionGrossAmount: UsdCents
    currentQualifyingTaxableAmount: UsdCents
    excessCurrentDistributionGrossAmount: UsdCents
    scheduledGrossAmountThroughAfter: UsdCents
    actualQualifyingGrossAmountPaidAfter: UsdCents
    previousScheduleStateId: string | null
    scheduleStateBeforeId: string
    scheduleStateAfterId: string
    noDisqualifyingModificationThroughDate: string
  }>
}

export type TraditionalEmployerPlanSeppEvidence = TraditionalEmployerPlanNoSeppEvidence | TraditionalEmployerPlanSeppCurrentPaymentEvidence

export interface TraditionalEmployerPlanOtherExceptionAttestation extends EmployerPenaltyIdentity {
  predicate: 'otherEmployerPlanPenaltyExceptionAttestation'
  otherExceptionClaimed: boolean
  exceptionDescription: string | null
  evidenceScope: 'planningEvidenceNotFilingGradeLegalAdjudication'
  attestationEvidenceId: string
}

export interface EvaluateTraditionalEmployerPlanPenaltyPrerequisiteInput extends EmployerPenaltyIdentity {
  characterization: Readonly<AcceptedTraditionalEmployerPlanWithdrawalClassification>
  taxableTreatmentAmount: UsdCents
  participantEvidence: Readonly<TraditionalEmployerPlanPenaltyParticipantEvidence>
  separationEvidence: Readonly<TraditionalEmployerPlanSeparationEvidence> | null
  disabilityEvidence:
    | Readonly<QualifiedDisabilityEventEvidence>
    | Readonly<RejectedDisabilityStatusEvidence>
    | null
  seppEvidence: Readonly<TraditionalEmployerPlanSeppEvidence> | null
  otherExceptionAttestation: Readonly<TraditionalEmployerPlanOtherExceptionAttestation> | null
}

export interface TraditionalEmployerPlanPenaltyCharacterCoverageEvidence extends EmployerPenaltyIdentity {
  predicate: 'completeEmployerPlanPenaltyCharacterCoverageForAllocation'
  executedAmount: UsdCents
  basisReturnExcludedAmount: UsdCents
  taxableTreatmentAmount: UsdCents
  basisEvidenceId: string
  characterEvidenceIds: readonly string[]
  evidenceId: string
}

export interface TraditionalEmployerPlanPenaltyAgeEvidence {
  predicate: 'employerPlanParticipantAge59HalfThreshold'
  participantPersonId: PersonId
  birthDate: string
  age59HalfDate: string
  calendarYearParticipantAttains55: number
  birthDateEvidenceId: string
  calculation: 'addCalendarMonths714WithMonthEndClamp'
  evidenceId: string
}

export interface TraditionalEmployerPlanRuleOf55Assessment {
  exception: 'ruleOf55'
  disposition: 'accepted' | 'refused'
  sourceAccountId: AccountId
  participantPersonId: PersonId
  evaluationDate: string
  separationDate: string
  separationYear: number
  calendarYearParticipantAttains55: number
  separationEvidenceId: string
  evidenceId: string
}

export interface TraditionalEmployerPlanSeppAssessment {
  exception: 'employerPlanSepp'; disposition: 'provisional' | 'refused'
  characterCoverageEvidenceId: string; characterEvidenceIds: readonly string[]
  authorityEvidenceIds: readonly string[]
  statusEvidence: Readonly<TraditionalEmployerPlanSeppEvidence>; evidenceId: string
}

export interface TraditionalEmployerPlanOtherExceptionAssessment {
  exception: 'otherStatutoryException'
  disposition: 'refused' | 'unsupported'
  attestation: Readonly<TraditionalEmployerPlanOtherExceptionAttestation>
  evidenceId: string
}

type EmployerPenaltyOutcome = 'noTaxableExposure' | 'age59HalfReached' | 'ruleOf55Qualified' | 'disabilityQualified' | 'penaltyApplies'

export interface AcceptedTraditionalEmployerPlanPenaltyEvidence extends EmployerPenaltyIdentity {
  predicate: 'employerPenaltyExceptionEvidence'
  outcome: EmployerPenaltyOutcome
  characterCoverage: Readonly<TraditionalEmployerPlanPenaltyCharacterCoverageEvidence>
  ageEvidence: Readonly<TraditionalEmployerPlanPenaltyAgeEvidence>
  ruleOf55Assessment: Readonly<TraditionalEmployerPlanRuleOf55Assessment> | null
  disabilityEvidence:
    | Readonly<QualifiedDisabilityEventEvidence>
    | Readonly<RejectedDisabilityStatusEvidence>
    | null
  seppAssessment: Readonly<TraditionalEmployerPlanSeppAssessment> | null
  otherExceptionAssessment: Readonly<TraditionalEmployerPlanOtherExceptionAssessment> | null
  rateEvidence: Readonly<{
    kind: 'traditionalEmployerPlanEarlyDistributionRate'
    numerator: 1
    denominator: 10
    quantization: 'nearestCentHalfUp'
    intermediateArithmetic: 'bigintRational'
    evidenceId: string
  }> | null
  finalPenaltyAmount: UsdCents
  evidenceId: string
}

export type TraditionalEmployerPlanPenaltyMissingEvidence = 'separation' | 'disability' | 'sepp' | 'seppAnnualReconciliation' | 'otherExceptionAttestation' | 'otherExceptionAdjudication'

export interface UnsupportedTraditionalEmployerPlanPenaltyEvidence extends EmployerPenaltyIdentity {
  predicate: 'employerPenaltyExceptionEvidence'
  outcome: 'unsupported'
  missingEvidence: TraditionalEmployerPlanPenaltyMissingEvidence
  characterCoverage: Readonly<TraditionalEmployerPlanPenaltyCharacterCoverageEvidence>
  ageEvidence: Readonly<TraditionalEmployerPlanPenaltyAgeEvidence>
  ruleOf55Assessment: Readonly<TraditionalEmployerPlanRuleOf55Assessment> | null
  disabilityEvidence: Readonly<QualifiedDisabilityEventEvidence | RejectedDisabilityStatusEvidence> | null
  otherExceptionAttestation: Readonly<TraditionalEmployerPlanOtherExceptionAttestation> | null
  seppAssessment: Readonly<TraditionalEmployerPlanSeppAssessment> | null
  evidenceId: string
}

export interface AcceptedTraditionalEmployerPlanPenaltyResult {
  status: 'accepted'
  reasons: readonly []
  evidence: Readonly<AcceptedTraditionalEmployerPlanPenaltyEvidence>
}

export interface UnsupportedTraditionalEmployerPlanPenaltyResult {
  status: 'unsupported'
  reasons: readonly [ActionReason<
    | 'withdrawal-rule-of-55-evidence-missing'
    | 'withdrawal-sepp-evidence-missing'
    | 'withdrawal-penalty-evidence-missing'
  >]
  evidence: Readonly<UnsupportedTraditionalEmployerPlanPenaltyEvidence>
}

export type EvaluateTraditionalEmployerPlanPenaltyPrerequisiteResult = AcceptedTraditionalEmployerPlanPenaltyResult | UnsupportedTraditionalEmployerPlanPenaltyResult

function nonblank(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${label} must be a nonblank stable identifier`)
  return value
}

function civilDate(value: unknown, label: string): string {
  if (typeof value !== 'string') throw new RangeError(`${label} must be a canonical civil date`)
  const parsed = parseCivilIsoDate(value)
  if (parsed === null || formatCivilDate(parsed) !== value) throw new RangeError(`${label} must be a canonical civil date`)
  return value
}

function structural(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null) return ['null']
  if (value === undefined) return ['undefined']
  if (typeof value === 'bigint') return ['bigint', value.toString()]
  if (typeof value === 'number') return ['number', Number.isFinite(value) ? (Object.is(value, -0) ? '-0' : value) : String(value)]
  if (typeof value !== 'object') return [typeof value, typeof value === 'symbol' || typeof value === 'function' ? String(value) : value]
  if (seen.has(value) || Object.values(Object.getOwnPropertyDescriptors(value)).some((descriptor) => 'get' in descriptor || 'set' in descriptor) || (Array.isArray(value) && Reflect.ownKeys(value).some((key) => key !== 'length' && (typeof key !== 'string' || !Object.prototype.propertyIsEnumerable.call(value, key) || String(Number(key)) !== key || Number(key) >= value.length))) || (!Array.isArray(value) && Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)) throw new TypeError('Employer penalty evidence must be non-aliased acyclic plain data')
  seen.add(value)
  const result = Array.isArray(value) ? ['array', Array.prototype.map.call(value, (entry: unknown) => structural(entry, seen))] : ['object', Object.keys(value).sort().map((key) => [key, structural((value as Record<string, unknown>)[key], seen)])]
  return result
}

function stableId(prefix: string, parts: readonly unknown[]): string { return `${prefix}:${JSON.stringify(structural(parts))}` }

function clonePlain<T>(value: T): T { structural(value); return structuredClone(value) }

function requireDistinctEvidenceIds(ids: readonly string[]): void { if (new Set(ids).size !== ids.length) throw new RangeError('Negative employer-penalty facts must use distinct evidence IDs') }

function deepFreeze<T>(value: T, visited = new WeakSet<object>()): Readonly<T> {
  if (value !== null && typeof value === 'object' && !visited.has(value)) {
    visited.add(value)
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child, visited)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function sameIdentity(value: EmployerPenaltyIdentity, identity: EmployerPenaltyIdentity): boolean {
  return value.actionId === identity.actionId &&
    value.allocationId === identity.allocationId &&
    value.sourceAccountId === identity.sourceAccountId &&
    value.participantPersonId === identity.participantPersonId &&
    value.evaluationDate === identity.evaluationDate
}

function characterCoverage(
  characterization: Readonly<AcceptedTraditionalEmployerPlanWithdrawalClassification>,
  identity: EmployerPenaltyIdentity,
  taxableTreatmentAmount: UsdCents,
  birthDate: string,
): TraditionalEmployerPlanPenaltyCharacterCoverageEvidence {
  if (characterization.status !== 'accepted' || characterization.reasons.length !== 0) {
    throw new RangeError('Employer penalty requires accepted traditional-plan character')
  }
  const accepted = characterization.acceptedSourceEligibility
  const basis = accepted.basisEvidence
  const availability = accepted.availabilityEvidence
  const availabilityDate = civilDate(availability.eventDate, 'Employer distribution availability event date')
  const basisEvidenceId = nonblank(basis.basisEvidenceId, 'Employer basis evidence ID')
  const executedAmount = usdCentsSchema.parse(basis.executedAmount)
  const basisReturnExcludedAmount = usdCentsSchema.parse(basis.basisRecoveredAmount)
  const ordinaryIncomeAmount = usdCentsSchema.parse(basis.ordinaryIncomeAmount)
  const preDistributionAccountValue = positiveUsdCentsSchema.parse(basis.preDistributionAccountValue)
  const afterTaxBasis = usdCentsSchema.parse(basis.afterTaxEmployeeBasisBeforeDistribution)
  const exactBasisReturn = exactCentProRataNearestHalfUp(
    BigInt(executedAmount), BigInt(afterTaxBasis), BigInt(preDistributionAccountValue),
  )
  if (
    accepted.predicate !== 'employerDistributionEligibility' ||
    accepted.sourceClass !== 'traditionalEmployerPlan' ||
    accepted.actionId !== identity.actionId ||
    accepted.allocationId !== identity.allocationId ||
    accepted.sourceAccountId !== identity.sourceAccountId ||
    accepted.participantPersonId !== identity.participantPersonId ||
    accepted.evaluationDate !== identity.evaluationDate ||
    afterTaxBasis > preDistributionAccountValue ||
    executedAmount > preDistributionAccountValue ||
    availability.kind !== 'distributableEvent' ||
    !['separationFromService', 'inServiceWithdrawal', 'planTermination', 'requiredDistribution'].includes(availability.eventKind) ||
    availabilityDate < birthDate || availabilityDate > identity.evaluationDate ||
    availability.availableOnEvaluationDate !== true ||
    !nonblank(availability.planTermsEvidenceId, 'Employer distribution plan-terms evidence ID') ||
    basis.rule !== 'proRataSingleDistribution' ||
    basis.sourcePlanAccountId !== identity.sourceAccountId ||
    basis.aggregateBasisRatio.representation !== 'exactMinorUnitRational' ||
    basis.aggregateBasisRatio.numeratorMinorUnits !== afterTaxBasis ||
    basis.aggregateBasisRatio.denominatorMinorUnits !== preDistributionAccountValue ||
    basis.aggregateBasisRatio.intermediateArithmetic !== 'bigintRational' ||
    basis.basisRecoveryQuantization !== 'nearestCentHalfUp' ||
    exactBasisReturn !== BigInt(basisReturnExcludedAmount) ||
    BigInt(basisReturnExcludedAmount) + BigInt(ordinaryIncomeAmount) !== BigInt(executedAmount) ||
    ordinaryIncomeAmount !== taxableTreatmentAmount
  ) {
    throw new RangeError('Employer penalty character must exactly bind identity and taxable treatment')
  }

  let basisTotal = 0n
  let ordinaryTotal = 0n
  const kinds = new Set<string>()
  const characterEvidenceIds: string[] = []
  for (const segment of characterization.taxCharacter) {
    const amount = positiveUsdCentsSchema.parse(segment.amount)
    if (
      kinds.has(segment.kind) ||
      segment.actionId !== identity.actionId ||
      segment.allocationId !== identity.allocationId ||
      segment.sourceAccountId !== identity.sourceAccountId ||
      segment.sourceClass !== 'traditionalEmployerPlan' ||
      segment.characterEvidence.rule !== 'employerPlanProRataBasis' ||
      segment.characterEvidence.allocationId !== identity.allocationId ||
      segment.characterEvidence.basisEvidenceId !== basisEvidenceId ||
      segment.characterEvidence.segmentAmount !== amount
    ) throw new RangeError('Employer penalty character contains foreign or mismatched evidence')
    kinds.add(segment.kind)
    if (segment.kind === 'basisReturn') basisTotal += BigInt(amount)
    else if (segment.kind === 'ordinaryIncome') ordinaryTotal += BigInt(amount)
    else throw new RangeError('Employer penalty character contains an unsupported segment')
    characterEvidenceIds.push(stableId('employer-character-segment', [segment]))
  }
  if (
    basisTotal !== BigInt(basisReturnExcludedAmount) ||
    ordinaryTotal !== BigInt(ordinaryIncomeAmount) ||
    (basisReturnExcludedAmount > 0 && !kinds.has('basisReturn')) ||
    (ordinaryIncomeAmount > 0 && !kinds.has('ordinaryIncome'))
  ) throw new RangeError('Employer penalty character does not conserve exact cents')
  characterEvidenceIds.sort()

  const evidenceId = stableId('employer-penalty-character-coverage', [
    identity, executedAmount, basisReturnExcludedAmount, taxableTreatmentAmount,
    availability, preDistributionAccountValue, afterTaxBasis, basisEvidenceId, characterEvidenceIds,
  ])
  return {
    predicate: 'completeEmployerPlanPenaltyCharacterCoverageForAllocation',
    ...identity,
    executedAmount,
    basisReturnExcludedAmount,
    taxableTreatmentAmount,
    basisEvidenceId,
    characterEvidenceIds,
    evidenceId,
  }
}

function disabilityEvidence(
  value: EvaluateTraditionalEmployerPlanPenaltyPrerequisiteInput['disabilityEvidence'],
  identity: EmployerPenaltyIdentity,
  birthDate: string,
): QualifiedDisabilityEventEvidence | RejectedDisabilityStatusEvidence | null {
  if (value === null) return null
  if (value.qualifiedOnEvaluationDate !== true && value.qualifiedOnEvaluationDate !== false) {
    throw new RangeError('Disability evidence must carry literal as-of-date status')
  }
  const qualificationDate = value.disabilityQualificationDate === null
    ? null
    : civilDate(value.disabilityQualificationDate, 'Disability qualification date')
  if (
    value.kind !== 'disability' ||
    personIdSchema.parse(value.disabledPersonId) !== identity.participantPersonId ||
    civilDate(value.evaluationDate, 'Disability evaluation date') !== identity.evaluationDate ||
    !nonblank(value.disabilityEvidenceId, 'Disability evidence ID') ||
    (qualificationDate !== null && qualificationDate < birthDate) ||
    (value.qualifiedOnEvaluationDate && (qualificationDate === null || qualificationDate > identity.evaluationDate)) ||
    (!value.qualifiedOnEvaluationDate && qualificationDate !== null && qualificationDate <= identity.evaluationDate)
  ) throw new RangeError('Disability evidence must exactly bind dated participant status')
  return { ...clonePlain(value), disabilityQualificationDate: qualificationDate } as
    QualifiedDisabilityEventEvidence | RejectedDisabilityStatusEvidence
}

function seppAssessment(
  value: Readonly<TraditionalEmployerPlanSeppEvidence>,
  identity: EmployerPenaltyIdentity,
  separationDate: string,
  coverage: TraditionalEmployerPlanPenaltyCharacterCoverageEvidence,
): TraditionalEmployerPlanSeppAssessment {
  if (value.predicate !== 'employerPlanSeppStatusForWithdrawal' || !sameIdentity(value, identity)) {
    throw new RangeError('Employer SEPP evidence must bind the current distribution')
  }
  if (value.status === 'none') {
    if (
      value.electionId !== null || value.scheduleId !== null ||
      !nonblank(value.seppStatusEvidenceId, 'Employer SEPP status evidence ID')
    ) throw new RangeError('No-SEPP evidence must carry literal null election and schedule IDs')
    const evidenceId = stableId('employer-sepp-rejected', [identity, value, coverage.evidenceId, coverage.characterEvidenceIds])
    return {
      exception: 'employerPlanSepp', disposition: 'refused',
      characterCoverageEvidenceId: coverage.evidenceId,
      characterEvidenceIds: coverage.characterEvidenceIds,
      statusEvidence: clonePlain(value), authorityEvidenceIds: [value.seppStatusEvidenceId], evidenceId,
    }
  }
  const election = value.election
  const payment = value.payment
  const electionStartDate = civilDate(election.electionStartDate, 'Employer SEPP election start date')
  const noModificationDate = civilDate(
    payment.noDisqualifyingModificationThroughDate,
    'Employer SEPP no-modification-through date',
  )
  const distinctIds = [
    election.electionId, election.scheduleId, election.electionEvidenceId,
    payment.currentDistributionEvidenceId, payment.scheduleStateBeforeId,
    payment.scheduleStateAfterId,
  ]
  if (
    nonblank(election.electionId, 'Employer SEPP election ID') !== election.electionId ||
    !nonblank(election.scheduleId, 'Employer SEPP schedule ID') ||
    (election.method !== 'rmd' && election.method !== 'amortization' && election.method !== 'fixedAnnuitization') ||
    election.participantPersonId !== identity.participantPersonId ||
    election.sourceAccountId !== identity.sourceAccountId ||
    !nonblank(election.electionEvidenceId, 'Employer SEPP election evidence ID') ||
    electionStartDate <= separationDate ||
    electionStartDate > identity.evaluationDate ||
    !Number.isSafeInteger(payment.scheduledPaymentSequence) ||
    payment.scheduledPaymentSequence < 1 ||
    payment.scheduleTaxYear !== Number(identity.evaluationDate.slice(0, 4)) ||
    !nonblank(payment.currentDistributionEvidenceId, 'Employer SEPP current distribution evidence ID') ||
    (payment.previousScheduleStateId !== null && !nonblank(payment.previousScheduleStateId, 'Previous SEPP state ID')) ||
    !nonblank(payment.scheduleStateBeforeId, 'SEPP state-before ID') ||
    !nonblank(payment.scheduleStateAfterId, 'SEPP state-after ID') ||
    payment.scheduleStateBeforeId === payment.scheduleStateAfterId
    || new Set(distinctIds).size !== distinctIds.length
    || (payment.scheduledPaymentSequence === 1
      ? payment.previousScheduleStateId !== null
      : payment.previousScheduleStateId !== payment.scheduleStateBeforeId)
  ) throw new RangeError('Employer SEPP election or current-payment identity is invalid')

  const annual = usdCentsSchema.parse(payment.scheduledAnnualAmount)
  const scheduledBefore = usdCentsSchema.parse(payment.scheduledGrossAmountThroughBefore)
  const actualBefore = usdCentsSchema.parse(payment.actualQualifyingGrossAmountPaidBefore)
  const currentScheduled = usdCentsSchema.parse(payment.currentScheduledGrossAmount)
  const currentGross = usdCentsSchema.parse(payment.currentDistributionGrossAmount)
  const currentTaxable = usdCentsSchema.parse(payment.currentQualifyingTaxableAmount)
  const excess = usdCentsSchema.parse(payment.excessCurrentDistributionGrossAmount)
  const scheduledAfter = usdCentsSchema.parse(payment.scheduledGrossAmountThroughAfter)
  const actualAfter = usdCentsSchema.parse(payment.actualQualifyingGrossAmountPaidAfter)
  const qualified =
    noModificationDate >= identity.evaluationDate && (payment.scheduledPaymentSequence !== 1 || (scheduledBefore === 0 && actualBefore === 0)) &&
    scheduledBefore === actualBefore &&
    currentScheduled === coverage.executedAmount &&
    currentGross === coverage.executedAmount &&
    currentTaxable === coverage.taxableTreatmentAmount &&
    excess === 0 &&
    BigInt(scheduledAfter) === BigInt(scheduledBefore) + BigInt(currentScheduled) &&
    BigInt(actualAfter) === BigInt(actualBefore) + BigInt(currentGross) &&
    scheduledAfter <= annual && actualAfter <= annual
  const evidenceId = stableId('employer-sepp-assessment', [
    identity, separationDate, value, qualified,
    coverage.evidenceId, coverage.characterEvidenceIds,
  ])
  return {
    exception: 'employerPlanSepp',
    disposition: qualified ? 'provisional' : 'refused',
    characterCoverageEvidenceId: coverage.evidenceId,
    characterEvidenceIds: coverage.characterEvidenceIds,
    statusEvidence: clonePlain(value), authorityEvidenceIds: distinctIds,
    evidenceId,
  }
}

function otherAssessment(
  value: Readonly<TraditionalEmployerPlanOtherExceptionAttestation>,
  identity: EmployerPenaltyIdentity,
): TraditionalEmployerPlanOtherExceptionAssessment {
  if (
    value.predicate !== 'otherEmployerPlanPenaltyExceptionAttestation' ||
    !sameIdentity(value, identity) ||
    typeof value.otherExceptionClaimed !== 'boolean' ||
    value.evidenceScope !== 'planningEvidenceNotFilingGradeLegalAdjudication' ||
    !nonblank(value.attestationEvidenceId, 'Other-exception attestation evidence ID') ||
    (value.otherExceptionClaimed
      ? typeof value.exceptionDescription !== 'string' || value.exceptionDescription.trim().length === 0
      : value.exceptionDescription !== null)
  ) throw new RangeError('Other-exception attestation must exactly bind its claim and distribution')
  const disposition = value.otherExceptionClaimed ? 'unsupported' : 'refused'
  return {
    exception: 'otherStatutoryException',
    disposition,
    attestation: clonePlain(value),
    evidenceId: stableId('employer-other-exception', [identity, value]),
  }
}

function unsupported(
  identity: EmployerPenaltyIdentity,
  coverage: TraditionalEmployerPlanPenaltyCharacterCoverageEvidence,
  ageEvidence: TraditionalEmployerPlanPenaltyAgeEvidence,
  missingEvidence: TraditionalEmployerPlanPenaltyMissingEvidence,
  other: Readonly<TraditionalEmployerPlanOtherExceptionAttestation> | null,
  ruleOf55: Readonly<TraditionalEmployerPlanRuleOf55Assessment> | null = null,
  sepp: Readonly<TraditionalEmployerPlanSeppAssessment> | null = null,
  disability: Readonly<QualifiedDisabilityEventEvidence | RejectedDisabilityStatusEvidence> | null = null,
): Readonly<UnsupportedTraditionalEmployerPlanPenaltyResult> {
  const code = missingEvidence === 'separation'
    ? 'withdrawal-rule-of-55-evidence-missing'
    : missingEvidence === 'sepp' || missingEvidence === 'seppAnnualReconciliation'
      ? 'withdrawal-sepp-evidence-missing'
      : 'withdrawal-penalty-evidence-missing'
  const evidence: UnsupportedTraditionalEmployerPlanPenaltyEvidence = {
    predicate: 'employerPenaltyExceptionEvidence',
    outcome: 'unsupported',
    ...identity,
    missingEvidence,
    characterCoverage: coverage,
    ageEvidence,
    ruleOf55Assessment: ruleOf55,
    disabilityEvidence: disability,
    otherExceptionAttestation: other === null ? null : clonePlain(other),
    seppAssessment: sepp,
    evidenceId: stableId('employer-penalty-unsupported', [
      identity, coverage.evidenceId, ageEvidence.evidenceId, missingEvidence,
      ruleOf55?.evidenceId ?? null, disability, other, sepp?.evidenceId ?? null,
    ]),
  }
  return deepFreeze({
    status: 'unsupported',
    reasons: [createActionReason(code, {
      personId: identity.participantPersonId,
      accountId: identity.sourceAccountId,
      allocationId: identity.allocationId,
    })],
    evidence,
  })
}

/** Pure evidence evaluator; it neither reads Plan state nor moves money. */
export function evaluateTraditionalEmployerPlanPenaltyPrerequisite(
  input: Readonly<EvaluateTraditionalEmployerPlanPenaltyPrerequisiteInput>,
): Readonly<EvaluateTraditionalEmployerPlanPenaltyPrerequisiteResult> {
  const snapshot = clonePlain(input)
  const identity: EmployerPenaltyIdentity = {
    actionId: actionIdSchema.parse(snapshot.actionId),
    allocationId: allocationIdSchema.parse(snapshot.allocationId),
    sourceAccountId: accountIdSchema.parse(snapshot.sourceAccountId),
    participantPersonId: personIdSchema.parse(snapshot.participantPersonId),
    evaluationDate: civilDate(snapshot.evaluationDate, 'Employer penalty evaluation date'),
  }
  const taxableTreatmentAmount = usdCentsSchema.parse(snapshot.taxableTreatmentAmount)
  const participant = snapshot.participantEvidence
  const birthDate = civilDate(participant.birthDate, 'Employer-plan participant birth date')
  if (
    participant.predicate !== 'employerPlanParticipantBirthDateForPenalty' ||
    participant.participantPersonId !== identity.participantPersonId ||
    !nonblank(participant.birthDateEvidenceId, 'Participant birth-date evidence ID')
  ) throw new RangeError('Participant birth-date evidence must bind employer penalty identity')
  const age59HalfDate = addCalendarMonths(birthDate, 714)
  const birth = parseCivilIsoDate(birthDate)!
  if (identity.evaluationDate < birthDate) {
    throw new RangeError('Employer penalty evaluation date cannot precede participant birth')
  }
  const coverage = characterCoverage(snapshot.characterization, identity, taxableTreatmentAmount, birthDate)
  if (age59HalfDate === null || birth.year + 55 > 9999) {
    throw new RangeError('Employer-plan penalty age threshold is outside civil-date range')
  }
  const ageEvidence: TraditionalEmployerPlanPenaltyAgeEvidence = {
    predicate: 'employerPlanParticipantAge59HalfThreshold',
    participantPersonId: identity.participantPersonId,
    birthDate,
    age59HalfDate,
    calendarYearParticipantAttains55: birth.year + 55,
    birthDateEvidenceId: participant.birthDateEvidenceId,
    calculation: 'addCalendarMonths714WithMonthEndClamp',
    evidenceId: stableId('employer-age-59-half', [participant, age59HalfDate, birth.year + 55]),
  }

  let outcome: EmployerPenaltyOutcome = taxableTreatmentAmount === 0
    ? 'noTaxableExposure'
    : 'age59HalfReached'
  let ruleOf55Assessment: TraditionalEmployerPlanRuleOf55Assessment | null = null
  let disability: QualifiedDisabilityEventEvidence | RejectedDisabilityStatusEvidence | null = null
  let sepp: TraditionalEmployerPlanSeppAssessment | null = null
  let other: TraditionalEmployerPlanOtherExceptionAssessment | null = null
  let rateEvidence: AcceptedTraditionalEmployerPlanPenaltyEvidence['rateEvidence'] = null
  let finalPenaltyAmount = asUsdCents(0)

  if (taxableTreatmentAmount > 0 && identity.evaluationDate < age59HalfDate) {
    disability = disabilityEvidence(snapshot.disabilityEvidence, identity, birthDate)
    if (disability?.qualifiedOnEvaluationDate) outcome = 'disabilityQualified'
    else {
      const separation = snapshot.separationEvidence
      if (separation === null) return unsupported(identity, coverage, ageEvidence, 'separation', null, null, null, disability)
      const separationDate = civilDate(separation.separationDate, 'Employer separation date')
      if (
        separationDate < birthDate ||
        separation.predicate !== 'sponsoringEmployerSeparationForPenalty' ||
        separation.sourceAccountId !== identity.sourceAccountId ||
        separation.participantPersonId !== identity.participantPersonId ||
        separation.authoritative !== true ||
        !nonblank(separation.separationEvidenceId, 'Employer separation evidence ID')
      ) throw new RangeError('Separation evidence must bind the named sponsoring plan and participant')
      const availability = snapshot.characterization.acceptedSourceEligibility.availabilityEvidence
      if (
        availability.eventKind === 'separationFromService' &&
        availability.eventDate !== separationDate
      ) throw new RangeError('Penalty separation date must equal accepted source-availability evidence')
      const separationYear = Number(separationDate.slice(0, 4))
      const rule55Qualified = separationDate <= identity.evaluationDate &&
        separationYear >= ageEvidence.calendarYearParticipantAttains55
      ruleOf55Assessment = {
        exception: 'ruleOf55',
        disposition: rule55Qualified ? 'accepted' : 'refused',
        sourceAccountId: identity.sourceAccountId,
        participantPersonId: identity.participantPersonId,
        evaluationDate: identity.evaluationDate,
        separationDate,
        separationYear,
        calendarYearParticipantAttains55: ageEvidence.calendarYearParticipantAttains55,
        separationEvidenceId: separation.separationEvidenceId,
        evidenceId: stableId('employer-rule-of-55', [identity, separation, ageEvidence.evidenceId, rule55Qualified]),
      }
      if (disability !== null) requireDistinctEvidenceIds([separation.separationEvidenceId, disability.disabilityEvidenceId])
      if (rule55Qualified) outcome = 'ruleOf55Qualified'
      else {
        if (disability === null) return unsupported(identity, coverage, ageEvidence, 'disability', null, ruleOf55Assessment)
        if (snapshot.seppEvidence === null) return unsupported(identity, coverage, ageEvidence, 'sepp', null, ruleOf55Assessment, null, disability)
        sepp = seppAssessment(snapshot.seppEvidence, identity, separationDate, coverage)
        requireDistinctEvidenceIds([separation.separationEvidenceId, disability.disabilityEvidenceId, ...sepp.authorityEvidenceIds])
        if (sepp.disposition === 'provisional') {
          return unsupported(
            identity,
            coverage,
            ageEvidence,
            'seppAnnualReconciliation',
            null,
            ruleOf55Assessment,
            sepp,
            disability,
          )
        }
        else {
          if (snapshot.otherExceptionAttestation === null) {
            return unsupported(identity, coverage, ageEvidence, 'otherExceptionAttestation', null, ruleOf55Assessment, sepp, disability)
          }
          other = otherAssessment(snapshot.otherExceptionAttestation, identity)
          requireDistinctEvidenceIds([separation.separationEvidenceId, disability.disabilityEvidenceId, other.attestation.attestationEvidenceId, ...sepp.authorityEvidenceIds])
          if (other.disposition === 'unsupported') {
            return unsupported(identity, coverage, ageEvidence, 'otherExceptionAdjudication', other.attestation, ruleOf55Assessment, sepp, disability)
          }
          outcome = 'penaltyApplies'
          rateEvidence = {
            kind: 'traditionalEmployerPlanEarlyDistributionRate',
            numerator: 1,
            denominator: 10,
            quantization: 'nearestCentHalfUp',
            intermediateArithmetic: 'bigintRational',
            evidenceId: stableId('employer-plan-penalty-rate', [identity.sourceAccountId, 1, 10]),
          }
          const product = BigInt(taxableTreatmentAmount)
          finalPenaltyAmount = asUsdCents(Number(product / 10n + (product % 10n >= 5n ? 1n : 0n)))
        }
      }
    }
  }

  const evidence: AcceptedTraditionalEmployerPlanPenaltyEvidence = {
    predicate: 'employerPenaltyExceptionEvidence',
    outcome,
    ...identity,
    characterCoverage: coverage,
    ageEvidence,
    ruleOf55Assessment,
    disabilityEvidence: disability,
    seppAssessment: sepp,
    otherExceptionAssessment: other,
    rateEvidence,
    finalPenaltyAmount,
    evidenceId: stableId('employer-penalty-final', [
      identity, coverage.evidenceId, ageEvidence.evidenceId, outcome,
      ruleOf55Assessment?.evidenceId ?? null,
      disability, sepp?.evidenceId ?? null, other?.evidenceId ?? null,
      rateEvidence?.evidenceId ?? null, finalPenaltyAmount,
    ]),
  }
  return deepFreeze({ status: 'accepted', reasons: [], evidence })
}
