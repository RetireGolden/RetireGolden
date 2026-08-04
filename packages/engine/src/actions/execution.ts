import type { Plan } from '../model/plan.js'
import { evaluateRetirementActionEligibilityFromPlan } from '../strategies/accountEligibility.js'
import {
  assessConversionLinkedWithdrawalGroups,
  conversionLinkedWithdrawalGroupForWithdrawal,
  type RetirementActionGroupRuntimeEvidence,
} from './conversionLinkedWithdrawalGroup.js'
import {
  actionExecutionDispositionSchema,
  retirementActionRequestSchema,
  type ActionExecutionDisposition,
  type ActionProvenance,
  type ExecutedActionDisposition,
  type OrdinaryWithdrawalRequest,
  type PartialActionDisposition,
  type RetirementActionRequest,
  type SourceAllocationRequest,
  type WithdrawalPurpose,
} from './contract.js'
import {
  accountIdSchema,
  asPersonId,
  type AccountId,
  type ActionId,
  type AllocationId,
  type PersonId,
} from './identity.js'
import {
  asPositiveUsdCents,
  asUsdCents,
  usdCentsSchema,
  type PositiveUsdCents,
  type UsdCents,
} from './money.js'
import { createActionReason, type ActionReason } from './reasons.js'
import { formatCivilDate, parseCivilIsoDate } from './civilDate.js'
import {
  classifyIndividuallyOwnedTaxableWithdrawal,
  type AcceptedIndividuallyOwnedTaxableSourceEligibilityEvidence,
  type IndividuallyOwnedTaxableAccountOwnershipEvidence,
  type IndividuallyOwnedTaxableWithdrawalTaxCharacter,
  type TaxableWithdrawalTaxUnitEvidence,
} from './taxableWithdrawalCharacter.js'
import {
  ledgerCentTotalToPlanDollars,
  ledgerCentsToPlanDollars,
  signedLedgerCentTotalToPlanDollars,
} from './planBalanceAdapter.js'

export interface AccountOpeningBalanceSnapshot {
  accountId: AccountId
  openingBalance: UsdCents
}

export interface AccountBalanceExecutionEvidence extends AccountOpeningBalanceSnapshot {
  closingBalance: UsdCents
}

export interface TaxableAccountOpeningSnapshot {
  accountId: AccountId
  openingCostBasis: UsdCents
  ownership: Readonly<IndividuallyOwnedTaxableAccountOwnershipEvidence>
  taxUnit: Readonly<TaxableWithdrawalTaxUnitEvidence>
}

export interface TaxableAccountBasisExecutionEvidence
  extends TaxableAccountOpeningSnapshot {
  closingCostBasis: UsdCents
}

interface SourceAllocationExecutionEvidenceBase {
  allocationId: AllocationId
  sourceAccountId: AccountId
  requestedAmount: PositiveUsdCents
  balanceBefore: UsdCents | null
  executedAmount: UsdCents
  unexecutedAmount: UsdCents
  balanceAfter: UsdCents | null
}

export type SourceAllocationExecutionEvidence =
  | Readonly<
      SourceAllocationExecutionEvidenceBase & {
        resolution: 'resolved'
        ownerPersonIds: readonly PersonId[]
        actingPersonId: PersonId | null
      }
    >
  | Readonly<
      SourceAllocationExecutionEvidenceBase & {
        resolution: 'unresolved'
        ownerPersonIds: null
        actingPersonId: null
      }
    >

export type ResolvedCashSourceAllocationExecutionEvidence = Readonly<
  SourceAllocationExecutionEvidenceBase & {
    resolution: 'resolved'
    ownerPersonIds: readonly [PersonId]
    actingPersonId: PersonId
  }
>

export type ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence = Readonly<
  SourceAllocationExecutionEvidenceBase & {
    resolution: 'resolved'
    ownerPersonIds: readonly [PersonId]
    actingPersonId: PersonId
  }
>

export interface AcceptedCashSourceEligibilityEvidence {
  predicate: 'isSpendableInYear'
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  sourceClass: 'cash'
  availabilityEvidence: Readonly<{ kind: 'intrinsicallySpendable' }>
}

export interface EquityCompensationCharacterEvidence {
  rule: 'fullyTaxableCompensationAtExecution'
  allocationId: AllocationId
  sourceAccountId: AccountId
  actingPersonId: PersonId
  evaluationDate: string
  vestingEvidenceId: string
  executedAmount: UsdCents
  ordinaryIncomeAmount: UsdCents
  characterEvidenceId: string
}

export interface AcceptedEquityCompensationSourceEligibilityEvidence {
  predicate: 'isSpendableInYear'
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  sourceClass: 'equityCompensation'
  availabilityEvidence: Readonly<
    | {
        kind: 'alreadyVested'
        vestingMode: 'final'
        vestingEvidenceId: string
        vestedOnEvaluationDate: true
      }
    | {
        kind: 'vested'
        vestingMode: 'cliff'
        vestingDate: string
        vestingEvidenceId: string
        vestedOnEvaluationDate: true
      }
  >
  characterEvidence: Readonly<EquityCompensationCharacterEvidence>
}

export interface AcceptedZeroExecutionTaxableSourceEligibilityEvidence {
  predicate: 'classifyWithdrawalSource'
  allocationId: AllocationId
  sourceAccountId: AccountId
  evaluationDate: string
  sourceClass: 'taxable'
  basisEvidence: Readonly<{
    method: 'notApplicableZeroExecution'
    preExecutionFairMarketValue: 0
    remainingCostBasisBeforeExecution: 0
    executedAmount: 0
    basisRecoveredAmount: 0
    realizedCapitalGainOrLossAmount: 0
    ratio: Readonly<{
      representation: 'notApplicableZeroDenominator'
      numeratorMinorUnits: 0
      denominatorMinorUnits: 0
      intermediateArithmetic: 'none'
    }>
    basisPreservedAmount: 0
    reason: 'depletedSource'
    basisEvidenceId: string
  }>
}

export type AcceptedOrdinaryWithdrawalSourceEligibilityEvidence =
  | AcceptedCashSourceEligibilityEvidence
  | AcceptedEquityCompensationSourceEligibilityEvidence
  | AcceptedIndividuallyOwnedTaxableSourceEligibilityEvidence
  | AcceptedZeroExecutionTaxableSourceEligibilityEvidence

export interface CashPrincipalTaxCharacter {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'cash'
  kind: 'cashPrincipal'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'intrinsicCashPrincipal'
    allocationId: AllocationId
    segmentAmount: PositiveUsdCents
  }>
}

export interface EquityCompensationOrdinaryIncomeTaxCharacter {
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  sourceClass: 'equityCompensation'
  kind: 'ordinaryIncome'
  amount: PositiveUsdCents
  characterEvidence: Readonly<{
    rule: 'fullyTaxableCompensationAtExecution'
    sourceCharacterEvidenceId: string
    segmentAmount: PositiveUsdCents
  }>
}

export type OrdinaryWithdrawalTaxCharacter =
  | CashPrincipalTaxCharacter
  | EquityCompensationOrdinaryIncomeTaxCharacter
  | IndividuallyOwnedTaxableWithdrawalTaxCharacter

export interface NonRetirementSourcePenaltyCoverageEvidence {
  coverageEvidenceId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  applicability: 'notApplicable'
  sourceClass: 'cash' | 'equityCompensation' | 'taxable'
  reason: 'nonRetirementSource'
  executedAmount: UsdCents
  penaltyRelevantCharacterAmount: 0
  nonPenaltyRelevantCharacterAmount: UsdCents
  coveredPenaltyExposureAmount: 0
  coverageDifferenceAmount: 0
  segments: readonly []
}

export interface CashSourcePenaltyCoverageEvidence {
  coverageEvidenceId: string
  actionId: ActionId
  allocationId: AllocationId
  sourceAccountId: AccountId
  applicability: 'notApplicable'
  sourceClass: 'cash'
  reason: 'nonRetirementSource'
  executedAmount: UsdCents
  penaltyRelevantCharacterAmount: 0
  nonPenaltyRelevantCharacterAmount: UsdCents
  coveredPenaltyExposureAmount: 0
  coverageDifferenceAmount: 0
  segments: readonly []
}

export type EquityCompensationSourcePenaltyCoverageEvidence =
  Omit<NonRetirementSourcePenaltyCoverageEvidence, 'sourceClass'> & {
    sourceClass: 'equityCompensation'
  }

export type TaxableSourcePenaltyCoverageEvidence =
  Omit<NonRetirementSourcePenaltyCoverageEvidence, 'sourceClass'> & {
    sourceClass: 'taxable'
  }

interface OrdinaryWithdrawalExecutionEvidenceBase {
  request: Readonly<RetirementActionRequest>
  actionId: ActionId
  kind: RetirementActionRequest['kind']
  personId: PersonId | null
  year: number
  scheduledDate: string | null
  scheduledSequence: number | null
  requestedAmount: PositiveUsdCents
  provenance: Readonly<ActionProvenance>
  purpose: Readonly<WithdrawalPurpose> | null
  allocations: readonly SourceAllocationExecutionEvidence[]
  disposition: ActionExecutionDisposition
}

export type OrdinaryWithdrawalExecutedActionDisposition = Readonly<
  Omit<ExecutedActionDisposition, 'executedAmount' | 'reasons'> & {
    executedAmount: PositiveUsdCents
    reasons: readonly []
  }
>

export type OrdinaryWithdrawalPartialActionDisposition = Readonly<
  Omit<PartialActionDisposition, 'executedAmount' | 'reasons'> & {
    executedAmount: PositiveUsdCents
    reasons: readonly [ActionReason<'source-balance-trimmed'>]
  }
>

export type OrdinaryWithdrawalActionableExecutionDisposition =
  | OrdinaryWithdrawalExecutedActionDisposition
  | OrdinaryWithdrawalPartialActionDisposition

export type OrdinaryWithdrawalExecutionEvidence =
  | Readonly<
      Omit<
        OrdinaryWithdrawalExecutionEvidenceBase,
        'request' | 'kind' | 'personId' | 'purpose' | 'allocations' | 'disposition'
      > & {
        readiness: 'actionable'
        request: Readonly<OrdinaryWithdrawalRequest>
        kind: 'ordinaryWithdrawal'
        personId: PersonId
        purpose: Readonly<WithdrawalPurpose>
        allocations: readonly [
          ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence,
          ...ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence[],
        ]
        disposition: OrdinaryWithdrawalActionableExecutionDisposition
        executedDate: string
        executedSequence: number
        acceptedSourceEligibility: readonly [
          AcceptedOrdinaryWithdrawalSourceEligibilityEvidence,
          ...AcceptedOrdinaryWithdrawalSourceEligibilityEvidence[],
        ]
        taxCharacter: readonly [
          OrdinaryWithdrawalTaxCharacter,
          ...OrdinaryWithdrawalTaxCharacter[],
        ]
        penalty: readonly []
        penaltyCoverage: readonly [
          NonRetirementSourcePenaltyCoverageEvidence,
          ...NonRetirementSourcePenaltyCoverageEvidence[],
        ]
      }
    >
  | Readonly<
      OrdinaryWithdrawalExecutionEvidenceBase & {
        readiness: 'nonActionable'
        executedDate: null
        executedSequence: null
        taxCharacter: readonly []
        penalty: readonly []
      }
    >

export interface ExecuteOrdinaryWithdrawalsInput {
  year: number
  plan: Plan
  requests: readonly RetirementActionRequest[]
  openingBalances: readonly AccountOpeningBalanceSnapshot[]
  /**
   * Supplying this field explicitly enables individually owned taxable sources.
   * Omission preserves the pre-WS3.4b cash/equity-only boundary used by the
   * annual simulator until it can construct the immutable evidence losslessly.
   */
  taxableAccountSnapshots?: readonly TaxableAccountOpeningSnapshot[]
  /**
   * Eligibility evidence, widened by the conversion-side facts the linked
   * withdrawal group decision needs. This executor never sees the conversion
   * requests themselves — they are executed in a later simulator phase from a
   * different request set — so the group verdict is supplied rather than
   * rederived here.
   */
  runtimeEvidence?: RetirementActionGroupRuntimeEvidence
}

export interface ExecuteOrdinaryWithdrawalsResult {
  committed: boolean
  /** Canonical immutable requests evaluated by this annual transaction. */
  requests: readonly Readonly<RetirementActionRequest>[]
  scheduleIssues: readonly OrdinaryWithdrawalExecutionScheduleIssue[]
  balances: readonly AccountBalanceExecutionEvidence[]
  taxableBases: readonly TaxableAccountBasisExecutionEvidence[]
  evidence: readonly OrdinaryWithdrawalExecutionEvidence[]
}

export interface OrdinaryWithdrawalPlanBoundaryAssessment {
  unrepresentableClosingBalanceAccountIds: readonly AccountId[]
  unrepresentableClosingBasisAccountIds: readonly AccountId[]
  aggregateFailureSourceAccountIds: readonly AccountId[]
  totals: Readonly<{
    cash: number | null
    equityCompensation: number | null
    taxableProceeds: number | null
    proceeds: number | null
    capitalGainOrLoss: number | null
  }>
}

/**
 * Evaluate the only lossy boundary after exact-cent ordinary-withdrawal
 * execution: publishing closing values and annual totals back into Plan
 * numbers. Both projection and planner preview consume this function so
 * proportional basis math and same-year aggregation are never reimplemented
 * by a UI caller.
 */
export function assessOrdinaryWithdrawalPlanBoundary(
  result: Readonly<ExecuteOrdinaryWithdrawalsResult>,
): Readonly<OrdinaryWithdrawalPlanBoundaryAssessment> {
  const unrepresentableClosingBalanceAccountIds = result.balances
    .filter((snapshot) => snapshot.closingBalance !== snapshot.openingBalance)
    .flatMap((snapshot) => {
      try {
        ledgerCentsToPlanDollars(snapshot.closingBalance)
        return []
      } catch {
        return [snapshot.accountId]
      }
    })
  const unrepresentableClosingBasisAccountIds = result.taxableBases
    .filter((snapshot) => snapshot.closingCostBasis !== snapshot.openingCostBasis)
    .flatMap((snapshot) => {
      try {
        ledgerCentsToPlanDollars(snapshot.closingCostBasis)
        return []
      } catch {
        return [snapshot.accountId]
      }
    })

  const sourceIdsByClass = {
    cash: new Set<AccountId>(),
    equityCompensation: new Set<AccountId>(),
    taxable: new Set<AccountId>(),
    all: new Set<AccountId>(),
  }
  for (const evidence of result.evidence) {
    if (evidence.readiness !== 'actionable') continue
    for (const coverage of evidence.penaltyCoverage) {
      if (coverage.executedAmount <= 0) continue
      sourceIdsByClass[coverage.sourceClass].add(coverage.sourceAccountId)
      sourceIdsByClass.all.add(coverage.sourceAccountId)
    }
  }

  const cashCents = result.evidence.reduce(
    (total, evidence) => total + evidence.taxCharacter.reduce(
      (characterTotal, character) => characterTotal +
        (character.sourceClass === 'cash' ? BigInt(character.amount) : 0n),
      0n,
    ),
    0n,
  )
  const equityCompensationCents = result.evidence.reduce(
    (total, evidence) => total + evidence.taxCharacter.reduce(
      (characterTotal, character) => characterTotal +
        (character.sourceClass === 'equityCompensation'
          ? BigInt(character.amount)
          : 0n),
      0n,
    ),
    0n,
  )
  const taxableProceedsCents = result.evidence.reduce(
    (total, evidence) => total + (evidence.readiness === 'actionable'
      ? evidence.penaltyCoverage.reduce(
        (coverageTotal, coverage) => coverageTotal +
          (coverage.sourceClass === 'taxable'
            ? BigInt(coverage.executedAmount)
            : 0n),
        0n,
      )
      : 0n),
    0n,
  )
  const proceedsCents = result.evidence.reduce(
    (total, evidence) => total + BigInt(evidence.disposition.executedAmount),
    0n,
  )
  const capitalCents = result.evidence.reduce(
    (total, evidence) => total + evidence.taxCharacter.reduce(
      (characterTotal, character) => {
        if (character.sourceClass !== 'taxable') return characterTotal
        if (character.kind === 'capitalGain') {
          return characterTotal + BigInt(character.amount)
        }
        if (character.kind === 'capitalLoss') {
          return characterTotal - BigInt(character.amount)
        }
        return characterTotal
      },
      0n,
    ),
    0n,
  )

  const aggregateFailureSourceAccountIds = new Set<AccountId>()
  function convertUnsigned(
    cents: bigint,
    sourceIds: ReadonlySet<AccountId>,
  ): number | null {
    try {
      return ledgerCentTotalToPlanDollars(cents)
    } catch {
      sourceIds.forEach((id) => aggregateFailureSourceAccountIds.add(id))
      return null
    }
  }
  function convertSigned(
    cents: bigint,
    sourceIds: ReadonlySet<AccountId>,
  ): number | null {
    try {
      return signedLedgerCentTotalToPlanDollars(cents)
    } catch {
      sourceIds.forEach((id) => aggregateFailureSourceAccountIds.add(id))
      return null
    }
  }

  const totals = {
    cash: convertUnsigned(cashCents, sourceIdsByClass.cash),
    equityCompensation: convertUnsigned(
      equityCompensationCents,
      sourceIdsByClass.equityCompensation,
    ),
    taxableProceeds: convertUnsigned(
      taxableProceedsCents,
      sourceIdsByClass.taxable,
    ),
    proceeds: convertUnsigned(proceedsCents, sourceIdsByClass.all),
    capitalGainOrLoss: convertSigned(capitalCents, sourceIdsByClass.taxable),
  }
  return deepFreeze({
    unrepresentableClosingBalanceAccountIds,
    unrepresentableClosingBasisAccountIds,
    aggregateFailureSourceAccountIds: [...aggregateFailureSourceAccountIds],
    totals,
  })
}

export type OrdinaryWithdrawalExecutionScheduleIssue =
  | Readonly<{
      kind: 'actionYearMismatch'
      actionId: ActionId
      expectedYear: number
      actualYear: number
    }>
  | Readonly<{
      kind: 'duplicateActionId'
      actionId: ActionId
      inputIndexes: readonly [number, number, ...number[]]
    }>
  | Readonly<{
      kind: 'executionSequenceConflict'
      year: number
      scheduledDate: string | null
      executionSequence: number
      collidingActionIds: readonly [ActionId, ActionId, ...ActionId[]]
      reason: ActionReason<'action-sequence-conflict'>
    }>

export interface RetirementActionScheduleState {
  /** Canonical immutable requests in execution chronology. */
  requests: readonly Readonly<RetirementActionRequest>[]
  scheduleIssues: readonly OrdinaryWithdrawalExecutionScheduleIssue[]
}

/** The original WS3.1 cash-only compatibility contract. */
export type CashExecutedActionDisposition = Readonly<
  Omit<ExecutedActionDisposition, 'executedAmount' | 'reasons'> & {
    executedAmount: PositiveUsdCents
    reasons: readonly []
  }
>

export type CashPartialActionDisposition = Readonly<
  Omit<PartialActionDisposition, 'executedAmount' | 'reasons'> & {
    executedAmount: PositiveUsdCents
    reasons: readonly [ActionReason<'source-balance-trimmed'>]
  }
>

export type CashActionableExecutionDisposition =
  | CashExecutedActionDisposition
  | CashPartialActionDisposition

export type CashOrdinaryWithdrawalExecutionEvidence =
  | Readonly<
      Omit<
        OrdinaryWithdrawalExecutionEvidenceBase,
        'request' | 'kind' | 'personId' | 'purpose' | 'allocations' | 'disposition'
      > & {
        readiness: 'actionable'
        request: Readonly<OrdinaryWithdrawalRequest>
        kind: 'ordinaryWithdrawal'
        personId: PersonId
        purpose: Readonly<WithdrawalPurpose>
        allocations: readonly [
          ResolvedCashSourceAllocationExecutionEvidence,
          ...ResolvedCashSourceAllocationExecutionEvidence[],
        ]
        disposition: CashActionableExecutionDisposition
        executedDate: string
        executedSequence: number
        acceptedSourceEligibility: readonly [
          AcceptedCashSourceEligibilityEvidence,
          ...AcceptedCashSourceEligibilityEvidence[],
        ]
        taxCharacter: readonly [
          CashPrincipalTaxCharacter,
          ...CashPrincipalTaxCharacter[],
        ]
        penalty: readonly []
        penaltyCoverage: readonly [
          CashSourcePenaltyCoverageEvidence,
          ...CashSourcePenaltyCoverageEvidence[],
        ]
      }
    >
  | Readonly<
      OrdinaryWithdrawalExecutionEvidenceBase & {
        readiness: 'nonActionable'
        executedDate: null
        executedSequence: null
        taxCharacter: readonly []
        penalty: readonly []
      }
    >

export interface ExecuteCashOrdinaryWithdrawalsInput {
  year: number
  plan: Plan
  requests: readonly RetirementActionRequest[]
  openingBalances: readonly AccountOpeningBalanceSnapshot[]
  runtimeEvidence?: RetirementActionGroupRuntimeEvidence
}

export type CashExecutionScheduleIssue =
  | Readonly<{
      kind: 'actionYearMismatch'
      actionId: ActionId
      expectedYear: number
      actualYear: number
    }>
  | Readonly<{
      kind: 'duplicateActionId'
      actionId: ActionId
      inputIndexes: readonly [number, number, ...number[]]
    }>
  | Readonly<{
      kind: 'executionSequenceConflict'
      year: number
      scheduledDate: string | null
      executionSequence: number
      collidingActionIds: readonly [ActionId, ActionId, ...ActionId[]]
      reason: ActionReason<'action-sequence-conflict'>
    }>

export interface ExecuteCashOrdinaryWithdrawalsResult {
  committed: boolean
  /** Canonical immutable requests evaluated by this annual transaction. */
  requests: readonly Readonly<RetirementActionRequest>[]
  scheduleIssues: readonly CashExecutionScheduleIssue[]
  balances: readonly AccountBalanceExecutionEvidence[]
  evidence: readonly CashOrdinaryWithdrawalExecutionEvidence[]
}

interface ScheduledRequest {
  inputIndex: number
  request: RetirementActionRequest
  scheduledDate: string | null
  executionDate: string | null
  sequence: number | null
  chronologyKey: string
  scheduleGroupKey: string
  scheduleInvalid: boolean
}

function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function centsFromBigInt(value: bigint): UsdCents {
  if (value < 0n || value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new RangeError('Exact-cent arithmetic exceeded the safe-integer range')
  }
  return asUsdCents(Number(value))
}

function canonicalAllocations(
  request: RetirementActionRequest,
): readonly SourceAllocationRequest[] {
  const allocations =
    request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion'
      ? request.allocations
      : request.kind === 'qcd'
        ? [request.allocation]
        : []
  return [...allocations].sort(
    (left, right) =>
      compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
  )
}

function indexUnique<T>(
  values: readonly T[],
  keyOf: (value: T) => string,
): ReadonlyMap<string, T | null> {
  const result = new Map<string, T | null>()
  for (const value of values) {
    const key = keyOf(value)
    result.set(key, result.has(key) ? null : value)
  }
  return result
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child)
    }
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function reasonKey(reason: ActionReason): string {
  return JSON.stringify([
    reason.code,
    reason.personId ?? null,
    reason.accountId ?? null,
    reason.allocationId ?? null,
  ])
}

function canonicalReasons(reasons: readonly ActionReason[]): readonly ActionReason[] {
  const unique = [...new Map(reasons.map((reason) => [reasonKey(reason), reason])).values()]
  const unsupported = unique.filter((reason) => reason.outcome === 'unsupported')
  const refused = unique.filter((reason) => reason.outcome === 'refused')
  return unsupported.length > 0 ? [...unsupported, ...refused] : refused
}

function nonActionableDisposition(
  requestedAmount: PositiveUsdCents,
  reasons: readonly ActionReason[],
): ActionExecutionDisposition {
  const canonical = canonicalReasons(reasons)
  if (canonical.length === 0) {
    throw new Error('Non-actionable execution evidence requires a blocking reason')
  }
  const unsupported = canonical[0]?.outcome === 'unsupported'
  return actionExecutionDispositionSchema.parse({
    outcome: unsupported ? 'unsupported' : 'refused',
    readiness: 'nonActionable',
    requestedAmount,
    executedAmount: asUsdCents(0),
    unexecutedAmount: asUsdCents(requestedAmount),
    reasons: canonical,
  })
}

function actionableDisposition(
  requestedAmount: PositiveUsdCents,
  executedAmount: UsdCents,
): ActionExecutionDisposition {
  const unexecutedAmount = centsFromBigInt(
    BigInt(requestedAmount) - BigInt(executedAmount),
  )
  if (executedAmount === requestedAmount) {
    return actionExecutionDispositionSchema.parse({
      outcome: 'executed',
      readiness: 'actionable',
      requestedAmount,
      executedAmount,
      unexecutedAmount,
      reasons: [],
    })
  }
  if (executedAmount === 0) {
    return nonActionableDisposition(requestedAmount, [
      createActionReason('source-balance-unavailable'),
    ])
  }
  return actionExecutionDispositionSchema.parse({
    outcome: 'partial',
    readiness: 'actionable',
    requestedAmount,
    executedAmount,
    unexecutedAmount,
    reasons: [createActionReason('source-balance-trimmed')],
  })
}

function normalizeSchedule(
  request: RetirementActionRequest,
  inputIndex: number,
): ScheduledRequest {
  if (
    request.kind === 'legacyAggregateWithdrawal' ||
    request.kind === 'legacyAggregateRothConversion' ||
    request.kind === 'legacyAggregateQcd'
  ) {
    return {
      inputIndex,
      request,
      scheduledDate: null,
      executionDate: null,
      sequence: null,
      chronologyKey: '9999-12-31',
      scheduleGroupKey: 'legacy',
      scheduleInvalid: true,
    }
  }

  const scheduledDate = request.executionDate ?? null
  if (scheduledDate === null && request.kind === 'ordinaryWithdrawal') {
    const executionDate = `${String(request.year).padStart(4, '0')}-12-31`
    return {
      inputIndex,
      request,
      scheduledDate,
      executionDate,
      sequence: request.executionSequence,
      chronologyKey: `${executionDate}|1`,
      scheduleGroupKey: `undated:${request.year}`,
      scheduleInvalid: false,
    }
  }
  const parsed = scheduledDate === null ? null : parseCivilIsoDate(scheduledDate)
  const valid = parsed !== null && parsed.year === request.year
  return {
    inputIndex,
    request,
    scheduledDate,
    executionDate: valid ? formatCivilDate(parsed) : null,
    sequence: request.executionSequence,
    chronologyKey: valid
      ? `${formatCivilDate(parsed)}|0`
      : `${String(request.year).padStart(4, '0')}-99-99|0`,
    scheduleGroupKey: valid ? `dated:${formatCivilDate(parsed)}` : 'invalid',
    scheduleInvalid: !valid,
  }
}

function requestPersonId(request: RetirementActionRequest): PersonId | null {
  if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
    return request.personId
  }
  return request.kind === 'qcd' ? request.donorPersonId : null
}

function requestPurpose(request: RetirementActionRequest): WithdrawalPurpose | null {
  return request.kind === 'ordinaryWithdrawal' ? request.purpose : null
}

function scheduleIssues(
  year: number,
  scheduled: readonly ScheduledRequest[],
): readonly OrdinaryWithdrawalExecutionScheduleIssue[] {
  const issues: OrdinaryWithdrawalExecutionScheduleIssue[] = []
  const ids = new Map<ActionId, number[]>()
  for (const item of scheduled) {
    if (item.request.year !== year) {
      issues.push({
        kind: 'actionYearMismatch',
        actionId: item.request.actionId,
        expectedYear: year,
        actualYear: item.request.year,
      })
    }
    const matches = ids.get(item.request.actionId)
    if (matches === undefined) ids.set(item.request.actionId, [item.inputIndex])
    else matches.push(item.inputIndex)
  }
  for (const [actionId, matches] of ids) {
    if (matches.length > 1) {
      issues.push({
        kind: 'duplicateActionId',
        actionId,
        inputIndexes: [...matches].sort((left, right) => left - right) as [
          number,
          number,
          ...number[],
        ],
      })
    }
  }

  const slots = new Map<string, ScheduledRequest[]>()
  for (const item of scheduled) {
    if (
      item.request.kind === 'legacyAggregateWithdrawal' ||
      item.request.kind === 'legacyAggregateRothConversion' ||
      item.request.kind === 'legacyAggregateQcd' ||
      item.scheduleInvalid ||
      item.sequence === null ||
      item.request.year !== year
    ) {
      continue
    }
    const key = JSON.stringify([item.scheduleGroupKey, item.sequence])
    const peers = slots.get(key)
    if (peers === undefined) slots.set(key, [item])
    else peers.push(item)
  }
  for (const peers of slots.values()) {
    if (peers.length > 1) {
      const first = peers[0]!
      const collidingActionIds = peers
        .map((item) => item.request.actionId)
        .sort(compareUtf16CodeUnits) as [ActionId, ActionId, ...ActionId[]]
      issues.push({
        kind: 'executionSequenceConflict',
        year,
        scheduledDate: first.scheduledDate,
        executionSequence: first.sequence!,
        collidingActionIds,
        reason: createActionReason('action-sequence-conflict'),
      })
    }
  }
  return issues.sort((left, right) => {
    const leftKey = JSON.stringify(left)
    const rightKey = JSON.stringify(right)
    return compareUtf16CodeUnits(leftKey, rightKey)
  })
}

function buildRetirementActionScheduleState(
  year: number,
  requests: readonly RetirementActionRequest[],
): RetirementActionScheduleState & { scheduled: readonly ScheduledRequest[] } {
  const scheduled = requests.map(normalizeSchedule).sort(
    (left, right) =>
      compareUtf16CodeUnits(left.chronologyKey, right.chronologyKey) ||
      (left.sequence ?? Number.MAX_SAFE_INTEGER) -
        (right.sequence ?? Number.MAX_SAFE_INTEGER) ||
      compareUtf16CodeUnits(left.request.actionId, right.request.actionId),
  )
  const publishedRequests = deepFreeze(scheduled.map((item) => {
    const request = structuredClone(item.request)
    if (request.kind === 'ordinaryWithdrawal' || request.kind === 'rothConversion') {
      request.allocations = [...canonicalAllocations(request)]
    }
    return request
  }))
  return {
    scheduled,
    requests: publishedRequests,
    scheduleIssues: scheduleIssues(year, scheduled),
  }
}

/**
 * Canonical annual schedule state shared by the simulator's kind dispatch and
 * the exact executors. Requests with an invalid schedule remain visible but
 * cannot create a same-slot collision until they have a real execution date.
 */
export function evaluateRetirementActionSchedule(
  year: number,
  inputRequests: readonly RetirementActionRequest[],
): Readonly<RetirementActionScheduleState> {
  const requests = inputRequests.map((request) =>
    retirementActionRequestSchema.parse(request),
  )
  if (!Number.isSafeInteger(year) || year < 1 || year > 9999) {
    throw new RangeError('Execution year must be a four-digit positive calendar year')
  }
  const state = buildRetirementActionScheduleState(year, requests)
  return deepFreeze({
    requests: state.requests,
    scheduleIssues: state.scheduleIssues,
  })
}

function unsupportedScopeReason(request: RetirementActionRequest): ActionReason {
  if (request.kind === 'legacyAggregateWithdrawal') {
    return createActionReason('withdrawal-aggregate-unallocated')
  }
  if (request.kind === 'legacyAggregateRothConversion') {
    return createActionReason('conversion-aggregate-unallocated')
  }
  if (request.kind === 'legacyAggregateQcd') {
    return createActionReason('qcd-aggregate-unallocated')
  }
  return createActionReason('required-facts-missing', {
    personId: requestPersonId(request) ?? undefined,
  })
}

function unresolvedAllocationEvidence(
  allocations: readonly SourceAllocationRequest[],
  accounts: ReadonlyMap<string, Plan['accounts'][number] | null>,
  balances: ReadonlyMap<string, AccountOpeningBalanceSnapshot | null>,
  workingBalances: ReadonlyMap<string, UsdCents>,
  actingPersonId: PersonId | null,
): readonly SourceAllocationExecutionEvidence[] {
  return allocations.map((allocation) => {
    const account = accounts.get(allocation.sourceAccountId)
    const snapshot = balances.get(allocation.sourceAccountId)
    const before =
      snapshot == null ? null : (workingBalances.get(allocation.sourceAccountId) ?? null)
    if (account == null) {
      return {
        ...allocation,
        resolution: 'unresolved',
        ownerPersonIds: null,
        actingPersonId: null,
        balanceBefore: before,
        executedAmount: asUsdCents(0),
        unexecutedAmount: asUsdCents(allocation.requestedAmount),
        balanceAfter: before,
      }
    }
    let ownerPersonIds: readonly PersonId[]
    try {
      ownerPersonIds =
        account.ownerPersonId === null ? [] : [asPersonId(account.ownerPersonId)]
    } catch {
      // The source account resolved by ID even though it has no valid owner
      // identity; preserve that distinction for the ownership refusal.
      return {
        ...allocation,
        resolution: 'resolved',
        ownerPersonIds: [],
        actingPersonId,
        balanceBefore: before,
        executedAmount: asUsdCents(0),
        unexecutedAmount: asUsdCents(allocation.requestedAmount),
        balanceAfter: before,
      }
    }
    return {
      ...allocation,
      resolution: 'resolved',
      ownerPersonIds,
      actingPersonId,
      balanceBefore: before,
      executedAmount: asUsdCents(0),
      unexecutedAmount: asUsdCents(allocation.requestedAmount),
      balanceAfter: before,
    }
  })
}

function nonRetirementCoverageEvidenceId(
  actionId: ActionId,
  allocationId: AllocationId,
  sourceClass: 'cash' | 'equityCompensation' | 'taxable',
): string {
  const prefix =
    sourceClass === 'cash'
      ? 'cash-penalty-coverage'
      : sourceClass === 'equityCompensation'
        ? 'equity-compensation-penalty-coverage'
        : 'taxable-penalty-coverage'
  return `${prefix}:${JSON.stringify([actionId, allocationId])}`
}

function taxableSnapshotMatches(
  snapshot: TaxableAccountOpeningSnapshot,
  account: Extract<Plan['accounts'][number], { type: 'taxable' }>,
  actingPersonId: PersonId,
  year: number,
): boolean {
  const ownerIds = snapshot.ownership.accountOwnerPersonIds
  const share = snapshot.ownership.beneficialOwnershipShare
  const members = snapshot.taxUnit.taxUnitMemberPersonIds
  const nonblank = (value: unknown): value is string =>
    typeof value === 'string' && value.trim().length > 0
  const filingStatusSupported = new Set([
    'single',
    'marriedFilingJointly',
    'marriedFilingSeparately',
    'headOfHousehold',
    'qualifyingSurvivingSpouse',
  ]).has(snapshot.taxUnit.federalFilingStatus)
  return (
    snapshot.accountId === account.id &&
    account.ownerPersonId !== null &&
    account.ownerPersonId === actingPersonId &&
    ownerIds.length === 1 &&
    ownerIds[0] === actingPersonId &&
    nonblank(snapshot.ownership.accountOwnershipEvidenceId) &&
    nonblank(snapshot.ownership.attributionEvidenceId) &&
    share.representation === 'exactRational' &&
    share.numerator === 1 &&
    share.denominator === 1 &&
    share.intermediateArithmetic === 'bigintRational' &&
    snapshot.taxUnit.taxYear === year &&
    nonblank(snapshot.taxUnit.taxUnitId) &&
    nonblank(snapshot.taxUnit.taxUnitEvidenceId) &&
    nonblank(snapshot.taxUnit.stateFilingStatusId) &&
    filingStatusSupported &&
    members.length > 0 &&
    members.every(nonblank) &&
    new Set(members).size === members.length &&
    members.includes(actingPersonId)
  )
}

function zeroExecutionTaxableEligibility(
  actionId: ActionId,
  allocationId: AllocationId,
  sourceAccountId: AccountId,
  evaluationDate: string,
): AcceptedZeroExecutionTaxableSourceEligibilityEvidence {
  return {
    predicate: 'classifyWithdrawalSource',
    allocationId,
    sourceAccountId,
    evaluationDate,
    sourceClass: 'taxable',
    basisEvidence: {
      method: 'notApplicableZeroExecution',
      preExecutionFairMarketValue: 0,
      remainingCostBasisBeforeExecution: 0,
      executedAmount: 0,
      basisRecoveredAmount: 0,
      realizedCapitalGainOrLossAmount: 0,
      ratio: {
        representation: 'notApplicableZeroDenominator',
        numeratorMinorUnits: 0,
        denominatorMinorUnits: 0,
        intermediateArithmetic: 'none',
      },
      basisPreservedAmount: 0,
      reason: 'depletedSource',
      basisEvidenceId: `taxable-basis-zero:${JSON.stringify([
        actionId,
        allocationId,
        sourceAccountId,
        evaluationDate,
      ])}`,
    },
  }
}

function equityCompensationVestingEvidenceId(
  sourceAccountId: AccountId,
  vestingMode: 'final' | 'cliff',
  vestingDate: string | null,
): string {
  return `equity-compensation-vesting:${JSON.stringify([
    sourceAccountId,
    vestingMode,
    vestingDate,
  ])}`
}

function equityCompensationCharacterEvidenceId(
  actionId: ActionId,
  allocationId: AllocationId,
  evaluationDate: string,
  vestingEvidenceId: string,
): string {
  return `equity-compensation-character:${JSON.stringify([
    actionId,
    allocationId,
    evaluationDate,
    vestingEvidenceId,
  ])}`
}

function assertOrdinaryWithdrawalExecutionEvidence(
  evidence: OrdinaryWithdrawalExecutionEvidence,
): void {
  const fail = (message: string): never => {
    throw new Error(`Invalid ordinary-withdrawal execution evidence: ${message}`)
  }
  if (evidence.penalty.length !== 0) {
    fail('non-retirement source penalty evidence must be empty')
  }
  if (evidence.readiness === 'nonActionable') {
    if (evidence.disposition.readiness !== 'nonActionable') {
      fail('wrapper and disposition readiness differ')
    }
    if (evidence.taxCharacter.length !== 0) {
      fail('non-actionable tax character must be empty')
    }
    if ('penaltyCoverage' in evidence) {
      fail('non-actionable evidence cannot carry penalty coverage')
    }
    return
  }

  if (
    evidence.kind !== 'ordinaryWithdrawal' ||
    evidence.disposition.readiness !== 'actionable'
  ) {
    fail('only ordinary withdrawals may be actionable')
  }
  if (
    evidence.disposition.outcome === 'executed' &&
    evidence.disposition.reasons.length !== 0
  ) {
    fail('executed ordinary withdrawal reasons must be empty')
  }
  if (
    evidence.disposition.outcome === 'partial' &&
    (evidence.disposition.reasons.length !== 1 ||
      evidence.disposition.reasons[0]?.code !== 'source-balance-trimmed')
  ) {
    fail('partial ordinary withdrawal requires exactly source-balance-trimmed')
  }
  if (
    evidence.acceptedSourceEligibility.length !== evidence.allocations.length ||
    evidence.penaltyCoverage.length !== evidence.allocations.length
  ) {
    fail('each resolved allocation requires eligibility and penalty coverage')
  }

  const charactersByAllocation = new Map<
    AllocationId,
    OrdinaryWithdrawalTaxCharacter[]
  >()
  for (const character of evidence.taxCharacter) {
    const characters = charactersByAllocation.get(character.allocationId)
    if (characters === undefined) {
      charactersByAllocation.set(character.allocationId, [character])
    } else {
      characters.push(character)
    }
  }
  const eligibilityByAllocation = indexUnique(
    evidence.acceptedSourceEligibility,
    (accepted) => accepted.allocationId,
  )
  const coverageByAllocation = indexUnique(
    evidence.penaltyCoverage,
    (coverage) => coverage.allocationId,
  )
  let executedTotal = 0n
  for (const allocation of evidence.allocations) {
    if (
      allocation.resolution !== 'resolved' ||
      allocation.actingPersonId !== evidence.personId ||
      allocation.ownerPersonIds.length !== 1 ||
      allocation.ownerPersonIds[0] !== evidence.personId
    ) {
      fail('actionable allocation owner and actor must be the request person')
    }
    if (
      BigInt(allocation.executedAmount) + BigInt(allocation.unexecutedAmount) !==
        BigInt(allocation.requestedAmount) ||
      allocation.balanceBefore === null ||
      allocation.balanceAfter === null ||
      BigInt(allocation.balanceAfter) + BigInt(allocation.executedAmount) !==
        BigInt(allocation.balanceBefore)
    ) {
      fail('allocation cents do not conserve')
    }
    executedTotal += BigInt(allocation.executedAmount)
    const acceptedCandidate = eligibilityByAllocation.get(allocation.allocationId)
    if (acceptedCandidate == null) {
      throw new Error(
        'Invalid ordinary-withdrawal execution evidence: accepted source eligibility is missing',
      )
    }
    const accepted: AcceptedOrdinaryWithdrawalSourceEligibilityEvidence =
      acceptedCandidate
    if (
      accepted.sourceAccountId !== allocation.sourceAccountId ||
      accepted.evaluationDate !== evidence.executedDate
    ) {
      fail('accepted source eligibility is missing or mismatched')
    }
    const coverage = coverageByAllocation.get(allocation.allocationId)
    if (
      coverage == null ||
      coverage.coverageEvidenceId !==
        nonRetirementCoverageEvidenceId(
          evidence.actionId,
          allocation.allocationId,
          coverage.sourceClass,
        ) ||
      coverage.actionId !== evidence.actionId ||
      coverage.sourceAccountId !== allocation.sourceAccountId ||
      coverage.applicability !== 'notApplicable' ||
      coverage.sourceClass !== accepted.sourceClass ||
      coverage.reason !== 'nonRetirementSource' ||
      coverage.executedAmount !== allocation.executedAmount ||
      coverage.nonPenaltyRelevantCharacterAmount !== allocation.executedAmount ||
      coverage.penaltyRelevantCharacterAmount !== 0 ||
      coverage.coveredPenaltyExposureAmount !== 0 ||
      coverage.coverageDifferenceAmount !== 0 ||
      coverage.segments.length !== 0
    ) {
      fail('non-retirement penalty coverage is missing or mismatched')
    }
    const characters = charactersByAllocation.get(allocation.allocationId) ?? []
    if (accepted.sourceClass === 'cash') {
      if (accepted.predicate !== 'isSpendableInYear') {
        fail('cash source predicate is mismatched')
      }
      if (accepted.availabilityEvidence.kind !== 'intrinsicallySpendable') {
        fail('cash availability evidence is mismatched')
      }
      if (allocation.executedAmount === 0) {
        if (characters.length !== 0) fail('zero execution cannot emit tax character')
        continue
      }
      const character = characters[0]
      if (
        characters.length !== 1 ||
        character == null ||
        character.actionId !== evidence.actionId ||
        character.sourceAccountId !== allocation.sourceAccountId ||
        character.sourceClass !== 'cash' ||
        character.kind !== 'cashPrincipal' ||
        character.amount !== allocation.executedAmount ||
        character.characterEvidence.rule !== 'intrinsicCashPrincipal' ||
        character.characterEvidence.allocationId !== allocation.allocationId ||
        character.characterEvidence.segmentAmount !== allocation.executedAmount
      ) {
        fail('cash principal character is missing or mismatched')
      }
    } else if (accepted.sourceClass === 'equityCompensation') {
      if (accepted.predicate !== 'isSpendableInYear') {
        fail('equity-compensation source predicate is mismatched')
      }
      const sourceEvidence = accepted.characterEvidence
      if (
        sourceEvidence.allocationId !== allocation.allocationId ||
        sourceEvidence.sourceAccountId !== allocation.sourceAccountId ||
        sourceEvidence.actingPersonId !== evidence.personId ||
        sourceEvidence.evaluationDate !== evidence.executedDate ||
        sourceEvidence.vestingEvidenceId !==
          accepted.availabilityEvidence.vestingEvidenceId ||
        sourceEvidence.executedAmount !== allocation.executedAmount ||
        sourceEvidence.ordinaryIncomeAmount !== allocation.executedAmount
      ) {
        fail('equity-compensation source character evidence is mismatched')
      }
      if (allocation.executedAmount === 0) {
        if (characters.length !== 0) fail('zero execution cannot emit tax character')
        continue
      }
      const character = characters[0]
      if (
        characters.length !== 1 ||
        character == null ||
        character.actionId !== evidence.actionId ||
        character.sourceAccountId !== allocation.sourceAccountId ||
        character.sourceClass !== 'equityCompensation' ||
        character.kind !== 'ordinaryIncome' ||
        character.amount !== allocation.executedAmount ||
        character.characterEvidence.rule !==
          'fullyTaxableCompensationAtExecution' ||
        character.characterEvidence.sourceCharacterEvidenceId !==
          sourceEvidence.characterEvidenceId ||
        character.characterEvidence.segmentAmount !== allocation.executedAmount ||
        sourceEvidence.characterEvidenceId.length === 0
      ) {
        fail('equity-compensation character is missing or mismatched')
      }
    } else {
      if (accepted.predicate !== 'classifyWithdrawalSource') {
        fail('taxable source predicate is mismatched')
      }
      const basis = accepted.basisEvidence
      if (basis.method === 'notApplicableZeroExecution') {
        if (
          allocation.executedAmount !== 0 ||
          allocation.balanceBefore !== 0 ||
          allocation.balanceAfter !== 0 ||
          basis.preExecutionFairMarketValue !== 0 ||
          basis.remainingCostBasisBeforeExecution !== 0 ||
          basis.executedAmount !== 0 ||
          basis.basisRecoveredAmount !== 0 ||
          basis.realizedCapitalGainOrLossAmount !== 0 ||
          basis.ratio.representation !== 'notApplicableZeroDenominator' ||
          basis.ratio.numeratorMinorUnits !== 0 ||
          basis.ratio.denominatorMinorUnits !== 0 ||
          basis.ratio.intermediateArithmetic !== 'none' ||
          basis.basisPreservedAmount !== 0 ||
          characters.length !== 0
        ) {
          fail('zero-execution taxable evidence is mismatched')
        }
        continue
      }
      if (
        allocation.executedAmount === 0 ||
        basis.executedAmount !== allocation.executedAmount ||
        basis.preExecutionFairMarketValue !== allocation.balanceBefore ||
        basis.taxAttributionEvidence.allocationId !== allocation.allocationId ||
        basis.taxAttributionEvidence.sourceAccountId !== allocation.sourceAccountId
      ) {
        fail('positive taxable basis evidence is mismatched')
      }
      const signedCharacter = characters.reduce((total, character) => {
        if (
          character.actionId !== evidence.actionId ||
          character.allocationId !== allocation.allocationId ||
          character.sourceAccountId !== allocation.sourceAccountId ||
          character.sourceClass !== 'taxable' ||
          character.characterEvidence.allocationId !== allocation.allocationId ||
          character.characterEvidence.basisEvidenceId !== basis.basisEvidenceId ||
          character.characterEvidence.segmentAmount !== character.amount
        ) {
          fail('taxable character binding is mismatched')
        }
        return (
          total +
          (character.kind === 'capitalLoss'
            ? -BigInt(character.amount)
            : BigInt(character.amount))
        )
      }, 0n)
      if (
        characters.length === 0 ||
        signedCharacter !== BigInt(allocation.executedAmount)
      ) {
        fail('taxable character does not reconcile to executed principal')
      }
    }
  }
  if (executedTotal !== BigInt(evidence.disposition.executedAmount)) {
    fail('action execution does not equal allocation execution')
  }
  if (
    [...charactersByAllocation.keys()].some(
      (allocationId) =>
        !evidence.allocations.some(
          (allocation) => allocation.allocationId === allocationId,
        ),
    )
  ) {
    fail('tax character names an unallocated source')
  }
}

function executionEvidence(
  item: ScheduledRequest,
  disposition: ActionExecutionDisposition,
  allocations: readonly SourceAllocationExecutionEvidence[],
  taxCharacter: readonly OrdinaryWithdrawalTaxCharacter[] = [],
  penaltyCoverage: readonly NonRetirementSourcePenaltyCoverageEvidence[] = [],
  acceptedSourceEligibility: readonly AcceptedOrdinaryWithdrawalSourceEligibilityEvidence[] = [],
): OrdinaryWithdrawalExecutionEvidence {
  const requestCopy = structuredClone(item.request)
  if (
    requestCopy.kind === 'ordinaryWithdrawal' ||
    requestCopy.kind === 'rothConversion'
  ) {
    requestCopy.allocations = [...canonicalAllocations(requestCopy)]
  }
  const request = deepFreeze(requestCopy)
  const base: OrdinaryWithdrawalExecutionEvidenceBase = {
    request,
    actionId: item.request.actionId,
    kind: item.request.kind,
    personId: requestPersonId(item.request),
    year: item.request.year,
    scheduledDate: item.scheduledDate,
    scheduledSequence: item.sequence,
    requestedAmount: item.request.requestedAmount,
    provenance: request.provenance,
    purpose: requestPurpose(request),
    allocations,
    disposition,
  }
  if (disposition.readiness === 'nonActionable') {
    const evidence: OrdinaryWithdrawalExecutionEvidence = {
      ...base,
      readiness: 'nonActionable',
      executedDate: null,
      executedSequence: null,
      taxCharacter: [],
      penalty: [],
    }
    assertOrdinaryWithdrawalExecutionEvidence(evidence)
    return deepFreeze(evidence)
  }
  if (item.executionDate === null || item.sequence === null) {
    throw new Error('Actionable evidence requires a resolved schedule')
  }
  if (
    request.kind !== 'ordinaryWithdrawal' ||
    allocations.length === 0 ||
    allocations.some((allocation) => allocation.resolution !== 'resolved') ||
    acceptedSourceEligibility.length === 0 ||
    taxCharacter.length === 0 ||
    penaltyCoverage.length === 0 ||
    disposition.executedAmount === 0
  ) {
    throw new Error('Actionable ordinary-withdrawal evidence is incomplete')
  }
  const evidence: OrdinaryWithdrawalExecutionEvidence = {
    ...base,
    readiness: 'actionable',
    request,
    kind: 'ordinaryWithdrawal',
    personId: request.personId,
    purpose: request.purpose,
    allocations: allocations as [
      ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence,
      ...ResolvedIndividuallyOwnedSourceAllocationExecutionEvidence[],
    ],
    disposition: disposition as OrdinaryWithdrawalActionableExecutionDisposition,
    executedDate: item.executionDate,
    executedSequence: item.sequence,
    acceptedSourceEligibility: acceptedSourceEligibility as [
      AcceptedOrdinaryWithdrawalSourceEligibilityEvidence,
      ...AcceptedOrdinaryWithdrawalSourceEligibilityEvidence[],
    ],
    taxCharacter: taxCharacter as [
      OrdinaryWithdrawalTaxCharacter,
      ...OrdinaryWithdrawalTaxCharacter[],
    ],
    penalty: [],
    penaltyCoverage: penaltyCoverage as [
      NonRetirementSourcePenaltyCoverageEvidence,
      ...NonRetirementSourcePenaltyCoverageEvidence[],
    ],
  }
  assertOrdinaryWithdrawalExecutionEvidence(evidence)
  return deepFreeze(evidence)
}

type OrdinaryWithdrawalExecutionScope =
  | 'cashOnly'
  | 'cashAndEquityCompensation'
  | 'cashEquityCompensationAndTaxable'

function executeOrdinaryWithdrawalsInScope(
  input: ExecuteOrdinaryWithdrawalsInput,
  scope: OrdinaryWithdrawalExecutionScope,
): ExecuteOrdinaryWithdrawalsResult {
  const requests = input.requests.map((request) =>
    retirementActionRequestSchema.parse(request),
  )
  // One group decision, honoured rather than rederived. A caller that can see
  // both executors' request sets supplies it; absent that, this executor falls
  // back to the only conversions it can see for itself — the Plan's own
  // strategy list plus whatever arrived in this batch — which is strictly less
  // than the caller can see and is why the verdict exists at all.
  const suppliedGroups = input.runtimeEvidence?.conversionLinkedWithdrawalGroups
  const observableGroups = assessConversionLinkedWithdrawalGroups([
    ...input.plan.strategies.retirementActions,
    ...requests,
  ])
  // A supplied verdict may answer for groups this executor cannot see. It may
  // not contradict one it can: an assessment that leaves out a linked group
  // sitting in the Plan is not a decision to release that withdrawal, it is an
  // assessment taken over the wrong requests, and moving money on it would be
  // the disagreement this verdict exists to prevent.
  //
  // Completeness is asked per group, keyed on the (conversion, withdrawal)
  // pair that `assessConversionLinkedWithdrawalGroups` itself dedupes on —
  // not per withdrawal. Two conversions can name one withdrawal:
  // `assertLinkedWithdrawalRequests` refuses that shape, but it refuses it at
  // publication and this executor runs before then. Asking only whether some
  // verdict mentions the withdrawal would let an assessment answering for one
  // of those conversions stand in for the one it omits, which is the silent
  // release this check exists to stop.
  if (suppliedGroups !== undefined) {
    const suppliedGroupKeys = new Set(
      suppliedGroups.groups.map((group) =>
        JSON.stringify([group.conversionActionId, group.withdrawalActionId]),
      ),
    )
    for (const group of observableGroups.groups) {
      if (
        !suppliedGroupKeys.has(
          JSON.stringify([group.conversionActionId, group.withdrawalActionId]),
        )
      ) {
        // Both ids, because the completeness check above is keyed on the pair:
        // two conversions may name one withdrawal, so the withdrawal id alone
        // does not say which group was omitted.
        throw new Error(
          'Conversion linked-withdrawal group verdict is missing for conversion '
          + `"${group.conversionActionId}" funded by withdrawal "${group.withdrawalActionId}"`,
        )
      }
    }
  }
  const conversionLinkedWithdrawalGroups = suppliedGroups ?? observableGroups
  const openingBalances = input.openingBalances.map((snapshot) => ({
    accountId: accountIdSchema.parse(snapshot.accountId),
    openingBalance: usdCentsSchema.parse(snapshot.openingBalance),
  }))
  const taxableAccountSnapshots = (input.taxableAccountSnapshots ?? []).map(
    (snapshot): TaxableAccountOpeningSnapshot => ({
      accountId: accountIdSchema.parse(snapshot.accountId),
      openingCostBasis: usdCentsSchema.parse(snapshot.openingCostBasis),
      ownership: structuredClone(snapshot.ownership),
      taxUnit: structuredClone(snapshot.taxUnit),
    }),
  )
  if (!Number.isSafeInteger(input.year) || input.year < 1 || input.year > 9999) {
    throw new RangeError('Execution year must be a four-digit positive calendar year')
  }
  const scheduleState = buildRetirementActionScheduleState(input.year, requests)
  const scheduled = scheduleState.scheduled
  const publishedRequests = scheduleState.requests
  const detectedScheduleIssues = scheduleState.scheduleIssues
  const snapshotCounts = new Map<string, number>()
  for (const snapshot of openingBalances) {
    snapshotCounts.set(snapshot.accountId, (snapshotCounts.get(snapshot.accountId) ?? 0) + 1)
  }
  const taxableSnapshotCounts = new Map<string, number>()
  for (const snapshot of taxableAccountSnapshots) {
    taxableSnapshotCounts.set(
      snapshot.accountId,
      (taxableSnapshotCounts.get(snapshot.accountId) ?? 0) + 1,
    )
  }
  const unchangedBalances = openingBalances
    .map((snapshot): AccountBalanceExecutionEvidence => ({
      ...snapshot,
      closingBalance: snapshot.openingBalance,
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId) ||
        left.openingBalance - right.openingBalance,
    )
  const unchangedTaxableBases = taxableAccountSnapshots
    .map((snapshot): TaxableAccountBasisExecutionEvidence => ({
      ...snapshot,
      closingCostBasis: snapshot.openingCostBasis,
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId) ||
        left.openingCostBasis - right.openingCostBasis,
    )
  if (detectedScheduleIssues.length > 0) {
    return deepFreeze({
      committed: false,
      requests: publishedRequests,
      scheduleIssues: detectedScheduleIssues,
      balances: unchangedBalances,
      taxableBases: unchangedTaxableBases,
      evidence: [],
    })
  }

  const accounts = indexUnique(input.plan.accounts, (account) => account.id)
  const snapshots = indexUnique(openingBalances, (snapshot) => snapshot.accountId)
  const taxableSnapshots = indexUnique(
    taxableAccountSnapshots,
    (snapshot) => snapshot.accountId,
  )
  let workingBalances = new Map<string, UsdCents>()
  for (const [accountId, snapshot] of snapshots) {
    if (snapshot !== null) workingBalances.set(accountId, snapshot.openingBalance)
  }
  let workingTaxableBases = new Map<string, UsdCents>()
  for (const [accountId, snapshot] of taxableSnapshots) {
    if (snapshot !== null) {
      workingTaxableBases.set(accountId, snapshot.openingCostBasis)
    }
  }

  const evidence: OrdinaryWithdrawalExecutionEvidence[] = []
  for (const item of scheduled) {
    const request = item.request
    const allocations = canonicalAllocations(request)
    const preflight = evaluateRetirementActionEligibilityFromPlan(
      request,
      input.plan,
      input.runtimeEvidence,
    )
    const blockingReasons: ActionReason[] =
      preflight.status === 'accepted' ? [] : [...preflight.reasons]

    const groupVerdict = conversionLinkedWithdrawalGroupForWithdrawal(
      conversionLinkedWithdrawalGroups,
      request.actionId,
    )
    if (item.scheduleInvalid) blockingReasons.push(unsupportedScopeReason(request))
    if (request.kind !== 'ordinaryWithdrawal') {
      blockingReasons.push(unsupportedScopeReason(request))
    } else if (
      groupVerdict !== null &&
      groupVerdict.disposition === 'refusedPendingGroupExecution'
    ) {
      // Linked tax funding belongs to the conversion's atomic annual group,
      // and the group verdict — not this executor — is what decides for it.
      // The reason is bound to this request's own person so the withdrawal
      // record names the person who would have taken it.
      blockingReasons.push(
        createActionReason(groupVerdict.reasonCode, {
          personId: request.personId,
        }),
      )
    } else {
      for (const allocation of allocations) {
        const account = accounts.get(allocation.sourceAccountId)
        if (account == null) {
          blockingReasons.push(
            createActionReason('source-account-not-found', {
              accountId: allocation.sourceAccountId,
              allocationId: allocation.allocationId,
            }),
          )
        } else {
          if (
            account.type !== 'cash' &&
            (scope === 'cashOnly' ||
              (account.type !== 'equityComp' &&
                (scope !== 'cashEquityCompensationAndTaxable' ||
                  account.type !== 'taxable')))
          ) {
            blockingReasons.push(
              createActionReason('withdrawal-source-type-unsupported', {
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          } else if (account.ownerPersonId === null) {
            blockingReasons.push(
              createActionReason('joint-source-acting-person-mismatch', {
                personId: request.personId,
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          } else if (account.ownerPersonId !== request.personId) {
            blockingReasons.push(
              createActionReason('source-owner-mismatch', {
                personId: request.personId,
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          } else if (
            account.type === 'taxable' &&
            (taxableSnapshots.get(allocation.sourceAccountId) == null ||
              !taxableSnapshotMatches(
                taxableSnapshots.get(allocation.sourceAccountId)!,
                account,
                request.personId,
                input.year,
              ))
          ) {
            blockingReasons.push(
              createActionReason('withdrawal-taxable-basis-unsupported', {
                personId: request.personId,
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          } else if (
            account.type === 'taxable' &&
            (workingBalances.get(allocation.sourceAccountId) ?? 0) === 0 &&
            (workingTaxableBases.get(allocation.sourceAccountId) ?? 0) > 0
          ) {
            blockingReasons.push(
              createActionReason('withdrawal-taxable-basis-unsupported', {
                personId: request.personId,
                accountId: allocation.sourceAccountId,
                allocationId: allocation.allocationId,
              }),
            )
          }
        }
        if (snapshots.get(allocation.sourceAccountId) == null) {
          blockingReasons.push(
            createActionReason('required-facts-missing', {
              personId: request.personId,
              accountId: allocation.sourceAccountId,
              allocationId: allocation.allocationId,
            }),
          )
        }
      }
    }

    if (blockingReasons.length > 0) {
      const disposition = nonActionableDisposition(
        request.requestedAmount,
        blockingReasons,
      )
      evidence.push(
        executionEvidence(
          item,
          disposition,
          unresolvedAllocationEvidence(
            allocations,
            accounts,
            snapshots,
            workingBalances,
            requestPersonId(request),
          ),
        ),
      )
      continue
    }
    if (request.kind !== 'ordinaryWithdrawal') {
      throw new Error('Unsupported action scope reached ordinary-withdrawal movement')
    }
    if (item.executionDate === null) {
      throw new Error('Validated ordinary-withdrawal schedule disappeared')
    }

    const stagedBalances = new Map(workingBalances)
    const stagedTaxableBases = new Map(workingTaxableBases)
    const allocationEvidence: SourceAllocationExecutionEvidence[] = []
    const taxCharacter: OrdinaryWithdrawalTaxCharacter[] = []
    const penaltyCoverage: NonRetirementSourcePenaltyCoverageEvidence[] = []
    const acceptedSourceEligibility: AcceptedOrdinaryWithdrawalSourceEligibilityEvidence[] =
      []
    let executedTotal = 0n
    for (const allocation of allocations) {
      const before = stagedBalances.get(allocation.sourceAccountId)
      if (before === undefined) {
        throw new Error('Validated ordinary-withdrawal snapshot disappeared')
      }
      const account = accounts.get(allocation.sourceAccountId)
      if (
        account == null ||
        (account.type !== 'cash' &&
          (scope === 'cashOnly' ||
            (account.type !== 'equityComp' &&
              (scope !== 'cashEquityCompensationAndTaxable' ||
                account.type !== 'taxable'))))
      ) {
        throw new Error('Validated ordinary-withdrawal source disappeared')
      }
      const executedAmount = centsFromBigInt(
        BigInt(before) < BigInt(allocation.requestedAmount)
          ? BigInt(before)
          : BigInt(allocation.requestedAmount),
      )
      const after = centsFromBigInt(BigInt(before) - BigInt(executedAmount))
      const unexecutedAmount = centsFromBigInt(
        BigInt(allocation.requestedAmount) - BigInt(executedAmount),
      )
      stagedBalances.set(allocation.sourceAccountId, after)
      executedTotal += BigInt(executedAmount)
      allocationEvidence.push({
        ...allocation,
        resolution: 'resolved',
        ownerPersonIds: [request.personId],
        actingPersonId: request.personId,
        balanceBefore: before,
        executedAmount,
        unexecutedAmount,
        balanceAfter: after,
      })
      if (executedAmount > 0) {
        const positiveExecutedAmount = asPositiveUsdCents(executedAmount)
        if (account.type === 'cash') {
          taxCharacter.push({
            actionId: request.actionId,
            allocationId: allocation.allocationId,
            sourceAccountId: allocation.sourceAccountId,
            sourceClass: 'cash',
            kind: 'cashPrincipal',
            amount: positiveExecutedAmount,
            characterEvidence: {
              rule: 'intrinsicCashPrincipal',
              allocationId: allocation.allocationId,
              segmentAmount: positiveExecutedAmount,
            },
          })
        } else if (account.type === 'taxable') {
          const snapshot = taxableSnapshots.get(allocation.sourceAccountId)
          const basisBefore = stagedTaxableBases.get(allocation.sourceAccountId)
          if (snapshot == null || basisBefore === undefined) {
            throw new Error('Validated taxable basis snapshot disappeared')
          }
          const classified = classifyIndividuallyOwnedTaxableWithdrawal({
            actionId: request.actionId,
            allocationId: allocation.allocationId,
            sourceAccountId: allocation.sourceAccountId,
            actingPersonId: request.personId,
            evaluationDate: item.executionDate,
            executedAmount,
            preExecutionFairMarketValue: asPositiveUsdCents(before),
            remainingCostBasisBeforeExecution: basisBefore,
            ownership: snapshot.ownership,
            taxUnit: snapshot.taxUnit,
          })
          acceptedSourceEligibility.push(classified.acceptedSourceEligibility)
          taxCharacter.push(...classified.taxCharacter)
          stagedTaxableBases.set(
            allocation.sourceAccountId,
            centsFromBigInt(
              BigInt(basisBefore) -
                BigInt(
                  classified.acceptedSourceEligibility.basisEvidence
                    .basisRecoveredAmount,
                ),
            ),
          )
        }
      }
      const sourceClass =
        account.type === 'cash'
          ? 'cash'
          : account.type === 'equityComp'
            ? 'equityCompensation'
            : 'taxable'
      const vestingEvidenceId =
        account.type === 'equityComp'
          ? equityCompensationVestingEvidenceId(
              allocation.sourceAccountId,
              account.vestingMode,
              account.vestDate,
            )
          : null
      const characterEvidenceId =
        vestingEvidenceId === null
          ? null
          : equityCompensationCharacterEvidenceId(
              request.actionId,
              allocation.allocationId,
              item.executionDate,
              vestingEvidenceId,
            )
      if (account.type === 'equityComp' && executedAmount > 0) {
        const positiveExecutedAmount = asPositiveUsdCents(executedAmount)
        if (characterEvidenceId === null) {
          throw new Error('Equity-compensation character identity disappeared')
        }
        taxCharacter.push({
          actionId: request.actionId,
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          sourceClass: 'equityCompensation',
          kind: 'ordinaryIncome',
          amount: positiveExecutedAmount,
          characterEvidence: {
            rule: 'fullyTaxableCompensationAtExecution',
            sourceCharacterEvidenceId: characterEvidenceId,
            segmentAmount: positiveExecutedAmount,
          },
        })
      }
      penaltyCoverage.push({
        coverageEvidenceId: nonRetirementCoverageEvidenceId(
          request.actionId,
          allocation.allocationId,
          sourceClass,
        ),
        actionId: request.actionId,
        allocationId: allocation.allocationId,
        sourceAccountId: allocation.sourceAccountId,
        applicability: 'notApplicable',
        sourceClass,
        reason: 'nonRetirementSource',
        executedAmount,
        penaltyRelevantCharacterAmount: 0,
        nonPenaltyRelevantCharacterAmount: executedAmount,
        coveredPenaltyExposureAmount: 0,
        coverageDifferenceAmount: 0,
        segments: [],
      })
      if (account.type === 'cash') {
        acceptedSourceEligibility.push({
          predicate: 'isSpendableInYear',
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          evaluationDate: item.executionDate,
          sourceClass: 'cash',
          availabilityEvidence: { kind: 'intrinsicallySpendable' },
        })
      } else if (account.type === 'equityComp') {
        if (vestingEvidenceId === null || characterEvidenceId === null) {
          throw new Error('Equity-compensation evidence identity disappeared')
        }
        const availabilityEvidence =
          account.vestingMode === 'final'
            ? {
                kind: 'alreadyVested' as const,
                vestingMode: 'final' as const,
                vestingEvidenceId,
                vestedOnEvaluationDate: true as const,
              }
            : {
                kind: 'vested' as const,
                vestingMode: 'cliff' as const,
                vestingDate: account.vestDate!,
                vestingEvidenceId,
                vestedOnEvaluationDate: true as const,
              }
        acceptedSourceEligibility.push({
          predicate: 'isSpendableInYear',
          allocationId: allocation.allocationId,
          sourceAccountId: allocation.sourceAccountId,
          evaluationDate: item.executionDate,
          sourceClass: 'equityCompensation',
          availabilityEvidence,
          characterEvidence: {
            rule: 'fullyTaxableCompensationAtExecution',
            allocationId: allocation.allocationId,
            sourceAccountId: allocation.sourceAccountId,
            actingPersonId: request.personId,
            evaluationDate: item.executionDate,
            vestingEvidenceId,
            executedAmount,
            ordinaryIncomeAmount: executedAmount,
            characterEvidenceId,
          },
        })
      } else if (executedAmount === 0) {
        const basisBefore = stagedTaxableBases.get(allocation.sourceAccountId)
        if (before !== 0 || basisBefore !== 0) {
          throw new Error(
            'Zero-execution taxable evidence requires a depleted zero-basis source',
          )
        }
        acceptedSourceEligibility.push(
          zeroExecutionTaxableEligibility(
            request.actionId,
            allocation.allocationId,
            allocation.sourceAccountId,
            item.executionDate,
          ),
        )
      }
    }
    const disposition = actionableDisposition(
      request.requestedAmount,
      centsFromBigInt(executedTotal),
    )
    if (disposition.readiness === 'actionable') {
      workingBalances = stagedBalances
      workingTaxableBases = stagedTaxableBases
    }
    evidence.push(
      executionEvidence(
        item,
        disposition,
        allocationEvidence,
        taxCharacter,
        penaltyCoverage,
        acceptedSourceEligibility,
      ),
    )
  }

  const balances = openingBalances
    .map((snapshot): AccountBalanceExecutionEvidence => ({
      ...snapshot,
      closingBalance:
        snapshotCounts.get(snapshot.accountId) === 1
          ? (workingBalances.get(snapshot.accountId) ?? snapshot.openingBalance)
          : snapshot.openingBalance,
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId) ||
        left.openingBalance - right.openingBalance,
    )
  const taxableBases = taxableAccountSnapshots
    .map((snapshot): TaxableAccountBasisExecutionEvidence => ({
      ...snapshot,
      closingCostBasis:
        taxableSnapshotCounts.get(snapshot.accountId) === 1
          ? (workingTaxableBases.get(snapshot.accountId) ??
            snapshot.openingCostBasis)
          : snapshot.openingCostBasis,
    }))
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.accountId, right.accountId) ||
        left.openingCostBasis - right.openingCostBasis,
    )

  return deepFreeze({
    committed: true,
    requests: publishedRequests,
    scheduleIssues: [],
    balances,
    taxableBases,
    evidence,
  })
}

/**
 * Pure exact-cent execution for individually owned cash and vested
 * equity-compensation ordinary withdrawals. Plan dollar balances are identity
 * metadata only; all movement uses snapshots.
 */
export function executeOrdinaryWithdrawals(
  input: ExecuteOrdinaryWithdrawalsInput,
): ExecuteOrdinaryWithdrawalsResult {
  return executeOrdinaryWithdrawalsInScope(
    input,
    input.taxableAccountSnapshots === undefined
      ? 'cashAndEquityCompensation'
      : 'cashEquityCompensationAndTaxable',
  )
}

function assertCashOnlyExecutionResult(
  result: ExecuteOrdinaryWithdrawalsResult,
): asserts result is ExecuteOrdinaryWithdrawalsResult & {
  evidence: readonly CashOrdinaryWithdrawalExecutionEvidence[]
} {
  for (const evidence of result.evidence) {
    if (evidence.readiness === 'nonActionable') continue
    if (
      evidence.acceptedSourceEligibility.some(
        (accepted) => accepted.sourceClass !== 'cash',
      ) ||
      evidence.taxCharacter.some((character) => character.sourceClass !== 'cash') ||
      evidence.penaltyCoverage.some((coverage) => coverage.sourceClass !== 'cash')
    ) {
      throw new Error('Cash-only compatibility execution emitted noncash evidence')
    }
  }
}

/**
 * Original WS3.1 cash-only entry point. Equity-compensation and every other
 * noncash source remain typed zero-movement evidence through this wrapper.
 */
export function executeCashOrdinaryWithdrawals(
  input: ExecuteCashOrdinaryWithdrawalsInput,
): ExecuteCashOrdinaryWithdrawalsResult {
  const result = executeOrdinaryWithdrawalsInScope(input, 'cashOnly')
  assertCashOnlyExecutionResult(result)
  return deepFreeze({
    committed: result.committed,
    requests: result.requests,
    scheduleIssues: result.scheduleIssues,
    balances: result.balances,
    evidence: result.evidence,
  })
}
