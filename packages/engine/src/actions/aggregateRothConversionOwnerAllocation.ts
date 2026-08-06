import type { Account } from '../model/plan.js'
import {
  isConvertibleToRoth,
  type TraditionalAccount,
} from '../strategies/accountEligibility.js'
import { exactCentLargestRemainderSlices } from './exactCentProRata.js'
import {
  ledgerCentTotalToPlanDollars,
  planDollarsMoveNoLedgerCent,
  planDollarsToLedgerCents,
} from './planBalanceAdapter.js'

/**
 * Who converts how much, out of which of their own accounts, into which of
 * their own Roth IRAs — the whole of the aggregate conversion allocation
 * policy, and nothing else.
 *
 * The policy is the one the ledger runs. Two callers consume this module and
 * they MUST NOT diverge:
 *
 * - `projection/simulate.ts` executes it, debiting the sources and crediting
 *   the destinations this function names;
 * - `projection/optimizerAggregateConversionPromotion.ts` reads the same
 *   answer to name owners, sources and destinations on the identity-bearing
 *   requests that promote an aggregate optimizer winner.
 *
 * A promoted schedule that allocated by any other rule would be a different
 * schedule wearing the ledger's numbers, and nothing downstream would say so.
 * That is why this is one module rather than two implementations of one
 * paragraph: the seam is the guarantee. Do not copy the body into a caller,
 * and do not add a parameter that lets one caller allocate differently from
 * the other.
 *
 * The rules it encodes are registered, and the registry records carry the
 * authority and the conventions:
 *
 * - `irc-408-d-3-A-i-conversion-benefits-the-distributee` — a conversion runs
 *   inside one individual's own accounts, so the household amount is sliced by
 *   owner, drained only from that owner's accounts and credited only to a Roth
 *   that owner holds. The gross-balance weight, the exact-cent largest-
 *   remainder split, the single-owner shortcut and the trimmed owner's
 *   exclusion from the shortfall total are all that record's conventions.
 * - `irc-408A-d-3-B-conversion-destination-must-be-a-roth-ira` — the vehicle
 *   half: an owner's first Roth account of kind `ira` in Plan order receives
 *   the dollars, an employer designated Roth account never does, and an owner
 *   whose only Roth is a designated Roth account is trimmed with a reason of
 *   its own.
 * - `treas-reg-1-408A-4-a-6-rmd-precedes-conversion` — why the caller must
 *   snapshot balances after the forced distribution and before any drain.
 *
 * This module reads balances and returns a plan. It mutates nothing: the
 * caller's balance records are handed back inside the result so the ledger can
 * debit the objects it owns, and it is the ledger — not this policy — that
 * moves a cent.
 */

/**
 * One account the caller holds a live balance for.
 *
 * The caller's own record type flows through as `TBalance`, so the ledger gets
 * back the very objects it debits and credits rather than copies it would have
 * to match up again by ID.
 */
export interface AggregateRothConversionBalance {
  readonly account: Account
  readonly balance: number
}

/**
 * A Roth IRA, pinned on both discriminants.
 *
 * `Account` discriminates on `type` alone and carries `kind` as an
 * `'ira' | 'employer'` union inside the roth member, so `Extract<Account,
 * { type: 'roth' }>` still admits an employer designated Roth account and
 * `Extract<Account, { type: 'roth', kind: 'ira' }>` resolves to `never`.
 * Intersecting is what pins it — and the distinction between the two kinds is
 * this policy's whole destination rule.
 */
export type RothIraAccount = Extract<Account, { type: 'roth' }> & { kind: 'ira' }

/** Why no owner in the household could convert anything. */
export type AggregateRothConversionRefusalReason =
  /** The Plan holds no Roth account at all. */
  | 'householdHoldsNoRothAccount'
  /** Every Roth account in the Plan sits inside an employer plan. */
  | 'householdHoldsOnlyEmployerDesignatedRoth'

/** Why one owner's slice was dropped while other owners converted. */
export type AggregateRothConversionTrimReason =
  /** This owner holds no Roth account of any kind. */
  | 'ownerHoldsNoRothAccount'
  /** This owner's only Roth account is an employer designated Roth account. */
  | 'ownerHoldsOnlyEmployerDesignatedRoth'

/** The one Roth IRA an owner's whole slice lands in. */
export interface AggregateRothConversionDestination<
  TBalance extends AggregateRothConversionBalance,
> {
  readonly ownerPersonId: string
  /** The caller's own balance record for the destination. */
  readonly destinationState: TBalance
  /** `destinationState.account`, narrowed to the Roth IRA the search kept. */
  readonly destinationAccount: RothIraAccount
}

/** One owner's share of the household amount, before any balance ran out. */
export interface AggregateRothConversionSlice<
  TBalance extends AggregateRothConversionBalance,
> {
  readonly ownerPersonId: string
  readonly slicePlanDollars: number
  readonly destination: AggregateRothConversionDestination<TBalance>
}

/** One owner's slice that no lawful destination could receive. */
export interface AggregateRothConversionTrim {
  readonly ownerPersonId: string
  readonly reason: AggregateRothConversionTrimReason
  readonly slicePlanDollars: number
}

/** One movement: out of one source account, into one owner's Roth IRA. */
export interface AggregateRothConversionDraw<
  TBalance extends AggregateRothConversionBalance,
> {
  readonly ownerPersonId: string
  /** The caller's own balance record for the source. */
  readonly sourceState: TBalance
  /** `sourceState.account`, narrowed to the owned traditional account admitted here. */
  readonly sourceAccount: TraditionalAccount
  readonly destination: AggregateRothConversionDestination<TBalance>
  readonly amountPlanDollars: number
}

export type AggregateRothConversionOwnerAllocation<
  TBalance extends AggregateRothConversionBalance,
> =
  | Readonly<{
    status: 'refused'
    reason: AggregateRothConversionRefusalReason
  }>
  | Readonly<{
    status: 'allocated'
    /** Owners who kept their slice, in slice order. */
    slices: readonly AggregateRothConversionSlice<TBalance>[]
    /** Owners whose slice was dropped, in slice order. */
    trims: readonly AggregateRothConversionTrim[]
    /**
     * Every movement, in Plan account order — the order the ledger's single
     * pass over its balances visits them, which is not grouped by owner.
     */
    draws: readonly AggregateRothConversionDraw<TBalance>[]
    /**
     * The designated destinations, in Plan account order. A second Roth IRA
     * belonging to the same owner is not here: only the first one receives.
     */
    destinations: readonly AggregateRothConversionDestination<TBalance>[]
    /**
     * What the household's convertible balances were asked to produce.
     * Trimmed slices are excluded: an owner who cannot convert for want of a
     * Roth is not a shortfall against anyone's balance, and saying so would
     * answer the wrong question with the wrong fix. With no convertible owner
     * at all there is nothing to sum and no owner to name, so the whole
     * request is what the balances failed to meet.
     */
    convertibleTargetPlanDollars: number
  }>

export interface AggregateRothConversionOwnerAllocationInput<
  TBalance extends AggregateRothConversionBalance,
> {
  /**
   * Every account the caller holds a balance for, in Plan order, snapshotted
   * after the year's forced distributions and before any conversion drain.
   * Plan order decides the owner slice order, the destination search, and the
   * order sources are drawn from, so the caller must pass its balances in it.
   */
  readonly balances: readonly TBalance[]
  /** The household amount to convert, in Plan dollars. */
  readonly desiredPlanDollars: number
  /** Owner of an account the Plan records no individual owner for. */
  readonly primaryPersonId: string
}

/**
 * Allocate one year's household conversion amount across the owners who may
 * lawfully convert it.
 *
 * The caller owns the domain question of whether to ask at all: a nonpositive
 * or sub-cent `desiredPlanDollars` is not rejected here, it simply allocates
 * nothing.
 */
export function allocateAggregateRothConversionByOwner<
  TBalance extends AggregateRothConversionBalance,
>(
  input: AggregateRothConversionOwnerAllocationInput<TBalance>,
): AggregateRothConversionOwnerAllocation<TBalance> {
  const { balances, desiredPlanDollars, primaryPersonId } = input
  const ownerOf = (account: Account): string =>
    account.ownerPersonId ?? primaryPersonId

  // Only a Roth IRA can receive these dollars. For an IRA source the statute
  // decides it: 408A(d)(3)(B) applies the conversion paragraph to an amount
  // contributed to a Roth IRA, and the one route into a designated Roth
  // account -- 402A(c)(4)(B) -- reaches only a distribution from the plan that
  // maintains the account, which an IRA never is. The draws below also take
  // employer traditional balances, where that in-plan route exists in law, but
  // the Plan schema records no plan identity linking an employer traditional
  // account to an employer Roth account, so "the same plan" cannot be
  // established and a Roth IRA is the only destination whose lawfulness is
  // verifiable. The wider Roth list survives the filter because the two
  // reasons a person can lack a destination read differently to them: no Roth
  // at all, against a Roth that sits where this conversion cannot go.
  const rothStates = balances.filter((state) => state.account.type === 'roth')
  const rothIraStates = rothStates.filter(
    (state): state is TBalance & { readonly account: RothIraAccount } =>
      state.account.type === 'roth' && state.account.kind === 'ira',
  )
  if (rothIraStates.length === 0) {
    return {
      status: 'refused',
      reason: rothStates.length === 0
        ? 'householdHoldsNoRothAccount'
        : 'householdHoldsOnlyEmployerDesignatedRoth',
    }
  }

  // Weight snapshot: gross convertible balance per owner. The caller reads it
  // after the RMD block (Treas. Reg. 1.408A-4 A-6(b) requires the forced
  // distribution to precede the conversion) and before anything drains, so
  // that no owner is weighted by whatever the earlier owners left behind. The
  // weight is gross balance and not the taxable fraction: what an owner may
  // convert is limited by what they hold, not by how much of it is pre-tax.
  //
  // Inherited accounts follow the 10-year rule and can't be converted.
  // `isConvertibleToRoth` also admits employer traditional plans, which is
  // deliberately a wider set than the Form 8606 basis pool (`isAggregatedIra`,
  // IRAs only): it is the set the draws are actually taken from, so it is the
  // set the weight has to be built from.
  const convertibleWeightByOwner = new Map<string, number>()
  for (const state of balances) {
    if (!isConvertibleToRoth(state.account) || state.balance <= 0) continue
    const ownerId = ownerOf(state.account)
    convertibleWeightByOwner.set(
      ownerId,
      (convertibleWeightByOwner.get(ownerId) ?? 0) + state.balance,
    )
  }

  const destinationByOwner = new Map<string, AggregateRothConversionDestination<TBalance>>()
  const destinations: AggregateRothConversionDestination<TBalance>[] = []
  for (const state of rothIraStates) {
    const ownerId = ownerOf(state.account)
    if (destinationByOwner.has(ownerId)) continue
    const destination: AggregateRothConversionDestination<TBalance> = {
      ownerPersonId: ownerId,
      destinationState: state,
      destinationAccount: state.account,
    }
    destinationByOwner.set(ownerId, destination)
    destinations.push(destination)
  }
  // Which of the two trim reasons applies to an owner the search found no
  // destination for.
  const rothHolders = new Set(rothStates.map((state) => ownerOf(state.account)))

  // Insertion order is the Plan position of each owner's first convertible
  // account, which is the order the draws visit them in and the order the
  // exact-cent slices are allocated in.
  const sliceOwners = [...convertibleWeightByOwner.keys()]
  // A household with one convertible owner has nothing to split, and its slice
  // is the sized amount itself. Routing it through cents anyway would quantize
  // a target the caller produced in raw Plan dollars, changing an answer the
  // owner boundary has no quarrel with. Only a genuine split pays that price,
  // and there it buys the exactness: the parts sum to the whole with no
  // floating-point residue deciding whose dollars move.
  const sliceDollars = sliceOwners.length <= 1
    ? [desiredPlanDollars]
    : exactCentLargestRemainderSlices(
      BigInt(planDollarsToLedgerCents(desiredPlanDollars)),
      sliceOwners.map((ownerId) => BigInt(planDollarsToLedgerCents(
        convertibleWeightByOwner.get(ownerId)!,
      ))),
    ).map((slice) => ledgerCentTotalToPlanDollars(slice))

  const slices: AggregateRothConversionSlice<TBalance>[] = []
  const trims: AggregateRothConversionTrim[] = []
  const remainingByOwner = new Map<string, number>()
  for (let index = 0; index < sliceOwners.length; index += 1) {
    const ownerId = sliceOwners[index]!
    const slicePlanDollars = sliceDollars[index]!
    const destination = destinationByOwner.get(ownerId)
    if (destination === undefined) {
      trims.push({
        ownerPersonId: ownerId,
        reason: rothHolders.has(ownerId)
          ? 'ownerHoldsOnlyEmployerDesignatedRoth'
          : 'ownerHoldsNoRothAccount',
        slicePlanDollars,
      })
      continue
    }
    slices.push({ ownerPersonId: ownerId, slicePlanDollars, destination })
    remainingByOwner.set(ownerId, slicePlanDollars)
  }

  const convertibleTargetPlanDollars = sliceOwners.length === 0
    ? desiredPlanDollars
    : slices.reduce((total, slice) => total + slice.slicePlanDollars, 0)

  const draws: AggregateRothConversionDraw<TBalance>[] = []
  for (const state of balances) {
    if (!isConvertibleToRoth(state.account)) continue
    const ownerId = ownerOf(state.account)
    const ownerRemaining = remainingByOwner.get(ownerId) ?? 0
    if (ownerRemaining <= 0) continue
    const amountPlanDollars = Math.min(state.balance, ownerRemaining)
    // The same discharge the forced distributions and the aggregate gift
    // apply. A source holding a residue the exact-cent ledger cannot express
    // would otherwise convert it, which journals an occurrence for a gross
    // that rounds to nothing -- and the runtime source series admits no such
    // occurrence, so the year refuses and the annual exact-basis settlement
    // rolls back for as long as the residue survives. Skipped whole: no
    // movement, no occurrence, no destination credit to reconcile against a
    // debit that never happened. The owner keeps the remaining dollars for a
    // later source, because nothing was taken against them here.
    if (amountPlanDollars <= 0 || planDollarsMoveNoLedgerCent(amountPlanDollars)) continue
    draws.push({
      ownerPersonId: ownerId,
      sourceState: state,
      sourceAccount: state.account,
      destination: destinationByOwner.get(ownerId)!,
      amountPlanDollars,
    })
    remainingByOwner.set(ownerId, ownerRemaining - amountPlanDollars)
  }

  return {
    status: 'allocated',
    slices,
    trims,
    draws,
    destinations,
    convertibleTargetPlanDollars,
  }
}
