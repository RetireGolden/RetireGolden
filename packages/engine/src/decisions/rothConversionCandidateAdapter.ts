import { parseCivilIsoDate } from '../actions/civilDate.js'
import type { RothConversionRequest } from '../actions/contract.js'
import {
  allocateRetirementActionCandidateIdentity,
  type RetirementActionCandidateIdentityEvidence,
  type RetirementActionCandidateIdentityIssue,
  type RothConversionCandidateIdentityIntent,
} from '../actions/retirementActionCandidateIdentityAllocator.js'
import { deriveActionStructuralId } from '../actions/structuralId.js'
import type { Plan } from '../model/plan.js'
import { applyScenarioPatch } from '../scenarios/scenarios.js'
import {
  inspectCompleteRetirementActionCandidateSchedule,
  type CurrentRetirementActionCandidateRequest,
  type RetirementActionCandidateScheduleIssue,
} from './retirementActionCandidateSchedule.js'
import type { DecisionCandidate } from './types.js'

const EXPLORATORY_REASON =
  'This aggregate strategy does not yet identify legal owners, source accounts, and destination accounts.'

type UnknownRecord = Record<string, unknown>

export interface FillTargetRothConversionCandidateIssue {
  kind: 'invalidExploratoryCandidate' | 'invalidConversionIntent'
  field: string
  reason: null
  detail: string
}

export type FillTargetRothConversionCandidateAdapterIssue =
  | FillTargetRothConversionCandidateIssue
  | RetirementActionCandidateIdentityIssue
  | RetirementActionCandidateScheduleIssue

export type AdaptedFillTargetRothConversionCandidate = Readonly<{
  status: 'adapted'
  candidate: DecisionCandidate
  exploratorySourceProvenance: FillTargetRothConversionExploratorySourceProvenance
  identityEvidence: readonly RetirementActionCandidateIdentityEvidence[]
}>

export type BlockedFillTargetRothConversionCandidate = Readonly<{
  status: 'blocked'
  candidate: null
  issues: readonly [
    FillTargetRothConversionCandidateAdapterIssue,
    ...FillTargetRothConversionCandidateAdapterIssue[],
  ]
}>

export type FillTargetRothConversionCandidateAdaptationResult =
  | AdaptedFillTargetRothConversionCandidate
  | BlockedFillTargetRothConversionCandidate

type FillTargetStrategy = Readonly<{
  mode: 'fillToTarget'
  target: 'topOfBracket' | 'irmaaTier' | 'acaCliff'
  targetValue: number | null
  startYear: number
  endYear: number
}>

export interface FillTargetRothConversionExploratorySourceProvenance {
  generatorId: 'roth-fill-to-target'
  exploratoryCandidateId: string
  source: 'heuristic'
  category: 'roth' | 'tax-cliff'
  relationship: 'callerSuppliedExplicitScheduleAfterExploration'
  /** Exploratory context only; it does not certify the caller-supplied amounts. */
  strategyContext: FillTargetStrategy
  metadataContext: Record<string, unknown> | null
}

function record(value: unknown): UnknownRecord | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as UnknownRecord
    : null
}

function hasExactKeys(value: UnknownRecord, keys: readonly string[]): boolean {
  const actual = Object.keys(value).sort()
  const expected = [...keys].sort()
  return actual.length === expected.length &&
    actual.every((key, index) => key === expected[index])
}

function issue(
  kind: FillTargetRothConversionCandidateIssue['kind'],
  field: string,
  detail: string,
): BlockedFillTargetRothConversionCandidate {
  return {
    status: 'blocked',
    candidate: null,
    issues: [{ kind, field, reason: null, detail }],
  }
}

function canonicalGeneratorDisplayMatches(
  id: string,
  targetValue: number | null,
  endYear: number,
  label: string,
  explanation: string,
): boolean {
  if (id === 'irmaa-tier-1-cap') {
    return label === 'Convert up to the first IRMAA tier' &&
      explanation === 'Roth conversions each year up to the first irmaa tier, evaluated on the exact ledger.'
  }
  if (id === 'aca-cliff-cap') {
    return label === 'Convert up to the ACA cliff' &&
      explanation === 'Roth conversions each year up to the aca cliff, evaluated on the exact ledger.'
  }
  if (targetValue === null) return false
  if (id === `bracket-${targetValue}`) {
    return label === `Fill the ${targetValue}% bracket` &&
      explanation === `Roth conversions each year up to the ${targetValue}% bracket, evaluated on the exact ledger.`
  }

  const boundaryYear = endYear + 1
  const canonicalLabels = new Set([
    `Fill the ${targetValue}% bracket while cash and taxable cover spending (through ${endYear})`,
    `Fill the ${targetValue}% bracket until Social Security starts (${boundaryYear})`,
    `Fill the ${targetValue}% bracket until RMDs begin (${boundaryYear})`,
  ])
  return canonicalLabels.has(label) &&
    explanation === `Roth conversions up to the ${targetValue}% bracket in each year before ${boundaryYear}, evaluated on the exact ledger.`
}

function exactGeneratorFillTarget(
  candidate: Readonly<DecisionCandidate>,
): FillTargetStrategy | BlockedFillTargetRothConversionCandidate {
  try {
    const candidateRecord = record(candidate)
    if (candidateRecord === null) {
      return issue(
        'invalidExploratoryCandidate',
        '$',
        'The exploratory candidate must be an inspectable decision-candidate object.',
      )
    }
    const allowedCandidateKeys = [
      'id',
      'source',
      'category',
      'label',
      'explanation',
      'planPatch',
      'retirementActionReadiness',
      ...(candidateRecord['metadata'] === undefined ? [] : ['metadata']),
    ]
    if (!hasExactKeys(candidateRecord, allowedCandidateKeys)) {
      return issue(
        'invalidExploratoryCandidate',
        '$',
        'Only the exact fill-to-target generator candidate shape can be adapted.',
      )
    }
    if (
      candidateRecord['source'] !== 'heuristic' ||
      (candidateRecord['category'] !== 'roth' && candidateRecord['category'] !== 'tax-cliff') ||
      typeof candidateRecord['id'] !== 'string' ||
      candidateRecord['id'].trim().length === 0 ||
      typeof candidateRecord['label'] !== 'string' ||
      typeof candidateRecord['explanation'] !== 'string'
    ) {
      return issue(
        'invalidExploratoryCandidate',
        '$',
        'The candidate does not carry the generator identity, category, and display provenance required by the fill-to-target adapter.',
      )
    }

    const readiness = record(candidateRecord['retirementActionReadiness'])
    if (
      readiness === null ||
      !hasExactKeys(readiness, ['state', 'reason']) ||
      readiness['state'] !== 'exploratoryNonActionable' ||
      readiness['reason'] !== EXPLORATORY_REASON
    ) {
      return issue(
        'invalidExploratoryCandidate',
        'retirementActionReadiness',
        'The candidate must carry the exact exploratory readiness emitted by the fill-to-target generator.',
      )
    }

    const patch = record(candidateRecord['planPatch'])
    const strategies = record(patch?.['strategies'])
    const strategy = record(strategies?.['rothConversion'])
    if (
      patch === null ||
      !hasExactKeys(patch, ['strategies']) ||
      strategies === null ||
      !hasExactKeys(strategies, ['rothConversion']) ||
      strategy === null ||
      !hasExactKeys(strategy, [
        'mode',
        'target',
        'targetValue',
        'startYear',
        'endYear',
      ]) ||
      strategy['mode'] !== 'fillToTarget' ||
      !Number.isSafeInteger(strategy['startYear']) ||
      !Number.isSafeInteger(strategy['endYear']) ||
      (strategy['startYear'] as number) < 1 ||
      (strategy['endYear'] as number) < (strategy['startYear'] as number)
    ) {
      return issue(
        'invalidExploratoryCandidate',
        'planPatch.strategies.rothConversion',
        'The candidate must contain only one complete fill-to-target Roth strategy patch.',
      )
    }

    const id = candidateRecord['id'] as string
    const target = strategy['target']
    const targetValue = strategy['targetValue']
    const category = candidateRecord['category']
    const endYear = strategy['endYear'] as number
    const exactTarget =
      target === 'topOfBracket' &&
        [10, 12, 22, 24].includes(targetValue as number) &&
        category === 'roth' &&
        (id === `bracket-${targetValue}` ||
          ([12, 22, 24].includes(targetValue as number) &&
            id === `bracket-${targetValue}-until-${endYear + 1}`)) ||
      target === 'irmaaTier' &&
        targetValue === 1 &&
        category === 'tax-cliff' &&
        id === 'irmaa-tier-1-cap' ||
      target === 'acaCliff' &&
        targetValue === null &&
        category === 'tax-cliff' &&
        id === 'aca-cliff-cap'
    if (!exactTarget) {
      return issue(
        'invalidExploratoryCandidate',
        'planPatch.strategies.rothConversion.target',
        'The fill target, category, candidate ID, and target value do not match a simple Roth conversion generator candidate.',
      )
    }
    if (!canonicalGeneratorDisplayMatches(
      id,
      targetValue as number | null,
      endYear,
      candidateRecord['label'] as string,
      candidateRecord['explanation'] as string,
    )) {
      return issue(
        'invalidExploratoryCandidate',
        'label',
        'The candidate display provenance does not exactly match the simple Roth conversion generator output.',
      )
    }

    return strategy as unknown as FillTargetStrategy
  } catch {
    return issue(
      'invalidExploratoryCandidate',
      '$',
      'The exploratory candidate could not be inspected losslessly.',
    )
  }
}

function validateDatedIntent(
  intent: RothConversionCandidateIdentityIntent,
  candidateId: string,
  strategy: FillTargetStrategy,
  index: number,
): BlockedFillTargetRothConversionCandidate | null {
  try {
    const intentRecord = record(intent)
    const date = typeof intentRecord?.['executionDate'] === 'string'
      ? parseCivilIsoDate(intentRecord['executionDate'])
      : null
    if (
      intentRecord === null ||
      intentRecord['kind'] !== 'rothConversion' ||
      date === null ||
      date.year !== intentRecord['year']
    ) {
      return issue(
        'invalidConversionIntent',
        `intents.${index}.executionDate`,
        'Every conversion intent requires an explicit canonical execution date in its action year.',
      )
    }
    if (
      !Number.isSafeInteger(intentRecord['year']) ||
      (intentRecord['year'] as number) < strategy.startYear ||
      (intentRecord['year'] as number) > strategy.endYear
    ) {
      return issue(
        'invalidConversionIntent',
        `intents.${index}.year`,
        'Every conversion intent must fall inside the exploratory fill-target window.',
      )
    }
    const provenance = record(intentRecord['provenance'])
    if (
      provenance === null ||
      provenance['source'] !== 'generator' ||
      provenance['sourceId'] !== candidateId
    ) {
      return issue(
        'invalidConversionIntent',
        `intents.${index}.provenance`,
        'Every conversion intent must preserve generator provenance whose source ID exactly matches the exploratory candidate ID.',
      )
    }
    const taxFunding = record(intentRecord['taxFunding'])
    if (
      taxFunding === null ||
      (taxFunding['kind'] !== 'noneExpected' && taxFunding['kind'] !== 'externalCash')
    ) {
      return issue(
        'invalidConversionIntent',
        `intents.${index}.taxFunding`,
        'Fill-target adaptation supports only no-tax-expected or explicit external-cash funding; linked withdrawals and principal withholding require coordinated action allocation.',
      )
    }
    return null
  } catch {
    return issue(
      'invalidConversionIntent',
      `intents.${index}`,
      'The conversion intent could not be inspected losslessly.',
    )
  }
}

function compareUtf16(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function compareAllocatedRequests(
  left: { request: RothConversionRequest },
  right: { request: RothConversionRequest },
): number {
  return left.request.year - right.request.year ||
    compareUtf16(left.request.executionDate!, right.request.executionDate!) ||
    left.request.executionSequence - right.request.executionSequence ||
    compareUtf16(left.request.actionId, right.request.actionId)
}

function adaptedCandidateId(
  exploratoryCandidateId: string,
  allocations: readonly { request: RothConversionRequest }[],
): string {
  const requests = allocations
    .map((allocation) => allocation.request)
    .sort((left, right) => compareUtf16(left.actionId, right.actionId))
  return deriveActionStructuralId('retirement-action-fill-target-candidate', [
    exploratoryCandidateId,
    requests,
  ])
}

function executionSlotConflict(
  actions: readonly CurrentRetirementActionCandidateRequest[],
): { index: number; firstIndex: number; scheduleGroup: string; sequence: number } | null {
  const slotIndexes = new Map<string, number>()
  for (const [index, action] of actions.entries()) {
    const scheduleGroup = action.executionDate === undefined
      ? `undated:${action.year}`
      : `dated:${action.executionDate}`
    const key = JSON.stringify([scheduleGroup, action.executionSequence])
    const firstIndex = slotIndexes.get(key)
    if (firstIndex !== undefined) {
      return { index, firstIndex, scheduleGroup, sequence: action.executionSequence }
    }
    slotIndexes.set(key, index)
  }
  return null
}

/**
 * Replace one exact exploratory fill-to-target candidate with an explicit,
 * identity-complete conversion schedule. No date, owner, source, destination,
 * funding identity, or cent amount is inferred by this adapter.
 */
export function adaptFillTargetRothConversionGeneratorCandidate(
  plan: Readonly<Plan>,
  exploratoryCandidate: Readonly<DecisionCandidate>,
  intents: readonly [
    RothConversionCandidateIdentityIntent,
    ...RothConversionCandidateIdentityIntent[],
  ],
): FillTargetRothConversionCandidateAdaptationResult {
  let planSnapshot: Readonly<Plan>
  let candidateSnapshot: Readonly<DecisionCandidate>
  let intentSnapshot: readonly RothConversionCandidateIdentityIntent[]
  try {
    planSnapshot = structuredClone(plan)
  } catch {
    return issue(
      'invalidConversionIntent',
      'plan',
      'The Plan could not be snapshotted into stable plain data.',
    )
  }
  try {
    candidateSnapshot = structuredClone(exploratoryCandidate)
  } catch {
    return issue(
      'invalidExploratoryCandidate',
      '$',
      'The exploratory candidate could not be snapshotted into stable plain data.',
    )
  }
  try {
    intentSnapshot = structuredClone(intents)
  } catch {
    return issue(
      'invalidConversionIntent',
      'intents',
      'The conversion-intent schedule could not be snapshotted into stable plain data.',
    )
  }

  const strategy = exactGeneratorFillTarget(candidateSnapshot)
  if ('status' in strategy) return strategy

  let schedule: ReturnType<typeof inspectCompleteRetirementActionCandidateSchedule>
  try {
    schedule = inspectCompleteRetirementActionCandidateSchedule(
      (planSnapshot as Plan | null | undefined)?.strategies?.retirementActions,
    )
  } catch {
    return issue(
      'invalidConversionIntent',
      'intents',
      'The conversion-intent schedule could not be inspected losslessly.',
    )
  }
  if (!schedule.ok) {
    return { status: 'blocked', candidate: null, issues: [schedule.issue] }
  }
  if (intentSnapshot.length === 0) {
    return issue(
      'invalidConversionIntent',
      'intents',
      'At least one explicit conversion intent is required.',
    )
  }

  const rollingRetirementActions = [...schedule.actions]
  const allocatedRequests: Array<{
    request: RothConversionRequest
    evidence: RetirementActionCandidateIdentityEvidence
  }> = []
  let rollingPlan: Readonly<Plan> = planSnapshot
  for (const [index, intent] of intentSnapshot.entries()) {
    const invalidIntent = validateDatedIntent(
      intent,
      candidateSnapshot.id,
      strategy,
      index,
    )
    if (invalidIntent !== null) return invalidIntent

    let allocation: ReturnType<typeof allocateRetirementActionCandidateIdentity>
    try {
      allocation = allocateRetirementActionCandidateIdentity(rollingPlan, intent)
    } catch {
      return issue(
        'invalidConversionIntent',
        `intents.${index}`,
        'The Plan or conversion intent could not be inspected by the identity allocator.',
      )
    }
    if (allocation.status === 'blocked') {
      return {
        status: 'blocked',
        candidate: null,
        issues: allocation.issues.map((entry) => ({
          ...entry,
          field: `intents.${index}.${entry.field}`,
        })) as [
          RetirementActionCandidateIdentityIssue,
          ...RetirementActionCandidateIdentityIssue[],
        ],
      }
    }
    if (allocation.request.kind !== 'rothConversion') {
      return issue(
        'invalidConversionIntent',
        `intents.${index}.kind`,
        'The Roth conversion adapter received a non-conversion allocator result.',
      )
    }

    const request: RothConversionRequest = allocation.request
    rollingRetirementActions.push(request)
    allocatedRequests.push({ request, evidence: allocation.evidence })
    rollingPlan = {
      ...rollingPlan,
      strategies: {
        ...rollingPlan.strategies,
        retirementActions: rollingRetirementActions,
      },
    }
  }

  allocatedRequests.sort(compareAllocatedRequests)
  const retirementActions = [
    ...schedule.actions,
    ...allocatedRequests.map((allocation) => allocation.request),
  ]
  const conflict = executionSlotConflict(retirementActions)
  if (conflict !== null) {
    return issue(
      'invalidConversionIntent',
      `plan.strategies.retirementActions.${conflict.index}.executionSequence`,
      `Execution group ${conflict.scheduleGroup} and sequence ${conflict.sequence} are already used by action index ${conflict.firstIndex}; the adapter will not invent a replacement sequence.`,
    )
  }

  let concreteCandidateId: string
  try {
    concreteCandidateId = adaptedCandidateId(
      candidateSnapshot.id,
      allocatedRequests,
    )
  } catch {
    return issue(
      'invalidConversionIntent',
      'intents',
      'The explicit conversion action identities could not produce a stable adapted candidate ID.',
    )
  }

  const candidate: DecisionCandidate = {
    id: concreteCandidateId,
    source: candidateSnapshot.source,
    category: candidateSnapshot.category,
    label: `Explicit schedule after exploring: ${candidateSnapshot.label}`,
    explanation:
      `Caller-supplied dated conversion requests adapted after exploring ${candidateSnapshot.id}; ` +
      'the fill-target strategy is context only and does not certify these amounts.',
    planPatch: {
      strategies: {
        rothConversion: { mode: 'none' },
        retirementActions,
      },
    },
    retirementActionReadiness: {
      state: 'identityComplete',
      actionRequestIds: allocatedRequests.map((allocation) => allocation.request.actionId),
    },
  }

  const materialized = applyScenarioPatch(planSnapshot, candidate.planPatch!)
  if (!materialized.ok) {
    return issue(
      'invalidConversionIntent',
      'planPatch',
      `The complete explicit conversion schedule does not materialize as a valid Plan: ${materialized.issues.join('; ')}`,
    )
  }

  return {
    status: 'adapted',
    candidate,
    exploratorySourceProvenance: {
      generatorId: 'roth-fill-to-target',
      exploratoryCandidateId: candidateSnapshot.id,
      source: 'heuristic',
      category: candidateSnapshot.category as 'roth' | 'tax-cliff',
      relationship: 'callerSuppliedExplicitScheduleAfterExploration',
      strategyContext: { ...strategy },
      metadataContext: candidateSnapshot.metadata ?? null,
    },
    identityEvidence: allocatedRequests.map((allocation) => allocation.evidence),
  }
}
