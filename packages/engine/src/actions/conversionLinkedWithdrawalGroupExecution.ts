import {
  checkAnnualLiabilityRunIdentitySet,
  type AnnualLiabilityRunIdentity,
} from './annualLiabilityRunIdentity.js'
import type { RetirementActionRequest } from './contract.js'
import {
  type ConversionLinkedWithdrawalGroupAssessment,
  type ConversionLinkedWithdrawalGroupAuthorization,
  type ConversionLinkedWithdrawalGroupDisposition,
  type ConversionLinkedWithdrawalGroupReasonCode,
  type ConversionLinkedWithdrawalGroupRefusalKind,
} from './conversionLinkedWithdrawalGroup.js'
import {
  buildConversionTaxFundingAnnualGroupEvidence,
  type ConversionTaxFundingAnnualGroupEvidence,
  type ConversionTaxFundingEvidence,
  type ConversionTaxFundingExactCentAmount,
  type ConversionTaxFundingTaxUnitEvidence,
} from './conversionTaxFundingEvidence.js'
import {
  mergedRetirementActionSchedule,
  type MergedRetirementActionSchedule,
  type MergedRetirementActionSchedulePosition,
} from './execution.js'
import type { ActionId, PersonId } from './identity.js'
import { asUsdCents, type UsdCents } from './money.js'
import { compareUtf16CodeUnits } from './structuralId.js'

/** A leg nobody reported on moved nothing and was authored nothing. */
const ZERO_CENTS: UsdCents = asUsdCents(0)

/**
 * The atomic annual funding group, executed: where each leg would sit in one
 * merged schedule, what the filing unit's conversions actually cost it, how
 * that cost divides across them, whether both legs moved — and, when the whole
 * chain proves out, the permission that let them.
 *
 * The gate is open, and how it opens is the whole of this module's authority.
 * `authorizeConversionLinkedWithdrawalGroups` below is the only producer of a
 * `executedAsAtomicGroup` disposition anywhere in the engine, and it produces
 * one only from a *staging run*: a whole annual pass, discarded, in which both
 * legs of every group already moved their entire authored amount and the annual
 * funding evaluation over that run's actual funding vector reached a
 * `satisfied` fixed point. The run that commits then re-derives the same
 * evaluation from its own liabilities and its own movement, and says `executed`
 * only if it agrees.
 *
 * Nothing here touches a balance. That is not a gap: the two legs are moved by
 * the executors that own their kinds — `actions/execution.ts` for the
 * withdrawal and `actions/rothConversionExecution.ts` for the conversion — and
 * they have to be, because publication requires exactly one record per action
 * from the executor source that owns it. What makes the movement *atomic* is
 * that both of those executors read one verdict rather than two, so there is a
 * single answer to release or refuse and no reconciliation between a pair of
 * them.
 *
 * Four things are produced and each answers a question the pathway could not
 * answer before.
 *
 * **Ordering.** Both legs are ordered through one
 * `mergedRetirementActionSchedule`, not two. The two executors run in different
 * simulator phases over disjoint request sets, so neither could ever say where
 * a conversion sits relative to the withdrawal funding it; a group that must
 * move as one transaction has to know, and it has to know it from the same sort
 * both executors already answer to rather than from a second one that could
 * disagree with either.
 *
 * **The funding evaluation.** `T0` and `T1(F)` arrive as inputs, because the
 * only thing that can compute an annual liability is a whole annual pass and
 * this is not one. What happens here is the part that is arithmetic: the exact
 * difference, the single nearest-cent quantization of it, and the
 * largest-remainder split across the conversions — all of it delegated to
 * `conversionTaxFundingEvidence.ts`, which owns those rules and proves them.
 *
 * **The identity binding.** The two liabilities are not two numbers; they are
 * two runs. Each arrives with a minted `AnnualLiabilityRunIdentity`, and the
 * pair is checked to be genuinely distinct runs before any evidence is built —
 * because two liabilities that came from one run would subtract to zero and
 * publish "this group cost nothing" with a straight face.
 *
 * **The movement.** Each record says what its two legs actually did in the run
 * that produced it, in exact cents, against what they were authored to do. Both
 * moved their whole authored amount, or the group's movement is `none` — there
 * is no arm for one leg, and no arm for a part of one. `movementCoherent` is
 * the field that distinguishes "neither moved" from "the run contradicted
 * itself", because the second is a defect in an executor and the first is the
 * ordinary answer.
 *
 * One consequence of a refused group is worth stating rather than discovering.
 * A refused conversion converts nothing, so its `allocationWeight` — its
 * finalized taxable conversion principal — is zero, and its dedicated
 * withdrawal executes nothing, so `fundedAmount` is zero. A simulator that
 * hands this executor a real refused group therefore gets a degenerate
 * evaluation: a required amount of zero allocated across zero weight, funded
 * with zero, which is a satisfied fixed point that is true and uninformative at
 * the same time. That degeneracy is exactly why `authorize…` below demands
 * movement as well as satisfaction: a refused group's evaluation is satisfied
 * and must never be read as permission.
 */

/** One conversion in the filing unit's annual group, as the simulator saw it. */
export interface ConversionLinkedWithdrawalGroupMemberInput {
  readonly conversionActionId: ActionId
  readonly conversionPersonId: PersonId
  /**
   * The conversion's committed taxable principal after the basis post-pass, or
   * null when the run cannot state it.
   *
   * Committed, not requested. A conversion that did not convert has no taxable
   * principal, and weighting it by what it asked for would allocate a share of
   * the unit's tax to dollars that never became income.
   *
   * Null is the case where a conversion moved but its character was left to the
   * annual settlement — the executor authorises movement without stating a
   * Form 8606 line-10 split when the owner's basis numerator is a proven
   * positive figure. A weight nobody can state is not a zero: zero would say
   * the conversion owes none of the unit's tax, which is the taxpayer-adverse
   * reading of an unknown. The whole evaluation refuses instead.
   */
  readonly allocationWeight: UsdCents | null
  /** The dedicated linked withdrawal's committed executed cents. */
  readonly fundedAmount: UsdCents
}

/**
 * One annual liability, and the run that produced it.
 *
 * The run's *kind* is not decoration here, and each slot admits exactly one.
 *
 * The baseline is `baselineT0`: the counterfactual with the group's requests
 * removed. Nothing else can fill that slot, because `T0` is defined by what was
 * taken out of it.
 *
 * The candidate is `candidateT1`, and the reason is the funding vector rather
 * than the wall clock. `candidateT1` is the only binding that carries a
 * `candidateFundingVectorEvidenceId`, and the evidence contract's candidate is
 * "the unit's annual liability with them, *funded as stated*" — a candidate
 * that does not name the vector it was run against cannot be subtracted from a
 * baseline honestly, because a different vector is a different candidate.
 * `committedAnnual` structurally cannot name one: its funding-vector field is
 * `null` by the union.
 *
 * That is worth stating plainly because it is easy to misread. In this slice
 * `T1` and the committed pass are the same physical run — there is no third
 * run, and the year publishes one liability. But `liabilityRunKind` names the
 * *role and inputs* an identity answers for, not which execution produced it,
 * and the same pass minted as `committedAnnual` would be claiming a role that
 * has no funding vector attached. So the simulator mints it a second time as
 * `candidateT1` over the year's actual vector, and that is the identity this
 * slot takes.
 */
export interface ConversionLinkedWithdrawalGroupLiabilityRun {
  readonly liability: Readonly<ConversionTaxFundingExactCentAmount>
  readonly identity: Readonly<AnnualLiabilityRunIdentity>
}

/**
 * What one leg of one group actually did in the run that is reporting.
 *
 * `authoredAmount` is what the household asked for, in exact cents, and
 * `executedAmount` is what moved. They are carried apart rather than as a
 * single "moved" flag because a leg that moved a *part* of its authored amount
 * is not a leg that moved: the conversion executor has no partial arm at all,
 * and a partial withdrawal beside a whole conversion is the funding shortfall
 * this pathway exists to refuse.
 */
export interface ConversionLinkedWithdrawalGroupLegMovementInput {
  readonly authoredAmount: UsdCents
  readonly executedAmount: UsdCents
}

/** Both legs of one assessed pair, as the reporting run left them. */
export interface ConversionLinkedWithdrawalGroupMovementInput {
  readonly conversionActionId: ActionId
  readonly withdrawalActionId: ActionId
  readonly conversion: Readonly<ConversionLinkedWithdrawalGroupLegMovementInput>
  readonly withdrawal: Readonly<ConversionLinkedWithdrawalGroupLegMovementInput>
}

export interface ExecuteConversionLinkedWithdrawalGroupsInput {
  readonly taxYear: number
  /** The union of both executors' requests, as the assessment saw them. */
  readonly requests: readonly Readonly<RetirementActionRequest>[]
  readonly assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>
  /** Null when the year's filing unit could not be identified unambiguously. */
  readonly taxUnit: Readonly<ConversionTaxFundingTaxUnitEvidence> | null
  /** `T0`: the counterfactual run with the group's requests removed. */
  readonly baseline: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  /** `T1(F)`: the run that committed, with them present. */
  readonly candidate: Readonly<ConversionLinkedWithdrawalGroupLiabilityRun> | null
  readonly members: readonly Readonly<ConversionLinkedWithdrawalGroupMemberInput>[]
  /**
   * What each pair's two legs did in this run. Omitted means nothing moved,
   * which is what a caller that refused every group has to say and what every
   * caller could say before the gate opened.
   */
  readonly movements?:
    readonly Readonly<ConversionLinkedWithdrawalGroupMovementInput>[]
}

/**
 * Why the annual funding evaluation could not be built, when it could not.
 *
 * Each of these is a refusal to publish evidence rather than a refusal to
 * publish a group: the groups refuse either way, and these say what the record
 * accompanying that refusal is allowed to claim.
 */
export type ConversionLinkedWithdrawalGroupFundingRefusalKind =
  /** No group named a conversion, so there is no annual group to evaluate. */
  | 'noAnnualGroup'
  /** The year's filing unit was ambiguous, so no liability belongs to it. */
  | 'taxUnitUnavailable'
  /** One or both liability runs were missing. `T0` is the usual absentee. */
  | 'annualLiabilityUnavailable'
  /** The two runs are not provably distinct runs over distinct inputs. */
  | 'liabilityRunIdentityCollided'
  /** A run was handed over under a kind its slot cannot accept. */
  | 'liabilityRunKindInvalid'
  /** A run answers for another filing unit, or another tax year. */
  | 'liabilityRunUnitMismatched'
  /** A group member could not be matched to a conversion the assessment named. */
  | 'annualGroupMembershipInvalid'
  /** A member's taxable conversion principal is not yet stateable. */
  | 'allocationWeightUnavailable'
  /** The evidence builder refused the liabilities, weights or funded amounts. */
  | 'annualGroupUnbuildable'

export interface ConversionLinkedWithdrawalGroupFundingEvaluated {
  readonly status: 'annualGroupEvaluated'
  readonly taxUnit: Readonly<ConversionTaxFundingTaxUnitEvidence>
  readonly baselineRun: Readonly<AnnualLiabilityRunIdentity>
  readonly candidateRun: Readonly<AnnualLiabilityRunIdentity>
  /**
   * Whether the two runs were handed the same tax inputs.
   *
   * The snapshot ID names the inputs and nothing else, so two runs over one
   * filing unit and year that were told to remove different things hold
   * different snapshots — while a counterfactual that removed nothing holds the
   * committed run's snapshot and is distinguished only by its run kind. Carried
   * because "the baseline actually removed something" is the fact a reader most
   * wants and cannot recover from the liabilities alone: two runs can agree on
   * a liability to the cent and still be different runs.
   */
  readonly taxInputSnapshotsShared: boolean
  readonly members: ConversionTaxFundingAnnualGroupEvidence
}

export interface ConversionLinkedWithdrawalGroupFundingRefused {
  readonly status: 'annualGroupNotEvaluated'
  readonly reason: ConversionLinkedWithdrawalGroupFundingRefusalKind
  readonly issues: readonly string[]
}

export type ConversionLinkedWithdrawalGroupFundingEvaluation =
  | Readonly<ConversionLinkedWithdrawalGroupFundingEvaluated>
  | Readonly<ConversionLinkedWithdrawalGroupFundingRefused>

/** One assessed pair, with everything computed for it and nothing released. */
export interface ConversionLinkedWithdrawalGroupExecutionRecord {
  readonly groupId: string
  readonly personId: PersonId
  readonly year: number
  readonly conversionActionId: ActionId
  readonly withdrawalActionId: ActionId
  readonly disposition: ConversionLinkedWithdrawalGroupDisposition
  /** Null exactly when the pair was released; see the verdict union. */
  readonly refusalKind: ConversionLinkedWithdrawalGroupRefusalKind | null
  readonly reasonCode: ConversionLinkedWithdrawalGroupReasonCode | null
  /**
   * Whether both legs moved their whole authored amount, or neither did.
   *
   * `bothLegs` requires four equalities at once — each leg's executed cents
   * equal its authored cents, and both are positive — so there is no spelling
   * of this field for a group that moved one leg, or part of one.
   */
  readonly movement: 'none' | 'bothLegs'
  /**
   * Whether the two legs agree. False is a defect rather than a refusal: one
   * leg moved beside one that did not, or a leg moved an amount nobody
   * authored, and publication is where that becomes a throw.
   */
  readonly movementCoherent: boolean
  readonly conversionExecutedAmount: UsdCents
  readonly withdrawalExecutedAmount: UsdCents
  readonly conversionAuthoredAmount: UsdCents
  readonly withdrawalAuthoredAmount: UsdCents
  readonly conversionPosition: Readonly<MergedRetirementActionSchedulePosition> | null
  readonly withdrawalPosition: Readonly<MergedRetirementActionSchedulePosition> | null
  /**
   * Both legs present in the merged schedule and both well scheduled.
   *
   * A group whose legs disagree about date-completeness cannot move as one
   * transaction even once movement is permitted: an undated ordinary withdrawal
   * is lawful and lands on the year's last day, while an undated conversion has
   * no effective date at all and is refused for it. So the group refuses as a
   * unit, and this is the field that says the ordering — not the funding — is
   * what would have stopped it.
   */
  readonly orderingComplete: boolean
  /** This conversion's member record, when the annual group was evaluated. */
  readonly fundingEvidence: Readonly<ConversionTaxFundingEvidence> | null
}

/**
 * The year's groups, with the whole of what was computed for them.
 *
 * `executed` is claimed only when every one of three things holds at once: the
 * annual funding evaluation was built and every member of it reached a
 * `satisfied` fixed point; every group's two legs moved their whole authored
 * amount; and every group's verdict released it. Any shortfall in any of them
 * makes the year's whole set `refused` — including a year in which some groups
 * moved, because a partial release changes the funding vector the evaluation
 * answers for and the result would then be describing a different run than the
 * one that happened.
 */
export interface ExecuteConversionLinkedWithdrawalGroupsResult {
  readonly status: 'refused' | 'executed'
  readonly movement: 'none' | 'bothLegs'
  readonly taxYear: number
  readonly ordering: Readonly<MergedRetirementActionSchedule> | null
  readonly groups: readonly Readonly<ConversionLinkedWithdrawalGroupExecutionRecord>[]
  readonly funding: ConversionLinkedWithdrawalGroupFundingEvaluation
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

function refusedFunding(
  reason: ConversionLinkedWithdrawalGroupFundingRefusalKind,
  issues: readonly string[],
): Readonly<ConversionLinkedWithdrawalGroupFundingRefused> {
  return {
    status: 'annualGroupNotEvaluated' as const,
    reason,
    issues: [...issues],
  }
}

/**
 * The requests both legs of every assessed group resolve to, in one merged
 * schedule.
 *
 * Only the legs. A year's other actions are ordered by the same builder in
 * their own executors and adding them here would answer a question nobody
 * asked, while a leg the request set does not contain is simply absent — which
 * is itself the answer that refuses that group's ordering.
 */
function orderingFor(
  taxYear: number,
  requests: readonly Readonly<RetirementActionRequest>[],
  assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
): Readonly<MergedRetirementActionSchedule> | null {
  if (assessment.groups.length === 0) return null
  const legIds = new Set<ActionId>()
  for (const group of assessment.groups) {
    legIds.add(group.conversionActionId)
    legIds.add(group.withdrawalActionId)
  }
  const byActionId = new Map<ActionId, Readonly<RetirementActionRequest>>()
  for (const request of requests) {
    if (!legIds.has(request.actionId)) continue
    if (byActionId.has(request.actionId)) continue
    byActionId.set(request.actionId, request)
  }
  const legs = [...byActionId.values()]
  if (legs.length === 0) return null
  try {
    return mergedRetirementActionSchedule(taxYear, legs as RetirementActionRequest[])
  } catch {
    // A request the schema refuses, or a year outside the calendar range. The
    // group refuses either way, and an ordering nobody could compute is stated
    // as absent rather than approximated.
    return null
  }
}

/**
 * The members in the order `allocationOrder` is checked against.
 *
 * The evidence contract fixes that order as scheduled date and sequence order,
 * and the merged schedule is what knows it. Sorting here rather than trusting
 * the caller is deliberate: the caller assembles members by walking an
 * assessment sorted by action id, and an allocation order that followed the
 * caller's convenience would put the residual cent on whichever conversion
 * happened to sort first alphabetically. A conversion absent from the ordering
 * sorts last by its action id, which is stable and says plainly that the
 * schedule had nothing to say about it.
 */
function membersInScheduledOrder(
  members: readonly Readonly<ConversionLinkedWithdrawalGroupMemberInput>[],
  ordering: Readonly<MergedRetirementActionSchedule> | null,
): readonly Readonly<ConversionLinkedWithdrawalGroupMemberInput>[] {
  const orderByActionId = new Map(
    (ordering?.positions ?? []).map((position) =>
      [position.actionId, position.order] as const),
  )
  return [...members].sort((left, right) =>
    (orderByActionId.get(left.conversionActionId) ?? Number.MAX_SAFE_INTEGER) -
      (orderByActionId.get(right.conversionActionId) ?? Number.MAX_SAFE_INTEGER) ||
    compareUtf16CodeUnits(left.conversionActionId, right.conversionActionId))
}

function evaluateFunding(
  input: Readonly<ExecuteConversionLinkedWithdrawalGroupsInput>,
  ordering: Readonly<MergedRetirementActionSchedule> | null,
): ConversionLinkedWithdrawalGroupFundingEvaluation {
  const conversionActionIds = [
    ...new Set(input.assessment.groups.map((group) => group.conversionActionId)),
  ].sort(compareUtf16CodeUnits)
  if (conversionActionIds.length === 0) {
    return refusedFunding('noAnnualGroup', [])
  }
  if (input.taxUnit === null) {
    return refusedFunding('taxUnitUnavailable', [
      'The tax year has no unambiguous filing unit, so no annual liability belongs to it.',
    ])
  }
  const { baseline, candidate } = input
  if (baseline === null || candidate === null) {
    return refusedFunding('annualLiabilityUnavailable', [
      baseline === null
        ? 'The baseline (T0) annual liability run is missing.'
        : 'The candidate (T1) annual liability run is missing.',
    ])
  }
  // Each slot admits exactly the kind that can honestly fill it, named rather
  // than excluded. Asking only that the candidate is "not the baseline" would
  // admit a `committedAnnual` identity, which cannot carry the funding vector
  // the candidate is defined by -- and the evidence would then claim a
  // liability "funded as stated" while naming no statement of the funding.
  if (baseline.identity.liabilityRun.liabilityRunKind !== 'baselineT0') {
    return refusedFunding('liabilityRunKindInvalid', [
      `The baseline slot takes a "baselineT0" run, not "${baseline.identity.liabilityRun.liabilityRunKind}".`,
    ])
  }
  if (candidate.identity.liabilityRun.liabilityRunKind !== 'candidateT1') {
    return refusedFunding('liabilityRunKindInvalid', [
      `The candidate slot takes a "candidateT1" run, not "${candidate.identity.liabilityRun.liabilityRunKind}".`,
      'Only a candidate run names the funding vector it was run against, and a candidate that does not name its vector cannot be subtracted from a baseline.',
    ])
  }
  if (
    baseline.identity.taxUnitId !== input.taxUnit.taxUnitId ||
    candidate.identity.taxUnitId !== input.taxUnit.taxUnitId ||
    baseline.identity.taxYear !== input.taxUnit.taxYear ||
    candidate.identity.taxYear !== input.taxUnit.taxYear
  ) {
    return refusedFunding('liabilityRunUnitMismatched', [
      'Both liability runs must answer for the filing unit and tax year the evaluation names.',
    ])
  }
  // Both directions, because the failure that matters is not a hash collision:
  // it is a caller handing over one run twice, whose difference is zero and
  // whose evidence would say the group cost the household nothing.
  const distinct = checkAnnualLiabilityRunIdentitySet([
    baseline.identity,
    candidate.identity,
  ])
  if (
    distinct.status !== 'annualLiabilityRunIdentitySetDistinct' ||
    baseline.identity.annualTaxLiabilityEvidenceId ===
      candidate.identity.annualTaxLiabilityEvidenceId
  ) {
    return refusedFunding('liabilityRunIdentityCollided', [
      ...(distinct.status === 'annualLiabilityRunIdentitySetDistinct'
        ? []
        : distinct.issues.map((issue) => issue.detail)),
      'The baseline and candidate liability runs must be two distinct runs.',
    ])
  }

  // Members arrive in the order the annual group's `allocationOrder` is checked
  // against, which the evidence contract fixes as scheduled date and sequence
  // order. The assessment is already sorted by conversion id, and the caller
  // supplies the members; what is asserted here is only that the two describe
  // the same set of conversions, because a member for a conversion nobody
  // assessed would take a share of the unit's tax without any group refusing
  // for it.
  const memberActionIds = input.members.map((member) => member.conversionActionId)
  const assessedSet = new Set(conversionActionIds)
  if (
    memberActionIds.length !== conversionActionIds.length ||
    new Set(memberActionIds).size !== memberActionIds.length ||
    memberActionIds.some((actionId) => !assessedSet.has(actionId))
  ) {
    return refusedFunding('annualGroupMembershipInvalid', [
      'The annual group members must be exactly the conversions the assessment named, once each.',
    ])
  }

  const orderedMembers = membersInScheduledOrder(input.members, ordering)
  const unstateableWeights = orderedMembers
    .filter((member) => member.allocationWeight === null)
    .map((member) => member.conversionActionId)
    .sort(compareUtf16CodeUnits)
  if (unstateableWeights.length > 0) {
    return refusedFunding(
      'allocationWeightUnavailable',
      unstateableWeights.map((actionId) =>
        `Conversion "${actionId}" has no stateable taxable principal to allocate by.`),
    )
  }

  const built = buildConversionTaxFundingAnnualGroupEvidence({
    taxUnit: input.taxUnit,
    baselineAnnualTaxLiabilityEvidenceId:
      baseline.identity.annualTaxLiabilityEvidenceId,
    candidateAnnualTaxLiabilityEvidenceId:
      candidate.identity.annualTaxLiabilityEvidenceId,
    baselineAnnualTaxLiability: baseline.liability,
    candidateAnnualTaxLiability: candidate.liability,
    members: orderedMembers.map((member) => ({
      conversionActionId: member.conversionActionId,
      conversionPersonId: member.conversionPersonId,
      allocationWeight: member.allocationWeight,
      fundedAmount: member.fundedAmount,
    })),
  })
  if (!built.ok) {
    return refusedFunding('annualGroupUnbuildable', built.issues)
  }
  return {
    status: 'annualGroupEvaluated' as const,
    taxUnit: input.taxUnit,
    baselineRun: baseline.identity,
    candidateRun: candidate.identity,
    taxInputSnapshotsShared:
      baseline.identity.taxInputSnapshotId === candidate.identity.taxInputSnapshotId,
    members: built.members,
  }
}

/**
 * Execute the year's conversion-linked withdrawal groups: stage them, evidence
 * them, and refuse them.
 *
 * Pure and total. Every refusal is a typed status, because the caller is inside
 * a projection year that must fail closed rather than abort the projection, and
 * because an executor whose failure mode is a throw would make the funding
 * evaluation's availability a property of how well the year happened to go.
 */
export function executeConversionLinkedWithdrawalGroups(
  input: Readonly<ExecuteConversionLinkedWithdrawalGroupsInput>,
): Readonly<ExecuteConversionLinkedWithdrawalGroupsResult> {
  const ordering = orderingFor(input.taxYear, input.requests, input.assessment)
  const funding = evaluateFunding(input, ordering)
  const positionByActionId = new Map(
    (ordering?.positions ?? []).map((position) => [position.actionId, position]),
  )
  const evidenceByConversionActionId = new Map(
    funding.status === 'annualGroupEvaluated'
      ? funding.members.map((member) => [member.conversionActionId, member] as const)
      : [],
  )
  const movementByPair = new Map(
    (input.movements ?? []).map((movement) =>
      [
        JSON.stringify([
          movement.conversionActionId,
          movement.withdrawalActionId,
        ]),
        movement,
      ] as const),
  )
  const groups = input.assessment.groups.map(
    (group): Readonly<ConversionLinkedWithdrawalGroupExecutionRecord> => {
      const conversionPosition =
        positionByActionId.get(group.conversionActionId) ?? null
      const withdrawalPosition =
        positionByActionId.get(group.withdrawalActionId) ?? null
      const movement = movementByPair.get(JSON.stringify([
        group.conversionActionId,
        group.withdrawalActionId,
      ]))
      const conversionAuthored = movement?.conversion.authoredAmount ?? ZERO_CENTS
      const withdrawalAuthored = movement?.withdrawal.authoredAmount ?? ZERO_CENTS
      const conversionExecuted = movement?.conversion.executedAmount ?? ZERO_CENTS
      const withdrawalExecuted = movement?.withdrawal.executedAmount ?? ZERO_CENTS
      const bothLegsWhole =
        conversionExecuted > 0 && withdrawalExecuted > 0 &&
        conversionExecuted === conversionAuthored &&
        withdrawalExecuted === withdrawalAuthored
      const neitherLegMoved = conversionExecuted === 0 && withdrawalExecuted === 0
      const evidence =
        evidenceByConversionActionId.get(group.conversionActionId) ?? null
      return {
        groupId: group.groupId,
        personId: group.personId,
        year: group.year,
        conversionActionId: group.conversionActionId,
        withdrawalActionId: group.withdrawalActionId,
        disposition: group.disposition,
        refusalKind: group.refusalKind,
        reasonCode: group.reasonCode,
        movement: bothLegsWhole ? 'bothLegs' as const : 'none' as const,
        // Anything between the two is incoherent: a leg that moved beside one
        // that did not, or a leg that moved an amount nobody authored. A
        // released pair that moved nothing is incoherent too — the release was
        // permission for a movement, and its absence means an executor
        // disregarded the verdict.
        //
        // And the funding the evaluation was built from has to be the cents
        // this withdrawal actually moved. That is the conservation check across
        // the two legs: `fundedAmount` reaches the evaluation as a caller-
        // supplied figure, and a caller that supplied a funded amount its own
        // withdrawal did not move would balance the allocation against dollars
        // that never left an account.
        movementCoherent: (bothLegsWhole || neitherLegMoved) &&
          (group.disposition === 'executedAsAtomicGroup') === bothLegsWhole &&
          (evidence === null || evidence.fundedAmount === withdrawalExecuted),
        conversionExecutedAmount: conversionExecuted,
        withdrawalExecutedAmount: withdrawalExecuted,
        conversionAuthoredAmount: conversionAuthored,
        withdrawalAuthoredAmount: withdrawalAuthored,
        conversionPosition,
        withdrawalPosition,
        orderingComplete: conversionPosition !== null &&
          withdrawalPosition !== null &&
          conversionPosition.scheduleValid &&
          withdrawalPosition.scheduleValid,
        fundingEvidence: evidence,
      }
    },
  )
  // Claimed only when nothing in the year disagrees: every group released,
  // every group's legs both whole and coherent, and every member's own
  // evaluation a satisfied fixed point over this run's liabilities.
  const executed = groups.length > 0 &&
    funding.status === 'annualGroupEvaluated' &&
    funding.members.every((member) => member.evaluation === 'satisfied') &&
    groups.every((group) =>
      group.disposition === 'executedAsAtomicGroup' &&
      group.movement === 'bothLegs' &&
      group.movementCoherent &&
      group.orderingComplete &&
      group.fundingEvidence !== null)
  return deepFreeze({
    status: executed ? 'executed' as const : 'refused' as const,
    movement: executed ? 'bothLegs' as const : 'none' as const,
    taxYear: input.taxYear,
    ordering,
    groups,
    funding,
  })
}

/**
 * Why the year's groups were not released.
 *
 * Each is a proof that did not arrive, and none of them is a defect: a year
 * whose withdrawal was authored a cent short of what the conversions turned out
 * to cost is a plan that does not fund itself, and saying so is the whole
 * answer.
 */
export type ConversionLinkedWithdrawalGroupAuthorizationWithheldKind =
  /** The staging run had no group to stage. */
  | 'noAnnualGroup'
  /** The staging run's own executor refused, so nothing was staged. */
  | 'stagingRefused'
  /** A group's two legs did not both move their whole authored amount. */
  | 'stagingMovementIncomplete'
  /** A withdrawal named by two conversions is dedicated to neither. */
  | 'sharedFundingWithdrawal'
  /** The annual funding evaluation could not be built from the staging run. */
  | 'fundingUnevaluated'
  /** The funding evaluation reached a mismatch rather than a fixed point. */
  | 'fundingMismatched'

export interface ConversionLinkedWithdrawalGroupAuthorized {
  readonly status: 'conversionLinkedWithdrawalGroupsAuthorized'
  readonly taxYear: number
  readonly authorizations:
    readonly Readonly<ConversionLinkedWithdrawalGroupAuthorization>[]
}

export interface ConversionLinkedWithdrawalGroupAuthorizationWithheld {
  readonly status: 'conversionLinkedWithdrawalGroupsWithheld'
  readonly taxYear: number
  readonly reason: ConversionLinkedWithdrawalGroupAuthorizationWithheldKind
  readonly issues: readonly string[]
}

export type ConversionLinkedWithdrawalGroupAuthorizationResult =
  | Readonly<ConversionLinkedWithdrawalGroupAuthorized>
  | Readonly<ConversionLinkedWithdrawalGroupAuthorizationWithheld>

/**
 * Read a staging run's own group execution and say whether the run that commits
 * may release the same groups.
 *
 * This is the commit path, and it is a function of a discarded run rather than
 * of the run it authorises — which is the only shape the arithmetic admits.
 * `T1(F)` is "the unit's annual liability with the conversions present, funded
 * as stated", so it exists only in a run where the group already moved; a gate
 * that demanded the fixed point *before* letting anything move would be asking
 * for a figure that only movement produces. So a whole annual pass is run with
 * the groups provisionally released, its liability and its actual funding
 * vector are read off it, its evaluation is checked, and the pass is thrown
 * away. What survives is this permission.
 *
 * Every condition is required of *every* group, and the result is all or
 * nothing. Releasing a subset would give the committed run a different funding
 * vector from the staged one, and the proof would then be about a run that did
 * not happen.
 *
 * Note what is deliberately *not* trusted here: the staging run's own
 * `status === 'executed'`. That field is this module's summary of the same
 * facts, and reading a summary of the facts instead of the facts would make the
 * gate agree with itself by construction. The movement, the coherence, the
 * evaluation and the disposition are each read directly.
 */
export function authorizeConversionLinkedWithdrawalGroups(
  staging: Readonly<ExecuteConversionLinkedWithdrawalGroupsResult>,
): Readonly<ConversionLinkedWithdrawalGroupAuthorizationResult> {
  const taxYear = staging.taxYear
  if (staging.groups.length === 0) {
    return deepFreeze({
      status: 'conversionLinkedWithdrawalGroupsWithheld' as const,
      taxYear,
      reason: 'noAnnualGroup' as const,
      issues: [],
    })
  }
  const contested = staging.groups.filter((group) =>
    group.refusalKind === 'sharedFundingWithdrawal')
  if (contested.length > 0) {
    return deepFreeze({
      status: 'conversionLinkedWithdrawalGroupsWithheld' as const,
      taxYear,
      reason: 'sharedFundingWithdrawal' as const,
      issues: contested
        .map((group) =>
          `Withdrawal "${group.withdrawalActionId}" is named by more than one conversion.`)
        .sort(compareUtf16CodeUnits),
    })
  }
  const incomplete = staging.groups.filter((group) =>
    group.movement !== 'bothLegs' || !group.movementCoherent ||
    !group.orderingComplete)
  if (incomplete.length > 0) {
    return deepFreeze({
      status: 'conversionLinkedWithdrawalGroupsWithheld' as const,
      taxYear,
      reason: incomplete.every((group) =>
        group.conversionExecutedAmount === 0 &&
        group.withdrawalExecutedAmount === 0)
        ? 'stagingRefused' as const
        : 'stagingMovementIncomplete' as const,
      issues: incomplete
        .map((group) =>
          `Group "${group.groupId}" staged ${group.conversionExecutedAmount} of ${group.conversionAuthoredAmount} conversion cents and ${group.withdrawalExecutedAmount} of ${group.withdrawalAuthoredAmount} withdrawal cents.`)
        .sort(compareUtf16CodeUnits),
    })
  }
  if (staging.funding.status !== 'annualGroupEvaluated') {
    return deepFreeze({
      status: 'conversionLinkedWithdrawalGroupsWithheld' as const,
      taxYear,
      reason: 'fundingUnevaluated' as const,
      issues: [...staging.funding.issues],
    })
  }
  const evaluation = staging.funding
  const mismatched = evaluation.members.filter((member) =>
    member.evaluation !== 'satisfied')
  if (mismatched.length > 0) {
    return deepFreeze({
      status: 'conversionLinkedWithdrawalGroupsWithheld' as const,
      taxYear,
      reason: 'fundingMismatched' as const,
      issues: mismatched
        .map((member) =>
          `Conversion "${member.conversionActionId}" funded ${member.fundedAmount} against a required ${member.requiredFundingAmount}.`)
        .sort(compareUtf16CodeUnits),
    })
  }
  const memberByConversionActionId = new Map(
    evaluation.members.map((member) => [member.conversionActionId, member] as const),
  )
  const authorizations: ConversionLinkedWithdrawalGroupAuthorization[] = []
  for (const group of staging.groups) {
    const member = memberByConversionActionId.get(group.conversionActionId)
    if (member === undefined) {
      return deepFreeze({
        status: 'conversionLinkedWithdrawalGroupsWithheld' as const,
        taxYear,
        reason: 'fundingUnevaluated' as const,
        issues: [
          `Conversion "${group.conversionActionId}" moved with no member evaluation of its own.`,
        ],
      })
    }
    authorizations.push({
      conversionActionId: group.conversionActionId,
      withdrawalActionId: group.withdrawalActionId,
      funding: {
        requiredFundingAmount: member.requiredFundingAmount,
        fundedAmount: member.fundedAmount,
      },
    })
  }
  return deepFreeze({
    status: 'conversionLinkedWithdrawalGroupsAuthorized' as const,
    taxYear,
    authorizations: authorizations.sort((left, right) =>
      compareUtf16CodeUnits(left.conversionActionId, right.conversionActionId)),
  })
}
