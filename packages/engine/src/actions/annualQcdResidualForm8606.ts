import {
  allocateAnnualIraBasis,
  type AnnualIraBasisAllocationEntry,
  type AnnualIraBasisAllocationEntryInput,
  type AnnualIraBasisAllocationEvidence,
  type AnnualIraBasisRatio,
} from './annualIraBasisAllocation.js'
import {
  stageAnnualQcdTaxCharacterPostPass,
  type AnnualQcdTaxCharacterPostPassStaged,
  type StageAnnualQcdTaxCharacterPostPassInput,
} from './annualQcdTaxCharacterPostPass.js'
import type { PersonId } from './identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  type UsdCents,
} from './money.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

export interface AnnualQcdResidualRemainderBinding {
  readonly postPassApplicationEvidenceId: string
  readonly line7AllocationEvidenceId: string
  readonly allocation: Readonly<AnnualIraBasisAllocationEntry>
  readonly bindingEvidenceId: string
}

export interface AnnualQcdResidualForm8606PoolEvidence {
  readonly predicate: 'annualQcdResidualForm8606Pool'
  readonly ownerPersonId: PersonId
  readonly ownerWideNonRothIraPoolId: string
  readonly taxYear: number
  readonly postPassTransitionEvidenceId: string
  readonly adjustedResidualBasisDenominatorAmount: UsdCents
  readonly adjustedResidualBasisNumeratorAmount: UsdCents
  readonly annualBasisRatio: Readonly<AnnualIraBasisRatio>
  readonly line7AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly line8AllocationEvidence: Readonly<AnnualIraBasisAllocationEvidence>
  readonly qcdRemainderBindings:
    readonly Readonly<AnnualQcdResidualRemainderBinding>[]
  readonly evidenceId: string
}

export interface AnnualQcdResidualForm8606Issue {
  readonly kind:
    | 'hostileInput'
    | 'postPassInvalid'
    | 'residualPoolInvalid'
    | 'residualAllocationInvalid'
  readonly detail: string
}

interface ResidualBase {
  readonly committed: false
  readonly movement: 'notCommitted'
  readonly taxCharacterStatus: 'awaitingSection170Reconciliation'
}

export interface AnnualQcdResidualForm8606Staged extends ResidualBase {
  readonly status: 'annualQcdResidualForm8606Staged'
  readonly taxYear: number
  readonly postPass: Readonly<AnnualQcdTaxCharacterPostPassStaged>
  readonly pools: readonly Readonly<AnnualQcdResidualForm8606PoolEvidence>[]
  readonly evidenceId: string
  readonly issues: readonly []
}

export interface AnnualQcdResidualForm8606Blocked extends ResidualBase {
  readonly status: 'annualQcdResidualForm8606Blocked'
  readonly taxYear: null
  readonly postPass: null
  readonly pools: readonly []
  readonly evidenceId: null
  readonly issues: readonly [Readonly<AnnualQcdResidualForm8606Issue>]
}

export type StageAnnualQcdResidualForm8606Result =
  | AnnualQcdResidualForm8606Staged
  | AnnualQcdResidualForm8606Blocked

export interface StageAnnualQcdResidualForm8606Input {
  readonly postPassInput: Readonly<StageAnnualQcdTaxCharacterPostPassInput>
}

class ResidualError extends Error {
  readonly kind: AnnualQcdResidualForm8606Issue['kind']
  constructor(
    kind: AnnualQcdResidualForm8606Issue['kind'],
    detail: string,
  ) {
    super(detail)
    this.kind = kind
  }
}

function fail(
  kind: AnnualQcdResidualForm8606Issue['kind'],
  detail: string,
): never { throw new ResidualError(kind, detail) }

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function cents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail('hostileInput', `${label} exceeded the exact-cent range.`)
  }
  return asUsdCents(Number(value))
}

function total(
  values: readonly UsdCents[],
  label: string,
): UsdCents {
  return cents(values.reduce((sum, value) => sum + BigInt(value), 0n), label)
}

function ratio(numerator: UsdCents, denominator: UsdCents): AnnualIraBasisRatio {
  if (denominator === 0) return {
    representation: 'notApplicableZeroDenominator',
    numeratorMinorUnits: 0,
    denominatorMinorUnits: 0,
    intermediateArithmetic: 'notApplicable',
  }
  return {
    representation: 'exactMinorUnitRational',
    numeratorMinorUnits: asUsdCents(Math.min(numerator, denominator)),
    denominatorMinorUnits: asPositiveUsdCents(denominator),
    intermediateArithmetic: 'bigintRational',
  }
}

function allocate(
  poolId: string,
  taxYear: number,
  calculationScope: 'form8606Line7Distributions' | 'form8606Line8NetConversions',
  annualBasisRatio: Readonly<AnnualIraBasisRatio>,
  entries: readonly Readonly<AnnualIraBasisAllocationEntryInput>[],
): Readonly<AnnualIraBasisAllocationEvidence> {
  try {
    return allocateAnnualIraBasis({
      poolId, taxYear, calculationScope, annualBasisRatio,
      annualGrossAmount: total(entries.map((entry) => entry.grossAmount), calculationScope),
      entries,
    })
  } catch {
    fail('residualAllocationInvalid', 'Residual Form 8606 allocation failed canonical rebuilding.')
  }
}

function buildPool(
  input: Readonly<StageAnnualQcdTaxCharacterPostPassInput>,
  postPass: Readonly<AnnualQcdTaxCharacterPostPassStaged>,
  transition: Readonly<AnnualQcdTaxCharacterPostPassStaged['pools'][number]>,
): Readonly<AnnualQcdResidualForm8606PoolEvidence> {
  const base = transition.baseForm8606Facts
  const source = input.poolCapacityInputs.find((entry) =>
    entry.ownerPersonId === base.ownerPersonId)
  if (source === undefined || source.ownerWideNonRothIraPoolId !== base.ownerWideNonRothIraPoolId) {
    fail('residualPoolInvalid', 'Residual pool must resolve exactly one canonical capacity input.')
  }
  const applications = postPass.applications.filter((entry) =>
    entry.capacityEvidenceId === base.capacityEvidenceId)
  const requests = input.physicalInput.prerequisite.requests
  const qcdEntries: AnnualIraBasisAllocationEntryInput[] = applications
    .filter((entry) => entry.nonQcdCharitableRemainder > 0)
    .map((entry) => {
      const request = requests.find((candidate) => candidate.actionId === entry.actionId)
      if (request === undefined || request.allocation.allocationId !== entry.allocationId ||
          request.allocation.sourceAccountId !== entry.sourceAccountId) {
        fail('residualPoolInvalid', 'QCD remainder must rejoin its exact canonical request allocation.')
      }
      return {
        actionId: entry.actionId,
        allocationId: entry.allocationId,
        sourceAccountId: entry.sourceAccountId,
        scheduledDate: request.executionDate ?? null,
        scheduledSequence: request.executionSequence,
        grossAmount: entry.nonQcdCharitableRemainder,
      }
    })
  const line7Entries = [...source.line7Distributions, ...qcdEntries]
  const line8Entries = [...source.line8Conversions]
  const line7Gross = total(line7Entries.map((entry) => entry.grossAmount), 'Residual line 7')
  const line8Gross = total(line8Entries.map((entry) => entry.grossAmount), 'Residual line 8')
  const baseLine6 = cents(
    BigInt(base.form8606BaseDenominatorAmount) -
      BigInt(source.annualFacts.form8606Line7DistributionAmount) -
      BigInt(source.annualFacts.form8606Line8NetConversionAmount),
    'Base Form 8606 line 6',
  )
  if (BigInt(line7Gross) !== BigInt(source.annualFacts.form8606Line7DistributionAmount) +
      BigInt(transition.nonQcdCharitableRemainder) ||
      BigInt(baseLine6) + BigInt(line7Gross) + BigInt(line8Gross) !==
        BigInt(transition.adjustedResidualBasisDenominatorAmount)) {
    fail('residualPoolInvalid', 'Residual Form 8606 lines do not reconcile to the adjusted denominator.')
  }
  const annualBasisRatio = ratio(
    transition.adjustedResidualBasisNumeratorAmount,
    transition.adjustedResidualBasisDenominatorAmount,
  )
  const line7AllocationEvidence = allocate(
    base.ownerWideNonRothIraPoolId, base.taxYear,
    'form8606Line7Distributions', annualBasisRatio, line7Entries,
  )
  const line8AllocationEvidence = allocate(
    base.ownerWideNonRothIraPoolId, base.taxYear,
    'form8606Line8NetConversions', annualBasisRatio, line8Entries,
  )
  // Lines 7 and 8 quantize the same ratio independently, so each can round its
  // own half-cent up and together recover more basis than the pool holds. The
  // canonical producer on the pre-QCD path carries this guard
  // (ownedNonRothIraWithdrawalCharacter); the residual rebuild reproduces the
  // split-rounding structure and must carry it too.
  //
  // Not currently reachable: whenever a non-QCD remainder exists the post-pass
  // pins the residual ratio to exactly 1, and with no remainder the residual
  // entries are identical to the base ones, which already passed this check
  // upstream. It is here because the invariant is what makes that reasoning
  // safe to change.
  if (
    BigInt(line7AllocationEvidence.annualNontaxableBasisAmount) +
      BigInt(line8AllocationEvidence.annualNontaxableBasisAmount) >
    BigInt(transition.adjustedResidualBasisNumeratorAmount)
  ) {
    throw new RangeError(
      'Independent Form 8606 line rounding cannot recover more than annual IRA basis',
    )
  }
  const qcdRemainderBindings = qcdEntries.map((entry) => {
    const allocation = line7AllocationEvidence.allocations.find((candidate) =>
      candidate.actionId === entry.actionId && candidate.allocationId === entry.allocationId)
    const application = applications.find((candidate) => candidate.actionId === entry.actionId)!
    if (allocation === undefined || allocation.sourceAccountId !== entry.sourceAccountId ||
        allocation.grossAmount !== entry.grossAmount ||
        allocation.allocatedBasisAmount !== entry.grossAmount || allocation.taxableAmount !== 0) {
      fail('residualAllocationInvalid', 'Every positive QCD remainder must resolve as exact basis return.')
    }
    const bindingEvidenceId = deriveActionStructuralId('annual-qcd-residual-remainder-binding', [
      application.evidenceId, line7AllocationEvidence.allocationEvidenceId, allocation,
    ])
    return {
      postPassApplicationEvidenceId: application.evidenceId,
      line7AllocationEvidenceId: line7AllocationEvidence.allocationEvidenceId,
      allocation, bindingEvidenceId,
    }
  })
  const withoutEvidence = {
    predicate: 'annualQcdResidualForm8606Pool' as const,
    ownerPersonId: base.ownerPersonId,
    ownerWideNonRothIraPoolId: base.ownerWideNonRothIraPoolId,
    taxYear: base.taxYear,
    postPassTransitionEvidenceId: transition.transitionEvidenceId,
    adjustedResidualBasisDenominatorAmount:
      transition.adjustedResidualBasisDenominatorAmount,
    adjustedResidualBasisNumeratorAmount:
      transition.adjustedResidualBasisNumeratorAmount,
    annualBasisRatio, line7AllocationEvidence, line8AllocationEvidence,
    qcdRemainderBindings,
  }
  return { ...withoutEvidence, evidenceId: deriveActionStructuralId(
    'annual-qcd-residual-form8606-pool', [withoutEvidence],
  ) }
}

function blocked(error: unknown): AnnualQcdResidualForm8606Blocked {
  const issue = error instanceof ResidualError
    ? { kind: error.kind, detail: error.message }
    : { kind: 'hostileInput' as const, detail: 'Residual Form 8606 input must be canonical lossless data.' }
  return deepFreeze({
    status: 'annualQcdResidualForm8606Blocked', committed: false,
    movement: 'notCommitted', taxCharacterStatus: 'awaitingSection170Reconciliation',
    taxYear: null, postPass: null, pools: [], evidenceId: null, issues: [issue],
  })
}

function stageUnchecked(
  input: Readonly<StageAnnualQcdResidualForm8606Input>,
): AnnualQcdResidualForm8606Staged {
  const postPass = stageAnnualQcdTaxCharacterPostPass(input.postPassInput)
  if (postPass.status !== 'annualQcdTaxCharacterPostPassStaged') {
    fail('postPassInvalid', 'Residual Form 8606 requires a canonically rebuilt QCD post-pass.')
  }
  const pools = postPass.pools.map((pool) => buildPool(input.postPassInput, postPass, pool))
    .sort((left, right) => compareUtf16CodeUnits(left.ownerPersonId, right.ownerPersonId))
  const evidenceId = deriveActionStructuralId('annual-qcd-residual-form8606-batch', [
    postPass.taxYear, postPass.personalLimitEvidence.evidenceId,
    postPass.applications.map((entry) => entry.evidenceId),
    pools.map((pool) => pool.evidenceId),
  ])
  return deepFreeze({
    status: 'annualQcdResidualForm8606Staged', committed: false,
    movement: 'notCommitted', taxCharacterStatus: 'awaitingSection170Reconciliation',
    taxYear: postPass.taxYear, postPass, pools, evidenceId, issues: [],
  })
}

export function stageAnnualQcdResidualForm8606(
  input: Readonly<StageAnnualQcdResidualForm8606Input>,
): Readonly<StageAnnualQcdResidualForm8606Result> {
  try { return stageUnchecked(structuredClone(input)) }
  catch (error) { return blocked(error) }
}
