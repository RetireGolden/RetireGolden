/**
 * Pure owner-level character plan for the legacy aggregate QCD arm.
 *
 * Inputs are the caller's already-aggregated owner maps. Rows retain the gross
 * map's insertion order, followed by positive-basis owners in basis-map order.
 * Every state change is returned explicitly for simulatePlan to apply at the
 * annual transaction point.
 */
import {
  applyIrc408d8AContributionOffset,
  irc408d8APriorReductionsAreProvable,
} from '../../actions/qcdDeductibleContributionOffset.js'
import {
  openIraProRataYear,
  type IraProRataYear,
} from '../../strategies/iraBasis.js'

export type LegacyQcdCashFlowWrite = Readonly<{
  ownerId: string
  target:
    | 'exclusionFromRmd'
    | 'ordinaryFromRmd'
    | 'exclusionBeyondRmd'
    | 'ordinaryBeyondRmd'
  value: number
}>

export interface AnnualLegacyQcdOwnerCharacterPlanInput {
  readonly qcdGrossByOwner: ReadonlyMap<string, number>
  readonly qcdFromRmdByOwner: ReadonlyMap<string, number>
  readonly iraBasisByOwner: ReadonlyMap<string, number>
  readonly preDistributionAggregateIraBalance: ReadonlyMap<string, number>
  readonly qcdSection219ByDonor: ReadonlyMap<string, number>
  /** Integer cents consumed before this owner-year. */
  readonly qcdOffsetConsumedByDonor: ReadonlyMap<string, number>
  readonly preProjectionQcdOffsetUnprovable: ReadonlySet<string>
  readonly publishCashFlow: boolean
}

export interface AnnualLegacyQcdOwnerCharacterRow {
  readonly ownerId: string
  /** True only when a positive gift encountered contradictory carry evidence. */
  readonly contradictoryOffsetLedger: boolean
  readonly qualifiedFromRmd: number
  readonly nonQualifiedBeyondRmd: number
  readonly incomeOffsetDelta: number
  readonly nonQualifiedOrdinaryIncomeDelta: number
  /** Integer cents to write to the cross-year donor-offset ledger. */
  readonly qcdOffsetConsumedWrite: number | null
  /** The exact helper-owned object forwarded on the downstream identity channel. */
  readonly iraProRataWrite: IraProRataYear | null
  readonly cashFlowWrites: readonly LegacyQcdCashFlowWrite[]
}

export interface AnnualLegacyQcdOwnerCharacterPlanResult {
  readonly rows: readonly AnnualLegacyQcdOwnerCharacterRow[]
}

export interface MaterializedAnnualLegacyQcdOwnerCharacterRow
  extends AnnualLegacyQcdOwnerCharacterRow {
  /** Plain scalar snapshot used for all downstream math after mutation begins. */
  readonly iraProRataReadSnapshot: IraProRataYear | null
}

export interface MaterializedAnnualLegacyQcdOwnerCharacterPlanResult {
  readonly rows: readonly MaterializedAnnualLegacyQcdOwnerCharacterRow[]
}

/**
 * Finish every helper-owned read before simulatePlan starts applying writes.
 *
 * The production planner returns plain materialized arrays, but the delegation
 * boundary is deliberately defensive: a mocked or later implementation may
 * expose getters or iterables. Consuming those lazily while mutating the annual
 * pass can leave a half-applied donor-offset or character map if a later read
 * throws. This creates caller-owned row/write arrays, reads every row scalar,
 * validates the closed write target union, and snapshots the exact pro-rata
 * object's scalar fields before returning that object only for identity and the
 * plain snapshot for all downstream math.
 */
export function materializeAnnualLegacyQcdOwnerCharacterPlanResult(
  result: Readonly<AnnualLegacyQcdOwnerCharacterPlanResult>,
  expectedOwnerIds: readonly string[],
): MaterializedAnnualLegacyQcdOwnerCharacterPlanResult {
  const sourceRows = [...result.rows]
  const rows = sourceRows.map((row, index) => {
    const ownerId = row.ownerId
    if (ownerId !== expectedOwnerIds[index]) {
      throw new Error(
        `Legacy QCD owner-character row ${index} has owner ${JSON.stringify(ownerId)}; ` +
        `expected ${JSON.stringify(expectedOwnerIds[index])}`,
      )
    }
    const contradictoryOffsetLedger = row.contradictoryOffsetLedger
    const qualifiedFromRmd = row.qualifiedFromRmd
    const nonQualifiedBeyondRmd = row.nonQualifiedBeyondRmd
    const incomeOffsetDelta = row.incomeOffsetDelta
    const nonQualifiedOrdinaryIncomeDelta =
      row.nonQualifiedOrdinaryIncomeDelta
    const qcdOffsetConsumedWrite = row.qcdOffsetConsumedWrite
    const iraProRataWrite = row.iraProRataWrite
    const iraProRataReadSnapshot = iraProRataWrite === null
      ? null
      : {
          basis: iraProRataWrite.basis,
          nontaxableFraction: iraProRataWrite.nontaxableFraction,
        }
    const sourceWrites = [...row.cashFlowWrites]
    const cashFlowWrites = sourceWrites.map((write) => {
      const writeOwnerId = write.ownerId
      if (writeOwnerId !== ownerId) {
        throw new Error(
          `Legacy QCD cash-flow write owner ${JSON.stringify(writeOwnerId)} ` +
          `does not match row owner ${JSON.stringify(ownerId)}`,
        )
      }
      const target = write.target
      const value = write.value
      switch (target) {
        case 'exclusionFromRmd':
        case 'ordinaryFromRmd':
        case 'exclusionBeyondRmd':
        case 'ordinaryBeyondRmd':
          break
        default: {
          const exhaustive: never = target
          throw new Error(
            `Unknown legacy QCD cash-flow target: ${String(exhaustive)}`,
          )
        }
      }
      return { ownerId: writeOwnerId, target, value }
    })
    return {
      ownerId,
      contradictoryOffsetLedger,
      qualifiedFromRmd,
      nonQualifiedBeyondRmd,
      incomeOffsetDelta,
      nonQualifiedOrdinaryIncomeDelta,
      qcdOffsetConsumedWrite,
      iraProRataWrite,
      iraProRataReadSnapshot,
      cashFlowWrites,
    }
  })
  if (rows.length !== expectedOwnerIds.length) {
    throw new Error(
      `Legacy QCD owner-character rows lost cardinality: ` +
      `expected ${expectedOwnerIds.length}, got ${rows.length}`,
    )
  }
  return { rows }
}

/**
 * IRC 408(d)(8)(D) makes the gift the first character step for the owner-year.
 * Its ceiling is the owner's aggregate includible IRA amount (pre-distribution
 * owned-IRA balance less aggregate basis), not the taxable fraction of the
 * year's RMD. The qualified gift returns no basis. Form 8606 line 7 excludes
 * QCDs, so the qualified gift leaves both the line-7 numerator and the annual
 * denominator while the whole basis numerator survives; the caller therefore
 * installs a pro-rata year opened on `preDistribution - qualified`.
 *
 * A gift beyond aggregate includible dollars is ordinary, basis-recovering
 * distribution under 408(d)(8)(D) and (B)'s closing sentence. It is charged to
 * the from-RMD portion first because those dollars already sit in RMD and line
 * 7; only a residual beyond-RMD amount adds ordinary income here.
 *
 * Separately, 408(d)(8)(A)'s second sentence reduces the exclusion by post-70½
 * deductible section 219 contributions net of lifetime reductions already
 * consumed. `applyIrc408d8AContributionOffset` owns that running-total
 * arithmetic. An unprovable history fails closed to zero exclusion and does
 * not invent a ledger write. Any ordinary leftover does not reduce MAGI, and
 * this planner does not invent a section 170 deduction for it.
 */
export function annualLegacyQcdOwnerCharacterPlan(
  input: Readonly<AnnualLegacyQcdOwnerCharacterPlanInput>,
): AnnualLegacyQcdOwnerCharacterPlanResult {
  const ownerIds = new Set<string>(input.qcdGrossByOwner.keys())
  for (const [ownerId, basis] of input.iraBasisByOwner) {
    if (basis > 0) ownerIds.add(ownerId)
  }

  const rows: AnnualLegacyQcdOwnerCharacterRow[] = []
  for (const ownerId of ownerIds) {
    const basis = Math.max(0, input.iraBasisByOwner.get(ownerId) ?? 0)
    const preDistribution =
      input.preDistributionAggregateIraBalance.get(ownerId) ?? 0
    const gift = input.qcdGrossByOwner.get(ownerId) ?? 0
    const fromRmd = Math.min(
      gift,
      input.qcdFromRmdByOwner.get(ownerId) ?? 0,
    )
    const aggregateIncludible = Math.max(0, preDistribution - basis)
    const qualified = Math.min(gift, aggregateIncludible)
    const section219 = input.qcdSection219ByDonor.get(ownerId) ?? 0
    const consumedCents = input.qcdOffsetConsumedByDonor.get(ownerId) ?? 0
    const consumedDollars = consumedCents / 100
    // The cross-year ledger is integer cents. Compare both limbs in that same
    // domain so a valid sub-cent §219 total cannot contradict its rounded carry.
    const section219LedgerCents = Math.round(section219 * 100)
    const contradictoryOffsetLedger = gift > 0 &&
      !irc408d8APriorReductionsAreProvable(section219LedgerCents, consumedCents)
    const offsetUnprovable =
      gift > 0 &&
      (contradictoryOffsetLedger || (
        section219 > 0 &&
        input.preProjectionQcdOffsetUnprovable.has(ownerId)
      ))
    const offset = offsetUnprovable
      ? {
          excludableAmount: 0,
          offsetApplied: qualified,
          reductionsAfter: consumedDollars,
        }
      : gift > 0
        ? applyIrc408d8AContributionOffset({
            candidateExclusion: qualified,
            deductibleSection219Total: section219,
            reductionsAlreadyTaken: consumedDollars,
          })
        : {
            excludableAmount: 0,
            offsetApplied: 0,
            reductionsAfter: consumedDollars,
          }
    const leftover = offset.offsetApplied
    const nonQualified = gift - qualified
    const nonQualifiedFromRmd = Math.min(fromRmd, nonQualified)
    const qualifiedFromRmd = fromRmd - nonQualifiedFromRmd
    const excludableFromRmd = Math.min(
      qualifiedFromRmd,
      offset.excludableAmount,
    )
    const beyondRmdLeftover =
      leftover - (qualifiedFromRmd - excludableFromRmd)
    const nonQualifiedBeyondRmd = nonQualified - nonQualifiedFromRmd
    const cashFlowWrites: LegacyQcdCashFlowWrite[] = []
    if (input.publishCashFlow) {
      if (fromRmd > 0) {
        cashFlowWrites.push({
          ownerId,
          target: 'exclusionFromRmd',
          value: excludableFromRmd,
        })
        const ordinaryFromRmd = Math.max(
          0,
          qualifiedFromRmd - excludableFromRmd,
        )
        if (ordinaryFromRmd > 0) {
          cashFlowWrites.push({
            ownerId,
            target: 'ordinaryFromRmd',
            value: ordinaryFromRmd,
          })
        }
      }
      const beyondAmount = gift - fromRmd
      if (beyondAmount > 0) {
        const beyondStatutoryExcess =
          nonQualified - nonQualifiedFromRmd
        const beyondExclusion = Math.max(
          0,
          beyondAmount -
            Math.max(0, beyondRmdLeftover) -
            beyondStatutoryExcess,
        )
        cashFlowWrites.push({
          ownerId,
          target: 'exclusionBeyondRmd',
          value: beyondExclusion,
        })
        cashFlowWrites.push({
          ownerId,
          target: 'ordinaryBeyondRmd',
          value: Math.max(0, beyondRmdLeftover),
        })
      }
    }
    rows.push({
      ownerId,
      contradictoryOffsetLedger,
      qualifiedFromRmd,
      nonQualifiedBeyondRmd,
      incomeOffsetDelta: excludableFromRmd,
      nonQualifiedOrdinaryIncomeDelta:
        beyondRmdLeftover > 0 ? beyondRmdLeftover : 0,
      qcdOffsetConsumedWrite: gift > 0 && !offsetUnprovable
        ? Math.round(offset.reductionsAfter * 100)
        : null,
      iraProRataWrite: basis > 0
        ? openIraProRataYear(basis, preDistribution - qualified)
        : null,
      cashFlowWrites,
    })
  }
  return { rows }
}
