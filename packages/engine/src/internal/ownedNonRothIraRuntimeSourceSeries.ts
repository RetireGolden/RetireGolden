import { asAccountId, type AccountId, type PersonId } from '../actions/identity.js'
import { asUsdCents, type UsdCents } from '../actions/money.js'
import { ledgerCentsToPlanDollars, planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from '../actions/structuralId.js'
import { planSchema, type Account, type Plan } from '../model/plan.js'
import { isAggregatedIra, isTreatAsOwnEffective } from '../strategies/accountEligibility.js'
import { ownedIraFundedAnnuityContracts } from './iraAnnuityContractValue.js'
import type { SimulatorAnnualRetirementRuntimeOccurrence } from '../projection/annualRetirementRuntimeJournal.js'
import type {
  SimulatorRetirementRuntimeAggregateRothDestinationCredit,
  SimulatorRetirementRuntimeApplication,
  SimulatorRetirementRuntimeNamedRothDestinationCredit,
  YearResult,
} from '../projection/types.js'

const MAX_RAW_RECONCILIATION_TOLERANCE_DOLLARS = 0.000001

export type OwnedNonRothIraRuntimeSourceSeriesIssueKind =
  | 'planInvalid'
  | 'yearSeriesInvalid'
  | 'sourceMissing'
  | 'sourceContractInvalid'
  | 'sourceOrderInvalid'
  | 'sourceIdentityInvalid'
  | 'sourceAmountInvalid'
  | 'sourceCoverageInvalid'
  | 'applicationOrderInvalid'
  | 'balanceChainInvalid'
  | 'postGrowthPoolInvalid'
  | 'qcdStageRequired'
  /**
   * The charitable arm's exact-cent invariants, held apart from
   * `qcdStageRequired` on purpose.
   *
   * `qcdStageRequired` says the year's gift is in a shape the replay cannot
   * attribute -- a stage has not run, or an attribution names nothing this
   * replay carries. This kind says something narrower and much worse: the
   * overlay and the replay both exist, both are well formed, and they DISAGREE
   * about a figure. A partition that does not sum to its overlay, a remainder
   * outside its own gross, a carve the owner's own required distributions
   * cannot absorb -- none of those is a capability gap the engine has yet to
   * close. Each is the ledger and the replay contradicting each other, which is
   * exactly the evidence a permanent disqualification exists for.
   *
   * Splitting them is what keeps the settlement's year-scoped allow-list
   * honest: `qcdStageRequired` belongs in it and these do not.
   */
  | 'qcdReconciliationInvalid'
  | 'annuityStageRequired'
  | 'exactActionStageRequired'
  | 'aggregateRothCreditInvalid'
  | 'namedRothConversionInvalid'
  | 'namedQcdInvalid'
  | 'sourceSeriesConstructionInvalid'

export interface OwnedNonRothIraRuntimeSourceSeriesIssue {
  readonly kind: OwnedNonRothIraRuntimeSourceSeriesIssueKind
  readonly detail: string
  readonly taxYear?: number
  readonly ownerPersonId?: string
  readonly sourceAccountId?: string
  readonly producerOccurrenceKey?: string
}

export interface NormalizedOwnedNonRothIraApplication {
  readonly producerOccurrenceKey: string
  readonly occurrenceKind:
    | 'ownedIraRmd'
    | 'annuityContractDistribution'
    | 'automaticSeppDistribution'
    | 'legacyNeedBasedWithdrawal'
    | 'legacyRothConversion'
    | 'legacyQcd'
    | 'namedQcd'
    | 'namedRothConversion'
    | 'ownedIraContribution'
    | 'rolloverInflow'
  readonly applicationKind: 'debit' | 'credit'
  readonly simulatorPhase:
    | 'annuityContractDistribution'
    | 'pensionLumpSumRollover'
    | 'employeeContribution'
    | 'ownerRmdDistribution'
    | 'automaticSeppDistribution'
    | 'legacyQcdDistribution'
    | 'namedQcdDistribution'
    | 'namedRothConversionDebit'
    | 'legacyRothConversion'
    | 'legacyNeedBasedWithdrawal'
  readonly mutationOrdinal: number
  readonly ownerPersonId: PersonId
  /**
   * The account the dollars left, which for an `annuityContractDistribution` is
   * the CONTRACT rather than any IRA in the balance ledger. Section
   * 7701(a)(37)(B) makes a section 408(b) individual retirement annuity an
   * individual retirement plan in its own right, so the aggregate it is inside
   * has a member the projection carries no balance for; its year-end value
   * travels on `annuityContractValueAmount` below instead.
   */
  readonly sourceAccountId: AccountId
  readonly amount: UsdCents
  readonly sourceBalanceBefore: UsdCents
  readonly sourceBalanceAfter: UsdCents
  /**
   * Signed cent residual left by independently rounding the raw before,
   * gross-amount, and after values. The normalized identity is
   * `before +/- amount + residual === after`.
   */
  readonly sourceBalanceRoundingResidualCents: -2 | -1 | 0 | 1 | 2
  readonly form8606Line: 'line7' | 'line8' | null
  /**
   * The gross this application presents on the Form 8606 line it belongs to,
   * which is `amount` for every application except a required distribution a
   * qualified charitable distribution was routed out of.
   *
   * The two figures answer different questions and must not be conflated. The
   * balance chain is about DOLLARS THAT LEFT THE ACCOUNT, and every routed cent
   * left it under this debit, so `amount` carries the whole requirement. Line 7
   * is about DOLLARS THE RETURN REPORTS, and the Form 8606 line-7 instructions
   * keep a qualified charitable distribution off it, so the routed and qualified
   * part is absent here. `form8606Line` is null where the carve consumed the
   * whole distribution, so an entry that reports nothing is not an entry at all.
   */
  readonly form8606LineGrossAmount: UsdCents
}

export interface NormalizedOwnedNonRothIraYearEndBalance {
  readonly sourceAccountId: AccountId
  readonly balancePlanDollars: number
  readonly balanceAmount: UsdCents
}

/**
 * One annuity contract this owner's IRA bought, at the same December 31 the
 * pool balances beside it are read at.
 *
 * It is a line-6 member with no ledger balance, so it is carried separately
 * rather than smuggled into `yearEndBalances`: the pool members there are
 * validated as owned traditional IRA accounts, and a contract is not one. The
 * value is the engine's premium-less-payments convention and not a fair market
 * value, which is why it is registered on its own.
 */
export interface NormalizedOwnedNonRothIraAnnuityContractValue {
  readonly annuityAccountId: AccountId
  readonly fundingAccountId: AccountId
  readonly contractValuePlanDollars: number
  readonly contractValueAmount: UsdCents
}

export interface NormalizedOwnedNonRothIraOwnerYearSource {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly applications: readonly Readonly<NormalizedOwnedNonRothIraApplication>[]
  readonly yearEndBalances: readonly Readonly<NormalizedOwnedNonRothIraYearEndBalance>[]
  /** Ascending by contract id; empty for an owner who bought no contract. */
  readonly annuityContractValues:
    readonly Readonly<NormalizedOwnedNonRothIraAnnuityContractValue>[]
  /**
   * Their sum, which is what Form 8606 line 6 adds to the pool balance. Zero
   * where there is no contract, so the line-6 build needs no special case.
   */
  readonly annuityContractValueAmount: UsdCents
  readonly sourceChainEvidenceId: string
}

/**
 * One owner's share of the aggregate strategy's conversion, reconciled to that
 * owner's own Roth destination.
 *
 * There is one of these per converting owner, not one per year. IRC
 * 408(d)(3)(A)(i) admits a rollover only where the distributee and the
 * recipient account belong to the same individual, so a household whose
 * traditional and Roth balances sit with different people has as many
 * destinations as it has converting owners. `destinationAttribution` records
 * that the aggregate strategy still does not allocate a *particular* source
 * dollar to the destination — only the owner slice as a whole is bound.
 */
export interface NormalizedAggregateRothDestinationCredit {
  readonly status: 'aggregateDestinationCreditSourceReconciled'
  readonly destinationAttribution: 'aggregateOnlyNotSourceAllocated'
  readonly actionability: 'notEstablished'
  readonly destinationRothAccountId: AccountId
  readonly destinationOwnerPersonId: PersonId
  readonly destinationCreditedAmount: UsdCents
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly PersonId[]
  readonly evidenceId: string
}

/**
 * One named request's own destination credit, reconciled to that request's
 * committed movement.
 *
 * `destinationAttribution` differs from the aggregate credit's on purpose. The
 * aggregate one can say only that some household Roth received the year's
 * conversions; this one names the action that chose the destination, so the
 * credit is attributed to a request rather than to whichever Roth happens to
 * come first in `plan.accounts`.
 */
export interface NormalizedNamedRothDestinationCredit {
  readonly status: 'namedDestinationCreditActionReconciled'
  readonly destinationAttribution: 'namedRequestDestination'
  readonly actionability: 'notEstablished'
  readonly actionId: string
  readonly destinationRothAccountId: AccountId
  readonly destinationOwnerPersonId: PersonId
  readonly destinationCreditedAmount: UsdCents
  readonly producerOccurrenceKeys: readonly string[]
  readonly sourceOwnerPersonIds: readonly PersonId[]
  readonly evidenceId: string
}

export interface NormalizedOwnedNonRothIraRuntimeSourceYear {
  readonly taxYear: number
  readonly ownerSources: readonly Readonly<NormalizedOwnedNonRothIraOwnerYearSource>[]
  readonly aggregateRothDestinationCredits:
    readonly Readonly<NormalizedAggregateRothDestinationCredit>[]
  readonly namedRothDestinationCredits:
    readonly Readonly<NormalizedNamedRothDestinationCredit>[]
  readonly evidenceId: string
}

interface SourceSeriesResultBase {
  readonly evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness'
  readonly movement: 'notCommitted'
  readonly actionability: 'notEstablished'
}

export interface OwnedNonRothIraRuntimeSourceSeriesComplete
  extends SourceSeriesResultBase {
  readonly status: 'ownedNonRothIraRuntimeSourceSeriesComplete'
  readonly projectionStartTaxYear: number
  readonly endTaxYear: number
  readonly years: readonly Readonly<NormalizedOwnedNonRothIraRuntimeSourceYear>[]
  readonly evidenceId: string
  readonly issues: readonly []
}

export interface OwnedNonRothIraRuntimeSourceSeriesBlocked
  extends SourceSeriesResultBase {
  readonly status: 'ownedNonRothIraRuntimeSourceSeriesBlocked'
  readonly projectionStartTaxYear: number | null
  readonly endTaxYear: number | null
  readonly years: null
  readonly evidenceId: null
  readonly issues: readonly [
    Readonly<OwnedNonRothIraRuntimeSourceSeriesIssue>,
    ...Readonly<OwnedNonRothIraRuntimeSourceSeriesIssue>[],
  ]
}

export type OwnedNonRothIraRuntimeSourceSeriesResult =
  | OwnedNonRothIraRuntimeSourceSeriesComplete
  | OwnedNonRothIraRuntimeSourceSeriesBlocked

interface ApplicationShape {
  applicationKind: 'debit' | 'credit'
  simulatorPhase: Exclude<
    NormalizedOwnedNonRothIraApplication['simulatorPhase'],
    never
  > | 'annuityPurchaseFunding'
  form8606Line: 'line7' | 'line8' | null
}

/**
 * The two phases whose source account is an annuity contract rather than an IRA
 * in the balance ledger, and which the application chain therefore routes to
 * the contract-value channel instead of to `openingBalances`.
 *
 * The premium's own credit is not here: it carries no `producerOccurrenceKey`
 * at all and is handled beside the Roth destination credits, for the same
 * reason those are -- one physical movement has one occurrence, and the debit
 * already claimed it.
 */
const ANNUITY_CONTRACT_CHAIN_PHASES: ReadonlySet<string> = new Set([
  'annuityContractDistribution',
])

class SourceSeriesFailure extends Error {
  readonly issue: OwnedNonRothIraRuntimeSourceSeriesIssue

  constructor(issue: OwnedNonRothIraRuntimeSourceSeriesIssue) {
    super(issue.detail)
    this.issue = issue
  }
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function fail(
  kind: OwnedNonRothIraRuntimeSourceSeriesIssueKind,
  detail: string,
  context: Omit<OwnedNonRothIraRuntimeSourceSeriesIssue, 'kind' | 'detail'> = {},
): never {
  throw new SourceSeriesFailure({ kind, detail, ...context })
}

function safeDetail(error: unknown): string {
  try {
    return error instanceof Error ? error.message : String(error)
  } catch {
    return 'uninspectable error'
  }
}

function cents(
  value: number,
  label: string,
  context: Omit<OwnedNonRothIraRuntimeSourceSeriesIssue, 'kind' | 'detail'>,
): UsdCents {
  try {
    return planDollarsToLedgerCents(value)
  } catch (error) {
    return fail('sourceAmountInvalid', `${label} cannot cross the exact-cent boundary: ${safeDetail(error)}`, context)
  }
}

function summedPlanDollars(
  values: readonly number[],
  label: string,
  context: Omit<OwnedNonRothIraRuntimeSourceSeriesIssue, 'kind' | 'detail'>,
): number {
  const total = values.reduce((sum, value) => sum + value, 0)
  if (!Number.isFinite(total) || total < 0 || Object.is(total, -0)) {
    fail('sourceAmountInvalid', `${label} must be a finite nonnegative Plan-dollar total`, context)
  }
  return total
}

function rawTotalsReconcile(
  left: number,
  right: number,
  operationCount: number,
): boolean {
  const scale = Math.max(1, Math.abs(left), Math.abs(right))
  const floatingPointTolerance = Number.EPSILON * scale *
    Math.max(8, operationCount * 4)
  // At large magnitudes, adjacent IEEE-754 values can be farther apart than
  // the ordinary micro-dollar cap. Do not demand precision the producer
  // cannot represent, but retain the tighter operation-error bound.
  const representableValueTolerance = Number.EPSILON * scale
  return Math.abs(left - right) <= Math.min(
    floatingPointTolerance,
    Math.max(
      MAX_RAW_RECONCILIATION_TOLERANCE_DOLLARS,
      representableValueTolerance,
    ),
  )
}

function occurrenceTotalInPlanOrder(
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  kinds: readonly SimulatorAnnualRetirementRuntimeOccurrence['kind'][],
  label: string,
  taxYear: number,
  accountOrder: ReadonlyMap<string, number>,
): { total: number; count: number } {
  const selectedKinds = new Set(kinds)
  const selectedOccurrences = occurrences
    .filter((occurrence) => selectedKinds.has(occurrence.kind))
    .sort((left, right) =>
      (accountOrder.get(left.sourceAccountId ?? '') ?? Number.MAX_SAFE_INTEGER) -
      (accountOrder.get(right.sourceAccountId ?? '') ?? Number.MAX_SAFE_INTEGER))
  const occurrenceTotal = summedPlanDollars(
    selectedOccurrences.map((occurrence) => occurrence.grossAmountPlanDollars),
    `${label} occurrence total`,
    { taxYear },
  )
  return { total: occurrenceTotal, count: selectedOccurrences.length }
}

function reconcilePublishedTotal(
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  kinds: readonly SimulatorAnnualRetirementRuntimeOccurrence['kind'][],
  publishedPlanDollars: number,
  label: string,
  taxYear: number,
  accountOrder: ReadonlyMap<string, number>,
): void {
  const occurrenceTotal = occurrenceTotalInPlanOrder(
    occurrences, kinds, label, taxYear, accountOrder,
  )
  if (!Number.isFinite(publishedPlanDollars) || publishedPlanDollars < 0 ||
      Object.is(publishedPlanDollars, -0)) {
    fail('sourceAmountInvalid', `Published ${label} total must be finite, nonnegative, and not negative zero`, {
      taxYear,
    })
  }
  if (!rawTotalsReconcile(
    occurrenceTotal.total,
    publishedPlanDollars,
    occurrenceTotal.count,
  )) {
    fail('sourceCoverageInvalid', `${label} occurrences must exact-rejoin the published annual total`, {
      taxYear,
    })
  }
}

function requireNoExactActionOwnedIraMovement(
  plan: Readonly<Plan>,
  yearResult: Readonly<YearResult>,
  accountById: ReadonlyMap<string, Account>,
  taxYear: number,
): void {
  const execution = yearResult.retirementActionExecution
  const executionEvidence = execution?.evidence ?? []
  const executionBalances = execution?.balances ?? []
  // Neither a named conversion nor a named QCD is on this list, and now for the
  // same reason: both publish their own occurrence with its own application,
  // and both are bound to committed executor evidence in exact cents --
  // conversions by `requireNamedRothConversionCoverage` and gifts by
  // `requireNamedQcdCoverage` below. A declared gift that never settled
  // publishes no occurrence and leaves the year exactly as a year without the
  // request, so declaring one does not block.
  //
  // A declared ordinary withdrawal is now held to the same standard, and it has
  // to be, because the premise the old guard rested on is not true of an owned
  // IRA. The ordinary executor's source scope is cash, equity compensation, and
  // taxable; an owned-IRA allocation is refused there with
  // `withdrawal-source-type-unsupported`, so the request moves no dollars,
  // leaves the balances untouched, and contributes nothing to line 7. Refusing
  // the year for it disqualified a year in which nothing happened. That boundary
  // is not being widened here -- IRA withdrawals remain non-executable, and the
  // refusal is still published on the action's own evidence.
  //
  // What replaces the declaration test is a binding to that evidence, and it
  // fails closed in both directions a declaration can fail to prove itself
  // harmless. A declared owned-IRA allocation with no evidence record of its own
  // proves nothing about what it moved; neither does one whose source account
  // the executor never took an opening balance for, since the year's per-account
  // before/after chain then has no entry to reconcile against. Both refuse. Only
  // a declaration the executor evidenced at exactly zero executed cents, over an
  // account it snapshotted, passes.
  for (const request of plan.strategies.retirementActions) {
    if (request.year !== taxYear || request.kind !== 'ordinaryWithdrawal') {
      continue
    }
    for (const allocation of request.allocations) {
      const accountId = String(allocation.sourceAccountId)
      const account = accountById.get(accountId)
      if (account === undefined || !isAggregatedIra(account)) continue
      const context = { taxYear, sourceAccountId: accountId }
      const evidence = executionEvidence.find((entry) =>
        String(entry.actionId) === String(request.actionId))
      const evidencedAllocation = evidence?.allocations.find((entry) =>
        String(entry.allocationId) === String(allocation.allocationId))
      if (evidencedAllocation === undefined) {
        fail('exactActionStageRequired', 'A Plan-declared exact action from an owned IRA requires committed executor evidence for its own allocation before source replay', context)
      }
      if (evidencedAllocation.executedAmount !== 0) {
        fail('exactActionStageRequired', 'Exact-action owned-IRA movement requires an identity and tax-characterization stage before source replay', context)
      }
      if (!executionBalances.some((snapshot) =>
        String(snapshot.accountId) === accountId)) {
        fail('exactActionStageRequired', 'A Plan-declared exact action from an owned IRA requires the executor’s own opening and closing balance for its source before source replay', context)
      }
    }
  }
  if (execution === undefined) return
  for (const evidence of executionEvidence) {
    for (const allocation of evidence.allocations) {
      const accountId = String(allocation.sourceAccountId)
      const account = accountById.get(accountId)
      if (!account || !isAggregatedIra(account)) continue
      const executedAmount = allocation.executedAmount
      if (executedAmount !== 0) {
        fail('exactActionStageRequired', 'Exact-action owned-IRA movement requires an identity and tax-characterization stage before source replay', {
          taxYear, sourceAccountId: accountId,
        })
      }
    }
  }

  for (const snapshot of executionBalances) {
    const accountId = String(snapshot.accountId)
    const account = accountById.get(accountId)
    if (!account || !isAggregatedIra(account)) continue
    const openingBalance = snapshot.openingBalance
    const closingBalance = snapshot.closingBalance
    if (closingBalance !== openingBalance) {
      fail('exactActionStageRequired', 'Exact-action owned-IRA movement requires an identity and tax-characterization stage before source replay', {
        taxYear, sourceAccountId: accountId,
      })
    }
  }
}

interface NamedRothConversionCoverage {
  /** Exact committed cents per action, in ascending action-ID order. */
  readonly executedCentsByActionId: ReadonlyMap<string, UsdCents>
  readonly totalExecutedAmount: UsdCents
}

/**
 * Bind every `namedRothConversion` occurrence to committed executor evidence,
 * and every committed owned-IRA conversion allocation back to an occurrence.
 *
 * Both directions are load-bearing. Without the first, a forged occurrence
 * could explain a balance change no request authorised; without the second,
 * committed dollars could leave an owned IRA with the balance chain re-joining
 * only because the occurrence that should have accounted for them is absent.
 * Amounts are compared in exact cents, never in Plan dollars.
 */
function requireNamedRothConversionCoverage(
  yearResult: Readonly<YearResult>,
  accountById: ReadonlyMap<string, Account>,
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  taxYear: number,
): NamedRothConversionCoverage {
  const context = { taxYear }
  const named = occurrences.filter((entry) => entry.kind === 'namedRothConversion')
  const execution = yearResult.rothConversionActionExecution
  if (execution === undefined || !execution.committed) {
    if (named.length > 0) {
      fail('namedRothConversionInvalid', 'A named conversion occurrence requires committed conversion-executor evidence', context)
    }
    return { executedCentsByActionId: new Map(), totalExecutedAmount: 0 as UsdCents }
  }

  const expected = new Map<string, UsdCents>()
  const perAction = new Map<string, bigint>()
  for (const evidence of execution.evidence) {
    for (const allocation of evidence.allocations) {
      const account = accountById.get(String(allocation.sourceAccountId))
      const executedAmount = allocation.executedAmount
      if (!account || !isAggregatedIra(account)) {
        // Slice 3 commits only from owned, non-inherited IRAs. Anything else
        // that moved is outside what this replay reconstructs.
        if (executedAmount !== 0) {
          fail('exactActionStageRequired', 'Committed conversion movement outside the owned-IRA pool requires its own characterization stage', {
            taxYear, sourceAccountId: String(allocation.sourceAccountId),
          })
        }
        continue
      }
      if (executedAmount === 0) continue
      const key = JSON.stringify([
        'namedRothConversion',
        String(allocation.sourceAccountId),
        String(evidence.destinationRothAccountId),
        String(evidence.actionId),
        String(allocation.allocationId),
      ])
      if (expected.has(key)) {
        fail('namedRothConversionInvalid', 'Committed conversion allocations must derive unique named occurrence keys', context)
      }
      expected.set(key, executedAmount as UsdCents)
      perAction.set(
        String(evidence.actionId),
        (perAction.get(String(evidence.actionId)) ?? 0n) + BigInt(executedAmount),
      )
    }
  }

  const seen = new Set<string>()
  for (const occurrence of named) {
    const expectedAmount = expected.get(occurrence.producerOccurrenceKey)
    const amount = cents(occurrence.grossAmountPlanDollars, 'Named conversion occurrence amount', {
      taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
    })
    if (expectedAmount === undefined || expectedAmount !== amount ||
        seen.has(occurrence.producerOccurrenceKey)) {
      fail('namedRothConversionInvalid', 'Each named conversion occurrence must rejoin one committed allocation in exact cents', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    seen.add(occurrence.producerOccurrenceKey)
  }
  if (seen.size !== expected.size) {
    fail('namedRothConversionInvalid', 'Every committed owned-IRA conversion allocation requires its named occurrence', context)
  }

  let total = 0n
  const executedCentsByActionId = new Map<string, UsdCents>()
  for (const actionId of [...perAction.keys()].sort(compareUtf16CodeUnits)) {
    const actionTotal = perAction.get(actionId)!
    if (actionTotal <= 0n || actionTotal > BigInt(Number.MAX_SAFE_INTEGER)) {
      fail('namedRothConversionInvalid', 'Committed named conversion totals must stay inside the exact-cent ledger', context)
    }
    executedCentsByActionId.set(actionId, Number(actionTotal) as UsdCents)
    total += actionTotal
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail('namedRothConversionInvalid', 'Committed named conversion totals must stay inside the exact-cent ledger', context)
  }
  return {
    executedCentsByActionId,
    totalExecutedAmount: Number(total) as UsdCents,
  }
}

interface NamedQcdCoverage {
  readonly totalExecutedAmount: UsdCents
}

/**
 * Bind every `namedQcd` occurrence to committed QCD-executor evidence, and
 * every committed gift back to an occurrence.
 *
 * This is the same two-way binding the conversion arm performs above, and it
 * is load-bearing in both directions for the same two reasons. Without the
 * first, a forged occurrence could explain an owned-IRA debit no request
 * authorised and the year's balance chain would close on the forgery. Without
 * the second, committed dollars could leave an owned IRA with the chain
 * re-joining only because the occurrence that should have accounted for them
 * is missing. Amounts are compared in exact cents, never in Plan dollars.
 *
 * A gift that settled at zero -- its named source had no principal left --
 * publishes no occurrence, because nothing moved. So the committed side counts
 * only positive executed cents, exactly as the conversion side skips a zero
 * allocation.
 */
function requireNamedQcdCoverage(
  yearResult: Readonly<YearResult>,
  accountById: ReadonlyMap<string, Account>,
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  taxYear: number,
): NamedQcdCoverage {
  const context = { taxYear }
  const named = occurrences.filter((entry) => entry.kind === 'namedQcd')
  const execution = yearResult.qcdActionExecution
  if (execution === undefined || !execution.committed) {
    const forged = named[0]
    if (forged !== undefined) {
      fail('namedQcdInvalid', 'A named QCD occurrence requires committed charitable-distribution evidence', {
        taxYear, producerOccurrenceKey: forged.producerOccurrenceKey,
      })
    }
    return { totalExecutedAmount: 0 as UsdCents }
  }

  const expected = new Map<string, UsdCents>()
  let total = 0n
  for (const evidence of execution.evidence) {
    const account = accountById.get(String(evidence.sourceAccountId))
    const executedAmount = evidence.executedAmount
    if (!account || !isAggregatedIra(account)) {
      // IRC 408(d)(8)(B) reaches only an individual retirement plan, so a gift
      // that moved from anything else is not a gift this replay can explain.
      if (executedAmount !== 0) {
        fail('exactActionStageRequired', 'Committed charitable movement outside the owned-IRA pool requires its own characterization stage', {
          taxYear, sourceAccountId: String(evidence.sourceAccountId),
        })
      }
      continue
    }
    if (executedAmount === 0) continue
    const key = JSON.stringify([
      'namedQcd',
      String(evidence.sourceAccountId),
      String(evidence.actionId),
      String(evidence.allocationId),
    ])
    if (expected.has(key)) {
      fail('namedQcdInvalid', 'Committed gifts must derive unique named occurrence keys', context)
    }
    expected.set(key, executedAmount)
    total += BigInt(executedAmount)
  }

  const seen = new Set<string>()
  for (const occurrence of named) {
    const expectedAmount = expected.get(occurrence.producerOccurrenceKey)
    const amount = cents(occurrence.grossAmountPlanDollars, 'Named QCD occurrence amount', {
      taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
    })
    if (expectedAmount === undefined || expectedAmount !== amount ||
        seen.has(occurrence.producerOccurrenceKey)) {
      fail('namedQcdInvalid', 'Each named QCD occurrence must rejoin one committed gift in exact cents', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    seen.add(occurrence.producerOccurrenceKey)
  }
  if (seen.size !== expected.size) {
    fail('namedQcdInvalid', 'Every committed owned-IRA gift requires its named occurrence', context)
  }
  if (total > BigInt(Number.MAX_SAFE_INTEGER)) {
    fail('namedQcdInvalid', 'Committed named QCD totals must stay inside the exact-cent ledger', context)
  }
  return { totalExecutedAmount: Number(total) as UsdCents }
}

function compareNullableString(left: string | null, right: string | null): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return compareUtf16CodeUnits(left, right)
}

function compareNullableNumber(left: number | null, right: number | null): number {
  if (left === right) return 0
  if (left === null) return -1
  if (right === null) return 1
  return left - right
}

function compareOccurrences(
  left: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  right: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
): number {
  return compareUtf16CodeUnits(left.producerOccurrenceKey, right.producerOccurrenceKey) ||
    compareUtf16CodeUnits(left.kind, right.kind) ||
    left.grossAmountPlanDollars - right.grossAmountPlanDollars ||
    compareNullableString(left.ownerPersonId, right.ownerPersonId) ||
    compareNullableString(left.sourceAccountId, right.sourceAccountId) ||
    compareNullableString(left.executionDate, right.executionDate) ||
    compareNullableNumber(left.executionSequence, right.executionSequence) ||
    compareNullableString(left.movementAuthorityId, right.movementAuthorityId)
}

function ownedPools(
  plan: Plan,
  taxYear?: number,
): Map<PersonId, Extract<Account, { type: 'traditional' }>[]> {
  const pools = new Map<PersonId, Map<string, Extract<Account, { type: 'traditional' }>>>()
  for (const account of plan.accounts) {
    // The S2-effective arm only ever admits traditional IRAs: the flip makes
    // an inherited traditional IRA the spouse's own aggregated IRA for the
    // year, and no other account type carries an inherited block into this
    // pool. Narrow before the structural helper so the full union stays out.
    const s2Effective =
      taxYear !== undefined &&
      account.type === 'traditional' &&
      account.kind === 'ira' &&
      isTreatAsOwnEffective(account, taxYear)
    if (!isAggregatedIra(account) && !s2Effective) continue
    if (account.type !== 'traditional') continue
    const owner = account.ownerPersonId as PersonId
    const accounts = pools.get(owner) ?? new Map()
    // Duplicate physical rows form one logical source-series account. Facts
    // come from the selected last row; its opening/closing value is aggregate.
    accounts.set(account.id, account)
    pools.set(owner, accounts)
  }
  return new Map([...pools]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([owner, accountsById]) => [owner, [...accountsById.values()].sort((left, right) =>
      compareUtf16CodeUnits(left.id, right.id))]))
}

function aggregateOwnedOpeningBalance(
  plan: Plan,
  accountId: string,
  taxYear?: number,
): number {
  return plan.accounts.reduce((sum, account) => {
    const s2Effective =
      taxYear !== undefined &&
      account.type === 'traditional' &&
      account.kind === 'ira' &&
      isTreatAsOwnEffective(account, taxYear)
    return account.type === 'traditional' && account.id === accountId &&
      (isAggregatedIra(account) || s2Effective)
      ? sum + account.balance
      : sum
  }, 0)
}

function physicalBalanceKey(accountId: string, balanceIndex: number): string {
  return JSON.stringify([accountId, balanceIndex])
}

function balanceBearingAccounts(plan: Plan): Array<{ account: Account; balanceIndex: number }> {
  return plan.accounts
    .filter((account) =>
      account.type === 'cash' || account.type === 'taxable' ||
      account.type === 'equityComp' || account.type === 'traditional' ||
      account.type === 'roth' || account.type === 'hsa')
    .map((account, balanceIndex) => ({ account, balanceIndex }))
}

function ownedPhysicalRows(
  plan: Plan,
  taxYear?: number,
): Array<{ account: Extract<Account, { type: 'traditional' }>; balanceIndex: number }> {
  return balanceBearingAccounts(plan).flatMap(({ account, balanceIndex }) => {
    const s2Effective = taxYear !== undefined && account.type === 'traditional' &&
      account.kind === 'ira' && isTreatAsOwnEffective(account, taxYear)
    return account.type === 'traditional' && (isAggregatedIra(account) || s2Effective)
      ? [{ account, balanceIndex }]
      : []
  })
}

function applyPhysicalGroupClosing(
  physicalRawBalances: Map<string, number>,
  rows: readonly { account: Extract<Account, { type: 'traditional' }>; balanceIndex: number }[],
  accountId: string,
  target: number,
): void {
  const members = rows.filter((row) => row.account.id === accountId)
  if (members.length === 0) return
  const opening = members.reduce((sum, row) =>
    sum + (physicalRawBalances.get(physicalBalanceKey(accountId, row.balanceIndex)) ?? 0), 0)
  let assigned = 0
  let residualIndex = members.length - 1
  for (let index = members.length - 1; index >= 0; index -= 1) {
    if ((physicalRawBalances.get(physicalBalanceKey(accountId, members[index]!.balanceIndex)) ?? 0) > 0) {
      residualIndex = index
      break
    }
  }
  for (let index = 0; index < members.length; index += 1) {
    if (index === residualIndex) continue
    const row = members[index]!
    const key = physicalBalanceKey(accountId, row.balanceIndex)
    const value = opening === 0 ? 0 : target * ((physicalRawBalances.get(key) ?? 0) / opening)
    physicalRawBalances.set(key, value)
    assigned += value
  }
  physicalRawBalances.set(
    physicalBalanceKey(accountId, members[residualIndex]!.balanceIndex),
    target - assigned,
  )
}

function applicationShape(
  kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
): ApplicationShape | null {
  switch (kind) {
    case 'annuityFundingTransfer':
      // A NULL LINE IS THE ANSWER HERE, not a gap. IRC 408(d)(1) taxes an
      // amount "paid or distributed out of an individual retirement plan", and
      // a premium paid at the owner's direction is neither: the contract is
      // either a section 408(b) individual retirement annuity, which
      // Treas. Reg. 1.408-8(d)(4) reaches as a trustee-to-trustee transfer and
      // the Form 1099-R instructions direct the issuer not to report, or an
      // annuity contract the section 408(a) trust holds as an account asset,
      // which never left the account. Publication 590-B states the conclusion
      // outright -- "You aren't taxed when you receive the annuity contract".
      // So there is no line-7 entry and nothing enters the annual denominator
      // from this movement. Registered as
      // `irc-408-d-1-ira-annuity-premium-is-not-a-distribution`.
      return { applicationKind: 'debit', simulatorPhase: 'annuityPurchaseFunding', form8606Line: null }
    case 'annuityContractDistribution':
      // And this one IS a distribution, which is the whole of the pair. The
      // same Publication 590-B passage closes with "You are taxed when you
      // start receiving payments under that annuity contract", and IRC
      // 408(d)(2)(B) treats all distributions during a taxable year as one
      // distribution -- so the payment joins the year's line-7 gross and takes
      // the same share of basis every other distribution from the aggregate
      // takes. Registered as
      // `irc-408-d-2-B-annuity-payment-outside-the-annual-basis-fraction`.
      return { applicationKind: 'debit', simulatorPhase: 'annuityContractDistribution', form8606Line: 'line7' }
    case 'rolloverInflow':
      return { applicationKind: 'credit', simulatorPhase: 'pensionLumpSumRollover', form8606Line: null }
    case 'ownedIraContribution':
      return { applicationKind: 'credit', simulatorPhase: 'employeeContribution', form8606Line: null }
    case 'ownedIraRmd':
      return { applicationKind: 'debit', simulatorPhase: 'ownerRmdDistribution', form8606Line: 'line7' }
    case 'automaticSeppDistribution':
      return { applicationKind: 'debit', simulatorPhase: 'automaticSeppDistribution', form8606Line: 'line7' }
    case 'legacyQcd':
      // IRC 408(d)(8)(D) deems a charitable distribution to consist of
      // otherwise-includible dollars "notwithstanding section 72", so a QCD is
      // not apportioned by the Form 8606 pro-rata rule: it is drawn from the
      // pre-tax portion first and returns no basis, and the Form 8606 line-7
      // instructions exclude it by name. A null line is therefore the
      // substantive answer, not a gap -- the gross is absent from both the
      // line-7 numerator and the annual denominator, which is what leaves
      // proportionally more basis behind for the year's other distributions.
      // Registered as `irc-408-d-8-D-qcd-taxable-first`.
      return { applicationKind: 'debit', simulatorPhase: 'legacyQcdDistribution', form8606Line: null }
    case 'namedQcd':
      // The same 408(d)(8)(D) reading as the aggregate gift above: the gross
      // stays off both Form 8606 lines, out of the annual denominator, and
      // returns no basis. What the named arm may not inherit is the aggregate
      // arm's freedom to assume it. A null line would be wrong for a gift that
      // ran past the donor's aggregate otherwise-includible balance, because
      // the excess is a charitable remainder that is not a QCD, is basis, and
      // does belong on a line.
      //
      // No such gift can reach this shape. The QCD executor commits only where
      // the post-pass reports `notApplicableZeroEligibleAmount`, which is
      // `taxableQcdAmount + nonQcdCharitableRemainder === 0` -- so a committed
      // gift is inside the pool by construction, and the coverage binding above
      // admits no occurrence without a committed gift behind it. A null line is
      // therefore unconditionally right for every occurrence that can exist.
      // Registered as `irc-408-d-8-D-qcd-taxable-first`.
      return { applicationKind: 'debit', simulatorPhase: 'namedQcdDistribution', form8606Line: null }
    case 'namedRothConversion':
      // A conversion is a conversion. IRC 408A(d)(3) and the Form 8606
      // line-8 instructions do not ask who chose the amount, so a named
      // request's gross enters the same annual line-8 numerator and the same
      // denominator as an aggregate one. What differs is identity, not
      // character, and identity is carried by the producer key.
      return { applicationKind: 'debit', simulatorPhase: 'namedRothConversionDebit', form8606Line: 'line8' }
    case 'legacyRothConversion':
      return { applicationKind: 'debit', simulatorPhase: 'legacyRothConversion', form8606Line: 'line8' }
    case 'legacyNeedBasedWithdrawal':
      return { applicationKind: 'debit', simulatorPhase: 'legacyNeedBasedWithdrawal', form8606Line: 'line7' }
    default:
      return null
  }
}

function phaseRank(application: Readonly<SimulatorRetirementRuntimeApplication>): number {
  switch (application.simulatorPhase) {
    case 'annuityPurchaseFunding': return 0
    // The premium's credit sits immediately beside its debit, because they are
    // two halves of one movement and nothing may run between them: a reader of
    // the chain who stopped in the gap would see value leave an aggregate and
    // not arrive.
    case 'annuityPurchaseContractCredit': return 1
    case 'pensionLumpSumRollover': return 2
    // The projection's income block, which is where a contract's payment is
    // credited: after the year's purchases and rollovers and before its
    // contributions. Not a civil chronology -- a monthly annuity does not pay
    // once, in January, before an employee defers anything -- but the order the
    // simulator's own mutations happen in, which is what this rank records.
    case 'annuityContractDistribution': return 3
    case 'employeeContribution': return 4
    case 'ownerRmdDistribution': return 5
    case 'automaticSeppDistribution': return 6
    // The simulator computes the charitable gift once the forced distributions
    // are known and before any conversion or need-based withdrawal is sized.
    case 'legacyQcdDistribution': return 7
    // A named gift sits beside the aggregate one and ahead of every
    // conversion. Treas. Reg. 1.408-8(g)(1) takes every IRA distribution into
    // account against section 401(a)(9) whether or not includible -- naming a
    // qualified charitable distribution as its own example -- so the gift
    // belongs after the forced distributions it may count against and before
    // the conversions, which Treas. Reg. 1.408A-4 A-6(b) forbids from
    // absorbing an RMD at all.
    case 'namedQcdDistribution': return 8
    // The exact-cent executor runs after the year's forced distributions and
    // before the aggregate strategy sizes anything, which is what Treas. Reg.
    // 1.408A-4 A-6(b) requires of the RMD and what leaves the aggregate
    // sweep looking at balances the named request has already reduced.
    case 'namedRothConversionDebit': return 9
    case 'namedRothConversionDestinationCredit': return 10
    case 'legacyRothConversion': return 11
    case 'legacyRothConversionAggregateDestinationCredit': return 12
    case 'legacyNeedBasedWithdrawal': return 13
  }
}

function sourceCompatible(
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  account: Account,
  plan: Plan,
  taxYear: number,
): boolean {
  // Checked before the traditional-account gate, because this is the one
  // occurrence whose source is not a traditional account at all. Section
  // 7701(a)(37)(B) puts a section 408(b) individual retirement annuity inside
  // the same aggregate as the accounts, and a contract held by the section
  // 408(a) trust never left it, so the payment is an IRA distribution paid out
  // of something the Plan models as its own account type. It is admitted only
  // where the contract is one this engine can place in an owner's aggregate:
  // a qualified purchase, with a positive premium, funded from an owned
  // non-inherited IRA that names its owner. Whose aggregate that is comes from
  // the FUNDING account and not from the annuity's own owner field, which
  // answers a different question -- whose age starts the payments.
  if (occurrence.kind === 'annuityContractDistribution') {
    return ownedIraFundedAnnuityContracts(plan).some(({ contract }) =>
      contract.id === account.id)
  }
  // Inherited RMDs execute for traditional and Roth (K1/K2). Admit Roth
  // sources before the traditional-account gate so a forced Roth occurrence
  // is not rejected as the wrong account type.
  if (occurrence.kind === 'inheritedIraRmd') {
    return (
      (account.type === 'traditional' || account.type === 'roth') &&
      account.inherited !== undefined
    )
  }
  if (account.type !== 'traditional') return false
  switch (occurrence.kind) {
    // S2 post-election: the plan still carries the inherited block, but the
    // year-aware treat-as-own gate makes the account owned for RMD purposes.
    // Static `isAggregatedIra` alone would refuse every post-flip owner RMD.
    case 'ownedIraRmd':
      return (
        isAggregatedIra(account) ||
        isTreatAsOwnEffective(account, taxYear)
      )
    case 'ownedIraContribution':
    case 'ownedIraEmployerContribution': return isAggregatedIra(account)
    case 'employerPlanRmd':
    case 'employerPlanEmployeeContribution':
    case 'employerPlanEmployerMatch': return account.kind === 'employer' && account.inherited === undefined
    case 'legacyRothConversion': return account.inherited === undefined
    // A named conversion is committed here only from an owned, non-inherited
    // IRA. IRC 408(d)(3)(C) bars rolling over an inherited IRA at all, and an
    // employer plan's pre-tax balance is not in the 408(d)(2) aggregation
    // this replay reconstructs, so its basis question is not the one the
    // zero-basis evidence answers. Both stay refused rather than converted.
    case 'namedRothConversion': return isAggregatedIra(account)
    // IRC 408(d)(8)(B) reaches only a distribution from an individual
    // retirement plan, so an employer plan can never be a QCD source however
    // large its forced distribution is. Named rather than left to the default
    // arm below, which would have accepted one. The named arm answers to the
    // same confinement: it reaches this switch carrying one Plan allocation,
    // so an inherited IRA or an employer plan authored as its source is
    // refused here structurally rather than only by the prerequisite's own
    // reading of the request -- `irc-408-d-8-beneficiary-ira-source` and
    // `irc-408-d-8-roth-ira-source` are both registered out of scope, and
    // neither may be reached through the replay either.
    case 'legacyQcd':
    case 'namedQcd': return isAggregatedIra(account)
    default: return true
  }
}

function parseKey(key: string, taxYear: number): unknown[] {
  try {
    const parsed: unknown = JSON.parse(key)
    if (Array.isArray(parsed) && JSON.stringify(parsed) === key) return parsed
  } catch {
    // Fail below with a source-bound diagnostic.
  }
  return fail('sourceIdentityInvalid', 'Runtime producer key must be the canonical simulator tuple', {
    taxYear,
    producerOccurrenceKey: key,
  })
}

function occurrenceOrderAccountId(
  plan: Plan,
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  taxYear: number,
): string {
  const key = parseKey(occurrence.producerOccurrenceKey, taxYear)
  const sourceId = occurrence.sourceAccountId
  const simpleKinds = new Set([
    'ownedIraRmd', 'employerPlanRmd', 'inheritedIraRmd',
    'automaticSeppDistribution', 'legacyNeedBasedWithdrawal', 'legacyQcd',
    'ownedIraEmployerContribution',
  ])
  if (simpleKinds.has(occurrence.kind)) {
    if (key.length !== 2 || key[0] !== occurrence.kind || key[1] !== sourceId) {
      fail('sourceIdentityInvalid', 'Runtime producer key must exact-bind its kind and source account', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  const positionalContributionKinds = new Set([
    'ownedIraContribution',
    'employerPlanEmployeeContribution',
    'employerPlanEmployerMatch',
  ])
  if (positionalContributionKinds.has(occurrence.kind)) {
    const balanceIndex = key[2]
    // The producer iterates the simulator's investable `balances`, not every
    // Plan account. Reconstruct that exact row space: pensions, annuities,
    // property, debt, insurance, and HECM rows do not consume an index.
    const balanceAccounts = plan.accounts.filter((candidate) =>
      candidate.type === 'cash' || candidate.type === 'taxable' ||
      candidate.type === 'equityComp' || candidate.type === 'traditional' ||
      candidate.type === 'roth' || candidate.type === 'hsa')
    const account = typeof balanceIndex === 'number' && Number.isSafeInteger(balanceIndex)
      ? balanceAccounts[balanceIndex]
      : undefined
    if (key.length !== 3 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        account?.id !== sourceId) {
      fail('sourceIdentityInvalid', 'Contribution producer key must exact-bind its kind, source account, and Plan row', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  if (occurrence.kind === 'annuityContractDistribution') {
    // Two members. A payment names no destination -- it leaves the aggregate
    // for the owner -- and no action, because the aggregate projection sized it
    // from the Plan's own monthly amount and COLA rather than from a request.
    // The contract is both the source and the ordering account.
    const contract = plan.accounts.find((account) => account.id === sourceId)
    if (key.length !== 2 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        contract?.type !== 'annuity') {
      fail('sourceIdentityInvalid', 'Annuity payment key must bind the actual Plan contract it was paid out of', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return contract.id
  }
  if (occurrence.kind === 'annuityFundingTransfer') {
    const destinationId = key[2]
    const destination = plan.accounts.find((account) => account.id === destinationId)
    if (key.length !== 3 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        destination?.type !== 'annuity' || destination.purchase?.year !== taxYear ||
        destination.purchase.fundingAccountId !== sourceId) {
      fail('sourceIdentityInvalid', 'Annuity funding key must bind the actual Plan purchase and funding source', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return destination.id
  }
  if (occurrence.kind === 'rolloverInflow') {
    const pensionId = key[1]
    const pension = plan.accounts.find((account) => account.id === pensionId)
    if (key.length !== 3 || key[0] !== occurrence.kind || key[2] !== sourceId ||
        pension?.type !== 'pension' || pension.lumpSumOffer?.electionYear !== taxYear ||
        pension.lumpSumElection?.rolloverAccountId !== sourceId) {
      fail('sourceIdentityInvalid', 'Rollover key must bind the actual Plan pension election and target', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return pension.id
  }
  if (occurrence.kind === 'legacyRothConversion') {
    const destination = plan.accounts.find((account) => account.id === key[2])
    if (key.length !== 3 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        destination?.type !== 'roth') {
      fail('sourceIdentityInvalid', 'Conversion key must bind its source and actual Plan Roth destination', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  if (occurrence.kind === 'namedQcd') {
    // Four members, not two. A gift names no destination -- it leaves the
    // household -- so the two members the aggregate key lacks are the action
    // and the allocation alone. Those are what tell one donor's two gifts
    // from the same IRA in the same year apart, which is exactly the
    // distinction a household scalar cannot make and the reason the aggregate
    // arm's dollars still require a separate characterization stage.
    const request = plan.strategies.retirementActions.find((entry) =>
      entry.kind === 'qcd' && entry.actionId === key[2] &&
      entry.year === taxYear)
    const allocation = request?.kind === 'qcd' ? request.allocation : undefined
    if (key.length !== 4 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        allocation === undefined || allocation.allocationId !== key[3] ||
        allocation.sourceAccountId !== sourceId) {
      fail('sourceIdentityInvalid', 'Named QCD key must bind its Plan action, allocation, and stated source account', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  if (occurrence.kind === 'namedRothConversion') {
    // Five members, not three. The two extra ones are the whole point: the
    // aggregate key can name only a source and a destination, so two
    // conversions that share both are indistinguishable to it. A named key
    // binds the action and allocation that authorised the movement, and the
    // Plan must actually contain that pairing with this source and this
    // destination in this year.
    const destination = plan.accounts.find((account) => account.id === key[2])
    const request = plan.strategies.retirementActions.find((entry) =>
      entry.kind === 'rothConversion' && entry.actionId === key[3] &&
      entry.year === taxYear)
    const allocation = request?.kind === 'rothConversion'
      ? request.allocations.find((entry) => entry.allocationId === key[4])
      : undefined
    if (key.length !== 5 || key[0] !== occurrence.kind || key[1] !== sourceId ||
        destination?.type !== 'roth' || request?.kind !== 'rothConversion' ||
        request.destinationRothAccountId !== destination.id ||
        allocation === undefined || allocation.sourceAccountId !== sourceId) {
      fail('sourceIdentityInvalid', 'Named conversion key must bind its Plan action, allocation, source, and stated Roth destination', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
  }
  fail(
    'sourceCoverageInvalid',
    'This retirement occurrence requires a later characterization or transfer stage',
    { taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey },
  )
}

/**
 * Reconcile one aggregate destination credit per converting owner.
 *
 * The predecessor of this function demanded a single credit whose destination
 * was `plan.accounts.find((account) => account.type === 'roth')` — whichever
 * Roth came first in Plan array order, with no owner predicate — because that
 * is how the simulator picked it. That made the validator a faithful witness to
 * a conversion IRC 408(d)(3)(A)(i) does not permit: dollars distributed from
 * one spouse's traditional balance credited to the other spouse's Roth.
 *
 * The demand is now per owner. Each converting owner's occurrences form one
 * Plan-ordered slice, that slice's credit must name the first Plan Roth
 * belonging to *that* owner, and the slices together must consume every
 * conversion occurrence exactly once. An owner who converted with no Roth of
 * their own has no destination to name and is refused here rather than
 * silently credited to somebody else's account.
 */
function aggregateRothCredits(
  plan: Plan,
  taxYear: number,
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  applications: readonly Readonly<SimulatorRetirementRuntimeApplication>[],
  normalized: readonly NormalizedOwnedNonRothIraApplication[],
  accountOrder: ReadonlyMap<string, number>,
): Readonly<NormalizedAggregateRothDestinationCredit>[] {
  const conversions = occurrences.filter((entry) => entry.kind === 'legacyRothConversion')
  const ownedConversions = normalized.filter((entry) => entry.occurrenceKind === 'legacyRothConversion')
  const credits = applications.filter((entry): entry is Readonly<SimulatorRetirementRuntimeAggregateRothDestinationCredit> =>
    entry.applicationKind === 'aggregateRothDestinationCredit')
  const context = { taxYear }
  if (ownedConversions.length === 0) {
    if (credits.length !== 0) fail('aggregateRothCreditInvalid', 'Aggregate Roth credit requires an owned-IRA conversion debit', context)
    return []
  }
  if (credits.length === 0) {
    fail('aggregateRothCreditInvalid', 'Owned-IRA conversions require an aggregate Roth credit', context)
  }
  const bySource = new Map(conversions.map((entry) => [entry.sourceAccountId, entry]))
  const ordered = [...bySource.values()].sort((left, right) =>
    (accountOrder.get(left.sourceAccountId ?? '') ?? Number.MAX_SAFE_INTEGER) -
      (accountOrder.get(right.sourceAccountId ?? '') ?? Number.MAX_SAFE_INTEGER))
  if (ordered.length !== conversions.length || bySource.size !== conversions.length) {
    fail('aggregateRothCreditInvalid', 'Conversion occurrences must map uniquely to Plan account order', context)
  }
  if (ordered.some((entry) => entry.ownerPersonId === null)) {
    fail('aggregateRothCreditInvalid', 'Conversion sources require explicit owners', context)
  }
  // The simulator attributes an ownerless account to the first person, the same
  // fallback it uses for the Roth basis pools, so the expected destination is
  // resolved through that fallback rather than by raw owner equality.
  const primaryPersonId = plan.household.people[0]?.id ?? null
  const ownerOf = (ownerPersonId: string | null): string | null =>
    ownerPersonId ?? primaryPersonId
  const destinationByOwner = new Map<string, Account>()
  for (const account of plan.accounts) {
    if (account.type !== 'roth') continue
    const owner = ownerOf(account.ownerPersonId)
    if (owner === null || destinationByOwner.has(owner)) continue
    destinationByOwner.set(owner, account)
  }
  const sliceByOwner = new Map<string, Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[]>()
  for (const occurrence of ordered) {
    const owner = ownerOf(occurrence.ownerPersonId)!
    sliceByOwner.set(owner, [...(sliceByOwner.get(owner) ?? []), occurrence])
  }
  // Checked before the sort, and for every owner rather than for the pairs a
  // comparator happens to visit: a one-owner household never enters a
  // comparator at all, and this is the statutory requirement itself, not a
  // tie-break detail.
  for (const owner of sliceByOwner.keys()) {
    if (destinationByOwner.has(owner)) continue
    fail('aggregateRothCreditInvalid', 'An owner who converted requires a Roth destination of their own', {
      taxYear, ownerPersonId: owner,
    })
  }
  const expectedOwners = [...sliceByOwner.keys()].sort((left, right) =>
    (accountOrder.get(destinationByOwner.get(left)!.id) ?? Number.MAX_SAFE_INTEGER) -
    (accountOrder.get(destinationByOwner.get(right)!.id) ?? Number.MAX_SAFE_INTEGER))
  if (credits.length !== expectedOwners.length) {
    fail('aggregateRothCreditInvalid', 'Owned-IRA conversions require exactly one aggregate Roth credit per converting owner', context)
  }
  const maximumDebitOrdinal = Math.max(
    ...ownedConversions.map((entry) => entry.mutationOrdinal),
  )
  const seenKeys = new Set<string>()
  const results: Readonly<NormalizedAggregateRothDestinationCredit>[] = []
  for (let index = 0; index < expectedOwners.length; index += 1) {
    const owner = expectedOwners[index]!
    const credit = credits[index]!
    const slice = sliceByOwner.get(owner)!
    if (credit.simulatorPhase !== 'legacyRothConversionAggregateDestinationCredit' ||
        credit.producerOccurrenceKey !== null || credit.ownerPersonId !== null ||
        credit.sourceAccountId !== null || credit.sourceBalanceBeforePlanDollars !== null ||
        credit.sourceBalanceAfterPlanDollars !== null) {
      fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must not impersonate per-source evidence', context)
    }
    const keys = slice.map((entry) => entry.producerOccurrenceKey)
    const owners = slice.map((entry) => entry.ownerPersonId)
    if (JSON.stringify(credit.producerOccurrenceKeys) !== JSON.stringify(keys) ||
        JSON.stringify(credit.sourceOwnerPersonIds) !== JSON.stringify(owners) ||
        keys.some((key) => seenKeys.has(key)) ||
        new Set(keys).size !== keys.length ||
        credit.mutationOrdinal <= maximumDebitOrdinal) {
      fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must preserve its complete ordered legacy source loop after every debit', {
        taxYear, ownerPersonId: owner,
      })
    }
    for (const key of keys) seenKeys.add(key)
    const destinationId = credit.destinationRothAccountId
    const destination = plan.accounts.find((account) => account.id === destinationId)
    const expectedDestination = destinationByOwner.get(owner)!
    if (destinationId === null || destination?.type !== 'roth' ||
        expectedDestination.id !== destinationId ||
        credit.destinationOwnerPersonId === null ||
        destination.ownerPersonId !== credit.destinationOwnerPersonId ||
        ownerOf(destination.ownerPersonId) !== owner ||
        slice.some((entry) => parseKey(entry.producerOccurrenceKey, taxYear)[2] !== destinationId)) {
      fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must bind the first Plan Roth account of its own source owner', {
        taxYear, ownerPersonId: owner,
      })
    }
    const rawTotal = summedPlanDollars(
      slice.map((entry) => entry.grossAmountPlanDollars),
      'Aggregate conversion occurrence amount',
      context,
    )
    if (credit.destinationBalanceBeforePlanDollars +
        credit.destinationCreditedAmountPlanDollars !==
          credit.destinationBalanceAfterPlanDollars ||
        !rawTotalsReconcile(
          rawTotal,
          credit.destinationCreditedAmountPlanDollars,
          slice.length,
        )) {
      fail('aggregateRothCreditInvalid', 'Aggregate Roth credit must reconcile its own conversion occurrences and its destination balance', {
        taxYear, ownerPersonId: owner,
      })
    }
    cents(credit.destinationBalanceBeforePlanDollars, 'Roth destination opening balance', context)
    const credited = cents(credit.destinationCreditedAmountPlanDollars, 'Roth destination credit', context)
    cents(credit.destinationBalanceAfterPlanDollars, 'Roth destination closing balance', context)
    const withoutId = {
      status: 'aggregateDestinationCreditSourceReconciled' as const,
      destinationAttribution: 'aggregateOnlyNotSourceAllocated' as const,
      actionability: 'notEstablished' as const,
      destinationRothAccountId: asAccountId(destinationId),
      destinationOwnerPersonId: credit.destinationOwnerPersonId as PersonId,
      destinationCreditedAmount: credited,
      producerOccurrenceKeys: keys,
      sourceOwnerPersonIds: owners as PersonId[],
    }
    results.push(deepFreeze({
      ...withoutId,
      evidenceId: deriveActionStructuralId(
        'projection-owned-ira-runtime-source-aggregate-roth-credit',
        [plan.id, taxYear, withoutId],
      ),
    }))
  }
  if (seenKeys.size !== ordered.length) {
    fail('aggregateRothCreditInvalid', 'Every conversion occurrence requires exactly one owner-slice credit', context)
  }
  return results
}

/**
 * Reconcile one destination credit per named request.
 *
 * The aggregate validator above ends by demanding that the credit's
 * destination be `plan.accounts.find((account) => account.type === 'roth')` —
 * whichever Roth is first in Plan array order. That demand is correct for the
 * aggregate strategy, which really does pick its destination that way, and it
 * is exactly the dependence a named request must not inherit. Here the
 * destination is only ever checked against the one the request stated, so a
 * conversion to the second Roth in the array reconciles as readily as one to
 * the first, and reordering `plan.accounts` moves no dollars.
 */
function namedRothDestinationCredits(
  plan: Plan,
  taxYear: number,
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  applications: readonly Readonly<SimulatorRetirementRuntimeApplication>[],
  normalized: readonly NormalizedOwnedNonRothIraApplication[],
  coverage: NamedRothConversionCoverage,
  accountOrder: ReadonlyMap<string, number>,
): Readonly<NormalizedNamedRothDestinationCredit>[] {
  const context = { taxYear }
  const credits = applications.filter((entry): entry is Readonly<SimulatorRetirementRuntimeNamedRothDestinationCredit> =>
    entry.applicationKind === 'namedRothDestinationCredit')
  const namedOccurrences = occurrences.filter((entry) => entry.kind === 'namedRothConversion')
  const namedApplications = normalized.filter((entry) => entry.occurrenceKind === 'namedRothConversion')
  const actionIds = [...coverage.executedCentsByActionId.keys()]
  if (credits.length !== actionIds.length ||
      new Set(credits.map((credit) => credit.actionId)).size !== credits.length ||
      JSON.stringify(credits.map((credit) => credit.actionId)) !== JSON.stringify(actionIds)) {
    fail('namedRothConversionInvalid', 'Each committed named conversion requires exactly one destination credit in canonical action order', context)
  }

  const applicationByKey = new Map(namedApplications.map((entry) => [entry.producerOccurrenceKey, entry]))
  const results: Readonly<NormalizedNamedRothDestinationCredit>[] = []
  for (const credit of credits) {
    const actionId = credit.actionId
    if (credit.simulatorPhase !== 'namedRothConversionDestinationCredit' ||
        credit.producerOccurrenceKey !== null || credit.ownerPersonId !== null ||
        credit.sourceAccountId !== null || credit.sourceBalanceBeforePlanDollars !== null ||
        credit.sourceBalanceAfterPlanDollars !== null) {
      fail('namedRothConversionInvalid', 'A named destination credit must not impersonate per-source evidence', context)
    }
    const mine = namedOccurrences
      .filter((entry) => parseKey(entry.producerOccurrenceKey, taxYear)[3] === actionId)
      .sort((left, right) =>
        (accountOrder.get(left.sourceAccountId ?? '') ?? Number.MAX_SAFE_INTEGER) -
          (accountOrder.get(right.sourceAccountId ?? '') ?? Number.MAX_SAFE_INTEGER) ||
        compareUtf16CodeUnits(
          String(parseKey(left.producerOccurrenceKey, taxYear)[4]),
          String(parseKey(right.producerOccurrenceKey, taxYear)[4]),
        ))
    const keys = mine.map((entry) => entry.producerOccurrenceKey)
    const owners = mine.map((entry) => entry.ownerPersonId)
    const ordinals = keys.map((key) => applicationByKey.get(key)?.mutationOrdinal)
    if (mine.length === 0 || ordinals.some((ordinal) => ordinal === undefined) ||
        owners.some((owner) => owner === null) ||
        JSON.stringify(credit.producerOccurrenceKeys) !== JSON.stringify(keys) ||
        JSON.stringify(credit.sourceOwnerPersonIds) !== JSON.stringify(owners) ||
        credit.mutationOrdinal <= Math.max(...ordinals as number[])) {
      fail('namedRothConversionInvalid', 'A named destination credit must follow its own complete ordered debit loop', context)
    }
    const destinationId = credit.destinationRothAccountId
    const destination = plan.accounts.find((account) => account.id === destinationId)
    if (destinationId === null || destination?.type !== 'roth' ||
        credit.destinationOwnerPersonId === null ||
        destination.ownerPersonId !== credit.destinationOwnerPersonId ||
        mine.some((entry) => parseKey(entry.producerOccurrenceKey, taxYear)[2] !== destinationId)) {
      fail('namedRothConversionInvalid', 'A named destination credit must bind the Roth account its own request stated', context)
    }
    cents(credit.destinationBalanceBeforePlanDollars, 'Named Roth destination opening balance', context)
    const credited = cents(credit.destinationCreditedAmountPlanDollars, 'Named Roth destination credit', context)
    cents(credit.destinationBalanceAfterPlanDollars, 'Named Roth destination closing balance', context)
    if (credit.destinationBalanceBeforePlanDollars +
        credit.destinationCreditedAmountPlanDollars !==
          credit.destinationBalanceAfterPlanDollars ||
        credited !== coverage.executedCentsByActionId.get(actionId)) {
      fail('namedRothConversionInvalid', 'A named destination credit must reconcile its committed cents and its destination balance', context)
    }
    const withoutId = {
      status: 'namedDestinationCreditActionReconciled' as const,
      destinationAttribution: 'namedRequestDestination' as const,
      actionability: 'notEstablished' as const,
      actionId,
      destinationRothAccountId: asAccountId(destinationId),
      destinationOwnerPersonId: credit.destinationOwnerPersonId as PersonId,
      destinationCreditedAmount: credited,
      producerOccurrenceKeys: keys,
      sourceOwnerPersonIds: owners as PersonId[],
    }
    results.push(deepFreeze({
      ...withoutId,
      evidenceId: deriveActionStructuralId(
        'projection-owned-ira-runtime-source-named-roth-credit',
        [plan.id, taxYear, withoutId],
      ),
    }))
  }
  return results
}

function blocked(
  issue: OwnedNonRothIraRuntimeSourceSeriesIssue,
  projectionStartTaxYear: number,
): Readonly<OwnedNonRothIraRuntimeSourceSeriesBlocked> {
  return deepFreeze({
    status: 'ownedNonRothIraRuntimeSourceSeriesBlocked',
    evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness',
    movement: 'notCommitted',
    actionability: 'notEstablished',
    projectionStartTaxYear: Number.isSafeInteger(projectionStartTaxYear)
      ? projectionStartTaxYear : null,
    // Do not inspect rejected inputs while constructing fail-closed diagnostics.
    endTaxYear: null,
    years: null,
    evidenceId: null,
    issues: [issue],
  })
}

function validateUnchecked(
  rawPlan: Plan,
  projectionStartTaxYear: number,
  years: readonly Readonly<YearResult>[],
): Readonly<OwnedNonRothIraRuntimeSourceSeriesComplete> {
  const parsedPlan = planSchema.safeParse(rawPlan)
  if (!parsedPlan.success) fail('planInvalid', 'Runtime source replay requires a valid Plan')
  const plan = parsedPlan.data
  if (!Number.isSafeInteger(projectionStartTaxYear) || projectionStartTaxYear < 1 ||
      projectionStartTaxYear > 9999 || years.length === 0 ||
      years[0]!.year !== projectionStartTaxYear) {
    fail('yearSeriesInvalid', 'Runtime source series must begin at its authoritative projection start year')
  }
  for (let index = 0; index < years.length; index += 1) {
    if (years[index]!.year !== projectionStartTaxYear + index) {
      fail('yearSeriesInvalid', 'Runtime source years must be unique, ordered, and exactly contiguous')
    }
  }

  const accountById = new Map(plan.accounts.map((account) => [account.id, account]))
  const accountOrder = new Map<string, number>()
  for (const [index, account] of plan.accounts.entries()) {
    if (!accountOrder.has(account.id)) accountOrder.set(account.id, index)
  }
  const pools = ownedPools(plan)
  const ownedAccounts = [...pools.values()].flat()
  const personIds = new Set(plan.household.people.map((person) => person.id))
  let openingBalances = new Map<AccountId, UsdCents>(ownedAccounts.map((account) => [
    asAccountId(account.id), cents(
      aggregateOwnedOpeningBalance(plan, account.id),
      'Plan opening IRA balance',
      { sourceAccountId: account.id },
    ),
  ]))
  let openingRawBalances = new Map<AccountId, number>(ownedAccounts.map((account) => [
    asAccountId(account.id), aggregateOwnedOpeningBalance(plan, account.id),
  ]))
  let openingPhysicalRawBalances = new Map(
    ownedPhysicalRows(plan).map(({ account, balanceIndex }) => [
      physicalBalanceKey(account.id, balanceIndex),
      account.balance,
    ]),
  )
  /**
   * The contract-value channel, carried year to year exactly as the account
   * balances beside it are.
   *
   * WHERE ITS OPENING COMES FROM, which is the one place this arm cannot derive
   * and had better say so. The settlement replays a single year against a Plan
   * snapshot whose account balances the simulator has rewritten to that year's
   * openings; an annuity account carries no balance field to rewrite, so the
   * channel's opening arrives on the post-growth source instead and is trusted
   * on the same terms `plan.accounts[].balance` is. What is NOT trusted is its
   * size: the channel can never hold more than the premium that filled it,
   * because nothing else ever credits it, and it must be exactly zero in any
   * year at or before the purchase. Within the year every credit and debit
   * between that opening and the published close has to reconcile in exact
   * cents, and across a multi-year series each year's opening must be the prior
   * year's close.
   *
   * A DERIVED SEED WAS TRIED AND IS WRONG. Re-deriving the opening as the
   * premium less the payments made before the replay's start year is right for
   * a contract bought before the projection began, and wrong for every contract
   * whose funding account could not pay the whole premium -- the engine funds
   * `min(premium, spendable)`, so a purchase against a short balance credits
   * less than the Plan quotes, and a later single-year replay of that
   * projection reconstructed a channel the projection never had.
   * @see iraAnnuityContractValue.ts
   */
  const stagingContracts = ownedIraFundedAnnuityContracts(plan)
  const contractOwnerById = new Map<AccountId, PersonId>(
    stagingContracts.map(({ contract, ownerPersonId }) =>
      [asAccountId(contract.id), ownerPersonId as PersonId]),
  )
  const contractFundingById = new Map<AccountId, AccountId>(
    stagingContracts.map(({ contract, funding }) =>
      [asAccountId(contract.id), asAccountId(funding.id)]),
  )
  const contractPremiumById = new Map<AccountId, number>(
    stagingContracts.map(({ contract }) =>
      [asAccountId(contract.id), contract.purchase!.premium]),
  )
  const contractPurchaseYearById = new Map<AccountId, number>(
    stagingContracts.map(({ contract }) =>
      [asAccountId(contract.id), contract.purchase!.year]),
  )
  let openingContractRawValues: Map<AccountId, number> | null = null
  const normalizedYears: NormalizedOwnedNonRothIraRuntimeSourceYear[] = []

  for (const yearResult of years) {
    const taxYear = yearResult.year
    // S2 accounts become members of their beneficiary's owned-IRA aggregate
    // in the election year. Reconstruct each tax year's actual pool instead of
    // holding the projection-start inventory static across that identity flip.
    const pools = ownedPools(plan, taxYear)
    const ownedAccounts = [...pools.values()].flat()
    const physicalOwnedRows = ownedPhysicalRows(plan, taxYear)
    const occurrenceSource = yearResult.retirementRuntimeSource
    const applicationSource = yearResult.retirementRuntimeApplicationSource
    const balanceSource = yearResult.ownedNonRothIraPostGrowthSource
    const publishedBalancesBeforeGrowth =
      yearResult.ownedNonRothIraBalancesBeforeGrowth
    const publishedPhysicalBalancesBeforeGrowth =
      yearResult.ownedNonRothIraPhysicalBalancesBeforeGrowth
    const publishedPhysicalOpeningBalances =
      yearResult.ownedNonRothIraPhysicalOpeningBalances
    if (!occurrenceSource || !applicationSource || !balanceSource ||
        !publishedBalancesBeforeGrowth ||
        typeof publishedBalancesBeforeGrowth !== 'object' ||
        Array.isArray(publishedBalancesBeforeGrowth)) {
      fail('sourceMissing', 'Each year requires occurrences, applications, pre-growth balances, and post-growth balances', { taxYear })
    }
    if (publishedPhysicalOpeningBalances !== undefined) {
      if (publishedPhysicalOpeningBalances.length !== physicalOwnedRows.length) {
        fail('sourceCoverageInvalid', 'Physical opening balances must contain every owned IRA balance row', { taxYear })
      }
      for (let index = 0; index < physicalOwnedRows.length; index += 1) {
        const expected = physicalOwnedRows[index]!
        const published = publishedPhysicalOpeningBalances[index]!
        const key = physicalBalanceKey(expected.account.id, expected.balanceIndex)
        if (published.sourceAccountId !== expected.account.id ||
            published.balanceIndex !== expected.balanceIndex ||
            (openingPhysicalRawBalances.has(key) &&
              openingPhysicalRawBalances.get(key) !== published.balancePlanDollars)) {
          fail('balanceChainInvalid', 'Physical opening balances must continue row identity and prior close', {
            taxYear, sourceAccountId: published.sourceAccountId,
          })
        }
        cents(published.balancePlanDollars, 'Physical opening IRA balance', {
          taxYear, sourceAccountId: published.sourceAccountId,
        })
        openingPhysicalRawBalances.set(key, published.balancePlanDollars)
      }
    } else if (physicalOwnedRows.length !== ownedAccounts.length) {
      fail('sourceMissing', 'Duplicate owned IRA rows require physical opening balances', { taxYear })
    }
    if (occurrenceSource.status !== 'runtimeOccurrenceSourcesCaptured' ||
        occurrenceSource.captureBoundary !== 'legacyAnnualPassCommittedBeforeYearResultPublication' ||
        occurrenceSource.journalValidation !== 'notRun' ||
        applicationSource.status !== 'runtimeApplicationSourcesCaptured' ||
        applicationSource.captureBoundary !== 'atOwnedNonRothIraMutationSitesBeforeAnnualGrowth' ||
        applicationSource.applicationValidation !== 'notRun' ||
        balanceSource.status !== 'postGrowthOwnedNonRothIraBalancesCaptured' ||
        balanceSource.captureBoundary !== 'afterAllAnnualTransactionsAndGrowthBeforeYearResultPublication' ||
        balanceSource.annualObservationValidation !== 'notRun' ||
        occurrenceSource.planId !== plan.id || applicationSource.planId !== plan.id ||
        balanceSource.planId !== plan.id || occurrenceSource.taxYear !== taxYear ||
        applicationSource.taxYear !== taxYear || balanceSource.taxYear !== taxYear) {
      fail('sourceContractInvalid', 'Raw sources must retain exact Plan/year/status/boundaries', { taxYear })
    }

    const occurrenceByKey = new Map<string, Readonly<SimulatorAnnualRetirementRuntimeOccurrence>>()
    const occurrenceOrderId = new Map<string, string>()
    for (let index = 0; index < occurrenceSource.runtimeOccurrences.length; index += 1) {
      const occurrence = occurrenceSource.runtimeOccurrences[index]!
      if (index > 0 && compareOccurrences(occurrenceSource.runtimeOccurrences[index - 1]!, occurrence) > 0) {
        fail('sourceOrderInvalid', 'Runtime occurrences must retain canonical publication order', { taxYear })
      }
      if (!occurrence.producerOccurrenceKey.trim() || occurrenceByKey.has(occurrence.producerOccurrenceKey)) {
        fail('sourceIdentityInvalid', 'Runtime occurrence keys must be nonblank and unique', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
      const amount = cents(occurrence.grossAmountPlanDollars, 'Runtime occurrence amount', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
      if (amount === 0 || occurrence.executionDate !== null || occurrence.executionSequence !== null ||
          occurrence.movementAuthorityId !== null || occurrence.ownerPersonId === null ||
          occurrence.sourceAccountId === null || !personIds.has(occurrence.ownerPersonId)) {
        fail('sourceContractInvalid', 'Legacy occurrences require positive amount and Plan identity without invented chronology/authority', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
      const account = accountById.get(occurrence.sourceAccountId)
      // The owner an annuity payment reports is the PAYMENT owner the income
      // block used -- `ownerPersonId ?? primary` -- while the aggregate it
      // belongs to is the funding IRA's. On a contract naming its owner the two
      // are the same by Plan validation; on one naming nobody the equality
      // below would compare against `null` and refuse a well-formed year, so
      // the contract's own owner field is resolved the same way the simulator
      // resolved it. Which aggregate the payment lands in is decided by the
      // funding owner, in the contract chain further down, not here.
      const expectedOwnerPersonId = account?.type === 'annuity'
        ? account.ownerPersonId ?? (plan.household.people[0]?.id ?? null)
        : account?.ownerPersonId
      if (!account || expectedOwnerPersonId !== occurrence.ownerPersonId ||
          !sourceCompatible(occurrence, account, plan, taxYear)) {
        fail('sourceIdentityInvalid', 'Occurrence owner/source/kind must exact-rejoin its Plan account', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
      occurrenceOrderId.set(occurrence.producerOccurrenceKey, occurrenceOrderAccountId(plan, occurrence, taxYear))
      occurrenceByKey.set(occurrence.producerOccurrenceKey, occurrence)
    }
    for (const pension of plan.accounts) {
      if (pension.type !== 'pension' ||
          pension.lumpSumOffer?.electionYear !== taxYear ||
          pension.lumpSumOffer.amount <= 0 ||
          pension.lumpSumElection === undefined) continue
      const target = accountById.get(pension.lumpSumElection.rolloverAccountId)
      if (!target || !isAggregatedIra(target)) continue
      const expectedKey = JSON.stringify([
        'rolloverInflow', pension.id, target.id,
      ])
      const occurrence = occurrenceByKey.get(expectedKey)
      if (occurrence?.kind !== 'rolloverInflow' ||
          occurrence.grossAmountPlanDollars !== pension.lumpSumOffer.amount) {
        fail('sourceCoverageInvalid', 'A Plan-declared owned-IRA pension rollover requires its canonical occurrence and exact elected amount', {
          taxYear, sourceAccountId: target.id,
          producerOccurrenceKey: expectedKey,
        })
      }
    }
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['ownedIraRmd', 'employerPlanRmd'],
      yearResult.rmd,
      'RMD',
      taxYear,
      accountOrder,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['automaticSeppDistribution'],
      yearResult.sepp,
      'SEPP',
      taxYear,
      accountOrder,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['inheritedIraRmd'],
      yearResult.inheritedDistribution,
      'inherited distribution',
      taxYear,
      accountOrder,
    )
    // The published annual conversion total is now reached by two routes that
    // are not interchangeable. The aggregate strategy's sweep produces
    // `legacyRothConversion` occurrences; the exact-cent executor's committed
    // requests produce `namedRothConversion` ones. Reconciling only the legacy
    // kind against the published figure would fail every year a named request
    // moved money, and reconciling the union alone would let one kind absorb
    // the other's dollars, so the named arm is bound to the executor's own
    // committed cents first and the union to the published total second.
    const namedConversionCoverage = requireNamedRothConversionCoverage(
      yearResult, accountById, occurrenceSource.runtimeOccurrences, taxYear,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['namedRothConversion'],
      ledgerCentsToPlanDollars(namedConversionCoverage.totalExecutedAmount),
      'named Roth conversion',
      taxYear,
      accountOrder,
    )
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['legacyRothConversion', 'namedRothConversion'],
      yearResult.rothConversion,
      'Roth conversion',
      taxYear,
      accountOrder,
    )
    if (yearResult.ownedNonRothIraContributions === undefined) {
      fail('sourceMissing', 'Each year requires the independently published owned-IRA contribution total', {
        taxYear,
      })
    }
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['ownedIraContribution', 'ownedIraEmployerContribution'],
      yearResult.ownedNonRothIraContributions,
      'owned non-Roth IRA contribution',
      taxYear,
      accountOrder,
    )
    const legacyNeedBasedWithdrawalTotal = occurrenceTotalInPlanOrder(
      occurrenceSource.runtimeOccurrences,
      ['legacyNeedBasedWithdrawal'],
      'legacy need-based traditional withdrawal',
      taxYear,
      accountOrder,
    )
    // Traditional withdrawals carry only the traditional-character forced
    // inherited share (`inheritedTraditionalDistribution`); Roth forced dollars
    // join `withdrawals.roth` and must not be double-counted here against the
    // combined `inheritedDistribution` scalar.
    if (yearResult.inheritedTraditionalDistribution === undefined) {
      fail('sourceMissing', 'Each year requires the independently published traditional-character inherited distribution total', {
        taxYear,
      })
    }
    const reconstructedTraditionalWithdrawal =
      ((legacyNeedBasedWithdrawalTotal.total + yearResult.rmd) + yearResult.sepp) +
      yearResult.inheritedTraditionalDistribution
    if (!Number.isFinite(yearResult.withdrawals.traditional) ||
        yearResult.withdrawals.traditional < 0 ||
        Object.is(yearResult.withdrawals.traditional, -0)) {
      fail('sourceAmountInvalid', 'Published traditional withdrawal total must be finite, nonnegative, and not negative zero', {
        taxYear,
      })
    }
    if (!rawTotalsReconcile(
      reconstructedTraditionalWithdrawal,
      yearResult.withdrawals.traditional,
      legacyNeedBasedWithdrawalTotal.count + 3,
    )) {
      fail('sourceCoverageInvalid', 'Legacy need-based withdrawal occurrences plus RMD, SEPP, and traditional-character inherited totals must exact-rejoin published traditional withdrawals', {
        taxYear,
      })
    }

    requireNoExactActionOwnedIraMovement(
      plan, yearResult, accountById, taxYear,
    )
    // Beside the guard above, and before the application chain rather than
    // beside the QCD reconciliation below, because these two decide the same
    // question: which exact actions this replay will let move owned-IRA
    // dollars. A gift with no committed evidence behind it is refused here, so
    // no application referring to one ever reaches the balance chain.
    const namedQcdCoverage = requireNamedQcdCoverage(
      yearResult, accountById, occurrenceSource.runtimeOccurrences, taxYear,
    )

    for (const annuity of plan.accounts) {
      if (annuity.type !== 'annuity' || annuity.purchase?.year !== taxYear ||
          annuity.purchase.premium <= 0) continue
      const funding = accountById.get(annuity.purchase.fundingAccountId)
      if (!funding || !isAggregatedIra(funding)) continue
      const sourceAccountId = asAccountId(funding.id)
      if ((openingRawBalances.get(sourceAccountId) ?? 0) <= 0) continue
      const expectedKey = JSON.stringify([
        'annuityFundingTransfer', funding.id, annuity.id,
      ])
      if (!occurrenceByKey.has(expectedKey)) {
        fail('annuityStageRequired', 'A funded Plan annuity purchase requires its owned-IRA transfer source', {
          taxYear, sourceAccountId: funding.id,
          producerOccurrenceKey: expectedKey,
        })
      }
      // THE REFUSAL THAT REMAINS, and what is left of it. Until this slice, a
      // premium leaving the captured pool refused the year outright: the
      // contract it went into was not something the replay carried, so the
      // Form 8606 aggregate had value leave it and arrive nowhere. It carries
      // the contract now -- the value channel below is the arrival -- but only
      // for a contract it can place in ONE owner's aggregate. Section
      // 408(d)(2)(A) aggregates one individual's plans, and a contract the
      // engine cannot assign to an individual has no aggregate to enter.
      //
      // NO VALID PLAN IS KNOWN TO REACH IT. Which individual the contract
      // belongs to is read off the FUNDING account, so a contract naming the
      // other spouse or naming nobody stages like any other; a non-qualified
      // premium cannot be drawn on a traditional account at all, plan
      // validation having refused that since before this slice. It is kept as a
      // fail-closed net rather than deleted, because the alternative to
      // refusing an unplaceable contract is pricing a section 72 aggregate that
      // has lost value to nowhere. If it ever fires the year prices on the
      // legacy ledger, and since the refusal is about this year's inventory
      // rather than anyone's basis it disqualifies only this year.
      if (!contractOwnerById.has(asAccountId(annuity.id))) {
        fail('annuityStageRequired', 'An owned-IRA annuity premium requires a contract this replay can place in one owner’s section 408(d)(2) aggregate', {
          taxYear, sourceAccountId: funding.id,
          producerOccurrenceKey: expectedKey,
        })
      }
    }

    const expectedOwners = [...pools.keys()]
    if (balanceSource.ownerPools.length !== expectedOwners.length) {
      fail('postGrowthPoolInvalid', 'Post-growth source must contain every and only complete owned-IRA pool', { taxYear })
    }
    const postGrowthBalances = new Map<AccountId, UsdCents>()
    const postGrowthRawBalances = new Map<AccountId, number>()
    const postGrowthPhysicalRawBalances = new Map<string, number>()
    const preGrowthBalances = new Map<AccountId, UsdCents>()
    const preGrowthRawBalances = new Map<AccountId, number>()
    const preGrowthPhysicalRawBalances = new Map<string, number>()
    const ownerBalances = new Map<PersonId, NormalizedOwnedNonRothIraYearEndBalance[]>()
    const publishedBalances = yearResult.balances
    if (Object.keys(publishedBalancesBeforeGrowth).length !==
        ownedAccounts.length) {
      fail(
        'sourceCoverageInvalid',
        'Published pre-growth balances must contain every and only owned non-Roth IRA account',
        { taxYear },
      )
    }
    for (const account of ownedAccounts) {
      if (!Object.hasOwn(publishedBalancesBeforeGrowth, account.id)) {
        fail(
          'sourceCoverageInvalid',
          'Published pre-growth balances must contain every and only owned non-Roth IRA account',
          {
            taxYear,
            ownerPersonId: account.ownerPersonId!,
            sourceAccountId: account.id,
          },
        )
      }
      const sourceAccountId = asAccountId(account.id)
      const rawBalanceBeforeGrowthPlanDollars =
        publishedBalancesBeforeGrowth[account.id]
      preGrowthRawBalances.set(
        sourceAccountId,
        rawBalanceBeforeGrowthPlanDollars,
      )
      preGrowthBalances.set(
        sourceAccountId,
        cents(
          rawBalanceBeforeGrowthPlanDollars,
          'Published pre-growth IRA balance',
          {
            taxYear,
            ownerPersonId: account.ownerPersonId!,
            sourceAccountId,
          },
        ),
      )
    }
    if (publishedPhysicalBalancesBeforeGrowth !== undefined) {
      if (publishedPhysicalBalancesBeforeGrowth.length !== physicalOwnedRows.length) {
        fail('sourceCoverageInvalid', 'Physical pre-growth balances must contain every owned IRA balance row', { taxYear })
      }
      for (let index = 0; index < physicalOwnedRows.length; index += 1) {
        const expected = physicalOwnedRows[index]!
        const published = publishedPhysicalBalancesBeforeGrowth[index]!
        if (published.sourceAccountId !== expected.account.id ||
            published.balanceIndex !== expected.balanceIndex) {
          fail('sourceCoverageInvalid', 'Physical pre-growth balances must retain balance-row order and identity', {
            taxYear, sourceAccountId: published.sourceAccountId,
          })
        }
        cents(published.balancePlanDollars, 'Physical pre-growth IRA balance', {
          taxYear, sourceAccountId: published.sourceAccountId,
        })
        preGrowthPhysicalRawBalances.set(
          physicalBalanceKey(published.sourceAccountId, published.balanceIndex),
          published.balancePlanDollars,
        )
      }
    } else if (physicalOwnedRows.length !== ownedAccounts.length) {
      fail('sourceMissing', 'Duplicate owned IRA rows require physical pre-growth balances', { taxYear })
    } else {
      for (const row of physicalOwnedRows) {
        preGrowthPhysicalRawBalances.set(
          physicalBalanceKey(row.account.id, row.balanceIndex),
          publishedBalancesBeforeGrowth[row.account.id]!,
        )
      }
    }
    for (let ownerIndex = 0; ownerIndex < expectedOwners.length; ownerIndex += 1) {
      const owner = expectedOwners[ownerIndex]!
      const rawPool = balanceSource.ownerPools[ownerIndex]!
      const accounts = pools.get(owner)!
      const physicalAccounts = physicalOwnedRows
        .filter((row) => row.account.ownerPersonId === owner)
        .sort((left, right) =>
          compareUtf16CodeUnits(left.account.id, right.account.id) ||
          left.balanceIndex - right.balanceIndex)
      if (rawPool.ownerPersonId !== owner || rawPool.accountBalances.length !== physicalAccounts.length) {
        fail('postGrowthPoolInvalid', 'Post-growth pools must retain canonical owner order and membership', { taxYear, ownerPersonId: owner })
      }
      const aggregateRawById = new Map<string, number>()
      rawPool.accountBalances.forEach((raw, accountIndex) => {
        const { account, balanceIndex } = physicalAccounts[accountIndex]!
        const rawSourceAccountId = raw.sourceAccountId
        const rawBalancePlanDollars = raw.balancePlanDollars
        if (rawSourceAccountId !== account.id ||
            (raw.balanceIndex !== undefined && raw.balanceIndex !== balanceIndex)) {
          fail('postGrowthPoolInvalid', 'Post-growth balances must retain canonical account order including zero siblings', {
            taxYear, ownerPersonId: owner, sourceAccountId: rawSourceAccountId,
          })
        }
        cents(rawBalancePlanDollars, 'Post-growth IRA balance', {
          taxYear, ownerPersonId: owner, sourceAccountId: account.id,
        })
        postGrowthPhysicalRawBalances.set(
          physicalBalanceKey(account.id, balanceIndex), rawBalancePlanDollars,
        )
        aggregateRawById.set(account.id, (aggregateRawById.get(account.id) ?? 0) + rawBalancePlanDollars)
      })
      const normalizedBalances = accounts.map((account) => {
        const rawBalancePlanDollars = aggregateRawById.get(account.id) ?? 0
        const publishedBalancePlanDollars = publishedBalances[account.id]
        if (!Object.hasOwn(publishedBalances, account.id) ||
            publishedBalancePlanDollars !== rawBalancePlanDollars) {
          fail('postGrowthPoolInvalid', 'Aggregated post-growth physical balances must exact-rejoin the published account balance', {
            taxYear, ownerPersonId: owner, sourceAccountId: account.id,
          })
        }
        const sourceAccountId = asAccountId(account.id)
        const balanceAmount = cents(rawBalancePlanDollars, 'Aggregated post-growth IRA balance', {
          taxYear, ownerPersonId: owner, sourceAccountId,
        })
        postGrowthBalances.set(sourceAccountId, balanceAmount)
        postGrowthRawBalances.set(sourceAccountId, rawBalancePlanDollars)
        return { sourceAccountId, balancePlanDollars: rawBalancePlanDollars, balanceAmount }
      })
      ownerBalances.set(owner, normalizedBalances)
    }

    // The other half of line 6, read at the same instant and checked before the
    // chain that moves it. Each owner's staged contracts must be present, in
    // canonical order, bound to the funding account that put them in this pool,
    // opening at a figure inside the only bound there is -- the premium that
    // filled the channel -- and, in a year at or before the purchase, opening at
    // exactly zero, because nothing could have credited it yet.
    const publishedContractOpenings = new Map<AccountId, number>()
    const publishedContractClosings = new Map<AccountId, number>()
    for (let ownerIndex = 0; ownerIndex < expectedOwners.length; ownerIndex += 1) {
      const owner = expectedOwners[ownerIndex]!
      const rawPool = balanceSource.ownerPools[ownerIndex]!
      const expected = stagingContracts.filter((entry) =>
        entry.ownerPersonId === owner)
      const published = rawPool.annuityContractValues ?? []
      if (published.length !== expected.length) {
        fail('postGrowthPoolInvalid', 'Post-growth source must carry every and only this owner’s staged annuity contracts', {
          taxYear, ownerPersonId: owner,
        })
      }
      for (let index = 0; index < expected.length; index += 1) {
        const { contract, funding } = expected[index]!
        const entry = published[index]!
        const contractAccountId = asAccountId(contract.id)
        const context = {
          taxYear, ownerPersonId: owner, sourceAccountId: contract.id,
        }
        const opening = entry.contractValueOpeningPlanDollars
        const premium = contractPremiumById.get(contractAccountId)!
        const purchaseYear = contractPurchaseYearById.get(contractAccountId)!
        const carried = openingContractRawValues?.get(contractAccountId)
        if (entry.annuityAccountId !== contract.id ||
            entry.fundingAccountId !== funding.id ||
            !Number.isFinite(opening) || opening < 0 ||
            Object.is(opening, -0) || opening > premium ||
            (taxYear <= purchaseYear && opening !== 0) ||
            (carried !== undefined && carried !== opening)) {
          fail('postGrowthPoolInvalid', 'A published annuity contract value must open inside its premium and continue the prior year’s close', context)
        }
        cents(opening, 'Published annuity contract opening value', context)
        publishedContractOpenings.set(contractAccountId, opening)
        publishedContractClosings.set(
          contractAccountId, entry.contractValuePlanDollars,
        )
      }
    }

    const normalizedApplications: NormalizedOwnedNonRothIraApplication[] = []
    // An S2 account first joins this replay at its election-year owner-side
    // RMD. It has no prior owned-pool close to carry, so seed its chain from
    // that first published mutation (or the unchanged pre-growth observation
    // if it had no mutation). This is a reconstruction of the ledger's actual
    // opening, not a Plan-balance reset.
    for (const account of ownedAccounts) {
      const sourceAccountId = asAccountId(account.id)
      if (openingRawBalances.has(sourceAccountId)) continue
      const firstApplication = applicationSource.applications.find(
        (application) => application.sourceAccountId === account.id,
      )
      const opening = firstApplication?.sourceBalanceBeforePlanDollars ??
        preGrowthRawBalances.get(sourceAccountId)
      if (opening === undefined) {
        fail('balanceChainInvalid', 'A newly owned IRA must publish an opening mutation or unchanged pre-growth balance', {
          taxYear, ownerPersonId: account.ownerPersonId!, sourceAccountId: account.id,
        })
      }
      openingRawBalances.set(sourceAccountId, opening)
      openingBalances.set(sourceAccountId, cents(
        opening,
        'Newly owned IRA opening balance',
        { taxYear, ownerPersonId: account.ownerPersonId!, sourceAccountId: account.id },
      ))
    }
    /**
     * The year's running contract-value channel, chained the same way the
     * account balances are.
     *
     * WHERE THE REFUSAL USED TO BE. A `deferredAnnuityPoolExit` stood here and
     * refused every year in which a premium left the captured pool, because the
     * pool it left had a hole in it: value went out of the section 408(d)(2)
     * aggregate and this replay carried nothing it went into. This channel is
     * what it went into. The premium is credited here at the same ordinal the
     * debit was taken at, the contract's payments debit it, and its December 31
     * total is added to Form 8606 line 6 beside the accounts -- which is what
     * 408(d)(2)(A) with 7701(a)(37)(B) requires, and what makes the purchase
     * invisible to the form exactly as the statute makes it.
     */
    const contractRawValues = new Map(publishedContractOpenings)
    const contractValues = new Map(
      [...publishedContractOpenings].map(([contractId, value]) => [
        contractId,
        cents(value, 'Annuity contract opening value', {
          taxYear, sourceAccountId: contractId,
        }),
      ]),
    )
    const creditedPremiumKeys = new Set<string>()
    const appliedKeys = new Set<string>()
    let priorPhase = -1
    let priorPhaseAccountOrder = -1
    for (let index = 0; index < applicationSource.applications.length; index += 1) {
      const application = applicationSource.applications[index]!
      const currentPhase = phaseRank(application)
      if (application.mutationOrdinal !== index + 1 || currentPhase < priorPhase) {
        fail('applicationOrderInvalid', 'Applications must retain contiguous ordinals and annual phase order', { taxYear })
      }
      if (application.applicationKind === 'annuityContractPremiumCredit') {
        const contractId = application.destinationAnnuityAccountId
        const context = {
          taxYear,
          ...(contractId === null ? {} : { sourceAccountId: contractId }),
        }
        if (application.simulatorPhase !== 'annuityPurchaseContractCredit' ||
            application.producerOccurrenceKey !== null ||
            application.ownerPersonId !== null ||
            application.sourceAccountId !== null ||
            application.sourceBalanceBeforePlanDollars !== null ||
            application.sourceBalanceAfterPlanDollars !== null) {
          fail('sourceContractInvalid', 'An annuity premium credit must not impersonate per-source evidence', context)
        }
        const key = application.producerOccurrenceKeys[0]
        const debit = key === undefined ? undefined : occurrenceByKey.get(key)
        const owner = contractId === null
          ? undefined : contractOwnerById.get(asAccountId(contractId))
        const funding = contractId === null
          ? undefined : contractFundingById.get(asAccountId(contractId))
        if (contractId === null || owner === undefined || funding === undefined ||
            application.producerOccurrenceKeys.length !== 1 ||
            key === undefined || creditedPremiumKeys.has(key) ||
            debit?.kind !== 'annuityFundingTransfer' ||
            debit.sourceAccountId !== funding ||
            application.destinationOwnerPersonId !== owner ||
            JSON.stringify(application.sourceOwnerPersonIds) !==
              JSON.stringify([owner]) ||
            occurrenceOrderId.get(key) !== contractId) {
          fail('sourceContractInvalid', 'An annuity premium credit must bind one staged contract and its own owned-IRA debit', context)
        }
        creditedPremiumKeys.add(key)
        const contractAccountId = asAccountId(contractId)
        const rawBefore = contractRawValues.get(contractAccountId)
        const before = contractValues.get(contractAccountId)
        const credited = application.destinationCreditedAmountPlanDollars
        const rawAfter = application.destinationContractValueAfterPlanDollars
        const after = cents(rawAfter, 'Annuity contract value after a premium', context)
        cents(credited, 'Annuity premium credit', context)
        if (rawBefore === undefined || before === undefined ||
            application.destinationContractValueBeforePlanDollars !== rawBefore ||
            credited !== debit.grossAmountPlanDollars ||
            rawBefore + credited !== rawAfter ||
            BigInt(after) - (BigInt(before) + BigInt(cents(credited, 'Annuity premium credit', context))) < -2n ||
            BigInt(after) - (BigInt(before) + BigInt(cents(credited, 'Annuity premium credit', context))) > 2n) {
          fail('balanceChainInvalid', 'An annuity premium credit must continue the exact contract-value chain at its debit’s gross', context)
        }
        contractRawValues.set(contractAccountId, rawAfter)
        contractValues.set(contractAccountId, after)
        priorPhase = currentPhase
        priorPhaseAccountOrder = -1
        continue
      }
      if (application.applicationKind === 'aggregateRothDestinationCredit' ||
          application.applicationKind === 'namedRothDestinationCredit') {
        priorPhase = currentPhase
        priorPhaseAccountOrder = -1
        continue
      }
      const occurrence = occurrenceByKey.get(application.producerOccurrenceKey)
      const orderId = occurrenceOrderId.get(application.producerOccurrenceKey)
      const currentAccountOrder = orderId === undefined ? undefined : accountOrder.get(orderId)
      if (!occurrence || currentAccountOrder === undefined || appliedKeys.has(application.producerOccurrenceKey)) {
        fail('sourceCoverageInvalid', 'Each application must rejoin one unique ordered occurrence', {
          taxYear, producerOccurrenceKey: application.producerOccurrenceKey,
        })
      }
      if (currentPhase === priorPhase && currentAccountOrder < priorPhaseAccountOrder) {
        fail('applicationOrderInvalid', 'Applications within a simulator phase must retain controlling Plan account order', { taxYear })
      }
      priorPhase = currentPhase
      priorPhaseAccountOrder = currentAccountOrder
      appliedKeys.add(application.producerOccurrenceKey)
      if (ANNUITY_CONTRACT_CHAIN_PHASES.has(application.simulatorPhase)) {
        // The contract-value chain, run on the same before/amount/after
        // discipline the account chain runs on and against a different ledger,
        // because there is no account balance here to run it against.
        const contractId = occurrence.sourceAccountId!
        const contractAccountId = asAccountId(contractId)
        const poolOwner = contractOwnerById.get(contractAccountId)
        const context = {
          taxYear, sourceAccountId: contractId,
          producerOccurrenceKey: occurrence.producerOccurrenceKey,
          ...(poolOwner === undefined ? {} : { ownerPersonId: poolOwner }),
        }
        const shape = applicationShape(occurrence.kind)
        if (poolOwner === undefined || !shape ||
            occurrence.kind !== 'annuityContractDistribution' ||
            application.applicationKind !== 'debit' ||
            shape.simulatorPhase !== application.simulatorPhase ||
            application.ownerPersonId !== occurrence.ownerPersonId ||
            application.sourceAccountId !== contractId) {
          fail('sourceCoverageInvalid', 'An annuity contract application must rejoin a staged contract’s own payment occurrence', context)
        }
        const rawBefore = contractRawValues.get(contractAccountId)
        const before = contractValues.get(contractAccountId)
        const rawApplied = application.appliedAmountPlanDollars
        const rawAfter = application.sourceBalanceAfterPlanDollars
        const occurrenceAmount = cents(occurrence.grossAmountPlanDollars, 'Annuity payment amount', context)
        const applied = cents(rawApplied, 'Annuity contract value debit', context)
        const after = cents(rawAfter, 'Annuity contract value after a payment', context)
        // THE TWO FIGURES ARE NOT THE SAME FIGURE, and this is the seam where
        // that has to be said. `occurrenceAmount` is what the contract PAID,
        // which is the Form 8606 line-7 gross under 408(d)(2)(B); `applied` is
        // what the value channel could give up, which is capped by what the
        // channel still holds because a contract value cannot go negative. They
        // differ only once a contract has paid out more than its premium, and
        // there the whole payment still reports while the channel contributes
        // nothing further to line 6 -- one of the two directions the convention
        // errs in, and registered as such.
        if (rawBefore === undefined || before === undefined ||
            occurrenceAmount === 0 ||
            application.sourceBalanceBeforePlanDollars !== rawBefore ||
            rawApplied !== Math.min(occurrence.grossAmountPlanDollars, rawBefore) ||
            rawBefore - rawApplied !== rawAfter ||
            BigInt(after) - (BigInt(before) - BigInt(applied)) < -2n ||
            BigInt(after) - (BigInt(before) - BigInt(applied)) > 2n) {
          fail('balanceChainInvalid', 'An annuity payment must continue the exact contract-value chain and debit no more than the contract holds', context)
        }
        contractRawValues.set(contractAccountId, rawAfter)
        contractValues.set(contractAccountId, after)
        normalizedApplications.push({
          producerOccurrenceKey: occurrence.producerOccurrenceKey,
          occurrenceKind: 'annuityContractDistribution',
          applicationKind: 'debit',
          simulatorPhase: 'annuityContractDistribution',
          mutationOrdinal: application.mutationOrdinal,
          // THE POOL OWNER, not the payment owner. Which individual's Form 8606
          // this payment lands on is decided by whose aggregate the contract is
          // in, and 408(d)(2)(A) puts it in the aggregate of the person whose
          // IRA bought it. On a contract that names its owner the two are the
          // same person, because Plan validation requires it; on one that names
          // nobody the payment owner is a household fallback and this is the
          // fact.
          ownerPersonId: poolOwner,
          sourceAccountId: contractAccountId,
          amount: occurrenceAmount,
          sourceBalanceBefore: before,
          sourceBalanceAfter: after,
          sourceBalanceRoundingResidualCents:
            Number(BigInt(after) - (BigInt(before) - BigInt(applied))) as -2 | -1 | 0 | 1 | 2,
          form8606Line: 'line7',
          form8606LineGrossAmount: occurrenceAmount,
        })
        continue
      }
      const shape = applicationShape(occurrence.kind)
      const account = accountById.get(occurrence.sourceAccountId!)
      // Only a traditional IRA can be S2-effective; narrow before the
      // structural helper so the full account union stays out of it.
      const applicationS2Effective =
        account !== undefined &&
        account.type === 'traditional' &&
        account.kind === 'ira' &&
        isTreatAsOwnEffective(account, taxYear)
      if (!shape || !account ||
          (!isAggregatedIra(account) && !applicationS2Effective) ||
          shape.applicationKind !== application.applicationKind || shape.simulatorPhase !== application.simulatorPhase ||
          application.ownerPersonId !== occurrence.ownerPersonId || application.sourceAccountId !== occurrence.sourceAccountId) {
        fail('sourceCoverageInvalid', 'Application kind/phase/owner/source must exact-rejoin its owned-IRA occurrence', {
          taxYear, producerOccurrenceKey: application.producerOccurrenceKey,
        })
      }
      const context = {
        taxYear, ownerPersonId: occurrence.ownerPersonId!, sourceAccountId: occurrence.sourceAccountId!,
        producerOccurrenceKey: occurrence.producerOccurrenceKey,
      }
      const rawAmount = application.applicationKind === 'debit'
        ? application.appliedAmountPlanDollars : application.creditedAmountPlanDollars
      cents(rawAmount, 'Application amount', context)
      const occurrenceAmount = cents(occurrence.grossAmountPlanDollars, 'Occurrence amount', context)
      const sourceAccountId = asAccountId(occurrence.sourceAccountId!)
      const positionalContribution = occurrence.kind === 'ownedIraContribution'
      const keyTuple = positionalContribution
        ? parseKey(occurrence.producerOccurrenceKey, taxYear)
        : null
      const balanceIndex = positionalContribution ? keyTuple![2] : undefined
      const physicalKey = typeof balanceIndex === 'number'
        ? physicalBalanceKey(occurrence.sourceAccountId!, balanceIndex)
        : null
      const logicalRawBefore = openingRawBalances.get(sourceAccountId)
      const logicalRawAfter = logicalRawBefore === undefined
        ? undefined
        : application.applicationKind === 'debit'
          ? logicalRawBefore - rawAmount
          : logicalRawBefore + rawAmount
      const normalizedRawBefore = positionalContribution
        ? logicalRawBefore
        : application.sourceBalanceBeforePlanDollars
      const normalizedRawAfter = positionalContribution
        ? logicalRawAfter
        : application.sourceBalanceAfterPlanDollars
      if (normalizedRawBefore === undefined || normalizedRawAfter === undefined) {
        fail('balanceChainInvalid', 'Application requires a complete logical opening balance', context)
      }
      const before = cents(normalizedRawBefore, 'Application opening balance', context)
      const after = cents(normalizedRawAfter, 'Application closing balance', context)
      const rawExpectedAfter = application.applicationKind === 'debit'
        ? application.sourceBalanceBeforePlanDollars - rawAmount
        : application.sourceBalanceBeforePlanDollars + rawAmount
      const expectedCentAfter = application.applicationKind === 'debit'
        ? BigInt(before) - BigInt(occurrenceAmount)
        : BigInt(before) + BigInt(occurrenceAmount)
      const sourceBalanceRoundingResidual = BigInt(after) - expectedCentAfter
      if (rawAmount !== occurrence.grossAmountPlanDollars ||
          occurrenceAmount === 0 ||
          rawExpectedAfter !== application.sourceBalanceAfterPlanDollars ||
          (positionalContribution
            ? application.balanceIndex !== balanceIndex || physicalKey === null ||
              openingPhysicalRawBalances.get(physicalKey) !== application.sourceBalanceBeforePlanDollars
            : openingRawBalances.get(sourceAccountId) !== application.sourceBalanceBeforePlanDollars) ||
          openingBalances.get(sourceAccountId) !== before ||
          sourceBalanceRoundingResidual < -2n ||
          sourceBalanceRoundingResidual > 2n) {
        fail('balanceChainInvalid', 'Application must continue the exact per-account before/amount/after chain', context)
      }
      openingBalances.set(sourceAccountId, after)
      openingRawBalances.set(
        sourceAccountId,
        normalizedRawAfter,
      )
      if (physicalKey !== null) {
        openingPhysicalRawBalances.set(
          physicalKey,
          application.sourceBalanceAfterPlanDollars,
        )
      } else {
        applyPhysicalGroupClosing(
          openingPhysicalRawBalances,
          physicalOwnedRows,
          occurrence.sourceAccountId!,
          normalizedRawAfter,
        )
      }
      if (occurrence.kind === 'annuityFundingTransfer') {
        // The debit is whole and the balance chain has taken it. It contributes
        // no normalized application because it contributes nothing to either
        // Form 8606 line -- 408(d)(1) reaches only what is paid or distributed
        // OUT, and this was neither -- so the only thing left to check is that
        // the value it moved arrived somewhere, which the credit above records.
        // Checked after the loop, where the credit has had its chance to run.
        continue
      }
      normalizedApplications.push({
        producerOccurrenceKey: occurrence.producerOccurrenceKey,
        occurrenceKind: occurrence.kind as NormalizedOwnedNonRothIraApplication['occurrenceKind'],
        applicationKind: application.applicationKind,
        simulatorPhase: application.simulatorPhase as
          NormalizedOwnedNonRothIraApplication['simulatorPhase'],
        mutationOrdinal: application.mutationOrdinal,
        ownerPersonId: occurrence.ownerPersonId as PersonId,
        sourceAccountId,
        amount: occurrenceAmount,
        sourceBalanceBefore: before,
        sourceBalanceAfter: after,
        sourceBalanceRoundingResidualCents:
          Number(sourceBalanceRoundingResidual) as -2 | -1 | 0 | 1 | 2,
        form8606Line: shape.form8606Line,
        // Provisional. The routed-gift carve below is the only thing that moves
        // it, and it cannot run until the whole application chain is normalized.
        form8606LineGrossAmount: occurrenceAmount,
      })
    }
    for (const occurrence of occurrenceSource.runtimeOccurrences) {
      const account = accountById.get(occurrence.sourceAccountId!)
      // Only a traditional IRA can be S2-effective; narrow before the
      // structural helper so the full account union stays out of it.
      const s2Effective =
        account !== undefined &&
        account.type === 'traditional' &&
        account.kind === 'ira' &&
        isTreatAsOwnEffective(account, taxYear)
      if (account &&
          (isAggregatedIra(account) || s2Effective) &&
          !appliedKeys.has(occurrence.producerOccurrenceKey)) {
        fail('sourceCoverageInvalid', 'Every owned-IRA occurrence must have one supported application', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
      }
    }
    if (publishedPhysicalBalancesBeforeGrowth !== undefined) {
      for (const { account, balanceIndex } of physicalOwnedRows) {
        const key = physicalBalanceKey(account.id, balanceIndex)
        if (openingPhysicalRawBalances.get(key) !== preGrowthPhysicalRawBalances.get(key)) {
          fail('balanceChainInvalid', 'The completed physical application chain must exact-rejoin its pre-growth balance row', {
            taxYear,
            ownerPersonId: account.ownerPersonId!,
            sourceAccountId: account.id,
          })
        }
      }
    }
    for (const account of ownedAccounts) {
      const sourceAccountId = asAccountId(account.id)
      if (
        openingRawBalances.get(sourceAccountId) !==
          preGrowthRawBalances.get(sourceAccountId) ||
        openingBalances.get(sourceAccountId) !==
          preGrowthBalances.get(sourceAccountId)
      ) {
        fail(
          'balanceChainInvalid',
          'The completed application chain must exact-rejoin the live pre-growth account observation',
          {
            taxYear,
            ownerPersonId: account.ownerPersonId!,
            sourceAccountId,
          },
        )
      }
    }
    // THE PREMIUM MUST HAVE ARRIVED. Every `annuityFundingTransfer` debit the
    // chain took has to be matched by the credit that put its dollars into a
    // contract-value channel, or the year is one in which value left a section
    // 408(d)(2) aggregate and entered nothing -- which is exactly the defect
    // this slice closed and exactly what a missing credit would silently
    // reopen. Deliberately raised AFTER the chain rejoins its live observation,
    // for the reason the pool-exit refusal was moved there: the annuity
    // application sorts first, so refusing in place would mask every integrity
    // failure later in the same year.
    for (const occurrence of occurrenceSource.runtimeOccurrences) {
      if (occurrence.kind !== 'annuityFundingTransfer') continue
      const funding = accountById.get(occurrence.sourceAccountId!)
      if (!funding || !isAggregatedIra(funding)) continue
      if (creditedPremiumKeys.has(occurrence.producerOccurrenceKey)) continue
      fail('annuityStageRequired', 'An owned-IRA annuity premium requires the contract-value credit that received it', {
        taxYear,
        ownerPersonId: occurrence.ownerPersonId!,
        sourceAccountId: occurrence.sourceAccountId!,
        producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    // And the December 31 value the projection published must be the one this
    // chain arrived at, contract by contract, in exact cents. The opening was
    // taken on trust and bounded; everything that happened to it since was not.
    const settledContractValues = new Map<AccountId, UsdCents>()
    for (const { contract, ownerPersonId } of stagingContracts) {
      const contractAccountId = asAccountId(contract.id)
      const context = {
        taxYear, ownerPersonId, sourceAccountId: contract.id,
      }
      const closing = publishedContractClosings.get(contractAccountId)
      const chainRaw = contractRawValues.get(contractAccountId)
      const chainCents = contractValues.get(contractAccountId)
      if (closing === undefined || chainRaw === undefined ||
          chainCents === undefined || closing !== chainRaw ||
          cents(closing, 'Published annuity contract value', context) !== chainCents) {
        fail('postGrowthPoolInvalid', 'A published annuity contract value must exact-rejoin the replay’s own contract-value chain', context)
      }
      settledContractValues.set(contractAccountId, chainCents)
    }

    // A charitable gift reaches the published annual total by two routes that
    // are not interchangeable. Dollars routed out of an RMD move nothing extra
    // -- the RMD occurrence already explains that debit -- and they keep the
    // nonmoving overlay. Dollars taken with no RMD behind them physically leave
    // an owned IRA and must be explained the same way every other owned-IRA
    // debit is, by a `legacyQcd` occurrence with its own application.
    if (!Number.isFinite(yearResult.qcd) || yearResult.qcd < 0 ||
        Object.is(yearResult.qcd, -0)) {
      fail('sourceAmountInvalid', 'Published annual QCD total must be finite, nonnegative, and not negative zero', { taxYear })
    }
    cents(yearResult.qcd, 'Annual QCD total', { taxYear })
    const overlay = occurrenceSource.nonmovingLegacyQcdOverlay
    if (overlay !== null && (
      overlay.status !== 'nonmovingLegacyQcdCaptured' || overlay.kind !== 'legacyQcd' ||
      overlay.taxYear !== taxYear ||
      overlay.physicalMovement !== 'notAdditionalMovement' ||
      overlay.inventoryReplay !==
        'attributedToOwnedIraRequiredDistributionGrosses' ||
      !Array.isArray(overlay.ownerAttributions) ||
      overlay.ownerAttributions.length === 0 ||
      cents(overlay.grossAmountPlanDollars, 'QCD overlay amount', { taxYear }) <= 0)) {
      fail('sourceContractInvalid', 'A nonmoving QCD overlay must retain its exact captured contract, a positive amount, and its owner attribution', { taxYear })
    }
    // The published annual gift is now reached by two routes that are not
    // interchangeable, exactly as the conversion total is. The aggregate
    // strategy's sweep produces `legacyQcd` occurrences; the QCD executor's
    // committed requests produce `namedQcd` ones. So the named arm is bound to
    // the executor's own committed cents first, and the union to the published
    // total second -- reconciling only the union would let one kind absorb the
    // other's dollars.
    reconcilePublishedTotal(
      occurrenceSource.runtimeOccurrences,
      ['namedQcd'],
      ledgerCentsToPlanDollars(namedQcdCoverage.totalExecutedAmount),
      'named QCD',
      taxYear,
      accountOrder,
    )
    const movingQcd = occurrenceTotalInPlanOrder(
      occurrenceSource.runtimeOccurrences,
      ['legacyQcd', 'namedQcd'],
      'moving QCD',
      taxYear,
      accountOrder,
    )
    // The overlay is a summed component only when it exists. Counting it
    // unconditionally would widen the tolerance across the whole pre-RMD
    // window, which is exactly the case that has no overlay to count.
    if (!rawTotalsReconcile(
      (overlay?.grossAmountPlanDollars ?? 0) + movingQcd.total,
      yearResult.qcd,
      movingQcd.count + (overlay === null ? 0 : 1),
    )) {
      fail('sourceCoverageInvalid', 'The nonmoving QCD overlay plus every moving QCD occurrence must exact-rejoin the published annual QCD total', { taxYear })
    }
    // THE MOVING HALF IS NOT ALL A GIFT, and treating it as though it were is
    // how this replay used to overstate the basis it handed forward. IRC
    // 408(d)(8)(B)'s closing sentence treats a distribution as a qualified
    // charitable distribution "only to the extent that the distribution would be
    // includible in gross income", and (D) caps that at the owner's aggregate
    // includible amount. A draw past the cap never became a QCD, and the Form
    // 8606 line-7 instructions exclude "Qualified charitable distributions
    // (QCDs)" by name and nothing else -- so the unqualified part stays on line
    // 7 and inside the line-9 denominator, exactly as the annual ledger's own
    // pro-rata arm already treats it.
    //
    // Read from the year rather than re-derived. The ledger sized each draw
    // against the cap when it committed it, and its per-occurrence answer is
    // published with the year, so the two arms carry the same line-7 gross to
    // the cent rather than agreeing by reconstruction.
    const legacyQcdApplications = normalizedApplications
      .map((application, index) => ({ application, index }))
      .filter(({ application }) =>
        application.simulatorPhase === 'legacyQcdDistribution')
    const characterizations = occurrenceSource.legacyQcdCharacterizations
    if (!Array.isArray(characterizations) ||
        characterizations.length !== legacyQcdApplications.length) {
      fail('qcdStageRequired', 'Every moving QCD occurrence requires exactly one published qualification characterization', { taxYear })
    }
    {
      const characterizationByKey = new Map<string, number>()
      for (const characterization of characterizations) {
        const producerOccurrenceKey = characterization.producerOccurrenceKey
        const context = { taxYear, producerOccurrenceKey }
        const gross = characterization.grossAmountPlanDollars
        const nonQualified = characterization.nonQualifiedLine7GrossPlanDollars
        const occurrence = occurrenceByKey.get(producerOccurrenceKey)
        if (occurrence?.kind !== 'legacyQcd' ||
            occurrence.ownerPersonId !== characterization.ownerPersonId ||
            occurrence.grossAmountPlanDollars !== gross ||
            characterizationByKey.has(producerOccurrenceKey)) {
          fail('qcdReconciliationInvalid', 'A moving QCD characterization must bind one distinct legacyQcd occurrence at its exact gross', context)
        }
        if (!Number.isFinite(nonQualified) || nonQualified < 0 ||
            Object.is(nonQualified, -0) || nonQualified > gross) {
          fail('qcdReconciliationInvalid', 'A moving QCD characterization must keep its non-qualified remainder inside its own gross', context)
        }
        cents(nonQualified, 'Non-qualified moving QCD remainder', context)
        characterizationByKey.set(producerOccurrenceKey, nonQualified)
      }
      for (const { application, index } of legacyQcdApplications) {
        const nonQualified =
          characterizationByKey.get(application.producerOccurrenceKey)
        if (nonQualified === undefined) {
          fail('qcdStageRequired', 'Every moving QCD occurrence requires exactly one published qualification characterization', {
            taxYear, producerOccurrenceKey: application.producerOccurrenceKey,
          })
        }
        if (nonQualified <= 0) continue
        normalizedApplications[index] = {
          ...application,
          form8606Line: 'line7',
          form8606LineGrossAmount: cents(
            nonQualified,
            'Form 8606 line 7 gross of a non-qualified charitable draw',
            {
              taxYear,
              ownerPersonId: application.ownerPersonId,
              sourceAccountId: application.sourceAccountId,
              producerOccurrenceKey: application.producerOccurrenceKey,
            },
          ),
        }
      }
    }
    // The overlay's own dollars are allocated here. Which owner's required
    // distribution carried the gift decides whose Form 8606 line-7 gross must
    // shrink under 408(d)(8)(D), and the annual ledger settles that question
    // when it sizes the gift, so the overlay states the answer and this replay
    // reproduces it against the applications rather than re-deriving it. The
    // moving half above is read per occurrence instead, because it has one.
    if (overlay !== null) {
      const carveByOwner = new Map<string, number>()
      const attributedRouted: number[] = []
      for (const attribution of overlay.ownerAttributions) {
        const ownerPersonId = attribution.ownerPersonId
        const context = { taxYear, ownerPersonId }
        const routed = attribution.routedGrossPlanDollars
        const qualified = attribution.qualifiedLine7ExclusionPlanDollars
        // The owner must be a Plan person who actually holds an owned pool:
        // an attribution naming anyone else cannot describe a line-7 gross this
        // replay carries, and reducing nothing is not the same as reducing zero.
        if (!personIds.has(ownerPersonId) || !pools.has(ownerPersonId as PersonId) ||
            carveByOwner.has(ownerPersonId)) {
          fail('qcdStageRequired', 'Each routed-QCD attribution must name one distinct owner of a captured owned-IRA pool', context)
        }
        if (!Number.isFinite(routed) || routed <= 0 || !Number.isFinite(qualified) ||
            qualified < 0 || Object.is(qualified, -0) || qualified > routed) {
          fail('qcdReconciliationInvalid', 'A routed-QCD attribution must carry a positive routed gross and a qualified exclusion inside it', context)
        }
        cents(routed, 'Routed QCD attribution gross', context)
        cents(qualified, 'Routed QCD qualified exclusion', context)
        carveByOwner.set(ownerPersonId, qualified)
        attributedRouted.push(routed)
      }
      // The attribution is a partition of the overlay, not a commentary on it.
      if (!rawTotalsReconcile(
        summedPlanDollars(attributedRouted, 'Routed QCD attribution', { taxYear }),
        overlay.grossAmountPlanDollars,
        attributedRouted.length,
      )) {
        fail('qcdReconciliationInvalid', 'Routed-QCD owner attributions must exact-rejoin the nonmoving overlay gross', { taxYear })
      }
      // Carved greedily across the owner's required distributions in mutation
      // order, which is the order the annual ledger commits them in. The order
      // is what makes this reproduction rather than invention: the settlement
      // matches an effect only when its gross agrees to the cent, so a carve
      // spread differently would settle nothing even though the owner's total
      // basis recovery would be the same either way.
      for (let index = 0; index < normalizedApplications.length; index += 1) {
        const application = normalizedApplications[index]!
        if (application.simulatorPhase !== 'ownerRmdDistribution') continue
        const remainingCarve = carveByOwner.get(application.ownerPersonId) ?? 0
        if (remainingCarve <= 0) continue
        const context = {
          taxYear,
          ownerPersonId: application.ownerPersonId,
          sourceAccountId: application.sourceAccountId,
          producerOccurrenceKey: application.producerOccurrenceKey,
        }
        const grossPlanDollars = occurrenceByKey
          .get(application.producerOccurrenceKey)!.grossAmountPlanDollars
        const carve = Math.min(remainingCarve, grossPlanDollars)
        carveByOwner.set(application.ownerPersonId, remainingCarve - carve)
        const line7GrossPlanDollars = grossPlanDollars - carve
        normalizedApplications[index] = {
          ...application,
          form8606Line: line7GrossPlanDollars > 0 ? 'line7' : null,
          form8606LineGrossAmount: line7GrossPlanDollars > 0
            ? cents(line7GrossPlanDollars, 'Form 8606 line 7 gross net of the routed gift', context)
            : asUsdCents(0),
        }
      }
      // Nothing may be left over. 408(d)(8)(B) reaches only a distribution from
      // an individual retirement plan and Treas. Reg. 1.408-8(e)(2)(i)
      // aggregates only one individual's own IRAs, so a carve the owner's own
      // required distributions cannot absorb describes a gift that could not
      // have been routed. The tolerance is the same raw one the published
      // totals reconcile under, and nothing wider: a material residue is a
      // disagreement between the ledger and this replay, not a rounding artefact.
      for (const [ownerPersonId, remainingCarve] of carveByOwner) {
        if (remainingCarve <= MAX_RAW_RECONCILIATION_TOLERANCE_DOLLARS) continue
        fail('qcdReconciliationInvalid', 'A routed-QCD carve must be absorbed by the owner’s own required distributions', {
          taxYear, ownerPersonId,
        })
      }
    }

    const aggregate = aggregateRothCredits(
      plan, taxYear, occurrenceSource.runtimeOccurrences,
      applicationSource.applications, normalizedApplications, accountOrder,
    )
    const namedCredits = namedRothDestinationCredits(
      plan, taxYear, occurrenceSource.runtimeOccurrences,
      applicationSource.applications, normalizedApplications,
      namedConversionCoverage, accountOrder,
    )
    const ownerSources = expectedOwners.map((owner) => {
      const applications = normalizedApplications.filter((entry) => entry.ownerPersonId === owner)
      const yearEndBalances = ownerBalances.get(owner)!
      const annuityContractValues = stagingContracts
        .filter((entry) => entry.ownerPersonId === owner)
        .map(({ contract, funding }) => {
          const contractAccountId = asAccountId(contract.id)
          return {
            annuityAccountId: contractAccountId,
            fundingAccountId: asAccountId(funding.id),
            contractValuePlanDollars: contractRawValues.get(contractAccountId)!,
            contractValueAmount: settledContractValues.get(contractAccountId)!,
          }
        })
      const annuityContractValueAmount = asUsdCents(
        annuityContractValues.reduce(
          (sum, entry) => sum + entry.contractValueAmount, 0,
        ),
      )
      const withoutId = {
        ownerPersonId: owner,
        taxYear,
        applications,
        yearEndBalances,
        annuityContractValues,
        annuityContractValueAmount,
      }
      return deepFreeze({
        ...withoutId,
        sourceChainEvidenceId: deriveActionStructuralId(
          'projection-owned-ira-runtime-source-chain',
          [plan.id, withoutId],
        ),
      })
    })
    const withoutId = {
      taxYear,
      ownerSources,
      aggregateRothDestinationCredits: aggregate,
      namedRothDestinationCredits: namedCredits,
    }
    normalizedYears.push(deepFreeze({
      ...withoutId,
      evidenceId: deriveActionStructuralId('projection-owned-ira-runtime-source-year', [plan.id, withoutId]),
    }))
    openingBalances = postGrowthBalances
    openingRawBalances = postGrowthRawBalances
    openingPhysicalRawBalances = postGrowthPhysicalRawBalances
    openingContractRawValues = contractRawValues
  }

  const withoutId = {
    status: 'ownedNonRothIraRuntimeSourceSeriesComplete' as const,
    evidenceScope: 'projectionModelOnlyNotRealWorldFilingCompleteness' as const,
    movement: 'notCommitted' as const,
    actionability: 'notEstablished' as const,
    projectionStartTaxYear,
    endTaxYear: years.at(-1)!.year,
    years: normalizedYears,
  }
  return deepFreeze({
    ...withoutId,
    evidenceId: deriveActionStructuralId('projection-owned-ira-runtime-source-series', [plan.id, withoutId]),
    issues: [],
  })
}

/** Validate and normalize only simulator-owned sources; derive no tax basis. */
export function validateOwnedNonRothIraRuntimeSourceSeries(
  plan: Plan,
  projectionStartTaxYear: number,
  years: readonly Readonly<YearResult>[],
): Readonly<OwnedNonRothIraRuntimeSourceSeriesResult> {
  try {
    return validateUnchecked(plan, projectionStartTaxYear, years)
  } catch (error) {
    if (error instanceof SourceSeriesFailure) return blocked(error.issue, projectionStartTaxYear)
    return blocked({
      kind: 'sourceSeriesConstructionInvalid',
      detail: `Runtime source validation failed closed: ${safeDetail(error)}`,
    }, projectionStartTaxYear)
  }
}
