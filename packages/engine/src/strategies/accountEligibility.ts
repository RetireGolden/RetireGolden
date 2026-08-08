/**
 * Account eligibility service (account/HSA/fixed-asset depth plan, step 1).
 *
 * One pure module answering, per account (and where relevant, per year/owner):
 * can it accept contributions? can it be converted to Roth? does it follow the
 * owner's own RMDs? is its balance spendable this year? and what early-
 * withdrawal penalty rate applies? The ledger (`projection/simulate.ts`), the
 * optimizer input builder (`projection/optimizePlan.ts`), and the decision
 * engine (`decisions/*`) all consume these helpers, so every recommended
 * account movement is explainable by a rule that exists in exactly one place —
 * the roadmap §7 acceptance criterion.
 *
 * Rules encoded here (each documented in DOCS/domain/domain-rules-reference.md):
 * - Inherited traditional accounts (SECURE Act 10-year rule) cannot receive
 *   contributions, cannot be converted to Roth, are exempt from the owner's
 *   Uniform-Lifetime RMDs (they follow their own forced-distribution schedule),
 *   and are never subject to the 10% early-withdrawal penalty.
 * - Cliff-vesting equity compensation is not spendable before its vest year.
 * - Traditional withdrawals before 59½ (approximated as age < 60) carry a 10%
 *   penalty unless the Rule of 55 applies (employer plan, separation in/after
 *   the year the owner turned 55, approximated by the owner's retirement age).
 *   72(t) SEPP and inherited distributions are taken outside the need-based
 *   flow and are penalty-free by construction.
 * - HSA non-qualified withdrawals before 65 carry a 20% penalty; from 65 on
 *   they are penalty-free (ordinary income only).
 */

import type {
  LegacyAggregateRetirementActionRequest,
  QualifiedCharitableDistributionRequest,
  RetirementActionRequest,
  RothConversionRequest,
  SourceAllocationRequest,
} from '../actions/contract.js'
import {
  asAccountId,
  asPersonId,
  type AccountId,
  type ActionId,
  type PersonId,
} from '../actions/identity.js'
import type { UsdCents } from '../actions/money.js'
import {
  addCalendarMonths,
  formatCivilDate,
  parseCivilIsoDate,
} from '../actions/civilDate.js'
import {
  createActionReason,
  type ActionReason,
  type BlockingActionReasonCode,
  type RefusedActionReasonCode,
  type TaxTreatmentAdjustmentReasonCode,
  type UnsupportedActionReasonCode,
} from '../actions/reasons.js'
import type { Account, Person, Plan } from '../model/plan.js'

export type TraditionalAccount = Extract<Account, { type: 'traditional' }>
export type EquityCompAccount = Extract<Account, { type: 'equityComp' }>

/**
 * Evaluator-facing IRA facts. Plan v3 can supply the durable classification
 * and year-bound activity records through the request adapter below; the
 * evaluator contract stays explicit so missing evidence remains fail-closed.
 */
export type NonpersistedIraEligibilityFact =
  | Readonly<{
      sourceAccountId: AccountId
      subtype: 'traditional'
      qcdActivity: Readonly<{ kind: 'notApplicable' }>
    }>
  | Readonly<{
      sourceAccountId: AccountId
      subtype: 'sep'
      qcdActivity?: Readonly<{
        kind: 'employerContribution'
        actionTaxYear: number
        planYearEndDate: string
        employerContributionMadeForPlanYear: boolean
        evidenceId: string
      }>
    }>
  | Readonly<{
      sourceAccountId: AccountId
      subtype: 'simple'
      simpleParticipationStartDate?: string
      qcdActivity?: Readonly<{
        kind: 'employerContribution'
        actionTaxYear: number
        planYearEndDate: string
        employerContributionMadeForPlanYear: boolean
        evidenceId: string
      }>
    }>

export interface NonpersistedQcdContributionYearFact {
  taxYear: number
  /** Deductible IRA contributions for a tax year ending on/after age 70½. */
  deductibleContributionAmount: UsdCents
}

export interface NonpersistedQcdContributionHistoryFact {
  donorPersonId: PersonId
  /**
   * One entry for every tax year from the donor's 70½ threshold year through
   * the action year, including explicit zero-dollar years.
   */
  taxYears: readonly NonpersistedQcdContributionYearFact[]
  /** Offset already consumed by earlier donor-specific QCDs. */
  priorOffsetApplied: UsdCents
}

export interface NonpersistedActionPersonAliveEvidence {
  evidenceId: string
  actionId: ActionId
  personId: PersonId
  actionYear: number
  /** Exact submitted execution date, or null when the request has no date. */
  actionDate: string | null
  alive: boolean
}

export interface NonpersistedPriorQcdOffsetEvidence {
  evidenceId: string
  actionId: ActionId
  donorPersonId: PersonId
  actionYear: number
  /** Exact submitted execution date, or null when the request has no date. */
  actionDate: string | null
  /** Donor-specific deductible-contribution offset consumed by earlier QCDs. */
  priorOffsetApplied: UsdCents
}

/**
 * One action's binding to the owner's aggregated-IRA RMD outcome for the year.
 *
 * Treas. Reg. 1.408-8(e)(1)(i) calculates the amount separately for each IRA
 * but requires only "the sum of those separately calculated required minimum
 * distributions" to come out, from any one or more of them; (e)(2)(i)
 * aggregates only the IRAs the individual holds as owner. `requiredAmount` is
 * that sum and `distributedAmount` is what the owner's aggregated IRAs
 * actually distributed against it — an employer plan or an inherited IRA is
 * outside the aggregation and contributes to neither figure.
 *
 * Position in a simulator's year loop is not evidence of any of this, which is
 * why the outcome is carried explicitly and keyed to the action it authorises.
 */
export interface NonpersistedOwnerIraRmdSatisfactionEvidence {
  evidenceId: string
  actionId: ActionId
  personId: PersonId
  actionYear: number
  /** Exact submitted execution date, or null when the request has no date. */
  actionDate: string | null
  /** The owner's separately calculated aggregated-IRA RMD sum for the year. */
  requiredAmount: UsdCents
  /** How much of that sum the owner's aggregated IRAs distributed. */
  distributedAmount: UsdCents
}

/**
 * One action's binding to the owner's aggregated-IRA nondeductible basis at
 * the moment the conversion would execute.
 *
 * IRC 408(d)(2) treats all of an individual's non-Roth IRAs as one contract
 * and all distributions in the year as one distribution, so the Form 8606
 * pro-rata numerator is a single owner-wide figure and not an account-level
 * one. `basisAmount` is that numerator. A zero figure is the only one whose
 * consequence needs no allocation — 408A(d)(3) then makes the entire converted
 * gross includible, with nothing to apportion between this conversion and the
 * year's other distributions — but a positive figure is just as much an answer
 * here, and what it establishes is that the numerator is known rather than
 * that the character can be derived on the spot.
 */
export interface NonpersistedOwnerAggregatedIraBasisEvidence {
  evidenceId: string
  actionId: ActionId
  personId: PersonId
  actionYear: number
  /** Exact submitted execution date, or null when the request has no date. */
  actionDate: string | null
  /** The owner's aggregated non-Roth IRA nondeductible basis, in cents. */
  basisAmount: UsdCents
}

export interface RetirementActionEligibilityRuntimeEvidence {
  personAliveEvidence?: readonly NonpersistedActionPersonAliveEvidence[]
  priorQcdOffsetEvidence?: readonly NonpersistedPriorQcdOffsetEvidence[]
  ownerIraRmdSatisfactionEvidence?:
    readonly NonpersistedOwnerIraRmdSatisfactionEvidence[]
  ownerAggregatedIraBasisEvidence?:
    readonly NonpersistedOwnerAggregatedIraBasisEvidence[]
}

/**
 * What the bound evidence proves about the owner's aggregated-IRA basis
 * numerator: that it is zero, that it is a specific positive figure, or
 * nothing at all.
 *
 * `nonzeroBasis` is a distinct answer from `unproven`, and the distinction is
 * the point of the three-way shape. Both are answers a conversion executor may
 * act on differently: a known numerator — zero or positive — settles what the
 * movement is, while `unproven` leaves the executor unable to say even that.
 * A positive numerator still cannot be apportioned at a mid-year call site; it
 * has to be allocated across the complete Form 8606 line-7 and line-8 gross,
 * which is why a consumer that commits on a positive numerator must publish a
 * null character rather than approximate one.
 */
export type OwnerAggregatedIraBasisResolution =
  | Readonly<{ status: 'zeroBasis'; evidenceId: string }>
  | Readonly<{ status: 'nonzeroBasis'; evidenceId: string }>
  | Readonly<{ status: 'unproven' }>

/**
 * Whether the owner's aggregated IRA RMD sum had been distributed when this
 * conversion would execute — the predicate Treas. Reg. 1.408A-4 A-6(b) turns
 * on, since it bars a conversion "to the extent that" the required minimum
 * distribution for the year has not been distributed.
 *
 * `unproven` is not a synonym for `unsatisfied`; it is the absence of the
 * evidence. Both block, and only `satisfied` clears — evidence that is
 * missing, duplicated, unbound, or malformed can never read as satisfaction.
 */
export type OwnerIraRmdSatisfaction = 'satisfied' | 'unsatisfied' | 'unproven'

function isNonnegativeCentAmount(value: unknown): value is UsdCents {
  return typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    !Object.is(value, -0)
}

/**
 * Bind the owner IRA-RMD-satisfaction channel to one conversion request. A sum
 * of zero is satisfied by distributing nothing: the regulation requires the
 * sum to be distributed, and a sum of zero already has been.
 */
export function resolveOwnerIraRmdSatisfaction(
  request: RothConversionRequest,
  runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {},
): OwnerIraRmdSatisfaction {
  const evidence = uniqueIndex(
    runtimeEvidence.ownerIraRmdSatisfactionEvidence ?? [],
    (entry) => entry.actionId,
  ).get(request.actionId)
  if (
    evidence == null ||
    typeof evidence.evidenceId !== 'string' ||
    evidence.evidenceId.trim().length === 0 ||
    evidence.personId !== request.personId ||
    !Number.isSafeInteger(evidence.actionYear) ||
    evidence.actionYear !== request.year ||
    evidence.actionDate !== (request.executionDate ?? null) ||
    !isNonnegativeCentAmount(evidence.requiredAmount) ||
    !isNonnegativeCentAmount(evidence.distributedAmount)
  ) {
    return 'unproven'
  }
  return evidence.distributedAmount >= evidence.requiredAmount
    ? 'satisfied'
    : 'unsatisfied'
}

/**
 * The identifier of the RMD-satisfaction evidence a conversion actually
 * relied on, so a committed allocation can cite it rather than assert it.
 */
export function resolveOwnerIraRmdSatisfactionEvidenceId(
  request: RothConversionRequest,
  runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {},
): string | null {
  if (resolveOwnerIraRmdSatisfaction(request, runtimeEvidence) !== 'satisfied') {
    return null
  }
  const evidence = uniqueIndex(
    runtimeEvidence.ownerIraRmdSatisfactionEvidence ?? [],
    (entry) => entry.actionId,
  ).get(request.actionId)
  return evidence?.evidenceId ?? null
}

/**
 * Bind the owner aggregated-IRA basis channel to one conversion request.
 *
 * Fails closed on everything it cannot confirm, for the same reason the RMD
 * channel does: absent, duplicated, unbound, or malformed evidence is not a
 * zero numerator, and reading it as one would silently convert a basis-bearing
 * IRA as if it were wholly pre-tax.
 */
export function resolveOwnerAggregatedIraBasis(
  request: RothConversionRequest,
  runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {},
): OwnerAggregatedIraBasisResolution {
  const evidence = uniqueIndex(
    runtimeEvidence.ownerAggregatedIraBasisEvidence ?? [],
    (entry) => entry.actionId,
  ).get(request.actionId)
  if (
    evidence == null ||
    typeof evidence.evidenceId !== 'string' ||
    evidence.evidenceId.trim().length === 0 ||
    evidence.personId !== request.personId ||
    !Number.isSafeInteger(evidence.actionYear) ||
    evidence.actionYear !== request.year ||
    evidence.actionDate !== (request.executionDate ?? null) ||
    !isNonnegativeCentAmount(evidence.basisAmount)
  ) {
    return { status: 'unproven' }
  }
  return evidence.basisAmount === 0
    ? { status: 'zeroBasis', evidenceId: evidence.evidenceId }
    : { status: 'nonzeroBasis', evidenceId: evidence.evidenceId }
}

export interface NonpersistedRetirementActionEligibilityContext {
  personAliveEvidence?: readonly NonpersistedActionPersonAliveEvidence[]
  iraFacts?: readonly NonpersistedIraEligibilityFact[]
  qcdContributionHistories?: readonly NonpersistedQcdContributionHistoryFact[]
}

export interface RetirementActionEligibilityPlan {
  people: readonly Person[]
  accounts: readonly Account[]
}

export type AcceptedActionEligibilityDecision = Readonly<{
  status: 'accepted'
  reasons: readonly ActionReason<TaxTreatmentAdjustmentReasonCode>[]
}>

export type RefusedActionEligibilityDecision = Readonly<{
  status: 'refused'
  reasons: readonly [
    ActionReason<RefusedActionReasonCode>,
    ...ActionReason<RefusedActionReasonCode>[],
  ]
}>

export type UnsupportedActionEligibilityDecision = Readonly<{
  status: 'unsupported'
  reasons: readonly [
    ActionReason<UnsupportedActionReasonCode>,
    ...ActionReason<BlockingActionReasonCode>[],
  ]
}>

/**
 * A physical/legal preflight only. An accepted result does not move money,
 * derive tax character, prove conversion-funding sufficiency/fixed-point
 * predicates, prove plan availability, or make an action implementation-ready
 * for the exact ledger. WS2 emits no QCD adjustment diagnostics.
 */
export type RetirementActionEligibilityDecision =
  | AcceptedActionEligibilityDecision
  | RefusedActionEligibilityDecision
  | UnsupportedActionEligibilityDecision

export {
  addCalendarMonths,
  parseCivilIsoDate,
  type CivilDate,
} from '../actions/civilDate.js'

function compareCivilIsoDates(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function uniqueIndex<T>(
  values: readonly T[],
  id: (value: T) => string,
): ReadonlyMap<string, T | null> {
  const result = new Map<string, T | null>()
  for (const value of values) {
    const key = id(value)
    result.set(key, result.has(key) ? null : value)
  }
  return result
}

function reasonKey(reason: ActionReason): string {
  return JSON.stringify([
    reason.code,
    reason.personId ?? null,
    reason.accountId ?? null,
    reason.allocationId ?? null,
  ])
}

function compareUtf16CodeUnits(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0
}

function sortedAllocations(
  allocations: readonly SourceAllocationRequest[],
): SourceAllocationRequest[] {
  return [...allocations].sort(
    (left, right) =>
      compareUtf16CodeUnits(left.allocationId, right.allocationId) ||
      compareUtf16CodeUnits(left.sourceAccountId, right.sourceAccountId),
  )
}

function canonicalDecision(reasons: readonly ActionReason[]): RetirementActionEligibilityDecision {
  const deduplicated = [...new Map(reasons.map((reason) => [reasonKey(reason), reason])).values()]
  const unsupported = deduplicated.filter(
    (reason): reason is ActionReason<UnsupportedActionReasonCode> =>
      reason.outcome === 'unsupported',
  )
  const refused = deduplicated.filter(
    (reason): reason is ActionReason<RefusedActionReasonCode> => reason.outcome === 'refused',
  )
  const adjusted = deduplicated.filter(
    (reason): reason is ActionReason<TaxTreatmentAdjustmentReasonCode> =>
      reason.outcome === 'adjusted',
  )
  if (unsupported.length > 0) {
    return {
      status: 'unsupported',
      reasons: [
        unsupported[0],
        ...unsupported.slice(1),
        ...refused,
      ] as UnsupportedActionEligibilityDecision['reasons'],
    }
  }
  if (refused.length > 0) {
    return {
      status: 'refused',
      reasons: refused as unknown as RefusedActionEligibilityDecision['reasons'],
    }
  }
  return { status: 'accepted', reasons: adjusted }
}

function reconcileAllocations(
  requestedAmount: number,
  allocations: readonly SourceAllocationRequest[],
): ActionReason[] {
  const reasons: ActionReason[] = []
  const allocationIds = new Set<string>()
  const sourceIds = new Set<string>()
  let total = 0n
  let amountsValid = Number.isSafeInteger(requestedAmount) && requestedAmount > 0
  const sorted = sortedAllocations(allocations)
  for (const allocation of sorted) {
    if (allocationIds.has(allocation.allocationId)) {
      reasons.push(
        createActionReason('duplicate-allocation-id', {
          allocationId: allocation.allocationId,
          accountId: allocation.sourceAccountId,
        }),
      )
    }
    allocationIds.add(allocation.allocationId)
    if (sourceIds.has(allocation.sourceAccountId)) {
      reasons.push(
        createActionReason('duplicate-source-account', {
          allocationId: allocation.allocationId,
          accountId: allocation.sourceAccountId,
        }),
      )
    }
    sourceIds.add(allocation.sourceAccountId)
    if (
      !Number.isSafeInteger(allocation.requestedAmount) ||
      allocation.requestedAmount <= 0
    ) {
      amountsValid = false
    } else {
      total += BigInt(allocation.requestedAmount)
    }
  }
  if (!amountsValid || total !== BigInt(Number.isSafeInteger(requestedAmount) ? requestedAmount : 0)) {
    reasons.push(createActionReason('allocation-total-mismatch'))
  }
  return reasons
}

/** Pure exact-cent/identity allocation preflight shared by all action arms. */
export function reconcileRequestedAllocations(
  requestedAmount: number,
  allocations: readonly SourceAllocationRequest[],
): RetirementActionEligibilityDecision {
  return canonicalDecision(reconcileAllocations(requestedAmount, allocations))
}

function dateReasons(
  kind: 'conversion' | 'qcd',
  executionDate: string | undefined,
  year: number,
): ActionReason[] {
  if (executionDate === undefined || executionDate.length === 0) {
    return [createActionReason(`${kind}-date-missing`)]
  }
  const parsed = parseCivilIsoDate(executionDate)
  if (parsed === null) return [createActionReason(`${kind}-date-invalid`)]
  if (parsed.year !== year) return [createActionReason(`${kind}-date-outside-action-year`)]
  return []
}

function appendActionPersonReasons(
  request: RetirementActionRequest,
  personId: PersonId,
  people: ReadonlyMap<string, Person | null>,
  context: NonpersistedRetirementActionEligibilityContext,
  reasons: ActionReason[],
): void {
  if (people.get(personId) == null) {
    reasons.push(createActionReason('person-not-found', { personId }))
    return
  }
  const evidence = uniqueIndex(
    context.personAliveEvidence ?? [],
    (item) => item.actionId,
  ).get(request.actionId)
  const expectedDate =
    'executionDate' in request ? request.executionDate ?? null : null
  if (
    evidence == null ||
    typeof evidence.evidenceId !== 'string' ||
    evidence.evidenceId.trim().length === 0 ||
    evidence.personId !== personId ||
    !Number.isSafeInteger(evidence.actionYear) ||
    evidence.actionYear !== request.year ||
    evidence.actionDate !== expectedDate ||
    typeof evidence.alive !== 'boolean'
  ) {
    reasons.push(createActionReason('required-facts-missing', { personId }))
  } else if (!evidence.alive) {
    reasons.push(createActionReason('person-not-alive', { personId }))
  }
}

function appendEquityCompDateReasons(
  request: Extract<RetirementActionRequest, { kind: 'ordinaryWithdrawal' }>,
  account: EquityCompAccount,
  allocation: SourceAllocationRequest,
  reasons: ActionReason[],
): void {
  if (account.vestingMode === 'final') return
  const executionDate =
    request.executionDate === undefined ? null : parseCivilIsoDate(request.executionDate)
  const vestDate = account.vestDate === null ? null : parseCivilIsoDate(account.vestDate)
  if (
    executionDate === null ||
    executionDate.year !== request.year ||
    vestDate === null
  ) {
    reasons.push(
      createActionReason('required-facts-missing', {
        accountId: allocation.sourceAccountId,
        allocationId: allocation.allocationId,
      }),
    )
  } else if (
    compareCivilIsoDates(formatCivilDate(executionDate), formatCivilDate(vestDate)) < 0
  ) {
    reasons.push(
      createActionReason('withdrawal-source-not-spendable', {
        accountId: allocation.sourceAccountId,
        allocationId: allocation.allocationId,
      }),
    )
  }
}

function legacyDecision(
  request: LegacyAggregateRetirementActionRequest,
): RetirementActionEligibilityDecision {
  const code =
    request.kind === 'legacyAggregateWithdrawal'
      ? 'withdrawal-aggregate-unallocated'
      : request.kind === 'legacyAggregateRothConversion'
        ? 'conversion-aggregate-unallocated'
        : 'qcd-aggregate-unallocated'
  return canonicalDecision([createActionReason(code)])
}

function evaluateOrdinaryWithdrawal(
  request: Extract<RetirementActionRequest, { kind: 'ordinaryWithdrawal' }>,
  plan: RetirementActionEligibilityPlan,
  context: NonpersistedRetirementActionEligibilityContext,
): RetirementActionEligibilityDecision {
  const reasons = reconcileAllocations(request.requestedAmount, request.allocations)
  if (request.executionDate !== undefined) {
    const executionDate = parseCivilIsoDate(request.executionDate)
    if (executionDate === null || executionDate.year !== request.year) {
      reasons.push(
        createActionReason('required-facts-missing', { personId: request.personId }),
      )
    }
  }
  const people = uniqueIndex(plan.people, (person) => person.id)
  const accounts = uniqueIndex(plan.accounts, (account) => account.id)
  appendActionPersonReasons(request, request.personId, people, context, reasons)
  for (const allocation of sortedAllocations(request.allocations)) {
    const account = accounts.get(allocation.sourceAccountId)
    if (account == null) {
      reasons.push(
        createActionReason('source-account-not-found', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
      continue
    }
    if (account.ownerPersonId === null) {
      reasons.push(
        createActionReason('joint-source-acting-person-mismatch', {
          personId: request.personId,
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
    } else if (account.ownerPersonId !== request.personId) {
      reasons.push(
        createActionReason('source-owner-mismatch', {
          personId: request.personId,
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
    }
    if (
      !['cash', 'taxable', 'equityComp', 'traditional', 'roth', 'hsa'].includes(
        account.type,
      )
    ) {
      reasons.push(
        createActionReason('withdrawal-source-type-unsupported', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
    } else if (account.type === 'equityComp') {
      appendEquityCompDateReasons(request, account, allocation, reasons)
    }
  }
  return canonicalDecision(reasons)
}

function evaluateConversion(
  request: RothConversionRequest,
  plan: RetirementActionEligibilityPlan,
  context: NonpersistedRetirementActionEligibilityContext,
): RetirementActionEligibilityDecision {
  const reasons = [
    ...dateReasons('conversion', request.executionDate, request.year),
    ...reconcileAllocations(request.requestedAmount, request.allocations),
  ]
  const people = uniqueIndex(plan.people, (person) => person.id)
  const accounts = uniqueIndex(plan.accounts, (account) => account.id)
  const iraFacts = uniqueIndex(context.iraFacts ?? [], (fact) => fact.sourceAccountId)
  appendActionPersonReasons(request, request.personId, people, context, reasons)

  for (const allocation of sortedAllocations(request.allocations)) {
    const account = accounts.get(allocation.sourceAccountId)
    if (account == null) {
      reasons.push(
        createActionReason('source-account-not-found', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
      continue
    }
    if (account.ownerPersonId !== request.personId) {
      reasons.push(
        createActionReason('conversion-source-owner-mismatch', {
          personId: request.personId,
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
    }
    if (account.type !== 'traditional') {
      reasons.push(
        createActionReason('conversion-source-not-convertible', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
      continue
    }
    if (account.inherited !== undefined) {
      reasons.push(
        createActionReason('conversion-inherited-source', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
      continue
    }
    if (account.kind === 'employer') {
      reasons.push(
        createActionReason('conversion-plan-availability-unknown', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
      continue
    }
    const fact = iraFacts.get(allocation.sourceAccountId)
    if (fact == null) {
      reasons.push(
        createActionReason('conversion-ira-subtype-unknown', {
          accountId: allocation.sourceAccountId,
          allocationId: allocation.allocationId,
        }),
      )
      continue
    }
    if (fact.subtype === 'simple') {
      const participationDate = fact.simpleParticipationStartDate
      const periodEnd =
        participationDate === undefined ? null : addCalendarMonths(participationDate, 24)
      const executionDate =
        request.executionDate === undefined ? null : parseCivilIsoDate(request.executionDate)
      if (periodEnd === null) {
        reasons.push(
          createActionReason('conversion-simple-two-year-rule-unknown', {
            accountId: allocation.sourceAccountId,
            allocationId: allocation.allocationId,
          }),
        )
      } else if (
        executionDate !== null &&
        compareCivilIsoDates(formatCivilDate(executionDate), periodEnd) < 0
      ) {
        reasons.push(
          createActionReason('conversion-simple-two-year-period-open', {
            accountId: allocation.sourceAccountId,
            allocationId: allocation.allocationId,
          }),
        )
      }
    }
  }

  const destination = accounts.get(request.destinationRothAccountId)
  if (destination == null) {
    reasons.push(
      createActionReason('conversion-destination-not-found', {
        accountId: request.destinationRothAccountId,
      }),
    )
  } else {
    if (destination.ownerPersonId !== request.personId) {
      reasons.push(
        createActionReason('conversion-destination-owner-mismatch', {
          personId: request.personId,
          accountId: request.destinationRothAccountId,
        }),
      )
    }
    if (destination.type !== 'roth') {
      reasons.push(
        createActionReason('conversion-destination-incompatible', {
          accountId: request.destinationRothAccountId,
        }),
      )
    } else if (destination.kind === 'employer') {
      reasons.push(
        createActionReason('conversion-employer-destination-unsupported', {
          accountId: request.destinationRothAccountId,
        }),
      )
    }
  }
  if (request.taxFunding.kind === 'conversionPrincipalWithholding') {
    reasons.push(createActionReason('conversion-principal-withholding-unsupported'))
  }
  return canonicalDecision(reasons)
}

function completeContributionHistory(
  history: NonpersistedQcdContributionHistoryFact | null | undefined,
  donorId: PersonId,
  thresholdYear: number,
  actionYear: number,
): boolean {
  if (history == null || history.donorPersonId !== donorId) {
    return false
  }
  const years = new Map<number, UsdCents>()
  let total = 0n
  for (const fact of history.taxYears) {
    if (
      !Number.isSafeInteger(fact.taxYear) ||
      years.has(fact.taxYear) ||
      !Number.isSafeInteger(fact.deductibleContributionAmount) ||
      fact.deductibleContributionAmount < 0
    ) {
      return false
    }
    years.set(fact.taxYear, fact.deductibleContributionAmount)
    total += BigInt(fact.deductibleContributionAmount)
  }
  if (
    history.taxYears.length !== actionYear - thresholdYear + 1 ||
    [...years.keys()].some((year) => year < thresholdYear || year > actionYear)
  ) {
    return false
  }
  for (let year = thresholdYear; year <= actionYear; year += 1) {
    if (!years.has(year)) return false
  }
  if (
    !Number.isSafeInteger(history.priorOffsetApplied) ||
    history.priorOffsetApplied < 0 ||
    BigInt(history.priorOffsetApplied) > total
  ) {
    return false
  }
  return true
}

function evaluateQcd(
  request: QualifiedCharitableDistributionRequest,
  plan: RetirementActionEligibilityPlan,
  context: NonpersistedRetirementActionEligibilityContext,
): RetirementActionEligibilityDecision {
  const reasons = [
    ...dateReasons('qcd', request.executionDate, request.year),
    ...reconcileAllocations(request.requestedAmount, [request.allocation]),
  ]
  const people = uniqueIndex(plan.people, (person) => person.id)
  const accounts = uniqueIndex(plan.accounts, (account) => account.id)
  const iraFacts = uniqueIndex(context.iraFacts ?? [], (fact) => fact.sourceAccountId)
  const histories = uniqueIndex(
    context.qcdContributionHistories ?? [],
    (history) => history.donorPersonId,
  )
  const donor = people.get(request.donorPersonId)
  const source = accounts.get(request.allocation.sourceAccountId)
  let thresholdDate: string | null = null

  if (donor == null) {
    reasons.push(createActionReason('person-not-found', { personId: request.donorPersonId }))
  } else {
    appendActionPersonReasons(request, request.donorPersonId, people, context, reasons)
    thresholdDate = addCalendarMonths(donor.dob, 846)
    if (thresholdDate === null) {
      reasons.push(
        createActionReason('required-facts-missing', { personId: request.donorPersonId }),
      )
    } else if (
      request.executionDate !== undefined &&
      parseCivilIsoDate(request.executionDate) !== null &&
      compareCivilIsoDates(request.executionDate, thresholdDate) < 0
    ) {
      reasons.push(
        createActionReason('qcd-before-age-70-half', {
          personId: request.donorPersonId,
        }),
      )
    }
  }

  if (source == null) {
    reasons.push(
      createActionReason('source-account-not-found', {
        accountId: request.allocation.sourceAccountId,
        allocationId: request.allocation.allocationId,
      }),
    )
  } else {
    if (source.ownerPersonId !== request.donorPersonId) {
      reasons.push(
        createActionReason('qcd-source-owner-mismatch', {
          personId: request.donorPersonId,
          accountId: request.allocation.sourceAccountId,
          allocationId: request.allocation.allocationId,
        }),
      )
    }
    if (source.type === 'roth' && source.kind === 'ira') {
      reasons.push(
        createActionReason('qcd-roth-source-unsupported', {
          accountId: request.allocation.sourceAccountId,
        }),
      )
    } else if (source.type !== 'traditional' || source.kind !== 'ira') {
      reasons.push(
        createActionReason('qcd-source-not-ira', {
          accountId: request.allocation.sourceAccountId,
        }),
      )
    } else if (source.inherited !== undefined) {
      reasons.push(
        createActionReason('qcd-inherited-basis-unsupported', {
          accountId: request.allocation.sourceAccountId,
        }),
      )
    } else {
      const fact = iraFacts.get(request.allocation.sourceAccountId)
      if (
        fact == null ||
        (fact.subtype === 'traditional' && fact.qcdActivity?.kind !== 'notApplicable') ||
        (fact.subtype !== 'traditional' &&
          (fact.qcdActivity == null ||
            fact.qcdActivity.kind !== 'employerContribution' ||
            !Number.isSafeInteger(fact.qcdActivity.actionTaxYear) ||
            fact.qcdActivity.actionTaxYear !== request.year ||
            typeof fact.qcdActivity.evidenceId !== 'string' ||
            fact.qcdActivity.evidenceId.trim().length === 0 ||
            parseCivilIsoDate(fact.qcdActivity.planYearEndDate)?.year !== request.year ||
            typeof fact.qcdActivity.employerContributionMadeForPlanYear !== 'boolean'))
      ) {
        reasons.push(
          createActionReason('qcd-sep-simple-activity-unknown', {
            accountId: request.allocation.sourceAccountId,
          }),
        )
      } else if (
        fact.subtype !== 'traditional' &&
        fact.qcdActivity?.employerContributionMadeForPlanYear
      ) {
        reasons.push(
          createActionReason('qcd-ongoing-sep-simple', {
            accountId: request.allocation.sourceAccountId,
          }),
        )
      }
    }
  }

  if (
    request.charity.designationKind === 'splitInterestEntity' ||
    !request.charity.notSplitInterestEntityAttested
  ) {
    reasons.push(createActionReason('qcd-split-interest-unsupported'))
  }
  if (
    request.charity.designationKind !== 'eligiblePublicCharity' ||
    !request.charity.directFromCustodianAttested ||
    !request.charity.eligibleOrganizationAttested ||
    !request.charity.notDonorAdvisedFundOrSupportingOrganizationAttested
  ) {
    reasons.push(createActionReason('qcd-direct-charity-unconfirmed'))
  }
  if (!request.charity.entireDistributionOtherwiseDeductibleAttested) {
    reasons.push(
      createActionReason('qcd-entire-distribution-deductibility-unconfirmed'),
    )
  }

  const validExecutionDate =
    request.executionDate === undefined ? null : parseCivilIsoDate(request.executionDate)
  const isKnownPreThreshold =
    thresholdDate !== null &&
    validExecutionDate !== null &&
    compareCivilIsoDates(formatCivilDate(validExecutionDate), thresholdDate) < 0
  const hasValidInYearEligibleDate =
    thresholdDate !== null &&
    validExecutionDate !== null &&
    validExecutionDate.year === request.year &&
    !isKnownPreThreshold
  if (hasValidInYearEligibleDate && thresholdDate !== null) {
    const history = histories.get(request.donorPersonId)
    const complete = completeContributionHistory(
      history,
      request.donorPersonId,
      Number(thresholdDate.slice(0, 4)),
      request.year,
    )
    if (!complete) {
      reasons.push(
        createActionReason('qcd-contribution-history-unknown', {
          personId: request.donorPersonId,
        }),
      )
    }
  }
  return canonicalDecision(reasons)
}

function referencedIraSourceAccountIds(
  request: RetirementActionRequest,
): readonly AccountId[] {
  const ids =
    request.kind === 'qcd'
      ? [request.allocation.sourceAccountId]
      : request.kind === 'rothConversion'
        ? request.allocations.map((allocation) => allocation.sourceAccountId)
        : []
  return [...new Set(ids)].sort(compareUtf16CodeUnits)
}

/**
 * Bind durable Plan v3 eligibility evidence to one action request while keeping
 * execution-time facts outside the Plan. Missing or ambiguous evidence is
 * omitted so the evaluator retains its unsupported/refused fail-closed paths.
 */
export function buildRetirementActionEligibilityContextFromPlan(
  plan: Plan,
  request: RetirementActionRequest,
  runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {},
): NonpersistedRetirementActionEligibilityContext {
  const aliveEvidence = uniqueIndex(
    runtimeEvidence.personAliveEvidence ?? [],
    (evidence) => evidence.actionId,
  ).get(request.actionId)
  const personAliveEvidence =
    aliveEvidence == null ? [] : [aliveEvidence]
  const facts = plan.retirementActionEligibilityFacts
  const classifications = uniqueIndex(
    facts?.iraClassifications ?? [],
    (classification) => classification.sourceAccountId,
  )
  const activities = uniqueIndex(
    facts?.sepSimpleActivities ?? [],
    (activity) => JSON.stringify([activity.sourceAccountId, activity.actionTaxYear]),
  )
  const iraFacts: NonpersistedIraEligibilityFact[] = []
  for (const sourceAccountId of referencedIraSourceAccountIds(request)) {
    const classification = classifications.get(sourceAccountId)
    if (classification == null) continue
    const brandedSourceAccountId = asAccountId(classification.sourceAccountId)
    if (classification.subtype === 'traditional') {
      iraFacts.push({
        sourceAccountId: brandedSourceAccountId,
        subtype: 'traditional',
        qcdActivity: { kind: 'notApplicable' },
      })
      continue
    }
    const activity = activities.get(
      JSON.stringify([classification.sourceAccountId, request.year]),
    )
    const qcdActivity =
      activity == null
        ? undefined
        : {
            kind: 'employerContribution' as const,
            actionTaxYear: activity.actionTaxYear,
            planYearEndDate: activity.planYearEndDate,
            employerContributionMadeForPlanYear:
              activity.employerContributionMadeForPlanYear,
            evidenceId: activity.evidenceId,
          }
    if (classification.subtype === 'sep') {
      iraFacts.push({
        sourceAccountId: brandedSourceAccountId,
        subtype: 'sep',
        ...(qcdActivity === undefined ? {} : { qcdActivity }),
      })
    } else {
      iraFacts.push({
        sourceAccountId: brandedSourceAccountId,
        subtype: 'simple',
        ...(classification.simpleParticipationStartDate === undefined
          ? {}
          : {
              simpleParticipationStartDate:
                classification.simpleParticipationStartDate,
            }),
        ...(qcdActivity === undefined ? {} : { qcdActivity }),
      })
    }
  }

  const qcdContributionHistories: NonpersistedQcdContributionHistoryFact[] = []
  if (request.kind === 'qcd') {
    const donors = uniqueIndex(plan.household.people, (person) => person.id)
    const donor = donors.get(request.donorPersonId)
    const thresholdDate = donor == null ? null : addCalendarMonths(donor.dob, 846)
    const expectedActionDate = request.executionDate ?? null
    const offsetEvidence = uniqueIndex(
      runtimeEvidence.priorQcdOffsetEvidence ?? [],
      (evidence) => evidence.actionId,
    ).get(request.actionId)
    if (
      donor != null &&
      thresholdDate !== null &&
      offsetEvidence != null &&
      typeof offsetEvidence.evidenceId === 'string' &&
      offsetEvidence.evidenceId.trim().length > 0 &&
      offsetEvidence.donorPersonId === request.donorPersonId &&
      Number.isSafeInteger(offsetEvidence.actionYear) &&
      offsetEvidence.actionYear === request.year &&
      offsetEvidence.actionDate === expectedActionDate &&
      Number.isSafeInteger(offsetEvidence.priorOffsetApplied) &&
      offsetEvidence.priorOffsetApplied >= 0 &&
      !Object.is(offsetEvidence.priorOffsetApplied, -0)
    ) {
      const thresholdYear = Number(thresholdDate.slice(0, 4))
      const contributions = uniqueIndex(
        facts?.deductibleIraContributions.filter(
          (contribution) => contribution.donorPersonId === request.donorPersonId,
        ) ?? [],
        (contribution) => String(contribution.taxYear),
      )
      const taxYears: NonpersistedQcdContributionYearFact[] = []
      let completePrefix = request.year >= thresholdYear
      for (let taxYear = thresholdYear; taxYear <= request.year; taxYear += 1) {
        const contribution = contributions.get(String(taxYear))
        if (contribution == null) {
          completePrefix = false
          break
        }
        taxYears.push({
          taxYear,
          deductibleContributionAmount: contribution.amountCents,
        })
      }
      if (completePrefix) {
        qcdContributionHistories.push({
          donorPersonId: asPersonId(request.donorPersonId),
          taxYears,
          priorOffsetApplied: offsetEvidence.priorOffsetApplied,
        })
      }
    }
  }

  return {
    ...(personAliveEvidence.length === 0 ? {} : { personAliveEvidence }),
    ...(iraFacts.length === 0 ? {} : { iraFacts }),
    ...(qcdContributionHistories.length === 0
      ? {}
      : { qcdContributionHistories }),
  }
}

/**
 * Evaluate the bounded WS2 action-eligibility predicates without mutating the
 * plan or deriving execution/tax results. Except for refusing principal
 * withholding, conversion-funding sufficiency and fixed-point predicates are
 * deferred; an accepted preflight is not implementation-ready.
 */
export function evaluateRetirementActionEligibility(
  request: RetirementActionRequest,
  plan: RetirementActionEligibilityPlan,
  context: NonpersistedRetirementActionEligibilityContext = {},
): RetirementActionEligibilityDecision {
  switch (request.kind) {
    case 'ordinaryWithdrawal':
      return evaluateOrdinaryWithdrawal(request, plan, context)
    case 'rothConversion':
      return evaluateConversion(request, plan, context)
    case 'qcd':
      return evaluateQcd(request, plan, context)
    case 'legacyAggregateWithdrawal':
    case 'legacyAggregateRothConversion':
    case 'legacyAggregateQcd':
      return legacyDecision(request)
  }
}

/** Evaluate one request directly against a Plan plus explicit runtime evidence. */
export function evaluateRetirementActionEligibilityFromPlan(
  request: RetirementActionRequest,
  plan: Plan,
  runtimeEvidence: RetirementActionEligibilityRuntimeEvidence = {},
): RetirementActionEligibilityDecision {
  return evaluateRetirementActionEligibility(
    request,
    { people: plan.household.people, accounts: plan.accounts },
    buildRetirementActionEligibilityContextFromPlan(plan, request, runtimeEvidence),
  )
}

/** Traditional pre-59½ early-withdrawal penalty rate (age approximated annually). */
export const TRADITIONAL_EARLY_PENALTY_RATE = 0.1
/** HSA non-qualified withdrawal penalty rate before age 65 (IRC §223(f)(4)). */
export const HSA_NON_QUALIFIED_PENALTY_RATE = 0.2

type TreatAsOwnElectionAccount = Readonly<{
  kind?: string | undefined
  inherited?: Readonly<{
    ownerDeathYear?: number | undefined
    beneficiary?: Readonly<{
      election?: string | undefined
      treatAsOwnElectionYear?: number | undefined
      edbCategory?: string | undefined
      soleBeneficiary?: boolean | undefined
      spouseUnlimitedWithdrawalRight?: boolean | undefined
    }> | undefined
  }> | undefined
}>

/**
 * Whether an inherited IRA carries a spouse treat-as-own election the
 * classifier would recognize (year-agnostic). Used by the optimizer probe to
 * keep S2 accounts in the inherited-traditional LP bucket for the whole horizon
 * and remap post-flip owner RMD obligations into that bucket's forced flow.
 */
export function hasSpouseTreatAsOwnElection(
  account: TreatAsOwnElectionAccount,
): boolean {
  const beneficiary = account.inherited?.beneficiary
  return (
    account.kind === 'ira' &&
    account.inherited !== undefined &&
    beneficiary?.election === 'treat-as-own' &&
    beneficiary.edbCategory === 'surviving-spouse' &&
    beneficiary.soleBeneficiary === true &&
    beneficiary.spouseUnlimitedWithdrawalRight === true &&
    beneficiary.treatAsOwnElectionYear !== undefined
  )
}

/**
 * Whether a spouse's explicit treat-as-own election has taken effect for an
 * account in a calendar year. Mirrors the classifier's S2 structural gate
 * (`classifyInheritedRegime` in strategies/inheritedIra.ts): IRA kind only,
 * edbCategory `'surviving-spouse'`, soleBeneficiary true, spouseUnlimitedWithdrawalRight
 * true, election `'treat-as-own'`, and a defined `treatAsOwnElectionYear` with
 * `year >=` it. A fact set the classifier would refuse never flips. This
 * intentionally does not rewire the static eligibility predicates below;
 * contribution/conversion validators stay pre-transition (WS5 residual).
 */
export function isTreatAsOwnEffective(
  account: TreatAsOwnElectionAccount,
  year: number,
): boolean {
  const beneficiary = account.inherited?.beneficiary
  if (
    account.kind !== 'ira' ||
    beneficiary?.election !== 'treat-as-own' ||
    beneficiary.edbCategory !== 'surviving-spouse' ||
    beneficiary.soleBeneficiary !== true ||
    beneficiary.spouseUnlimitedWithdrawalRight !== true ||
    beneficiary.treatAsOwnElectionYear === undefined
  ) {
    return false
  }
  // A death-year election leaves the death year itself to the decedent's own
  // RMD (§1.408-8(c)(3): the spouse owes no owner RMD that year and takes the
  // decedent's unsatisfied amount instead); owner treatment begins the
  // following calendar year. Every consumer — ledger, settlement, replay,
  // inventory — takes this one boundary from here.
  const effectiveFromYear =
    beneficiary.treatAsOwnElectionYear === account.inherited?.ownerDeathYear
      ? beneficiary.treatAsOwnElectionYear + 1
      : beneficiary.treatAsOwnElectionYear
  return year >= effectiveFromYear
}

/**
 * Can this account receive new contributions? Any inherited account is blocked
 * (traditional and Roth; the plan still carries the inherited block after an
 * S2 flip, so post-flip contributions stay blocked — WS5 residual).
 */
export function acceptsContributions(account: Account): boolean {
  if (
    (account.type === 'traditional' || account.type === 'roth') &&
    account.inherited !== undefined
  ) {
    return false
  }
  return true
}

/**
 * Can this account's balance be converted to Roth? Only an owned (non-
 * inherited) traditional account qualifies: inherited accounts follow the
 * 10-year rule and are never convertible by a non-spouse beneficiary.
 */
export function isConvertibleToRoth(account: Account): account is TraditionalAccount {
  return account.type === 'traditional' && account.inherited === undefined
}

/**
 * Does this account follow the owner's own age-based RMDs (Uniform Lifetime /
 * Joint Life)? Inherited accounts are exempt — they follow the beneficiary
 * 10-year schedule in `strategies/inheritedIra.ts` instead.
 */
export function followsOwnerRmds(account: Account): account is TraditionalAccount {
  return account.type === 'traditional' && account.inherited === undefined
}

/**
 * Does this account participate in the owner's Form-8606 IRA aggregation for
 * the nondeductible-basis pro-rata rule? Only the owner's own traditional
 * IRAs aggregate: employer plans track after-tax money separately, and a
 * beneficiary's inherited IRA has its own separate Form 8606.
 */
export function isAggregatedIra(account: Account): account is TraditionalAccount {
  return account.type === 'traditional' && account.kind === 'ira' && account.inherited === undefined
}

/** Is a cliff-vesting equity-comp account vested (available for spending) in `year`? */
export function isEquityCompVested(account: EquityCompAccount, year: number): boolean {
  if (account.vestingMode === 'final') return true
  if (account.vestDate === null) return false
  return Number(account.vestDate.slice(0, 4)) <= year
}

/** Is this account's balance available for need-based spending withdrawals in `year`? */
export function isSpendableInYear(account: Account, year: number): boolean {
  if (account.type === 'equityComp') return isEquityCompVested(account, year)
  return true
}

export interface EarlyWithdrawalContext {
  /** Owner's age attained this calendar year. */
  ownerAgeAttained: number
  /** Owner's plan retirement age (the separation-from-service proxy), or null. */
  ownerRetirementAge: number | null
}

/**
 * Penalty rate on a need-based traditional withdrawal this year: 10% before
 * 59½ (approximated as age < 60), waived for inherited accounts (never
 * penalized), and waived by the Rule of 55 for an EMPLOYER plan the owner
 * separated from in/after the year they turned 55 (IRAs never qualify).
 */
export function traditionalWithdrawalPenaltyRate(account: TraditionalAccount, ctx: EarlyWithdrawalContext): number {
  if (account.inherited !== undefined) return 0
  if (ctx.ownerAgeAttained >= 60) return 0
  const ruleOf55 =
    account.kind === 'employer' &&
    ctx.ownerRetirementAge !== null &&
    ctx.ownerRetirementAge >= 55 &&
    ctx.ownerAgeAttained >= ctx.ownerRetirementAge
  return ruleOf55 ? 0 : TRADITIONAL_EARLY_PENALTY_RATE
}

/**
 * Penalty rate on the NON-QUALIFIED portion of an HSA withdrawal this year:
 * 20% before age 65, none after. Qualified (medical) withdrawals are never
 * penalized; the HSA subledger decides how much of a withdrawal is qualified.
 */
export function hsaNonQualifiedPenaltyRate(ownerAgeAttained: number): number {
  return ownerAgeAttained < 65 ? HSA_NON_QUALIFIED_PENALTY_RATE : 0
}
