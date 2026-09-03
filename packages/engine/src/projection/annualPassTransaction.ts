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
import type { SimulatorAnnualPassCapturedState } from
  '../internal/simulatorAnnualPassStateRegistry.js'
import {
  captureSimulatorAnnualPassState,
  restoreSimulatorAnnualPassState,
} from '../internal/simulatorAnnualPassStateRegistry.js'

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
  /** One captured value per registered key, produced by the state registry. */
  state: SimulatorAnnualPassCapturedState
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
    state: captureSimulatorAnnualPassState(bindings),
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

  restoreSimulatorAnnualPassState(bindings, snapshot.state)
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
