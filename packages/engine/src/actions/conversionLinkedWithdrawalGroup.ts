import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { RetirementActionRequest } from './contract.js'
import type { ActionId, PersonId } from './identity.js'
import type { ActionReason } from './reasons.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

/**
 * What the annual group decision says about one conversion and the withdrawal
 * that funds it.
 *
 * There is exactly one disposition, and that is the whole state of the world
 * today: the atomic group executor that would let the pair move was never
 * written, so every linked group is refused pending it. The type therefore
 * cannot express permission, and no caller can hand either executor a verdict
 * that releases a pair. An executable arm belongs to the slice that writes
 * that executor.
 */
export type ConversionLinkedWithdrawalGroupDisposition =
  'refusedPendingGroupExecution'

/**
 * One conversion, the withdrawal it names, and the single answer both
 * executors owe that pair.
 *
 * The two executors run in different simulator phases over different request
 * sets, and each used to answer this question from what it alone could see:
 * `execution.ts` scanned the Plan for a conversion naming the withdrawal, and
 * `rothConversionExecution.ts` read the conversion's own funding kind. Two
 * derivations of one group decision can disagree — the withdrawal executor
 * cannot see a conversion that is in flight rather than in the Plan — and a
 * disagreeing pair is not publishable at all:
 * `assertLinkedWithdrawalRecordAtomicity` throws rather than publishing one
 * side that moved beside one that did not. So the group is assessed once, by
 * the caller that can see both request sets, and both executors honour that
 * verdict instead of deriving a second one.
 *
 * `reasonCode` is the staging gap both sides carry, not a refusal on the
 * merits. The pair is well formed and lawful; the executor that would move it
 * as one transaction is what is missing.
 */
export interface ConversionLinkedWithdrawalGroupVerdict {
  /** Structural identity of the assessed group, derived from its members. */
  readonly groupId: string
  /** The owner whose conversion and funding withdrawal this group is. */
  readonly personId: PersonId
  /** The action year both members must share to be one group. */
  readonly year: number
  readonly conversionActionId: ActionId
  readonly withdrawalActionId: ActionId
  readonly disposition: ConversionLinkedWithdrawalGroupDisposition
  readonly reasonCode: Extract<
    ActionReason['code'],
    'conversion-tax-funding-evidence-unsupported'
  >
}

/** Every linked group the caller could see across both executors' requests. */
export interface ConversionLinkedWithdrawalGroupAssessment {
  readonly groups: readonly ConversionLinkedWithdrawalGroupVerdict[]
}

/**
 * Runtime evidence widened by the conversion facts a group decision needs.
 *
 * The eligibility evidence answers one request at a time. A group verdict
 * cannot be derived that way — it is about two requests that reach two
 * different executors — so it is carried alongside rather than folded in.
 */
export interface RetirementActionGroupRuntimeEvidence
  extends RetirementActionEligibilityRuntimeEvidence {
  readonly conversionLinkedWithdrawalGroups?:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

/**
 * Assess every conversion-linked withdrawal group in one pass over the union
 * of both executors' requests.
 *
 * A group is named by the conversion: a conversion whose tax funding is a
 * linked withdrawal states which withdrawal must move with it. The named
 * withdrawal does not have to be present for the group to exist — a
 * conversion that names a withdrawal nobody scheduled is still a conversion
 * that cannot fund itself — so membership is read off the conversion side and
 * the withdrawal side is matched to it by identifier.
 *
 * Duplicated requests collapse. The same conversion routinely arrives twice,
 * once from `plan.strategies.retirementActions` and once from the annual
 * request set, and a group named twice is still one group.
 *
 * Take this over the union of both executors' requests. An assessment that
 * omits a group either executor can see for itself is a contradiction rather
 * than a release: both fail closed on one instead of moving money against it.
 */
export function assessConversionLinkedWithdrawalGroups(
  requests: readonly Readonly<RetirementActionRequest>[],
): Readonly<ConversionLinkedWithdrawalGroupAssessment> {
  const assessed = new Map<string, ConversionLinkedWithdrawalGroupVerdict>()
  for (const request of requests) {
    if (
      request.kind !== 'rothConversion' ||
      request.taxFunding.kind !== 'linkedWithdrawal'
    ) continue
    const withdrawalActionId = request.taxFunding.withdrawalActionId
    const key = JSON.stringify([request.actionId, withdrawalActionId])
    if (assessed.has(key)) continue
    assessed.set(key, {
      groupId: deriveActionStructuralId(
        'retirement-action-conversion-linked-withdrawal-group',
        [request.actionId, withdrawalActionId, request.personId, request.year],
      ),
      personId: request.personId,
      year: request.year,
      conversionActionId: request.actionId,
      withdrawalActionId,
      disposition: 'refusedPendingGroupExecution',
      reasonCode: 'conversion-tax-funding-evidence-unsupported',
    })
  }
  const groups = [...assessed.values()].sort(
    (left, right) =>
      compareUtf16CodeUnits(left.conversionActionId, right.conversionActionId) ||
      compareUtf16CodeUnits(left.withdrawalActionId, right.withdrawalActionId),
  )
  return deepFreeze({ groups })
}

/** The group verdict this conversion must honour, if it is in one. */
export function conversionLinkedWithdrawalGroupForConversion(
  assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
  conversionActionId: string,
): Readonly<ConversionLinkedWithdrawalGroupVerdict> | null {
  return assessment.groups.find(
    (group) => group.conversionActionId === conversionActionId,
  ) ?? null
}

/** The group verdict this withdrawal must honour, if it is in one. */
export function conversionLinkedWithdrawalGroupForWithdrawal(
  assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
  withdrawalActionId: string,
): Readonly<ConversionLinkedWithdrawalGroupVerdict> | null {
  return assessment.groups.find(
    (group) => group.withdrawalActionId === withdrawalActionId,
  ) ?? null
}
