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
