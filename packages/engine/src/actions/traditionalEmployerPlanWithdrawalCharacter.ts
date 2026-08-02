import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import { exactCentProRataNearestHalfUp } from './exactCentProRata.js'
import {
  accountIdSchema,
  actionIdSchema,
  allocationIdSchema,
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'

export type TraditionalEmployerPlanDistributableEventKind =
  | 'separationFromService'
  | 'inServiceWithdrawal'
  | 'planTermination'
  | 'requiredDistribution'

export interface TraditionalEmployerPlanDistributionAvailabilityEvidence {
  predicate: 'employerDistributionEligibility'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  participantPersonId: PersonId
  evaluationDate: string
  availabilityEvidence: Readonly<{
    kind: 'distributableEvent'
    eventKind: TraditionalEmployerPlanDistributableEventKind
    eventDate: string
    planTermsEvidenceId: string
    availableOnEvaluationDate: boolean
  }>
}

export interface TraditionalEmployerPlanBasisSnapshot {
  predicate: 'traditionalEmployerPlanBasisSnapshot'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  participantPersonId: PersonId
  evaluationDate: string
  preDistributionAccountValue: PositiveUsdCents
  afterTaxEmployeeBasisBeforeDistribution: UsdCents
  basisEvidenceId: string
}

export interface ClassifyTraditionalEmployerPlanWithdrawalInput {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  participantPersonId: PersonId
  evaluationDate: string
  executedAmount: UsdCents
  availabilityEvidence:
    Readonly<TraditionalEmployerPlanDistributionAvailabilityEvidence> | null
  basisSnapshot: Readonly<TraditionalEmployerPlanBasisSnapshot> | null
}

export interface TraditionalEmployerPlanWithdrawalBasisEvidence {
  rule: 'proRataSingleDistribution'
  sourcePlanAccountId: AccountId
  preDistributionAccountValue: PositiveUsdCents
  afterTaxEmployeeBasisBeforeDistribution: UsdCents
  aggregateBasisRatio: Readonly<{
    representation: 'exactMinorUnitRational'
    numeratorMinorUnits: UsdCents
    denominatorMinorUnits: PositiveUsdCents
    intermediateArithmetic: 'bigintRational'
  }>
  executedAmount: UsdCents
  basisRecoveredAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  basisRecoveryQuantization: 'nearestCentHalfUp'
  basisEvidenceId: string
}

export interface AcceptedTraditionalEmployerPlanSourceEligibilityEvidence {
  predicate: 'employerDistributionEligibility'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  participantPersonId: PersonId
  evaluationDate: string
  sourceClass: 'traditionalEmployerPlan'
  availabilityEvidence: Readonly<{
    kind: 'distributableEvent'
    eventKind: TraditionalEmployerPlanDistributableEventKind
    eventDate: string
    planTermsEvidenceId: string
    availableOnEvaluationDate: true
  }>
  basisEvidence: Readonly<TraditionalEmployerPlanWithdrawalBasisEvidence>
}

interface TraditionalEmployerPlanWithdrawalTaxCharacterBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'traditionalEmployerPlan'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'employerPlanProRataBasis'
    allocationId: AllocationId
    basisEvidenceId: string
    segmentAmount: PositiveUsdCents
  }>
}

export interface TraditionalEmployerPlanBasisReturnTaxCharacter
  extends TraditionalEmployerPlanWithdrawalTaxCharacterBase {
  kind: 'basisReturn'
}

export interface TraditionalEmployerPlanOrdinaryIncomeTaxCharacter
  extends TraditionalEmployerPlanWithdrawalTaxCharacterBase {
  kind: 'ordinaryIncome'
}

export type TraditionalEmployerPlanWithdrawalTaxCharacter =
  | TraditionalEmployerPlanBasisReturnTaxCharacter
  | TraditionalEmployerPlanOrdinaryIncomeTaxCharacter

export interface AcceptedTraditionalEmployerPlanWithdrawalClassification {
  status: 'accepted'
  reasons: readonly []
  acceptedSourceEligibility:
    Readonly<AcceptedTraditionalEmployerPlanSourceEligibilityEvidence>
  taxCharacter: readonly TraditionalEmployerPlanWithdrawalTaxCharacter[]
}

export interface UnknownTraditionalEmployerPlanAvailabilityClassification {
  status: 'unsupported'
  reasons: readonly [ActionReason<'withdrawal-plan-availability-unknown'>]
  acceptedSourceEligibility: null
  taxCharacter: readonly []
}

export interface UnavailableTraditionalEmployerPlanWithdrawalClassification {
  status: 'refused'
  reasons: readonly [ActionReason<'withdrawal-plan-not-available'>]
  acceptedSourceEligibility: null
  taxCharacter: readonly []
}

export interface UnsupportedTraditionalEmployerPlanBasisClassification {
  status: 'unsupported'
  reasons: readonly [ActionReason<'withdrawal-employer-basis-unsupported'>]
  acceptedSourceEligibility: null
  taxCharacter: readonly []
}

export type ClassifyTraditionalEmployerPlanWithdrawalResult =
  | AcceptedTraditionalEmployerPlanWithdrawalClassification
  | UnknownTraditionalEmployerPlanAvailabilityClassification
  | UnavailableTraditionalEmployerPlanWithdrawalClassification
  | UnsupportedTraditionalEmployerPlanBasisClassification

const eventKinds = new Set<TraditionalEmployerPlanDistributableEventKind>([
  'separationFromService',
  'inServiceWithdrawal',
  'planTermination',
  'requiredDistribution',
])

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function parsedCanonicalDate(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const parsed = parseCivilIsoDate(value)
  return parsed === null ? null : formatCivilDate(parsed)
}

function matchesIdentity(
  evidence: Readonly<{
    actionId: ActionId
    allocationId: AllocationId
    sourceAccountId: AccountId
    participantPersonId: PersonId
    evaluationDate: string
  }>,
  input: Readonly<{
    actionId: ActionId
    allocationId: AllocationId
    sourceAccountId: AccountId
    participantPersonId: PersonId
    evaluationDate: string
  }>,
): boolean {
  return evidence.actionId === input.actionId &&
    evidence.allocationId === input.allocationId &&
    evidence.sourceAccountId === input.sourceAccountId &&
    evidence.participantPersonId === input.participantPersonId &&
    evidence.evaluationDate === input.evaluationDate
}

function reasonIdentifiers(input: Readonly<{
  allocationId: AllocationId
  sourceAccountId: AccountId
  participantPersonId: PersonId
}>) {
  return {
    personId: input.participantPersonId,
    accountId: input.sourceAccountId,
    allocationId: input.allocationId,
  }
}

function availabilityUnknown(
  input: Readonly<{
    allocationId: AllocationId
    sourceAccountId: AccountId
    participantPersonId: PersonId
  }>,
): Readonly<UnknownTraditionalEmployerPlanAvailabilityClassification> {
  return deepFreeze({
    status: 'unsupported',
    reasons: [createActionReason(
      'withdrawal-plan-availability-unknown',
      reasonIdentifiers(input),
    )],
    acceptedSourceEligibility: null,
    taxCharacter: [],
  })
}

function unavailable(
  input: Readonly<{
    allocationId: AllocationId
    sourceAccountId: AccountId
    participantPersonId: PersonId
  }>,
): Readonly<UnavailableTraditionalEmployerPlanWithdrawalClassification> {
  return deepFreeze({
    status: 'refused',
    reasons: [createActionReason(
      'withdrawal-plan-not-available',
      reasonIdentifiers(input),
    )],
    acceptedSourceEligibility: null,
    taxCharacter: [],
  })
}

function basisUnsupported(
  input: Readonly<{
    allocationId: AllocationId
    sourceAccountId: AccountId
    participantPersonId: PersonId
  }>,
): Readonly<UnsupportedTraditionalEmployerPlanBasisClassification> {
  return deepFreeze({
    status: 'unsupported',
    reasons: [createActionReason(
      'withdrawal-employer-basis-unsupported',
      reasonIdentifiers(input),
    )],
    acceptedSourceEligibility: null,
    taxCharacter: [],
  })
}

/**
 * Pure evidence boundary for one traditional employer-plan distribution.
 * It derives exact tax character but never moves money or evaluates penalty.
 */
export function classifyTraditionalEmployerPlanWithdrawal(
  input: Readonly<ClassifyTraditionalEmployerPlanWithdrawalInput>,
): Readonly<ClassifyTraditionalEmployerPlanWithdrawalResult> {
  const actionId = actionIdSchema.parse(input.actionId)
  const allocationId = allocationIdSchema.parse(input.allocationId)
  const sourceAccountId = accountIdSchema.parse(input.sourceAccountId)
  const participantPersonId = personIdSchema.parse(input.participantPersonId)
  const evaluationDate = parsedCanonicalDate(input.evaluationDate)
  if (evaluationDate === null || evaluationDate !== input.evaluationDate) {
    throw new RangeError('Employer-plan withdrawal evaluation date must be canonical')
  }
  const executedAmount = usdCentsSchema.parse(input.executedAmount)
  const identity = {
    actionId,
    allocationId,
    sourceAccountId,
    participantPersonId,
    evaluationDate,
  }

  const availability = input.availabilityEvidence
  const event = availability?.availabilityEvidence
  const eventDate = parsedCanonicalDate(event?.eventDate)
  if (
    availability == null ||
    availability.predicate !== 'employerDistributionEligibility' ||
    !matchesIdentity(availability, identity) ||
    event?.kind !== 'distributableEvent' ||
    !eventKinds.has(event.eventKind) ||
    eventDate === null ||
    eventDate !== event.eventDate ||
    !nonblank(event.planTermsEvidenceId) ||
    typeof event.availableOnEvaluationDate !== 'boolean' ||
    (event.availableOnEvaluationDate && eventDate > evaluationDate)
  ) {
    return availabilityUnknown(identity)
  }
  if (!event.availableOnEvaluationDate) return unavailable(identity)

  const basis = input.basisSnapshot
  const preDistributionAccountValue = positiveUsdCentsSchema.safeParse(
    basis?.preDistributionAccountValue,
  )
  const afterTaxEmployeeBasisBeforeDistribution = usdCentsSchema.safeParse(
    basis?.afterTaxEmployeeBasisBeforeDistribution,
  )
  if (
    basis == null ||
    basis.predicate !== 'traditionalEmployerPlanBasisSnapshot' ||
    !matchesIdentity(basis, identity) ||
    !preDistributionAccountValue.success ||
    !afterTaxEmployeeBasisBeforeDistribution.success ||
    !nonblank(basis.basisEvidenceId) ||
    afterTaxEmployeeBasisBeforeDistribution.data >
      preDistributionAccountValue.data ||
    executedAmount > preDistributionAccountValue.data
  ) {
    return basisUnsupported(identity)
  }

  const basisRecoveredAmount = asUsdCents(Number(
    exactCentProRataNearestHalfUp(
      BigInt(executedAmount),
      BigInt(afterTaxEmployeeBasisBeforeDistribution.data),
      BigInt(preDistributionAccountValue.data),
    ),
  ))
  const ordinaryIncomeAmount = asUsdCents(
    executedAmount - basisRecoveredAmount,
  )
  const basisEvidence: TraditionalEmployerPlanWithdrawalBasisEvidence = {
    rule: 'proRataSingleDistribution',
    sourcePlanAccountId: sourceAccountId,
    preDistributionAccountValue: preDistributionAccountValue.data,
    afterTaxEmployeeBasisBeforeDistribution:
      afterTaxEmployeeBasisBeforeDistribution.data,
    aggregateBasisRatio: {
      representation: 'exactMinorUnitRational',
      numeratorMinorUnits: afterTaxEmployeeBasisBeforeDistribution.data,
      denominatorMinorUnits: preDistributionAccountValue.data,
      intermediateArithmetic: 'bigintRational',
    },
    executedAmount,
    basisRecoveredAmount,
    ordinaryIncomeAmount,
    basisRecoveryQuantization: 'nearestCentHalfUp',
    basisEvidenceId: basis.basisEvidenceId,
  }
  const characterEvidence = (amount: PositiveUsdCents) => ({
    rule: 'employerPlanProRataBasis' as const,
    allocationId,
    basisEvidenceId: basis.basisEvidenceId,
    segmentAmount: amount,
  })
  const taxCharacter: TraditionalEmployerPlanWithdrawalTaxCharacter[] = []
  if (basisRecoveredAmount > 0) {
    const amount = asPositiveUsdCents(basisRecoveredAmount)
    taxCharacter.push({
      actionId,
      allocationId,
      sourceAccountId,
      sourceClass: 'traditionalEmployerPlan',
      kind: 'basisReturn',
      amount,
      characterEvidence: characterEvidence(amount),
    })
  }
  if (ordinaryIncomeAmount > 0) {
    const amount = asPositiveUsdCents(ordinaryIncomeAmount)
    taxCharacter.push({
      actionId,
      allocationId,
      sourceAccountId,
      sourceClass: 'traditionalEmployerPlan',
      kind: 'ordinaryIncome',
      amount,
      characterEvidence: characterEvidence(amount),
    })
  }

  return deepFreeze({
    status: 'accepted',
    reasons: [],
    acceptedSourceEligibility: {
      predicate: 'employerDistributionEligibility',
      actionId,
      allocationId,
      sourceAccountId,
      participantPersonId,
      evaluationDate,
      sourceClass: 'traditionalEmployerPlan',
      availabilityEvidence: {
        kind: 'distributableEvent',
        eventKind: event.eventKind,
        eventDate,
        planTermsEvidenceId: event.planTermsEvidenceId,
        availableOnEvaluationDate: true,
      },
      basisEvidence,
    },
    taxCharacter,
  })
}
