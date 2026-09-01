/**
 * Exact-cent ordinary-withdrawal boundary for one annual simulation pass.
 *
 * This module owns the whole lossy transaction boundary: it snapshots the
 * live Plan-number balances and taxable basis, executes in exact cents,
 * retries after removing facts that cannot cross back losslessly, and derives
 * the positional writes for the final committed result. It does not mutate the
 * caller's balances; the caller applies the returned writes in array order.
 */
import type { Account, Plan } from '../../model/plan.js'
import {
  asAccountId,
  asPersonId,
  assessOrdinaryWithdrawalPlanBoundary,
  executeOrdinaryWithdrawals,
  ledgerCentsToPlanDollars,
  planDollarsToLedgerCents,
  type ActionId,
  type ConversionLinkedWithdrawalGroupAssessment,
  type ExecuteOrdinaryWithdrawalsResult,
  type OrdinaryWithdrawalRequest,
  type PersonId,
  type RetirementActionRequest,
  type TaxableAccountOpeningSnapshot,
} from '../../actions/index.js'
import type { NonpersistedActionPersonAliveEvidence } from
  '../../strategies/accountEligibility.js'

type OrdinaryWithdrawalBalanceAccount = Extract<
  Account,
  {
    type:
      | 'cash'
      | 'taxable'
      | 'equityComp'
      | 'traditional'
      | 'roth'
      | 'hsa'
  }
>

export interface AnnualOrdinaryWithdrawalBalanceState {
  readonly account: Readonly<OrdinaryWithdrawalBalanceAccount>
  readonly balance: number
  readonly costBasis: number
}

export interface AnnualOrdinaryWithdrawalTaxUnit {
  readonly taxUnitId: string
  readonly taxUnitEvidenceId: string
  readonly stateFilingStatusId: string
  readonly federalFilingStatus:
    TaxableAccountOpeningSnapshot['taxUnit']['federalFilingStatus']
  readonly members: readonly [PersonId, ...PersonId[]]
}

export interface AnnualOrdinaryWithdrawalBoundaryInput {
  readonly year: number
  /** The annual pass's exact Plan snapshot, forwarded to the executor. */
  readonly plan: Plan
  /** Strictly the year's authored ordinary withdrawals; owns source inventory. */
  readonly ordinaryActions: readonly Readonly<OrdinaryWithdrawalRequest>[]
  /** The possibly widened request set handed to the ordinary executor. */
  readonly executionRequests: readonly Readonly<RetirementActionRequest>[]
  /** Live state at this phase, read only; writes are returned positionally. */
  readonly balances: readonly AnnualOrdinaryWithdrawalBalanceState[]
  readonly taxUnit: Readonly<AnnualOrdinaryWithdrawalTaxUnit> | null
  readonly conversionLinkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
  readonly actionPersonAliveEvidence: (
    actionId: ActionId,
    personId: PersonId,
    actionDate: string | null,
  ) => NonpersistedActionPersonAliveEvidence
}

export type AnnualOrdinaryWithdrawalBalanceOperation =
  | Readonly<{ kind: 'none' }>
  | Readonly<{
      kind: 'write'
      accountId: string
      closingBalance: number
      /** Null means retain the caller's current basis. */
      closingCostBasis: number | null
    }>

export interface AnnualOrdinaryWithdrawalBoundaryResult {
  readonly execution: ExecuteOrdinaryWithdrawalsResult | undefined
  readonly totals: Readonly<{
    cash: number
    equityCompensation: number
    taxableProceeds: number
    proceeds: number
    capitalGainOrLoss: number
  }>
  /** Exactly one operation per input balance, in input order. */
  readonly balanceOperations:
    readonly AnnualOrdinaryWithdrawalBalanceOperation[]
}

export function annualOrdinaryWithdrawalBoundary(
  input: AnnualOrdinaryWithdrawalBoundaryInput,
): AnnualOrdinaryWithdrawalBoundaryResult {
  let execution: ExecuteOrdinaryWithdrawalsResult | undefined
  let cash = 0
  let equityCompensation = 0
  let taxableProceeds = 0
  let proceeds = 0
  let capitalGainOrLoss = 0

  if (input.executionRequests.length > 0) {
    const ordinarySourceAccountIds = new Set<string>(
      input.ordinaryActions.flatMap((request) =>
        request.allocations.map((allocation) => allocation.sourceAccountId),
      ),
    )
    let openingBalances = [...input.balances]
      .filter((state) => ordinarySourceAccountIds.has(state.account.id))
      .sort((left, right) =>
        left.account.id < right.account.id
          ? -1
          : left.account.id > right.account.id
            ? 1
            : 0,
      )
      .flatMap((state) => {
        try {
          return [{
            accountId: asAccountId(state.account.id),
            openingBalance: planDollarsToLedgerCents(state.balance),
          }]
        } catch {
          // A schema-valid Plan balance can exceed the exact-cent ledger's
          // safe range. Omit it so the executor reports required facts
          // missing instead of aborting the whole projection.
          return []
        }
      })
    let taxableAccountSnapshots: TaxableAccountOpeningSnapshot[] =
      input.taxUnit === null
        ? []
        : [...input.balances]
          .filter(
            (state): state is AnnualOrdinaryWithdrawalBalanceState & {
              account: Extract<OrdinaryWithdrawalBalanceAccount, {
                type: 'taxable'
              }> & { ownerPersonId: string }
            } =>
              ordinarySourceAccountIds.has(state.account.id) &&
              state.account.type === 'taxable' &&
              state.account.ownerPersonId !== null,
          )
          .sort((left, right) =>
            left.account.id < right.account.id
              ? -1
              : left.account.id > right.account.id
                ? 1
                : 0,
          )
          .flatMap((state) => {
            try {
              const accountId = asAccountId(state.account.id)
              const ownerPersonId = asPersonId(state.account.ownerPersonId)
              if (!input.taxUnit!.members.includes(ownerPersonId)) return []
              return [{
                accountId,
                openingCostBasis: planDollarsToLedgerCents(state.costBasis),
                ownership: {
                  accountOwnerPersonIds: [ownerPersonId],
                  accountOwnershipEvidenceId:
                    `projection-account-ownership:${JSON.stringify([
                      accountId,
                      ownerPersonId,
                      input.year,
                      input.taxUnit!.federalFilingStatus,
                      input.taxUnit!.members,
                    ])}`,
                  beneficialOwnershipShare: {
                    representation: 'exactRational' as const,
                    numerator: 1 as const,
                    denominator: 1 as const,
                    intermediateArithmetic: 'bigintRational' as const,
                  },
                  attributionEvidenceId:
                    `projection-taxable-attribution:${JSON.stringify([
                      accountId,
                      ownerPersonId,
                      input.year,
                      input.taxUnit!.federalFilingStatus,
                      input.taxUnit!.members,
                    ])}`,
                },
                taxUnit: {
                  taxUnitId: input.taxUnit!.taxUnitId,
                  taxUnitMemberPersonIds: input.taxUnit!.members,
                  federalFilingStatus: input.taxUnit!.federalFilingStatus,
                  stateFilingStatusId: input.taxUnit!.stateFilingStatusId,
                  taxUnitEvidenceId: input.taxUnit!.taxUnitEvidenceId,
                  taxYear: input.year,
                },
              }]
            } catch {
              // Keep a valid balance visible while omitting invalid basis
              // evidence so taxable movement fails closed and explains why.
              return []
            }
          })
    const personAliveEvidence = input.executionRequests.flatMap(
      (request): NonpersistedActionPersonAliveEvidence[] => {
        if (
          request.kind === 'legacyAggregateWithdrawal' ||
          request.kind === 'legacyAggregateRothConversion' ||
          request.kind === 'legacyAggregateQcd'
        ) {
          return []
        }
        const personId =
          request.kind === 'qcd' ? request.donorPersonId : request.personId
        return [input.actionPersonAliveEvidence(
          request.actionId,
          personId,
          request.executionDate ?? null,
        )]
      },
    )

    while (true) {
      execution = executeOrdinaryWithdrawals({
        year: input.year,
        plan: input.plan,
        requests: input.executionRequests,
        openingBalances,
        taxableAccountSnapshots,
        runtimeEvidence: {
          personAliveEvidence,
          conversionLinkedWithdrawalGroups:
            input.conversionLinkedWithdrawalGroups,
        },
      })
      const boundary = assessOrdinaryWithdrawalPlanBoundary(execution)
      const unrepresentableClosingBalanceAccountIds = new Set(
        boundary.unrepresentableClosingBalanceAccountIds.map(String),
      )
      const unrepresentableClosingBasisAccountIds = new Set(
        boundary.unrepresentableClosingBasisAccountIds.map(String),
      )
      const aggregateFailureSourceAccountIds = new Set(
        boundary.aggregateFailureSourceAccountIds.map(String),
      )
      if (boundary.totals.cash !== null) cash = boundary.totals.cash
      if (boundary.totals.equityCompensation !== null) {
        equityCompensation = boundary.totals.equityCompensation
      }
      if (boundary.totals.taxableProceeds !== null) {
        taxableProceeds = boundary.totals.taxableProceeds
      }
      if (boundary.totals.proceeds !== null) proceeds = boundary.totals.proceeds
      if (boundary.totals.capitalGainOrLoss !== null) {
        capitalGainOrLoss = boundary.totals.capitalGainOrLoss
      }
      if (
        unrepresentableClosingBalanceAccountIds.size === 0 &&
        unrepresentableClosingBasisAccountIds.size === 0 &&
        aggregateFailureSourceAccountIds.size === 0
      ) {
        break
      }

      // The action ledger is exact-cent while Plan balances are numbers. If a
      // closing value or annual aggregate cannot cross that boundary
      // losslessly, rerun without the affected fact source. Independent
      // actions whose sources remain available may still execute.
      const unavailableBalanceAccountIds = new Set([
        ...unrepresentableClosingBalanceAccountIds,
        ...aggregateFailureSourceAccountIds,
      ])
      openingBalances = openingBalances.filter(
        (snapshot) =>
          !unavailableBalanceAccountIds.has(String(snapshot.accountId)),
      )
      taxableAccountSnapshots = taxableAccountSnapshots.filter(
        (snapshot) =>
          !unavailableBalanceAccountIds.has(String(snapshot.accountId)) &&
          !unrepresentableClosingBasisAccountIds.has(
            String(snapshot.accountId),
          ),
      )
    }
  }

  const closingCentsByAccountId = execution?.committed
    ? new Map(
        execution.balances
          .filter((snapshot) =>
            snapshot.closingBalance !== snapshot.openingBalance)
          .map((snapshot) =>
            [String(snapshot.accountId), snapshot.closingBalance]),
      )
    : new Map<string, never>()
  const closingTaxableBasisCentsByAccountId = execution?.committed
    ? new Map(
        execution.taxableBases.map((snapshot) => [
          String(snapshot.accountId),
          snapshot.closingCostBasis,
        ]),
      )
    : new Map<string, never>()
  const balanceOperations = input.balances.map(
    (state): AnnualOrdinaryWithdrawalBalanceOperation => {
      const closingCents = closingCentsByAccountId.get(state.account.id)
      if (closingCents === undefined) return { kind: 'none' }

      const closingBalance = ledgerCentsToPlanDollars(closingCents)
      let closingCostBasis: number | null = null
      if (state.account.type === 'taxable') {
        const closingBasisCents =
          closingTaxableBasisCentsByAccountId.get(state.account.id)
        if (closingBasisCents === undefined) {
          throw new Error('Committed taxable closing balance lost its paired basis')
        }
        closingCostBasis = ledgerCentsToPlanDollars(closingBasisCents)
      } else if (state.account.type === 'equityComp' && state.balance > 0) {
        const executed = state.balance - closingBalance
        const basisRatio = Math.min(1, state.costBasis / state.balance)
        closingCostBasis = Math.max(
          0,
          state.costBasis - executed * basisRatio,
        )
      }
      return {
        kind: 'write',
        accountId: state.account.id,
        closingBalance,
        closingCostBasis,
      }
    },
  )

  return {
    execution,
    totals: {
      cash,
      equityCompensation,
      taxableProceeds,
      proceeds,
      capitalGainOrLoss,
    },
    balanceOperations,
  }
}
