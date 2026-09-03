import {
  prepareBeneficiaryTraditionalIraAnnualSimulatorDelta,
  type BeneficiaryTraditionalIraSimulatorActionApplicationDelta,
  type BeneficiaryTraditionalIraSimulatorRmdLedgerDelta,
  type BeneficiaryTraditionalIraSimulatorSourceDebitDelta,
} from '../actions/beneficiaryTraditionalIraAnnualSimulatorDelta.js'
import type {
  BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence,
  BeneficiaryTraditionalIraPlanInheritanceBinding,
} from '../actions/beneficiaryTraditionalIraAnnualPlanApplication.js'
import type { PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput } from
  '../actions/beneficiaryTraditionalIraAnnualPhysicalTransaction.js'
import {
  accountIdSchema,
  planIdSchema,
  type AccountId,
  type PlanId,
} from '../actions/identity.js'
import { planDollarsToLedgerCents, ledgerCentsToPlanDollars } from
  '../actions/planBalanceAdapter.js'
import { compareUtf16CodeUnits } from '../actions/structuralId.js'
import { planSchema, type Plan } from '../model/plan.js'
import {
  beginSimulatorAnnualPassTransaction,
  type SimulatorAnnualPassBalanceRecord,
  type SimulatorAnnualPassStateBindings,
  type SimulatorAnnualPassTransaction,
} from './annualPassTransaction.js'
import { deepFreeze } from '../actions/freeze.js'
import { INVALID_SNAPSHOT, exactKeys, nonblank, plainDataSnapshot } from '../actions/plainData.js'

export interface BeneficiaryTraditionalIraAnnualPassAccountRow {
  readonly accountId: AccountId
  readonly openingBalancePlanDollars: number
}

/** The provider sees a detached checkpoint view, never simulator or Plan references. */
export interface BeneficiaryTraditionalIraAnnualPassEvidenceContext {
  readonly planId: PlanId
  readonly taxYear: number
  readonly accountBalances:
    readonly Readonly<BeneficiaryTraditionalIraAnnualPassAccountRow>[]
}

export interface BeneficiaryTraditionalIraAnnualPassEvidenceFacts {
  readonly transactionInput:
    Readonly<PrepareBeneficiaryTraditionalIraAnnualPhysicalTransactionInput>
  readonly annualOpeningBalances:
    readonly Readonly<BeneficiaryTraditionalIraAnnualOpeningBalanceEvidence>[]
  readonly inheritanceBindings:
    readonly Readonly<BeneficiaryTraditionalIraPlanInheritanceBinding>[]
}

export type ProvideBeneficiaryTraditionalIraAnnualPassEvidence = (
  context: Readonly<BeneficiaryTraditionalIraAnnualPassEvidenceContext>,
) => Readonly<BeneficiaryTraditionalIraAnnualPassEvidenceFacts> | null

export interface ApplyBeneficiaryTraditionalIraAnnualPassInput {
  readonly state: SimulatorAnnualPassStateBindings
  readonly plan: Plan
  readonly taxYear: number
  readonly planSnapshotEvidenceId: string
  readonly simulatorRunId: string
  readonly balanceSnapshotEvidenceId: string
  readonly provideEvidence: ProvideBeneficiaryTraditionalIraAnnualPassEvidence
}

/**
 * A detached hand-off value. Committing its annual-pass transaction does not
 * commit the underlying beneficiary movement or establish actionability.
 */
export interface BeneficiaryTraditionalIraAnnualPassDeferredEvidence {
  readonly predicate: 'beneficiaryTraditionalIraAnnualPassDeferredEvidence'
  readonly planId: PlanId
  readonly taxYear: number
  readonly simulatorRunId: string
  readonly balanceSnapshotEvidenceId: string
  readonly sourceDeltas:
    readonly Readonly<BeneficiaryTraditionalIraSimulatorSourceDebitDelta>[]
  readonly actionDeltas:
    readonly Readonly<BeneficiaryTraditionalIraSimulatorActionApplicationDelta>[]
  readonly rmdDelta: Readonly<BeneficiaryTraditionalIraSimulatorRmdLedgerDelta>
  readonly simulatorApplicationEvidenceId: string
}

export interface BeneficiaryTraditionalIraAnnualPassAppliedResult {
  readonly status: 'beneficiaryTraditionalIraAnnualPassApplied'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly simulatorStatus: 'appliedToAnnualPassState'
  readonly deferredEvidence:
    Readonly<BeneficiaryTraditionalIraAnnualPassDeferredEvidence>
}

export interface UnsupportedBeneficiaryTraditionalIraAnnualPassResult {
  readonly status: 'unsupported'
  readonly movement: 'notCommitted'
  readonly committed: false
  readonly actionability: 'notEstablished'
  readonly simulatorStatus: 'notEstablished'
  readonly deferredEvidence: null
}

export type ApplyBeneficiaryTraditionalIraAnnualPassResult =
  | BeneficiaryTraditionalIraAnnualPassAppliedResult
  | UnsupportedBeneficiaryTraditionalIraAnnualPassResult

const INPUT_KEYS = [
  'state', 'plan', 'taxYear', 'planSnapshotEvidenceId', 'simulatorRunId',
  'balanceSnapshotEvidenceId', 'provideEvidence',
] as const
const FACT_KEYS = [
  'transactionInput', 'annualOpeningBalances', 'inheritanceBindings',
] as const

function unsupported(): Readonly<UnsupportedBeneficiaryTraditionalIraAnnualPassResult> {
  return deepFreeze({
    status: 'unsupported', movement: 'notCommitted', committed: false,
    actionability: 'notEstablished', simulatorStatus: 'notEstablished',
    deferredEvidence: null,
  })
}

function inputReferences(value: unknown): ApplyBeneficiaryTraditionalIraAnnualPassInput | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null
  try {
    const prototype = Object.getPrototypeOf(value)
    if (prototype !== Object.prototype && prototype !== null) return null
    const keys = Reflect.ownKeys(value)
    if (
      keys.length !== INPUT_KEYS.length ||
      keys.some((key) => typeof key !== 'string' || !INPUT_KEYS.includes(
        key as typeof INPUT_KEYS[number],
      ))
    ) return null
    const output = Object.create(null) as Record<string, unknown>
    for (const key of INPUT_KEYS) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key)
      if (
        descriptor === undefined || !descriptor.enumerable ||
        !Object.hasOwn(descriptor, 'value')
      ) return null
      output[key] = descriptor.value
    }
    return output as unknown as ApplyBeneficiaryTraditionalIraAnnualPassInput
  } catch {
    return null
  }
}

interface CurrentBalances {
  readonly rows: readonly Readonly<BeneficiaryTraditionalIraAnnualPassAccountRow>[]
  readonly records: ReadonlyMap<AccountId, SimulatorAnnualPassBalanceRecord>
}

/**
 * Materializes the live balance rows through property descriptors.
 *
 * The evidence provider is handed `state`, so it can replace `state.balances`
 * with a Proxy. Reading `.length` or indexing it directly would run the provider's
 * traps inside the boundary `plainDataSnapshot` exists to hold -- and the record
 * objects cannot simply be taken from the snapshot, because they are mutated
 * later and must be the live ones.
 */
function liveBalanceRecords(
  state: SimulatorAnnualPassStateBindings,
): { readonly source: unknown; readonly records: SimulatorAnnualPassBalanceRecord[] } | null {
  const balances = Object.getOwnPropertyDescriptor(state, 'balances')
  if (balances === undefined || !Object.hasOwn(balances, 'value')) return null
  const value: unknown = balances.value
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype) {
    return null
  }
  const length = Object.getOwnPropertyDescriptor(value, 'length')
  const size = length?.value
  if (
    length === undefined || length.enumerable || !Object.hasOwn(length, 'value') ||
    typeof size !== 'number' || !Number.isSafeInteger(size) || size < 0
  ) return null
  const records: SimulatorAnnualPassBalanceRecord[] = []
  for (let index = 0; index < size; index += 1) {
    const entry = Object.getOwnPropertyDescriptor(value, String(index))
    if (entry === undefined || !entry.enumerable || !Object.hasOwn(entry, 'value')) {
      return null
    }
    records.push(entry.value as SimulatorAnnualPassBalanceRecord)
  }
  // The array itself is handed back so the snapshot can be taken from the same
  // object these records came from. Re-reading `state.balances` would be a
  // second property access, and a getter or Proxy could answer it with a
  // different array than the one just materialized.
  return { source: value, records }
}

function currentBalances(state: SimulatorAnnualPassStateBindings): CurrentBalances | null {
  const live = liveBalanceRecords(state)
  if (live === null) return null
  const snapshot = plainDataSnapshot(live.source)
  if (!Array.isArray(snapshot) || snapshot.length !== live.records.length) return null
  const rows: BeneficiaryTraditionalIraAnnualPassAccountRow[] = []
  const records = new Map<AccountId, SimulatorAnnualPassBalanceRecord>()
  for (let index = 0; index < snapshot.length; index += 1) {
    const detached = snapshot[index]
    const record = live.records[index]
    if (
      detached === null || typeof detached !== 'object' ||
      Array.isArray(detached) || record === undefined
    ) return null
    const account = (detached as Record<string, unknown>).account
    const balance = (detached as Record<string, unknown>).balance
    if (account === null || typeof account !== 'object' || Array.isArray(account)) {
      return null
    }
    const accountId = accountIdSchema.safeParse(
      (account as Record<string, unknown>).id,
    )
    if (!accountId.success || records.has(accountId.data) || typeof balance !== 'number') {
      return null
    }
    const cents = planDollarsToLedgerCents(balance)
    if (ledgerCentsToPlanDollars(cents) !== balance) return null
    rows.push({ accountId: accountId.data, openingBalancePlanDollars: balance })
    records.set(accountId.data, record)
  }
  rows.sort((left, right) => compareUtf16CodeUnits(left.accountId, right.accountId))
  return { rows: deepFreeze(rows), records }
}

function providerFacts(value: unknown): BeneficiaryTraditionalIraAnnualPassEvidenceFacts | null {
  const snapshot = plainDataSnapshot(value)
  if (!exactKeys(snapshot, FACT_KEYS)) return null
  return snapshot as unknown as BeneficiaryTraditionalIraAnnualPassEvidenceFacts
}

function rollback(
  transaction: SimulatorAnnualPassTransaction<unknown> | null,
): void {
  if (transaction?.status === 'open') transaction.rollback()
}

function deferredEvidence(
  planId: PlanId,
  taxYear: number,
  simulatorRunId: string,
  balanceSnapshotEvidenceId: string,
  delta: Extract<
    ReturnType<typeof prepareBeneficiaryTraditionalIraAnnualSimulatorDelta>,
    { readonly status: 'annualSimulatorDeltaPrepared' }
  >,
): Readonly<BeneficiaryTraditionalIraAnnualPassDeferredEvidence> {
  return deepFreeze({
    predicate: 'beneficiaryTraditionalIraAnnualPassDeferredEvidence',
    planId, taxYear, simulatorRunId, balanceSnapshotEvidenceId,
    sourceDeltas: delta.sourceDeltas.map((entry) => ({
      ...entry,
      transactionApplicationEvidenceIds: [...entry.transactionApplicationEvidenceIds],
    })),
    actionDeltas: delta.actionDeltas.map((entry) => ({ ...entry })),
    rmdDelta: {
      ...delta.rmdDelta,
      actionDeltaEvidenceIds: [...delta.rmdDelta.actionDeltaEvidenceIds],
    },
    simulatorApplicationEvidenceId: delta.simulatorApplicationEvidenceId,
  })
}

function apply(
  supplied: unknown,
): Readonly<ApplyBeneficiaryTraditionalIraAnnualPassResult> {
  const input = inputReferences(supplied)
  if (
    input === null || typeof input.provideEvidence !== 'function' ||
    !Number.isSafeInteger(input.taxYear) || input.taxYear < 1 || input.taxYear > 9999 ||
    !nonblank(input.planSnapshotEvidenceId) || !nonblank(input.simulatorRunId) ||
    !nonblank(input.balanceSnapshotEvidenceId)
  ) return unsupported()
  const detachedPlan = plainDataSnapshot(input.plan)
  const parsedPlan = detachedPlan === INVALID_SNAPSHOT
    ? null
    : planSchema.safeParse(detachedPlan)
  const planId = parsedPlan?.success === true
    ? planIdSchema.safeParse(parsedPlan.data.id)
    : null
  if (planId === null || !planId.success) return unsupported()

  let acquisition:
    SimulatorAnnualPassTransaction<BeneficiaryTraditionalIraAnnualPassDeferredEvidence> |
    null = null
  let facts: BeneficiaryTraditionalIraAnnualPassEvidenceFacts | null = null
  try {
    acquisition = beginSimulatorAnnualPassTransaction(input.state)
    const baseline = currentBalances(input.state)
    if (baseline !== null) {
      const context = deepFreeze({
        planId: planId.data,
        taxYear: input.taxYear,
        accountBalances: baseline.rows.map((row) => ({ ...row })),
      })
      facts = providerFacts(input.provideEvidence(context))
    }
  } catch {
    facts = null
  } finally {
    try {
      rollback(acquisition)
    } catch {
      facts = null
    }
  }
  if (facts === null) return unsupported()

  let application:
    SimulatorAnnualPassTransaction<BeneficiaryTraditionalIraAnnualPassDeferredEvidence> |
    null = null
  try {
    application = beginSimulatorAnnualPassTransaction(input.state)
    const current = currentBalances(input.state)
    if (current === null) {
      application.rollback()
      return unsupported()
    }
    const delta = prepareBeneficiaryTraditionalIraAnnualSimulatorDelta({
      plan: detachedPlan,
      planSnapshotEvidenceId: input.planSnapshotEvidenceId,
      transactionInput: facts.transactionInput,
      annualOpeningBalances: facts.annualOpeningBalances,
      inheritanceBindings: facts.inheritanceBindings,
      ledgerIdentity: {
        predicate: 'beneficiaryTraditionalIraSimulatorLedgerIdentity',
        planId: planId.data,
        taxYear: input.taxYear,
        simulatorRunId: input.simulatorRunId,
        balanceSnapshotEvidenceId: input.balanceSnapshotEvidenceId,
      },
      simulatorSnapshot: {
        predicate: 'detachedSimulatorAnnualAccountBalanceSnapshot',
        balanceSnapshotEvidenceId: input.balanceSnapshotEvidenceId,
        accountBalances: current.rows,
      },
    })
    if (delta.status !== 'annualSimulatorDeltaPrepared') {
      application.rollback()
      return unsupported()
    }
    // Indexed once rather than scanned per delta: the previous find() made this
    // O(rows x deltas). The row check is kept rather than folded into the
    // record check -- record.balance and row.openingBalancePlanDollars compare
    // against the same number, but the row lookup also asserts the account is
    // present in the balance rows at all, which the records map does not.
    const rowsByAccountId = new Map(
      current.rows.map((entry) => [entry.accountId, entry]),
    )
    for (const sourceDelta of delta.sourceDeltas) {
      const row = rowsByAccountId.get(sourceDelta.accountId)
      const record = current.records.get(sourceDelta.accountId)
      if (
        row === undefined || record === undefined ||
        row.openingBalancePlanDollars !== sourceDelta.openingBalancePlanDollars ||
        record.balance !== sourceDelta.openingBalancePlanDollars
      ) {
        application.rollback()
        return unsupported()
      }
    }
    if (new Set(delta.sourceDeltas.map((entry) => entry.accountId)).size !==
        delta.sourceDeltas.length) {
      application.rollback()
      return unsupported()
    }
    for (const sourceDelta of delta.sourceDeltas) {
      current.records.get(sourceDelta.accountId)!.balance =
        sourceDelta.closingBalancePlanDollars
    }
    const evidence = deferredEvidence(
      planId.data,
      input.taxYear,
      input.simulatorRunId,
      input.balanceSnapshotEvidenceId,
      delta,
    )
    application.defer(evidence)
    const settlement = application.commit()
    if (settlement.deferredEffects.length !== 1 || settlement.deferredEffects[0] !== evidence) {
      throw new Error('Beneficiary annual-pass commit lost its evidence bundle')
    }
    return deepFreeze({
      status: 'beneficiaryTraditionalIraAnnualPassApplied',
      movement: 'notCommitted', committed: false,
      actionability: 'notEstablished',
      simulatorStatus: 'appliedToAnnualPassState',
      deferredEvidence: settlement.deferredEffects[0],
    })
  } catch {
    try {
      rollback(application)
    } catch {
      // The transaction owns best-effort restoration even for hostile bindings.
    }
    return unsupported()
  }
}

/**
 * Acquires detached annual evidence under rollback, then applies a freshly
 * rebuilt and source-revalidated beneficiary IRA delta in a new transaction.
 */
export function applyBeneficiaryTraditionalIraAnnualPass(
  input: Readonly<ApplyBeneficiaryTraditionalIraAnnualPassInput>,
): Readonly<ApplyBeneficiaryTraditionalIraAnnualPassResult> {
  try {
    return apply(input)
  } catch {
    return unsupported()
  }
}
