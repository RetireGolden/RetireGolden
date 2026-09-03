import type { RothBasisState } from '../strategies/rothBasis.js'
import type { IraProRataYear } from '../strategies/iraBasis.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from
  '../projection/annualRetirementRuntimeJournal.js'
import type { SimulatorRetirementRuntimeApplication, YearExpenses } from
  '../projection/types.js'
import type {
  SimulatorAnnualPassAllocationTrackState,
  SimulatorAnnualPassBalanceRecord,
  SimulatorAnnualPassDeferredFirstRmd,
  SimulatorAnnualPassHecmState,
  SimulatorAnnualPassStateBindings,
  SimulatorAnnualPassValueBinding,
} from '../projection/annualPassTransaction.js'

/**
 * The one inventory of the mutable simulator state an annual pass owns.
 *
 * This state used to be enumerated in five hand-maintained parallel lists: the
 * `SimulatorAnnualPassStateBindings` interface, a snapshot interface, a capture
 * function, a restore function, and the test's byte-comparison view. Adding a
 * field to the interface and forgetting one of the other four compiled cleanly
 * and left the rollback test still passing, because that test's view was itself
 * a copy of the same hand-written list — so new state would leak across a
 * rolled-back attempt and corrupt basis and character for the committed year.
 *
 * The registry below is a mapped type over `keyof SimulatorAnnualPassStateBindings`,
 * so a field the interface names and this file does not is a compile error. The
 * transaction's capture and restore, and the test's byte view, are all driven
 * from it.
 *
 * Entry order is load-bearing in one narrow sense: `restore` runs the entries in
 * declaration order, which is the interface's own field order, and that is the
 * order the hand-written restore ran in.
 */
export interface SimulatorAnnualPassStateEntry<Live> {
  /** Copy the live value into a rollback-safe snapshot value. */
  capture(live: Live): unknown
  /** Put a captured snapshot back, in place, preserving the live identity. */
  restore(live: Live, captured: unknown): void
}

export type SimulatorAnnualPassStateRegistry = {
  readonly [Key in keyof SimulatorAnnualPassStateBindings]:
    SimulatorAnnualPassStateEntry<SimulatorAnnualPassStateBindings[Key]>
}

/** One captured value per registry key. */
export type SimulatorAnnualPassCapturedState = {
  readonly [Key in keyof SimulatorAnnualPassStateBindings]: unknown
}

/**
 * Pair one capture with the restore that consumes exactly what it produced.
 *
 * The registry value type erases the captured type so that thirty differently
 * shaped entries can live in one record; this factory is where the pairing is
 * still checked, and the single assertion inside it is the whole cost of that
 * erasure.
 */
function entry<Live, Captured>(
  capture: (live: Live) => Captured,
  restore: (live: Live, captured: Captured) => void,
): SimulatorAnnualPassStateEntry<Live> {
  return {
    capture,
    restore: (live, captured) => { restore(live, captured as Captured) },
  }
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

/** A map whose values are copied by value; the common case. */
function mapEntry<Key, Value>(): SimulatorAnnualPassStateEntry<Map<Key, Value>> {
  return entry(
    (live: Map<Key, Value>) => snapshotMap(live, (value) => value),
    (live, captured) => { restoreMap(live, captured, (value) => value) },
  )
}

/** A map whose values are mutable objects and need a deep copy of their own. */
function clonedMapEntry<Key, Value>(
  cloneValue: (value: Value) => Value,
): SimulatorAnnualPassStateEntry<Map<Key, Value>> {
  return entry(
    (live: Map<Key, Value>) => snapshotMap(live, cloneValue),
    (live, captured) => { restoreMap(live, captured, cloneValue) },
  )
}

/** A string set restored by identity of contents, not of the set object. */
function stringSetEntry(): SimulatorAnnualPassStateEntry<Set<string>> {
  return entry(
    (live: Set<string>) => [...live],
    (live, captured) => {
      live.clear()
      for (const member of captured) live.add(member)
    },
  )
}

/** An array of value objects restored in place, cloning on both legs. */
function clonedArrayEntry<Value>(
  cloneValue: (value: Value) => Value,
): SimulatorAnnualPassStateEntry<Value[]> {
  return entry(
    (live: Value[]) => live.map(cloneValue),
    (live, captured) => { live.splice(0, live.length, ...captured.map(cloneValue)) },
  )
}

/** A read/write adapter over one simulator local. */
function valueBindingEntry<Value>():
  SimulatorAnnualPassStateEntry<SimulatorAnnualPassValueBinding<Value>> {
  return entry(
    (live: SimulatorAnnualPassValueBinding<Value>) => live.read(),
    (live, captured) => { live.write(captured) },
  )
}

interface BalanceSnapshot {
  record: SimulatorAnnualPassBalanceRecord
  account: SimulatorAnnualPassBalanceRecord['account']
  accountId: string
  balance: number
  costBasis: number
}

/**
 * Balance rows are restored by identity: the transaction puts the ORIGINAL row
 * objects back in place, because the simulator holds references to them in
 * account-specific closures while a pass is being probed. A hostile attempt can
 * also swap a row's `account` object or its id, so both are pinned too.
 */
const balancesEntry: SimulatorAnnualPassStateEntry<SimulatorAnnualPassBalanceRecord[]> =
  entry(
    (live: SimulatorAnnualPassBalanceRecord[]): BalanceSnapshot[] =>
      live.map((record) => ({
        record,
        account: record.account,
        accountId: record.account.id,
        balance: record.balance,
        costBasis: record.costBasis,
      })),
    (live, captured) => {
      for (const { record, account, accountId, balance, costBasis } of captured) {
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
      live.splice(0, live.length, ...captured.map(({ record }) => record))
    },
  )

const expensesEntry: SimulatorAnnualPassStateEntry<YearExpenses> = entry(
  cloneExpenses,
  (live, captured) => {
    // Remove runtime-added properties as well as restoring deleted/changed ones.
    for (const key of Object.keys(live)) {
      delete (live as unknown as Record<string, unknown>)[key]
    }
    Object.assign(live, cloneExpenses(captured))
  },
)

export const SIMULATOR_ANNUAL_PASS_STATE_REGISTRY: SimulatorAnnualPassStateRegistry = {
  balances: balancesEntry,
  retirementRuntimeOccurrences: clonedArrayEntry(cloneRuntimeOccurrence),
  retirementRuntimeApplications: clonedArrayEntry(cloneRuntimeApplication),
  nextRetirementRuntimeMutationOrdinal: valueBindingEntry(),
  iraProRata: clonedMapEntry(cloneIraProRata),
  iraBasisByOwner: mapEntry(),
  rothBasis: clonedMapEntry(cloneRothBasis),
  rothAssumedContributionRemaining: mapEntry(),
  rothCounterfactualFreeCoverConsumed: mapEntry(),
  propertyValues: mapEntry(),
  hecmStates: clonedMapEntry(cloneHecmState),
  insuranceCashValues: mapEntry(),
  allocationTrack: clonedMapEntry(cloneAllocationTrackState),
  seppAmortAmount: mapEntry(),
  magiHistory: mapEntry(),
  deferredFirstRmdByApplicablePlan: clonedMapEntry(cloneDeferredFirstRmd),
  namedQcdOffsetConsumedByDonor: mapEntry(),
  namedQcdOffsetHistoryUnprovable: stringSetEntry(),
  warnings: stringSetEntry(),
  unassignedCash: valueBindingEntry(),
  priorYearPortfolioReturnPct: valueBindingEntry(),
  capitalLossPool: valueBindingEntry(),
  hsaReimbursablePool: valueBindingEntry(),
  depletionYear: valueBindingEntry(),
  conversionNontaxable: valueBindingEntry(),
  healthcare: valueBindingEntry(),
  qualifiedMedicalThisYear: valueBindingEntry(),
  hsaQualifiedCap: valueBindingEntry(),
  requiredSpendingBase: valueBindingEntry(),
  targetSpendingBase: valueBindingEntry(),
  expenses: expensesEntry,
}

/**
 * Every registered key, in restore order.
 *
 * Derived from the registry object rather than written out again, so this list
 * cannot be the sixth parallel inventory the registry exists to abolish.
 */
export const SIMULATOR_ANNUAL_PASS_STATE_KEYS =
  Object.keys(SIMULATOR_ANNUAL_PASS_STATE_REGISTRY) as
    readonly (keyof SimulatorAnnualPassStateBindings)[]

/** Capture one registered key's live value. */
export function captureSimulatorAnnualPassStateKey<
  Key extends keyof SimulatorAnnualPassStateBindings,
>(bindings: SimulatorAnnualPassStateBindings, key: Key): unknown {
  return SIMULATOR_ANNUAL_PASS_STATE_REGISTRY[key].capture(bindings[key])
}

/** Restore one registered key from a value `captureSimulatorAnnualPassStateKey` produced. */
export function restoreSimulatorAnnualPassStateKey<
  Key extends keyof SimulatorAnnualPassStateBindings,
>(bindings: SimulatorAnnualPassStateBindings, key: Key, captured: unknown): void {
  SIMULATOR_ANNUAL_PASS_STATE_REGISTRY[key].restore(bindings[key], captured)
}

/** Capture every registered key. */
export function captureSimulatorAnnualPassState(
  bindings: SimulatorAnnualPassStateBindings,
): SimulatorAnnualPassCapturedState {
  const state: Record<string, unknown> = {}
  for (const key of SIMULATOR_ANNUAL_PASS_STATE_KEYS) {
    state[key] = captureSimulatorAnnualPassStateKey(bindings, key)
  }
  return state as SimulatorAnnualPassCapturedState
}

/** Restore every registered key, in registry declaration order. */
export function restoreSimulatorAnnualPassState(
  bindings: SimulatorAnnualPassStateBindings,
  state: SimulatorAnnualPassCapturedState,
): void {
  for (const key of SIMULATOR_ANNUAL_PASS_STATE_KEYS) {
    restoreSimulatorAnnualPassStateKey(bindings, key, state[key])
  }
}
