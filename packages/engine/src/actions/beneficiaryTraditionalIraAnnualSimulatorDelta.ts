import { planSchema, type Plan } from '../model/plan.js'
import {
  preparePlanBeneficiaryTraditionalIraAnnualApplication,
  type PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput,
  type PlanBeneficiaryTraditionalIraAnnualApplicationPreparedResult,
} from './beneficiaryTraditionalIraAnnualPlanApplication.js'
import {
  accountIdSchema,
  planIdSchema,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PlanId,
} from './identity.js'
import { type UsdCents } from './money.js'
import {
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
} from './planBalanceAdapter.js'
import { createActionReason, type ActionReason } from './reasons.js'
import {
  compareUtf16CodeUnits,
  deriveActionStructuralId,
} from './structuralId.js'
import { deepFreeze } from './freeze.js'
import { exactKeys, nonblank, plainDataSnapshot } from './plainData.js'

export interface BeneficiaryTraditionalIraSimulatorLedgerIdentity {
  predicate: 'beneficiaryTraditionalIraSimulatorLedgerIdentity'
  planId: PlanId
  taxYear: number
  simulatorRunId: string
  balanceSnapshotEvidenceId: string
}

export interface BeneficiaryTraditionalIraSimulatorAccountOpeningBalance {
  accountId: AccountId
  openingBalancePlanDollars: number
}

export interface DetachedSimulatorAnnualAccountBalanceSnapshot {
  predicate: 'detachedSimulatorAnnualAccountBalanceSnapshot'
  balanceSnapshotEvidenceId: string
  accountBalances:
    readonly Readonly<BeneficiaryTraditionalIraSimulatorAccountOpeningBalance>[]
}

export interface PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput
  extends PreparePlanBeneficiaryTraditionalIraAnnualApplicationInput {
  ledgerIdentity: Readonly<BeneficiaryTraditionalIraSimulatorLedgerIdentity>
  simulatorSnapshot: Readonly<DetachedSimulatorAnnualAccountBalanceSnapshot>
}

export interface BeneficiaryTraditionalIraSimulatorSourceDebitDelta {
  predicate: 'beneficiaryTraditionalIraSimulatorSourceDebitDelta'
  accountId: AccountId
  openingBalanceCents: UsdCents
  openingBalancePlanDollars: number
  debitAmountCents: UsdCents
  debitAmountPlanDollars: number
  closingBalanceCents: UsdCents
  closingBalancePlanDollars: number
  transactionSourceTransitionEvidenceId: string
  transactionApplicationEvidenceIds: readonly string[]
  sourceDeltaEvidenceId: string
}

export interface BeneficiaryTraditionalIraSimulatorActionApplicationDelta {
  predicate: 'beneficiaryTraditionalIraSimulatorActionApplicationDelta'
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  executionDate: string
  executionSequence: number
  sourceBalanceBeforeCents: UsdCents
  sourceBalanceBeforePlanDollars: number
  debitAmountCents: UsdCents
  debitAmountPlanDollars: number
  sourceBalanceAfterCents: UsdCents
  sourceBalanceAfterPlanDollars: number
  basisReturnExcludedAmountCents: UsdCents
  basisReturnExcludedAmountPlanDollars: number
  taxableAmountCents: UsdCents
  taxableAmountPlanDollars: number
  penaltyAmountCents: 0
  penaltyAmountPlanDollars: 0
  sourceCharacterEvidenceId: string
  penaltyEvidenceId: string
  sourceDeltaEvidenceId: string
  transactionApplicationEvidenceId: string
  actionDeltaEvidenceId: string
}

export interface BeneficiaryTraditionalIraSimulatorUnchangedAccountEvidence {
  predicate: 'beneficiaryTraditionalIraSimulatorUnchangedAccount'
  accountId: AccountId
  openingBalanceCents: UsdCents
  openingBalancePlanDollars: number
  closingBalanceCents: UsdCents
  closingBalancePlanDollars: number
  balanceSnapshotEvidenceId: string
  unchangedEvidenceId: string
}

export interface BeneficiaryTraditionalIraSimulatorRmdLedgerDelta {
  predicate: 'beneficiaryTraditionalIraSimulatorRmdLedgerDelta'
  rmdPoolId: string
  requiredAmountCents: UsdCents
  initialSatisfiedAmountCents: UsdCents
  satisfiedByTransactionCents: UsdCents
  finalSatisfiedAmountCents: UsdCents
  finalRemainingAmountCents: UsdCents
  actionDeltaEvidenceIds: readonly string[]
  transactionRmdTransitionEvidenceId: string
  rmdDeltaEvidenceId: string
}

export interface BeneficiaryTraditionalIraAnnualSimulatorDeltaPreparedResult {
  status: 'annualSimulatorDeltaPrepared'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  simulatorStatus: 'preparedDeltaOnly'
  reasons: readonly []
  planApplication:
    Readonly<PlanBeneficiaryTraditionalIraAnnualApplicationPreparedResult>
  ledgerIdentity: Readonly<BeneficiaryTraditionalIraSimulatorLedgerIdentity>
  sourceDeltas:
    readonly Readonly<BeneficiaryTraditionalIraSimulatorSourceDebitDelta>[]
  actionDeltas:
    readonly Readonly<BeneficiaryTraditionalIraSimulatorActionApplicationDelta>[]
  unchangedAccounts:
    readonly Readonly<BeneficiaryTraditionalIraSimulatorUnchangedAccountEvidence>[]
  rmdDelta: Readonly<BeneficiaryTraditionalIraSimulatorRmdLedgerDelta>
  simulatorApplicationEvidenceId: string
}

export interface UnsupportedBeneficiaryTraditionalIraAnnualSimulatorDeltaResult {
  status: 'unsupported'
  movement: 'notCommitted'
  committed: false
  actionability: 'notEstablished'
  simulatorStatus: 'notEstablished'
  reasons: readonly [Readonly<ActionReason>]
  planApplication: null
  ledgerIdentity: null
  sourceDeltas: readonly []
  actionDeltas: readonly []
  unchangedAccounts: readonly []
  rmdDelta: null
  simulatorApplicationEvidenceId: null
}

export type PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaResult =
  | BeneficiaryTraditionalIraAnnualSimulatorDeltaPreparedResult
  | UnsupportedBeneficiaryTraditionalIraAnnualSimulatorDeltaResult

const INPUT_KEYS = [
  'plan', 'planSnapshotEvidenceId', 'transactionInput',
  'annualOpeningBalances', 'inheritanceBindings', 'ledgerIdentity',
  'simulatorSnapshot',
] as const
const LEDGER_KEYS = [
  'predicate', 'planId', 'taxYear', 'simulatorRunId',
  'balanceSnapshotEvidenceId',
] as const
const SNAPSHOT_KEYS = [
  'predicate', 'balanceSnapshotEvidenceId', 'accountBalances',
] as const
const BALANCE_KEYS = ['accountId', 'openingBalancePlanDollars'] as const

function unsupported(): Readonly<
  UnsupportedBeneficiaryTraditionalIraAnnualSimulatorDeltaResult
> {
  return deepFreeze({
    status: 'unsupported', movement: 'notCommitted', committed: false,
    actionability: 'notEstablished', simulatorStatus: 'notEstablished',
    reasons: [createActionReason('withdrawal-inherited-facts-missing')],
    planApplication: null, ledgerIdentity: null, sourceDeltas: [],
    actionDeltas: [], unchangedAccounts: [], rmdDelta: null,
    simulatorApplicationEvidenceId: null,
  })
}

function identifierValues(
  value: unknown,
  key = '',
  result = new Set<string>(),
  seen = new WeakSet<object>(),
): Set<string> {
  if (typeof value === 'string') {
    if (key === 'id' || key.endsWith('Id')) result.add(value)
    return result
  }
  if (value === null || typeof value !== 'object' || seen.has(value)) return result
  seen.add(value)
  for (const [childKey, child] of Object.entries(value as Record<string, unknown>)) {
    if (Array.isArray(child) && childKey.endsWith('Ids')) {
      for (const item of child) if (typeof item === 'string') result.add(item)
    }
    identifierValues(child, childKey, result, seen)
  }
  return result
}

function claim(
  registry: Map<string, string>,
  value: string,
  role: string,
): boolean {
  const existing = registry.get(value)
  if (existing !== undefined) return existing === role
  registry.set(value, role)
  return true
}

function planBalances(
  plan: Plan,
  rows: readonly Readonly<BeneficiaryTraditionalIraSimulatorAccountOpeningBalance>[],
): Map<AccountId, { cents: UsdCents; dollars: number }> | null {
  const expectedAccounts = plan.accounts.filter((account) =>
    account.type === 'cash' || account.type === 'taxable' ||
    account.type === 'equityComp' || account.type === 'traditional' ||
    account.type === 'roth' || account.type === 'hsa')
  if (rows.length !== expectedAccounts.length) return null
  const result = new Map<AccountId, { cents: UsdCents; dollars: number }>()
  for (const account of expectedAccounts) {
    const accountId = accountIdSchema.safeParse(account.id)
    const matches = rows.filter((row) => row.accountId === account.id)
    if (matches.length !== 1 || !accountId.success || !('balance' in account)) {
      return null
    }
    const row = matches[0]!
    if (!accountIdSchema.safeParse(row.accountId).success) return null
    const cents = planDollarsToLedgerCents(row.openingBalancePlanDollars)
    if (ledgerCentsToPlanDollars(cents) !== row.openingBalancePlanDollars) {
      return null
    }
    result.set(accountId.data, { cents, dollars: row.openingBalancePlanDollars })
  }
  return result.size === expectedAccounts.length ? result : null
}

function actionCompare(
  left: { executionDate: string; executionSequence: number; actionId: string; allocationId: string },
  right: { executionDate: string; executionSequence: number; actionId: string; allocationId: string },
): number {
  return compareUtf16CodeUnits(left.executionDate, right.executionDate) ||
    left.executionSequence - right.executionSequence ||
    compareUtf16CodeUnits(left.actionId, right.actionId) ||
    compareUtf16CodeUnits(left.allocationId, right.allocationId)
}

function prepare(
  input: Readonly<PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput>,
): Readonly<PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaResult> {
  const raw = plainDataSnapshot(input)
  if (
    !exactKeys(raw, INPUT_KEYS) ||
    !exactKeys(raw.ledgerIdentity, LEDGER_KEYS) ||
    !exactKeys(raw.simulatorSnapshot, SNAPSHOT_KEYS) ||
    !Array.isArray(raw.simulatorSnapshot.accountBalances) ||
    raw.simulatorSnapshot.accountBalances.some((row) =>
      !exactKeys(row, BALANCE_KEYS))
  ) return unsupported()
  const snapshot = raw as unknown as
    PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput
  const ledger = snapshot.ledgerIdentity
  const balanceSnapshot = snapshot.simulatorSnapshot
  if (
    ledger.predicate !== 'beneficiaryTraditionalIraSimulatorLedgerIdentity' ||
    balanceSnapshot.predicate !== 'detachedSimulatorAnnualAccountBalanceSnapshot' ||
    !planIdSchema.safeParse(ledger.planId).success ||
    !Number.isSafeInteger(ledger.taxYear) ||
    !nonblank(ledger.simulatorRunId) ||
    !nonblank(ledger.balanceSnapshotEvidenceId) ||
    ledger.balanceSnapshotEvidenceId !== balanceSnapshot.balanceSnapshotEvidenceId
  ) return unsupported()
  const parsedPlan = planSchema.safeParse(snapshot.plan)
  if (!parsedPlan.success || parsedPlan.data.id !== ledger.planId) return unsupported()
  const planApplication = preparePlanBeneficiaryTraditionalIraAnnualApplication({
    plan: snapshot.plan,
    planSnapshotEvidenceId: snapshot.planSnapshotEvidenceId,
    transactionInput: snapshot.transactionInput,
    annualOpeningBalances: snapshot.annualOpeningBalances,
    inheritanceBindings: snapshot.inheritanceBindings,
  })
  if (
    planApplication.status !== 'planAnnualApplicationPrepared' ||
    planApplication.planBinding.planId !== ledger.planId ||
    planApplication.planBinding.taxYear !== ledger.taxYear
  ) return unsupported()
  const balances = planBalances(parsedPlan.data, balanceSnapshot.accountBalances)
  if (balances === null) return unsupported()
  const sourceIds = planApplication.transaction.sourceBalanceTransitions
    .map((transition) => transition.sourceAccountId)
    .sort(compareUtf16CodeUnits)
  if (new Set(sourceIds).size !== sourceIds.length) return unsupported()
  for (const transition of planApplication.transaction.sourceBalanceTransitions) {
    const simulatorBalance = balances.get(transition.sourceAccountId)
    const planOpening = planApplication.planBinding.sourceBindings.find(
      (binding) => binding.sourceAccountId === transition.sourceAccountId,
    )
    if (
      simulatorBalance === undefined || planOpening === undefined ||
      simulatorBalance.cents !== transition.annualOpeningBalanceAmount ||
      planOpening.annualOpeningBalanceAmount !== transition.annualOpeningBalanceAmount
    ) return unsupported()
  }

  const upstreamIds = identifierValues(planApplication)
  identifierValues(parsedPlan.data, '', upstreamIds)
  if (
    upstreamIds.has(ledger.simulatorRunId) ||
    upstreamIds.has(ledger.balanceSnapshotEvidenceId) ||
    ledger.simulatorRunId === ledger.balanceSnapshotEvidenceId
  ) return unsupported()
  const registry = new Map<string, string>()
  for (const value of upstreamIds) registry.set(value, 'upstream')
  if (
    !claim(registry, ledger.simulatorRunId, 'simulatorRun') ||
    !claim(registry, ledger.balanceSnapshotEvidenceId, 'simulatorBalanceSnapshot')
  ) return unsupported()

  const sourceDeltas: BeneficiaryTraditionalIraSimulatorSourceDebitDelta[] = []
  for (const transition of planApplication.transaction.sourceBalanceTransitions) {
    const withoutId = {
      predicate: 'beneficiaryTraditionalIraSimulatorSourceDebitDelta' as const,
      accountId: transition.sourceAccountId,
      openingBalanceCents: transition.annualOpeningBalanceAmount,
      openingBalancePlanDollars:
        ledgerCentsToPlanDollars(transition.annualOpeningBalanceAmount),
      debitAmountCents: transition.totalExecutedAmount,
      debitAmountPlanDollars:
        ledgerCentsToPlanDollars(transition.totalExecutedAmount),
      closingBalanceCents: transition.annualFinalBalanceAmount,
      closingBalancePlanDollars:
        ledgerCentsToPlanDollars(transition.annualFinalBalanceAmount),
      transactionSourceTransitionEvidenceId: transition.transitionEvidenceId,
      transactionApplicationEvidenceIds: transition.applicationEvidenceIds,
    }
    const sourceDeltaEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-simulator-source-debit-delta',
      [ledger, withoutId],
    )
    if (!claim(registry, sourceDeltaEvidenceId, 'sourceDelta')) return unsupported()
    sourceDeltas.push({ ...withoutId, sourceDeltaEvidenceId })
  }
  sourceDeltas.sort((left, right) =>
    compareUtf16CodeUnits(left.accountId, right.accountId))

  const actionDeltas: BeneficiaryTraditionalIraSimulatorActionApplicationDelta[] = []
  for (const application of planApplication.transaction.applications) {
    const members = planApplication.transaction.runtimeEvidence.annualEvidence
      .canonicalMembers.filter((member) =>
        member.candidate.actionId === application.actionId &&
        member.candidate.allocationId === application.allocationId &&
        member.candidate.sourceAccountId === application.sourceAccountId)
    if (members.length !== 1) return unsupported()
    const penalty = members[0]!.deathPenaltyEvidence
    const sourceDelta = sourceDeltas.find(
      (delta) => delta.accountId === application.sourceAccountId,
    )
    if (
      sourceDelta === undefined ||
      penalty.executedAmount !== application.executedAmount ||
      penalty.basisReturnExcludedAmount + penalty.taxableAmountExposed !==
        application.executedAmount || penalty.finalPenaltyAmount !== 0
    ) return unsupported()
    const withoutId = {
      predicate:
        'beneficiaryTraditionalIraSimulatorActionApplicationDelta' as const,
      actionId: application.actionId,
      allocationId: application.allocationId,
      sourceAccountId: application.sourceAccountId,
      executionDate: application.executionDate,
      executionSequence: application.executionSequence,
      sourceBalanceBeforeCents: application.sourceBalanceBefore,
      sourceBalanceBeforePlanDollars:
        ledgerCentsToPlanDollars(application.sourceBalanceBefore),
      debitAmountCents: application.executedAmount,
      debitAmountPlanDollars: ledgerCentsToPlanDollars(application.executedAmount),
      sourceBalanceAfterCents: application.sourceBalanceAfter,
      sourceBalanceAfterPlanDollars:
        ledgerCentsToPlanDollars(application.sourceBalanceAfter),
      basisReturnExcludedAmountCents: penalty.basisReturnExcludedAmount,
      basisReturnExcludedAmountPlanDollars:
        ledgerCentsToPlanDollars(penalty.basisReturnExcludedAmount),
      taxableAmountCents: penalty.taxableAmountExposed,
      taxableAmountPlanDollars:
        ledgerCentsToPlanDollars(penalty.taxableAmountExposed),
      penaltyAmountCents: 0 as const,
      penaltyAmountPlanDollars: 0 as const,
      sourceCharacterEvidenceId: penalty.sourceCharacterEvidenceId,
      penaltyEvidenceId: penalty.penaltyEvidenceId,
      sourceDeltaEvidenceId: sourceDelta.sourceDeltaEvidenceId,
      transactionApplicationEvidenceId: application.applicationEvidenceId,
    }
    const actionDeltaEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-simulator-action-application-delta',
      [ledger, withoutId],
    )
    if (!claim(registry, actionDeltaEvidenceId, 'actionDelta')) return unsupported()
    actionDeltas.push({ ...withoutId, actionDeltaEvidenceId })
  }
  actionDeltas.sort(actionCompare)

  const unchangedAccounts:
    BeneficiaryTraditionalIraSimulatorUnchangedAccountEvidence[] = []
  const sourceSet = new Set(sourceIds)
  for (const account of parsedPlan.data.accounts) {
    if (
      account.type !== 'cash' && account.type !== 'taxable' &&
      account.type !== 'equityComp' && account.type !== 'traditional' &&
      account.type !== 'roth' && account.type !== 'hsa'
    ) continue
    const accountId = accountIdSchema.safeParse(account.id)
    if (!accountId.success) return unsupported()
    if (sourceSet.has(accountId.data)) continue
    const balance = balances.get(accountId.data)
    if (balance === undefined) return unsupported()
    const withoutId = {
      predicate: 'beneficiaryTraditionalIraSimulatorUnchangedAccount' as const,
      accountId: accountId.data,
      openingBalanceCents: balance.cents,
      openingBalancePlanDollars: balance.dollars,
      closingBalanceCents: balance.cents,
      closingBalancePlanDollars: balance.dollars,
      balanceSnapshotEvidenceId: ledger.balanceSnapshotEvidenceId,
    }
    const unchangedEvidenceId = deriveActionStructuralId(
      'beneficiary-ira-simulator-unchanged-account',
      [ledger, withoutId],
    )
    if (!claim(registry, unchangedEvidenceId, 'unchangedAccount')) {
      return unsupported()
    }
    unchangedAccounts.push({ ...withoutId, unchangedEvidenceId })
  }
  unchangedAccounts.sort((left, right) =>
    compareUtf16CodeUnits(left.accountId, right.accountId))

  const transactionRmd = planApplication.transaction.rmdTransition
  const rmdWithoutId = {
    predicate: 'beneficiaryTraditionalIraSimulatorRmdLedgerDelta' as const,
    rmdPoolId: transactionRmd.rmdPoolId,
    requiredAmountCents: transactionRmd.rmdRequiredAmount,
    initialSatisfiedAmountCents: transactionRmd.initialRmdSatisfiedAmount,
    satisfiedByTransactionCents: transactionRmd.rmdSatisfiedByTransaction,
    finalSatisfiedAmountCents: transactionRmd.finalRmdSatisfiedAmount,
    finalRemainingAmountCents: transactionRmd.finalRmdRemainingAmount,
    actionDeltaEvidenceIds: actionDeltas.map((entry) => entry.actionDeltaEvidenceId),
    transactionRmdTransitionEvidenceId: transactionRmd.transitionEvidenceId,
  }
  const rmdDeltaEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-simulator-rmd-ledger-delta',
    [ledger, rmdWithoutId],
  )
  if (!claim(registry, rmdDeltaEvidenceId, 'rmdDelta')) return unsupported()
  const rmdDelta = { ...rmdWithoutId, rmdDeltaEvidenceId }

  const simulatorApplicationEvidenceId = deriveActionStructuralId(
    'beneficiary-ira-simulator-annual-application',
    [[
      ledger.planId, ledger.taxYear, ledger.simulatorRunId,
      ledger.balanceSnapshotEvidenceId, planApplication.planBinding.evidenceId,
      planApplication.transaction.transactionEvidenceId,
      sourceDeltas.map((entry) => entry.sourceDeltaEvidenceId),
      actionDeltas.map((entry) => entry.actionDeltaEvidenceId),
      unchangedAccounts.map((entry) => entry.unchangedEvidenceId),
      rmdDelta.rmdDeltaEvidenceId,
    ]],
  )
  if (!claim(registry, simulatorApplicationEvidenceId, 'simulatorApplication')) {
    return unsupported()
  }
  return deepFreeze({
    status: 'annualSimulatorDeltaPrepared', movement: 'notCommitted',
    committed: false, actionability: 'notEstablished',
    simulatorStatus: 'preparedDeltaOnly', reasons: [], planApplication,
    ledgerIdentity: ledger, sourceDeltas, actionDeltas, unchangedAccounts,
    rmdDelta, simulatorApplicationEvidenceId,
  })
}

/**
 * Rebuilds the Plan-bound beneficiary IRA transaction and prepares immutable,
 * detached simulator deltas. It does not mutate Plan or simulator state and
 * establishes neither movement nor actionability authority.
 */
export function prepareBeneficiaryTraditionalIraAnnualSimulatorDelta(
  input: Readonly<PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaInput>,
): Readonly<PrepareBeneficiaryTraditionalIraAnnualSimulatorDeltaResult> {
  try {
    return prepare(input)
  } catch {
    return unsupported()
  }
}
