/**
 * Election-year owner-RMD reconciliation for a surviving-spouse IRA that opens
 * the year as beneficiary and becomes owned after a verified current-year
 * effective event (Treas. Reg. §1.408-8(c)(3)).
 *
 * Preserves the immutable beneficiary trigger / counterfactual requirement.
 * Computes the owner requirement once from prior-year balance, age, and the
 * applicable-age regime; credits already-accepted qualifying distributions;
 * takes only the unpaid remainder; never refunds excess cash already paid.
 * Does not feed the revised owner requirement back into trigger eligibility.
 * Death-year elections publish owner requirement 0 and leave the decedent
 * residual on the inherited path.
 *
 * IRAs inherited from one decedent and elected together form a pool. Their
 * requirements are calculated separately and then totaled, and the total may
 * be distributed from any one or more of them (§1.408-8(e)(1)(i)), so every
 * accepted distribution counts once toward the pool's total: first toward the
 * IRA it came from, then toward the others in input order.
 */
import { requiredMinimumDistribution } from '../../rmd/rmd.js'
import type { ParameterPack } from '../../params/types.js'
import { planDollarsMoveNoLedgerCent } from '../../actions/index.js'

export interface ElectionYearOwnerRmdAccountInput {
  readonly accountId: string
  readonly accountType: 'traditional' | 'roth'
  /** Prior December 31 balance used for the owner RMD. */
  readonly priorYearEndBalance: number
  readonly birthYear: number
  readonly ageAttained: number
  /** Election in the decedent's death year: no spouse-owner RMD. */
  readonly isDeathYear: boolean
  /**
   * Qualifying distributions already accepted for this account/year before
   * reconciliation (observed pre-election amounts, never invented timing),
   * taken from this account itself.
   */
  readonly alreadyDistributedQualifying: number
  readonly liveBalance: number
  /**
   * Accounts sharing a key are one pool, netted together under
   * §1.408-8(e)(1)(i). Omitted, the account is a pool of its own.
   */
  readonly poolKey?: string
  /**
   * A qualifying distribution the pool's shared facts report without naming
   * the IRA it came from (every member carries the same figure). It is
   * counted once per pool, read from the pool's first account, and added
   * back once to that account's prior December 31 balance, since the opening
   * balance nets it; the pool's total requirement is the same whichever IRA
   * carries it, because the IRAs share one owner and one divisor.
   */
  readonly poolSharedQualifying?: number
}

export interface ElectionYearOwnerRmdPlanRow {
  readonly accountId: string
  /** Final election-year owner requirement after §1.408-8(c)(3). */
  readonly ownerRequiredAmount: number
  /**
   * Accepted distributions credited on this row: those counted toward its
   * requirement, plus any of its own (or, on a pool's first row, of the
   * pool's shared figure) that no requirement in the pool needed. Across a
   * pool the rows sum to the accepted distributions, each counted once.
   */
  readonly alreadyDistributedQualifying: number
  /** ownerRequired less the credit counted toward it; never a refund. */
  readonly unpaidAmount: number
  /** Cash to force now: min(unpaid, liveBalance), skipping sub-cent residues. */
  readonly takeAmount: number
  /**
   * When true, the inherited beneficiary forced take is suppressed for cash
   * settlement while its counterfactual requiredAmount remains published for
   * trigger immutability. Death-year rows stay false so the decedent residual
   * continues on the inherited path.
   */
  readonly suppressInheritedForcedTake: boolean
}

export interface ElectionYearOwnerRmdPlanResult {
  readonly rows: readonly ElectionYearOwnerRmdPlanRow[]
  readonly takeByAccountId: ReadonlyMap<string, number>
  readonly ownerRequiredByAccountId: ReadonlyMap<string, number>
  /** Each row's alreadyDistributedQualifying, by account. */
  readonly creditedByAccountId: ReadonlyMap<string, number>
  readonly suppressInheritedForcedTakeAccountIds: ReadonlySet<string>
}

/**
 * Pure planner: one owner-requirement reconciliation per election-year account.
 * Caller supplies only accounts whose opening treatment is beneficiary and whose
 * verified current-year event routes to owner at year-end.
 */
export function planElectionYearOwnerRmdDraws(input: {
  readonly pack: Readonly<ParameterPack>
  readonly accounts: readonly ElectionYearOwnerRmdAccountInput[]
}): ElectionYearOwnerRmdPlanResult {
  const rows: ElectionYearOwnerRmdPlanRow[] = []
  const takeByAccountId = new Map<string, number>()
  const ownerRequiredByAccountId = new Map<string, number>()
  const creditedByAccountId = new Map<string, number>()
  const suppressInheritedForcedTakeAccountIds = new Set<string>()

  const pools = new Map<string, number[]>()
  input.accounts.forEach((account, index) => {
    const key = account.poolKey === undefined
      ? JSON.stringify(['account', account.accountId])
      : JSON.stringify(['pool', account.poolKey])
    pools.set(key, [...(pools.get(key) ?? []), index])
  })
  const required = input.accounts.map(() => 0)
  const counted = input.accounts.map(() => 0)
  const credited = input.accounts.map(() => 0)
  for (const indexes of pools.values()) {
    const firstIndex = indexes[0]!
    const shared = Math.max(0, input.accounts[firstIndex]!.poolSharedQualifying ?? 0)
    for (const index of indexes) {
      const account = input.accounts[index]!
      if (account.isDeathYear || account.accountType !== 'traditional') continue
      required[index] = requiredMinimumDistribution(
        input.pack,
        account.birthYear,
        account.ageAttained,
        Math.max(0, account.priorYearEndBalance) + (index === firstIndex ? shared : 0),
      )
    }
    // Each accepted distribution counts first toward the IRA it came from;
    // what that IRA does not need, and the pool's shared figure, count toward
    // the rest of the pool in input order, once.
    const spare: { index: number; amount: number; own?: number }[] = []
    for (const index of indexes) {
      const own = Math.max(0, input.accounts[index]!.alreadyDistributedQualifying)
      counted[index] = Math.min(own, required[index]!)
      if (own > counted[index]!) spare.push({ index, amount: own - counted[index]!, own })
    }
    if (shared > 0) spare.push({ index: firstIndex, amount: shared })
    for (const index of indexes) {
      let need = required[index]! - counted[index]!
      while (need > 0 && spare.length > 0) {
        const source = spare[0]!
        const moved = Math.min(need, source.amount)
        counted[index] = counted[index]! + moved
        need -= moved
        source.amount -= moved
        if (source.amount <= 0) spare.shift()
      }
    }
    for (const index of indexes) credited[index] = counted[index]!
    for (const source of spare) {
      // An own excess nothing consumed is credited back whole, exactly.
      credited[source.index] = source.own !== undefined && source.amount === source.own - counted[source.index]!
        ? source.own
        : credited[source.index]! + source.amount
    }
  }

  input.accounts.forEach((account, index) => {
    const ownerRequiredAmount = required[index]!
    const already = credited[index]!
    const unpaidAmount = Math.max(0, ownerRequiredAmount - counted[index]!)
    const capacity = Math.max(0, account.liveBalance)
    let takeAmount = Math.min(unpaidAmount, capacity)
    if (takeAmount <= 0 || planDollarsMoveNoLedgerCent(takeAmount)) {
      takeAmount = 0
    }
    const suppressInheritedForcedTake = !account.isDeathYear
    rows.push({
      accountId: account.accountId,
      ownerRequiredAmount,
      alreadyDistributedQualifying: already,
      unpaidAmount,
      takeAmount,
      suppressInheritedForcedTake,
    })
    ownerRequiredByAccountId.set(account.accountId, ownerRequiredAmount)
    creditedByAccountId.set(account.accountId, already)
    if (takeAmount > 0) takeByAccountId.set(account.accountId, takeAmount)
    if (suppressInheritedForcedTake) {
      suppressInheritedForcedTakeAccountIds.add(account.accountId)
    }
  })

  return {
    rows,
    takeByAccountId,
    ownerRequiredByAccountId,
    creditedByAccountId,
    suppressInheritedForcedTakeAccountIds,
  }
}
