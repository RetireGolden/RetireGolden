import type {
  EvaluateBeneficiarySpousalElectionResult,
} from './beneficiarySpousalElectionStatus.js'
import type { AnnualIraBasisAllocationEntryInput } from './annualIraBasisAllocation.js'
import {
  finalizeBeneficiaryTraditionalIraAnnualEvidence,
  type CompleteBeneficiaryTraditionalIraAnnualEvidence, type CompleteBeneficiaryTraditionalIraAnnualBatchManifest,
} from './beneficiaryTraditionalIraAnnualFinalization.js'
import {
  prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction,
  type BeneficiaryTraditionalIraAnnualPhysicalTransactionPreparedResult, type BeneficiaryTraditionalIraDetachedPhysicalApplication,
} from './beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  coordinateBeneficiaryTraditionalIraAnnualRuntime,
  type BeneficiaryTraditionalIraAnnualRuntimeCoordinatedResult, type CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput,
} from './beneficiaryTraditionalIraAnnualRuntimeCoordinator.js'
import {
  evaluateBeneficiaryTraditionalIraDeathPenalty, type BeneficiaryTraditionalIraDeathBeneficiaryEvidence, type EvaluateBeneficiaryTraditionalIraDeathPenaltyInput,
} from './beneficiaryTraditionalIraDeathPenalty.js'
import {
  prepareBeneficiaryTraditionalIraResidualRmdActionIdentity,
  type BeneficiaryTraditionalIraNoResidualRmdActionIdentityResult, type BeneficiaryTraditionalIraResidualRmdActionIdentityPreparedResult,
  type PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput,
} from './beneficiaryTraditionalIraResidualRmdActionIdentity.js'
import type { BeneficiaryTraditionalIraResidualRmdDetachedApplication } from
  './beneficiaryTraditionalIraResidualRmdPhysicalTransaction.js'
import {
  stageBeneficiaryTraditionalIraMovementCandidate,
  type BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence, type StageBeneficiaryTraditionalIraMovementCandidateInput,
  type StagedBeneficiaryTraditionalIraMovementCandidateResult,
} from './beneficiaryTraditionalIraMovementCandidate.js'
import type {
  BeneficiaryTraditionalIraInheritanceEvidence, CompleteBeneficiaryTraditionalIraBasisPoolEvidence,
  CompleteBeneficiaryTraditionalIraRmdPoolEvidence,
} from './beneficiaryTraditionalIraWithdrawalCharacter.js'
import type { AccountId, ActionId, AllocationId, PersonId } from './identity.js'
import {
  asUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'
export interface BeneficiaryTraditionalIraResidualInheritanceBinding {
  readonly sourceAccountId: AccountId
  readonly beneficiaryPersonId: PersonId
  readonly decedentPersonId: PersonId
  readonly deathDate: string
  readonly inheritanceEvidenceId: string
}
export interface PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput {
  readonly identityInput: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdActionIdentityInput>
  readonly predecessorRuntimeInput: Readonly<CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput>
  readonly postResidualBasisPoolEvidence: Readonly<CompleteBeneficiaryTraditionalIraBasisPoolEvidence>
  readonly residualInheritanceBindings:
    readonly Readonly<BeneficiaryTraditionalIraResidualInheritanceBinding>[]
  /**
   * Carried forward rather than re-derived. The residual distribution belongs to
   * the same tax year as the pass being refinalized, so it must inherit that
   * year's Treas. Reg. 1.408-8(c) status; deriving it again here would let a
   * later year's deemed election reach back and restate a closed year.
   */
  readonly spousalElection: Readonly<EvaluateBeneficiarySpousalElectionResult>
}
export interface BeneficiaryTraditionalIraResidualRmdRefinalizedLineage {
  readonly predicate: 'beneficiaryTraditionalIraResidualRmdRefinalizedLineage'
  readonly sourceAccountId: AccountId
  readonly actionId: ActionId
  readonly allocationId: AllocationId
  readonly residualApplicationEvidenceId: string
  readonly identityBindingEvidenceId: string
  readonly basisEvidenceId: string
  readonly annualAllocationEvidenceId: string
  readonly characterEvidenceIds: readonly string[]
  readonly sourceCharacterEvidenceId: string
  readonly penaltyEvidenceId: string
  readonly rmdEvidenceId: string
  readonly physicalSourceEvidenceId: string
  readonly movementCandidateId: string
  readonly finalMemberEvidenceId: string
  readonly lineageEvidenceId: string
}
export interface BeneficiaryTraditionalIraResidualRmdAnnualEvidenceRefinalizedResult {
  readonly status: 'residualRmdAnnualEvidenceRefinalized'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly []
  readonly identityEvidence: Readonly<BeneficiaryTraditionalIraResidualRmdActionIdentityPreparedResult>
  readonly predecessorRuntimeEvidence: Readonly<BeneficiaryTraditionalIraAnnualRuntimeCoordinatedResult>
  readonly predecessorPhysicalTransaction: Readonly<BeneficiaryTraditionalIraAnnualPhysicalTransactionPreparedResult>
  readonly postResidualBasisPoolEvidence: Readonly<CompleteBeneficiaryTraditionalIraBasisPoolEvidence>
  readonly annualEvidence: Readonly<CompleteBeneficiaryTraditionalIraAnnualEvidence>
  readonly residualLineage:
    readonly Readonly<BeneficiaryTraditionalIraResidualRmdRefinalizedLineage>[]
  readonly finalRmdRemainingAmount: UsdCents
  readonly refinalizationEvidenceId: string
}
export interface BeneficiaryTraditionalIraNoResidualRmdAnnualRefinalizationResult {
  readonly status: 'noResidualRmdAnnualRefinalization'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly []
  readonly identityEvidence: Readonly<BeneficiaryTraditionalIraNoResidualRmdActionIdentityResult>
  readonly predecessorRuntimeEvidence: null
  readonly predecessorPhysicalTransaction: null
  readonly postResidualBasisPoolEvidence: null
  readonly annualEvidence: null
  readonly residualLineage: readonly []
  readonly finalRmdRemainingAmount: null
  readonly refinalizationEvidenceId: null
}
export interface UnsupportedBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationResult {
  readonly status: 'unsupported'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly reasons: readonly [Readonly<ActionReason>]
  readonly identityEvidence: null
  readonly predecessorRuntimeEvidence: null
  readonly predecessorPhysicalTransaction: null
  readonly postResidualBasisPoolEvidence: null
  readonly annualEvidence: null
  readonly residualLineage: readonly []
  readonly finalRmdRemainingAmount: null
  readonly refinalizationEvidenceId: null
}
export type PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationResult =
  | BeneficiaryTraditionalIraResidualRmdAnnualEvidenceRefinalizedResult
  | BeneficiaryTraditionalIraNoResidualRmdAnnualRefinalizationResult
  | UnsupportedBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationResult
const INPUT_KEYS = ['identityInput', 'predecessorRuntimeInput',
  'postResidualBasisPoolEvidence', 'residualInheritanceBindings',
  'spousalElection'] as const
const BINDING_KEYS = ['sourceAccountId', 'beneficiaryPersonId',
  'decedentPersonId', 'deathDate', 'inheritanceEvidenceId'] as const
const BASIS_KEYS = [
  'predicate', 'beneficiaryPersonId', 'inheritedFromPersonId', 'poolId',
  'taxYear', 'accountIds', 'openingInheritedBasisAmount',
  'yearEndApplicablePoolBalanceAmount', 'form8606Line7DistributionAmount',
  'form8606Line8NetConversionAmount', 'evidenceId',
] as const
const INVALID = Symbol('invalid')
function snapshot(value: unknown, ancestors = new Set<object>()): unknown | typeof INVALID {
  if (value === null || ['string', 'number', 'boolean'].includes(typeof value)) return value
  if (typeof value !== 'object' || ancestors.has(value)) return INVALID
  try {
    const array = Array.isArray(value)
    const prototype = Object.getPrototypeOf(value)
    if ((array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)) return INVALID
    const keys = Reflect.ownKeys(value)
    if (keys.some((key) => typeof key !== 'string')) return INVALID
    if (array) {
      const length = Object.getOwnPropertyDescriptor(value, 'length')
      const size = length?.value
      if (length === undefined || length.enumerable ||
        !Object.hasOwn(length, 'value') || typeof size !== 'number' ||
        !Number.isSafeInteger(size) || size < 0 || keys.length !== size + 1 ||
        !keys.includes('length') || Array.from({ length: size }, (_, index) =>
          String(index)).some((key) => !keys.includes(key))) return INVALID
    }
    const copy: unknown[] | Record<string, unknown> = array ? [] : Object.create(null)
    ancestors.add(value)
    for (const key of keys) {
      if (array && key === 'length') continue
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (descriptor === undefined || !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')) return INVALID
      const child = snapshot(descriptor.value, ancestors)
      if (child === INVALID) return INVALID
      if (array) (copy as unknown[])[Number(key)] = child
      else (copy as Record<string, unknown>)[key as string] = child
    }
    return copy
  } catch {
    return INVALID
  } finally {
    ancestors.delete(value)
  }
}
function exact(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  return value !== null && !Array.isArray(value) && typeof value === 'object' &&
    Object.keys(value).length === keys.length &&
    keys.every((key) => Object.hasOwn(value, key))
}
function nonblank(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}
function freeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) freeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}
function unsupported(): Readonly<UnsupportedBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationResult> {
  return freeze({
    status: 'unsupported', movement: 'notCommitted', committed: false,
    actionability: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    identityEvidence: null, predecessorRuntimeEvidence: null,
    predecessorPhysicalTransaction: null, postResidualBasisPoolEvidence: null,
    annualEvidence: null, residualLineage: [], finalRmdRemainingAmount: null,
    refinalizationEvidenceId: null,
  })
}
function digest(value: unknown): string {
  return deriveActionStructuralId('beneficiary-ira-residual-rmd-exact-rejoin', [value])
}
function same(left: unknown, right: unknown): boolean {
  return digest(left) === digest(right)
}
const sameSet = (left: readonly string[], right: readonly string[]) => same([...left].sort(compareUtf16CodeUnits), [...right].sort(compareUtf16CodeUnits))
function safeSum(values: readonly number[]): UsdCents | null {
  const total = values.reduce((sum, value) => sum + BigInt(value), 0n)
  return total < 0n || total > BigInt(Number.MAX_SAFE_INTEGER)
    ? null
    : asUsdCents(Number(total))
}
function ids(value: unknown, key = '', result = new Set<string>()): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object') return result
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const id of child) if (typeof id === 'string') result.add(id)
    }
    ids(child, childKey, result)
  }
  return result
}
function compareMember(
  left: Readonly<MemberSeed>,
  right: Readonly<MemberSeed>,
): number {
  return compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId)
}
interface MemberSeed {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  beneficiaryPersonId: PersonId
  decedentPersonId: PersonId
  executionDate: string
  executionSequence: number
  executedAmount: PositiveUsdCents
  openingBalanceAmount: UsdCents
  closingBalanceAmount: UsdCents
  inheritanceEvidence: Readonly<BeneficiaryTraditionalIraInheritanceEvidence>
  deathEvidence: Readonly<BeneficiaryTraditionalIraDeathBeneficiaryEvidence>
  residualApplication: Readonly<BeneficiaryTraditionalIraResidualRmdDetachedApplication> | null
  identityBindingEvidenceId: string | null
}
function oldSeed(
  application: Readonly<BeneficiaryTraditionalIraDetachedPhysicalApplication>,
  input: Readonly<CoordinateBeneficiaryTraditionalIraAnnualRuntimeInput>,
): MemberSeed | null {
  const matches = input.members.filter((member) => {
    const character = member.penaltyInput.characterizationInput
    return character.actionId === application.actionId &&
      character.allocationId === application.allocationId &&
      character.sourceAccountId === application.sourceAccountId &&
      member.sourceSnapshots?.[0]?.physicalSourceEvidenceId ===
        application.physicalSourceEvidenceId
  })
  const primitive = matches[0]
  const inheritance = primitive?.penaltyInput.characterizationInput.inheritanceEvidence
  const death = primitive?.penaltyInput.deathBeneficiaryEvidence
  if (matches.length !== 1 || inheritance === null || inheritance === undefined ||
    death === null || death === undefined) return null
  return {
    actionId: application.actionId, allocationId: application.allocationId,
    sourceAccountId: application.sourceAccountId,
    beneficiaryPersonId: application.beneficiaryPersonId,
    decedentPersonId: application.decedentPersonId,
    executionDate: application.executionDate,
    executionSequence: application.executionSequence,
    executedAmount: application.executedAmount,
    openingBalanceAmount: application.sourceBalanceBefore,
    closingBalanceAmount: application.sourceBalanceAfter,
    inheritanceEvidence: inheritance, deathEvidence: death,
    residualApplication: null, identityBindingEvidenceId: null,
  }
}
function residualSeeds(
  identity: Readonly<BeneficiaryTraditionalIraResidualRmdActionIdentityPreparedResult>,
  bindings: readonly Readonly<BeneficiaryTraditionalIraResidualInheritanceBinding>[],
): MemberSeed[] | null {
  const request = identity.request
  const bySource = new Map(bindings.map((binding) =>
    [binding.sourceAccountId, binding] as const))
  if (bySource.size !== bindings.length ||
    bindings.some((binding) => !exact(binding, BINDING_KEYS))) return null
  const result: MemberSeed[] = []
  for (const application of identity.physicalTransaction.residualApplications) {
    const allocation = request.allocations.find((entry) =>
      entry.sourceAccountId === application.sourceAccountId)
    const identityBinding = identity.applicationBindings.find((entry) =>
      entry.sourceAccountId === application.sourceAccountId)
    const binding = bySource.get(application.sourceAccountId)
    if (allocation === undefined || identityBinding === undefined || binding === undefined ||
      binding.beneficiaryPersonId !== application.beneficiaryPersonId ||
      binding.decedentPersonId !== application.decedentPersonId ||
      allocation.requestedAmount !== application.executedAmount ||
      !nonblank(binding.inheritanceEvidenceId)) return null
    const inheritanceEvidence = {
      predicate: 'beneficiaryTraditionalIraInheritance' as const,
      actionId: request.actionId, allocationId: allocation.allocationId,
      sourceAccountId: application.sourceAccountId,
      beneficiaryPersonId: application.beneficiaryPersonId,
      decedentPersonId: application.decedentPersonId,
      evaluationDate: application.executionDate,
      accountType: 'traditional' as const, accountKind: 'ira' as const,
      ownershipKind: 'beneficiary' as const, deathDate: binding.deathDate,
      inheritanceEvidenceId: binding.inheritanceEvidenceId,
    }
    result.push({
      actionId: request.actionId, allocationId: allocation.allocationId,
      sourceAccountId: application.sourceAccountId,
      beneficiaryPersonId: application.beneficiaryPersonId,
      decedentPersonId: application.decedentPersonId,
      executionDate: application.executionDate,
      executionSequence: application.executionSequence,
      executedAmount: allocation.requestedAmount,
      openingBalanceAmount: application.sourceBalanceBefore,
      closingBalanceAmount: application.sourceBalanceAfter,
      inheritanceEvidence,
      deathEvidence: {
        predicate: 'beneficiaryTraditionalIraDeathBeneficiary',
        actionId: request.actionId, allocationId: allocation.allocationId,
        sourceAccountId: application.sourceAccountId,
        beneficiaryPersonId: application.beneficiaryPersonId,
        decedentPersonId: application.decedentPersonId,
        evaluationDate: application.executionDate,
        deathDate: binding.deathDate,
        inheritanceEvidenceId: binding.inheritanceEvidenceId,
      },
      residualApplication: application,
      identityBindingEvidenceId: identityBinding.bindingEvidenceId,
    })
  }
  return result.length === bindings.length ? result : null
}
function line7Entry(seed: Readonly<MemberSeed>): AnnualIraBasisAllocationEntryInput {
  return {
    actionId: seed.actionId, allocationId: seed.allocationId,
    sourceAccountId: seed.sourceAccountId, scheduledDate: seed.executionDate,
    scheduledSequence: seed.executionSequence, grossAmount: seed.executedAmount,
  }
}
function claim(
  reserved: Set<string>,
  generated: Map<string, string>,
  id: string,
  role: string,
  shared = false,
): boolean {
  if (!nonblank(id) || reserved.has(id)) return false
  const prior = generated.get(id)
  if (prior !== undefined) return shared && prior === role
  generated.set(id, role)
  return true
}
function prepare(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationResult> {
  const raw = snapshot(input)
  if (!exact(raw, INPUT_KEYS) || !Array.isArray(raw.residualInheritanceBindings)) {
    return unsupported()
  }
  const value = raw as unknown as
    PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput
  const identity = prepareBeneficiaryTraditionalIraResidualRmdActionIdentity(
    value.identityInput,
  )
  if (identity.status === 'unsupported') return unsupported()
  if (identity.status === 'noResidualRmdActionIdentity') {
    return freeze({
      status: 'noResidualRmdAnnualRefinalization', movement: 'notCommitted',
      committed: false, actionability: 'notEstablished', reasons: [],
      identityEvidence: identity, predecessorRuntimeEvidence: null,
      predecessorPhysicalTransaction: null, postResidualBasisPoolEvidence: null,
      annualEvidence: null, residualLineage: [], finalRmdRemainingAmount: null,
      refinalizationEvidenceId: null,
    })
  }
  const predecessorRuntime = coordinateBeneficiaryTraditionalIraAnnualRuntime(
    value.predecessorRuntimeInput,
  )
  const predecessorPhysical =
    prepareBeneficiaryTraditionalIraAnnualPhysicalTransaction({
      runtimeInput: value.predecessorRuntimeInput,
    })
  if (predecessorRuntime.status !== 'annualRuntimeEvidenceCoordinated' ||
    predecessorPhysical.status !== 'annualPhysicalTransactionPrepared' ||
    !same(predecessorPhysical.runtimeEvidence, predecessorRuntime)) return unsupported()
  const residualInput = value.identityInput.physicalTransactionInput.movementInput
  const schedule = residualInput.scheduleEvidence
  if (schedule === null ||
    !same(residualInput.allocationInput.rmdTransition,
      predecessorPhysical.rmdTransition) ||
    !same([...residualInput.allocationInput.sourceBalanceTransitions].sort((a, b) =>
      compareUtf16CodeUnits(a.transitionEvidenceId, b.transitionEvidenceId)), [...predecessorPhysical.sourceBalanceTransitions].sort((a, b) =>
      compareUtf16CodeUnits(a.transitionEvidenceId, b.transitionEvidenceId))) ||
    !same([...schedule.predecessorApplications].sort((a, b) =>
      compareUtf16CodeUnits(a.applicationEvidenceId, b.applicationEvidenceId)), [...predecessorPhysical.applications].sort((a, b) =>
      compareUtf16CodeUnits(a.applicationEvidenceId, b.applicationEvidenceId)))) {
    return unsupported()
  }
  const oldAnnual = predecessorRuntime.annualEvidence
  const firstOld = oldAnnual.canonicalMembers[0]
  const firstPrimitive = value.predecessorRuntimeInput.members[0]
  const oldPool = firstPrimitive?.penaltyInput.characterizationInput.basisPoolEvidence
  const oldBasis = firstOld?.characterization.acceptedSourceEligibility.basisEvidence
  const postPool = { ...value.postResidualBasisPoolEvidence, accountIds: [...value.postResidualBasisPoolEvidence.accountIds].sort(compareUtf16CodeUnits) } as unknown as CompleteBeneficiaryTraditionalIraBasisPoolEvidence
  const residualAmount = identity.physicalTransaction.residualRmdExecutedAmount
  const newLine7 = oldPool === null || oldPool === undefined ? null : safeSum([
    oldPool.form8606Line7DistributionAmount, residualAmount,
  ])
  if (oldPool === null || oldPool === undefined || oldBasis === undefined ||
    newLine7 === null || !usdCentsSchema.safeParse(residualAmount).success ||
    !exact(postPool, BASIS_KEYS) ||
    !sameSet(oldPool.accountIds, oldBasis.accountIds) ||
    postPool.predicate !== oldPool.predicate ||
    postPool.beneficiaryPersonId !== oldPool.beneficiaryPersonId ||
    postPool.inheritedFromPersonId !== oldPool.inheritedFromPersonId ||
    postPool.poolId !== oldPool.poolId || postPool.taxYear !== oldPool.taxYear ||
    !sameSet(postPool.accountIds, oldPool.accountIds) ||
    postPool.openingInheritedBasisAmount !== oldPool.openingInheritedBasisAmount ||
    postPool.form8606Line8NetConversionAmount !== 0 ||
    postPool.form8606Line7DistributionAmount !== newLine7 ||
    BigInt(postPool.yearEndApplicablePoolBalanceAmount) + BigInt(residualAmount) !==
      BigInt(oldPool.yearEndApplicablePoolBalanceAmount) ||
    !nonblank(postPool.evidenceId) || postPool.evidenceId === oldPool.evidenceId) {
    return unsupported()
  }
  const oldSeeds = predecessorPhysical.applications.map((application) =>
    oldSeed(application, value.predecessorRuntimeInput))
  const newSeeds = residualSeeds(identity, value.residualInheritanceBindings)
  if (oldSeeds.some((seed) => seed === null) || newSeeds === null) return unsupported()
  const seeds = [
    ...(oldSeeds as MemberSeed[]), ...newSeeds,
  ].sort(compareMember)
  const line7 = seeds.map(line7Entry)
  const line7Total = safeSum(line7.map((entry) => entry.grossAmount))
  if (line7Total !== postPool.form8606Line7DistributionAmount) return unsupported()
  const oldAllocationEntries = oldBasis.annualDistributionBasisAllocation.allocations
    .map((entry) => ({
      actionId: entry.actionId, allocationId: entry.allocationId,
      sourceAccountId: entry.sourceAccountId, scheduledDate: entry.scheduledDate,
      scheduledSequence: entry.scheduledSequence, grossAmount: entry.grossAmount,
    }))
  if (!same(oldAllocationEntries,
    (oldSeeds as MemberSeed[]).sort(compareMember).map(line7Entry))) return unsupported()
  const reserved = ids(raw), generated = new Map<string, string>()
  const identityIds = [
    identity.request.actionId,
    ...identity.request.allocations.map((entry) => entry.allocationId),
    ...identity.applicationBindings.map((entry) => entry.bindingEvidenceId),
    identity.identityEvidenceId,
  ]
  for (const id of identityIds) {
    if (reserved.has(id)) return unsupported()
  }
  identityIds.forEach((id) => reserved.add(id))
  if (ids(value.predecessorRuntimeInput).has(postPool.evidenceId) ||
    ids(identity).has(postPool.evidenceId)) return unsupported()
  let satisfied = oldAnnual.initialRmdSatisfiedAmount
  const stagedMembers: StagedBeneficiaryTraditionalIraMovementCandidateResult[] = []
  const primitives: StageBeneficiaryTraditionalIraMovementCandidateInput[] = []
  for (const seed of seeds) {
    const remaining = asUsdCents(Math.max(0,
      oldAnnual.rmdRequiredAmount - satisfied))
    const rmdWithoutId = {
      predicate:
        'completeBeneficiaryTraditionalIraRmdPoolForBeneficiaryDecedentAndTaxYear' as const,
      actionId: seed.actionId, allocationId: seed.allocationId,
      sourceAccountId: seed.sourceAccountId,
      evaluationDate: seed.executionDate,
      beneficiaryPersonId: seed.beneficiaryPersonId,
      inheritedFromPersonId: seed.decedentPersonId,
      poolId: oldAnnual.rmdPoolId, taxYear: oldAnnual.taxYear,
      accountIds: postPool.accountIds,
      requiredAmount: oldAnnual.rmdRequiredAmount,
      satisfiedBeforeExecution: satisfied,
      remainingBeforeExecution: remaining,
    }
    const rmdEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-post-residual-rmd-member', [rmdWithoutId],
    )
    const physicalWithoutId = {
      predicate: 'beneficiaryTraditionalIraPhysicalSourceBeforeWithdrawal' as const,
      actionId: seed.actionId, allocationId: seed.allocationId,
      sourceAccountId: seed.sourceAccountId,
      beneficiaryPersonId: seed.beneficiaryPersonId,
      decedentPersonId: seed.decedentPersonId,
      evaluationDate: seed.executionDate,
      executionSequence: seed.executionSequence,
      requestedAmount: seed.executedAmount, executedAmount: seed.executedAmount,
      openingBalanceAmount: seed.openingBalanceAmount,
      closingBalanceAmount: seed.closingBalanceAmount,
      inheritanceEvidenceId: seed.inheritanceEvidence.inheritanceEvidenceId,
      rmdPoolId: oldAnnual.rmdPoolId, rmdEvidenceId,
      rmdRequiredAmount: oldAnnual.rmdRequiredAmount,
      rmdSatisfiedBeforeExecution: satisfied,
      rmdRemainingBeforeExecution: remaining,
    }
    if (!claim(reserved, generated, rmdEvidenceId, 'newRmdMember')) return unsupported()
    const characterizationInput = {
      actionId: seed.actionId, allocationId: seed.allocationId,
      sourceAccountId: seed.sourceAccountId,
      beneficiaryPersonId: seed.beneficiaryPersonId,
      decedentPersonId: seed.decedentPersonId,
      evaluationDate: seed.executionDate, taxYear: oldAnnual.taxYear,
      executedAmount: seed.executedAmount,
      inheritanceEvidence: seed.inheritanceEvidence,
      basisPoolEvidence: postPool, line7Distributions: line7,
      rmdPoolEvidence: { ...rmdWithoutId, evidenceId: rmdEvidenceId } as
        CompleteBeneficiaryTraditionalIraRmdPoolEvidence,
    }
    const penaltyInput: EvaluateBeneficiaryTraditionalIraDeathPenaltyInput = {
      characterizationInput, deathBeneficiaryEvidence: seed.deathEvidence,
      spousalElection: input.spousalElection,
    }
    const accepted = stageInput(
      penaltyInput, physicalWithoutId, reserved, generated,
    )
    if (accepted === null) return unsupported()
    primitives.push(accepted.primitive)
    stagedMembers.push(accepted.staged)
    const increment = Math.min(seed.executedAmount, remaining)
    const next = safeSum([satisfied, increment])
    if (next === null) return unsupported()
    satisfied = next
  }
  const firstNewBasis = stagedMembers[0]!.characterization
    .acceptedSourceEligibility.basisEvidence
  if (firstNewBasis.annualBasisDenominatorAmount !==
      oldBasis.annualBasisDenominatorAmount ||
    !same(firstNewBasis.annualBasisRatio, oldBasis.annualBasisRatio) ||
    firstNewBasis.poolId !== oldBasis.poolId ||
    firstNewBasis.taxYear !== oldBasis.taxYear ||
    !sameSet(firstNewBasis.accountIds, oldBasis.accountIds) ||
    firstNewBasis.openingInheritedBasisAmount !==
      oldBasis.openingInheritedBasisAmount) return unsupported()
  const manifestMembers = stagedMembers.map((member) => ({
    actionId: member.candidate.actionId,
    allocationId: member.candidate.allocationId,
    sourceAccountId: member.candidate.sourceAccountId,
    executionDate: member.candidate.executionDate,
    executionSequence: member.candidate.executionSequence,
    requestedAmount: member.candidate.requestedAmount,
    executedAmount: member.candidate.executedAmount,
    openingBalanceAmount: member.candidate.openingBalanceAmount,
    closingBalanceAmount: member.candidate.candidateClosingBalanceAmount,
    movementCandidateId: member.movementCandidateId,
  }))
  const batchManifestId = deriveActionStructuralId(
    'beneficiary-ira-post-residual-rmd-annual-batch', [[
      oldAnnual.finalAnnualEvidenceId, identity.identityEvidenceId,
      postPool.evidenceId, manifestMembers,
    ]],
  )
  if (!claim(reserved, generated, batchManifestId, 'newBatchManifest')) {
    return unsupported()
  }
  const manifest: CompleteBeneficiaryTraditionalIraAnnualBatchManifest = {
    predicate:
      'completeBeneficiaryTraditionalIraAnnualBatchForBeneficiaryDecedentAndTaxYear',
    batchManifestId, beneficiaryPersonId: oldAnnual.beneficiaryPersonId,
    decedentPersonId: oldAnnual.decedentPersonId, taxYear: oldAnnual.taxYear,
    basisPoolId: postPool.poolId, basisPoolEvidenceId: postPool.evidenceId,
    annualAllocationEvidenceId:
      firstNewBasis.annualDistributionBasisAllocation.allocationEvidenceId,
    rmdPoolId: oldAnnual.rmdPoolId,
    rmdRequiredAmount: oldAnnual.rmdRequiredAmount, members: manifestMembers,
  }
  const finalized = finalizeBeneficiaryTraditionalIraAnnualEvidence({
    manifest, members: primitives,
  })
  if (finalized.status !== 'annualEvidenceFinalized' ||
    finalized.annualEvidence.finalRmdRemainingAmount !==
      identity.physicalTransaction.rmdTransition.finalRmdRemainingAmount ||
    finalized.annualEvidence.finalRmdRemainingAmount !==
      identity.physicalTransaction.residualRmdUnallocatedAmount) return unsupported()
  for (const id of [
    ...finalized.annualEvidence.finalMemberEvidenceIds,
    finalized.annualEvidence.finalAnnualEvidenceId,
  ]) {
    if (!claim(reserved, generated, id, 'newFinalEvidence')) return unsupported()
  }
  const finalByIdentity = new Map(finalized.annualEvidence.canonicalMembers.map(
    (member) => [`${member.candidate.actionId}\0${member.candidate.allocationId}`, member],
  ))
  const residualLineage: BeneficiaryTraditionalIraResidualRmdRefinalizedLineage[] = []
  for (const seed of newSeeds) {
    const member = finalByIdentity.get(`${seed.actionId}\0${seed.allocationId}`)
    const application = seed.residualApplication
    if (member === undefined || application === null ||
      seed.identityBindingEvidenceId === null) return unsupported()
    const basis = member.characterization.acceptedSourceEligibility.basisEvidence
    const withoutId = {
      predicate: 'beneficiaryTraditionalIraResidualRmdRefinalizedLineage' as const,
      sourceAccountId: seed.sourceAccountId, actionId: seed.actionId,
      allocationId: seed.allocationId,
      residualApplicationEvidenceId: application.applicationEvidenceId,
      identityBindingEvidenceId: seed.identityBindingEvidenceId,
      basisEvidenceId: basis.evidenceId,
      annualAllocationEvidenceId:
        basis.annualDistributionBasisAllocation.allocationEvidenceId,
      characterEvidenceIds: member.deathPenaltyEvidence.characterBindings.map(
        (binding) => binding.characterEvidenceId),
      sourceCharacterEvidenceId:
        member.deathPenaltyEvidence.sourceCharacterEvidenceId,
      penaltyEvidenceId: member.deathPenaltyEvidence.penaltyEvidenceId, rmdEvidenceId: member.candidate.rmdEvidenceId,
      physicalSourceEvidenceId: member.candidate.physicalSourceEvidenceId,
      movementCandidateId: member.movementCandidateId,
      finalMemberEvidenceId: member.finalMemberEvidenceId,
    }
    const lineageEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-residual-rmd-refinalized-lineage', [withoutId],
    )
    if (!claim(reserved, generated, lineageEvidenceId, 'residualLineage')) {
      return unsupported()
    }
    residualLineage.push({ ...withoutId, lineageEvidenceId })
  }
  residualLineage.sort((left, right) =>
    compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId))
  const refinalizationEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-residual-rmd-annual-refinalization', [[
      predecessorRuntime.inventoryBinding.coordinatorEvidenceId,
      predecessorPhysical.transactionEvidenceId, identity.identityEvidenceId,
      postPool.evidenceId, finalized.annualEvidence.finalAnnualEvidenceId,
      residualLineage.map((lineage) => lineage.lineageEvidenceId),
    ]],
  )
  if (!claim(reserved, generated, refinalizationEvidenceId, 'refinalization')) {
    return unsupported()
  }
  return freeze({
    status: 'residualRmdAnnualEvidenceRefinalized', movement: 'notCommitted',
    committed: false, actionability: 'notEstablished', reasons: [],
    identityEvidence: identity, predecessorRuntimeEvidence: predecessorRuntime,
    predecessorPhysicalTransaction: predecessorPhysical,
    postResidualBasisPoolEvidence: postPool,
    annualEvidence: finalized.annualEvidence, residualLineage,
    finalRmdRemainingAmount: finalized.annualEvidence.finalRmdRemainingAmount,
    refinalizationEvidenceId,
  })
}
function stageInput(
  penaltyInput: Readonly<EvaluateBeneficiaryTraditionalIraDeathPenaltyInput>,
  physicalWithoutIds: Omit<BeneficiaryTraditionalIraPhysicalSourceSnapshotEvidence,
    'basisEvidenceId' | 'sourceCharacterEvidenceId' | 'penaltyEvidenceId' |
    'physicalSourceEvidenceId'>,
  reserved: Set<string>,
  generated: Map<string, string>,
): { primitive: StageBeneficiaryTraditionalIraMovementCandidateInput
  staged: StagedBeneficiaryTraditionalIraMovementCandidateResult } | null {
  const penalty = evaluateBeneficiaryTraditionalIraDeathPenalty(penaltyInput)
  if (penalty.status !== 'accepted') return null
  const basis = penalty.characterization.acceptedSourceEligibility.basisEvidence
  const physicalBase = {
    ...physicalWithoutIds,
    basisEvidenceId: basis.evidenceId,
    sourceCharacterEvidenceId: penalty.penaltyEvidence.sourceCharacterEvidenceId,
    penaltyEvidenceId: penalty.penaltyEvidence.penaltyEvidenceId,
  }
  const physicalSourceEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-post-residual-physical-source', [physicalBase],
  )
  const generatedIds: Array<readonly [string, string, boolean?]> = [
    [basis.annualDistributionBasisAllocation.allocationEvidenceId, 'annualAllocation', true],
    [basis.evidenceId, 'newBasisMember'],
    ...penalty.penaltyEvidence.characterBindings.map((binding) =>
      [binding.characterEvidenceId, 'newCharacter'] as const),
    [penalty.penaltyEvidence.sourceCharacterEvidenceId, 'newSourceCharacter'],
    [penalty.penaltyEvidence.penaltyEvidenceId, 'newPenalty'],
    [physicalSourceEvidenceId, 'newPhysicalSource'],
  ]
  if (generatedIds.some(([id, role, shared]) =>
    !claim(reserved, generated, id, role, shared))) return null
  const primitive = {
    penaltyInput,
    sourceSnapshots: [{ ...physicalBase, physicalSourceEvidenceId }],
  }
  const staged = stageBeneficiaryTraditionalIraMovementCandidate(primitive)
  if (staged.status !== 'movementCandidateStaged' ||
    !claim(reserved, generated, staged.movementCandidateId,
      'newMovementCandidate')) return null
  return { primitive, staged }
}
/** Rebuilds and refinalizes one complete annual beneficiary-IRA evidence set. */
export function prepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalization(
  input: Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationInput>,
): Readonly<PrepareBeneficiaryTraditionalIraResidualRmdAnnualRefinalizationResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
