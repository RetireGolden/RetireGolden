import type { AssetAllocationPolicy } from '../model/plan.js'
import type { RothBasisState } from '../strategies/rothBasis.js'
import type { IraProRataYear } from '../strategies/iraBasis.js'
import type { RmdApplicablePlan } from '../rmd/rmdShortfallExcise.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from
  './annualRetirementRuntimeJournal.js'
import type {
  SimulatorRetirementRuntimeApplication,
  YearExpenses,
} from './types.js'
import { SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS } from
  '../internal/simulatorAnnualPassValueBindingKeys.js'

/**
 * A simulator balance row at the post-contribution annual-pass boundary.
 *
 * The transaction restores the original row objects in place. Keeping their
 * identity is important because the simulator holds references to those rows
 * in account-specific closures while an annual pass is being probed.
 */
export interface SimulatorAnnualPassBalanceRecord {
  readonly account: { readonly id: string }
  balance: number
  costBasis: number
}

export interface SimulatorAnnualPassHecmState {
  principalLimit: number
  loanBalance: number
}

export interface SimulatorAnnualPassAllocationTrackState {
  policy: AssetAllocationPolicy
  weights: number[]
}

/** A first-distribution-calendar-year RMD elected into the following RBD year. */
export interface SimulatorAnnualPassDeferredFirstRmd {
  applicablePlan: RmdApplicablePlan
  distributionCalendarYear: number
  dueYear: number
  requiredAmount: number
}

/** A named read/write adapter for a mutable simulator local. */
export interface SimulatorAnnualPassValueBinding<T> {
  readonly read: () => T
  readonly write: (value: T) => void
}

/**
 * The complete mutable simulator state owned by the post-contribution annual
 * pass. This intentionally names every container/local instead of accepting an
 * arbitrary object graph: adding new annual-pass state must be an explicit API
 * and test change.
 */
export interface SimulatorAnnualPassStateBindings {
  balances: SimulatorAnnualPassBalanceRecord[]
  retirementRuntimeOccurrences:
    SimulatorAnnualRetirementRuntimeOccurrence[]
  retirementRuntimeApplications:
    SimulatorRetirementRuntimeApplication[]
  nextRetirementRuntimeMutationOrdinal: SimulatorAnnualPassValueBinding<number>
  iraProRata: Map<string, IraProRataYear>
  iraBasisByOwner: Map<string, number>
  rothBasis: Map<string, RothBasisState>
  /**
   * Observation-only remaining assumed Roth contribution seed by pool key.
   * Mutated at the same withdrawal commit as `rothBasis`; must roll back with
   * it so rejected/counterfactual attempts cannot drain a committed year.
   */
  rothAssumedContributionRemaining: Map<string, number>
  /**
   * Observation-only conversion principal the assumed-zero counterfactual has
   * spent extra via assumed-seed re-homing (free cover, unseasoned taxable,
   * free-behind — per pool). Mutated with the assumed-seed flag site; must
   * roll back with the other Roth observation maps.
   */
  rothCounterfactualFreeCoverConsumed: Map<string, number>
  propertyValues: Map<string, number>
  hecmStates: Map<string, SimulatorAnnualPassHecmState>
  insuranceCashValues: Map<string, number>
  allocationTrack: Map<string, SimulatorAnnualPassAllocationTrackState>
  seppAmortAmount: Map<string, number>
  magiHistory: Map<number, number>
  deferredFirstRmdByApplicablePlan:
    Map<string, SimulatorAnnualPassDeferredFirstRmd>
  /**
   * The two named-QCD donor ledgers. Both outlive a single year — the
   * post-70½ deductible-contribution offset is cumulative over the donor's
   * lifetime under Notice 2020-68, and a donor whose history became unprovable
   * stays unprovable — but both are written *inside* the annual pass, so an
   * attempt that is rolled back must not leave its consumption or its verdict
   * standing for the next attempt to read.
   */
  namedQcdOffsetConsumedByDonor: Map<string, number>
  namedQcdOffsetHistoryUnprovable: Set<string>
  warnings: Set<string>
  unassignedCash: SimulatorAnnualPassValueBinding<number>
  priorYearPortfolioReturnPct: SimulatorAnnualPassValueBinding<number>
  capitalLossPool: SimulatorAnnualPassValueBinding<number>
  hsaReimbursablePool: SimulatorAnnualPassValueBinding<number>
  depletionYear: SimulatorAnnualPassValueBinding<number | null>
  conversionNontaxable: SimulatorAnnualPassValueBinding<number>
  healthcare: SimulatorAnnualPassValueBinding<number>
  qualifiedMedicalThisYear: SimulatorAnnualPassValueBinding<number>
  hsaQualifiedCap: SimulatorAnnualPassValueBinding<number>
  requiredSpendingBase: SimulatorAnnualPassValueBinding<number>
  targetSpendingBase: SimulatorAnnualPassValueBinding<number>
  expenses: YearExpenses
}

export type SimulatorAnnualPassTransactionStatus = 'open' | 'committed' | 'rolledBack'

export interface SimulatorAnnualPassCommitted<DeferredEffect> {
  readonly status: 'committed'
  readonly deferredEffects: readonly DeferredEffect[]
}

export interface SimulatorAnnualPassRolledBack {
  readonly status: 'rolledBack'
  readonly deferredEffects: readonly []
}

export type SimulatorAnnualPassSettlement<DeferredEffect> =
  | SimulatorAnnualPassCommitted<DeferredEffect>
  | SimulatorAnnualPassRolledBack

export interface SimulatorAnnualPassTransaction<DeferredEffect> {
  readonly status: SimulatorAnnualPassTransactionStatus
  /** Queue a value for the caller to apply only after a successful commit. */
  defer(effect: DeferredEffect): void
  /** Preserve mutations and expose every deferred value once, in queue order. */
  commit(): SimulatorAnnualPassCommitted<DeferredEffect>
  /** Restore the checkpoint and explicitly attest that no effects survived. */
  rollback(): SimulatorAnnualPassRolledBack
}

export class SimulatorAnnualPassTransactionSettledError extends Error {
  constructor(status: Exclude<SimulatorAnnualPassTransactionStatus, 'open'>) {
    super(`Simulator annual-pass transaction is already ${status}.`)
    this.name = 'SimulatorAnnualPassTransactionSettledError'
  }
}

interface BalanceSnapshot {
  record: SimulatorAnnualPassBalanceRecord
  account: SimulatorAnnualPassBalanceRecord['account']
  accountId: string
  balance: number
  costBasis: number
}

interface ValueBindingMethodSnapshot {
  readonly key: typeof SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS[number]
  readonly binding: object
  readonly read: unknown
  readonly write: unknown
}

interface AnnualPassSnapshot {
  bindingReferences: {
    [Key in keyof SimulatorAnnualPassStateBindings]:
      SimulatorAnnualPassStateBindings[Key]
  }
  valueBindingMethods: readonly ValueBindingMethodSnapshot[]
  balances: BalanceSnapshot[]
  retirementRuntimeOccurrences:
    SimulatorAnnualRetirementRuntimeOccurrence[]
  retirementRuntimeApplications:
    SimulatorRetirementRuntimeApplication[]
  nextRetirementRuntimeMutationOrdinal: number
  iraProRata: Array<[string, IraProRataYear]>
  iraBasisByOwner: Array<[string, number]>
  rothBasis: Array<[string, RothBasisState]>
  rothAssumedContributionRemaining: Array<[string, number]>
  rothCounterfactualFreeCoverConsumed: Array<[string, number]>
  propertyValues: Array<[string, number]>
  hecmStates: Array<[string, SimulatorAnnualPassHecmState]>
  insuranceCashValues: Array<[string, number]>
  allocationTrack: Array<[string, SimulatorAnnualPassAllocationTrackState]>
  seppAmortAmount: Array<[string, number]>
  magiHistory: Array<[number, number]>
  deferredFirstRmdByApplicablePlan:
    Array<[string, SimulatorAnnualPassDeferredFirstRmd]>
  namedQcdOffsetConsumedByDonor: Array<[string, number]>
  namedQcdOffsetHistoryUnprovable: string[]
  warnings: string[]
  unassignedCash: number
  priorYearPortfolioReturnPct: number
  capitalLossPool: number
  hsaReimbursablePool: number
  depletionYear: number | null
  conversionNontaxable: number
  healthcare: number
  qualifiedMedicalThisYear: number
  hsaQualifiedCap: number
  requiredSpendingBase: number
  targetSpendingBase: number
  expenses: YearExpenses
}

function cloneIraProRata(value: IraProRataYear): IraProRataYear {
  return { basis: value.basis, nontaxableFraction: value.nontaxableFraction }
}

function cloneRothBasis(value: RothBasisState): RothBasisState {
  return {
    contributionBasis: value.contributionBasis,
    conversionLayers: value.conversionLayers.map((layer) => ({
      year: layer.year,
      amount: layer.amount,
      taxableAmount: layer.taxableAmount,
    })),
  }
}

function cloneHecmState(value: SimulatorAnnualPassHecmState): SimulatorAnnualPassHecmState {
  return { principalLimit: value.principalLimit, loanBalance: value.loanBalance }
}

function cloneAllocationTrackState(
  value: SimulatorAnnualPassAllocationTrackState,
): SimulatorAnnualPassAllocationTrackState {
  return { policy: structuredClone(value.policy), weights: [...value.weights] }
}

function cloneDeferredFirstRmd(
  value: SimulatorAnnualPassDeferredFirstRmd,
): SimulatorAnnualPassDeferredFirstRmd {
  return {
    applicablePlan: structuredClone(value.applicablePlan),
    distributionCalendarYear: value.distributionCalendarYear,
    dueYear: value.dueYear,
    requiredAmount: value.requiredAmount,
  }
}

function cloneExpenses(value: YearExpenses): YearExpenses {
  return { ...value }
}

function cloneRuntimeOccurrence(
  value: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
): SimulatorAnnualRetirementRuntimeOccurrence {
  return { ...value }
}

function cloneRuntimeApplication(
  value: Readonly<SimulatorRetirementRuntimeApplication>,
): SimulatorRetirementRuntimeApplication {
  // Both destination-credit kinds are plural now: a year holds one aggregate
  // credit per converting owner and one named credit per committed request, and
  // each carries its own source arrays. A shallow spread would leave the
  // snapshot sharing those arrays with the live journal, so a rollback would
  // restore an array the aborted attempt had already appended to.
  return value.applicationKind === 'aggregateRothDestinationCredit' ||
      value.applicationKind === 'namedRothDestinationCredit'
    ? {
        ...value,
        producerOccurrenceKeys: [...value.producerOccurrenceKeys],
        sourceOwnerPersonIds: [...value.sourceOwnerPersonIds],
      }
    : { ...value }
}

function snapshotMap<Key, Value>(
  source: ReadonlyMap<Key, Value>,
  cloneValue: (value: Value) => Value,
): Array<[Key, Value]> {
  return [...source].map(([key, value]) => [key, cloneValue(value)])
}

function restoreMap<Key, Value>(
  target: Map<Key, Value>,
  snapshot: ReadonlyArray<readonly [Key, Value]>,
  cloneValue: (value: Value) => Value,
): void {
  target.clear()
  for (const [key, value] of snapshot) target.set(key, cloneValue(value))
}

function restoreExpenses(target: YearExpenses, snapshot: YearExpenses): void {
  // Remove runtime-added properties as well as restoring deleted/changed ones.
  for (const key of Object.keys(target)) delete (target as unknown as Record<string, unknown>)[key]
  Object.assign(target, cloneExpenses(snapshot))
}

function captureSnapshot(bindings: SimulatorAnnualPassStateBindings): AnnualPassSnapshot {
  return {
    bindingReferences: { ...bindings },
    valueBindingMethods:
      SIMULATOR_ANNUAL_PASS_VALUE_BINDING_KEYS.map((key) => {
      const binding = bindings[key]
      return {
        key,
        binding,
        read: binding.read,
        write: binding.write,
      }
      }),
    balances: bindings.balances.map((record) => ({
      record,
      account: record.account,
      accountId: record.account.id,
      balance: record.balance,
      costBasis: record.costBasis,
    })),
    retirementRuntimeOccurrences:
      bindings.retirementRuntimeOccurrences.map(cloneRuntimeOccurrence),
    retirementRuntimeApplications:
      bindings.retirementRuntimeApplications.map(cloneRuntimeApplication),
    nextRetirementRuntimeMutationOrdinal:
      bindings.nextRetirementRuntimeMutationOrdinal.read(),
    iraProRata: snapshotMap(bindings.iraProRata, cloneIraProRata),
    iraBasisByOwner: snapshotMap(bindings.iraBasisByOwner, (value) => value),
    rothBasis: snapshotMap(bindings.rothBasis, cloneRothBasis),
    rothAssumedContributionRemaining: snapshotMap(
      bindings.rothAssumedContributionRemaining,
      (value) => value,
    ),
    rothCounterfactualFreeCoverConsumed: snapshotMap(
      bindings.rothCounterfactualFreeCoverConsumed,
      (value) => value,
    ),
    propertyValues: snapshotMap(bindings.propertyValues, (value) => value),
    hecmStates: snapshotMap(bindings.hecmStates, cloneHecmState),
    insuranceCashValues: snapshotMap(bindings.insuranceCashValues, (value) => value),
    allocationTrack: snapshotMap(bindings.allocationTrack, cloneAllocationTrackState),
    seppAmortAmount: snapshotMap(bindings.seppAmortAmount, (value) => value),
    magiHistory: snapshotMap(bindings.magiHistory, (value) => value),
    deferredFirstRmdByApplicablePlan: snapshotMap(
      bindings.deferredFirstRmdByApplicablePlan,
      cloneDeferredFirstRmd,
    ),
    namedQcdOffsetConsumedByDonor:
      snapshotMap(bindings.namedQcdOffsetConsumedByDonor, (value) => value),
    namedQcdOffsetHistoryUnprovable: [
      ...bindings.namedQcdOffsetHistoryUnprovable,
    ],
    warnings: [...bindings.warnings],
    unassignedCash: bindings.unassignedCash.read(),
    priorYearPortfolioReturnPct: bindings.priorYearPortfolioReturnPct.read(),
    capitalLossPool: bindings.capitalLossPool.read(),
    hsaReimbursablePool: bindings.hsaReimbursablePool.read(),
    depletionYear: bindings.depletionYear.read(),
    conversionNontaxable: bindings.conversionNontaxable.read(),
    healthcare: bindings.healthcare.read(),
    qualifiedMedicalThisYear: bindings.qualifiedMedicalThisYear.read(),
    hsaQualifiedCap: bindings.hsaQualifiedCap.read(),
    requiredSpendingBase: bindings.requiredSpendingBase.read(),
    targetSpendingBase: bindings.targetSpendingBase.read(),
    expenses: cloneExpenses(bindings.expenses),
  }
}

function restoreSnapshot(bindings: SimulatorAnnualPassStateBindings, snapshot: AnnualPassSnapshot): void {
  // A hostile attempt can replace a binding property with an equal-valued
  // container or adapter. Reattach every original reference before restoring
  // values so rollback also restores simulator closure wiring.
  Object.assign(bindings, snapshot.bindingReferences)
  for (const { key, binding, read, write } of snapshot.valueBindingMethods) {
    const restored = bindings[key] as unknown as {
      read: unknown
      write: unknown
    }
    if (restored !== binding) {
      throw new Error('Simulator annual-pass binding restoration failed')
    }
    restored.read = read
    restored.write = write
  }

  for (const { record, account, accountId, balance, costBasis } of snapshot.balances) {
    const mutableRecord = record as {
      account: { id: string }
      balance: number
      costBasis: number
    }
    const mutableAccount = account as { id: string }
    mutableRecord.account = mutableAccount
    mutableAccount.id = accountId
    record.balance = balance
    record.costBasis = costBasis
  }
  bindings.balances.splice(0, bindings.balances.length, ...snapshot.balances.map(({ record }) => record))

  bindings.retirementRuntimeOccurrences.splice(
    0,
    bindings.retirementRuntimeOccurrences.length,
    ...snapshot.retirementRuntimeOccurrences.map(cloneRuntimeOccurrence),
  )
  bindings.retirementRuntimeApplications.splice(
    0,
    bindings.retirementRuntimeApplications.length,
    ...snapshot.retirementRuntimeApplications.map(cloneRuntimeApplication),
  )
  bindings.nextRetirementRuntimeMutationOrdinal.write(
    snapshot.nextRetirementRuntimeMutationOrdinal,
  )

  restoreMap(bindings.iraProRata, snapshot.iraProRata, cloneIraProRata)
  restoreMap(bindings.iraBasisByOwner, snapshot.iraBasisByOwner, (value) => value)
  restoreMap(bindings.rothBasis, snapshot.rothBasis, cloneRothBasis)
  restoreMap(
    bindings.rothAssumedContributionRemaining,
    snapshot.rothAssumedContributionRemaining,
    (value) => value,
  )
  restoreMap(
    bindings.rothCounterfactualFreeCoverConsumed,
    snapshot.rothCounterfactualFreeCoverConsumed,
    (value) => value,
  )
  restoreMap(bindings.propertyValues, snapshot.propertyValues, (value) => value)
  restoreMap(bindings.hecmStates, snapshot.hecmStates, cloneHecmState)
  restoreMap(bindings.insuranceCashValues, snapshot.insuranceCashValues, (value) => value)
  restoreMap(bindings.allocationTrack, snapshot.allocationTrack, cloneAllocationTrackState)
  restoreMap(bindings.seppAmortAmount, snapshot.seppAmortAmount, (value) => value)
  restoreMap(bindings.magiHistory, snapshot.magiHistory, (value) => value)
  restoreMap(
    bindings.deferredFirstRmdByApplicablePlan,
    snapshot.deferredFirstRmdByApplicablePlan,
    cloneDeferredFirstRmd,
  )
  restoreMap(
    bindings.namedQcdOffsetConsumedByDonor,
    snapshot.namedQcdOffsetConsumedByDonor,
    (value) => value,
  )

  bindings.namedQcdOffsetHistoryUnprovable.clear()
  for (const donorPersonId of snapshot.namedQcdOffsetHistoryUnprovable) {
    bindings.namedQcdOffsetHistoryUnprovable.add(donorPersonId)
  }
  bindings.warnings.clear()
  for (const warning of snapshot.warnings) bindings.warnings.add(warning)

  bindings.unassignedCash.write(snapshot.unassignedCash)
  bindings.priorYearPortfolioReturnPct.write(snapshot.priorYearPortfolioReturnPct)
  bindings.capitalLossPool.write(snapshot.capitalLossPool)
  bindings.hsaReimbursablePool.write(snapshot.hsaReimbursablePool)
  bindings.depletionYear.write(snapshot.depletionYear)
  bindings.conversionNontaxable.write(snapshot.conversionNontaxable)
  bindings.healthcare.write(snapshot.healthcare)
  bindings.qualifiedMedicalThisYear.write(snapshot.qualifiedMedicalThisYear)
  bindings.hsaQualifiedCap.write(snapshot.hsaQualifiedCap)
  bindings.requiredSpendingBase.write(snapshot.requiredSpendingBase)
  bindings.targetSpendingBase.write(snapshot.targetSpendingBase)
  restoreExpenses(bindings.expenses, snapshot.expenses)
}

/**
 * Open a one-shot checkpoint around a simulator annual pass.
 *
 * Deferred effects are inert values, not callbacks. A successful commit hands
 * them to the caller exactly once in a frozen settlement; rollback returns a
 * frozen empty settlement without exposing or applying them. The settlement
 * containers are owned by this primitive, while each effect value remains
 * caller-owned. This keeps irreversible simulator sinks outside probe/retry
 * execution until a later integration slice supplies the atomic consumer.
 */
export function beginSimulatorAnnualPassTransaction<DeferredEffect = never>(
  bindings: SimulatorAnnualPassStateBindings,
): SimulatorAnnualPassTransaction<DeferredEffect> {
  const snapshot = captureSnapshot(bindings)
  const deferredEffects: DeferredEffect[] = []
  let status: SimulatorAnnualPassTransactionStatus = 'open'

  const assertOpen = (): void => {
    if (status !== 'open') throw new SimulatorAnnualPassTransactionSettledError(status)
  }

  return {
    get status() {
      return status
    },
    defer(effect) {
      assertOpen()
      deferredEffects.push(effect)
    },
    commit() {
      assertOpen()
      status = 'committed'
      const committedEffects = Object.freeze([...deferredEffects])
      deferredEffects.length = 0
      return Object.freeze({ status: 'committed' as const, deferredEffects: committedEffects })
    },
    rollback() {
      assertOpen()
      status = 'rolledBack'
      deferredEffects.length = 0
      restoreSnapshot(bindings, snapshot)
      return Object.freeze({ status: 'rolledBack' as const, deferredEffects: Object.freeze([] as const) })
    },
  }
}
