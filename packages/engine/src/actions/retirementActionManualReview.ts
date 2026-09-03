import {
  persistedRetirementActionRequestSchema,
  type ActionProvenance,
  type OrdinaryWithdrawalRequest,
  type RetirementActionRequest,
  type RothConversionRequest,
} from './contract.js'
import {
  actionIdSchema,
  planIdSchema,
  type ActionId,
  type PlanId,
} from './identity.js'
import type { PositiveUsdCents } from './money.js'
import {
  reservePlanOwnedNonRothIraAnnualFilingSourceIdentifiers,
} from './ownedNonRothIraAnnualFilingSourceResolver.js'
import {
  allocateRetirementActionCandidateIdentity,
  rejectedPlanFilingSourceRootIdentityIssue,
  type RetirementActionCandidateIdentityEvidence,
  type RetirementActionCandidateIdentityIntent,
  type RetirementActionCandidateIdentityIssue,
} from './retirementActionCandidateIdentityAllocator.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import {
  planSchema,
  retirementActionPlanReservedIdentifiers,
  type Plan,
} from '../model/plan.js'
import { deepFreeze } from './freeze.js'

export interface RetirementActionManualReviewInput {
  plan: Readonly<Plan>
  targetActionId: ActionId
  /** Required for withdrawal/conversion replacement; deliberately absent for unsupported QCD review. */
  replacementIntent?: Readonly<RetirementActionCandidateIdentityIntent>
}

export type RetirementActionManualReviewIssueKind =
  | 'invalidInput'
  | 'targetMissing'
  | 'targetAmbiguous'
  | 'targetProvenanceUnsupported'
  | 'targetKindUnsupported'
  | 'replacementMissing'
  | 'replacementProvenanceInvalid'
  | 'replacementKindMismatch'
  | 'replacementYearMismatch'
  | 'replacementAmountMismatch'
  | 'dependentActionReference'
  | 'allocatorBlocked'
  | 'replacementIdentityCollision'
  | 'reviewEvidenceCollision'
  | 'replacementInvariantViolation'
  | 'replacementPlanInvalid'

export interface RetirementActionManualReviewIssue {
  kind: RetirementActionManualReviewIssueKind
  field: string
  detail: string
  allocatorIssue: Readonly<RetirementActionCandidateIdentityIssue> | null
}

export interface RetirementActionManualReviewTargetEvidence {
  actionId: ActionId
  kind: RetirementActionRequest['kind']
  provenanceSource: 'manual' | 'migration'
  provenance: Readonly<ActionProvenance>
  year: number
  requestedAmount: PositiveUsdCents
  originalPlanIndex: number
  request: Readonly<RetirementActionRequest>
}

export interface RetirementActionManualReviewReplacementEvidence {
  policy: 'explicitManualIntentOmitTargetThenCanonicalAllocate'
  evidenceId: string
  planId: PlanId
  target: Readonly<RetirementActionManualReviewTargetEvidence>
  targetOmittedBeforeAllocation: true
  inferredFields: readonly []
  replacementActionId: ActionId
  replacementProvenance: Readonly<ActionProvenance>
  preservedActionIds: readonly ActionId[]
  allocatorEvidence: Readonly<RetirementActionCandidateIdentityEvidence>
}

/**
 * Why this target was not replaced, as published evidence.
 *
 * The two members are not interchangeable and the difference is the whole
 * point of naming them. A migrated aggregate QCD is not replaced because the
 * canonical allocator has no aggregate arm to hand it to. A named QCD is not
 * replaced because it does not belong on this path at all: the allocator's QCD
 * arm authors it, and a consumer reading the aggregate policy off a named
 * target would read a missing arm that exists.
 */
export type RetirementActionManualReviewRequiredPolicy =
  | 'explicitManualReviewRequiredNoCanonicalAllocatorArm'
  | 'explicitNoReplacementNamedQcdUsesCanonicalAllocatorArm'

export interface RetirementActionManualReviewRequiredEvidence {
  policy: RetirementActionManualReviewRequiredPolicy
  planId: PlanId | null
  target: Readonly<RetirementActionManualReviewTargetEvidence>
  targetOmittedBeforeAllocation: false
  inferredFields: readonly []
  unsupportedKind: 'qcd' | 'legacyAggregateQcd'
}

export type RetirementActionManualReplacementReadyResult = Readonly<{
  status: 'replacementReady'
  outcome: 'accepted'
  target: Readonly<RetirementActionRequest>
  replacement: Readonly<OrdinaryWithdrawalRequest | RothConversionRequest>
  plan: Readonly<Plan>
  evidence: Readonly<RetirementActionManualReviewReplacementEvidence>
}>

export type RetirementActionManualReviewRequiredResult = Readonly<{
  status: 'manualReviewRequired'
  outcome: 'unsupported'
  target: Readonly<RetirementActionRequest>
  replacement: null
  plan: null
  evidence: Readonly<RetirementActionManualReviewRequiredEvidence>
  issues: readonly [
    Readonly<RetirementActionManualReviewIssue>,
    ...Readonly<RetirementActionManualReviewIssue>[],
  ]
}>

export type RetirementActionManualReviewBlockedResult = Readonly<{
  status: 'blocked'
  outcome: 'refused' | 'unsupported'
  target: Readonly<RetirementActionRequest> | null
  replacement: null
  plan: null
  evidence: null
  issues: readonly [
    Readonly<RetirementActionManualReviewIssue>,
    ...Readonly<RetirementActionManualReviewIssue>[],
  ]
}>

export type RetirementActionManualReviewResult =
  | RetirementActionManualReplacementReadyResult
  | RetirementActionManualReviewRequiredResult
  | RetirementActionManualReviewBlockedResult

type UnknownRecord = Record<string, unknown>

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function normalizeOptionalUndefinedFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((entry) => normalizeOptionalUndefinedFields(entry))
  }
  const source = record(value)
  if (source === null) return value
  const normalized: UnknownRecord = {}
  for (const [key, entry] of Object.entries(source)) {
    if (entry !== undefined) normalized[key] = normalizeOptionalUndefinedFields(entry)
  }
  return normalized
}

function issue(
  kind: RetirementActionManualReviewIssueKind,
  field: string,
  detail: string,
  allocatorIssue: RetirementActionCandidateIdentityIssue | null = null,
): RetirementActionManualReviewIssue {
  return { kind, field, detail, allocatorIssue }
}

function canonicalIssues(
  issues: readonly RetirementActionManualReviewIssue[],
): RetirementActionManualReviewIssue[] {
  return [...issues].sort((left, right) =>
    compareUtf16CodeUnits(
      JSON.stringify([left.kind, left.field, left.detail, left.allocatorIssue]),
      JSON.stringify([right.kind, right.field, right.detail, right.allocatorIssue]),
    ),
  )
}

function blocked(
  issues: readonly RetirementActionManualReviewIssue[],
  target: RetirementActionRequest | null = null,
): RetirementActionManualReviewBlockedResult {
  const canonical = canonicalIssues(issues)
  const outcome = canonical.some((entry) =>
    entry.allocatorIssue?.reason?.outcome === 'unsupported' ||
    entry.kind === 'targetProvenanceUnsupported' ||
    entry.kind === 'targetKindUnsupported' ||
    entry.kind === 'reviewEvidenceCollision' ||
    entry.kind === 'replacementInvariantViolation')
    ? 'unsupported' as const
    : 'refused' as const
  return deepFreeze({
    status: 'blocked',
    outcome,
    target,
    replacement: null,
    plan: null,
    evidence: null,
    issues: canonical as [
      RetirementActionManualReviewIssue,
      ...RetirementActionManualReviewIssue[],
    ],
  })
}

function targetEvidence(
  target: RetirementActionRequest,
  originalPlanIndex: number,
): RetirementActionManualReviewTargetEvidence {
  return {
    actionId: target.actionId,
    kind: target.kind,
    provenanceSource: target.provenance.source as 'manual' | 'migration',
    provenance: target.provenance,
    year: target.year,
    requestedAmount: target.requestedAmount,
    originalPlanIndex,
    request: target,
  }
}

function actionAllocationIds(action: RetirementActionRequest): string[] {
  if (action.kind === 'qcd') {
    return [action.allocation.allocationId]
  }
  return action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion'
    ? action.allocations.map((allocation) => allocation.allocationId)
    : []
}

type CompletePlanIdentityNamespace =
  | { status: 'reserved'; reserved: Set<string> }
  | { status: 'rejected'; rejection: RetirementActionManualReviewIssue }

/**
 * The Plan identity namespace, with the annual filing-source root consulted
 * through its canonical arbiter rather than indexed directly, so a duplicated
 * owner/year key or a shared source identifier rejects every affected record
 * here exactly as it does everywhere else the root is read. A rejected root
 * yields no namespace at all rather than the survivors' claims.
 *
 * The refusal is the allocator's own identity issue, reported the way every
 * other identity refusal reaches this contract: `allocatorBlocked` carrying the
 * root problem in `allocatorIssue`. A reader that introspects one site's
 * rejection can read this one the same way. Today the replacement Plan has
 * already parsed by the time this runs, and `planSchema` refuses a duplicated
 * root itself, so the rejected arm is unreachable through the public entry --
 * which is a reason for it to speak the contract, not an excuse to invent a
 * second vocabulary nothing else would understand.
 */
function completePlanIdentityNamespace(
  plan: Readonly<Plan>,
): CompletePlanIdentityNamespace {
  const reservation = reservePlanOwnedNonRothIraAnnualFilingSourceIdentifiers(plan)
  if (reservation.status === 'rejected') {
    const allocatorIssue = rejectedPlanFilingSourceRootIdentityIssue(reservation)
    return {
      status: 'rejected',
      rejection: issue(
        'allocatorBlocked',
        allocatorIssue.field,
        allocatorIssue.detail,
        allocatorIssue,
      ),
    }
  }
  const reserved = new Set(retirementActionPlanReservedIdentifiers(plan))
  for (const identifier of reservation.identifiers) reserved.add(identifier)
  return { status: 'reserved', reserved }
}

type ReviewedIdentityReferences = Pick<
  RetirementActionCandidateIdentityEvidence,
  'personId' | 'sourceAccountIds' | 'destinationRothAccountId'
>

interface ReviewedIdentityRecords {
  person: Plan['household']['people'][number]
  sourceAccounts: Plan['accounts']
  destinationRothAccount: Plan['accounts'][number] | null
}

function reviewedIdentityRecords(
  plan: Readonly<Plan>,
  references: Readonly<ReviewedIdentityReferences>,
): ReviewedIdentityRecords | null {
  const people = plan.household.people.filter(
    (entry) => entry.id === references.personId,
  )
  if (people.length !== 1) return null
  const sourceAccounts: Plan['accounts'] = []
  for (const sourceAccountId of references.sourceAccountIds) {
    const matches = plan.accounts.filter((account) => account.id === sourceAccountId)
    if (matches.length !== 1) return null
    sourceAccounts.push(matches[0]!)
  }
  const destinationMatches = references.destinationRothAccountId === null
    ? []
    : plan.accounts.filter(
        (account) => account.id === references.destinationRothAccountId,
      )
  if (references.destinationRothAccountId !== null && destinationMatches.length !== 1) {
    return null
  }
  const destinationRothAccount = references.destinationRothAccountId === null
    ? null
    : destinationMatches[0]!
  return {
    person: people[0]!,
    sourceAccounts,
    destinationRothAccount,
  }
}

function actionIdentityReferences(
  action: RetirementActionRequest,
): ReviewedIdentityReferences | null {
  if (action.kind === 'ordinaryWithdrawal' || action.kind === 'rothConversion') {
    return {
      personId: action.personId,
      sourceAccountIds: action.allocations.map((allocation) => allocation.sourceAccountId),
      destinationRothAccountId: action.kind === 'rothConversion'
        ? action.destinationRothAccountId
        : null,
    }
  }
  if (action.kind === 'qcd') {
    return {
      personId: action.donorPersonId,
      sourceAccountIds: [action.allocation.sourceAccountId],
      destinationRothAccountId: null,
    }
  }
  return null
}

function targetIdentitySemanticsIssue(
  target: RetirementActionRequest,
  records: ReviewedIdentityRecords,
): RetirementActionManualReviewIssue | null {
  const differentlyOwnedSource = records.sourceAccounts.find((account) =>
    account.ownerPersonId !== null && account.ownerPersonId !== records.person.id,
  )
  if (differentlyOwnedSource !== undefined) {
    return issue(
      'invalidInput',
      target.kind === 'qcd' ? 'target.allocation.sourceAccountId' : 'target.allocations',
      `Target source account "${differentlyOwnedSource.id}" is owned by a different person.`,
    )
  }
  if (
    target.kind === 'rothConversion' &&
    records.destinationRothAccount?.type !== 'roth'
  ) {
    return issue(
      'invalidInput',
      'target.destinationRothAccountId',
      'The target conversion destination must resolve to a Roth account.',
    )
  }
  if (
    records.destinationRothAccount !== null &&
    records.destinationRothAccount.ownerPersonId !== null &&
    records.destinationRothAccount.ownerPersonId !== records.person.id
  ) {
    return issue(
      'invalidInput',
      'target.destinationRothAccountId',
      `Target destination account "${records.destinationRothAccount.id}" is owned by a different person.`,
    )
  }
  return null
}

function replacementCrossRoleIdentifierIssues(
  target: RetirementActionRequest,
  replacement: OrdinaryWithdrawalRequest | RothConversionRequest,
): RetirementActionManualReviewIssue[] {
  const issues: RetirementActionManualReviewIssue[] = []
  const targetAllocationIds = new Set(actionAllocationIds(target))
  if (targetAllocationIds.has(replacement.actionId)) {
    issues.push(issue(
      'replacementIdentityCollision',
      'replacementIntent',
      `The replacement action ID reuses target allocation identifier "${replacement.actionId}".`,
    ))
  }
  for (const allocationId of actionAllocationIds(replacement)) {
    if (allocationId === target.actionId) {
      issues.push(issue(
        'replacementIdentityCollision',
        'replacementIntent',
        `The replacement allocation ID reuses target action identifier "${allocationId}".`,
      ))
    }
  }
  return issues
}

function referencesAction(
  action: RetirementActionRequest,
  targetActionId: ActionId,
): boolean {
  return (
    action.kind === 'rothConversion' &&
    action.taxFunding.kind === 'linkedWithdrawal' &&
    action.taxFunding.withdrawalActionId === targetActionId
  ) || (
    action.kind === 'ordinaryWithdrawal' &&
    action.purpose.kind === 'taxPayment' &&
    action.purpose.referenceId === targetActionId
  )
}

function hasLinkedActionDependency(action: RetirementActionRequest): boolean {
  return (
    action.kind === 'rothConversion' &&
    action.taxFunding.kind === 'linkedWithdrawal'
  ) || (
    action.kind === 'ordinaryWithdrawal' &&
    action.purpose.kind === 'taxPayment' &&
    action.purpose.referenceId !== undefined
  )
}

function expectedReplacementKind(
  target: RetirementActionRequest,
): 'ordinaryWithdrawal' | 'rothConversion' | null {
  if (target.kind === 'ordinaryWithdrawal' || target.kind === 'legacyAggregateWithdrawal') {
    return 'ordinaryWithdrawal'
  }
  if (target.kind === 'rothConversion' || target.kind === 'legacyAggregateRothConversion') {
    return 'rothConversion'
  }
  return null
}

function manualReviewRequired(
  plan: Readonly<Plan>,
  target: RetirementActionRequest & { kind: 'qcd' | 'legacyAggregateQcd' },
  originalPlanIndex: number,
): RetirementActionManualReviewRequiredResult {
  const parsedPlanId = planIdSchema.safeParse(plan.id)
  // The allocator's QCD arm exists and a named gift executes end to end, so the
  // reason a row stays here is a property of the *aggregate* kind, not a
  // missing arm: a migrated aggregate QCD carries none of the identity the
  // allocator requires, and there is no aggregate arm to give it any. A named
  // request is authored and removed directly and should never reach this
  // function; if one does, it is told where its edits actually live.
  //
  // The message and the published policy split on the same line, and both must:
  // the policy is serialized evidence a consumer reads without the message
  // beside it, so a named target carrying the aggregate policy would assert a
  // missing allocator arm that is not missing.
  const issues: [
    RetirementActionManualReviewIssue,
    ...RetirementActionManualReviewIssue[],
  ] = [issue(
    'targetKindUnsupported',
    'targetActionId',
    target.kind === 'legacyAggregateQcd'
      ? 'A migrated aggregate QCD carries no donor, source IRA, execution date, or charity evidence, and the identity allocator has no aggregate arm, so this row stays under review and moves nothing.'
      : 'A named QCD is scheduled and removed directly; it does not go through migrated-row replacement.',
  )]
  if (!parsedPlanId.success) {
    issues.unshift(issue(
      'invalidInput',
      'plan.id',
      'The Plan must have a nonblank stable ID before manual review evidence can be created.',
    ))
  }
  return deepFreeze({
    status: 'manualReviewRequired',
    outcome: 'unsupported',
    target,
    replacement: null,
    plan: null,
    evidence: {
      policy: target.kind === 'legacyAggregateQcd'
        ? 'explicitManualReviewRequiredNoCanonicalAllocatorArm'
        : 'explicitNoReplacementNamedQcdUsesCanonicalAllocatorArm',
      planId: parsedPlanId.success ? parsedPlanId.data : null,
      target: targetEvidence(target, originalPlanIndex),
      targetOmittedBeforeAllocation: false,
      inferredFields: [],
      unsupportedKind: target.kind,
    },
    issues,
  })
}

function reviewUnchecked(
  input: RetirementActionManualReviewInput,
): RetirementActionManualReviewResult {
  const rawInput = record(input)
  if (rawInput === null) {
    return blocked([issue('invalidInput', '$', 'Manual review input must be an object.')])
  }
  const unexpectedKeys = Object.keys(rawInput)
    .filter((key) => !['plan', 'targetActionId', 'replacementIntent'].includes(key))
    .sort(compareUtf16CodeUnits)
  if (unexpectedKeys.length > 0) {
    return blocked(unexpectedKeys.map((key) => issue(
      'invalidInput',
      key,
      `Unexpected manual-review field "${key}" is not accepted.`,
    )))
  }

  const parsedTargetActionId = actionIdSchema.safeParse(rawInput['targetActionId'])
  if (!parsedTargetActionId.success) {
    return blocked([issue(
      'invalidInput',
      'targetActionId',
      'A nonblank stable target action ID is required.',
    )])
  }
  const targetActionId = parsedTargetActionId.data
  const rawPlan = record(rawInput['plan'])
  const rawStrategies = record(rawPlan?.['strategies'])
  const rawActions = rawStrategies?.['retirementActions']
  if (!Array.isArray(rawActions)) {
    return blocked([issue(
      'invalidInput',
      'plan.strategies.retirementActions',
      'The Plan retirement-action schedule is unavailable.',
    )])
  }
  for (let index = 0; index < rawActions.length; index += 1) {
    if (!Object.hasOwn(rawActions, index)) {
      return blocked([issue(
        'invalidInput',
        `plan.strategies.retirementActions.${index}`,
        'The Plan retirement-action schedule must not contain empty array slots.',
      )])
    }
  }
  const targetIndexes: number[] = []
  for (let index = 0; index < rawActions.length; index += 1) {
    if (record(rawActions[index])?.['actionId'] === targetActionId) targetIndexes.push(index)
  }
  if (targetIndexes.length === 0) {
    return blocked([issue(
      'targetMissing',
      'targetActionId',
      'The target action ID does not exist in the Plan schedule.',
    )])
  }
  if (targetIndexes.length !== 1) {
    return blocked([issue(
      'targetAmbiguous',
      'targetActionId',
      'The target action ID is duplicated in the Plan schedule.',
    )])
  }
  const targetIndex = targetIndexes[0]!
  const parsedTarget = persistedRetirementActionRequestSchema.safeParse(
    rawActions[targetIndex],
  )
  if (!parsedTarget.success) {
    return blocked([issue(
      'invalidInput',
      `plan.strategies.retirementActions.${targetIndex}`,
      'The target action does not satisfy the retirement-action contract.',
    )])
  }
  const target = parsedTarget.data
  if (target.provenance.source !== 'manual' && target.provenance.source !== 'migration') {
    return blocked([issue(
      'targetProvenanceUnsupported',
      'target.provenance.source',
      'Only migrated aggregate or explicitly manual actions can enter manual replacement review.',
    )], target)
  }
  if (target.kind === 'qcd' || target.kind === 'legacyAggregateQcd') {
    return manualReviewRequired(input.plan, target, targetIndex)
  }

  const targetReferences = actionIdentityReferences(target)
  const originalTargetIdentityRecords = targetReferences === null
    ? null
    : reviewedIdentityRecords(input.plan, targetReferences)
  if (targetReferences !== null && originalTargetIdentityRecords === null) {
    return blocked([issue(
      'invalidInput',
      'target',
      'The target action identity references must resolve uniquely in the Plan.',
    )], target)
  }
  if (originalTargetIdentityRecords !== null) {
    const semanticsIssue = targetIdentitySemanticsIssue(
      target,
      originalTargetIdentityRecords,
    )
    if (semanticsIssue !== null) return blocked([semanticsIssue], target)
  }

  const replacement = record(rawInput['replacementIntent'])
  if (replacement === null) {
    return blocked([issue(
      'replacementMissing',
      'replacementIntent',
      'A complete explicit manual replacement intent is required.',
    )], target)
  }
  if (record(replacement['provenance'])?.['source'] !== 'manual') {
    return blocked([issue(
      'replacementProvenanceInvalid',
      'replacementIntent.provenance.source',
      'Manual review must produce manual provenance; migration, generator, and optimizer provenance cannot be promoted.',
    )], target)
  }

  const expectedKind = expectedReplacementKind(target)
  const reviewIssues: RetirementActionManualReviewIssue[] = []
  const targetHasLinkedActionDependency = hasLinkedActionDependency(target)
  if (targetHasLinkedActionDependency) {
    reviewIssues.push(issue(
      'dependentActionReference',
      `plan.strategies.retirementActions.${targetIndex}`,
      'The target references another action; replacing one side would erase or mismatch the linked action group.',
    ))
  }
  if (replacement['kind'] !== expectedKind) {
    reviewIssues.push(issue(
      'replacementKindMismatch',
      'replacementIntent.kind',
      `The replacement must preserve the target action family as ${expectedKind}.`,
    ))
  }
  if (replacement['year'] !== target.year) {
    reviewIssues.push(issue(
      'replacementYearMismatch',
      'replacementIntent.year',
      'Manual review must preserve the target action year explicitly.',
    ))
  }
  if (replacement['requestedAmount'] !== target.requestedAmount) {
    reviewIssues.push(issue(
      'replacementAmountMismatch',
      'replacementIntent.requestedAmount',
      'Manual review must preserve the target exact-cent requested amount explicitly.',
    ))
  }

  const parsedActions: RetirementActionRequest[] = []
  for (let index = 0; index < rawActions.length; index += 1) {
    if (index === targetIndex) continue
    const parsed = persistedRetirementActionRequestSchema.safeParse(rawActions[index])
    if (!parsed.success) {
      reviewIssues.push(issue(
        'invalidInput',
        `plan.strategies.retirementActions.${index}`,
        'A non-target action does not satisfy the retirement-action contract.',
      ))
      continue
    }
    parsedActions.push(parsed.data)
    if (!targetHasLinkedActionDependency && referencesAction(parsed.data, targetActionId)) {
      reviewIssues.push(issue(
        'dependentActionReference',
        `plan.strategies.retirementActions.${index}`,
        'Another action references the target; replacing one side would leave a dangling or mismatched action group.',
      ))
    }
  }
  if (reviewIssues.length > 0) return blocked(reviewIssues, target)

  const stablePlanId = planIdSchema.safeParse(input.plan.id)
  if (!stablePlanId.success) {
    return blocked([issue(
      'invalidInput',
      'plan.id',
      'The Plan must have a nonblank stable ID before manual review evidence can be created.',
    )], target)
  }

  const planWithoutTarget: Plan = {
    ...(input.plan as Plan),
    strategies: {
      ...input.plan.strategies,
      retirementActions: parsedActions,
    },
  }
  const allocated = allocateRetirementActionCandidateIdentity(
    planWithoutTarget,
    replacement as unknown as RetirementActionCandidateIdentityIntent,
  )
  if (allocated.status === 'blocked') {
    return blocked(allocated.issues.map((allocatorIssue) => issue(
      'allocatorBlocked',
      `replacementIntent.${allocatorIssue.field}`,
      allocatorIssue.detail,
      allocatorIssue,
    )), target)
  }

  const allocatedRequest = allocated.request
  if (
    allocatedRequest.provenance.source !== 'manual' ||
    allocatedRequest.kind !== expectedKind ||
    allocatedRequest.year !== target.year ||
    allocatedRequest.requestedAmount !== target.requestedAmount
  ) {
    return blocked([issue(
      'replacementInvariantViolation',
      'replacementIntent',
      'Canonical allocation did not preserve the reviewed manual action invariants.',
    )], target)
  }
  if (hasLinkedActionDependency(allocatedRequest)) {
    return blocked([issue(
      'dependentActionReference',
      allocatedRequest.kind === 'ordinaryWithdrawal'
        ? 'replacementIntent.purpose.referenceId'
        : 'replacementIntent.taxFunding.withdrawalActionId',
      'A single-action replacement cannot introduce or retain a linked-action dependency; coordinated pairs must be allocated and validated together.',
    )], target)
  }
  const replacementIdentifierIssues = replacementCrossRoleIdentifierIssues(
    target,
    allocatedRequest,
  )
  if (replacementIdentifierIssues.length > 0) {
    return blocked(replacementIdentifierIssues, target)
  }

  const replacementActions = [...parsedActions]
  replacementActions.splice(targetIndex, 0, allocatedRequest)
  const replacementPlanResult = planSchema.safeParse({
    ...planWithoutTarget,
    strategies: {
      ...planWithoutTarget.strategies,
      retirementActions: replacementActions,
    },
  })
  if (!replacementPlanResult.success) {
    return blocked([issue(
      'replacementPlanInvalid',
      'plan',
      replacementPlanResult.error.issues
        .map((entry) => `${entry.path.join('.') || '$'}: ${entry.message}`)
        .join('; '),
    )], target)
  }
  const parsedPlanId = planIdSchema.safeParse(replacementPlanResult.data.id)
  if (!parsedPlanId.success) {
    return blocked([issue(
      'invalidInput',
      'plan.id',
      'The Plan must have a nonblank stable ID before manual review evidence can be created.',
    )], target)
  }
  const preservedActionIds = parsedActions.map((action) => action.actionId)
  const reviewedTargetEvidence = targetEvidence(target, targetIndex)
  const replacementIdentityRecords = reviewedIdentityRecords(
    replacementPlanResult.data,
    allocated.evidence,
  )
  if (replacementIdentityRecords === null) {
    return blocked([issue(
      'replacementInvariantViolation',
      'replacementIntent',
      'Canonical allocation evidence did not resolve to unique reviewed identity records.',
    )], target)
  }
  const targetIdentityRecords = targetReferences === null
    ? null
    : reviewedIdentityRecords(replacementPlanResult.data, targetReferences)
  if (targetReferences !== null && targetIdentityRecords === null) {
    return blocked([issue(
      'invalidInput',
      'target',
      'The target action identity references must resolve uniquely in the Plan.',
    )], target)
  }
  const preservedIdentityRecords: Array<ReviewedIdentityRecords | null> = []
  for (const action of parsedActions) {
    const references = actionIdentityReferences(action)
    const records = references === null
      ? null
      : reviewedIdentityRecords(replacementPlanResult.data, references)
    if (references !== null && records === null) {
      return blocked([issue(
        'replacementInvariantViolation',
        'plan.strategies.retirementActions',
        'A preserved action did not resolve to unique reviewed identity records.',
      )], target)
    }
    preservedIdentityRecords.push(records)
  }
  const reviewEvidenceId = deriveActionStructuralId('retirement-action-manual-review', [
    normalizeOptionalUndefinedFields({
      planId: parsedPlanId.data,
      target: reviewedTargetEvidence,
      replacement: allocatedRequest,
      preservedActions: parsedActions,
      allocatorEvidence: allocated.evidence,
      identityRecords: {
        replacement: replacementIdentityRecords,
        target: targetIdentityRecords,
        preserved: preservedIdentityRecords,
      },
    }),
  ])
  const namespace = completePlanIdentityNamespace(replacementPlanResult.data)
  if (namespace.status === 'rejected') return blocked([namespace.rejection], target)
  const reservedIdentifiers = namespace.reserved
  reservedIdentifiers.add(target.actionId)
  for (const allocationId of actionAllocationIds(target)) reservedIdentifiers.add(allocationId)
  if (reservedIdentifiers.has(reviewEvidenceId)) {
    return blocked([issue(
      'reviewEvidenceCollision',
      'evidence.evidenceId',
      'The deterministic manual-review evidence ID collides with an existing Plan identifier.',
    )], target)
  }
  const reviewEvidence: RetirementActionManualReviewReplacementEvidence = {
    policy: 'explicitManualIntentOmitTargetThenCanonicalAllocate',
    evidenceId: reviewEvidenceId,
    planId: parsedPlanId.data,
    target: reviewedTargetEvidence,
    targetOmittedBeforeAllocation: true,
    inferredFields: [],
    replacementActionId: allocatedRequest.actionId,
    replacementProvenance: allocatedRequest.provenance,
    preservedActionIds,
    allocatorEvidence: allocated.evidence,
  }
  return deepFreeze({
    status: 'replacementReady',
    outcome: 'accepted',
    target,
    replacement: allocatedRequest,
    plan: replacementPlanResult.data,
    evidence: reviewEvidence,
  })
}

/**
 * Review one migrated/manual action and replace it only from a complete manual
 * intent allocated against a Plan snapshot where the target has already been
 * omitted. No owner, source, destination, date, amount, or provenance is
 * copied into the intent or inferred from Plan order/category.
 */
export function reviewAndReplaceRetirementActionManually(
  input: RetirementActionManualReviewInput,
): RetirementActionManualReviewResult {
  try {
    const snapshot = structuredClone(input) as RetirementActionManualReviewInput
    return reviewUnchecked(snapshot)
  } catch {
    return blocked([issue(
      'invalidInput',
      '$',
      'Manual review input could not be inspected losslessly.',
    )])
  }
}
