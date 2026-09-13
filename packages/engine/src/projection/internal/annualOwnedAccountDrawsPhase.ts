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
   * reconciliation (observed pre-election amounts, never invented timing).
   */
  readonly alreadyDistributedQualifying: number
  readonly liveBalance: number
}

export interface ElectionYearOwnerRmdPlanRow {
  readonly accountId: string
  /** Final election-year owner requirement after §1.408-8(c)(3). */
  readonly ownerRequiredAmount: number
  readonly alreadyDistributedQualifying: number
  /** max(0, ownerRequired − alreadyDistributed); never a refund. */
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
  const suppressInheritedForcedTakeAccountIds = new Set<string>()

  for (const account of input.accounts) {
    const already = Math.max(0, account.alreadyDistributedQualifying)
    let ownerRequiredAmount = 0
    if (!account.isDeathYear && account.accountType === 'traditional') {
      ownerRequiredAmount = requiredMinimumDistribution(
        input.pack,
        account.birthYear,
        account.ageAttained,
        Math.max(0, account.priorYearEndBalance),
      )
    }
    const unpaidAmount = Math.max(0, ownerRequiredAmount - already)
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
    if (takeAmount > 0) takeByAccountId.set(account.accountId, takeAmount)
    if (suppressInheritedForcedTake) {
      suppressInheritedForcedTakeAccountIds.add(account.accountId)
    }
  }

  return {
    rows,
    takeByAccountId,
    ownerRequiredByAccountId,
    suppressInheritedForcedTakeAccountIds,
  }
}
