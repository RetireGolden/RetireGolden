import type { QualifiedCharitableDistributionRequest } from './contract.js'
import { actionExecutionDispositionSchema } from './contract.js'
import type {
  AnnualQcdExecutionPrerequisitesEvaluated,
  AnnualQcdPublicationRecord,
  AnnualQcdPublicationSource,
} from './annualQcdExecutionPrerequisite.js'
import {
  stageAnnualQcdPhysicalExecution,
  type AnnualQcdPhysicalApplication,
  type StageAnnualQcdPhysicalExecutionInput,
} from './annualQcdPhysicalExecution.js'
import {
  stageAnnualQcdTaxCharacterPostPass,
  type AnnualQcdPersonalLimitEvidence,
  type AnnualQcdPostPassApplication,
  type AnnualQcdPostPassPoolTransition,
} from './annualQcdTaxCharacterPostPass.js'
import type { AccountId, ActionId, AllocationId, PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import type { ClassifyOwnedNonRothIraAnnualWithdrawalsInput } from './ownedNonRothIraWithdrawalCharacter.js'
import type { ActionReason } from './reasons.js'

export interface ExecuteAnnualQcdsInput {
  readonly physicalInput: Readonly<StageAnnualQcdPhysicalExecutionInput>
  readonly poolCapacityInputs:
    readonly Readonly<ClassifyOwnedNonRothIraAnnualWithdrawalsInput>[]
}

export interface AnnualQcdExecutionIssue {
  readonly kind:
    | 'hostileInput'
    | 'prerequisiteInvalid'
    | 'postPassBlocked'
    | 'charitableDeductionUnsupported'
    | 'executionDateMissing'
    | 'derivedFactsInconsistent'
  readonly actionId: ActionId | null
  readonly detail: string
}

interface AnnualQcdExecutionEvidenceBase {
  readonly actionId: ActionId
  readonly kind: 'qcd'
  readonly request: Readonly<QualifiedCharitableDistributionRequest>
  readonly year: number
  readonly donorPersonId: PersonId
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly scheduledDate: string | null
  readonly scheduledSequence: number
  readonly requestedAmount: UsdCents
  readonly reasons: readonly Readonly<ActionReason>[]
}

/**
 * One request in a batch that settled no gift at all. It is the shape the
 * prerequisite already published: nothing moved, no annual stage is claimed,
 * and no derived fact accompanies it.
 */
export interface AnnualQcdStagedExecutionEvidence
  extends AnnualQcdExecutionEvidenceBase {
  readonly outcome: 'refused' | 'unsupported'
  readonly readiness: 'nonActionable'
  readonly executedDate: null
  readonly executedSequence: null
  readonly executedAmount: 0
  readonly unexecutedAmount: UsdCents
  readonly sourceBalanceBefore: null
  readonly sourceBalanceAfter: null
  readonly derivedFacts: null
}

/**
 * One request inside a committed annual batch.
 *
 * `derivedFacts` is the post-pass application in full, which is what makes the
 * WS1 invariant "only complete derived facts may accompany an executed or
 * partial QCD" hold by construction rather than by convention. A settled gift
 * that moved nothing -- its named source had no principal left -- keeps the
 * complete facts too: the pool, limit and offset chain still ran over it, and
 * every figure in it is a derived zero rather than a placeholder.
 */
export interface AnnualQcdSettledExecutionEvidence
  extends AnnualQcdExecutionEvidenceBase {
  readonly outcome: 'executed' | 'partial' | 'refused'
  readonly readiness: 'actionable' | 'nonActionable'
  readonly executedDate: string | null
  readonly executedSequence: number | null
  readonly executedAmount: UsdCents
  readonly unexecutedAmount: UsdCents
  readonly sourceBalanceBefore: UsdCents
  readonly sourceBalanceAfter: UsdCents
  readonly derivedFacts: Readonly<AnnualQcdPostPassApplication>
}

export type AnnualQcdExecutionEvidence =
  | Readonly<AnnualQcdStagedExecutionEvidence>
  | Readonly<AnnualQcdSettledExecutionEvidence>

export interface ExecuteAnnualQcdsStagedResult {
  readonly committed: false
  readonly taxYear: number | null
  readonly requests: readonly Readonly<QualifiedCharitableDistributionRequest>[]
  readonly evidence: readonly Readonly<AnnualQcdStagedExecutionEvidence>[]
  readonly personalLimitEvidence: null
  readonly pools: readonly []
  readonly totalExecutedAmount: 0
  readonly totalExcludableAmount: 0
  readonly totalRmdSatisfiedAmount: 0
  readonly publicationSource: Readonly<AnnualQcdPublicationSource> | null
  readonly issues: readonly [
    Readonly<AnnualQcdExecutionIssue>,
    ...Readonly<AnnualQcdExecutionIssue>[],
  ]
}

/**
 * Every request in the year's batch settled together.
 *
 * The batch is atomic on purpose, and the reason is structural rather than
 * conservative. The post-pass advances each donor's pool capacity, personal
 * limit and contribution offset in scheduled order, so every gift's
 * before-state is the previous gift's after-state; and it requires the
 * *complete* canonical Plan batch for its year, so a run with one request
 * dropped is not a run this chain can perform. A batch that committed only the
 * gifts it liked would therefore be charging each survivor against capacity a
 * refused gift consumed, and no re-run without the refused gift exists to
 * correct it. So the whole year settles or none of it does.
 */
export interface ExecuteAnnualQcdsCommittedResult {
  readonly committed: true
  readonly taxYear: number
  readonly requests: readonly Readonly<QualifiedCharitableDistributionRequest>[]
  readonly evidence: readonly [
    Readonly<AnnualQcdSettledExecutionEvidence>,
    ...Readonly<AnnualQcdSettledExecutionEvidence>[],
  ]
  readonly personalLimitEvidence: Readonly<AnnualQcdPersonalLimitEvidence>
  readonly pools: readonly Readonly<AnnualQcdPostPassPoolTransition>[]
  readonly totalExecutedAmount: UsdCents
  readonly totalExcludableAmount: UsdCents
  readonly totalRmdSatisfiedAmount: UsdCents
  readonly publicationSource: Readonly<AnnualQcdPublicationSource>
  readonly issues: readonly []
}

export type ExecuteAnnualQcdsResult =
  | ExecuteAnnualQcdsStagedResult
  | ExecuteAnnualQcdsCommittedResult

class ExecuteError extends Error {
  readonly kind: AnnualQcdExecutionIssue['kind']
  readonly actionId: ActionId | null
  constructor(
    kind: AnnualQcdExecutionIssue['kind'],
    detail: string,
    actionId: ActionId | null = null,
  ) {
    super(detail)
    this.kind = kind
    this.actionId = actionId
  }
}

function fail(
  kind: AnnualQcdExecutionIssue['kind'],
  detail: string,
  actionId: ActionId | null = null,
): never {
  throw new ExecuteError(kind, detail, actionId)
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function cents(value: bigint, label: string): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail('derivedFactsInconsistent', `${label} exceeded the exact-cent range.`)
  }
  return asUsdCents(Number(value))
}

function stagedEvidence(
  prerequisite: Readonly<AnnualQcdExecutionPrerequisitesEvaluated>,
): AnnualQcdStagedExecutionEvidence[] {
  return prerequisite.evidence.map((entry) => {
    const record = entry.publicationRecord
    return {
      actionId: entry.actionId,
      kind: 'qcd' as const,
      request: entry.request,
      year: entry.request.year,
      donorPersonId: entry.request.donorPersonId,
      allocationId: entry.request.allocation.allocationId,
      sourceAccountId: entry.request.allocation.sourceAccountId,
      scheduledDate: entry.request.executionDate ?? null,
      scheduledSequence: entry.request.executionSequence,
      requestedAmount: asUsdCents(entry.request.requestedAmount),
      reasons: record.reasons,
      outcome: record.outcome,
      readiness: 'nonActionable' as const,
      executedDate: null,
      executedSequence: null,
      executedAmount: 0 as const,
      unexecutedAmount: asUsdCents(entry.request.requestedAmount),
      sourceBalanceBefore: null,
      sourceBalanceAfter: null,
      derivedFacts: null,
    }
  })
}

function staged(
  prerequisite: Readonly<AnnualQcdExecutionPrerequisitesEvaluated> | null,
  issues: readonly [AnnualQcdExecutionIssue, ...AnnualQcdExecutionIssue[]],
): ExecuteAnnualQcdsStagedResult {
  return deepFreeze({
    committed: false,
    taxYear: prerequisite?.taxYear ?? null,
    requests: prerequisite === null ? [] : [...prerequisite.requests],
    evidence: prerequisite === null ? [] : stagedEvidence(prerequisite),
    personalLimitEvidence: null,
    pools: [],
    totalExecutedAmount: 0,
    totalExcludableAmount: 0,
    totalRmdSatisfiedAmount: 0,
    publicationSource: prerequisite?.publicationSource ?? null,
    issues: [...issues],
  }) as ExecuteAnnualQcdsStagedResult
}

/**
 * The reasons a settled gift may carry, and the proof that the list is
 * complete.
 *
 * A gift only settles when its post-pass evidence is
 * `notApplicableZeroEligibleAmount`, which is
 * `taxableQcdAmount + nonQcdCharitableRemainder === 0`. Both terms are
 * nonnegative, so both are zero, and the post-pass arithmetic then forces the
 * rest: `nonQcd === 0` means the gift stayed inside the otherwise-taxable pool,
 * so no `qcd-taxable-amount-trimmed`; `taxableQcd === 0` means
 * `excludable === otherwiseTaxableAmountUsed`, and since
 * `excludable = candidate - offsetApplied` with `candidate <= used`, both
 * `offsetApplied === 0` (no `qcd-contribution-offset-applied`) and
 * `candidate === used` (no `qcd-person-limit-trimmed`). So the only reason a
 * settled gift can carry is the physical one, and the invariant is asserted
 * below rather than assumed.
 */
function settledReasons(
  application: Readonly<AnnualQcdPostPassApplication>,
  physical: Readonly<AnnualQcdPhysicalApplication>,
): readonly Readonly<ActionReason>[] {
  if (application.deductibleContributionOffsetApplied !== 0 ||
      application.nonQcdCharitableRemainder !== 0 ||
      application.taxableQcdAmount !== 0 ||
      application.personalLimitUsed !== application.otherwiseTaxableAmountUsed) {
    fail(
      'derivedFactsInconsistent',
      'A wholly excludable QCD cannot also report a limit, offset, or taxable trim.',
      application.actionId,
    )
  }
  return physical.physicalReason === null ? [] : [physical.physicalReason]
}

function settledRecord(
  evidence: Readonly<AnnualQcdSettledExecutionEvidence>,
): AnnualQcdPublicationRecord {
  const allocation = {
    allocationId: evidence.allocationId,
    sourceAccountId: evidence.sourceAccountId,
    resolution: 'resolved' as const,
    requestedAmount: evidence.request.allocation.requestedAmount,
    executedAmount: evidence.executedAmount,
    unexecutedAmount: evidence.unexecutedAmount,
  }
  return {
    request: evidence.request,
    actionId: evidence.actionId,
    kind: 'qcd',
    personId: evidence.donorPersonId,
    year: evidence.year,
    scheduledDate: evidence.scheduledDate,
    scheduledSequence: evidence.scheduledSequence,
    executedDate: evidence.executedDate,
    executedSequence: evidence.executedSequence,
    requestedAmount: evidence.request.requestedAmount,
    executedAmount: evidence.executedAmount,
    unexecutedAmount: evidence.unexecutedAmount,
    readiness: evidence.readiness,
    outcome: evidence.outcome,
    allocations: [allocation],
    reasons: evidence.reasons,
  } as AnnualQcdPublicationRecord
}

function executeUnchecked(input: ExecuteAnnualQcdsInput): ExecuteAnnualQcdsResult {
  const prerequisite = input.physicalInput.prerequisite
  if (prerequisite.status !== 'evaluated') {
    return staged(null, [{
      kind: 'prerequisiteInvalid',
      actionId: null,
      detail: 'A committed QCD batch requires an evaluated prerequisite batch.',
    }])
  }
  const physical = stageAnnualQcdPhysicalExecution(input.physicalInput)
  if (physical.status !== 'annualQcdPhysicalExecutionStaged') {
    return staged(prerequisite, [{
      kind: 'prerequisiteInvalid',
      actionId: null,
      detail: `QCD physical staging refused the annual batch: ${physical.issues[0].detail}`,
    }])
  }
  const postPass = stageAnnualQcdTaxCharacterPostPass({
    physicalInput: input.physicalInput,
    poolCapacityInputs: input.poolCapacityInputs,
  })
  if (postPass.status !== 'annualQcdTaxCharacterPostPassStaged') {
    return staged(prerequisite, [{
      kind: 'postPassBlocked',
      actionId: null,
      detail: `QCD tax-character post pass refused the annual batch: ${postPass.issues[0].detail}`,
    }])
  }
  // The commit gate, read off the post-pass rather than re-derived. A gift the
  // exclusion swallows whole leaves nothing for section 170 to consider, which
  // is the one case doc 4780-4782 settles in terms. Any positive eligible
  // amount needs the complete percentage-limit, floor, filing-treatment and
  // carryforward chain, and the simulator mints no liability run to bind it to,
  // so the gift stays unsupported and no dollar moves.
  const unsupported = postPass.applications.find((application) =>
    application.charitableDeductionRequirement !== 'notApplicableZeroEligibleAmount')
  if (unsupported !== undefined) {
    return staged(prerequisite, [{
      kind: 'charitableDeductionUnsupported',
      actionId: unsupported.actionId,
      detail: `QCD action "${unsupported.actionId}" leaves a charitable amount eligible for section 170 treatment, which this annual chain cannot evidence.`,
    }])
  }

  const physicalByAction = new Map(
    physical.applications.map((entry) => [entry.request.actionId, entry] as const),
  )
  const evidence: AnnualQcdSettledExecutionEvidence[] = []
  let totalExecuted = 0n
  let totalExcludable = 0n
  let totalRmdSatisfied = 0n
  for (const application of postPass.applications) {
    const physicalApplication = physicalByAction.get(application.actionId)
    if (physicalApplication === undefined) {
      fail(
        'derivedFactsInconsistent',
        `QCD action "${application.actionId}" lost its physical staging.`,
        application.actionId,
      )
    }
    const request = physicalApplication.request
    const executedAmount = physicalApplication.executedAmount
    const scheduledDate = request.executionDate ?? null
    if (executedAmount > 0 && scheduledDate === null) {
      fail(
        'executionDateMissing',
        `QCD action "${application.actionId}" cannot move dollars without its stated execution date.`,
        application.actionId,
      )
    }
    const reasons = settledReasons(application, physicalApplication)
    const outcome = executedAmount === 0
      ? 'refused' as const
      : physicalApplication.unexecutedAmount === 0
        ? 'executed' as const
        : 'partial' as const
    const readiness = executedAmount === 0
      ? 'nonActionable' as const
      : 'actionable' as const
    // Parsed rather than trusted: this is the same predicate the annual
    // publication coordinator will run over the record built from it, so a
    // disposition it would reject is refused here, where the batch can still
    // decline to commit.
    actionExecutionDispositionSchema.parse({
      outcome,
      readiness,
      requestedAmount: request.requestedAmount,
      executedAmount,
      unexecutedAmount: physicalApplication.unexecutedAmount,
      reasons,
    })
    evidence.push({
      actionId: application.actionId,
      kind: 'qcd',
      request,
      year: request.year,
      donorPersonId: application.donorPersonId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      scheduledDate,
      scheduledSequence: request.executionSequence,
      requestedAmount: asUsdCents(request.requestedAmount),
      reasons,
      outcome,
      readiness,
      executedDate: executedAmount > 0 ? scheduledDate : null,
      executedSequence: executedAmount > 0 ? request.executionSequence : null,
      executedAmount,
      unexecutedAmount: physicalApplication.unexecutedAmount,
      sourceBalanceBefore: physicalApplication.sourceBalanceBefore,
      sourceBalanceAfter: physicalApplication.sourceBalanceAfter,
      derivedFacts: application,
    })
    totalExecuted += BigInt(executedAmount)
    totalExcludable += BigInt(application.excludableQcdAmount)
    totalRmdSatisfied += BigInt(application.rmdSatisfiedByAction)
  }
  const first = evidence[0]
  if (first === undefined) {
    return staged(prerequisite, [{
      kind: 'postPassBlocked',
      actionId: null,
      detail: 'A committed QCD batch requires at least one settled action.',
    }])
  }
  return deepFreeze({
    committed: true,
    taxYear: postPass.taxYear,
    requests: [...prerequisite.requests],
    evidence: [first, ...evidence.slice(1)],
    personalLimitEvidence: postPass.personalLimitEvidence,
    pools: postPass.pools,
    totalExecutedAmount: cents(totalExecuted, 'Committed QCD total'),
    totalExcludableAmount: cents(totalExcludable, 'Committed QCD exclusion total'),
    totalRmdSatisfiedAmount: cents(totalRmdSatisfied, 'Committed QCD RMD satisfaction total'),
    publicationSource: {
      executorSource: 'qcdExecutor',
      records: evidence.map(settledRecord),
      scheduleDiagnostics: [],
    },
    issues: [],
  }) as ExecuteAnnualQcdsCommittedResult
}

/**
 * Settle one year's named charitable gifts, or refuse the year and say why.
 *
 * This is the QCD analogue of the named-conversion executor: it owns the
 * decision to move, publishes the evidence a mutation site and the annual
 * publication coordinator both read, and never touches a balance itself. It
 * consumes the prerequisite, the pool-capacity stage, the physical staging and
 * the tax-character post pass -- and stops there. The section 170 half of the
 * chain is not entered at all, because the gate above only lets through gifts
 * that leave nothing for it to consider.
 */
export function executeAnnualQcds(
  input: Readonly<ExecuteAnnualQcdsInput>,
): Readonly<ExecuteAnnualQcdsResult> {
  try {
    return executeUnchecked(structuredClone(input) as ExecuteAnnualQcdsInput)
  } catch (error) {
    const issue = error instanceof ExecuteError
      ? { kind: error.kind, actionId: error.actionId, detail: error.message }
      : {
          kind: 'hostileInput' as const,
          actionId: null,
          detail: 'QCD execution input must be valid losslessly snapshot-compatible data.',
        }
    return deepFreeze({
      committed: false,
      taxYear: null,
      requests: [],
      evidence: [],
      personalLimitEvidence: null,
      pools: [],
      totalExecutedAmount: 0,
      totalExcludableAmount: 0,
      totalRmdSatisfiedAmount: 0,
      publicationSource: null,
      issues: [issue],
    }) as ExecuteAnnualQcdsStagedResult
  }
}
