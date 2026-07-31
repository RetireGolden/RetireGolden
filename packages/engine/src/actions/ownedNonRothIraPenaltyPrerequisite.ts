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
  asUsdCents,
  positiveUsdCentsSchema,
  usdCentsSchema,
  type UsdCents,
} from './money.js'
import { addCalendarMonths, parseCivilIsoDate } from './civilDate.js'
import {
  classifyOwnedNonRothIraAnnualWithdrawals,
  type ClassifyOwnedNonRothIraAnnualWithdrawalsResult,
  type OwnedNonRothIraSubtype,
  type OwnedNonRothIraWithdrawalClassification,
} from './ownedNonRothIraWithdrawalCharacter.js'

export interface OwnedNonRothIraPenaltyOwnerEvidence {
  predicate: 'ownerBirthDateForIraPenaltyAgeThreshold'
  ownerPersonId: PersonId
  birthDate: string
  evidenceId: string
}

export interface OwnedNonRothIraPenaltySourceEvidence {
  predicate: 'ownedNonRothIraPenaltySourceForWithdrawal'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  subtype: OwnedNonRothIraSubtype
  evaluationDate: string
  distributionDateEvidenceId: string
  accountOwnershipEvidenceId: string
  iraClassificationEvidenceId: string
}

export interface SimpleIraParticipationEvidence {
  predicate: 'simpleIraParticipationStartForPenaltyRate'
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  participationStartDate: string
  participationStartEvidenceId: string
}

export interface QualifiedDisabilityEventEvidence {
  kind: 'disability'
  disabledPersonId: PersonId
  disabilityQualificationDate: string
  evaluationDate: string
  qualifiedOnEvaluationDate: true
  disabilityEvidenceId: string
}

export interface RejectedDisabilityStatusEvidence {
  kind: 'disability'
  disabledPersonId: PersonId
  disabilityQualificationDate: string | null
  evaluationDate: string
  qualifiedOnEvaluationDate: false
  disabilityEvidenceId: string
}

export interface OwnedNonRothIraOwnerAliveEvidence {
  predicate: 'ownerAliveOnOwnedIraDistributionDate'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  distributionDateEvidenceId: string
  aliveOnEvaluationDate: true
  ownerAliveEvidenceId: string
}

export interface OwnedNonRothIraNoSeppStatusEvidence {
  predicate: 'ownedNonRothIraSeppStatusForWithdrawal'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  status: 'none'
  electionId: null
  scheduleId: null
  seppStatusEvidenceId: string
}

export interface NoOtherStatutoryExceptionClaimedAttestation {
  predicate: 'noOtherStatutoryExceptionClaimed'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  attested: true
  evidenceScope: 'planningEvidenceNotFilingGradeLegalAdjudication'
  attestationEvidenceId: string
}

export interface EvaluateOwnedNonRothIraPenaltyPrerequisitesInput {
  characterization: Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsResult>
  ownerEvidence: Readonly<OwnedNonRothIraPenaltyOwnerEvidence>
  sourceEvidence: readonly Readonly<OwnedNonRothIraPenaltySourceEvidence>[]
  qualifiedDisabilityEvidence?:
    readonly Readonly<QualifiedDisabilityEventEvidence>[]
  rejectedDisabilityEvidence?:
    readonly Readonly<RejectedDisabilityStatusEvidence>[]
  ownerAliveEvidence?:
    readonly Readonly<OwnedNonRothIraOwnerAliveEvidence>[]
  iraSeppStatusEvidence?:
    readonly Readonly<OwnedNonRothIraNoSeppStatusEvidence>[]
  noOtherExceptionAttestations?:
    readonly Readonly<NoOtherStatutoryExceptionClaimedAttestation>[]
  simpleParticipationEvidence:
    readonly Readonly<SimpleIraParticipationEvidence>[]
}

export interface OwnedNonRothIraPenaltyAgeThresholdEvidence {
  predicate: 'ownedNonRothIraOwnerAge59HalfThreshold'
  ownerPersonId: PersonId
  birthDate: string
  age59HalfDate: string
  birthDateEvidenceId: string
  calculation: 'addCalendarMonths714WithMonthEndClamp'
  evidenceId: string
}

export interface OwnedNonRothIraPenaltyCharacterCoverageEvidence {
  predicate: 'completeOwnedNonRothIraPenaltyCharacterCoverageForAllocation'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  subtype: OwnedNonRothIraSubtype
  evaluationDate: string
  executedAmount: UsdCents
  basisReturnExcludedAmount: UsdCents
  ordinaryIncomeExposureAmount: UsdCents
  basisEvidenceId: string
  line7AllocationEvidenceId: string
  characterEvidenceIds: readonly string[]
  sourceEvidenceIds: Readonly<{
    distributionDateEvidenceId: string
    accountOwnershipEvidenceId: string
    iraClassificationEvidenceId: string
  }>
  ageThresholdEvidenceId: string
  evidenceId: string
}

export interface StandardIraEarlyDistributionRateEvidence {
  kind: 'traditionalOrSepStandardRate'
  subtype: 'traditional' | 'sep'
  numerator: 1
  denominator: 10
  quantization: 'nearestCentHalfUp'
  intermediateArithmetic: 'bigintRational'
  evidenceId: string
}

export interface SimpleIraEarlyDistributionRateEvidence {
  kind: 'simpleIraParticipationRate'
  phase: 'initialTwoYearPeriod' | 'standardAfterTwoYearPeriod'
  numerator: 1
  denominator: 4 | 10
  participationStartDate: string
  initialTwoYearPeriodEndDate: string
  participationStartEvidenceId: string
  quantization: 'nearestCentHalfUp'
  intermediateArithmetic: 'bigintRational'
  evidenceId: string
}

export type OwnedNonRothIraEarlyDistributionRateEvidence =
  | StandardIraEarlyDistributionRateEvidence
  | SimpleIraEarlyDistributionRateEvidence

interface OwnedNonRothIraPenaltyEvaluationBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  subtype: OwnedNonRothIraSubtype
  evaluationDate: string
  characterCoverage:
    Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>
}

export interface Age59HalfReachedPenaltyEvaluation
  extends OwnedNonRothIraPenaltyEvaluationBase {
  outcome: 'age59HalfReached'
  evaluatedOrdinaryIncomeExposureAmount: UsdCents
  finalPenaltyAmount: 0
  finalEvidenceId: string
}

export interface DisabilityQualifiedPenaltyEvaluation
  extends OwnedNonRothIraPenaltyEvaluationBase {
  outcome: 'disabilityQualified'
  evaluatedOrdinaryIncomeExposureAmount: UsdCents
  disabilityEvent: Readonly<QualifiedDisabilityEventEvidence>
  finalPenaltyAmount: 0
  finalEvidenceId: string
}

export interface ExceptionEvaluationRequiredPenaltyPrerequisite
  extends OwnedNonRothIraPenaltyEvaluationBase {
  outcome: 'exceptionEvaluationRequired'
  evaluatedOrdinaryIncomeExposureAmount: UsdCents
  candidateAmountBeforeExceptions: UsdCents
  rateEvidence: Readonly<OwnedNonRothIraEarlyDistributionRateEvidence>
  prerequisiteEvidenceId: string
}

export interface RejectedAge59HalfExceptionEvidence {
  exception: 'age59Half'
  disposition: 'rejected'
  evaluationDate: string
  age59HalfDate: string
  ageThresholdEvidenceId: string
  evidenceId: string
}

export interface RejectedDeathExceptionEvidence {
  exception: 'death'
  disposition: 'rejected'
  ownerAliveEvidence: Readonly<OwnedNonRothIraOwnerAliveEvidence>
  evidenceId: string
}

export interface RejectedIraSeppExceptionEvidence {
  exception: 'iraSepp'
  disposition: 'rejected'
  noSeppEvidence: Readonly<OwnedNonRothIraNoSeppStatusEvidence>
  evidenceId: string
}

export interface RejectedDisabilityExceptionEvidence {
  exception: 'disability'
  disposition: 'rejected'
  rejectedDisabilityEvidence:
    Readonly<RejectedDisabilityStatusEvidence>
  evidenceId: string
}

export interface RejectedOtherStatutoryExceptionEvidence {
  exception: 'otherStatutoryException'
  disposition: 'rejected'
  attestation:
    Readonly<NoOtherStatutoryExceptionClaimedAttestation>
  evidenceId: string
}

export type RejectedOwnedNonRothIraPenaltyExceptionTuple = readonly [
  Readonly<RejectedAge59HalfExceptionEvidence>,
  Readonly<RejectedDeathExceptionEvidence>,
  Readonly<RejectedIraSeppExceptionEvidence>,
  Readonly<RejectedDisabilityExceptionEvidence>,
  Readonly<RejectedOtherStatutoryExceptionEvidence>,
]

export interface PenaltyAppliesEvaluation
  extends OwnedNonRothIraPenaltyEvaluationBase {
  outcome: 'penaltyApplies'
  evaluatedOrdinaryIncomeExposureAmount: UsdCents
  candidateAmountBeforeExceptions: UsdCents
  rateEvidence: Readonly<OwnedNonRothIraEarlyDistributionRateEvidence>
  rejectedExceptions:
    Readonly<RejectedOwnedNonRothIraPenaltyExceptionTuple>
  finalPenaltyAmount: UsdCents
  finalEvidenceId: string
}

export type OwnedNonRothIraPenaltyPrerequisiteEvaluation =
  | Age59HalfReachedPenaltyEvaluation
  | DisabilityQualifiedPenaltyEvaluation
  | PenaltyAppliesEvaluation
  | ExceptionEvaluationRequiredPenaltyPrerequisite

export interface EvaluateOwnedNonRothIraPenaltyPrerequisitesResult {
  taxYear: number
  ownerPersonId: PersonId
  ageThresholdEvidence: Readonly<OwnedNonRothIraPenaltyAgeThresholdEvidence>
  coverage:
    readonly Readonly<OwnedNonRothIraPenaltyCharacterCoverageEvidence>[]
  evaluations:
    readonly Readonly<OwnedNonRothIraPenaltyPrerequisiteEvaluation>[]
}

function nonblankId(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new TypeError(`${label} must be a nonblank stable identifier`)
  }
  return value
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

function stableId(prefix: string, parts: readonly unknown[]): string {
  return `${prefix}:${JSON.stringify(parts)}`
}

function structuralValue(
  value: unknown,
  ancestors: WeakSet<object>,
): unknown {
  if (value === null) return ['null']
  if (Array.isArray(value)) {
    if (ancestors.has(value)) {
      throw new TypeError('IRA characterization must be acyclic')
    }
    ancestors.add(value)
    const result = ['array', value.map((entry) =>
      structuralValue(entry, ancestors))]
    ancestors.delete(value)
    return result
  }
  switch (typeof value) {
    case 'string':
      return ['string', value]
    case 'number':
      return [
        'number',
        Number.isFinite(value) ? value : String(value),
      ]
    case 'boolean':
      return ['boolean', value]
    case 'undefined':
      return ['undefined']
    case 'bigint':
      return ['bigint', value.toString()]
    case 'object': {
      if (ancestors.has(value)) {
        throw new TypeError('IRA characterization must be acyclic')
      }
      ancestors.add(value)
      const entries = Object.keys(value)
        .sort()
        .map((key) => [
          key,
          structuralValue(
            (value as Record<string, unknown>)[key],
            ancestors,
          ),
        ])
      ancestors.delete(value)
      return ['object', entries]
    }
    default:
      return [typeof value, String(value)]
  }
}

function stableStructuralSnapshot(value: unknown): string {
  return JSON.stringify(structuralValue(value, new WeakSet()))
}

function identityKey(
  actionId: ActionId,
  allocationId: AllocationId,
): string {
  return JSON.stringify([actionId, allocationId])
}

function validateCivilDate(value: string, label: string): string {
  if (parseCivilIsoDate(value) === null) {
    throw new RangeError(`${label} must be a canonical civil ISO date`)
  }
  return value
}

function validateSubtype(value: unknown): OwnedNonRothIraSubtype {
  if (value !== 'traditional' && value !== 'sep' && value !== 'simple') {
    throw new RangeError(
      'IRA penalty source subtype must be traditional, SEP, or SIMPLE',
    )
  }
  return value
}

function candidateAmount(
  exposureAmount: UsdCents,
  numerator: 1,
  denominator: 4 | 10,
): UsdCents {
  const product = BigInt(exposureAmount) * BigInt(numerator)
  const divisor = BigInt(denominator)
  const quotient = product / divisor
  const remainder = product % divisor
  const rounded = quotient + (remainder * 2n >= divisor ? 1n : 0n)
  if (rounded > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('IRA penalty candidate exceeded the safe-integer range')
  }
  return asUsdCents(Number(rounded))
}

interface ValidatedCharacter {
  basisReturnAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  characterEvidenceIds: string[]
  basisEvidenceId: string
}

function validateCharacter(
  withdrawal: Readonly<OwnedNonRothIraWithdrawalClassification>,
  line7AllocationEvidenceId: string,
): ValidatedCharacter {
  const executedAmount = positiveUsdCentsSchema.parse(withdrawal.executedAmount)
  const basisRecoveredAmount = usdCentsSchema.parse(
    withdrawal.basisRecoveredAmount,
  )
  const ordinaryIncomeAmount = usdCentsSchema.parse(
    withdrawal.ordinaryIncomeAmount,
  )
  if (
    BigInt(basisRecoveredAmount) + BigInt(ordinaryIncomeAmount) !==
    BigInt(executedAmount)
  ) {
    throw new RangeError(
      'IRA withdrawal basis and ordinary-income amounts must reconcile to execution',
    )
  }

  let basisReturnAmount = 0n
  let ordinaryCharacterAmount = 0n
  const kinds = new Set<string>()
  const characterEvidenceIds = new Set<string>()
  let basisEvidenceId: string | undefined
  for (const segment of withdrawal.taxCharacter) {
    if (
      segment.kind !== 'basisReturn' &&
      segment.kind !== 'ordinaryIncome'
    ) {
      throw new RangeError('IRA withdrawal contains foreign tax character')
    }
    if (kinds.has(segment.kind)) {
      throw new RangeError('IRA withdrawal tax character kinds must be unique')
    }
    kinds.add(segment.kind)
    if (
      actionIdSchema.parse(segment.actionId) !== withdrawal.actionId ||
      allocationIdSchema.parse(segment.allocationId) !==
        withdrawal.allocationId ||
      accountIdSchema.parse(segment.sourceAccountId) !==
        withdrawal.sourceAccountId ||
      segment.sourceClass !== 'ownedNonRothIra' ||
      segment.characterEvidence.rule !==
        'ownerWideAnnualIraBasisAllocation' ||
      allocationIdSchema.parse(segment.characterEvidence.allocationId) !==
        withdrawal.allocationId ||
      segment.characterEvidence.allocationEvidenceId !==
        line7AllocationEvidenceId
    ) {
      throw new RangeError(
        'IRA withdrawal character must bind its allocation and annual line-7 evidence',
      )
    }
    const amount = positiveUsdCentsSchema.parse(segment.amount)
    if (
      positiveUsdCentsSchema.parse(
        segment.characterEvidence.segmentAmount,
      ) !== amount
    ) {
      throw new RangeError(
        'IRA withdrawal character evidence amount must match its segment',
      )
    }
    const segmentBasisEvidenceId = nonblankId(
      segment.characterEvidence.basisEvidenceId,
      'IRA character basis evidence ID',
    )
    if (
      basisEvidenceId !== undefined &&
      basisEvidenceId !== segmentBasisEvidenceId
    ) {
      throw new RangeError(
        'IRA withdrawal character must share one annual basis evidence ID',
      )
    }
    basisEvidenceId = segmentBasisEvidenceId
    const characterEvidenceId = stableId('owned-ira-character-segment', [
      segment.actionId,
      segment.allocationId,
      segment.sourceAccountId,
      segment.kind,
      amount,
      segment.characterEvidence,
    ])
    if (characterEvidenceIds.has(characterEvidenceId)) {
      throw new RangeError('IRA withdrawal character evidence must be unique')
    }
    characterEvidenceIds.add(characterEvidenceId)
    if (segment.kind === 'basisReturn') {
      basisReturnAmount += BigInt(amount)
    } else {
      ordinaryCharacterAmount += BigInt(amount)
    }
  }
  if (
    basisReturnAmount !== BigInt(basisRecoveredAmount) ||
    ordinaryCharacterAmount !== BigInt(ordinaryIncomeAmount) ||
    (basisRecoveredAmount > 0 && !kinds.has('basisReturn')) ||
    (ordinaryIncomeAmount > 0 && !kinds.has('ordinaryIncome')) ||
    basisEvidenceId === undefined
  ) {
    throw new RangeError(
      'IRA withdrawal character must exactly cover basis and ordinary income',
    )
  }
  return {
    basisReturnAmount: basisRecoveredAmount,
    ordinaryIncomeAmount,
    characterEvidenceIds: [...characterEvidenceIds],
    basisEvidenceId,
  }
}

function validateSourceEvidence(
  input: Readonly<OwnedNonRothIraPenaltySourceEvidence>,
  withdrawal: Readonly<OwnedNonRothIraWithdrawalClassification>,
  scheduledDate: string | null,
  ownerPersonId: PersonId,
  taxYear: number,
  poolMember: Readonly<{
    subtype: OwnedNonRothIraSubtype
    accountOwnershipEvidenceId: string
    iraClassificationEvidenceId: string
  }>,
): OwnedNonRothIraPenaltySourceEvidence {
  const evaluationDate = validateCivilDate(
    input.evaluationDate,
    'IRA distribution evaluation date',
  )
  if (Number(evaluationDate.slice(0, 4)) !== taxYear) {
    throw new RangeError(
      'IRA distribution evaluation date must be in the classified tax year',
    )
  }
  if (
    scheduledDate === null ||
    validateCivilDate(
      scheduledDate,
      'Annual line-7 allocation scheduled date',
    ) !== evaluationDate
  ) {
    throw new RangeError(
      'IRA distribution evaluation date must exactly match the dated annual line-7 allocation',
    )
  }
  const result: OwnedNonRothIraPenaltySourceEvidence = {
    predicate: input.predicate,
    actionId: actionIdSchema.parse(input.actionId),
    allocationId: allocationIdSchema.parse(input.allocationId),
    sourceAccountId: accountIdSchema.parse(input.sourceAccountId),
    ownerPersonId: personIdSchema.parse(input.ownerPersonId),
    subtype: validateSubtype(input.subtype),
    evaluationDate,
    distributionDateEvidenceId: nonblankId(
      input.distributionDateEvidenceId,
      'IRA distribution-date evidence ID',
    ),
    accountOwnershipEvidenceId: nonblankId(
      input.accountOwnershipEvidenceId,
      'IRA account-ownership evidence ID',
    ),
    iraClassificationEvidenceId: nonblankId(
      input.iraClassificationEvidenceId,
      'IRA-classification evidence ID',
    ),
  }
  if (
    result.predicate !== 'ownedNonRothIraPenaltySourceForWithdrawal' ||
    result.actionId !== withdrawal.actionId ||
    result.allocationId !== withdrawal.allocationId ||
    result.sourceAccountId !== withdrawal.sourceAccountId ||
    result.ownerPersonId !== ownerPersonId ||
    result.subtype !== withdrawal.subtype ||
    result.subtype !== poolMember.subtype ||
    result.accountOwnershipEvidenceId !==
      poolMember.accountOwnershipEvidenceId ||
    result.iraClassificationEvidenceId !==
      poolMember.iraClassificationEvidenceId
  ) {
    throw new RangeError(
      'IRA penalty source evidence must exactly bind the characterized withdrawal',
    )
  }
  return result
}

/**
 * Builds the exact early-distribution-penalty prerequisite boundary for
 * finalized owned traditional, SEP, and SIMPLE IRA line-7 character.
 *
 * An under-59½ result remains only a candidate unless exact negative evidence
 * rejects death, IRA SEPP, disability, and the planning-attested other
 * statutory-exception scope. A final penalty outcome still establishes no
 * action readiness or committed movement.
 */
export function evaluateOwnedNonRothIraPenaltyPrerequisites(
  input: Readonly<EvaluateOwnedNonRothIraPenaltyPrerequisitesInput>,
): Readonly<EvaluateOwnedNonRothIraPenaltyPrerequisitesResult> {
  const suppliedCharacterization = input.characterization
  const suppliedAnnualBasis = suppliedCharacterization.annualBasisEvidence
  const characterization = classifyOwnedNonRothIraAnnualWithdrawals({
    ownerPersonId: suppliedAnnualBasis.ownerPersonId,
    ownerWideNonRothIraPoolId:
      suppliedAnnualBasis.ownerWideNonRothIraPoolId,
    completePoolEvidence: suppliedAnnualBasis.completePoolEvidence,
    annualBasisRecordEvidenceId:
      suppliedAnnualBasis.annualBasisRecordEvidenceId,
    taxYear: suppliedAnnualBasis.taxYear,
    poolMembers: suppliedAnnualBasis.poolMembers,
    annualFacts: {
      openingBasisAmount: suppliedAnnualBasis.openingBasisAmount,
      taxYearNondeductibleContributionAmount:
        suppliedAnnualBasis.taxYearNondeductibleContributionAmount,
      postYearNondeductibleContributionExcludedAmount:
        suppliedAnnualBasis.postYearNondeductibleContributionExcludedAmount,
      yearEndApplicablePoolBalanceAmount:
        suppliedAnnualBasis.yearEndApplicablePoolBalanceAmount,
      outstandingRolloverAmount:
        suppliedAnnualBasis.outstandingRolloverAmount,
      rolloverRepaymentAdjustmentAmount:
        suppliedAnnualBasis.rolloverRepaymentAdjustmentAmount,
      form8606Line7DistributionAmount:
        suppliedAnnualBasis.form8606Line7DistributionAmount,
      form8606Line8NetConversionAmount:
        suppliedAnnualBasis.form8606Line8NetConversionAmount,
    },
    line7Distributions:
      suppliedCharacterization.line7AllocationEvidence.allocations.map(
        (entry) => ({
          actionId: entry.actionId,
          allocationId: entry.allocationId,
          sourceAccountId: entry.sourceAccountId,
          scheduledDate: entry.scheduledDate,
          scheduledSequence: entry.scheduledSequence,
          grossAmount: entry.grossAmount,
        }),
      ),
    line8Conversions:
      suppliedCharacterization.line8AllocationEvidence.allocations.map(
        (entry) => ({
          actionId: entry.actionId,
          allocationId: entry.allocationId,
          sourceAccountId: entry.sourceAccountId,
          scheduledDate: entry.scheduledDate,
          scheduledSequence: entry.scheduledSequence,
          grossAmount: entry.grossAmount,
        }),
      ),
  })
  if (
    stableStructuralSnapshot(suppliedCharacterization) !==
    stableStructuralSnapshot(characterization)
  ) {
    throw new RangeError(
      'Supplied IRA characterization must exactly equal its canonical rederived result',
    )
  }

  const annualBasisEvidence = characterization.annualBasisEvidence
  const ownerPersonId = personIdSchema.parse(
    annualBasisEvidence.ownerPersonId,
  )
  const taxYear = annualBasisEvidence.taxYear
  if (!Number.isSafeInteger(taxYear) || taxYear < 1 || taxYear > 9999) {
    throw new RangeError('IRA penalty tax year must be a four-digit year')
  }
  if (
    characterization.line7AllocationEvidence.calculationScope !==
      'form8606Line7Distributions' ||
    characterization.line7AllocationEvidence.taxYear !== taxYear ||
    characterization.line7AllocationEvidence.poolId !==
      annualBasisEvidence.ownerWideNonRothIraPoolId
  ) {
    throw new RangeError(
      'IRA penalty input must carry allocation-bound annual line-7 evidence',
    )
  }
  const line7AllocationEvidenceId = nonblankId(
    characterization.line7AllocationEvidence.allocationEvidenceId,
    'Form 8606 line-7 allocation evidence ID',
  )
  const annualBasisEvidenceId = nonblankId(
    annualBasisEvidence.basisEvidenceId,
    'Annual IRA basis evidence ID',
  )
  const authoritativeLine7GrossAmount = usdCentsSchema.parse(
    annualBasisEvidence.form8606Line7DistributionAmount,
  )
  const line7AnnualGrossAmount = usdCentsSchema.parse(
    characterization.line7AllocationEvidence.annualGrossAmount,
  )
  const line7AnnualBasisAmount = usdCentsSchema.parse(
    characterization.line7AllocationEvidence
      .annualNontaxableBasisAmount,
  )
  const line7AnnualTaxableAmount = usdCentsSchema.parse(
    characterization.line7AllocationEvidence.annualTaxableAmount,
  )
  if (
    line7AnnualGrossAmount !== authoritativeLine7GrossAmount ||
    BigInt(line7AnnualBasisAmount) + BigInt(line7AnnualTaxableAmount) !==
      BigInt(line7AnnualGrossAmount)
  ) {
    throw new RangeError(
      'Annual line-7 gross, basis, and taxable totals must reconcile to authoritative Form 8606 evidence',
    )
  }

  const birthDate = validateCivilDate(
    input.ownerEvidence.birthDate,
    'IRA owner birth date',
  )
  const birthDateEvidenceId = nonblankId(
    input.ownerEvidence.evidenceId,
    'IRA owner birth-date evidence ID',
  )
  if (
    input.ownerEvidence.predicate !==
      'ownerBirthDateForIraPenaltyAgeThreshold' ||
    personIdSchema.parse(input.ownerEvidence.ownerPersonId) !== ownerPersonId
  ) {
    throw new RangeError(
      'IRA owner birth-date evidence must bind the characterized owner',
    )
  }
  const age59HalfDate = addCalendarMonths(birthDate, 714)
  if (age59HalfDate === null) {
    throw new RangeError('IRA owner age-59½ threshold is outside civil-date range')
  }
  const ageThresholdEvidenceId = stableId('owned-ira-age-59-half', [
    ownerPersonId,
    birthDate,
    age59HalfDate,
    birthDateEvidenceId,
  ])
  const ageThresholdEvidence: OwnedNonRothIraPenaltyAgeThresholdEvidence = {
    predicate: 'ownedNonRothIraOwnerAge59HalfThreshold',
    ownerPersonId,
    birthDate,
    age59HalfDate,
    birthDateEvidenceId,
    calculation: 'addCalendarMonths714WithMonthEndClamp',
    evidenceId: ageThresholdEvidenceId,
  }

  const withdrawalByKey = new Map<string, OwnedNonRothIraWithdrawalClassification>()
  let allocationGrossTotal = 0n
  let allocationBasisTotal = 0n
  let allocationTaxableTotal = 0n
  for (
    const allocation of
      characterization.line7AllocationEvidence.allocations
  ) {
    const grossAmount = positiveUsdCentsSchema.parse(allocation.grossAmount)
    const basisAmount = usdCentsSchema.parse(allocation.allocatedBasisAmount)
    const taxableAmount = usdCentsSchema.parse(allocation.taxableAmount)
    if (
      BigInt(basisAmount) + BigInt(taxableAmount) !== BigInt(grossAmount)
    ) {
      throw new RangeError(
        'Every annual line-7 allocation must reconcile gross to basis plus taxable character',
      )
    }
    allocationGrossTotal += BigInt(grossAmount)
    allocationBasisTotal += BigInt(basisAmount)
    allocationTaxableTotal += BigInt(taxableAmount)
  }
  if (
    allocationGrossTotal !== BigInt(line7AnnualGrossAmount) ||
    allocationBasisTotal !== BigInt(line7AnnualBasisAmount) ||
    allocationTaxableTotal !== BigInt(line7AnnualTaxableAmount)
  ) {
    throw new RangeError(
      'Annual line-7 allocation collection must reconcile to its authoritative totals',
    )
  }

  let withdrawalGrossTotal = 0n
  let withdrawalBasisTotal = 0n
  let withdrawalTaxableTotal = 0n
  for (const withdrawal of characterization.withdrawals) {
    const actionId = actionIdSchema.parse(withdrawal.actionId)
    const allocationId = allocationIdSchema.parse(withdrawal.allocationId)
    const sourceAccountId = accountIdSchema.parse(withdrawal.sourceAccountId)
    validateSubtype(withdrawal.subtype)
    const executedAmount = positiveUsdCentsSchema.parse(
      withdrawal.executedAmount,
    )
    const basisRecoveredAmount = usdCentsSchema.parse(
      withdrawal.basisRecoveredAmount,
    )
    const ordinaryIncomeAmount = usdCentsSchema.parse(
      withdrawal.ordinaryIncomeAmount,
    )
    if (
      BigInt(basisRecoveredAmount) + BigInt(ordinaryIncomeAmount) !==
      BigInt(executedAmount)
    ) {
      throw new RangeError(
        'Every characterized IRA withdrawal must reconcile execution to basis plus ordinary income',
      )
    }
    const key = identityKey(actionId, allocationId)
    if (withdrawalByKey.has(key)) {
      throw new RangeError(
        'IRA penalty input contains duplicate characterized allocations',
      )
    }
    const line7Allocation =
      characterization.line7AllocationEvidence.allocations.find(
        (allocation) =>
          allocation.actionId === actionId &&
          allocation.allocationId === allocationId,
      )
    if (
      line7Allocation === undefined ||
      line7Allocation.sourceAccountId !== sourceAccountId ||
      line7Allocation.grossAmount !== withdrawal.executedAmount ||
      line7Allocation.allocatedBasisAmount !==
        withdrawal.basisRecoveredAmount ||
      line7Allocation.taxableAmount !== withdrawal.ordinaryIncomeAmount
    ) {
      throw new RangeError(
        'IRA penalty input withdrawal must exactly match annual line-7 allocation evidence',
      )
    }
    withdrawalByKey.set(key, withdrawal)
    withdrawalGrossTotal += BigInt(executedAmount)
    withdrawalBasisTotal += BigInt(basisRecoveredAmount)
    withdrawalTaxableTotal += BigInt(ordinaryIncomeAmount)
  }
  if (
    withdrawalByKey.size !==
    characterization.line7AllocationEvidence.allocations.length
  ) {
    throw new RangeError(
      'IRA penalty input must include every annual line-7 allocation exactly once',
    )
  }
  if (
    withdrawalGrossTotal !== BigInt(line7AnnualGrossAmount) ||
    withdrawalBasisTotal !== BigInt(line7AnnualBasisAmount) ||
    withdrawalTaxableTotal !== BigInt(line7AnnualTaxableAmount)
  ) {
    throw new RangeError(
      'Characterized IRA withdrawal collection must reconcile to authoritative annual line-7 totals',
    )
  }

  const sourceEvidenceByKey = new Map<
    string,
    OwnedNonRothIraPenaltySourceEvidence
  >()
  const distributionDateEvidenceBindings = new Map<
    string,
    Readonly<{ actionId: ActionId; evaluationDate: string }>
  >()
  for (const sourceEvidenceInput of input.sourceEvidence) {
    const key = identityKey(
      actionIdSchema.parse(sourceEvidenceInput.actionId),
      allocationIdSchema.parse(sourceEvidenceInput.allocationId),
    )
    const withdrawal = withdrawalByKey.get(key)
    if (withdrawal === undefined) {
      throw new RangeError(
        'IRA penalty input contains foreign source evidence',
      )
    }
    if (sourceEvidenceByKey.has(key)) {
      throw new RangeError(
        'IRA penalty source evidence must be unique per allocation',
      )
    }
    const poolMember = annualBasisEvidence.poolMembers.find(
      (member) => member.sourceAccountId === withdrawal.sourceAccountId,
    )
    if (poolMember === undefined) {
      throw new RangeError(
        'IRA penalty source is absent from annual owner-wide pool evidence',
      )
    }
    const line7Allocation =
      characterization.line7AllocationEvidence.allocations.find(
        (allocation) =>
          allocation.actionId === withdrawal.actionId &&
          allocation.allocationId === withdrawal.allocationId,
      )
    if (line7Allocation === undefined) {
      throw new Error(
        'Canonical IRA withdrawal lost its annual line-7 allocation',
      )
    }
    const sourceEvidence = validateSourceEvidence(
      sourceEvidenceInput,
      withdrawal,
      line7Allocation.scheduledDate,
      ownerPersonId,
      taxYear,
      poolMember,
    )
    if (sourceEvidence.evaluationDate < birthDate) {
      throw new RangeError(
        'IRA distribution evaluation date cannot precede the owner birth date',
      )
    }
    const existingDateEvidenceBinding =
      distributionDateEvidenceBindings.get(
        sourceEvidence.distributionDateEvidenceId,
      )
    if (
      existingDateEvidenceBinding !== undefined &&
      (existingDateEvidenceBinding.actionId !== sourceEvidence.actionId ||
        existingDateEvidenceBinding.evaluationDate !==
          sourceEvidence.evaluationDate)
    ) {
      throw new RangeError(
        'IRA distribution-date evidence ID reuse must bind one action and exact date',
      )
    }
    distributionDateEvidenceBindings.set(
      sourceEvidence.distributionDateEvidenceId,
      {
        actionId: sourceEvidence.actionId,
        evaluationDate: sourceEvidence.evaluationDate,
      },
    )
    sourceEvidenceByKey.set(key, sourceEvidence)
  }
  if (sourceEvidenceByKey.size !== withdrawalByKey.size) {
    throw new RangeError(
      'IRA penalty input requires source evidence for every withdrawal',
    )
  }

  const disabilityRelevantDates = new Set<string>()
  for (const withdrawal of withdrawalByKey.values()) {
    const sourceEvidence = sourceEvidenceByKey.get(
      identityKey(withdrawal.actionId, withdrawal.allocationId),
    )
    if (
      sourceEvidence !== undefined &&
      withdrawal.ordinaryIncomeAmount > 0 &&
      sourceEvidence.evaluationDate < age59HalfDate
    ) {
      disabilityRelevantDates.add(sourceEvidence.evaluationDate)
    }
  }
  const disabilityByEvaluationDate = new Map<
    string,
    QualifiedDisabilityEventEvidence
  >()
  const disabilityEvidenceBindings = new Map<string, string>()
  for (const disabilityInput of input.qualifiedDisabilityEvidence ?? []) {
    const disabledPersonId = personIdSchema.parse(
      disabilityInput.disabledPersonId,
    )
    const disabilityQualificationDate = validateCivilDate(
      disabilityInput.disabilityQualificationDate,
      'IRA disability qualification date',
    )
    const evaluationDate = validateCivilDate(
      disabilityInput.evaluationDate,
      'IRA disability evaluation date',
    )
    const disabilityEvidenceId = nonblankId(
      disabilityInput.disabilityEvidenceId,
      'IRA disability evidence ID',
    )
    if (
      disabilityInput.kind !== 'disability' ||
      disabilityInput.qualifiedOnEvaluationDate !== true ||
      disabledPersonId !== ownerPersonId
    ) {
      throw new RangeError(
        'IRA disability evidence must positively qualify the characterized owner',
      )
    }
    if (disabilityQualificationDate < birthDate) {
      throw new RangeError(
        'IRA disability qualification date cannot precede the owner birth date',
      )
    }
    if (disabilityQualificationDate > evaluationDate) {
      throw new RangeError(
        'IRA disability qualification date cannot follow its evaluation date',
      )
    }
    if (
      !disabilityRelevantDates.has(evaluationDate) ||
      disabilityByEvaluationDate.has(evaluationDate)
    ) {
      throw new RangeError(
        'IRA disability evidence must uniquely match an under-age positive ordinary-income distribution date',
      )
    }
    const disabilityEvent: QualifiedDisabilityEventEvidence = {
      kind: 'disability',
      disabledPersonId,
      disabilityQualificationDate,
      evaluationDate,
      qualifiedOnEvaluationDate: true,
      disabilityEvidenceId,
    }
    const eventBinding = stableStructuralSnapshot(disabilityEvent)
    const existingEvidenceBinding =
      disabilityEvidenceBindings.get(disabilityEvidenceId)
    if (
      existingEvidenceBinding !== undefined &&
      existingEvidenceBinding !== eventBinding
    ) {
      throw new RangeError(
        'IRA disability evidence ID reuse must bind the exact same dated event',
      )
    }
    disabilityEvidenceBindings.set(disabilityEvidenceId, eventBinding)
    disabilityByEvaluationDate.set(evaluationDate, disabilityEvent)
  }

  const exceptionRequiredByKey = new Map<
    string,
    Readonly<{
      withdrawal: OwnedNonRothIraWithdrawalClassification
      sourceEvidence: OwnedNonRothIraPenaltySourceEvidence
    }>
  >()
  const exceptionRequiredDates = new Set<string>()
  for (const withdrawal of withdrawalByKey.values()) {
    const key = identityKey(withdrawal.actionId, withdrawal.allocationId)
    const sourceEvidence = sourceEvidenceByKey.get(key)
    if (
      sourceEvidence !== undefined &&
      withdrawal.ordinaryIncomeAmount > 0 &&
      sourceEvidence.evaluationDate < age59HalfDate &&
      !disabilityByEvaluationDate.has(sourceEvidence.evaluationDate)
    ) {
      exceptionRequiredByKey.set(key, { withdrawal, sourceEvidence })
      exceptionRequiredDates.add(sourceEvidence.evaluationDate)
    }
  }

  const negativeEvidenceIdBindings = new Map<string, string>()
  const registerNegativeEvidenceId = (
    evidenceId: string,
    evidence: unknown,
  ): void => {
    const binding = stableStructuralSnapshot(evidence)
    const existing = negativeEvidenceIdBindings.get(evidenceId)
    if (existing !== undefined) {
      throw new RangeError(
        existing === binding
          ? 'IRA negative exception evidence IDs must be unique'
          : 'IRA negative exception evidence ID reuse must bind one exact record',
      )
    }
    if (disabilityEvidenceBindings.has(evidenceId)) {
      throw new RangeError(
        'Positive and rejected IRA disability evidence cannot reuse an evidence ID',
      )
    }
    negativeEvidenceIdBindings.set(evidenceId, binding)
  }

  const rejectedDisabilityByEvaluationDate = new Map<
    string,
    RejectedDisabilityStatusEvidence
  >()
  for (
    const rejectedInput of
      input.rejectedDisabilityEvidence ?? []
  ) {
    const disabledPersonId = personIdSchema.parse(
      rejectedInput.disabledPersonId,
    )
    const evaluationDate = validateCivilDate(
      rejectedInput.evaluationDate,
      'Rejected IRA disability evaluation date',
    )
    const disabilityEvidenceId = nonblankId(
      rejectedInput.disabilityEvidenceId,
      'Rejected IRA disability evidence ID',
    )
    let disabilityQualificationDate: string | null = null
    if (rejectedInput.disabilityQualificationDate !== null) {
      disabilityQualificationDate = validateCivilDate(
        rejectedInput.disabilityQualificationDate,
        'Rejected IRA disability qualification date',
      )
      if (
        disabilityQualificationDate < birthDate ||
        disabilityQualificationDate <= evaluationDate
      ) {
        throw new RangeError(
          'Rejected IRA disability qualification date must follow its evaluation date and owner birth',
        )
      }
    }
    if (
      rejectedInput.kind !== 'disability' ||
      rejectedInput.qualifiedOnEvaluationDate !== false ||
      disabledPersonId !== ownerPersonId ||
      !exceptionRequiredDates.has(evaluationDate) ||
      disabilityByEvaluationDate.has(evaluationDate) ||
      rejectedDisabilityByEvaluationDate.has(evaluationDate)
    ) {
      throw new RangeError(
        'Rejected IRA disability evidence must uniquely bind an unresolved under-age owner and date',
      )
    }
    const rejectedDisability: RejectedDisabilityStatusEvidence = {
      kind: 'disability',
      disabledPersonId,
      disabilityQualificationDate,
      evaluationDate,
      qualifiedOnEvaluationDate: false,
      disabilityEvidenceId,
    }
    registerNegativeEvidenceId(
      disabilityEvidenceId,
      rejectedDisability,
    )
    rejectedDisabilityByEvaluationDate.set(
      evaluationDate,
      rejectedDisability,
    )
  }

  const ownerAliveByKey = new Map<
    string,
    OwnedNonRothIraOwnerAliveEvidence
  >()
  for (const aliveInput of input.ownerAliveEvidence ?? []) {
    const key = identityKey(
      actionIdSchema.parse(aliveInput.actionId),
      allocationIdSchema.parse(aliveInput.allocationId),
    )
    const required = exceptionRequiredByKey.get(key)
    if (required === undefined || ownerAliveByKey.has(key)) {
      throw new RangeError(
        'IRA owner-alive evidence must uniquely match an unresolved allocation',
      )
    }
    const evaluationDate = validateCivilDate(
      aliveInput.evaluationDate,
      'IRA owner-alive evaluation date',
    )
    const evidence: OwnedNonRothIraOwnerAliveEvidence = {
      predicate: aliveInput.predicate,
      actionId: actionIdSchema.parse(aliveInput.actionId),
      allocationId: allocationIdSchema.parse(aliveInput.allocationId),
      sourceAccountId: accountIdSchema.parse(aliveInput.sourceAccountId),
      ownerPersonId: personIdSchema.parse(aliveInput.ownerPersonId),
      evaluationDate,
      distributionDateEvidenceId: nonblankId(
        aliveInput.distributionDateEvidenceId,
        'IRA owner-alive distribution-date evidence ID',
      ),
      aliveOnEvaluationDate: aliveInput.aliveOnEvaluationDate,
      ownerAliveEvidenceId: nonblankId(
        aliveInput.ownerAliveEvidenceId,
        'IRA owner-alive evidence ID',
      ),
    }
    if (
      evidence.predicate !== 'ownerAliveOnOwnedIraDistributionDate' ||
      evidence.actionId !== required.withdrawal.actionId ||
      evidence.allocationId !== required.withdrawal.allocationId ||
      evidence.sourceAccountId !== required.withdrawal.sourceAccountId ||
      evidence.ownerPersonId !== ownerPersonId ||
      evidence.evaluationDate !==
        required.sourceEvidence.evaluationDate ||
      evidence.distributionDateEvidenceId !==
        required.sourceEvidence.distributionDateEvidenceId ||
      evidence.aliveOnEvaluationDate !== true
    ) {
      throw new RangeError(
        'IRA owner-alive evidence must bind the owner, allocation, and exact distribution-date evidence',
      )
    }
    registerNegativeEvidenceId(evidence.ownerAliveEvidenceId, evidence)
    ownerAliveByKey.set(key, evidence)
  }

  const noSeppByKey = new Map<
    string,
    OwnedNonRothIraNoSeppStatusEvidence
  >()
  for (const seppInput of input.iraSeppStatusEvidence ?? []) {
    const key = identityKey(
      actionIdSchema.parse(seppInput.actionId),
      allocationIdSchema.parse(seppInput.allocationId),
    )
    const required = exceptionRequiredByKey.get(key)
    if (required === undefined || noSeppByKey.has(key)) {
      throw new RangeError(
        'IRA SEPP status evidence must uniquely match an unresolved allocation',
      )
    }
    const evidence: OwnedNonRothIraNoSeppStatusEvidence = {
      predicate: seppInput.predicate,
      actionId: actionIdSchema.parse(seppInput.actionId),
      allocationId: allocationIdSchema.parse(seppInput.allocationId),
      sourceAccountId: accountIdSchema.parse(seppInput.sourceAccountId),
      ownerPersonId: personIdSchema.parse(seppInput.ownerPersonId),
      evaluationDate: validateCivilDate(
        seppInput.evaluationDate,
        'IRA SEPP status evaluation date',
      ),
      status: seppInput.status,
      electionId: seppInput.electionId,
      scheduleId: seppInput.scheduleId,
      seppStatusEvidenceId: nonblankId(
        seppInput.seppStatusEvidenceId,
        'IRA SEPP status evidence ID',
      ),
    }
    if (
      evidence.predicate !==
        'ownedNonRothIraSeppStatusForWithdrawal' ||
      evidence.actionId !== required.withdrawal.actionId ||
      evidence.allocationId !== required.withdrawal.allocationId ||
      evidence.sourceAccountId !== required.withdrawal.sourceAccountId ||
      evidence.ownerPersonId !== ownerPersonId ||
      evidence.evaluationDate !==
        required.sourceEvidence.evaluationDate ||
      evidence.status !== 'none' ||
      evidence.electionId !== null ||
      evidence.scheduleId !== null
    ) {
      throw new RangeError(
        'IRA SEPP status must explicitly prove no election or schedule for the exact allocation and date',
      )
    }
    registerNegativeEvidenceId(evidence.seppStatusEvidenceId, evidence)
    noSeppByKey.set(key, evidence)
  }

  const noOtherExceptionByKey = new Map<
    string,
    NoOtherStatutoryExceptionClaimedAttestation
  >()
  for (
    const attestationInput of
      input.noOtherExceptionAttestations ?? []
  ) {
    const key = identityKey(
      actionIdSchema.parse(attestationInput.actionId),
      allocationIdSchema.parse(attestationInput.allocationId),
    )
    const required = exceptionRequiredByKey.get(key)
    if (required === undefined || noOtherExceptionByKey.has(key)) {
      throw new RangeError(
        'IRA other-exception attestation must uniquely match an unresolved allocation',
      )
    }
    const evidence: NoOtherStatutoryExceptionClaimedAttestation = {
      predicate: attestationInput.predicate,
      actionId: actionIdSchema.parse(attestationInput.actionId),
      allocationId: allocationIdSchema.parse(
        attestationInput.allocationId,
      ),
      sourceAccountId: accountIdSchema.parse(
        attestationInput.sourceAccountId,
      ),
      ownerPersonId: personIdSchema.parse(
        attestationInput.ownerPersonId,
      ),
      evaluationDate: validateCivilDate(
        attestationInput.evaluationDate,
        'IRA other-exception attestation date',
      ),
      attested: attestationInput.attested,
      evidenceScope: attestationInput.evidenceScope,
      attestationEvidenceId: nonblankId(
        attestationInput.attestationEvidenceId,
        'IRA other-exception attestation evidence ID',
      ),
    }
    if (
      evidence.predicate !== 'noOtherStatutoryExceptionClaimed' ||
      evidence.actionId !== required.withdrawal.actionId ||
      evidence.allocationId !== required.withdrawal.allocationId ||
      evidence.sourceAccountId !== required.withdrawal.sourceAccountId ||
      evidence.ownerPersonId !== ownerPersonId ||
      evidence.evaluationDate !==
        required.sourceEvidence.evaluationDate ||
      evidence.attested !== true ||
      evidence.evidenceScope !==
        'planningEvidenceNotFilingGradeLegalAdjudication'
    ) {
      throw new RangeError(
        'IRA no-other-exception attestation must be planning-scoped and bind the exact owner, allocation, source, and date',
      )
    }
    registerNegativeEvidenceId(
      evidence.attestationEvidenceId,
      evidence,
    )
    noOtherExceptionByKey.set(key, evidence)
  }

  const requiredSimpleSourceIds = new Set<AccountId>()
  for (const withdrawal of withdrawalByKey.values()) {
    const sourceEvidence = sourceEvidenceByKey.get(
      identityKey(withdrawal.actionId, withdrawal.allocationId),
    )
    if (
      sourceEvidence !== undefined &&
      withdrawal.subtype === 'simple' &&
      withdrawal.ordinaryIncomeAmount > 0 &&
      sourceEvidence.evaluationDate < age59HalfDate &&
      !disabilityByEvaluationDate.has(sourceEvidence.evaluationDate)
    ) {
      requiredSimpleSourceIds.add(withdrawal.sourceAccountId)
    }
  }
  const simpleParticipationBySource = new Map<
    AccountId,
    SimpleIraParticipationEvidence
  >()
  const simpleParticipationEvidenceIds = new Set<string>()
  for (const participationInput of input.simpleParticipationEvidence) {
    const sourceAccountId = accountIdSchema.parse(
      participationInput.sourceAccountId,
    )
    if (
      !requiredSimpleSourceIds.has(sourceAccountId) ||
      simpleParticipationBySource.has(sourceAccountId)
    ) {
      throw new RangeError(
        'SIMPLE IRA participation evidence must exactly cover required sources',
      )
    }
    const owner = personIdSchema.parse(participationInput.ownerPersonId)
    const participationStartDate = validateCivilDate(
      participationInput.participationStartDate,
      'SIMPLE IRA participation start date',
    )
    const participationStartEvidenceId = nonblankId(
      participationInput.participationStartEvidenceId,
      'SIMPLE IRA participation evidence ID',
    )
    if (
      participationInput.predicate !==
        'simpleIraParticipationStartForPenaltyRate' ||
      owner !== ownerPersonId
    ) {
      throw new RangeError(
        'SIMPLE IRA participation evidence must bind its source and owner',
      )
    }
    if (participationStartDate < birthDate) {
      throw new RangeError(
        'SIMPLE IRA participation start date cannot precede the owner birth date',
      )
    }
    if (
      simpleParticipationEvidenceIds.has(participationStartEvidenceId)
    ) {
      throw new RangeError(
        'SIMPLE IRA participation evidence IDs must be unique per source',
      )
    }
    simpleParticipationEvidenceIds.add(participationStartEvidenceId)
    simpleParticipationBySource.set(sourceAccountId, {
      predicate: 'simpleIraParticipationStartForPenaltyRate',
      sourceAccountId,
      ownerPersonId: owner,
      participationStartDate,
      participationStartEvidenceId,
    })
  }
  if (simpleParticipationBySource.size !== requiredSimpleSourceIds.size) {
    throw new RangeError(
      'SIMPLE IRA participation evidence is missing for an early distribution',
    )
  }

  const coverage: OwnedNonRothIraPenaltyCharacterCoverageEvidence[] = []
  const evaluations: OwnedNonRothIraPenaltyPrerequisiteEvaluation[] = []
  for (const withdrawal of characterization.withdrawals) {
      const key = identityKey(withdrawal.actionId, withdrawal.allocationId)
      const sourceEvidence = sourceEvidenceByKey.get(key)
      if (sourceEvidence === undefined) {
        throw new Error('Canonical IRA withdrawal lost its source evidence')
      }
      const character = validateCharacter(
        withdrawal,
        line7AllocationEvidenceId,
      )
      if (character.basisEvidenceId !== annualBasisEvidenceId) {
        throw new RangeError(
          'IRA withdrawal character must bind the supplied annual basis evidence',
        )
      }
      const characterCoverageId = stableId(
        'owned-ira-penalty-character-coverage',
        [
          withdrawal.actionId,
          withdrawal.allocationId,
          withdrawal.sourceAccountId,
          ownerPersonId,
          withdrawal.subtype,
          sourceEvidence.evaluationDate,
          withdrawal.executedAmount,
          character.basisReturnAmount,
          character.ordinaryIncomeAmount,
          annualBasisEvidenceId,
          line7AllocationEvidenceId,
          character.characterEvidenceIds,
          sourceEvidence,
          ageThresholdEvidenceId,
        ],
      )
      const characterCoverage:
        OwnedNonRothIraPenaltyCharacterCoverageEvidence = {
          predicate:
            'completeOwnedNonRothIraPenaltyCharacterCoverageForAllocation',
          actionId: withdrawal.actionId,
          allocationId: withdrawal.allocationId,
          sourceAccountId: withdrawal.sourceAccountId,
          ownerPersonId,
          subtype: withdrawal.subtype,
          evaluationDate: sourceEvidence.evaluationDate,
          executedAmount: withdrawal.executedAmount,
          basisReturnExcludedAmount: character.basisReturnAmount,
          ordinaryIncomeExposureAmount: character.ordinaryIncomeAmount,
          basisEvidenceId: annualBasisEvidenceId,
          line7AllocationEvidenceId,
          characterEvidenceIds: character.characterEvidenceIds,
          sourceEvidenceIds: {
            distributionDateEvidenceId:
              sourceEvidence.distributionDateEvidenceId,
            accountOwnershipEvidenceId:
              sourceEvidence.accountOwnershipEvidenceId,
            iraClassificationEvidenceId:
              sourceEvidence.iraClassificationEvidenceId,
          },
          ageThresholdEvidenceId,
          evidenceId: characterCoverageId,
        }
      const base: OwnedNonRothIraPenaltyEvaluationBase = {
        actionId: withdrawal.actionId,
        allocationId: withdrawal.allocationId,
        sourceAccountId: withdrawal.sourceAccountId,
        ownerPersonId,
        subtype: withdrawal.subtype,
        evaluationDate: sourceEvidence.evaluationDate,
        characterCoverage,
      }
      coverage.push(characterCoverage)
      if (character.ordinaryIncomeAmount === 0) {
        continue
      }
      if (sourceEvidence.evaluationDate >= age59HalfDate) {
        evaluations.push({
          ...base,
          outcome: 'age59HalfReached',
          evaluatedOrdinaryIncomeExposureAmount:
            character.ordinaryIncomeAmount,
          finalPenaltyAmount: 0,
          finalEvidenceId: stableId('owned-ira-age-59-half-zero-penalty', [
            characterCoverageId,
            ageThresholdEvidenceId,
          ]),
        })
        continue
      }
      const disabilityEvent = disabilityByEvaluationDate.get(
        sourceEvidence.evaluationDate,
      )
      if (disabilityEvent !== undefined) {
        evaluations.push({
          ...base,
          outcome: 'disabilityQualified',
          evaluatedOrdinaryIncomeExposureAmount:
            character.ordinaryIncomeAmount,
          disabilityEvent,
          finalPenaltyAmount: 0,
          finalEvidenceId: stableId(
            'owned-ira-disability-qualified-zero-penalty',
            [
              characterCoverageId,
              ageThresholdEvidenceId,
              disabilityEvent,
            ],
          ),
        })
        continue
      }

      let rateEvidence: OwnedNonRothIraEarlyDistributionRateEvidence
      if (
        withdrawal.subtype === 'traditional' ||
        withdrawal.subtype === 'sep'
      ) {
        rateEvidence = {
          kind: 'traditionalOrSepStandardRate',
          subtype: withdrawal.subtype,
          numerator: 1,
          denominator: 10,
          quantization: 'nearestCentHalfUp',
          intermediateArithmetic: 'bigintRational',
          evidenceId: stableId('owned-ira-standard-early-rate', [
            withdrawal.sourceAccountId,
            withdrawal.subtype,
            sourceEvidence.iraClassificationEvidenceId,
          ]),
        }
      } else {
        const participation = simpleParticipationBySource.get(
          withdrawal.sourceAccountId,
        )
        if (participation === undefined) {
          throw new Error(
            'Canonical SIMPLE IRA withdrawal lost participation evidence',
          )
        }
        if (
          sourceEvidence.evaluationDate <
          participation.participationStartDate
        ) {
          throw new RangeError(
            'SIMPLE IRA distribution cannot precede participation start',
          )
        }
        const initialTwoYearPeriodEndDate = addCalendarMonths(
          participation.participationStartDate,
          24,
        )
        if (initialTwoYearPeriodEndDate === null) {
          throw new RangeError(
            'SIMPLE IRA two-year period end is outside civil-date range',
          )
        }
        const withinInitialPeriod =
          sourceEvidence.evaluationDate < initialTwoYearPeriodEndDate
        rateEvidence = {
          kind: 'simpleIraParticipationRate',
          phase: withinInitialPeriod
            ? 'initialTwoYearPeriod'
            : 'standardAfterTwoYearPeriod',
          numerator: 1,
          denominator: withinInitialPeriod ? 4 : 10,
          participationStartDate: participation.participationStartDate,
          initialTwoYearPeriodEndDate,
          participationStartEvidenceId:
            participation.participationStartEvidenceId,
          quantization: 'nearestCentHalfUp',
          intermediateArithmetic: 'bigintRational',
          evidenceId: stableId('simple-ira-early-rate', [
            withdrawal.sourceAccountId,
            ownerPersonId,
            sourceEvidence.evaluationDate,
            participation,
            initialTwoYearPeriodEndDate,
            withinInitialPeriod,
          ]),
        }
      }
      const candidate = candidateAmount(
        character.ordinaryIncomeAmount,
        rateEvidence.numerator,
        rateEvidence.denominator,
      )
      const ownerAliveEvidence = ownerAliveByKey.get(key)
      const noSeppEvidence = noSeppByKey.get(key)
      const rejectedDisabilityEvidence =
        rejectedDisabilityByEvaluationDate.get(
          sourceEvidence.evaluationDate,
        )
      const noOtherExceptionAttestation =
        noOtherExceptionByKey.get(key)
      if (
        ownerAliveEvidence === undefined ||
        noSeppEvidence === undefined ||
        rejectedDisabilityEvidence === undefined ||
        noOtherExceptionAttestation === undefined
      ) {
        evaluations.push({
          ...base,
          outcome: 'exceptionEvaluationRequired',
          evaluatedOrdinaryIncomeExposureAmount:
            character.ordinaryIncomeAmount,
          candidateAmountBeforeExceptions: candidate,
          rateEvidence,
          prerequisiteEvidenceId: stableId(
            'owned-ira-penalty-exception-prerequisite',
            [
              characterCoverageId,
              ageThresholdEvidenceId,
              rateEvidence,
              candidate,
              ownerAliveEvidence ?? null,
              noSeppEvidence ?? null,
              rejectedDisabilityEvidence ?? null,
              noOtherExceptionAttestation ?? null,
            ],
          ),
        })
        continue
      }

      const rejectedAge: RejectedAge59HalfExceptionEvidence = {
        exception: 'age59Half',
        disposition: 'rejected',
        evaluationDate: sourceEvidence.evaluationDate,
        age59HalfDate,
        ageThresholdEvidenceId,
        evidenceId: stableId(
          'owned-ira-rejected-age-59-half-exception',
          [
            characterCoverageId,
            sourceEvidence.evaluationDate,
            age59HalfDate,
            ageThresholdEvidenceId,
          ],
        ),
      }
      const rejectedDeath: RejectedDeathExceptionEvidence = {
        exception: 'death',
        disposition: 'rejected',
        ownerAliveEvidence,
        evidenceId: stableId('owned-ira-rejected-death-exception', [
          characterCoverageId,
          ownerAliveEvidence,
        ]),
      }
      const rejectedSepp: RejectedIraSeppExceptionEvidence = {
        exception: 'iraSepp',
        disposition: 'rejected',
        noSeppEvidence,
        evidenceId: stableId('owned-ira-rejected-sepp-exception', [
          characterCoverageId,
          noSeppEvidence,
        ]),
      }
      const rejectedDisability:
        RejectedDisabilityExceptionEvidence = {
          exception: 'disability',
          disposition: 'rejected',
          rejectedDisabilityEvidence,
          evidenceId: stableId(
            'owned-ira-rejected-disability-exception',
            [characterCoverageId, rejectedDisabilityEvidence],
          ),
        }
      const rejectedOther:
        RejectedOtherStatutoryExceptionEvidence = {
          exception: 'otherStatutoryException',
          disposition: 'rejected',
          attestation: noOtherExceptionAttestation,
          evidenceId: stableId(
            'owned-ira-rejected-other-statutory-exception',
            [characterCoverageId, noOtherExceptionAttestation],
          ),
        }
      const rejectedExceptions:
        RejectedOwnedNonRothIraPenaltyExceptionTuple = [
          rejectedAge,
          rejectedDeath,
          rejectedSepp,
          rejectedDisability,
          rejectedOther,
        ]
      evaluations.push({
        ...base,
        outcome: 'penaltyApplies',
        evaluatedOrdinaryIncomeExposureAmount:
          character.ordinaryIncomeAmount,
        candidateAmountBeforeExceptions: candidate,
        rateEvidence,
        rejectedExceptions,
        finalPenaltyAmount: candidate,
        finalEvidenceId: stableId(
          'owned-ira-penalty-applies',
          [
            characterCoverageId,
            ageThresholdEvidenceId,
            rateEvidence,
            candidate,
            rejectedExceptions,
          ],
        ),
      })
  }

  return deepFreeze({
    taxYear,
    ownerPersonId,
    ageThresholdEvidence,
    coverage,
    evaluations,
  })
}
