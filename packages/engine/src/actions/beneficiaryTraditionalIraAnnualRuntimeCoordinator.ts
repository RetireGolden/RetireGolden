import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  finalizeBeneficiaryTraditionalIraAnnualEvidence,
  type BeneficiaryTraditionalIraAnnualBatchMemberManifest,
  type CompleteBeneficiaryTraditionalIraAnnualBatchManifest,
  type CompleteBeneficiaryTraditionalIraAnnualEvidence,
} from './beneficiaryTraditionalIraAnnualFinalization.js'
import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type StageBeneficiaryTraditionalIraMovementCandidateInput,
  type StagedBeneficiaryTraditionalIraMovementCandidateResult,
} from './beneficiaryTraditionalIraMovementCandidate.js'
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
  positiveUsdCentsSchema,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { INVALID_SNAPSHOT, plainDataSnapshot } from './plainData.js'

export interface BeneficiaryTraditionalIraAnnualRuntimeSourceBalanceRecord {
  sourceAccountId: AccountId
  annualOpeningBalanceAmount: UsdCents
  annualFinalBalanceAmount: UsdCents
}

export interface BeneficiaryTraditionalIraAnnualRuntimeMemberRecord {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  executionDate: string
  executionSequence: number
  requestedAmount: PositiveUsdCents
  executedAmount: PositiveUsdCents
  openingBalanceAmount: UsdCents
  closingBalanceAmount: UsdCents
  physicalSourceEvidenceId: string
}

export interface CompleteBeneficiaryTraditionalIraAnnualRuntimeInventoryAttestation {
  predicate: 'completeBeneficiaryTraditionalIraAnnualRuntimeInventory'
  inventoryStatus: 'completeIncludingExplicitEmpty'
  inventoryEvidenceId: string
  upstreamInventoryEvidenceId: string
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  basisPoolId: string
  basisPoolEvidenceId: string
  annualAllocationEvidenceId: string
  rmdPoolId: string
  rmdRequiredAmount: UsdCents
  sourceAccountIds: readonly [AccountId, ...AccountId[]]
  sourceBalances:
    readonly Readonly<BeneficiaryTraditionalIraAnnualRuntimeSourceBalanceRecord>[]
  members:
    readonly Readonly<BeneficiaryTraditionalIraAnnualRuntimeMemberRecord>[]
}

export interface CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput {
  attestation:
    Readonly<CompleteBeneficiaryTraditionalIraAnnualRuntimeInventoryAttestation>
  members:
    readonly Readonly<StageBeneficiaryTraditionalIraMovementCandidateInput>[]
}

export interface BeneficiaryTraditionalIraAnnualRuntimeInventoryBinding {
  predicate:
    'beneficiaryTraditionalIraAnnualRuntimeInventoryBoundToFinalEvidence'
  inventoryEvidenceId: string
  upstreamInventoryEvidenceId: string
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  taxYear: number
  batchManifestId: string
  finalAnnualEvidenceId: string
  coordinatorEvidenceId: string
}

export interface BeneficiaryTraditionalIraAnnualRuntimeCoordinatedResult {
  status: 'annualRuntimeEvidenceCoordinated'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  reasons: readonly []
  inventoryBinding:
    Readonly<BeneficiaryTraditionalIraAnnualRuntimeInventoryBinding>
  annualEvidence: Readonly<CompleteBeneficiaryTraditionalIraAnnualEvidence>
}

export interface UnsupportedBeneficiaryTraditionalIraAnnualRuntimeResult {
  status: 'unsupported'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  reasons: readonly [Readonly<ActionReason>]
  inventoryBinding: null
  annualEvidence: null
}

export type CoordinateBeneficiaryTraditionalIraAnnualRuntimeResult =
  | BeneficiaryTraditionalIraAnnualRuntimeCoordinatedResult
  | UnsupportedBeneficiaryTraditionalIraAnnualRuntimeResult

const INPUT_KEYS = ['attestation', 'members'] as const
const ATTESTATION_KEYS = [
  'predicate', 'inventoryStatus', 'inventoryEvidenceId',
  'upstreamInventoryEvidenceId', 'beneficiaryPersonId', 'decedentPersonId',
  'taxYear', 'basisPoolId', 'basisPoolEvidenceId',
  'annualAllocationEvidenceId', 'rmdPoolId', 'rmdRequiredAmount',
  'sourceAccountIds', 'sourceBalances', 'members',
] as const
const BALANCE_KEYS = [
  'sourceAccountId', 'annualOpeningBalanceAmount',
  'annualFinalBalanceAmount',
] as const
const MEMBER_KEYS = [
  'actionId', 'allocationId', 'sourceAccountId', 'executionDate',
  'executionSequence', 'requestedAmount', 'executedAmount',
  'openingBalanceAmount', 'closingBalanceAmount',
  'physicalSourceEvidenceId',
] as const

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
  UnsupportedBeneficiaryTraditionalIraAnnualRuntimeResult
> {
  return deepFreeze({
    status: 'unsupported',
    movement: 'notCommitted',
    committed: false,
    actionability: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    inventoryBinding: null,
    annualEvidence: null,
  })
}

function memberCompare(
  left: Readonly<BeneficiaryTraditionalIraAnnualRuntimeMemberRecord>,
  right: Readonly<BeneficiaryTraditionalIraAnnualRuntimeMemberRecord>,
): number {
  return compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
}

function memberKey(
  member: Readonly<BeneficiaryTraditionalIraAnnualRuntimeMemberRecord>,
): string {
  return deriveActionStructuralId('beneficiary-ira-runtime-member-key', [[
    member.actionId, member.allocationId, member.sourceAccountId,
    member.executionDate, member.executionSequence, member.requestedAmount,
    member.executedAmount, member.openingBalanceAmount,
    member.closingBalanceAmount, member.physicalSourceEvidenceId,
  ]])
}

function recordFor(
  staged: Readonly<StagedBeneficiaryTraditionalIraMovementCandidateResult>,
): BeneficiaryTraditionalIraAnnualRuntimeMemberRecord {
  const candidate = staged.candidate
  return {
    actionId: candidate.actionId,
    allocationId: candidate.allocationId,
    sourceAccountId: candidate.sourceAccountId,
    executionDate: candidate.executionDate,
    executionSequence: candidate.executionSequence,
    requestedAmount: candidate.requestedAmount,
    executedAmount: candidate.executedAmount,
    openingBalanceAmount: candidate.openingBalanceAmount,
    closingBalanceAmount: candidate.candidateClosingBalanceAmount,
    physicalSourceEvidenceId: candidate.physicalSourceEvidenceId,
  }
}

function exactStrings(
  left: readonly string[],
  right: readonly string[],
): boolean {
  return left.length === right.length &&
    left.every((value, index) => value === right[index])
}

function registerRole(
  roles: Map<string, string>,
  id: unknown,
  role: string,
  shared = false,
): boolean {
  if (!nonblank(id)) return false
  const existing = roles.get(id)
  if (existing !== undefined && (!shared || existing !== role)) return false
  roles.set(id, role)
  return true
}

/**
 * Binds one complete beneficiary/decedent/year runtime source inventory to a
 * rebuilt annual evidence finalization. It never commits physical movement.
 */
export function coordinateBeneficiaryTraditionalIraAnnualRuntime(
  input: Readonly<CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput>,
): Readonly<CoordinateBeneficiaryTraditionalIraAnnualRuntimeResult> {
  try {
    const raw = plainDataSnapshot(input)
    if (raw === INVALID_SNAPSHOT || !exactKeys(raw, INPUT_KEYS)) {
      return unsupported()
    }
    const snapshot = raw as unknown as
      CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput
    const attestation = snapshot.attestation
    if (
      !exactKeys(attestation, ATTESTATION_KEYS) ||
      attestation.predicate !==
        'completeBeneficiaryTraditionalIraAnnualRuntimeInventory' ||
      attestation.inventoryStatus !== 'completeIncludingExplicitEmpty' ||
      !nonblank(attestation.inventoryEvidenceId) ||
      !nonblank(attestation.upstreamInventoryEvidenceId) ||
      !nonblank(attestation.basisPoolId) ||
      !nonblank(attestation.basisPoolEvidenceId) ||
      !nonblank(attestation.annualAllocationEvidenceId) ||
      !nonblank(attestation.rmdPoolId) ||
      !personIdSchema.safeParse(attestation.beneficiaryPersonId).success ||
      !personIdSchema.safeParse(attestation.decedentPersonId).success ||
      !Number.isSafeInteger(attestation.taxYear) || attestation.taxYear < 1 ||
      attestation.taxYear > 9999 ||
      !usdCentsSchema.safeParse(attestation.rmdRequiredAmount).success ||
      !Array.isArray(attestation.sourceAccountIds) ||
      !Array.isArray(attestation.sourceBalances) ||
      !Array.isArray(attestation.members) || !Array.isArray(snapshot.members) ||
      attestation.sourceAccountIds.length === 0 ||
      attestation.members.length === 0 ||
      attestation.members.length !== snapshot.members.length
    ) return unsupported()

    const sourceAccountIds = [...attestation.sourceAccountIds]
    if (
      sourceAccountIds.some((id) => !accountIdSchema.safeParse(id).success) ||
      new Set(sourceAccountIds).size !== sourceAccountIds.length ||
      sourceAccountIds.some((id, index) =>
        index > 0 && compareUtf16CodeUnits(sourceAccountIds[index - 1]!, id) >= 0,
      )
    ) return unsupported()

    const sourceBalances = new Map<
      AccountId,
      Readonly<BeneficiaryTraditionalIraAnnualRuntimeSourceBalanceRecord>
    >()
    for (const balance of attestation.sourceBalances) {
      if (
        !exactKeys(balance, BALANCE_KEYS) ||
        !sourceAccountIds.includes(balance.sourceAccountId) ||
        !usdCentsSchema.safeParse(balance.annualOpeningBalanceAmount).success ||
        !usdCentsSchema.safeParse(balance.annualFinalBalanceAmount).success ||
        sourceBalances.has(balance.sourceAccountId)
      ) return unsupported()
      sourceBalances.set(balance.sourceAccountId, balance)
    }
    if (sourceBalances.size !== sourceAccountIds.length) return unsupported()

    const declared = [...attestation.members]
    for (const member of declared) {
      const parsedDate = parseCivilIsoDate(member.executionDate)
      if (
        !exactKeys(member, MEMBER_KEYS) ||
        !actionIdSchema.safeParse(member.actionId).success ||
        !allocationIdSchema.safeParse(member.allocationId).success ||
        !sourceAccountIds.includes(member.sourceAccountId) ||
        parsedDate === null || formatCivilDate(parsedDate) !== member.executionDate ||
        Number(member.executionDate.slice(0, 4)) !== attestation.taxYear ||
        !Number.isSafeInteger(member.executionSequence) ||
        member.executionSequence < 1 ||
        !positiveUsdCentsSchema.safeParse(member.requestedAmount).success ||
        !positiveUsdCentsSchema.safeParse(member.executedAmount).success ||
        !usdCentsSchema.safeParse(member.openingBalanceAmount).success ||
        !usdCentsSchema.safeParse(member.closingBalanceAmount).success ||
        member.requestedAmount !== member.executedAmount ||
        member.executedAmount > member.openingBalanceAmount ||
        member.closingBalanceAmount !==
          member.openingBalanceAmount - member.executedAmount ||
        !nonblank(member.physicalSourceEvidenceId)
      ) return unsupported()
    }
    declared.sort(memberCompare)
    const declaredKeys = declared.map(memberKey)
    const actionAllocation = declared.map((member) =>
      `${member.actionId}\u0000${member.allocationId}`,
    )
    const actionSource = declared.map((member) =>
      `${member.actionId}\u0000${member.sourceAccountId}`,
    )
    if (
      new Set(declaredKeys).size !== declared.length ||
      new Set(actionAllocation).size !== declared.length ||
      new Set(actionSource).size !== declared.length ||
      new Set(declared.map((member) => member.physicalSourceEvidenceId)).size !==
        declared.length
    ) return unsupported()
    const scheduleByAction = new Map<string, string>()
    const actionBySchedule = new Map<string, string>()
    for (const member of declared) {
      const schedule = `${member.executionDate}\u0000${member.executionSequence}`
      const priorSchedule = scheduleByAction.get(member.actionId)
      const priorAction = actionBySchedule.get(schedule)
      if (
        (priorSchedule !== undefined && priorSchedule !== schedule) ||
        (priorAction !== undefined && priorAction !== member.actionId)
      ) return unsupported()
      scheduleByAction.set(member.actionId, schedule)
      actionBySchedule.set(schedule, member.actionId)
    }

    const rebuiltPairs = snapshot.members.map((primitive) => ({
      primitive,
      staged: stageBeneficiaryTraditionalIraMovementCandidate(primitive),
    }))
    if (rebuiltPairs.some(({ staged }) =>
      staged.status !== 'movementCandidateStaged',
    )) return unsupported()
    const accepted = rebuiltPairs as readonly Readonly<{
      primitive: StageBeneficiaryTraditionalIraMovementCandidateInput
      staged: StagedBeneficiaryTraditionalIraMovementCandidateResult
    }>[]
    const rebuiltByKey = new Map(accepted.map((pair) => [
      memberKey(recordFor(pair.staged)), pair,
    ]))
    if (rebuiltByKey.size !== accepted.length) return unsupported()
    const canonicalPairs: typeof accepted[number][] = []
    for (const member of declared) {
      const pair = rebuiltByKey.get(memberKey(member))
      if (pair === undefined) return unsupported()
      canonicalPairs.push(pair)
    }

    for (const { primitive, staged } of canonicalPairs) {
      const candidate = staged.candidate
      const source = staged.characterization.acceptedSourceEligibility
      const basis = source.basisEvidence
      const rmd = source.rmdEvidence
      if (
        candidate.beneficiaryPersonId !== attestation.beneficiaryPersonId ||
        candidate.decedentPersonId !== attestation.decedentPersonId ||
        basis.taxYear !== attestation.taxYear || rmd.taxYear !== attestation.taxYear ||
        basis.poolId !== attestation.basisPoolId ||
        primitive.penaltyInput.characterizationInput.basisPoolEvidence
          ?.evidenceId !== attestation.basisPoolEvidenceId ||
        basis.annualDistributionBasisAllocation.allocationEvidenceId !==
          attestation.annualAllocationEvidenceId ||
        rmd.poolId !== attestation.rmdPoolId ||
        rmd.requiredAmount !== attestation.rmdRequiredAmount ||
        !exactStrings(basis.accountIds, sourceAccountIds) ||
        !exactStrings(rmd.accountIds, sourceAccountIds)
      ) return unsupported()
    }

    for (const sourceAccountId of sourceAccountIds) {
      const balance = sourceBalances.get(sourceAccountId)!
      const chain = canonicalPairs
        .map(({ staged }) => staged.candidate)
        .filter((candidate) => candidate.sourceAccountId === sourceAccountId)
      if (chain.length === 0) {
        if (
          balance.annualOpeningBalanceAmount !== balance.annualFinalBalanceAmount
        ) return unsupported()
        continue
      }
      if (
        chain[0]!.openingBalanceAmount !== balance.annualOpeningBalanceAmount ||
        chain.at(-1)!.candidateClosingBalanceAmount !==
          balance.annualFinalBalanceAmount
      ) return unsupported()
      for (let index = 1; index < chain.length; index += 1) {
        if (
          chain[index]!.openingBalanceAmount !==
            chain[index - 1]!.candidateClosingBalanceAmount
        ) return unsupported()
      }
    }

    const manifestMembers: BeneficiaryTraditionalIraAnnualBatchMemberManifest[] =
      canonicalPairs.map(({ staged }) => ({
        actionId: staged.candidate.actionId,
        allocationId: staged.candidate.allocationId,
        sourceAccountId: staged.candidate.sourceAccountId,
        executionDate: staged.candidate.executionDate,
        executionSequence: staged.candidate.executionSequence,
        requestedAmount: staged.candidate.requestedAmount,
        executedAmount: staged.candidate.executedAmount,
        openingBalanceAmount: staged.candidate.openingBalanceAmount,
        closingBalanceAmount: staged.candidate.candidateClosingBalanceAmount,
        movementCandidateId: staged.movementCandidateId,
      }))
    const batchManifestId = deriveActionStructuralId(
      'beneficiary-ira-annual-runtime-batch-manifest',
      [[
        attestation.predicate, attestation.inventoryStatus,
        attestation.inventoryEvidenceId,
        attestation.upstreamInventoryEvidenceId,
        attestation.beneficiaryPersonId, attestation.decedentPersonId,
        attestation.taxYear, attestation.basisPoolId,
        attestation.basisPoolEvidenceId,
        attestation.annualAllocationEvidenceId, attestation.rmdPoolId,
        attestation.rmdRequiredAmount, sourceAccountIds,
        sourceAccountIds.map((id) => {
          const balance = sourceBalances.get(id)!
          return [
            id, balance.annualOpeningBalanceAmount,
            balance.annualFinalBalanceAmount,
          ]
        }),
        declared.map((member) => [
          member.actionId, member.allocationId, member.sourceAccountId,
          member.executionDate, member.executionSequence,
          member.requestedAmount, member.executedAmount,
          member.openingBalanceAmount, member.closingBalanceAmount,
          member.physicalSourceEvidenceId,
        ]),
        canonicalPairs.map(({ staged }) => staged.movementCandidateId),
      ]],
    )
    const manifest: CompleteBeneficiaryTraditionalIraAnnualBatchManifest = {
      predicate:
        'completeBeneficiaryTraditionalIraAnnualBatchForBeneficiaryDecedentAndTaxYear',
      batchManifestId,
      beneficiaryPersonId: attestation.beneficiaryPersonId,
      decedentPersonId: attestation.decedentPersonId,
      taxYear: attestation.taxYear,
      basisPoolId: attestation.basisPoolId,
      basisPoolEvidenceId: attestation.basisPoolEvidenceId,
      annualAllocationEvidenceId: attestation.annualAllocationEvidenceId,
      rmdPoolId: attestation.rmdPoolId,
      rmdRequiredAmount: attestation.rmdRequiredAmount,
      members: manifestMembers,
    }
    const finalized = finalizeBeneficiaryTraditionalIraAnnualEvidence({
      manifest,
      members: canonicalPairs.map(({ primitive }) => primitive),
    })
    if (finalized.status !== 'annualEvidenceFinalized') return unsupported()

    const roles = new Map<string, string>()
    const shared: Array<[unknown, string]> = [
      [attestation.basisPoolId, 'basisPoolId'],
      [attestation.basisPoolEvidenceId, 'basisPoolEvidence'],
      [attestation.annualAllocationEvidenceId, 'annualAllocation'],
      [attestation.rmdPoolId, 'rmdPoolId'],
    ]
    const unique: Array<[unknown, string]> = [
      [attestation.inventoryEvidenceId, 'inventory'],
      [attestation.upstreamInventoryEvidenceId, 'upstreamInventory'],
      [batchManifestId, 'batchManifest'],
    ]
    for (const [id, role] of shared) {
      if (!registerRole(roles, id, role, true)) return unsupported()
    }
    for (const { staged } of canonicalPairs) {
      const source = staged.characterization.acceptedSourceEligibility
      const basis = source.basisEvidence
      const rmd = source.rmdEvidence
      unique.push([source.inheritanceEvidenceId, 'inheritance'])
      for (const [id, role] of [
        [basis.poolId, 'basisPoolId'],
        [attestation.basisPoolEvidenceId, 'basisPoolEvidence'],
        [basis.annualDistributionBasisAllocation.allocationEvidenceId,
          'annualAllocation'],
        [rmd.poolId, 'rmdPoolId'],
      ] as const) {
        if (!registerRole(roles, id, role, true)) return unsupported()
      }
      unique.push(
        [basis.evidenceId, 'basisMember'],
        [rmd.evidenceId, 'rmdMember'],
        [staged.deathPenaltyEvidence.sourceCharacterEvidenceId,
          'sourceCharacter'],
        [staged.deathPenaltyEvidence.penaltyEvidenceId, 'deathPenalty'],
        [staged.candidate.physicalSourceEvidenceId, 'physicalSource'],
        [staged.movementCandidateId, 'movementCandidate'],
        ...staged.deathPenaltyEvidence.characterBindings.map(
          (binding): [unknown, string] =>
            [binding.characterEvidenceId, 'character'],
        ),
      )
    }
    unique.push(
      ...finalized.annualEvidence.finalMemberEvidenceIds.map(
        (id): [unknown, string] => [id, 'finalMember'],
      ),
      [finalized.annualEvidence.finalAnnualEvidenceId, 'finalAnnual'],
    )
    if (unique.some(([id, role]) => !registerRole(roles, id, role))) {
      return unsupported()
    }
    const coordinatorEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-annual-runtime-coordinator',
      [[
        attestation.inventoryEvidenceId,
        attestation.upstreamInventoryEvidenceId,
        attestation.beneficiaryPersonId,
        attestation.decedentPersonId,
        attestation.taxYear,
        batchManifestId,
        finalized.annualEvidence.finalAnnualEvidenceId,
      ]],
    )
    if (!registerRole(roles, coordinatorEvidenceId, 'coordinator')) {
      return unsupported()
    }
    return deepFreeze({
      status: 'annualRuntimeEvidenceCoordinated',
      movement: 'notCommitted',
      committed: false,
      actionability: 'notEstablished',
      reasons: [],
      inventoryBinding: {
        predicate:
          'beneficiaryTraditionalIraAnnualRuntimeInventoryBoundToFinalEvidence',
        inventoryEvidenceId: attestation.inventoryEvidenceId,
        upstreamInventoryEvidenceId: attestation.upstreamInventoryEvidenceId,
        beneficiaryPersonId: attestation.beneficiaryPersonId,
        decedentPersonId: attestation.decedentPersonId,
        taxYear: attestation.taxYear,
        batchManifestId,
        finalAnnualEvidenceId:
          finalized.annualEvidence.finalAnnualEvidenceId,
        coordinatorEvidenceId,
      },
      annualEvidence: finalized.annualEvidence,
    })
  } catch {
    return unsupported()
  }
}
