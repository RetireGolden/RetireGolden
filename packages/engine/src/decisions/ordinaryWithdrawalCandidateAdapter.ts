import type {
  OrdinaryWithdrawalRequest,
} from '../actions/contract.js'
import { persistedRetirementActionRequestSchema } from '../actions/contract.js'
import {
  allocateRetirementActionCandidateIdentity,
  type OrdinaryWithdrawalCandidateIdentityIntent,
  type RetirementActionCandidateIdentityAllocationResult,
  type RetirementActionCandidateIdentityEvidence,
  type RetirementActionCandidateIdentityIssue,
} from '../actions/retirementActionCandidateIdentityAllocator.js'
import type { Plan } from '../model/plan.js'
import type { DecisionCandidate } from './types.js'

export interface OrdinaryWithdrawalGeneratorCandidateDescriptor {
  id: DecisionCandidate['id']
  source: DecisionCandidate['source']
  label: DecisionCandidate['label']
  explanation: DecisionCandidate['explanation']
  metadata?: DecisionCandidate['metadata']
}

export interface OrdinaryWithdrawalCandidateScheduleIssue {
  kind:
    | 'invalidRetirementActionSchedule'
    | 'nonCurrentRetirementActionSchedule'
  field: string
  reason: null
  detail: string
}

export interface OrdinaryWithdrawalCandidateInputIssue {
  kind: 'invalidAdapterInput'
  field: '$'
  reason: null
  detail: string
}

export type OrdinaryWithdrawalCandidateAdapterIssue =
  | RetirementActionCandidateIdentityIssue
  | OrdinaryWithdrawalCandidateScheduleIssue
  | OrdinaryWithdrawalCandidateInputIssue

export type AdaptedOrdinaryWithdrawalGeneratorCandidate = Readonly<{
  status: 'adapted'
  candidate: DecisionCandidate
  identityEvidence: RetirementActionCandidateIdentityEvidence
}>

export type BlockedOrdinaryWithdrawalGeneratorCandidate = Readonly<{
  status: 'blocked'
  candidate: null
  issues: readonly [
    OrdinaryWithdrawalCandidateAdapterIssue,
    ...OrdinaryWithdrawalCandidateAdapterIssue[],
  ]
}>

export type OrdinaryWithdrawalGeneratorCandidateAdaptationResult =
  | AdaptedOrdinaryWithdrawalGeneratorCandidate
  | BlockedOrdinaryWithdrawalGeneratorCandidate

const CURRENT_RETIREMENT_ACTION_KINDS = new Set([
  'ordinaryWithdrawal',
  'rothConversion',
  'qcd',
])

const DECISION_SOURCES = new Set<DecisionCandidate['source']>([
  'milp',
  'detector',
  'heuristic',
  'scenario-sweep',
  'search',
])

const DESCRIPTOR_KEYS = new Set([
  'id',
  'source',
  'label',
  'explanation',
  'metadata',
])

function plainRecord(value: unknown): Record<string, unknown> | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const prototype = Object.getPrototypeOf(value)
  return prototype === Object.prototype || prototype === null
    ? value as Record<string, unknown>
    : null
}

function validDescriptor(
  value: unknown,
): value is OrdinaryWithdrawalGeneratorCandidateDescriptor {
  try {
    const descriptor = plainRecord(value)
    if (descriptor === null || Object.keys(descriptor).some((key) => !DESCRIPTOR_KEYS.has(key))) {
      return false
    }
    if (typeof descriptor['id'] !== 'string' || descriptor['id'].trim().length === 0) return false
    if (!DECISION_SOURCES.has(descriptor['source'] as DecisionCandidate['source'])) return false
    if (typeof descriptor['label'] !== 'string' || descriptor['label'].trim().length === 0) return false
    if (
      typeof descriptor['explanation'] !== 'string' ||
      descriptor['explanation'].trim().length === 0
    ) return false
    return descriptor['metadata'] === undefined || plainRecord(descriptor['metadata']) !== null
  } catch {
    return false
  }
}

function blockedSchedule(
  detail: string,
  kind: OrdinaryWithdrawalCandidateScheduleIssue['kind'] =
    'nonCurrentRetirementActionSchedule',
  field = 'plan.strategies.retirementActions',
): BlockedOrdinaryWithdrawalGeneratorCandidate {
  return {
    status: 'blocked',
    candidate: null,
    issues: [{
      kind,
      field,
      reason: null,
      detail,
    }],
  }
}

function blockedInput(detail: string): BlockedOrdinaryWithdrawalGeneratorCandidate {
  return {
    status: 'blocked',
    candidate: null,
    issues: [{
      kind: 'invalidAdapterInput',
      field: '$',
      reason: null,
      detail,
    }],
  }
}

function snapshotAdapterInputs(
  plan: Readonly<Plan>,
  descriptor: Readonly<OrdinaryWithdrawalGeneratorCandidateDescriptor>,
  intent: OrdinaryWithdrawalCandidateIdentityIntent,
):
  | {
      ok: true
      plan: Plan
      descriptor: OrdinaryWithdrawalGeneratorCandidateDescriptor
      intent: OrdinaryWithdrawalCandidateIdentityIntent
    }
  | { ok: false; result: BlockedOrdinaryWithdrawalGeneratorCandidate } {
  try {
    return {
      ok: true,
      plan: structuredClone(plan),
      descriptor: structuredClone(descriptor),
      intent: structuredClone(intent),
    }
  } catch {
    return {
      ok: false,
      result: blockedInput(
        'The Plan, candidate descriptor, and ordinary-withdrawal intent must be losslessly snapshot-compatible data.',
      ),
    }
  }
}

type PlanRetirementAction = Plan['strategies']['retirementActions'][number]

function completeCurrentSchedule(
  plan: Readonly<Plan>,
):
  | { ok: true; actions: readonly PlanRetirementAction[] }
  | { ok: false; result: BlockedOrdinaryWithdrawalGeneratorCandidate } {
  try {
    const actions = (plan as Plan | null | undefined)?.strategies
      ?.retirementActions as unknown
    if (!Array.isArray(actions)) {
      return {
        ok: false,
        result: blockedSchedule(
          'The Plan retirement-action schedule must be a complete array before a request can be appended.',
          'invalidRetirementActionSchedule',
        ),
      }
    }

    const actionIds = new Set<string>()
    for (const [index, action] of actions.entries()) {
      const field = `plan.strategies.retirementActions.${index}`
      const parsed = persistedRetirementActionRequestSchema.safeParse(action)
      if (!parsed.success) {
        return {
          ok: false,
          result: blockedSchedule(
            'The preserved retirement-action schedule contains an incomplete or invalid request.',
            'invalidRetirementActionSchedule',
            field,
          ),
        }
      }
      if (!CURRENT_RETIREMENT_ACTION_KINDS.has(parsed.data.kind)) {
        return {
          ok: false,
          result: blockedSchedule(
            `The preserved retirement-action schedule contains non-current action kind "${parsed.data.kind}"; ` +
            'legacy aggregate actions must be reviewed and sourced before an identity-complete candidate can be built.',
            'nonCurrentRetirementActionSchedule',
            field,
          ),
        }
      }
      if (actionIds.has(parsed.data.actionId)) {
        return {
          ok: false,
          result: blockedSchedule(
            `The preserved retirement-action schedule repeats action ID "${parsed.data.actionId}"; ` +
            'identity-complete readiness requires one unique ID per current action.',
            'invalidRetirementActionSchedule',
            `${field}.actionId`,
          ),
        }
      }
      actionIds.add(parsed.data.actionId)
    }
    return {
      ok: true,
      actions: actions as PlanRetirementAction[],
    }
  } catch {
    return {
      ok: false,
      result: blockedSchedule(
        'The Plan retirement-action schedule could not be inspected losslessly.',
        'invalidRetirementActionSchedule',
      ),
    }
  }
}

/**
 * Adapt one explicit ordinary-withdrawal intent into an identity-complete
 * decision candidate. The adapter appends to the Plan's complete current-kind
 * action schedule; it never chooses an account or rewrites an aggregate
 * withdrawal strategy.
 */
export function adaptOrdinaryWithdrawalGeneratorCandidate(
  plan: Readonly<Plan>,
  descriptor: Readonly<OrdinaryWithdrawalGeneratorCandidateDescriptor>,
  intent: OrdinaryWithdrawalCandidateIdentityIntent,
): OrdinaryWithdrawalGeneratorCandidateAdaptationResult {
  const snapshot = snapshotAdapterInputs(plan, descriptor, intent)
  if (!snapshot.ok) return snapshot.result
  if (!validDescriptor(snapshot.descriptor)) {
    return blockedInput(
      'The candidate descriptor must contain a nonblank ID, supported source, nonblank label and explanation, and optional plain-object metadata only.',
    )
  }

  const schedule = completeCurrentSchedule(snapshot.plan)
  if (!schedule.ok) return schedule.result

  let allocation: RetirementActionCandidateIdentityAllocationResult
  try {
    allocation = allocateRetirementActionCandidateIdentity(
      snapshot.plan,
      snapshot.intent,
    )
  } catch {
    return blockedInput(
      'The Plan or ordinary-withdrawal intent could not be inspected by the identity allocator.',
    )
  }
  if (allocation.status === 'blocked') {
    return {
      status: 'blocked',
      candidate: null,
      issues: allocation.issues,
    }
  }
  if (allocation.request.kind !== 'ordinaryWithdrawal') {
    return blockedInput(
      'The ordinary-withdrawal adapter received a non-withdrawal allocator result and will not append it.',
    )
  }

  const request: OrdinaryWithdrawalRequest = allocation.request
  const retirementActions = [
    ...schedule.actions,
    request,
  ]
  const candidate: DecisionCandidate = {
    id: snapshot.descriptor.id,
    source: snapshot.descriptor.source,
    category: 'withdrawal',
    label: snapshot.descriptor.label,
    explanation: snapshot.descriptor.explanation,
    planPatch: {
      strategies: {
        retirementActions,
      },
    },
    retirementActionReadiness: {
      state: 'identityComplete',
      actionRequestIds: [request.actionId],
    },
    ...(snapshot.descriptor.metadata === undefined
      ? {}
      : { metadata: snapshot.descriptor.metadata }),
  }

  return {
    status: 'adapted',
    candidate,
    identityEvidence: allocation.evidence,
  }
}
