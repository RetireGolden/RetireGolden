import {
  retirementActionRequestSchema,
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
  allocateRetirementActionCandidateIdentity,
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
import { planOwnedNonRothIraAnnualFilingSourceIdentifierClaims } from
  '../model/retirementActionAnnualTaxFacts.js'

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
  | 'reviewEvidenceCollision'
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
  year: number
  requestedAmount: PositiveUsdCents
  originalPlanIndex: number
}

export interface RetirementActionManualReviewReplacementEvidence {
  policy: 'explicitManualIntentOmitTargetThenCanonicalAllocate'
  evidenceId: string
  planId: PlanId
  target: Readonly<RetirementActionManualReviewTargetEvidence>
  targetOmittedBeforeAllocation: true
  inferredFields: readonly []
  replacementActionId: ActionId
  preservedActionIds: readonly ActionId[]
  allocatorEvidence: Readonly<RetirementActionCandidateIdentityEvidence>
}

export interface RetirementActionManualReviewRequiredEvidence {
  policy: 'explicitManualReviewRequiredNoCanonicalAllocatorArm'
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

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
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
  const keyed = new Map<string, RetirementActionManualReviewIssue>()
  for (const entry of issues) {
    keyed.set(JSON.stringify([entry.kind, entry.field, entry.detail]), entry)
  }
  return [...keyed.entries()]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([, entry]) => entry)
}

function blocked(
  issues: readonly RetirementActionManualReviewIssue[],
  target: RetirementActionRequest | null = null,
): RetirementActionManualReviewBlockedResult {
  const canonical = canonicalIssues(issues)
  const outcome = canonical.some((entry) =>
    entry.kind === 'allocatorBlocked' ||
    entry.kind === 'targetKindUnsupported' ||
    entry.kind === 'replacementProvenanceInvalid' ||
    entry.kind === 'reviewEvidenceCollision' ||
    entry.kind === 'replacementPlanInvalid')
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
    year: target.year,
    requestedAmount: target.requestedAmount,
    originalPlanIndex,
  }
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
    action.purpose.referenceId === targetActionId
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
  return deepFreeze({
    status: 'manualReviewRequired',
    outcome: 'unsupported',
    target,
    replacement: null,
    plan: null,
    evidence: {
      policy: 'explicitManualReviewRequiredNoCanonicalAllocatorArm',
      planId: parsedPlanId.success ? parsedPlanId.data : null,
      target: targetEvidence(target, originalPlanIndex),
      targetOmittedBeforeAllocation: false,
      inferredFields: [],
      unsupportedKind: target.kind,
    },
    issues: [issue(
      'targetKindUnsupported',
      'targetActionId',
      'QCD review remains explicit and non-mutating until the canonical identity allocator exposes a QCD arm.',
    )],
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
  const targetIndexes = rawActions.flatMap((action, index) =>
    record(action)?.['actionId'] === targetActionId ? [index] : [],
  )
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
  const parsedTarget = retirementActionRequestSchema.safeParse(rawActions[targetIndex])
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
  rawActions.forEach((action, index) => {
    if (index === targetIndex) return
    const parsed = retirementActionRequestSchema.safeParse(action)
    if (!parsed.success) {
      reviewIssues.push(issue(
        'invalidInput',
        `plan.strategies.retirementActions.${index}`,
        'A non-target action does not satisfy the retirement-action contract.',
      ))
      return
    }
    parsedActions.push(parsed.data)
    if (referencesAction(parsed.data, targetActionId)) {
      reviewIssues.push(issue(
        'dependentActionReference',
        `plan.strategies.retirementActions.${index}`,
        'Another action references the target; replacing one side would leave a dangling or mismatched action group.',
      ))
    }
  })
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
      'replacementPlanInvalid',
      'replacementIntent',
      'Canonical allocation did not preserve the reviewed manual action invariants.',
    )], target)
  }
  if (
    allocatedRequest.kind === 'ordinaryWithdrawal' &&
    allocatedRequest.purpose.referenceId === targetActionId
  ) {
    return blocked([issue(
      'dependentActionReference',
      'replacementIntent.purpose.referenceId',
      'The replacement cannot retain a purpose reference to the omitted target action.',
    )], target)
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
  const reviewEvidenceId = deriveActionStructuralId('retirement-action-manual-review', [{
    planId: parsedPlanId.data,
    targetActionId,
    replacementActionId: allocatedRequest.actionId,
    preservedActionIds,
    allocatorEvidence: allocated.evidence,
  }])
  const reservedIdentifiers = new Set(
    retirementActionPlanReservedIdentifiers(replacementPlanResult.data),
  )
  reservedIdentifiers.add(targetActionId)
  for (const sourceRecord of (
    replacementPlanResult.data.retirementActionAnnualTaxFacts
      ?.ownedNonRothIraAnnualFilingSourceRecords ?? []
  )) {
    for (const claim of planOwnedNonRothIraAnnualFilingSourceIdentifierClaims(sourceRecord)) {
      reservedIdentifiers.add(claim.value)
    }
  }
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
    target: targetEvidence(target, targetIndex),
    targetOmittedBeforeAllocation: true,
    inferredFields: [],
    replacementActionId: allocatedRequest.actionId,
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
