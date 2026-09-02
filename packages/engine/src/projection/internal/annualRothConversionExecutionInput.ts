/**
 * Prepares the immutable evidence and exact-cent snapshots consumed by the
 * named Roth-conversion executor for one annual pass.
 *
 * This coordinator owns no economic movement. `simulatePlan` retains the
 * executor call, every live debit/credit, Form 8606 and Roth-basis mutation,
 * runtime occurrence/application, warning, settlement, and publication.
 */
import type { Plan } from '../../model/plan.js'
import {
  asAccountId,
  asUsdCents,
  planDollarsToFlooredLedgerCents,
  planDollarsToLedgerCents,
  type ConversionLinkedWithdrawalGroupAssessment,
  type ExecuteRothConversionsInput,
  type RothConversionRequest,
} from '../../actions/index.js'
import { compareUtf16CodeUnits } from '../../actions/structuralId.js'
import type {
  NonpersistedOwnerAggregatedIraBasisEvidence,
  NonpersistedOwnerIraRmdSatisfactionEvidence,
} from '../../strategies/accountEligibility.js'

export interface AnnualRothConversionExecutionInputPerson {
  readonly personId: string
  readonly alive: boolean
}

export interface AnnualRothConversionExecutionInputBalance {
  readonly accountId: string
  /** Live balance immediately before named-conversion preparation. */
  readonly balancePlanDollars: number
}

export interface AnnualRothConversionExecutionInputOwnerRmd {
  readonly ownerPersonId: string
  readonly requiredPlanDollars: number
  readonly unsatisfiedPlanDollars: number
}

export interface AnnualRothConversionExecutionInputOwnerBasis {
  readonly ownerPersonId: string
  readonly basisPlanDollars: number
}

export interface AnnualRothConversionLinkedWithdrawalEvidence {
  readonly actionId: string
  readonly requestedAmount: number
  readonly readiness: 'actionable' | 'nonActionable'
  readonly outcome: 'executed' | 'partial' | 'refused' | 'unsupported'
  readonly executedAmount: number
}

export interface AnnualRothConversionExecutionInput {
  readonly taxYear: number
  readonly plan: Readonly<Plan>
  readonly requests: readonly Readonly<RothConversionRequest>[]
  readonly mixedKindScheduleBlocked: boolean
  readonly people: readonly Readonly<AnnualRothConversionExecutionInputPerson>[]
  readonly balances:
    readonly Readonly<AnnualRothConversionExecutionInputBalance>[]
  readonly ownerRmd:
    readonly Readonly<AnnualRothConversionExecutionInputOwnerRmd>[]
  readonly ownerBasis:
    readonly Readonly<AnnualRothConversionExecutionInputOwnerBasis>[]
  /** Fail-closed group verdict from before any linked withdrawal moved. */
  readonly observedLinkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
  /** Provisional or proved group verdict offered to both executor legs. */
  readonly linkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
  /** Actual withdrawal dispositions, observed after their live writes. */
  readonly ordinaryWithdrawalEvidence:
    readonly Readonly<AnnualRothConversionLinkedWithdrawalEvidence>[]
}

interface AnnualRothConversionExecutionInputBaseResult {
  /** Verdict the later settlement/publication phase must use too. */
  readonly effectiveLinkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
}

export type AnnualRothConversionExecutionInputResult =
  | Readonly<AnnualRothConversionExecutionInputBaseResult & {
      readonly status: 'notRequested'
      readonly executorInput: null
    }>
  | Readonly<AnnualRothConversionExecutionInputBaseResult & {
      readonly status: 'blockedBySchedule'
      readonly executorInput: null
    }>
  | Readonly<AnnualRothConversionExecutionInputBaseResult & {
      readonly status: 'ready'
      readonly executorInput: Readonly<ExecuteRothConversionsInput>
    }>

function freezeRows<T extends object>(rows: readonly T[]): readonly Readonly<T>[] {
  return Object.freeze(rows.map((row) => Object.freeze(row)))
}

/** Prepare one annual named-conversion call without mutating the annual ledger. */
export function annualRothConversionExecutionInput(
  input: Readonly<AnnualRothConversionExecutionInput>,
): AnnualRothConversionExecutionInputResult {
  if (input.requests.length === 0) {
    return Object.freeze({
      status: 'notRequested',
      executorInput: null,
      effectiveLinkedWithdrawalGroups: input.linkedWithdrawalGroups,
    })
  }
  if (input.mixedKindScheduleBlocked) {
    return Object.freeze({
      status: 'blockedBySchedule',
      executorInput: null,
      effectiveLinkedWithdrawalGroups: input.linkedWithdrawalGroups,
    })
  }

  const conversionAccountIds = new Set<string>(
    input.requests.flatMap((request) => [
      request.destinationRothAccountId,
      ...request.allocations.map((allocation) => allocation.sourceAccountId),
    ]),
  )
  const conversionSourceAccountIds = new Set<string>(
    input.requests.flatMap((request) =>
      request.allocations.map((allocation) => allocation.sourceAccountId)),
  )
  const openingBalances = freezeRows([...input.balances]
    .filter((state) => conversionAccountIds.has(state.accountId))
    .sort((left, right) =>
      compareUtf16CodeUnits(left.accountId, right.accountId))
    .flatMap((state) => {
      try {
        return [{
          accountId: asAccountId(state.accountId),
          // Sources are spending capacity and must be truncated: rounding can
          // report a cent the live float cannot fund. Destinations are only a
          // measurement, so preserve the existing half-up snapshot there.
          openingBalance: conversionSourceAccountIds.has(state.accountId)
            ? planDollarsToFlooredLedgerCents(state.balancePlanDollars)
            : planDollarsToLedgerCents(state.balancePlanDollars),
        }]
      } catch {
        // Omission is fail-closed: the executor cannot resolve that account.
        return []
      }
    }))

  const peopleById = new Map(input.people.map((person) => [
    person.personId,
    person,
  ] as const))
  const ownerRmdById = new Map(input.ownerRmd.map((row) => [
    row.ownerPersonId,
    row,
  ] as const))
  const ownerBasisById = new Map(input.ownerBasis.map((row) => [
    row.ownerPersonId,
    row.basisPlanDollars,
  ] as const))

  const personAliveEvidence = freezeRows(input.requests.map((request) => ({
    evidenceId: `projection-alive:${JSON.stringify([
      request.actionId,
      request.personId,
      input.taxYear,
      request.executionDate ?? null,
    ])}`,
    actionId: request.actionId,
    personId: request.personId,
    actionYear: input.taxYear,
    actionDate: request.executionDate ?? null,
    alive: peopleById.get(request.personId)?.alive ?? false,
  })))

  // Treas. Reg. 1.408A-4 A-6(b) bars converting the year's RMD. The caller's
  // two-pass RMD phase is where required and distributed dollars became facts;
  // statement order alone is not evidence that an owner actually satisfied the
  // amount. Both values therefore cross this boundary in exact cents, and an
  // unrepresentable fact is omitted instead of proving satisfaction.
  const ownerIraRmdSatisfactionEvidence = freezeRows(input.requests
    .flatMap((request): NonpersistedOwnerIraRmdSatisfactionEvidence[] => {
      const row = ownerRmdById.get(request.personId)
      const required = row?.requiredPlanDollars ?? 0
      const unsatisfied = row?.unsatisfiedPlanDollars ?? 0
      try {
        const requiredAmount = planDollarsToLedgerCents(required)
        const shortfall = planDollarsToLedgerCents(Math.max(0, unsatisfied))
        return [{
          evidenceId:
            `projection-owner-ira-rmd-satisfaction:${JSON.stringify([
              request.actionId,
              request.personId,
              input.taxYear,
              request.executionDate ?? null,
            ])}`,
          actionId: request.actionId,
          personId: request.personId,
          actionYear: input.taxYear,
          actionDate: request.executionDate ?? null,
          requiredAmount,
          distributedAmount: asUsdCents(Math.max(
            0,
            requiredAmount - shortfall,
          )),
        }]
      } catch {
        // An unrepresentable annual fact cannot prove RMD satisfaction.
        return []
      }
    }))

  // The executor must distinguish a genuinely zero Form 8606 numerator from a
  // numerator it cannot observe. `ownerBasis` deliberately includes only the
  // caller's positive owner entries, so absence proves zero; a present but
  // unrepresentable value is omitted and cannot prove either state.
  const ownerAggregatedIraBasisEvidence = freezeRows(input.requests
    .flatMap((request): NonpersistedOwnerAggregatedIraBasisEvidence[] => {
      try {
        return [{
          evidenceId:
            `projection-owner-aggregated-ira-basis:${JSON.stringify([
              request.actionId,
              request.personId,
              input.taxYear,
              request.executionDate ?? null,
            ])}`,
          actionId: request.actionId,
          personId: request.personId,
          actionYear: input.taxYear,
          actionDate: request.executionDate ?? null,
          basisAmount: planDollarsToLedgerCents(
            ownerBasisById.get(request.personId) ?? 0,
          ),
        }]
      } catch {
        // An unrepresentable basis cannot prove a zero or positive numerator.
        return []
      }
    }))

  /**
   * Narrow the provisional group release by what the withdrawal leg actually
   * moved. The legs execute in separate annual phases, withdrawal first, so a
   * release survives only when every authorized withdrawal moved its entire
   * authored amount. The assessment's release rule is annual and all-or-none;
   * one incomplete leg therefore restores the original observed assessment.
   *
   * This closes conversion-without-funding. The opposite direction is closed
   * by the earlier floored-capacity assessment of both legs and backstopped by
   * settlement publication's linked-record atomicity assertion.
   */
  const withdrawalLegsMovedWhole = input.linkedWithdrawalGroups.groups
    .filter((group) => group.disposition === 'executedAsAtomicGroup')
    .every((group) => {
      const evidence = input.ordinaryWithdrawalEvidence.find(
        (entry) => entry.actionId === group.withdrawalActionId,
      )
      return evidence !== undefined &&
        evidence.readiness === 'actionable' &&
        evidence.outcome === 'executed' &&
        evidence.executedAmount === evidence.requestedAmount
    })
  const effectiveLinkedWithdrawalGroups = withdrawalLegsMovedWhole
    ? input.linkedWithdrawalGroups
    : input.observedLinkedWithdrawalGroups

  return Object.freeze({
    status: 'ready',
    effectiveLinkedWithdrawalGroups,
    executorInput: Object.freeze({
      year: input.taxYear,
      plan: input.plan,
      requests: input.requests,
      openingBalances,
      runtimeEvidence: Object.freeze({
        personAliveEvidence,
        ownerIraRmdSatisfactionEvidence,
        ownerAggregatedIraBasisEvidence,
        conversionLinkedWithdrawalGroups: effectiveLinkedWithdrawalGroups,
      }),
    }),
  })
}
