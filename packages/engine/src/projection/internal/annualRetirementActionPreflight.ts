/**
 * Routes one year's named retirement actions and takes the shared
 * conversion-linked withdrawal decision before either executor runs.
 *
 * The coordinator owns request partitioning, mixed-kind/QCD collision
 * routing, balance-snapshot fundability, and provisional/proven linked-group
 * release selection. It does not execute an action or mutate a balance;
 * `simulatePlan` retains every executor call, live ledger write, journal
 * entry, and any later revocation when an authorized withdrawal does not move.
 */
import {
  asUsdCents,
  assessConversionLinkedWithdrawalGroups,
  evaluateRetirementActionSchedule,
  planDollarsToFlooredLedgerCents,
  type ConversionLinkedWithdrawalGroupAssessment,
  type ConversionLinkedWithdrawalGroupAuthorization,
  type OrdinaryWithdrawalRequest,
  type QualifiedCharitableDistributionRequest,
  type RetirementActionRequest,
  type RothConversionRequest,
} from '../../actions/index.js'
import type {
  AnnualConversionLinkedWithdrawalRelease,
} from './annualConversionLinkedWithdrawalFunding.js'

export interface AnnualRetirementActionPreflightBalance {
  readonly accountId: string
  readonly balancePlanDollars: number
}

export interface AnnualRetirementActionPreflightInput {
  readonly taxYear: number
  /** The annual pass's action array after any counterfactual omissions. */
  readonly retirementActions: readonly Readonly<RetirementActionRequest>[]
  /** Immutable balances standing immediately before named action execution. */
  readonly balances: readonly Readonly<AnnualRetirementActionPreflightBalance>[]
  readonly annualLiabilityBaseline: 'read' | 'unavailable'
  /** Permission earned, or withheld, by the outer funding coordinator. */
  readonly linkedGroupRelease: Readonly<AnnualConversionLinkedWithdrawalRelease>
}

export interface AnnualRetirementActionPreflightResult {
  readonly ordinaryActions: readonly Readonly<OrdinaryWithdrawalRequest>[]
  readonly conversionActions: readonly Readonly<RothConversionRequest>[]
  readonly qcdExecutionActions:
    readonly Readonly<QualifiedCharitableDistributionRequest>[]
  /** The possibly widened request set handed to the ordinary executor. */
  readonly ordinaryExecutionActions:
    readonly Readonly<RetirementActionRequest>[]
  readonly mixedKindScheduleBlocked: boolean
  /** Complete annual request union shared by group settlement/publication. */
  readonly linkedGroupAssessmentRequests:
    readonly Readonly<RetirementActionRequest>[]
  /** Fail-closed verdict restored if an authorized withdrawal leg falls short. */
  readonly observedConversionLinkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
  readonly conversionLinkedWithdrawalGroups:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
}

/** Materialize the discriminant once and detach any caller-owned array. */
function snapshotLinkedGroupRelease(
  release: Readonly<AnnualConversionLinkedWithdrawalRelease>,
): Readonly<AnnualConversionLinkedWithdrawalRelease> {
  const kind = release.kind
  return kind === 'proven'
    ? Object.freeze({
        kind,
        authorizations: Object.freeze([...release.authorizations]),
      })
    : Object.freeze({ kind })
}

/**
 * Can every allocation of one group leg be funded from the annual snapshot?
 *
 * Capacity is floored, never rounded: a rounded Plan balance can claim one
 * cent the exact ledger cannot move. This is only a staging precondition.
 * The discarded staging run remains responsible for proving that every leg
 * actually moved whole, including contention between otherwise fundable
 * groups.
 */
function legFundableFromSnapshot(
  request: Readonly<RetirementActionRequest>,
  balancePlanDollarsByAccountId: ReadonlyMap<string, number>,
): boolean {
  if (
    request.kind !== 'rothConversion' &&
    request.kind !== 'ordinaryWithdrawal'
  ) return false

  const requestedBySourceAccountId = new Map<string, number>()
  for (const allocation of request.allocations) {
    requestedBySourceAccountId.set(
      allocation.sourceAccountId,
      (requestedBySourceAccountId.get(allocation.sourceAccountId) ?? 0) +
        allocation.requestedAmount,
    )
  }
  for (const [accountId, requested] of requestedBySourceAccountId) {
    const balancePlanDollars = balancePlanDollarsByAccountId.get(accountId)
    // This explicit guard is also the type-narrowing boundary for the exact-
    // cent conversion below. Removing it is a compile error, not an alternate
    // path that can silently turn an absent balance into capacity.
    if (balancePlanDollars === undefined) return false
    try {
      if (planDollarsToFlooredLedgerCents(balancePlanDollars) < requested) {
        return false
      }
    } catch {
      // An unrepresentable balance cannot prove exact-cent capacity.
      return false
    }
  }
  return true
}

function provisionalLinkedGroupAuthorizations(
  requests: readonly Readonly<RetirementActionRequest>[],
  assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
  balancePlanDollarsByAccountId: ReadonlyMap<string, number>,
): readonly Readonly<ConversionLinkedWithdrawalGroupAuthorization>[] {
  const requestByActionId = new Map(
    requests.map((request) => [request.actionId, request] as const),
  )
  const authorizations: ConversionLinkedWithdrawalGroupAuthorization[] = []
  for (const group of assessment.groups) {
    if (group.refusalKind === 'sharedFundingWithdrawal') continue
    const conversion = requestByActionId.get(group.conversionActionId)
    const withdrawal = requestByActionId.get(group.withdrawalActionId)
    if (
      conversion?.kind !== 'rothConversion' ||
      withdrawal?.kind !== 'ordinaryWithdrawal' ||
      !legFundableFromSnapshot(conversion, balancePlanDollarsByAccountId) ||
      !legFundableFromSnapshot(withdrawal, balancePlanDollarsByAccountId)
    ) continue
    authorizations.push({
      conversionActionId: group.conversionActionId,
      withdrawalActionId: group.withdrawalActionId,
      funding: {
        // These deliberately duplicate the withdrawal's authored cents. The
        // provisional run is testing the hypothesis that this exact withdrawal
        // can fund this conversion; the discarded run later computes the real
        // liability allocation and either proves or rejects that hypothesis.
        requiredFundingAmount: asUsdCents(withdrawal.requestedAmount),
        fundedAmount: asUsdCents(withdrawal.requestedAmount),
      },
    })
  }
  return authorizations
}

/** Route named actions and publish one pre-execution linked-group verdict. */
export function annualRetirementActionPreflight(
  input: Readonly<AnnualRetirementActionPreflightInput>,
): Readonly<AnnualRetirementActionPreflightResult> {
  const linkedGroupRelease = snapshotLinkedGroupRelease(input.linkedGroupRelease)
  // The assessor has no year predicate of its own. Scope the entire shared
  // request union here so another year's unexecuted pair cannot poison this
  // year's all-or-nothing release, including counterfactual passes that omit a
  // request from the annual action array.
  const currentYearActions = Object.freeze(input.retirementActions.filter(
    (request) => request.year === input.taxYear,
  ))
  const ordinaryActions = Object.freeze(currentYearActions.filter(
    (request): request is OrdinaryWithdrawalRequest =>
      request.kind === 'ordinaryWithdrawal',
  ))
  const conversionActions = Object.freeze(currentYearActions.filter(
    (request): request is RothConversionRequest =>
      request.kind === 'rothConversion',
  ))
  const nonConversionActions = Object.freeze(currentYearActions.filter(
    (request) => request.kind !== 'rothConversion',
  ))
  const schedule = evaluateRetirementActionSchedule(
    input.taxYear,
    currentYearActions,
  )
  const mixedKindScheduleBlocked =
    schedule.scheduleIssues.length > 0 &&
    nonConversionActions.length > 0 &&
    conversionActions.length > 0
  const qcdActions = Object.freeze(currentYearActions.filter(
    (request): request is QualifiedCharitableDistributionRequest =>
      request.kind === 'qcd',
  ))

  // A QCD colliding with a non-QCD stays with the ordinary executor so one
  // source owns both sides of the diagnostic. A QCD-only collision remains in
  // the QCD executor, which can publish that collision itself.
  const qcdActionIds = new Set(qcdActions.map((request) => request.actionId))
  const crossKindCollidingQcdActionIds = new Set(
    schedule.scheduleIssues.flatMap((issue) =>
      issue.kind === 'executionSequenceConflict' &&
      issue.collidingActionIds.some((actionId) => !qcdActionIds.has(actionId))
        ? issue.collidingActionIds.filter((actionId) =>
            qcdActionIds.has(actionId))
        : []),
  )
  const qcdExecutionActions = Object.freeze(qcdActions.filter(
    (request) => !crossKindCollidingQcdActionIds.has(request.actionId),
  ))
  const ordinaryExecutionActions = Object.freeze((
    mixedKindScheduleBlocked ? currentYearActions : nonConversionActions
  ).filter((request) =>
    request.kind !== 'qcd' ||
    crossKindCollidingQcdActionIds.has(request.actionId)))

  // The group decision needs the annual union visible across both disjoint
  // executors. Duplicates are intentional and collapse in the assessor.
  const linkedGroupAssessmentRequests = Object.freeze([
    ...currentYearActions,
    ...ordinaryExecutionActions,
    ...conversionActions,
  ])
  // A baseline that was read lets the assessor refuse on the funding merits.
  // An unavailable baseline means this run cannot answer the liability
  // question, so the assessor must publish the distinct unsupported reason.
  const observedLinkedWithdrawalGroups = assessConversionLinkedWithdrawalGroups(
    linkedGroupAssessmentRequests,
    { annualLiabilityBaseline: input.annualLiabilityBaseline },
  )
  const balancePlanDollarsByAccountId = new Map(
    input.balances.map((balance) => [
      balance.accountId,
      balance.balancePlanDollars,
    ] as const),
  )
  const linkedGroupAuthorizations =
    linkedGroupRelease.kind === 'proven'
      ? linkedGroupRelease.authorizations
      : linkedGroupRelease.kind === 'stageProvisionally'
        ? provisionalLinkedGroupAuthorizations(
            linkedGroupAssessmentRequests,
            observedLinkedWithdrawalGroups,
            balancePlanDollarsByAccountId,
          )
        : []
  const conversionLinkedWithdrawalGroups =
    linkedGroupAuthorizations.length === 0
      ? observedLinkedWithdrawalGroups
      : assessConversionLinkedWithdrawalGroups(
          linkedGroupAssessmentRequests,
          {
            annualLiabilityBaseline: input.annualLiabilityBaseline,
            authorizedGroups: linkedGroupAuthorizations,
          },
        )

  return Object.freeze({
    ordinaryActions,
    conversionActions,
    qcdExecutionActions,
    ordinaryExecutionActions,
    mixedKindScheduleBlocked,
    linkedGroupAssessmentRequests,
    observedConversionLinkedWithdrawalGroups: observedLinkedWithdrawalGroups,
    conversionLinkedWithdrawalGroups,
  })
}
