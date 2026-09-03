import {
  classifyAnnualHsaWithdrawalCharacter,
  type AnnualHsaWithdrawalCharacterAccepted,
  type ClassifyAnnualHsaWithdrawalCharacterResult,
  type HsaWithdrawalAllocationCharacterCoverage,
  type HsaWithdrawalTaxCharacter,
} from './annualHsaWithdrawalCharacter.js'
import type { EvaluateAnnualHsaReimbursementLedgerInput } from './annualHsaReimbursementLedger.js'
import { addCalendarMonths, formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  personIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import { exactCentProRataNearestHalfUp } from './exactCentProRata.js'
import { addUsdCents, asUsdCents, type UsdCents } from './money.js'
import { deriveActionStructuralId } from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { INVALID_SNAPSHOT, exactKeys, plainDataSnapshot } from './plainData.js'

export interface HsaPenaltyOwnerBirthEvidence {
  predicate: 'authoritativeHsaOwnerBirthDate'
  ownerPersonId: PersonId
  birthDate: string
  birthDateEvidenceId: string
  authoritative: true
}

export interface HsaPenaltyDisabilityStatusEvidence {
  predicate: 'authoritativeHsaDisabilityStatusOnDistributionDate'
  ownerPersonId: PersonId
  evaluationDate: string
  disabilityQualificationDate: string | null
  qualifiedOnEvaluationDate: boolean
  disabilityEvidenceId: string
  authoritative: true
}

export interface EvaluateAnnualHsaPenaltyInput {
  characterInput: Readonly<EvaluateAnnualHsaReimbursementLedgerInput>
  ownerBirthEvidenceComplete: true
  ownerBirthEvidence: readonly Readonly<HsaPenaltyOwnerBirthEvidence>[]
  disabilityStatusEvidenceComplete: true
  disabilityStatusEvidence:
    readonly Readonly<HsaPenaltyDisabilityStatusEvidence>[]
}

export interface HsaPenaltyAge65Evidence {
  predicate: 'hsaOwnerAge65Threshold'
  ownerPersonId: PersonId
  birthDate: string
  evaluationDate: string
  thresholdMonthCount: 780
  age65Date: string
  age65Reached: boolean
  calculation: 'addCalendarMonths780WithMonthEndClamp'
  birthDateEvidenceId: string
  ageEvidenceId: string
}

export interface HsaFixedTwentyPercentPenaltyRateEvidence {
  kind: 'hsaNonqualifiedDistributionRate'
  numerator: 1
  denominator: 5
  percent: 20
  quantization: 'nearestCentHalfUp'
  intermediateArithmetic: 'bigintRational'
  rateEvidenceId: string
}

interface HsaPenaltyEvaluationBase {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  characterIndex: number
  characterSegmentId: string
  characterKind: HsaWithdrawalTaxCharacter['kind']
  characterAmount: UsdCents
  annualLedgerEvidenceId: string
  ledgerEvidenceId: string
  characterEvidenceId: string
  taxableAmountExposed: UsdCents
  penaltyEvidenceId: string
}

export interface HsaQualifiedMedicalPenaltyEvaluation
  extends HsaPenaltyEvaluationBase {
  treatment: 'hsaQualifiedMedical'
  penaltyRatePercent: 0
  finalPenaltyAmount: 0
  acceptedEvidence: Readonly<{
    treatmentAmount: UsdCents
    qualifiedMedicalAmount: UsdCents
    reimbursementScopeId: string
    expenseStateBeforeId: string
    expenseStateAfterId: string
    consumptionEvidenceIds: readonly [string, ...string[]]
  }>
}

export interface HsaAge65PenaltyEvaluation extends HsaPenaltyEvaluationBase {
  treatment: 'hsaAge65'
  penaltyRatePercent: 0
  finalPenaltyAmount: 0
  acceptedEvidence: Readonly<{
    treatmentAmount: UsdCents
    ageEvidence: Readonly<HsaPenaltyAge65Evidence & { age65Reached: true }>
  }>
}

export interface HsaDisabilityPenaltyEvaluation
  extends HsaPenaltyEvaluationBase {
  treatment: 'hsaDisability'
  penaltyRatePercent: 0
  finalPenaltyAmount: 0
  acceptedEvidence: Readonly<{
    treatmentAmount: UsdCents
    ageEvidence: Readonly<HsaPenaltyAge65Evidence & { age65Reached: false }>
    disabilityEvidence: Readonly<HsaPenaltyDisabilityStatusEvidence & {
      qualifiedOnEvaluationDate: true
      disabilityQualificationDate: string
    }>
  }>
}

export interface HsaPenaltyAppliesEvaluation extends HsaPenaltyEvaluationBase {
  treatment: 'penaltyApplies'
  penaltyRatePercent: 20
  finalPenaltyAmount: UsdCents
  acceptedEvidence: Readonly<{
    treatmentAmount: UsdCents
    ageEvidence: Readonly<HsaPenaltyAge65Evidence & { age65Reached: false }>
    rejectedDisabilityEvidence:
      Readonly<HsaPenaltyDisabilityStatusEvidence & {
        qualifiedOnEvaluationDate: false
      }>
    rateEvidence: Readonly<HsaFixedTwentyPercentPenaltyRateEvidence>
  }>
}

export type HsaSegmentPenaltyEvaluation =
  | HsaQualifiedMedicalPenaltyEvaluation
  | HsaAge65PenaltyEvaluation
  | HsaDisabilityPenaltyEvaluation
  | HsaPenaltyAppliesEvaluation

export interface HsaAllocationPenaltyCoverage {
  predicate: 'completeHsaPenaltyCharacterCoverageForAllocation'
  reimbursementScopeId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  ownerPersonId: PersonId
  evaluationDate: string
  executedAmount: UsdCents
  characterEvidenceId: string
  annualLedgerEvidenceId: string
  ledgerEvidenceId: string
  penaltyRelevantCharacterAmount: UsdCents
  coveredPenaltyExposureAmount: UsdCents
  nonPenaltyRelevantCharacterAmount: UsdCents
  coverageDifferenceAmount: 0
  evaluations: readonly Readonly<HsaSegmentPenaltyEvaluation>[]
  aggregatePenaltyAmount: UsdCents
  coverageEvidenceId: string
}

export interface AnnualHsaPenaltyIssue {
  kind:
    | 'invalidInput'
    | 'characterBlocked'
    | 'missingEvidence'
    | 'evidenceMismatch'
    | 'identifierCollision'
  detail: string
}

export type AnnualHsaPenaltyEvaluated = Readonly<{
  status: 'evaluated'
  committed: false
  movement: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  character: Readonly<AnnualHsaWithdrawalCharacterAccepted>
  allocations: readonly Readonly<HsaAllocationPenaltyCoverage>[]
  aggregatePenaltyAmount: UsdCents
  issues: readonly []
}>

export type AnnualHsaPenaltyBlocked = Readonly<{
  status: 'blocked'
  committed: false
  movement: 'notEstablished'
  actionability: 'notEstablished'
  publication: 'notEstablished'
  character: Readonly<ClassifyAnnualHsaWithdrawalCharacterResult> | null
  allocations: readonly []
  aggregatePenaltyAmount: 0
  issues: readonly [Readonly<AnnualHsaPenaltyIssue>]
}>

export type EvaluateAnnualHsaPenaltyResult =
  | AnnualHsaPenaltyEvaluated
  | AnnualHsaPenaltyBlocked

const INPUT_KEYS = ['characterInput', 'ownerBirthEvidenceComplete', 'ownerBirthEvidence', 'disabilityStatusEvidenceComplete', 'disabilityStatusEvidence']
const BIRTH_KEYS = ['predicate', 'ownerPersonId', 'birthDate', 'birthDateEvidenceId', 'authoritative']
const DISABILITY_KEYS = ['predicate', 'ownerPersonId', 'evaluationDate', 'disabilityQualificationDate', 'qualifiedOnEvaluationDate', 'disabilityEvidenceId', 'authoritative']

function blocked(
  character: Readonly<ClassifyAnnualHsaWithdrawalCharacterResult> | null,
  kind: AnnualHsaPenaltyIssue['kind'],
  detail: string,
): AnnualHsaPenaltyBlocked {
  return deepFreeze({ status: 'blocked', committed: false, movement: 'notEstablished', actionability: 'notEstablished', publication: 'notEstablished', character, allocations: [], aggregatePenaltyAmount: 0, issues: [{ kind, detail }] }) as AnnualHsaPenaltyBlocked
}

function canonicalDate(value: unknown): string {
  if (typeof value !== 'string') throw new RangeError('HSA penalty evidence requires canonical civil dates')
  const parsed = parseCivilIsoDate(value)
  if (parsed === null || formatCivilDate(parsed) !== value) throw new RangeError('HSA penalty evidence requires canonical civil dates')
  return value
}

function nonblank(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) throw new TypeError(`${label} must be a nonblank stable identifier`)
  return value
}

function collectStrings(value: unknown, output: Set<string>, seen = new WeakSet<object>()): void {
  if (typeof value === 'string') { output.add(value); return }
  if (value === null || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  for (const child of Object.values(value as Record<string, unknown>)) collectStrings(child, output, seen)
}

function reserveDerived(reserved: Set<string>, prefix: string, parts: readonly unknown[]): string {
  const id = deriveActionStructuralId(prefix, parts)
  if (reserved.has(id)) throw new Error('Derived HSA penalty identifier collides with supplied or prior evidence')
  reserved.add(id)
  return id
}

function ageEvidence(
  owner: PersonId,
  evaluationDate: string,
  birth: Readonly<HsaPenaltyOwnerBirthEvidence>,
  evidence: ValidatedEvidence,
): HsaPenaltyAge65Evidence {
  const identity = JSON.stringify([owner, evaluationDate])
  const existing = evidence.ages.get(identity)
  if (existing !== undefined) return existing
  // IRC 223(f)(4)(C) waives the additional tax only for a distribution "after
  // the date on which" the beneficiary attains 65. Congress wrote the inclusive
  // form in 72(t)(2)(A)(i) ("on or after") when it meant it, and Pub 969 and the
  // Form 8889 instructions both say "after", so the exception begins the day
  // after the 65th birthday. A distribution on the birthday itself still bears
  // the 20% tax and therefore still requires disability evidence to be excused.
  const age65Date = addCalendarMonths(birth.birthDate, 780)
  if (age65Date === null || birth.birthDate > evaluationDate) throw new RangeError('HSA owner birth evidence cannot establish the age-65 threshold')
  const core = { predicate: 'hsaOwnerAge65Threshold' as const, ownerPersonId: owner, birthDate: birth.birthDate, evaluationDate, thresholdMonthCount: 780 as const, age65Date, age65Reached: evaluationDate > age65Date, calculation: 'addCalendarMonths780WithMonthEndClamp' as const, birthDateEvidenceId: birth.birthDateEvidenceId }
  const derived = { ...core, ageEvidenceId: reserveDerived(evidence.reserved, 'hsa-penalty-age65-evidence', [core]) }
  evidence.ages.set(identity, derived)
  return derived
}

type ValidatedEvidence = Readonly<{
  births: ReadonlyMap<PersonId, Readonly<HsaPenaltyOwnerBirthEvidence>>
  disabilities: ReadonlyMap<string, Readonly<HsaPenaltyDisabilityStatusEvidence>>
  ages: Map<string, Readonly<HsaPenaltyAge65Evidence>>
  rates: Map<'fixed20', Readonly<HsaFixedTwentyPercentPenaltyRateEvidence>>
  reserved: Set<string>
}>

function validateEvidence(
  input: Readonly<EvaluateAnnualHsaPenaltyInput>,
  character: Readonly<AnnualHsaWithdrawalCharacterAccepted>,
): ValidatedEvidence {
  if (input.ownerBirthEvidenceComplete !== true || input.disabilityStatusEvidenceComplete !== true) throw new RangeError('HSA penalty exception evidence inventories must be complete')
  const reserved = new Set<string>()
  collectStrings(input.characterInput, reserved)
  collectStrings(character, reserved)
  const evidenceIds = new Set<string>()
  const births = new Map<PersonId, HsaPenaltyOwnerBirthEvidence>()
  for (const raw of input.ownerBirthEvidence) {
    if (!exactKeys(raw, BIRTH_KEYS)) throw new TypeError('HSA owner birth evidence must have an exact shape')
    const ownerPersonId = personIdSchema.parse(raw.ownerPersonId)
    const birthDate = canonicalDate(raw.birthDate)
    const evidenceId = nonblank(raw.birthDateEvidenceId, 'HSA birth-date evidence ID')
    if (raw.predicate !== 'authoritativeHsaOwnerBirthDate' || raw.authoritative !== true || reserved.has(evidenceId) || evidenceIds.has(evidenceId) || births.has(ownerPersonId)) throw new RangeError('HSA owner birth evidence is foreign, duplicated, or colliding')
    evidenceIds.add(evidenceId)
    births.set(ownerPersonId, { ...raw, ownerPersonId, birthDate, birthDateEvidenceId: evidenceId })
  }
  const disabilities = new Map<string, HsaPenaltyDisabilityStatusEvidence>()
  for (const raw of input.disabilityStatusEvidence) {
    if (!exactKeys(raw, DISABILITY_KEYS)) throw new TypeError('HSA disability evidence must have an exact shape')
    const ownerPersonId = personIdSchema.parse(raw.ownerPersonId)
    const evaluationDate = canonicalDate(raw.evaluationDate)
    const qualificationDate = raw.disabilityQualificationDate === null ? null : canonicalDate(raw.disabilityQualificationDate)
    const evidenceId = nonblank(raw.disabilityEvidenceId, 'HSA disability evidence ID')
    const identity = JSON.stringify([ownerPersonId, evaluationDate])
    if (raw.predicate !== 'authoritativeHsaDisabilityStatusOnDistributionDate' || raw.authoritative !== true || typeof raw.qualifiedOnEvaluationDate !== 'boolean' || (raw.qualifiedOnEvaluationDate ? qualificationDate === null || qualificationDate > evaluationDate : qualificationDate !== null && qualificationDate <= evaluationDate) || reserved.has(evidenceId) || evidenceIds.has(evidenceId) || disabilities.has(identity)) throw new RangeError('HSA disability status evidence is contradictory, duplicated, or colliding')
    evidenceIds.add(evidenceId)
    disabilities.set(identity, { ...raw, ownerPersonId, evaluationDate, disabilityQualificationDate: qualificationDate, disabilityEvidenceId: evidenceId })
  }
  for (const id of evidenceIds) reserved.add(id)

  const ordinary = character.allocations.filter((allocation) =>
    allocation.taxCharacter.some((segment) => segment.kind === 'ordinaryIncome'))
  const requiredOwners = new Set(ordinary.map((allocation) => allocation.ownerPersonId))
  if (births.size !== requiredOwners.size || [...requiredOwners].some((owner) => !births.has(owner))) throw new RangeError('HSA birth evidence must exactly cover owners with nonqualified character')
  const requiredDisabilityKeys = new Set<string>()
  for (const allocation of ordinary) {
    const birth = births.get(allocation.ownerPersonId)!
    const threshold = addCalendarMonths(birth.birthDate, 780)
    if (threshold === null) throw new RangeError('HSA age-65 threshold is unavailable')
    if (allocation.evaluationDate <= threshold) requiredDisabilityKeys.add(JSON.stringify([allocation.ownerPersonId, allocation.evaluationDate]))
  }
  if (disabilities.size !== requiredDisabilityKeys.size || [...requiredDisabilityKeys].some((key) => !disabilities.has(key))) throw new RangeError('HSA disability evidence must exactly cover under-65 nonqualified allocations')
  return { births, disabilities, ages: new Map(), rates: new Map(), reserved }
}

function fixedTwentyPercentRateEvidence(
  evidence: ValidatedEvidence,
): HsaFixedTwentyPercentPenaltyRateEvidence {
  const existing = evidence.rates.get('fixed20')
  if (existing !== undefined) return existing
  const core = { kind: 'hsaNonqualifiedDistributionRate' as const, numerator: 1 as const, denominator: 5 as const, percent: 20 as const, quantization: 'nearestCentHalfUp' as const, intermediateArithmetic: 'bigintRational' as const }
  const derived = { ...core, rateEvidenceId: reserveDerived(evidence.reserved, 'hsa-nonqualified-penalty-rate', [core]) }
  evidence.rates.set('fixed20', derived)
  return derived
}

function evaluateSegment(
  allocation: Readonly<HsaWithdrawalAllocationCharacterCoverage>,
  segment: Readonly<HsaWithdrawalTaxCharacter>,
  characterIndex: number,
  evidence: ValidatedEvidence,
): HsaSegmentPenaltyEvaluation {
  const base = { actionId: segment.actionId, allocationId: segment.allocationId, sourceAccountId: segment.sourceAccountId, ownerPersonId: segment.ownerPersonId, evaluationDate: segment.evaluationDate, characterIndex, characterSegmentId: segment.segmentId, characterKind: segment.kind, characterAmount: segment.amount, annualLedgerEvidenceId: allocation.annualLedgerEvidenceId, ledgerEvidenceId: allocation.ledgerEvidenceId, characterEvidenceId: allocation.characterEvidenceId,
    // IRC 223(f)(1): a distribution used exclusively for qualified medical
    // expenses is not includible in gross income at all, so it carries no
    // taxable exposure. Reporting the full segment here would let a
    // downstream income sum add tax-free reimbursements to ordinary income.
    taxableAmountExposed: segment.kind === 'qualifiedTaxFree' ? asUsdCents(0) : segment.amount }
  if (segment.kind === 'qualifiedTaxFree') {
    if (allocation.consumptionEvidenceIds.length === 0 || segment.amount !== allocation.qualifiedMedicalAmount) throw new RangeError('Qualified HSA character must bind its nonempty reimbursement consumptions')
    const acceptedEvidence = { treatmentAmount: segment.amount, qualifiedMedicalAmount: allocation.qualifiedMedicalAmount, reimbursementScopeId: allocation.reimbursementScopeId, expenseStateBeforeId: allocation.expenseStateBeforeId, expenseStateAfterId: allocation.expenseStateAfterId, consumptionEvidenceIds: allocation.consumptionEvidenceIds as [string, ...string[]] }
    const core = { ...base, treatment: 'hsaQualifiedMedical' as const, penaltyRatePercent: 0 as const, finalPenaltyAmount: 0 as const, acceptedEvidence }
    return { ...core, penaltyEvidenceId: reserveDerived(evidence.reserved, 'hsa-qualified-medical-penalty-evidence', [core]) }
  }

  if (segment.amount !== allocation.nonqualifiedAmount) throw new RangeError('Ordinary HSA character must equal the nonqualified ledger residual')
  const birth = evidence.births.get(segment.ownerPersonId)
  if (birth === undefined) throw new RangeError('HSA ordinary-income penalty requires owner birth evidence')
  const age = ageEvidence(segment.ownerPersonId, segment.evaluationDate, birth, evidence)
  if (age.age65Reached) {
    const acceptedEvidence = { treatmentAmount: segment.amount, ageEvidence: { ...age, age65Reached: true as const } }
    const core = { ...base, treatment: 'hsaAge65' as const, penaltyRatePercent: 0 as const, finalPenaltyAmount: 0 as const, acceptedEvidence }
    return { ...core, penaltyEvidenceId: reserveDerived(evidence.reserved, 'hsa-age65-penalty-evidence', [core]) }
  }

  const disability = evidence.disabilities.get(JSON.stringify([segment.ownerPersonId, segment.evaluationDate]))
  if (disability === undefined) throw new RangeError('HSA under-65 ordinary income requires dated disability status evidence')
  const rejectedAge = { ...age, age65Reached: false as const }
  if (disability.qualifiedOnEvaluationDate) {
    const qualified = { ...disability, qualifiedOnEvaluationDate: true as const, disabilityQualificationDate: disability.disabilityQualificationDate! }
    const acceptedEvidence = { treatmentAmount: segment.amount, ageEvidence: rejectedAge, disabilityEvidence: qualified }
    const core = { ...base, treatment: 'hsaDisability' as const, penaltyRatePercent: 0 as const, finalPenaltyAmount: 0 as const, acceptedEvidence }
    return { ...core, penaltyEvidenceId: reserveDerived(evidence.reserved, 'hsa-disability-penalty-evidence', [core]) }
  }

  const rateEvidence = fixedTwentyPercentRateEvidence(evidence)
  const finalPenaltyAmount = asUsdCents(Number(exactCentProRataNearestHalfUp(BigInt(segment.amount), 1n, 5n)))
  const acceptedEvidence = { treatmentAmount: segment.amount, ageEvidence: rejectedAge, rejectedDisabilityEvidence: { ...disability, qualifiedOnEvaluationDate: false as const }, rateEvidence }
  const core = { ...base, treatment: 'penaltyApplies' as const, penaltyRatePercent: 20 as const, finalPenaltyAmount, acceptedEvidence }
  return { ...core, penaltyEvidenceId: reserveDerived(evidence.reserved, 'hsa-penalty-applies-evidence', [core]) }
}

/** Rebuilds HSA character and evaluates only its segment-level additional tax. */
export function evaluateAnnualHsaPenalty(
  input: Readonly<EvaluateAnnualHsaPenaltyInput>,
): Readonly<EvaluateAnnualHsaPenaltyResult> {
  const raw = plainDataSnapshot(input)
  if (raw === INVALID_SNAPSHOT || !exactKeys(raw, INPUT_KEYS)) return blocked(null, 'invalidInput', 'Annual HSA penalty input must be exact lossless plain data')
  const snapshot = raw as unknown as EvaluateAnnualHsaPenaltyInput
  const character = classifyAnnualHsaWithdrawalCharacter(snapshot.characterInput)
  if (character.status !== 'accepted') return blocked(character, 'characterBlocked', 'HSA penalty requires accepted rebuilt withdrawal character')
  try {
    const evidence = validateEvidence(snapshot, character)
    const allocations: HsaAllocationPenaltyCoverage[] = []
    let aggregatePenaltyAmount = asUsdCents(0)
    for (const allocation of character.allocations) {
      const evaluations = allocation.taxCharacter.map((segment, index) => evaluateSegment(allocation, segment, index, evidence))
      const penaltyRelevantCharacterAmount = evaluations.reduce((total, item) => addUsdCents(total, item.taxableAmountExposed), asUsdCents(0))
      const aggregateAllocationPenalty = evaluations.reduce((total, item) => addUsdCents(total, asUsdCents(item.finalPenaltyAmount)), asUsdCents(0))
      const nonPenaltyRelevantCharacterAmount = asUsdCents(allocation.executedAmount - penaltyRelevantCharacterAmount)
      // Coverage is still a bijection over segments; what changed is that the
      // exposed amount is now a partition of the allocation rather than all
      // of it. Qualified medical cents are covered and evaluated, at zero.
      if (evaluations.length !== allocation.taxCharacter.length || nonPenaltyRelevantCharacterAmount < 0 || penaltyRelevantCharacterAmount + nonPenaltyRelevantCharacterAmount !== allocation.executedAmount) throw new RangeError('HSA penalty coverage must bijectively cover every character segment')
      const core = { predicate: 'completeHsaPenaltyCharacterCoverageForAllocation' as const, reimbursementScopeId: allocation.reimbursementScopeId, actionId: allocation.actionId, allocationId: allocation.allocationId, sourceAccountId: allocation.sourceAccountId, ownerPersonId: allocation.ownerPersonId, evaluationDate: allocation.evaluationDate, executedAmount: allocation.executedAmount, characterEvidenceId: allocation.characterEvidenceId, annualLedgerEvidenceId: allocation.annualLedgerEvidenceId, ledgerEvidenceId: allocation.ledgerEvidenceId, penaltyRelevantCharacterAmount, coveredPenaltyExposureAmount: allocation.executedAmount, nonPenaltyRelevantCharacterAmount, coverageDifferenceAmount: 0 as const, evaluations, aggregatePenaltyAmount: aggregateAllocationPenalty }
      allocations.push({ ...core, coverageEvidenceId: reserveDerived(evidence.reserved, 'hsa-penalty-character-coverage', [core]) })
      aggregatePenaltyAmount = addUsdCents(aggregatePenaltyAmount, aggregateAllocationPenalty)
    }
    return deepFreeze({ status: 'evaluated', committed: false, movement: 'notEstablished', actionability: 'notEstablished', publication: 'notEstablished', character, allocations, aggregatePenaltyAmount, issues: [] }) as AnnualHsaPenaltyEvaluated
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'HSA penalty evidence is invalid'
    const kind = detail.includes('collid') ? 'identifierCollision' : detail.includes('requires') || detail.includes('cover') ? 'missingEvidence' : 'evidenceMismatch'
    return blocked(character, kind, detail)
  }
}
