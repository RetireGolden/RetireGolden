/**
 * Pure planning boundary for one aggregate Roth-conversion allocation.
 *
 * A deferred first RMD remains in the live IRA balance but cannot be
 * converted. The legacy caller temporarily subtracted that owner-wide reserve,
 * asked the shared allocation policy to snapshot and allocate the reduced
 * balances, then added every reservation back before executing any draw. This
 * helper performs the policy calculation over private balance shadows and
 * returns the exact reservation operations for the caller to replay. The
 * replay is load-bearing: `balance -= amount; balance += amount` is not always
 * a bit-preserving round trip in binary64.
 *
 * The returned allocation is rebound to the caller's original state objects.
 * The helper mutates neither those states nor the RMD map; all economic and
 * bookkeeping mutations remain in `simulatePlan`.
 */
import {
  allocateAggregateRothConversionByOwner,
  participatesInAggregateRothConversionAllocation,
  type AggregateRothConversionBalance,
  type AggregateRothConversionDestination,
  type AggregateRothConversionOwnerAllocation,
} from '../../actions/aggregateRothConversionOwnerAllocation.js'
import type { RothConversionSourceContext } from '../../strategies/accountEligibility.js'

export interface AnnualAggregateRothConversionLiveBalance
  extends Omit<AggregateRothConversionBalance, 'balance'> {
  balance: number
}

interface PlanningBalance<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
> extends AggregateRothConversionBalance {
  readonly sourceState: TBalance
  balance: number
}

export interface AnnualAggregateRothConversionReservation<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
> {
  /** Caller-owned state whose subtract/add round trip must be replayed. */
  readonly state: TBalance
  readonly amountPlanDollars: number
}

export interface AnnualAggregateRothConversionPlanInput<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
> {
  /** Caller-owned states in Plan order. */
  readonly balances: readonly TBalance[]
  /** Owner insertion order is the annual RMD pass's Map insertion order. */
  readonly iraRmdUnsatisfiedByOwner: ReadonlyMap<string, number>
  readonly desiredPlanDollars: number
  readonly primaryPersonId: string
  /** Caller's annual-ledger residual threshold; one source owns both loops. */
  readonly fundingTolerancePlanDollars: number
  readonly sourceContextForOwner: (
    ownerPersonId: string,
  ) => RothConversionSourceContext
}

/**
 * Reproduce the former live-state reservation round trip as one protected
 * scope. The callback is the only place an operation may run while balances
 * are reserved; restoration is guaranteed even if that operation throws.
 */
export function withAnnualAggregateRothConversionReservations<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
  TResult,
>(
  reservations: readonly AnnualAggregateRothConversionReservation<TBalance>[],
  whileReserved: () => TResult,
): TResult {
  const applied: AnnualAggregateRothConversionReservation<TBalance>[] = []
  try {
    for (const reservation of reservations) {
      reservation.state.balance -= reservation.amountPlanDollars
      applied.push(reservation)
    }
    return whileReserved()
  } finally {
    for (const reservation of applied) {
      reservation.state.balance += reservation.amountPlanDollars
    }
  }
}

/**
 * Rebind a shadow-state allocation to the caller's live state identities.
 */
export function rebindAnnualAggregateRothConversionAllocation<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
>(
  planningAllocation: Extract<
    AggregateRothConversionOwnerAllocation<PlanningBalance<TBalance>>,
    { readonly status: 'allocated' }
  >,
): Extract<
  AggregateRothConversionOwnerAllocation<TBalance>,
  { readonly status: 'allocated' }
> {
  const destinationByPlanning = new Map<
    AggregateRothConversionDestination<PlanningBalance<TBalance>>,
    AggregateRothConversionDestination<TBalance>
  >()
  const destinations = planningAllocation.destinations.map((destination) => {
    const rebound: AggregateRothConversionDestination<TBalance> = {
      ownerPersonId: destination.ownerPersonId,
      destinationState: destination.destinationState.sourceState,
      destinationAccount: destination.destinationAccount,
    }
    destinationByPlanning.set(destination, rebound)
    return rebound
  })
  const destinationFor = (
    destination: AggregateRothConversionDestination<PlanningBalance<TBalance>>,
  ): AggregateRothConversionDestination<TBalance> => {
    const rebound = destinationByPlanning.get(destination)
    if (rebound === undefined) {
      throw new Error('aggregate Roth conversion destination left its allocation')
    }
    return rebound
  }

  return {
    status: 'allocated',
    slices: planningAllocation.slices.map((slice) => ({
      ownerPersonId: slice.ownerPersonId,
      slicePlanDollars: slice.slicePlanDollars,
      destination: destinationFor(slice.destination),
    })),
    trims: planningAllocation.trims,
    draws: planningAllocation.draws.map((draw) => ({
      ownerPersonId: draw.ownerPersonId,
      sourceState: draw.sourceState.sourceState,
      sourceAccount: draw.sourceAccount,
      destination: destinationFor(draw.destination),
      amountPlanDollars: draw.amountPlanDollars,
    })),
    destinations,
    convertibleTargetPlanDollars:
      planningAllocation.convertibleTargetPlanDollars,
  }
}

export interface AnnualAggregateRothConversionPlan<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
> {
  /** Reservation operations in the legacy subtraction/restoration order. */
  readonly reservations: readonly AnnualAggregateRothConversionReservation<TBalance>[]
  /** Policy reading set over the reserved balances; duplicate ids remain last-wins. */
  readonly allocationBalances: Readonly<Record<string, number>>
  /** Shared policy result rebound to the caller's original state identities. */
  readonly allocation: AggregateRothConversionOwnerAllocation<TBalance>
}

/**
 * Plan the RMD-reserved aggregate allocation without mutating live state.
 */
export function annualAggregateRothConversionPlan<
  TBalance extends AnnualAggregateRothConversionLiveBalance,
>(
  input: AnnualAggregateRothConversionPlanInput<TBalance>,
): AnnualAggregateRothConversionPlan<TBalance> {
  const planningBalances: PlanningBalance<TBalance>[] = input.balances.map(
    (state) => ({
      account: state.account,
      balance: state.balance,
      sourceState: state,
    }),
  )
  const reservations: AnnualAggregateRothConversionReservation<TBalance>[] = []

  for (const [ownerPersonId, unsatisfiedRmd] of input.iraRmdUnsatisfiedByOwner) {
    let remaining = Math.max(0, unsatisfiedRmd)
    for (
      let index = planningBalances.length - 1;
      index >= 0 && remaining > input.fundingTolerancePlanDollars;
      index -= 1
    ) {
      const planningState = planningBalances[index]!
      const account = planningState.account
      if (
        account.type !== 'traditional' ||
        account.kind !== 'ira' ||
        account.inherited !== undefined ||
        (account.ownerPersonId ?? input.primaryPersonId) !== ownerPersonId
      ) {
        continue
      }
      const amountPlanDollars = Math.min(planningState.balance, remaining)
      if (amountPlanDollars <= 0) continue
      planningState.balance -= amountPlanDollars
      remaining -= amountPlanDollars
      reservations.push({
        state: planningState.sourceState,
        amountPlanDollars,
      })
    }
  }

  const allocationBalances = Object.freeze(
    Object.fromEntries(
      planningBalances
        .filter((state) =>
          participatesInAggregateRothConversionAllocation(state.account))
        .map((state) => [state.account.id, state.balance]),
    ),
  )
  const planningAllocation = allocateAggregateRothConversionByOwner({
    balances: planningBalances,
    desiredPlanDollars: input.desiredPlanDollars,
    primaryPersonId: input.primaryPersonId,
    sourceContextForOwner: input.sourceContextForOwner,
  })

  if (planningAllocation.status === 'refused') {
    return {
      reservations,
      allocationBalances,
      allocation: planningAllocation,
    }
  }

  return {
    reservations,
    allocationBalances,
    allocation: rebindAnnualAggregateRothConversionAllocation(
      planningAllocation,
    ),
  }
}
