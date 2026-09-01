/**
 * Pure planning boundary for the legacy scalar QCD strategy.
 *
 * The helper owns donor selection, personal-cap allocation, routed-RMD
 * attribution, source-order allocation beyond the RMD, and the history writes
 * implied by a committed scalar gift. It never mutates live balances or writes
 * the runtime journal; the caller validates the complete intent sequence and
 * applies it at the original annual transaction site.
 */
import {
  ledgerCentsToPlanDollars,
  planDollarsMoveNoLedgerCent,
  planDollarsToFlooredLedgerCents,
} from '../../actions/planBalanceAdapter.js'

export interface LegacyQcdGiftPersonView {
  readonly personId: string
  readonly alive: boolean
  readonly ageAttained: number
  readonly birthMonth: number
}

export interface LegacyQcdGiftBalanceView {
  /** Position in the caller's unique, first-ID-order logical balance array. */
  readonly balanceIndex: number
  readonly accountId: string
  /** Caller-resolved owner, including its primary-person fallback. */
  readonly ownerId: string
  readonly isAggregatedIra: boolean
  /** Aggregate live capacity of every compatible physical row for this ID. */
  readonly balance: number
}

export interface AnnualLegacyQcdGiftPlanInput {
  readonly qcdAnnual: number
  readonly inflFactor: number
  readonly perDonorLimit: number
  readonly hasNamedQcdRequest: boolean
  /** Unsorted people; donor-set insertion order is preserved. */
  readonly people: readonly LegacyQcdGiftPersonView[]
  readonly ownedIraRmdTotal: number
  readonly ownedIraRmdGrossByOwner: ReadonlyMap<string, number>
  /** Unique logical balances; first-ID source order is load-bearing. */
  readonly balances: readonly LegacyQcdGiftBalanceView[]
}

export interface LegacyQcdGiftDebitIntent {
  readonly balanceIndex: number
  readonly sourceAccountId: string
  readonly ownerId: string
  readonly sourceBalanceBefore: number
  readonly amount: number
}

export interface AnnualLegacyQcdGiftPlanResult {
  readonly qcd: number
  readonly qcdFromRmd: number
  readonly qcdGrossByOwner: ReadonlyMap<string, number>
  readonly qcdFromRmdByOwner: ReadonlyMap<string, number>
  readonly debitIntents: readonly LegacyQcdGiftDebitIntent[]
  /** Donors whose declared offset history becomes unprovable on commit. */
  readonly offsetHistoryUnprovableDonorIds: readonly string[]
}

function emptyResult(): AnnualLegacyQcdGiftPlanResult {
  return {
    qcd: 0,
    qcdFromRmd: 0,
    qcdGrossByOwner: new Map(),
    qcdFromRmdByOwner: new Map(),
    debitIntents: [],
    offsetHistoryUnprovableDonorIds: [],
  }
}

function addGiftGross(
  target: Map<string, number>, ownerId: string, amount: number,
): void {
  target.set(ownerId, (target.get(ownerId) ?? 0) + amount)
}

export function annualLegacyQcdGiftPlan(
  input: Readonly<AnnualLegacyQcdGiftPlanInput>,
): AnnualLegacyQcdGiftPlanResult {
  if (input.qcdAnnual <= 0 || input.hasNamedQcdRequest) return emptyResult()

  // The scalar arm has annual rather than dated granularity. January-June
  // births reach the registered age-70 proxy; July-December births wait until
  // age 71. Preserve people order in the history-write seam.
  const donorIds = new Set(input.people
    .filter((person) => person.alive && (
      person.ageAttained >= 71 ||
      (person.ageAttained === 70 && person.birthMonth <= 6)
    ))
    .map((person) => person.personId))
  if (donorIds.size === 0) return emptyResult()

  // IRC 408(d)(8)(A) supplies one independently spent cap per donor. The
  // household scalar is capped at their sum, but unused capacity is never
  // pooled into a donor who already exhausted their own limit.
  const donorCapacity = new Map<string, number>(
    [...donorIds].map((donorId) => [donorId, input.perDonorLimit]),
  )
  const requested = Math.min(
    input.qcdAnnual * input.inflFactor,
    input.perDonorLimit * donorIds.size,
  )
  let qcdFromRmd = Math.min(requested, input.ownedIraRmdTotal)
  const qcdGrossByOwner = new Map<string, number>()
  const qcdFromRmdByOwner = new Map<string, number>()

  if (qcdFromRmd > 0 && input.ownedIraRmdTotal > 0) {
    // Sorted owners and the original left-associated folds are observable at
    // IEEE-754 precision. The last owner takes the residual; a second sorted
    // pass reallocates a capped owner's stranded share without plan-order bias.
    const owners = [...input.ownedIraRmdGrossByOwner.keys()].sort()
    const routable = (ownerId: string): number => Math.min(
      input.ownedIraRmdGrossByOwner.get(ownerId) ?? 0,
      donorCapacity.get(ownerId) ?? 0,
    )
    const shares = new Map<string, number>()
    let assigned = 0
    owners.forEach((ownerId, index) => {
      const remaining = Math.max(0, qcdFromRmd - assigned)
      const proportional = index === owners.length - 1
        ? remaining
        : Math.min(
            remaining,
            qcdFromRmd * (
              input.ownedIraRmdGrossByOwner.get(ownerId)! /
              input.ownedIraRmdTotal
            ),
          )
      const share = Math.min(proportional, routable(ownerId))
      assigned += share
      shares.set(ownerId, share)
    })
    let unassigned = Math.max(0, qcdFromRmd - assigned)
    for (const ownerId of owners) {
      if (unassigned <= 0) break
      const slack = routable(ownerId) - (shares.get(ownerId) ?? 0)
      if (slack <= 0) continue
      const extra = Math.min(unassigned, slack)
      shares.set(ownerId, (shares.get(ownerId) ?? 0) + extra)
      unassigned -= extra
      assigned += extra
    }
    qcdFromRmd = assigned
    for (const [ownerId, share] of shares) {
      if (share <= 0) continue
      addGiftGross(qcdFromRmdByOwner, ownerId, share)
      addGiftGross(qcdGrossByOwner, ownerId, share)
      donorCapacity.set(
        ownerId,
        Math.max(0, (donorCapacity.get(ownerId) ?? 0) - share),
      )
    }
  }

  const beyondRmd = requested - qcdFromRmd
  const debitIntents: LegacyQcdGiftDebitIntent[] = []
  let qcdBeyondRmd = 0
  if (beyondRmd > 0) {
    // Logical source order is first occurrence of each ID. Each unique ID
    // contributes one aggregate capacity and can yield at most one intent.
    const sources = input.balances.filter((state) =>
      state.isAggregatedIra && state.balance > 0 && donorIds.has(state.ownerId))
    const available = sources.reduce((sum, state) => sum + state.balance, 0)
    let remaining = Math.min(beyondRmd, available)
    for (const state of sources) {
      if (remaining <= 0) break
      const ownerCapacity = donorCapacity.get(state.ownerId) ?? 0
      if (ownerCapacity <= 0) continue
      const allowance = Math.min(remaining, ownerCapacity)
      // A full drain publishes only whole cents; a partial draw retains the
      // legacy Plan-number amount. Nothing journalled at zero ledger cents.
      const take = allowance >= state.balance
        ? ledgerCentsToPlanDollars(
            planDollarsToFlooredLedgerCents(state.balance),
          )
        : allowance
      if (planDollarsMoveNoLedgerCent(take)) continue
      remaining -= take
      qcdBeyondRmd += take
      donorCapacity.set(
        state.ownerId,
        Math.max(0, ownerCapacity - take),
      )
      addGiftGross(qcdGrossByOwner, state.ownerId, take)
      debitIntents.push({
        balanceIndex: state.balanceIndex,
        sourceAccountId: state.accountId,
        ownerId: state.ownerId,
        sourceBalanceBefore: state.balance,
        amount: take,
      })
    }
  }

  const qcd = qcdBeyondRmd + qcdFromRmd
  return {
    qcd,
    qcdFromRmd,
    qcdGrossByOwner,
    qcdFromRmdByOwner,
    debitIntents,
    offsetHistoryUnprovableDonorIds: qcd > 0 ? [...donorIds] : [],
  }
}
