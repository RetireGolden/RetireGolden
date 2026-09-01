/**
 * Builds the per-entity observation rows published on a projection year.
 *
 * The inputs are already-settled annual evidence. This phase deliberately
 * performs no accounting and mutates no annual state: it only removes
 * non-consequential evidence, establishes deterministic entity order, and
 * resolves the owner of employer Roth accounts. Keeping publication here
 * gives insight consumers one source of truth without moving the evidence
 * collection or its binding sites out of `simulatePlan`.
 *
 * Two details are observable and intentionally preserved from the inlined
 * phase. First, `> 0` is the filter (not truthiness or non-zero), including
 * its exact behavior for signed zero, NaN, subnormal values and Infinity.
 * Second, the employer-owner index is populated in `accounts` order, so the
 * last employer Roth account wins when valid input contains duplicate ids.
 */
import type { Account } from '../../model/plan.js'
import type {
  EmployerRothAccountActivity,
  OwnedRothIraPoolActivity,
  OwnedTraditionalIraAggregateActivity,
} from './types/accountActivity.js'

/** Taxable amounts made consequential by assumed-zero Form 8606 basis. */
export interface Form8606ConsequentialChannels {
  readonly distributions: number
  readonly conversions: number
  readonly annuityPayments: number
}

export interface PublishedEntityFactsInput {
  readonly accounts: readonly Readonly<Account>[]
  readonly primaryPersonId: string
  readonly ownedRothAssumedBasisConsequentialByOwner: ReadonlyMap<string, number>
  readonly employerRothAssumedBasisConsequentialByAccount: ReadonlyMap<string, number>
  readonly form8606ConsequentialByOwner: ReadonlyMap<
    string,
    Readonly<Form8606ConsequentialChannels>
  >
}

export interface PublishedEntityFacts {
  readonly ownedRothIraPoolActivity: readonly OwnedRothIraPoolActivity[]
  readonly employerRothAccountActivity: readonly EmployerRothAccountActivity[]
  readonly ownedTraditionalIraAggregateActivity: readonly OwnedTraditionalIraAggregateActivity[]
}

/**
 * Returns fresh publication rows and nested verdict objects on every call.
 * Entity ids use JavaScript's UTF-16 relational ordering, matching the former
 * inline comparator exactly and avoiding locale-dependent output.
 */
export function publishedEntityFacts(
  input: PublishedEntityFactsInput,
): PublishedEntityFacts {
  const {
    accounts,
    primaryPersonId,
    ownedRothAssumedBasisConsequentialByOwner,
    employerRothAssumedBasisConsequentialByAccount,
    form8606ConsequentialByOwner,
  } = input

  const employerRothOwnerByAccount = new Map<string, string>()
  for (const account of accounts) {
    if (account.type === 'roth' && account.kind === 'employer') {
      employerRothOwnerByAccount.set(
        account.id,
        account.ownerPersonId ?? primaryPersonId,
      )
    }
  }

  const ownedRothIraPoolActivity: OwnedRothIraPoolActivity[] = [
    ...ownedRothAssumedBasisConsequentialByOwner,
  ]
    .filter(([, withdrawal]) => withdrawal > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ownerPersonId, withdrawal]) => ({
      ownerPersonId,
      assumedBasisConsequential: { withdrawal },
    }))

  const employerRothAccountActivity: EmployerRothAccountActivity[] = [
    ...employerRothAssumedBasisConsequentialByAccount,
  ]
    .filter(([, withdrawal]) => withdrawal > 0)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([accountId, withdrawal]) => ({
      accountId,
      ownerPersonId: employerRothOwnerByAccount.get(accountId) ?? primaryPersonId,
      assumedBasisConsequential: { withdrawal },
    }))

  const ownedTraditionalIraAggregateActivity: OwnedTraditionalIraAggregateActivity[] = [
    ...form8606ConsequentialByOwner,
  ]
    .filter(
      ([, channels]) =>
        channels.distributions > 0 ||
        channels.conversions > 0 ||
        channels.annuityPayments > 0,
    )
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([ownerPersonId, channels]) => ({
      ownerPersonId,
      assumedBasisConsequential: {
        distributions: channels.distributions,
        conversions: channels.conversions,
        annuityPayments: channels.annuityPayments,
      },
    }))

  return {
    ownedRothIraPoolActivity,
    employerRothAccountActivity,
    ownedTraditionalIraAggregateActivity,
  }
}
