import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type BeneficiaryTraditionalIraMovementCandidateEvidence,
  type StageBeneficiaryTraditionalIraMovementCandidateInput,
  type StagedBeneficiaryTraditionalIraMovementCandidateResult,
} from './beneficiaryTraditionalIraMovementCandidate.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import type { PositiveUsdCents, UsdCents } from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'

export interface BeneficiaryTraditionalIraAnnualBatchMemberManifest {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  executionDate: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  executedAmount: PositiveUsdCents
  openingBalanceAmount: UsdCents
  closingBalanceAmount: UsdCents
  movementCandidateId: string
}

export interface CompleteBeneficiaryTraditionalIraAnnualBatchManifest {
  predicate:
    'completeBeneficiaryTraditionalIraAnnualBatchForBeneficiaryDecedentAndTaxYear'
  batchManifestId: string
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  basisPoolId: string
  basisPoolEvidenceId: string
  annualAllocationEvidenceId: string
  rmdPoolId: string
  rmdRequiredAmount: UsdCents
  members: BeneficiaryTraditionalIraAnnualBatchMemberManifest[]
}

export interface FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput {
  manifest: CompleteBeneficiaryTraditionalIraAnnualBatchManifest
  members: StageBeneficiaryTraditionalIraMovementCandidateInput[]
}

export interface FinalBeneficiaryTraditionalIraAnnualMemberEvidence {
  movementCandidateId: string
  characterization:
    StagedBeneficiaryTraditionalIraMovementCandidateResult['characterization']
  deathPenaltyEvidence:
    StagedBeneficiaryTraditionalIraMovementCandidateResult['deathPenaltyEvidence']
  candidate: Readonly<BeneficiaryTraditionalIraMovementCandidateEvidence>
  finalMemberEvidenceId: string
}

export interface CompleteBeneficiaryTraditionalIraAnnualEvidence {
  predicate:
    'completeBeneficiaryTraditionalIraAnnualEvidenceForBeneficiaryDecedentAndTaxYear'
  batchManifestId: string
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  basisPoolId: string
  basisPoolEvidenceId: string
  annualAllocationEvidenceId: string
  rmdPoolId: string
  rmdRequiredAmount: UsdCents
  initialRmdSatisfiedAmount: UsdCents
  finalRmdSatisfiedAmount: UsdCents
  finalRmdRemainingAmount: UsdCents
  canonicalMembers:
    readonly Readonly<FinalBeneficiaryTraditionalIraAnnualMemberEvidence>[]
  finalMemberEvidenceIds: readonly string[]
  finalAnnualEvidenceId: string
}

export interface FinalizedBeneficiaryTraditionalIraAnnualEvidenceResult {
  status: 'annualEvidenceFinalized'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  reasons: readonly []
  annualEvidence: Readonly<CompleteBeneficiaryTraditionalIraAnnualEvidence>
}

export interface UnsupportedBeneficiaryTraditionalIraAnnualEvidenceResult {
  status: 'unsupported'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  reasons: readonly [Readonly<ActionReason>]
  annualEvidence: null
}

export type FinalizeBeneficiaryTraditionalIraAnnualEvidenceResult =
  | FinalizedBeneficiaryTraditionalIraAnnualEvidenceResult
  | UnsupportedBeneficiaryTraditionalIraAnnualEvidenceResult

const INPUT_KEYS = ['manifest', 'members'] as const
const MANIFEST_KEYS = [
  'predicate',
  'batchManifestId',
  'beneficiaryPersonId',
  'decedentPersonId',
  'taxYear',
  'basisPoolId',
  'basisPoolEvidenceId',
  'annualAllocationEvidenceId',
  'rmdPoolId',
  'rmdRequiredAmount',
  'members',
] as const
const MEMBER_KEYS = [
  'actionId',
  'allocationId',
  'sourceAccountId',
  'executionDate',
  'executionSequence',
  'requestedAmount',
  'executedAmount',
  'openingBalanceAmount',
  'closingBalanceAmount',
  'movementCandidateId',
] as const
const INVALID_SNAPSHOT = Symbol('invalidSnapshot')

function plainDataSnapshot(
  value: unknown,
  ancestors = new Set<object>(),
): unknown | typeof INVALID_SNAPSHOT {
  if (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'number' ||
    typeof value === 'boolean'
  ) return value
  if (typeof value !== 'object' || ancestors.has(value)) return INVALID_SNAPSHOT
  try {
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) return INVALID_SNAPSHOT
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID_SNAPSHOT
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')
      const arrayLength = length?.value
      if (
        length === undefined || length.enumerable ||
        !Object.hasOwn(length, 'value') || typeof arrayLength !== 'number' ||
        !Number.isSafeInteger(arrayLength) || arrayLength < 0 ||
        keys.length !== arrayLength + 1 || !keys.includes('length') ||
        Array.from({ length: arrayLength }, (_, index) => String(index))
          .some((key) => !keys.includes(key))
      ) return INVALID_SNAPSHOT
    }
    const output: unknown[] | Record<string, unknown> = array
      ? []
      : Object.create(null) as Record<string, unknown>
    ancestors.add(value)
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined ||
        !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) return INVALID_SNAPSHOT
      const child = plainDataSnapshot(descriptor.value, ancestors)
      if (child === INVALID_SNAPSHOT) return INVALID_SNAPSHOT
      Object.defineProperty(output, key, {
        configurable: true,
        enumerable: true,
        writable: true,
        value: child,
      })
    }
    return output
  } catch {
    return INVALID_SNAPSHOT
  } finally {
    ancestors.delete(value)
  }
}

function exactKeys(value: unknown, keys: readonly string[]): boolean {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }
  const actual = Object.keys(value)
  return actual.length === keys.length && actual.every((key) => keys.includes(key))
}

function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function unsupported(): Readonly<
  UnsupportedBeneficiaryTraditionalIraAnnualEvidenceResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    annualEvidence: null,
  })
}

function canonicalCompare(
  left: Readonly<BeneficiaryTraditionalIraAnnualBatchMemberManifest>,
  right: Readonly<BeneficiaryTraditionalIraAnnualBatchMemberManifest>,
): number {
  return compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId)
}

function memberKey(
  member: Readonly<BeneficiaryTraditionalIraAnnualBatchMemberManifest>,
): string {
  return deriveActionStructuralId('beneficiary-ira-annual-member-key', [
    member.actionId,
    member.allocationId,
    member.sourceAccountId,
    member.executionDate,
    member.executionSequence,
  ])
}

function candidateMatchesManifest(
  candidate: Readonly<BeneficiaryTraditionalIraMovementCandidateEvidence>,
  movementCandidateId: string,
  declared: Readonly<BeneficiaryTraditionalIraAnnualBatchMemberManifest>,
): boolean {
  return candidate.actionId === declared.actionId &&
    candidate.allocationId === declared.allocationId &&
    candidate.sourceAccountId === declared.sourceAccountId &&
    candidate.executionDate === declared.executionDate &&
    candidate.executionSequence === declared.executionSequence &&
    candidate.requestedAmount === declared.requestedAmount &&
    candidate.executedAmount === declared.executedAmount &&
    candidate.openingBalanceAmount === declared.openingBalanceAmount &&
    candidate.candidateClosingBalanceAmount === declared.closingBalanceAmount &&
    movementCandidateId === declared.movementCandidateId
}

function primitiveFor(
  candidate: Readonly<BeneficiaryTraditionalIraMovementCandidateEvidence>,
  members: readonly Readonly<StageBeneficiaryTraditionalIraMovementCandidateInput>[],
): Readonly<StageBeneficiaryTraditionalIraMovementCandidateInput> | null {
  const matches = members.filter((member) => {
    const identity = member.penaltyInput.characterizationInput
    const source = member.sourceSnapshots?.length === 1
      ? member.sourceSnapshots[0]
      : undefined
    return identity.actionId === candidate.actionId &&
      identity.allocationId === candidate.allocationId &&
      identity.sourceAccountId === candidate.sourceAccountId &&
      identity.evaluationDate === candidate.executionDate &&
      source?.executionSequence === candidate.executionSequence
  })
  return matches.length === 1 ? matches[0]! : null
}

function sharedPoolDigests(
  member: Readonly<StagedBeneficiaryTraditionalIraMovementCandidateResult>,
): readonly [string, string] {
  const source = member.characterization.acceptedSourceEligibility
  const basis = source.basisEvidence
  const rmd = source.rmdEvidence
  return [
    deriveActionStructuralId('beneficiary-ira-shared-basis', [[
      basis.poolId, basis.taxYear, basis.beneficiaryPersonId,
      basis.inheritedFromPersonId, basis.accountIds,
      basis.openingInheritedBasisAmount, basis.basisNumeratorAmount,
      basis.yearEndApplicablePoolBalanceAmount,
      basis.form8606Line7DistributionAmount,
      basis.form8606Line8NetConversionAmount,
      basis.annualBasisDenominatorAmount, basis.annualBasisRatio,
      basis.basisRecoveryQuantization,
      basis.annualDistributionBasisAllocation,
    ]]),
    deriveActionStructuralId('beneficiary-ira-shared-rmd', [[
      rmd.poolId, rmd.taxYear, rmd.beneficiaryPersonId,
      rmd.inheritedFromPersonId, rmd.accountIds, rmd.requiredAmount,
    ]]),
  ]
}

function characterSegmentsMatch(
  staged: Readonly<StagedBeneficiaryTraditionalIraMovementCandidateResult>,
): boolean {
  if (staged.status !== 'movementCandidateStaged') return false
  const basis = staged.characterization.acceptedSourceEligibility.basisEvidence
  const allocation = basis.annualDistributionBasisAllocation.allocations.find(
    (entry) =>
      entry.actionId === staged.candidate.actionId &&
      entry.allocationId === staged.candidate.allocationId,
  )
  if (allocation === undefined) return false
  let basisReturn = 0
  let ordinaryIncome = 0
  for (const segment of staged.characterization.taxCharacter) {
    if (
      segment.actionId !== staged.candidate.actionId ||
      segment.allocationId !== staged.candidate.allocationId ||
      segment.sourceAccountId !== staged.candidate.sourceAccountId ||
      segment.characterEvidence.basisEvidenceId !== basis.evidenceId ||
      segment.characterEvidence.allocationEvidenceId !==
        basis.annualDistributionBasisAllocation.allocationEvidenceId ||
      segment.characterEvidence.segmentAmount !== segment.amount
    ) return false
    if (segment.kind === 'basisReturn') basisReturn += segment.amount
    else ordinaryIncome += segment.amount
  }
  return Number.isSafeInteger(basisReturn) &&
    Number.isSafeInteger(ordinaryIncome) &&
    basisReturn === allocation.allocatedBasisAmount &&
    ordinaryIncome === allocation.taxableAmount &&
    basisReturn + ordinaryIncome === staged.candidate.executedAmount &&
    staged.deathPenaltyEvidence.basisReturnExcludedAmount === basisReturn &&
    staged.deathPenaltyEvidence.taxableAmountExposed === ordinaryIncome
}

function registerRole(
  roles: Map<string, string>,
  id: unknown,
  role: string,
): boolean {
  if (!nonblank(id)) return false
  const existing = roles.get(id)
  if (
    existing !== undefined &&
    (existing !== role || (role !== 'basisPool' && role !== 'annualAllocation'))
  ) return false
  roles.set(id, role)
  return true
}

/**
 * Rebuilds and atomically finalizes one complete beneficiary/decedent/year
 * evidence batch. It stages evidence only and never commits account movement.
 */
export function finalizeBeneficiaryTraditionalIraAnnualEvidence(
  input: Readonly<FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput>,
): Readonly<FinalizeBeneficiaryTraditionalIraAnnualEvidenceResult> {
  try {
    const raw = plainDataSnapshot(input)
    if (raw === INVALID_SNAPSHOT || !exactKeys(raw, INPUT_KEYS)) {
      return unsupported()
    }
    const snapshot = raw as unknown as
      FinalizeBeneficiaryTraditionalIraAnnualEvidenceInput
    const manifest = snapshot.manifest
    if (
      !exactKeys(manifest, MANIFEST_KEYS) ||
      manifest.predicate !==
        'completeBeneficiaryTraditionalIraAnnualBatchForBeneficiaryDecedentAndTaxYear' ||
      !nonblank(manifest.batchManifestId) ||
      !nonblank(manifest.basisPoolId) ||
      !nonblank(manifest.basisPoolEvidenceId) ||
      !nonblank(manifest.annualAllocationEvidenceId) ||
      !nonblank(manifest.rmdPoolId) ||
      !Number.isSafeInteger(manifest.taxYear) ||
      manifest.taxYear < 1 ||
      manifest.taxYear > 9999 ||
      !Number.isSafeInteger(manifest.rmdRequiredAmount) ||
      manifest.rmdRequiredAmount < 0 ||
      Object.is(manifest.rmdRequiredAmount, -0) ||
      !Array.isArray(manifest.members) ||
      !Array.isArray(snapshot.members) ||
      manifest.members.length === 0 ||
      manifest.members.length !== snapshot.members.length ||
      manifest.members.some((member) => !exactKeys(member, MEMBER_KEYS))
    ) return unsupported()

    const declared = [...manifest.members].sort(canonicalCompare)
    const memberKeys = declared.map(memberKey)
    const actionAllocationKeys = declared.map((member) =>
      `${member.actionId}\u0000${member.allocationId}`,
    )
    const actionSourceKeys = declared.map((member) =>
      `${member.actionId}\u0000${member.sourceAccountId}`,
    )
    if (
      new Set(memberKeys).size !== memberKeys.length ||
      new Set(actionAllocationKeys).size !== declared.length ||
      new Set(actionSourceKeys).size !== declared.length ||
      new Set(declared.map((member) => member.movementCandidateId)).size !==
        declared.length
    ) return unsupported()
    const scheduleByAction = new Map<string, string>()
    const actionBySchedule = new Map<string, string>()
    for (const member of declared) {
      const schedule =
        `${member.executionDate}\u0000${String(member.executionSequence)}`
      const actionSchedule = scheduleByAction.get(member.actionId)
      const scheduleAction = actionBySchedule.get(schedule)
      if (
        (actionSchedule !== undefined && actionSchedule !== schedule) ||
        (scheduleAction !== undefined && scheduleAction !== member.actionId)
      ) return unsupported()
      scheduleByAction.set(member.actionId, schedule)
      actionBySchedule.set(schedule, member.actionId)
    }

    const rebuilt = snapshot.members.map((member) =>
      stageBeneficiaryTraditionalIraMovementCandidate(member),
    )
    if (rebuilt.some((member) => member.status !== 'movementCandidateStaged')) {
      return unsupported()
    }
    const staged = rebuilt as readonly Readonly<
      StagedBeneficiaryTraditionalIraMovementCandidateResult
    >[]
    const byKey = new Map(staged.map((member) => [memberKey({
      ...member.candidate,
      closingBalanceAmount: member.candidate.candidateClosingBalanceAmount,
      movementCandidateId: member.movementCandidateId,
    }), member]))
    if (byKey.size !== staged.length) return unsupported()

    const canonical: Array<Readonly<StagedBeneficiaryTraditionalIraMovementCandidateResult>> = []
    for (const declaredMember of declared) {
      const member = byKey.get(memberKey(declaredMember))
      if (
        member === undefined ||
        member.status !== 'movementCandidateStaged' ||
        !candidateMatchesManifest(
          member.candidate,
          member.movementCandidateId,
          declaredMember,
        ) ||
        !characterSegmentsMatch(member)
      ) return unsupported()
      canonical.push(member)
    }

    const first = canonical[0]!
    const firstSource = first.characterization.acceptedSourceEligibility
    const firstBasis = firstSource.basisEvidence
    const firstAllocation = firstBasis.annualDistributionBasisAllocation
    const firstRmd = firstSource.rmdEvidence
    const sharedDigests = sharedPoolDigests(first)
    const firstPrimitive = primitiveFor(first.candidate, snapshot.members)
    if (
      firstSource.beneficiaryPersonId !== manifest.beneficiaryPersonId ||
      firstSource.decedentPersonId !== manifest.decedentPersonId ||
      firstBasis.taxYear !== manifest.taxYear ||
      firstRmd.taxYear !== manifest.taxYear ||
      firstBasis.poolId !== manifest.basisPoolId ||
      firstAllocation.allocationEvidenceId !== manifest.annualAllocationEvidenceId ||
      firstRmd.poolId !== manifest.rmdPoolId ||
      firstRmd.requiredAmount !== manifest.rmdRequiredAmount ||
      firstPrimitive?.penaltyInput.characterizationInput.basisPoolEvidence
        ?.evidenceId !== manifest.basisPoolEvidenceId
    ) return unsupported()

    const allocationMembers = [...firstAllocation.allocations].sort((left, right) =>
      compareUtf16CodeUnits(left.scheduledDate ?? '', right.scheduledDate ?? '') ||
      left.scheduledSequence - right.scheduledSequence ||
      compareUtf16CodeUnits(left.actionId, right.actionId) ||
      compareUtf16CodeUnits(left.allocationId, right.allocationId),
    )
    if (allocationMembers.length !== declared.length) return unsupported()
    for (let index = 0; index < declared.length; index += 1) {
      const allocation = allocationMembers[index]!
      const member = declared[index]!
      if (
        allocation.actionId !== member.actionId ||
        allocation.allocationId !== member.allocationId ||
        allocation.sourceAccountId !== member.sourceAccountId ||
        allocation.scheduledDate !== member.executionDate ||
        allocation.scheduledSequence !== member.executionSequence ||
        allocation.grossAmount !== member.executedAmount
      ) return unsupported()
    }

    const roles = new Map<string, string>()
    if (!registerRole(roles, manifest.batchManifestId, 'batchManifest')) {
      return unsupported()
    }
    let satisfied: number = firstRmd.satisfiedBeforeExecution
    let remaining: number = firstRmd.remainingBeforeExecution
    const lastClosingBySource = new Map<AccountId, UsdCents>()
    for (const member of canonical) {
      const source = member.characterization.acceptedSourceEligibility
      const basis = source.basisEvidence
      const rmd = source.rmdEvidence
      const primitive = primitiveFor(member.candidate, snapshot.members)
      const memberDigests = sharedPoolDigests(member)
      if (
        primitive?.penaltyInput.characterizationInput.basisPoolEvidence
          ?.evidenceId !== manifest.basisPoolEvidenceId ||
        memberDigests[0] !== sharedDigests[0] ||
        memberDigests[1] !== sharedDigests[1] ||
        rmd.satisfiedBeforeExecution !== satisfied ||
        rmd.remainingBeforeExecution !== remaining ||
        remaining !== manifest.rmdRequiredAmount - satisfied
      ) return unsupported()

      const priorClosing = lastClosingBySource.get(member.candidate.sourceAccountId)
      if (
        priorClosing !== undefined &&
        member.candidate.openingBalanceAmount !== priorClosing
      ) return unsupported()
      lastClosingBySource.set(
        member.candidate.sourceAccountId,
        member.candidate.candidateClosingBalanceAmount,
      )

      const authority: Array<[unknown, string]> = [
        [source.inheritanceEvidenceId, 'inheritance'],
        [manifest.basisPoolEvidenceId, 'basisPool'],
        [basis.evidenceId, 'basisMember'],
        [manifest.annualAllocationEvidenceId, 'annualAllocation'],
        [rmd.evidenceId, 'rmdMember'],
        [member.deathPenaltyEvidence.sourceCharacterEvidenceId, 'sourceCharacter'],
        [member.deathPenaltyEvidence.penaltyEvidenceId, 'deathPenalty'],
        [member.candidate.physicalSourceEvidenceId, 'physicalSource'],
        [member.movementCandidateId, 'movementCandidate'],
        ...member.deathPenaltyEvidence.characterBindings.map(
          (binding): [unknown, string] => [binding.characterEvidenceId, 'character'],
        ),
      ]
      if (authority.some(([id, role]) => !registerRole(roles, id, role))) {
        return unsupported()
      }
      const increment = Math.min(member.candidate.executedAmount, remaining)
      if (!Number.isSafeInteger(satisfied + increment)) return unsupported()
      satisfied += increment
      remaining = manifest.rmdRequiredAmount - satisfied
      if (!Number.isSafeInteger(remaining) || remaining < 0) return unsupported()
    }

    const canonicalMembers = canonical.map((member) => {
      const finalMemberEvidenceId = deriveActionStructuralId(
        'beneficiary-ira-final-annual-member',
        [
          manifest.batchManifestId,
          manifest.taxYear,
          member.movementCandidateId,
          member.characterization,
          member.deathPenaltyEvidence,
          member.candidate,
        ],
      )
      if (!registerRole(roles, finalMemberEvidenceId, 'finalMember')) {
        throw new Error('Final member evidence ID collision')
      }
      return {
        movementCandidateId: member.movementCandidateId,
        characterization: member.characterization,
        deathPenaltyEvidence: member.deathPenaltyEvidence,
        candidate: member.candidate,
        finalMemberEvidenceId,
      }
    })
    const finalMemberEvidenceIds = canonicalMembers.map(
      (member) => member.finalMemberEvidenceId,
    )
    const finalAnnualEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-final-annual-evidence',
      [
        [
          manifest.predicate, manifest.batchManifestId,
          manifest.beneficiaryPersonId, manifest.decedentPersonId,
          manifest.taxYear, manifest.basisPoolId,
          manifest.basisPoolEvidenceId, manifest.annualAllocationEvidenceId,
          manifest.rmdPoolId, manifest.rmdRequiredAmount,
          declared.map((member) => [
            member.actionId, member.allocationId, member.sourceAccountId,
            member.executionDate, member.executionSequence,
            member.requestedAmount, member.executedAmount,
            member.openingBalanceAmount, member.closingBalanceAmount,
            member.movementCandidateId,
          ]),
        ],
        firstRmd.satisfiedBeforeExecution,
        satisfied,
        remaining,
        finalMemberEvidenceIds,
      ],
    )
    if (!registerRole(roles, finalAnnualEvidenceId, 'finalAnnual')) {
      return unsupported()
    }
    return deepFreeze({
      status: 'annualEvidenceFinalized',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [],
      annualEvidence: {
        predicate:
          'completeBeneficiaryTraditionalIraAnnualEvidenceForBeneficiaryDecedentAndTaxYear',
        batchManifestId: manifest.batchManifestId,
        beneficiaryPersonId: manifest.beneficiaryPersonId,
        decedentPersonId: manifest.decedentPersonId,
        taxYear: manifest.taxYear,
        basisPoolId: manifest.basisPoolId,
        basisPoolEvidenceId: manifest.basisPoolEvidenceId,
        annualAllocationEvidenceId: manifest.annualAllocationEvidenceId,
        rmdPoolId: manifest.rmdPoolId,
        rmdRequiredAmount: manifest.rmdRequiredAmount,
        initialRmdSatisfiedAmount: firstRmd.satisfiedBeforeExecution,
        finalRmdSatisfiedAmount: satisfied as UsdCents,
        finalRmdRemainingAmount: remaining as UsdCents,
        canonicalMembers,
        finalMemberEvidenceIds,
        finalAnnualEvidenceId,
      },
    })
  } catch {
    return unsupported()
  }
}
