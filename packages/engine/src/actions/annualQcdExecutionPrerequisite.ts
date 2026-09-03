import type {
  Plan,
  RetirementActionDeductibleIraContribution,
} from '../model/plan.js'
import {
  buildRetirementActionEligibilityContextFromPlan,
  evaluateRetirementActionEligibilityFromPlan,
  type NonpersistedIraEligibilityFact,
  type NonpersistedPriorQcdOffsetEvidence,
  type NonpersistedQcdContributionHistoryFact,
  type RetirementActionEligibilityDecision,
  type RetirementActionEligibilityRuntimeEvidence,
} from '../strategies/accountEligibility.js'
import {
  qualifiedCharitableDistributionRequestSchema,
  type ActionOutcome,
  type QcdCharityDesignation,
  type QualifiedCharitableDistributionRequest,
} from './contract.js'
import {
  addCalendarMonths,
  formatCivilDate,
  parseCivilIsoDate,
} from './civilDate.js'
import {
  evaluateRetirementActionSchedule,
  type OrdinaryWithdrawalExecutionScheduleIssue,
} from './execution.js'
import type {
  AccountId,
  ActionId,
  AllocationId,
  PersonId,
} from './identity.js'
import {
  asUsdCents,
} from './money.js'
import type {
  AnnualRetirementActionAllocationRecord,
  AnnualRetirementActionPublicationSource,
  AnnualRetirementActionRecord,
  AnnualRetirementActionScheduleDiagnostic,
} from './annualRetirementActionPublication.js'
import {
  createActionReason,
  type ActionReason,
} from './reasons.js'
import { compareUtf16CodeUnits } from './structuralId.js'
import { deepFreeze } from './freeze.js'

export interface AnnualQcdExecutionPrerequisiteIssue {
  readonly kind:
    | 'invalidInput'
    | 'duplicateActionId'
    | 'actionYearMismatch'
    | 'evidenceIdReused'
  readonly actionId: ActionId | null
  readonly detail: string
}

export interface AnnualQcdDonorEligibilitySnapshot {
  readonly donorPersonId: PersonId
  readonly resolution: 'resolved' | 'unresolved' | 'ambiguous'
  readonly birthDate: string | null
  readonly age70HalfThresholdDate: string | null
  readonly aliveEvidence:
    | Readonly<{
        evidenceId: string
        actionId: ActionId
        personId: PersonId
        actionYear: number
        actionDate: string | null
        alive: boolean
      }>
    | null
}

export interface AnnualQcdScheduleEligibilitySnapshot {
  readonly taxYear: number
  readonly scheduledDate: string | null
  readonly parsedScheduledDate: string | null
  readonly scheduledSequence: number
  readonly dateInActionYear: boolean | null
  readonly age70HalfThresholdDate: string | null
  readonly reachedAge70HalfOnScheduledDate: boolean | null
}

export interface AnnualQcdSourceEligibilitySnapshot {
  readonly allocationId: AllocationId
  readonly sourceAccountId: AccountId
  readonly resolution: 'resolved' | 'unresolved' | 'ambiguous'
  readonly ownerPersonId: string | null
  readonly accountType: string | null
  readonly retirementAccountKind: 'ira' | 'employer' | null
  readonly inheritance: 'owned' | 'inherited' | 'notApplicable' | null
  readonly iraEligibilityFact: Readonly<NonpersistedIraEligibilityFact> | null
}

export interface AnnualQcdEligibilitySnapshot {
  readonly decision: Readonly<RetirementActionEligibilityDecision>
  readonly donor: Readonly<AnnualQcdDonorEligibilitySnapshot>
  readonly schedule: Readonly<AnnualQcdScheduleEligibilitySnapshot>
  readonly source: Readonly<AnnualQcdSourceEligibilitySnapshot>
  readonly charity: Readonly<QcdCharityDesignation>
  readonly contributionHistory:
    | Readonly<NonpersistedQcdContributionHistoryFact>
    | null
  readonly priorQcdOffsetEvidence:
    | Readonly<NonpersistedPriorQcdOffsetEvidence>
    | null
  readonly deductibleContributionEvidence:
    readonly Readonly<RetirementActionDeductibleIraContribution>[]
}

export interface AnnualQcdMissingStages {
  readonly physicalSettlement: 'notEstablished'
  readonly personalIndexedLimit: 'notEstablished'
  readonly deductibleContributionOffset: 'notEstablished'
  readonly otherwiseTaxablePoolAndBasis: 'notEstablished'
  readonly rmdCoordination: 'notEstablished'
  readonly charitableDeductionTreatment: 'notEstablished'
  readonly exclusionAndTaxCharacter: 'notEstablished'
}

export type AnnualQcdPublicationAllocationRecord =
  AnnualRetirementActionAllocationRecord

type AnnualQcdPublicationRecordBase = Omit<
  AnnualRetirementActionRecord,
  | 'executorSource'
  | 'request'
  | 'kind'
  | 'personId'
  | 'scheduledSequence'
  | 'executedDate'
  | 'executedSequence'
  | 'readiness'
  | 'outcome'
  | 'allocations'
> & {
  readonly request: Readonly<QualifiedCharitableDistributionRequest>
  readonly kind: 'qcd'
  readonly personId: PersonId
  readonly scheduledSequence: number
  readonly allocations: readonly [Readonly<AnnualQcdPublicationAllocationRecord>]
}

/**
 * Structurally matches the qcdExecutor record accepted by the canonical annual
 * publication coordinator, for a gift that moved nothing. It deliberately
 * contains no derived QCD amounts.
 *
 * This is the prerequisite's only shape, and it stays the whole shape for a
 * year whose gifts do not settle -- which is every year the annual chain
 * refuses, including a stand-in parameter year and a gift with a positive
 * section 170 eligible amount.
 */
export type AnnualQcdNonmovingPublicationRecord = Readonly<
  AnnualQcdPublicationRecordBase & {
  readonly executedDate: null
  readonly executedSequence: null
  readonly readiness: 'nonActionable'
  readonly outcome: Extract<ActionOutcome, 'refused' | 'unsupported'>
  }
>

/**
 * A gift the annual QCD executor settled with positive movement.
 *
 * The dates are the request's own, because the executor is the authority on
 * when the movement it authorised happened -- exactly as the named-conversion
 * arm publishes them. The publication coordinator re-derives the same binding
 * (`assertRecordBinding`), so a record whose executed date drifted from its
 * scheduled one aborts the year's publication rather than being reported.
 */
export type AnnualQcdExecutedPublicationRecord = Readonly<
  AnnualQcdPublicationRecordBase & {
  readonly executedDate: string
  readonly executedSequence: number
  readonly readiness: 'actionable'
  readonly outcome: Extract<ActionOutcome, 'executed' | 'partial'>
  }
>

export type AnnualQcdPublicationRecord =
  | AnnualQcdNonmovingPublicationRecord
  | AnnualQcdExecutedPublicationRecord

export type AnnualQcdPublicationScheduleDiagnostic = Readonly<
  Omit<
    AnnualRetirementActionScheduleDiagnostic,
    'executorSource' | 'scheduledDate'
  > & {
  readonly scheduledDate: string
  }
>

export interface AnnualQcdPublicationSource
  extends AnnualRetirementActionPublicationSource {
  readonly executorSource: 'qcdExecutor'
  readonly records: readonly Readonly<AnnualQcdPublicationRecord>[]
  readonly scheduleDiagnostics:
    readonly Readonly<AnnualQcdPublicationScheduleDiagnostic>[]
}

export interface AnnualQcdExecutionPrerequisiteEvidence {
  readonly actionId: ActionId
  readonly request: Readonly<QualifiedCharitableDistributionRequest>
  readonly eligibility: Readonly<AnnualQcdEligibilitySnapshot>
  readonly missingAnnualStages: Readonly<AnnualQcdMissingStages>
  readonly publicationRecord: Readonly<AnnualQcdNonmovingPublicationRecord>
}

export interface EvaluateAnnualQcdExecutionPrerequisitesInput {
  readonly taxYear: number
  readonly plan: Readonly<Plan>
  readonly requests: readonly Readonly<QualifiedCharitableDistributionRequest>[]
  readonly runtimeEvidence?: RetirementActionEligibilityRuntimeEvidence
}

export type AnnualQcdExecutionPrerequisitesEvaluated = Readonly<{
  status: 'evaluated'
  committed: false
  taxYear: number
  requests: readonly Readonly<QualifiedCharitableDistributionRequest>[]
  evidence: readonly Readonly<AnnualQcdExecutionPrerequisiteEvidence>[]
  publicationSource: Readonly<AnnualQcdPublicationSource>
  issues: readonly []
}>

export type AnnualQcdExecutionPrerequisitesBlocked = Readonly<{
  status: 'blocked'
  committed: false
  taxYear: number | null
  requests: readonly []
  evidence: readonly []
  publicationSource: null
  issues: readonly [
    Readonly<AnnualQcdExecutionPrerequisiteIssue>,
    ...Readonly<AnnualQcdExecutionPrerequisiteIssue>[],
  ]
}>

export type EvaluateAnnualQcdExecutionPrerequisitesResult =
  | AnnualQcdExecutionPrerequisitesEvaluated
  | AnnualQcdExecutionPrerequisitesBlocked

const MISSING_ANNUAL_STAGES: AnnualQcdMissingStages = {
  physicalSettlement: 'notEstablished',
  personalIndexedLimit: 'notEstablished',
  deductibleContributionOffset: 'notEstablished',
  otherwiseTaxablePoolAndBasis: 'notEstablished',
  rmdCoordination: 'notEstablished',
  charitableDeductionTreatment: 'notEstablished',
  exclusionAndTaxCharacter: 'notEstablished',
}

const ANNUAL_STAGE_REASONS = [
  createActionReason('qcd-nonqcd-deduction-unsupported'),
  createActionReason('qcd-rmd-evidence-missing'),
  createActionReason('qcd-tax-year-limit-unsupported'),
] as const

function blocked(
  taxYear: number | null,
  issues: readonly [
    AnnualQcdExecutionPrerequisiteIssue,
    ...AnnualQcdExecutionPrerequisiteIssue[],
  ],
): AnnualQcdExecutionPrerequisitesBlocked {
  return deepFreeze({
    status: 'blocked',
    committed: false,
    taxYear,
    requests: [],
    evidence: [],
    publicationSource: null,
    issues: [...issues],
  }) as AnnualQcdExecutionPrerequisitesBlocked
}

function reasonKey(reason: Readonly<ActionReason>): string {
  return JSON.stringify([
    reason.code,
    reason.personId ?? null,
    reason.accountId ?? null,
    reason.allocationId ?? null,
  ])
}

function canonicalBlockingReasons(
  reasons: readonly Readonly<ActionReason>[],
): ActionReason[] {
  const unique = new Map<string, ActionReason>()
  for (const reason of reasons) {
    if (reason.outcome === 'adjusted') continue
    unique.set(reasonKey(reason), { ...reason } as ActionReason)
  }
  return [...unique.values()].sort((left, right) => {
    const outcomeOrder = (left.outcome === 'unsupported' ? 0 : 1) -
      (right.outcome === 'unsupported' ? 0 : 1)
    return outcomeOrder ||
      compareUtf16CodeUnits(left.code, right.code) ||
      compareUtf16CodeUnits(left.personId ?? '', right.personId ?? '') ||
      compareUtf16CodeUnits(left.accountId ?? '', right.accountId ?? '') ||
      compareUtf16CodeUnits(left.allocationId ?? '', right.allocationId ?? '')
  })
}

function uniqueMatches<T>(
  values: readonly T[],
  predicate: (value: T) => boolean,
): readonly T[] {
  return values.filter(predicate)
}

function priorQcdOffsetEvidenceSnapshot(
  request: Readonly<QualifiedCharitableDistributionRequest>,
  runtimeEvidence: Readonly<RetirementActionEligibilityRuntimeEvidence>,
): Readonly<NonpersistedPriorQcdOffsetEvidence> | null {
  const matches = uniqueMatches(
    runtimeEvidence.priorQcdOffsetEvidence ?? [],
    (evidence) => evidence.actionId === request.actionId,
  )
  return matches.length === 1 ? matches[0]! : null
}

function deductibleContributionEvidenceSnapshot(
  request: Readonly<QualifiedCharitableDistributionRequest>,
  plan: Readonly<Plan>,
  thresholdDate: string | null,
): RetirementActionDeductibleIraContribution[] {
  if (thresholdDate === null) return []
  const thresholdYear = Number(thresholdDate.slice(0, 4))
  return (plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? [])
    .filter((record) =>
      record.donorPersonId === request.donorPersonId &&
      record.taxYear >= thresholdYear &&
      record.taxYear <= request.year)
    .map((record) => ({
      ...record,
      provenance: { ...record.provenance },
    }))
    .sort((left, right) =>
      left.taxYear - right.taxYear ||
      compareUtf16CodeUnits(left.evidenceId, right.evidenceId))
}

interface AnnualQcdEvidenceIdentityClaim {
  readonly evidenceId: string
  readonly role:
    | 'personAlive'
    | 'priorQcdOffset'
    | 'iraClassification'
    | 'sepSimpleActivity'
    | 'deductibleContribution'
  readonly actionId: ActionId | null
  readonly stableIdentity: string
}

function evidenceIdentityIssues(
  requests: readonly Readonly<QualifiedCharitableDistributionRequest>[],
  plan: Readonly<Plan>,
  runtimeEvidence: Readonly<RetirementActionEligibilityRuntimeEvidence>,
): AnnualQcdExecutionPrerequisiteIssue[] {
  const actionIds = new Set(requests.map((request) => request.actionId))
  const claims: AnnualQcdEvidenceIdentityClaim[] = []
  for (const evidence of runtimeEvidence.personAliveEvidence ?? []) {
    if (!actionIds.has(evidence.actionId)) continue
    claims.push({
      evidenceId: evidence.evidenceId,
      role: 'personAlive',
      actionId: evidence.actionId,
      stableIdentity: JSON.stringify(['personAlive', evidence.actionId]),
    })
  }
  for (const evidence of runtimeEvidence.priorQcdOffsetEvidence ?? []) {
    if (!actionIds.has(evidence.actionId)) continue
    claims.push({
      evidenceId: evidence.evidenceId,
      role: 'priorQcdOffset',
      actionId: evidence.actionId,
      stableIdentity: JSON.stringify(['priorQcdOffset', evidence.actionId]),
    })
  }

  const requestedSources = new Set<string>(requests.map((request) =>
    request.allocation.sourceAccountId))
  for (const record of
    plan.retirementActionEligibilityFacts?.iraClassifications ?? []) {
    if (!requestedSources.has(record.sourceAccountId)) continue
    claims.push({
      evidenceId: record.evidenceId,
      role: 'iraClassification',
      actionId: null,
      stableIdentity: JSON.stringify([
        'iraClassification', record.sourceAccountId, record.subtype,
      ]),
    })
  }
  for (const record of
    plan.retirementActionEligibilityFacts?.sepSimpleActivities ?? []) {
    if (!requests.some((request) =>
      request.allocation.sourceAccountId === record.sourceAccountId &&
      request.year === record.actionTaxYear)) continue
    claims.push({
      evidenceId: record.evidenceId,
      role: 'sepSimpleActivity',
      actionId: null,
      stableIdentity: JSON.stringify([
        'sepSimpleActivity', record.sourceAccountId, record.actionTaxYear,
      ]),
    })
  }

  for (const record of
    plan.retirementActionEligibilityFacts?.deductibleIraContributions ?? []) {
    const relevant = requests.some((request) => {
      if (record.donorPersonId !== request.donorPersonId) return false
      const thresholdDate = donorSnapshot(request, plan, null)
        .age70HalfThresholdDate
      if (thresholdDate === null) return false
      const thresholdYear = Number(thresholdDate.slice(0, 4))
      return record.taxYear >= thresholdYear && record.taxYear <= request.year
    })
    if (!relevant) continue
    claims.push({
      evidenceId: record.evidenceId,
      role: 'deductibleContribution',
      actionId: null,
      stableIdentity: JSON.stringify([
        'deductibleContribution',
        record.donorPersonId,
        record.taxYear,
      ]),
    })
  }

  claims.sort((left, right) =>
    compareUtf16CodeUnits(left.evidenceId, right.evidenceId) ||
    compareUtf16CodeUnits(left.role, right.role) ||
    compareUtf16CodeUnits(left.actionId ?? '', right.actionId ?? '') ||
    compareUtf16CodeUnits(left.stableIdentity, right.stableIdentity))
  const issues: AnnualQcdExecutionPrerequisiteIssue[] = []
  for (const claim of claims) {
    if (claim.evidenceId.trim().length > 0) continue
    issues.push({
      kind: 'invalidInput',
      actionId: claim.actionId,
      detail: `${claim.role} evidence IDs must be nonblank.`,
    })
  }
  const claimsById = new Map<string, AnnualQcdEvidenceIdentityClaim[]>()
  for (const claim of claims) {
    if (claim.evidenceId.trim().length === 0) continue
    const members = claimsById.get(claim.evidenceId) ?? []
    members.push(claim)
    claimsById.set(claim.evidenceId, members)
  }
  for (const [evidenceId, members] of claimsById) {
    if (members.length < 2) continue
    issues.push({
      kind: 'evidenceIdReused',
      actionId: null,
      detail: `Evidence ID "${evidenceId}" is reused across annual QCD evidence identities: ${members
        .map((member) => member.stableIdentity)
        .join(', ')}.`,
    })
  }
  return issues
}

function donorSnapshot(
  request: QualifiedCharitableDistributionRequest,
  plan: Readonly<Plan>,
  aliveEvidence: AnnualQcdDonorEligibilitySnapshot['aliveEvidence'],
): AnnualQcdDonorEligibilitySnapshot {
  const matches = uniqueMatches(
    plan.household.people,
    (person) => person.id === request.donorPersonId,
  )
  const donor = matches.length === 1 ? matches[0]! : null
  const thresholdDate = donor === null ? null : addCalendarMonths(donor.dob, 846)
  return {
    donorPersonId: request.donorPersonId,
    resolution: matches.length === 1
      ? 'resolved'
      : matches.length === 0
        ? 'unresolved'
        : 'ambiguous',
    birthDate: donor?.dob ?? null,
    age70HalfThresholdDate: thresholdDate,
    aliveEvidence,
  }
}

function scheduleSnapshot(
  request: QualifiedCharitableDistributionRequest,
  thresholdDate: string | null,
): AnnualQcdScheduleEligibilitySnapshot {
  const parsed = request.executionDate === undefined
    ? null
    : parseCivilIsoDate(request.executionDate)
  const parsedDate = parsed === null ? null : formatCivilDate(parsed)
  const dateInActionYear = parsed === null ? null : parsed.year === request.year
  return {
    taxYear: request.year,
    scheduledDate: request.executionDate ?? null,
    parsedScheduledDate: parsedDate,
    scheduledSequence: request.executionSequence,
    dateInActionYear,
    age70HalfThresholdDate: thresholdDate,
    reachedAge70HalfOnScheduledDate:
      parsedDate === null || thresholdDate === null
        ? null
        : parsedDate >= thresholdDate,
  }
}

function sourceSnapshot(
  request: QualifiedCharitableDistributionRequest,
  plan: Readonly<Plan>,
  iraEligibilityFact: Readonly<NonpersistedIraEligibilityFact> | null,
): AnnualQcdSourceEligibilitySnapshot {
  const matches = uniqueMatches(
    plan.accounts,
    (account) => account.id === request.allocation.sourceAccountId,
  )
  const account = matches.length === 1 ? matches[0]! : null
  const retirementAccountKind = account !== null &&
      (account.type === 'traditional' || account.type === 'roth')
    ? account.kind
    : null
  const inheritance = account === null
    ? null
    : account.type === 'traditional'
      ? account.inherited === undefined ? 'owned' : 'inherited'
      : account.type === 'roth'
        ? 'owned'
        : 'notApplicable'
  return {
    allocationId: request.allocation.allocationId,
    sourceAccountId: request.allocation.sourceAccountId,
    resolution: matches.length === 1
      ? 'resolved'
      : matches.length === 0
        ? 'unresolved'
        : 'ambiguous',
    ownerPersonId: account?.ownerPersonId ?? null,
    accountType: account?.type ?? null,
    retirementAccountKind,
    inheritance,
    iraEligibilityFact,
  }
}

type QcdScheduleConflict = Extract<
  OrdinaryWithdrawalExecutionScheduleIssue,
  { readonly kind: 'executionSequenceConflict' }
>

function conflictFor(
  actionId: ActionId,
  conflicts: readonly QcdScheduleConflict[],
): QcdScheduleConflict | null {
  return conflicts.find((conflict) =>
    conflict.collidingActionIds.includes(actionId)) ?? null
}

function publicationRecord(
  request: QualifiedCharitableDistributionRequest,
  sourceResolution: AnnualQcdSourceEligibilitySnapshot['resolution'],
  eligibilityDecision: Readonly<RetirementActionEligibilityDecision>,
  conflict: QcdScheduleConflict | null,
  batchConflictAborted: boolean,
): AnnualQcdNonmovingPublicationRecord {
  const zero = asUsdCents(0)
  const reasons = batchConflictAborted
    ? [createActionReason('action-batch-schedule-conflict')]
    : canonicalBlockingReasons([
        ...ANNUAL_STAGE_REASONS.filter((reason) =>
          sourceResolution === 'resolved' || reason.code !== 'qcd-rmd-evidence-missing'),
        ...eligibilityDecision.reasons,
        ...(conflict === null ? [] : [conflict.reason]),
      ])
  return {
    request,
    actionId: request.actionId,
    kind: 'qcd',
    personId: request.donorPersonId,
    year: request.year,
    scheduledDate: request.executionDate ?? null,
    scheduledSequence: request.executionSequence,
    executedDate: null,
    executedSequence: null,
    requestedAmount: request.requestedAmount,
    executedAmount: zero,
    unexecutedAmount: asUsdCents(request.requestedAmount),
    readiness: 'nonActionable',
    outcome: batchConflictAborted ? 'refused' : 'unsupported',
    allocations: [{
      allocationId: request.allocation.allocationId,
      sourceAccountId: request.allocation.sourceAccountId,
      resolution: !batchConflictAborted && sourceResolution === 'resolved'
        ? 'resolved'
        : 'unresolved',
      requestedAmount: request.allocation.requestedAmount,
      executedAmount: zero,
      unexecutedAmount: asUsdCents(request.allocation.requestedAmount),
    }],
    reasons,
  }
}

function evaluateUnchecked(
  input: EvaluateAnnualQcdExecutionPrerequisitesInput,
): EvaluateAnnualQcdExecutionPrerequisitesResult {
  if (!Number.isSafeInteger(input.taxYear) || input.taxYear < 1 || input.taxYear > 9999) {
    return blocked(null, [{
      kind: 'invalidInput',
      actionId: null,
      detail: 'QCD prerequisite tax year must be an integer from 1 through 9999.',
    }])
  }
  if (input.requests.length === 0) {
    return blocked(input.taxYear, [{
      kind: 'invalidInput',
      actionId: null,
      detail: 'At least one QCD request is required for an annual prerequisite publication.',
    }])
  }

  const parsedRequests: QualifiedCharitableDistributionRequest[] = []
  for (const request of input.requests) {
    const parsed = qualifiedCharitableDistributionRequestSchema.safeParse(request)
    if (!parsed.success) {
      return blocked(input.taxYear, [{
        kind: 'invalidInput',
        actionId: null,
        detail: 'Each QCD request must satisfy the canonical qualified charitable distribution request schema.',
      }])
    }
    parsedRequests.push(parsed.data)
  }
  const scheduleState = evaluateRetirementActionSchedule(
    input.taxYear,
    parsedRequests,
  )
  const requests: QualifiedCharitableDistributionRequest[] = []
  for (const request of scheduleState.requests) {
    const parsed = qualifiedCharitableDistributionRequestSchema.safeParse(request)
    if (!parsed.success) {
      return blocked(input.taxYear, [{
        kind: 'invalidInput',
        actionId: null,
        detail: 'Each scheduled QCD request must satisfy the canonical qualified charitable distribution request schema.',
      }])
    }
    requests.push(parsed.data)
  }
  const scheduleBlockers = scheduleState.scheduleIssues.filter((issue) =>
    issue.kind !== 'executionSequenceConflict')
  if (scheduleBlockers.length > 0) {
    const issues = scheduleBlockers.map((issue) =>
      issue.kind === 'duplicateActionId'
        ? {
            kind: 'duplicateActionId' as const,
            actionId: issue.actionId,
            detail: `QCD action ID "${issue.actionId}" appears more than once in the annual batch.`,
          }
        : {
            kind: 'actionYearMismatch' as const,
            actionId: issue.actionId,
            detail: `QCD action "${issue.actionId}" belongs to ${issue.actualYear}, not ${issue.expectedYear}.`,
          })
    return blocked(input.taxYear, [issues[0]!, ...issues.slice(1)])
  }

  const runtimeEvidence = input.runtimeEvidence ?? {}
  const evidenceIssues = evidenceIdentityIssues(
    requests,
    input.plan,
    runtimeEvidence,
  )
  if (evidenceIssues.length > 0) {
    return blocked(input.taxYear, [
      evidenceIssues[0]!,
      ...evidenceIssues.slice(1),
    ])
  }

  const conflicts = scheduleState.scheduleIssues.filter(
    (issue): issue is QcdScheduleConflict =>
      issue.kind === 'executionSequenceConflict',
  )
  const evidence: AnnualQcdExecutionPrerequisiteEvidence[] = []
  for (const request of requests) {
    const context = buildRetirementActionEligibilityContextFromPlan(
      input.plan as Plan,
      request,
      runtimeEvidence,
    )
    const decision = evaluateRetirementActionEligibilityFromPlan(
      request,
      input.plan as Plan,
      runtimeEvidence,
    )
    const aliveEvidence = context.personAliveEvidence?.find(
      (candidate) => candidate.actionId === request.actionId,
    ) ?? null
    const donor = donorSnapshot(request, input.plan, aliveEvidence)
    const iraEligibilityFact = context.iraFacts?.find(
      (fact) => fact.sourceAccountId === request.allocation.sourceAccountId,
    ) ?? null
    const source = sourceSnapshot(
      request,
      input.plan,
      iraEligibilityFact,
    )
    const contributionHistory = context.qcdContributionHistories?.find(
      (history) => history.donorPersonId === request.donorPersonId,
    ) ?? null
    const priorQcdOffsetEvidence = priorQcdOffsetEvidenceSnapshot(
      request,
      runtimeEvidence,
    )
    const conflict = conflictFor(request.actionId, conflicts)
    const record = publicationRecord(
      request,
      source.resolution,
      decision,
      conflict,
      conflicts.length > 0 && conflict === null,
    )
    evidence.push({
      actionId: request.actionId,
      request,
      eligibility: {
        decision,
        donor,
        schedule: scheduleSnapshot(request, donor.age70HalfThresholdDate),
        source,
        charity: { ...request.charity },
        contributionHistory,
        priorQcdOffsetEvidence,
        deductibleContributionEvidence:
          deductibleContributionEvidenceSnapshot(
            request,
            input.plan,
            donor.age70HalfThresholdDate,
          ),
      },
      missingAnnualStages: { ...MISSING_ANNUAL_STAGES },
      publicationRecord: record,
    })
  }

  const scheduleDiagnostics: AnnualQcdPublicationScheduleDiagnostic[] = []
  for (const conflict of conflicts) {
    if (conflict.scheduledDate === null) {
      throw new Error('QCD schedule conflict must bind a real execution date')
    }
    for (const actionId of conflict.collidingActionIds) {
      scheduleDiagnostics.push({
        kind: 'executionSequenceConflict',
        actionId,
        year: conflict.year,
        scheduledDate: conflict.scheduledDate,
        executionSequence: conflict.executionSequence,
        collidingActionIds: [...conflict.collidingActionIds] as [
          ActionId,
          ActionId,
          ...ActionId[],
        ],
        reason: { ...conflict.reason },
      })
    }
  }
  scheduleDiagnostics.sort((left, right) =>
    compareUtf16CodeUnits(left.scheduledDate, right.scheduledDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId))

  return deepFreeze({
    status: 'evaluated',
    committed: false,
    taxYear: input.taxYear,
    requests,
    evidence,
    publicationSource: {
      executorSource: 'qcdExecutor',
      records: evidence.map((entry) => entry.publicationRecord),
      scheduleDiagnostics,
    },
    issues: [],
  }) as AnnualQcdExecutionPrerequisitesEvaluated
}

/**
 * Snapshot the exact QCD identity/legal preflight for one annual batch and
 * expose a canonical qcdExecutor publication source. This first QCD execution
 * slice never settles a balance, satisfies RMD, allocates IRA basis, applies a
 * personal limit or contribution offset, derives an exclusion/deduction, or
 * emits actionable evidence. Missing annual stages keep every record at zero
 * movement and non-actionable until a later unified annual coordinator proves
 * and settles them atomically.
 */
export function evaluateAnnualQcdExecutionPrerequisites(
  input: Readonly<EvaluateAnnualQcdExecutionPrerequisitesInput>,
): Readonly<EvaluateAnnualQcdExecutionPrerequisitesResult> {
  try {
    const snapshot = structuredClone(input) as EvaluateAnnualQcdExecutionPrerequisitesInput
    return evaluateUnchecked(snapshot)
  } catch {
    return blocked(null, [{
      kind: 'invalidInput',
      actionId: null,
      detail: 'The Plan, QCD requests, and runtime evidence must be valid losslessly snapshot-compatible data.',
    }])
  }
}
