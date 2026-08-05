import { asAccountId, type AccountId, type PersonId } from '../actions/identity.js'
import type { UsdCents } from '../actions/money.js'
import { ledgerCentsToPlanDollars, planDollarsToLedgerCents } from '../actions/planBalanceAdapter.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from '../actions/structuralId.js'
import { planSchema, type Account, type Plan } from '../model/plan.js'
import { isAggregatedIra } from '../strategies/accountEligibility.js'
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
}

export interface NormalizedOwnedNonRothIraYearEndBalance {
  readonly sourceAccountId: AccountId
  readonly balancePlanDollars: number
  readonly balanceAmount: UsdCents
}

export interface NormalizedOwnedNonRothIraOwnerYearSource {
  readonly ownerPersonId: PersonId
  readonly taxYear: number
  readonly applications: readonly Readonly<NormalizedOwnedNonRothIraApplication>[]
  readonly yearEndBalances: readonly Readonly<NormalizedOwnedNonRothIraYearEndBalance>[]
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
  const declaredOwnedIraSource = plan.strategies.retirementActions
    .filter((request) => request.year === taxYear)
    .flatMap((request) => {
      // Neither a named conversion nor a named QCD is on this list any more,
      // for two different reasons. A conversion's owned-IRA movement this
      // replay can explain: it publishes a `namedRothConversion` occurrence
      // with its own application, and `requireNamedRothConversionCoverage`
      // below binds every one of those to committed executor evidence in
      // exact cents. A named QCD has no committed executor evidence to bind
      // to -- no stage in its chain has a `committed: true` arm -- so
      // `requireNamedQcdCoverage` refuses every occurrence instead, which
      // leaves a declared gift with nowhere to move dollars from rather than
      // blocking the whole year for declaring one. An ordinary withdrawal
      // still moves dollars nothing accounts for, so it still blocks.
      if (request.kind === 'ordinaryWithdrawal') return request.allocations
      return []
    })
    .map((allocation) => String(allocation.sourceAccountId))
    .find((accountId) => {
      const account = accountById.get(accountId)
      return account !== undefined && isAggregatedIra(account)
    })
  if (declaredOwnedIraSource !== undefined) {
    fail('exactActionStageRequired', 'A Plan-declared exact action from an owned IRA requires the later identity and tax-characterization stage before source replay', {
      taxYear, sourceAccountId: declaredOwnedIraSource,
    })
  }

  const execution = yearResult.retirementActionExecution
  if (execution === undefined) return
  const executionEvidence = execution.evidence
  const executionBalances = execution.balances
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

/**
 * Refuse every `namedQcd` occurrence, and say in the diagnostic why one cannot
 * exist rather than merely that this year has none.
 *
 * The conversion coverage above can weigh an occurrence against committed cents
 * because `rothConversionActionExecution` has a `committed: true` arm. No stage
 * of the named QCD chain has one: the physical staging, the tax-character post
 * pass, the derived character, the unified transaction finalization, and the
 * action-execution evidence all type `committed` as the literal `false` and
 * `movement` as `'notCommitted'`, and the QCD executor's own published record
 * forces `executedAmount` to zero with a null execution date. So there is no
 * evidence a named QCD occurrence could rejoin, which makes an occurrence not
 * weak evidence but a claim the chain has no way to have made. Admitting one
 * would let a forged occurrence explain an owned-IRA debit nothing authorised,
 * and the year's balance chain would close on the forgery.
 *
 * The rejection is the whole coverage check, not a placeholder standing in for
 * one. The slice that settles a gift's tax character is what supplies committed
 * per-allocation cents, and it replaces this with the two-way binding the
 * conversion arm performs -- every occurrence to one committed allocation, and
 * every committed allocation to one occurrence.
 */
function requireNamedQcdCoverage(
  occurrences: readonly Readonly<SimulatorAnnualRetirementRuntimeOccurrence>[],
  taxYear: number,
): void {
  const named = occurrences.find((entry) => entry.kind === 'namedQcd')
  if (named === undefined) return
  fail('namedQcdInvalid', 'A named QCD occurrence requires committed charitable-distribution evidence, and no annual QCD stage can commit any', {
    taxYear, producerOccurrenceKey: named.producerOccurrenceKey,
  })
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

function ownedPools(plan: Plan): Map<PersonId, Extract<Account, { type: 'traditional' }>[]> {
  const pools = new Map<PersonId, Extract<Account, { type: 'traditional' }>[]>()
  for (const account of plan.accounts) {
    if (!isAggregatedIra(account)) continue
    const owner = account.ownerPersonId as PersonId
    pools.set(owner, [...(pools.get(owner) ?? []), account])
  }
  return new Map([...pools]
    .sort(([left], [right]) => compareUtf16CodeUnits(left, right))
    .map(([owner, accounts]) => [owner, accounts.sort((left, right) =>
      compareUtf16CodeUnits(left.id, right.id))]))
}

function applicationShape(
  kind: SimulatorAnnualRetirementRuntimeOccurrence['kind'],
): ApplicationShape | null {
  switch (kind) {
    case 'annuityFundingTransfer':
      return { applicationKind: 'debit', simulatorPhase: 'annuityPurchaseFunding', form8606Line: null }
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
      // arm's freedom to assume it. A null line is unconditionally right only
      // up to the donor's aggregate otherwise-includible balance; a gift past
      // that point leaves a charitable remainder that is not a QCD, is basis,
      // and does belong on a line. Only the pool-capacity stage can say which
      // case a given gift is in, and no stage of the named QCD chain has a
      // committed arm yet -- so `requireNamedQcdCoverage` above refuses every
      // named occurrence outright and this shape is unreachable from a live
      // annual pass. Registered as `irc-408-d-8-D-qcd-taxable-first`.
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
    case 'pensionLumpSumRollover': return 1
    case 'employeeContribution': return 2
    case 'ownerRmdDistribution': return 3
    case 'automaticSeppDistribution': return 4
    // The simulator computes the charitable gift once the forced distributions
    // are known and before any conversion or need-based withdrawal is sized.
    case 'legacyQcdDistribution': return 5
    // A named gift sits beside the aggregate one and ahead of every
    // conversion. IRC 408(d)(8)(B) lets a charitable distribution be one of
    // the distributions that satisfies the year's required minimum, so it
    // belongs after the forced distributions it may count against and before
    // the conversions, which Treas. Reg. 1.408A-4 A-6(b) forbids from
    // absorbing an RMD at all.
    case 'namedQcdDistribution': return 6
    // The exact-cent executor runs after the year's forced distributions and
    // before the aggregate strategy sizes anything, which is what Treas. Reg.
    // 1.408A-4 A-6(b) requires of the RMD and what leaves the aggregate
    // sweep looking at balances the named request has already reduced.
    case 'namedRothConversionDebit': return 7
    case 'namedRothConversionDestinationCredit': return 8
    case 'legacyRothConversion': return 9
    case 'legacyRothConversionAggregateDestinationCredit': return 10
    case 'legacyNeedBasedWithdrawal': return 11
  }
}

function sourceCompatible(
  occurrence: Readonly<SimulatorAnnualRetirementRuntimeOccurrence>,
  account: Account,
): boolean {
  if (account.type !== 'traditional') return false
  switch (occurrence.kind) {
    case 'ownedIraRmd':
    case 'ownedIraContribution':
    case 'ownedIraEmployerContribution': return isAggregatedIra(account)
    case 'employerPlanRmd':
    case 'employerPlanEmployeeContribution':
    case 'employerPlanEmployerMatch': return account.kind === 'employer' && account.inherited === undefined
    case 'inheritedIraRmd': return account.inherited !== undefined
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
    'ownedIraContribution', 'ownedIraEmployerContribution',
    'employerPlanEmployeeContribution', 'employerPlanEmployerMatch',
  ])
  if (simpleKinds.has(occurrence.kind)) {
    if (key.length !== 2 || key[0] !== occurrence.kind || key[1] !== sourceId) {
      fail('sourceIdentityInvalid', 'Runtime producer key must exact-bind its kind and source account', {
        taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
      })
    }
    return sourceId!
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
  const ordered = plan.accounts.flatMap((account) => {
    const occurrence = bySource.get(account.id)
    return occurrence === undefined ? [] : [occurrence]
  })
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
  const accountOrder = new Map(plan.accounts.map((account, index) => [account.id, index]))
  const pools = ownedPools(plan)
  const ownedAccounts = [...pools.values()].flat()
  const ownedAccountIds = new Set<string>()
  for (const account of ownedAccounts) {
    if (ownedAccountIds.has(account.id)) {
      fail(
        'sourceIdentityInvalid',
        'Owned non-Roth IRA account IDs must be unique before source replay',
        { sourceAccountId: account.id },
      )
    }
    ownedAccountIds.add(account.id)
  }
  const personIds = new Set(plan.household.people.map((person) => person.id))
  let openingBalances = new Map<AccountId, UsdCents>(ownedAccounts.map((account) => [
    asAccountId(account.id), cents(account.balance, 'Plan opening IRA balance', { sourceAccountId: account.id }),
  ]))
  let openingRawBalances = new Map<AccountId, number>(ownedAccounts.map((account) => [
    asAccountId(account.id), account.balance,
  ]))
  const normalizedYears: NormalizedOwnedNonRothIraRuntimeSourceYear[] = []

  for (const yearResult of years) {
    const taxYear = yearResult.year
    const occurrenceSource = yearResult.retirementRuntimeSource
    const applicationSource = yearResult.retirementRuntimeApplicationSource
    const balanceSource = yearResult.ownedNonRothIraPostGrowthSource
    const publishedBalancesBeforeGrowth =
      yearResult.ownedNonRothIraBalancesBeforeGrowth
    if (!occurrenceSource || !applicationSource || !balanceSource ||
        !publishedBalancesBeforeGrowth ||
        typeof publishedBalancesBeforeGrowth !== 'object' ||
        Array.isArray(publishedBalancesBeforeGrowth)) {
      fail('sourceMissing', 'Each year requires occurrences, applications, pre-growth balances, and post-growth balances', { taxYear })
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
      if (!account || account.ownerPersonId !== occurrence.ownerPersonId || !sourceCompatible(occurrence, account)) {
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
    const reconstructedTraditionalWithdrawal =
      ((legacyNeedBasedWithdrawalTotal.total + yearResult.rmd) + yearResult.sepp) +
      yearResult.inheritedDistribution
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
      fail('sourceCoverageInvalid', 'Legacy need-based withdrawal occurrences plus RMD, SEPP, and inherited totals must exact-rejoin published traditional withdrawals', {
        taxYear,
      })
    }

    requireNoExactActionOwnedIraMovement(
      plan, yearResult, accountById, taxYear,
    )
    // Beside the guard above, and before the application chain rather than
    // beside the QCD reconciliation below, because these two decide the same
    // question: which exact actions this replay will let move owned-IRA
    // dollars. A named gift is refused here, so no application referring to
    // one ever reaches the balance chain.
    requireNamedQcdCoverage(occurrenceSource.runtimeOccurrences, taxYear)

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
    }

    const expectedOwners = [...pools.keys()]
    if (balanceSource.ownerPools.length !== expectedOwners.length) {
      fail('postGrowthPoolInvalid', 'Post-growth source must contain every and only complete owned-IRA pool', { taxYear })
    }
    const postGrowthBalances = new Map<AccountId, UsdCents>()
    const postGrowthRawBalances = new Map<AccountId, number>()
    const preGrowthBalances = new Map<AccountId, UsdCents>()
    const preGrowthRawBalances = new Map<AccountId, number>()
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
    for (let ownerIndex = 0; ownerIndex < expectedOwners.length; ownerIndex += 1) {
      const owner = expectedOwners[ownerIndex]!
      const rawPool = balanceSource.ownerPools[ownerIndex]!
      const accounts = pools.get(owner)!
      if (rawPool.ownerPersonId !== owner || rawPool.accountBalances.length !== accounts.length) {
        fail('postGrowthPoolInvalid', 'Post-growth pools must retain canonical owner order and membership', { taxYear, ownerPersonId: owner })
      }
      const normalizedBalances = rawPool.accountBalances.map((raw, accountIndex) => {
        const account = accounts[accountIndex]!
        const rawSourceAccountId = raw.sourceAccountId
        const rawBalancePlanDollars = raw.balancePlanDollars
        if (rawSourceAccountId !== account.id) {
          fail('postGrowthPoolInvalid', 'Post-growth balances must retain canonical account order including zero siblings', {
            taxYear, ownerPersonId: owner, sourceAccountId: rawSourceAccountId,
          })
        }
        const publishedBalancePlanDollars = publishedBalances[account.id]
        if (!Object.hasOwn(publishedBalances, account.id) ||
            publishedBalancePlanDollars !== rawBalancePlanDollars) {
          fail('postGrowthPoolInvalid', 'Post-growth balances must exact-rejoin the published account balance', {
            taxYear, ownerPersonId: owner, sourceAccountId: rawSourceAccountId,
          })
        }
        const sourceAccountId = asAccountId(account.id)
        const balanceAmount = cents(rawBalancePlanDollars, 'Post-growth IRA balance', {
          taxYear, ownerPersonId: owner, sourceAccountId,
        })
        postGrowthBalances.set(sourceAccountId, balanceAmount)
        postGrowthRawBalances.set(sourceAccountId, rawBalancePlanDollars)
        return { sourceAccountId, balancePlanDollars: rawBalancePlanDollars, balanceAmount }
      })
      ownerBalances.set(owner, normalizedBalances)
    }

    const normalizedApplications: NormalizedOwnedNonRothIraApplication[] = []
    const appliedKeys = new Set<string>()
    let priorPhase = -1
    let priorPhaseAccountOrder = -1
    for (let index = 0; index < applicationSource.applications.length; index += 1) {
      const application = applicationSource.applications[index]!
      const currentPhase = phaseRank(application)
      if (application.mutationOrdinal !== index + 1 || currentPhase < priorPhase) {
        fail('applicationOrderInvalid', 'Applications must retain contiguous ordinals and annual phase order', { taxYear })
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
      const shape = applicationShape(occurrence.kind)
      const account = accountById.get(occurrence.sourceAccountId!)
      if (!shape || !account || !isAggregatedIra(account) ||
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
      const before = cents(application.sourceBalanceBeforePlanDollars, 'Application opening balance', context)
      const after = cents(application.sourceBalanceAfterPlanDollars, 'Application closing balance', context)
      const occurrenceAmount = cents(occurrence.grossAmountPlanDollars, 'Occurrence amount', context)
      const sourceAccountId = asAccountId(occurrence.sourceAccountId!)
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
          openingRawBalances.get(sourceAccountId) !==
            application.sourceBalanceBeforePlanDollars ||
          openingBalances.get(sourceAccountId) !== before ||
          sourceBalanceRoundingResidual < -2n ||
          sourceBalanceRoundingResidual > 2n) {
        fail('balanceChainInvalid', 'Application must continue the exact per-account before/amount/after chain', context)
      }
      openingBalances.set(sourceAccountId, after)
      openingRawBalances.set(
        sourceAccountId,
        application.sourceBalanceAfterPlanDollars,
      )
      if (occurrence.kind === 'annuityFundingTransfer') {
        fail('annuityStageRequired', 'Annuity funding leaves the captured owned-IRA pool and requires a broader transfer stage', context)
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
      })
    }
    for (const occurrence of occurrenceSource.runtimeOccurrences) {
      const account = accountById.get(occurrence.sourceAccountId!)
      if (account && isAggregatedIra(account) && !appliedKeys.has(occurrence.producerOccurrenceKey)) {
        fail('sourceCoverageInvalid', 'Every owned-IRA occurrence must have one supported application', {
          taxYear, producerOccurrenceKey: occurrence.producerOccurrenceKey,
        })
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
      overlay.taxYear !== taxYear || overlay.ownerPersonId !== null || overlay.sourceAccountId !== null ||
      overlay.physicalMovement !== 'notAdditionalMovement' ||
      overlay.inventoryReplay !== 'requiresSeparateQcdCharacterizationStage' ||
      cents(overlay.grossAmountPlanDollars, 'QCD overlay amount', { taxYear }) <= 0)) {
      fail('sourceContractInvalid', 'A nonmoving QCD overlay must retain its exact captured contract and a positive amount', { taxYear })
    }
    // `namedQcd` is summed here even though `requireNamedQcdCoverage` above has
    // already refused every one of them, so this total is provably zero today.
    // Leaving the kind out would make the reconciliation kind-partial: the day
    // a named gift moves, its dollars would be in the published annual figure
    // and absent from the total it is checked against, and the year would fail
    // for the wrong reason or -- if the published figure were also missed --
    // not at all.
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
    // The overlay's own dollars remain unallocated. Which owner's RMD carried
    // the gift decides whose line-7 gross must shrink under 408(d)(8)(D), and
    // one household scalar cannot answer that, so a routed gift still requires
    // the separate characterization stage. A gift that moved on its own does
    // not: its source account is named by its occurrence.
    if (overlay !== null) {
      fail('qcdStageRequired', 'A QCD routed out of an RMD debit cannot be source-allocated from a household scalar', { taxYear })
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
      const withoutId = { ownerPersonId: owner, taxYear, applications, yearEndBalances }
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
