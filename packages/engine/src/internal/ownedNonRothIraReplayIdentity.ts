import {
  asActionId,
  asAllocationId,
  type AccountId,
  type ActionId,
  type AllocationId,
} from '../actions/identity.js'
import { deriveActionStructuralId } from '../actions/structuralId.js'

export type OwnedNonRothIraReplayOccurrenceKind =
  | 'ownedIraRmd'
  | 'automaticSeppDistribution'
  | 'legacyNeedBasedWithdrawal'
  | 'legacyRothConversion'
  /**
   * A legacy charitable distribution that physically leaves an owned IRA
   * without an RMD carrying it. It is a distribution like the three above, but
   * IRC 408(d)(8)(D) excludes it from the Form 8606 pro-rata computation, so it
   * carries no line and never appears in a basis allocation entry.
   */
  | 'legacyQcd'
  /**
   * A conversion the exact-cent executor committed against a named request.
   * It carries Form 8606 line 8 exactly as the aggregate one does — the same
   * statute reaches both — but its producer key names the authorising action
   * and allocation, so the replay identity it derives cannot collide with an
   * aggregate conversion that merely shares a source and destination.
   */
  | 'namedRothConversion'
  | 'ownedIraContribution'
  | 'rolloverInflow'

export interface OwnedNonRothIraReplayAllocationIdentityInput {
  readonly planId: string
  readonly taxYear: number
  readonly producerOccurrenceKey: string
  readonly occurrenceKind: OwnedNonRothIraReplayOccurrenceKind
  readonly sourceAccountId: AccountId | string
  readonly mutationOrdinal: number
}

export interface OwnedNonRothIraReplayAllocationIdentity {
  readonly actionId: ActionId
  readonly allocationId: AllocationId
}

/**
 * One private identity formula shared by raw-source replay and the simulator's
 * speculative exact-character consumer. Keeping both sides on this helper is
 * what makes an assumed effect incapable of matching a different occurrence
 * that merely happens to use the same owner, source, or Form-8606 line.
 */
export function deriveOwnedNonRothIraReplayAllocationIdentity(
  input: Readonly<OwnedNonRothIraReplayAllocationIdentityInput>,
): Readonly<OwnedNonRothIraReplayAllocationIdentity> {
  const actionId = asActionId(deriveActionStructuralId(
    'projection-owned-ira-runtime-replay-action',
    [
      input.planId,
      input.taxYear,
      input.producerOccurrenceKey,
      input.occurrenceKind,
    ],
  ))
  return Object.freeze({
    actionId,
    allocationId: asAllocationId(deriveActionStructuralId(
      'projection-owned-ira-runtime-replay-allocation',
      [actionId, input.sourceAccountId, input.mutationOrdinal],
    )),
  })
}
