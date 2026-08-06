import type { RetirementActionEligibilityRuntimeEvidence } from '../strategies/accountEligibility.js'
import type { RetirementActionRequest } from './contract.js'
import type { ActionId, PersonId } from './identity.js'
import type { UsdCents } from './money.js'
import type { ActionReason } from './reasons.js'
import { compareUtf16CodeUnits, deriveActionStructuralId } from './structuralId.js'

/**
 * What the annual group decision says about one conversion and the withdrawal
 * that funds it.
 *
 * There are two dispositions and exactly one of them releases dollars. This is
 * the permission gate the whole pathway hangs off: `actions/execution.ts`
 * refuses the withdrawal leg on it and `actions/rothConversionExecution.ts`
 * refuses the conversion leg on it, from *one* verdict, so the two legs cannot
 * answer the same group question differently. Atomicity is that shared answer
 * rather than a reconciliation of two.
 *
 * `executedAsAtomicGroup` is not a permission a caller may simply assert. It is
 * produced only by `assessConversionLinkedWithdrawalGroups` from an
 * authorization the caller has to have proved, and the proof is
 * `authorizeConversionLinkedWithdrawalGroups` in
 * `conversionLinkedWithdrawalGroupExecution.ts`: a staging run in which both
 * legs of every group moved their whole authored amount, whose annual funding
 * evaluation reached a `satisfied` fixed point over the group's actual funding
 * vector. Anything short of that keeps the refusal that shipped.
 *
 * Note what this still deliberately does *not* widen into. The contested case —
 * two conversions naming one withdrawal — refuses, and it would have been
 * natural to give it its own disposition. It does not get one, because
 * `disposition` is the permission gate and the contested case answers that gate
 * the same way the pending one does: no. What differs between them is why, and
 * that is `refusalKind` below. Keeping the two apart is what lets this union go
 * on meaning "may these dollars move" rather than degrading into a count of
 * refusal flavours.
 */
export type ConversionLinkedWithdrawalGroupDisposition =
  | 'refusedPendingGroupExecution'
  | 'executedAsAtomicGroup'

/**
 * Why a refused group was refused.
 *
 * `pendingGroupExecution` is the staging gap: the pair is well formed and
 * lawful, and the arm that would move it as one transaction is what is missing.
 *
 * `sharedFundingWithdrawal` is a refusal on the merits. The contract requires a
 * conversion's `withdrawalActionId` to resolve to one **dedicated** withdrawal;
 * a withdrawal named by two conversions is dedicated to neither, so neither
 * pair is well formed. Every conversion contesting that withdrawal refuses, and
 * so does the withdrawal — there is no winner to pick. Letting the pair holding
 * the withdrawal's own back-reference win was available and is refused: it
 * would require rewriting both publication linkage assertions, because the
 * losing conversion resolves to the *same* withdrawal record and
 * `assertLinkedWithdrawalRecordAtomicity` would then see one leg that moved
 * beside one that did not.
 */
export type ConversionLinkedWithdrawalGroupRefusalKind =
  | 'pendingGroupExecution'
  | 'sharedFundingWithdrawal'

/**
 * Whether the filing unit's baseline annual liability was available to the
 * caller that took this assessment.
 *
 * This is the input that decides between the two reason codes below, and it is
 * a fact about the run rather than about the pair. `T0` — the unit's annual
 * liability recomputed with the group removed — is what makes a linked group's
 * required funding amount computable at all. A caller that ran the
 * counterfactual pass and read one states `read`; a caller that could not, or
 * did not, states `unavailable`, which is the default because it is what every
 * caller could say before the counterfactual pass existed.
 */
export type ConversionLinkedWithdrawalGroupAnnualLiabilityBaseline =
  | 'read'
  | 'unavailable'

/**
 * The reasons a linked group can carry, and which of them applies when.
 *
 * The two codes are not interchangeable and the difference is whose failure
 * they describe. `conversion-tax-funding-evidence-unsupported` is classified
 * `unsupported`: the engine could not obtain the tax inputs the funding
 * question needs, so it declines to answer. `conversion-tax-funding-unallocated`
 * is classified `refused`: the inputs were available, the required amount was
 * computed, and the funding did not execute or did not reconcile to it.
 *
 * Before a `T0` producer existed, every linked group was honestly the first:
 * the required amount was genuinely unobtainable. That stops being true for a
 * run that read a baseline, and this is where it stops.
 */
export type ConversionLinkedWithdrawalGroupReasonCode = Extract<
  ActionReason['code'],
  'conversion-tax-funding-evidence-unsupported' | 'conversion-tax-funding-unallocated'
>

/**
 * The proved funding figures a released group carries to its conversion leg.
 *
 * Carried on the verdict rather than recomputed by the conversion executor, and
 * that is the point rather than a convenience. The required amount is
 * `max(0, T1(F) - T0)` allocated across the filing unit's conversions, which
 * only a whole annual pass can produce; an executor that derived its own would
 * be inventing the one figure the pathway exists to stop anyone inventing. What
 * it publishes as `funded` is therefore what it was proved, and the proof
 * travels with the permission.
 *
 * `annualGroupId` names the filing unit and year the allocation belongs to, so
 * a conversion cannot publish a share of some other unit's liability and still
 * balance.
 */
export interface ConversionLinkedWithdrawalGroupFundingAuthority {
  readonly annualGroupId: string
  /** This conversion's share of the unit's quantized required funding. */
  readonly requiredFundingAmount: UsdCents
  /** Its dedicated withdrawal's executed cents, which equal that share. */
  readonly fundedAmount: UsdCents
}

/**
 * One (conversion, withdrawal) pair a caller has proved may move as a unit.
 *
 * The pair is named rather than the conversion alone because the permission is
 * about two requests: a conversion released against a withdrawal other than the
 * one it names would be funded by dollars nobody linked to it.
 */
export interface ConversionLinkedWithdrawalGroupAuthorization {
  readonly conversionActionId: ActionId
  readonly withdrawalActionId: ActionId
  readonly funding: Readonly<ConversionLinkedWithdrawalGroupFundingAuthority>
}

/**
 * One conversion, the withdrawal it names, and the single answer both
 * executors owe that pair.
 *
 * The two executors run in different simulator phases over different request
 * sets, and each used to answer this question from what it alone could see:
 * `execution.ts` scanned the Plan for a conversion naming the withdrawal, and
 * `rothConversionExecution.ts` read the conversion's own funding kind. Two
 * derivations of one group decision can disagree — the withdrawal executor
 * cannot see a conversion that is in flight rather than in the Plan — and a
 * disagreeing pair is not publishable at all:
 * `assertLinkedWithdrawalRecordAtomicity` throws rather than publishing one
 * side that moved beside one that did not. So the group is assessed once, by
 * the caller that can see both request sets, and both executors honour that
 * verdict instead of deriving a second one.
 *
 * The two arms are a discriminated union rather than one shape with nullable
 * fields, so the compiler is what stops a released pair from carrying a refusal
 * reason and a refused one from carrying funding permission. Both gate sites
 * narrow on `disposition` already; narrowing is now what gives them the rest.
 *
 * Membership is matched on `withdrawalActionId` alone. There is no person
 * predicate and no year predicate, so a conversion in one year naming a
 * withdrawal in another is still one group, and `personId`/`year` below are
 * carried as identity rather than read as constraints. That is deliberate and
 * preserved from the scan this replaced: narrowing membership to a shared
 * person-year would stop refusing the cross-year withdrawal and thereby
 * release it to move, which is a money decision and not this slice's. The
 * consequence — a cross-year pair that refuses here and then throws in
 * publication, because one year's published requests cannot contain the other
 * year's conversion — is a pre-existing latent crash, flagged in the pull
 * request description as its own slice.
 */
interface ConversionLinkedWithdrawalGroupVerdictBase {
  /** Structural identity of the assessed group, derived from its members. */
  readonly groupId: string
  /**
   * The conversion's owner, carried as identity. Membership does not test it,
   * so the named withdrawal is not guaranteed to share it.
   */
  readonly personId: PersonId
  /**
   * The conversion's action year, carried as identity. Membership does not
   * test it, so the named withdrawal is not guaranteed to share it.
   */
  readonly year: number
  readonly conversionActionId: ActionId
  readonly withdrawalActionId: ActionId
  /**
   * Every conversion naming this group's withdrawal, this one included, sorted
   * — and empty for the ordinary case.
   *
   * Carried rather than recomputed because the contest is a property of the
   * whole request set and a verdict read on its own would otherwise be unable
   * to say why it refused on the merits. A single-element list would be
   * indistinguishable from the uncontested case, so the uncontested case says
   * nothing at all instead.
   */
  readonly contestingConversionActionIds: readonly ActionId[]
}

/**
 * The pair may not move, and this is why.
 *
 * `reasonCode` is a staging gap or a refusal on the merits depending on
 * `refusalKind` and on whether the run held a baseline; either way both legs
 * carry it and neither moves.
 */
export interface ConversionLinkedWithdrawalGroupRefusedVerdict
  extends ConversionLinkedWithdrawalGroupVerdictBase {
  readonly disposition: 'refusedPendingGroupExecution'
  readonly refusalKind: ConversionLinkedWithdrawalGroupRefusalKind
  readonly reasonCode: ConversionLinkedWithdrawalGroupReasonCode
  /** Null by the type: a refused pair has no funding to publish. */
  readonly fundingAuthority: null
}

/**
 * The pair may move, together, and this is what was proved about its funding.
 *
 * There is no `refusalKind` and no `reasonCode` on this arm, because a released
 * pair is not refused for any reason and a nullable field would have let one
 * survive an edit that changed the disposition.
 */
export interface ConversionLinkedWithdrawalGroupExecutedVerdict
  extends ConversionLinkedWithdrawalGroupVerdictBase {
  readonly disposition: 'executedAsAtomicGroup'
  readonly refusalKind: null
  readonly reasonCode: null
  readonly fundingAuthority:
    Readonly<ConversionLinkedWithdrawalGroupFundingAuthority>
}

export type ConversionLinkedWithdrawalGroupVerdict =
  | Readonly<ConversionLinkedWithdrawalGroupRefusedVerdict>
  | Readonly<ConversionLinkedWithdrawalGroupExecutedVerdict>

/** Every linked group the caller could see across both executors' requests. */
export interface ConversionLinkedWithdrawalGroupAssessment {
  readonly groups: readonly ConversionLinkedWithdrawalGroupVerdict[]
}

/**
 * Runtime evidence widened by the conversion facts a group decision needs.
 *
 * The eligibility evidence answers one request at a time. A group verdict
 * cannot be derived that way — it is about two requests that reach two
 * different executors — so it is carried alongside rather than folded in.
 */
export interface RetirementActionGroupRuntimeEvidence
  extends RetirementActionEligibilityRuntimeEvidence {
  readonly conversionLinkedWithdrawalGroups?:
    Readonly<ConversionLinkedWithdrawalGroupAssessment>
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value !== null && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child)
    Object.freeze(value)
  }
  return value as Readonly<T>
}

/**
 * Assess every conversion-linked withdrawal group in one pass over the union
 * of both executors' requests.
 *
 * A group is named by the conversion: a conversion whose tax funding is a
 * linked withdrawal states which withdrawal must move with it. The named
 * withdrawal does not have to be present for the group to exist — a
 * conversion that names a withdrawal nobody scheduled is still a conversion
 * that cannot fund itself — so membership is read off the conversion side and
 * the withdrawal side is matched to it by identifier.
 *
 * Duplicated requests collapse. The same conversion routinely arrives twice,
 * once from `plan.strategies.retirementActions` and once from the annual
 * request set, and a group named twice is still one group.
 *
 * Take this over the union of both executors' requests. An assessment that
 * omits a group either executor can see for itself is a contradiction rather
 * than a release: both fail closed on one instead of moving money against it.
 *
 * The contest is settled here rather than at publication, and that is the
 * change this slice makes to the shape. `assertLinkedWithdrawalRequests` used
 * to be the only thing that noticed two conversions naming one withdrawal, and
 * it noticed by throwing — a malformed Plan crashed the projection instead of
 * refusing inside it. The verdict now names the contest, both executors refuse
 * on it, and publication is left asserting that nothing moved rather than
 * aborting.
 *
 * **Releasing a pair.** `authorizedGroups` is how a caller that proved a group
 * may move says so, and three properties of how it is read are the whole of the
 * release discipline.
 *
 * It is *matched on the pair*, so an authorization naming this conversion
 * against some other withdrawal releases nothing: the permission is about the
 * two requests together.
 *
 * It *cannot release a contested pair*. A withdrawal two conversions both name
 * is dedicated to neither, and no proof about funding changes that — so a
 * contested candidate keeps `sharedFundingWithdrawal` even when it is listed.
 * This is defence in depth: the authorizer refuses contested pairs too, and
 * that it refuses them is not the reason they cannot move here.
 *
 * It is *all or nothing across the assessment*. An authorization list that does
 * not cover every group the requests contain releases none of them. The reason
 * is the funding vector: the required amount is `max(0, T1(F) − T0)` for the
 * unit's whole annual group, and a run that released a subset would have a
 * different vector from the one the authority was proved against — so the proof
 * would no longer be a proof about the run that used it.
 */
export function assessConversionLinkedWithdrawalGroups(
  requests: readonly Readonly<RetirementActionRequest>[],
  options?: Readonly<{
    /** Defaults to `unavailable`: the answer of every caller without a `T0`. */
    annualLiabilityBaseline?: ConversionLinkedWithdrawalGroupAnnualLiabilityBaseline
    /** Pairs a staging run proved may move. Defaults to none. */
    authorizedGroups?:
      readonly Readonly<ConversionLinkedWithdrawalGroupAuthorization>[]
  }>,
): Readonly<ConversionLinkedWithdrawalGroupAssessment> {
  const baseline = options?.annualLiabilityBaseline ?? 'unavailable'
  const authorizationByPair = new Map(
    (options?.authorizedGroups ?? []).map((authorization) =>
      [
        JSON.stringify([
          authorization.conversionActionId,
          authorization.withdrawalActionId,
        ]),
        authorization,
      ] as const),
  )
  interface Candidate {
    readonly conversionActionId: ActionId
    readonly withdrawalActionId: ActionId
    readonly personId: PersonId
    readonly year: number
  }
  const candidates = new Map<string, Candidate>()
  const conversionIdsByWithdrawalId = new Map<ActionId, ActionId[]>()
  for (const request of requests) {
    if (
      request.kind !== 'rothConversion' ||
      request.taxFunding.kind !== 'linkedWithdrawal'
    ) continue
    const withdrawalActionId = request.taxFunding.withdrawalActionId
    const key = JSON.stringify([request.actionId, withdrawalActionId])
    if (candidates.has(key)) continue
    candidates.set(key, {
      conversionActionId: request.actionId,
      withdrawalActionId,
      personId: request.personId,
      year: request.year,
    })
    const contesting = conversionIdsByWithdrawalId.get(withdrawalActionId)
    if (contesting === undefined) {
      conversionIdsByWithdrawalId.set(withdrawalActionId, [request.actionId])
    } else {
      contesting.push(request.actionId)
    }
  }
  const candidateList = [...candidates.values()]
  // Every group present, or none released. Counted over the candidate pairs
  // themselves rather than over the authorization list, so an authorization for
  // a pair these requests do not contain can neither complete the cover nor
  // release anything.
  const releasableCandidates = candidateList.filter((candidate) =>
    (conversionIdsByWithdrawalId.get(candidate.withdrawalActionId)?.length ?? 0)
      <= 1 &&
    authorizationByPair.has(JSON.stringify([
      candidate.conversionActionId,
      candidate.withdrawalActionId,
    ])))
  const releaseCoversEveryGroup =
    candidateList.length > 0 &&
    releasableCandidates.length === candidateList.length
  const groups = candidateList
    .map((candidate): ConversionLinkedWithdrawalGroupVerdict => {
      const contesting = conversionIdsByWithdrawalId
        .get(candidate.withdrawalActionId) ?? []
      const contested = contesting.length > 1
      const base = {
        groupId: deriveActionStructuralId(
          'retirement-action-conversion-linked-withdrawal-group',
          [
            candidate.conversionActionId,
            candidate.withdrawalActionId,
            candidate.personId,
            candidate.year,
          ],
        ),
        personId: candidate.personId,
        year: candidate.year,
        conversionActionId: candidate.conversionActionId,
        withdrawalActionId: candidate.withdrawalActionId,
        contestingConversionActionIds: contested
          ? [...contesting].sort(compareUtf16CodeUnits)
          : [],
      }
      const authorization = contested || !releaseCoversEveryGroup
        ? undefined
        : authorizationByPair.get(JSON.stringify([
          candidate.conversionActionId,
          candidate.withdrawalActionId,
        ]))
      if (authorization !== undefined) {
        return {
          ...base,
          disposition: 'executedAsAtomicGroup',
          refusalKind: null,
          reasonCode: null,
          fundingAuthority: { ...authorization.funding },
        }
      }
      return {
        ...base,
        disposition: 'refusedPendingGroupExecution',
        refusalKind: contested ? 'sharedFundingWithdrawal' : 'pendingGroupExecution',
        // A contested withdrawal is refused on the merits whatever the run
        // could compute: no baseline liability makes a shared withdrawal
        // dedicated. The uncontested pair is refused on the merits only once
        // the run held the inputs to say what the funding should have been.
        reasonCode: contested || baseline === 'read'
          ? 'conversion-tax-funding-unallocated'
          : 'conversion-tax-funding-evidence-unsupported',
        fundingAuthority: null,
      }
    })
    .sort(
      (left, right) =>
        compareUtf16CodeUnits(left.conversionActionId, right.conversionActionId) ||
        compareUtf16CodeUnits(left.withdrawalActionId, right.withdrawalActionId),
    )
  return deepFreeze({ groups })
}

/** The group verdict this conversion must honour, if it is in one. */
export function conversionLinkedWithdrawalGroupForConversion(
  assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
  conversionActionId: ActionId,
): Readonly<ConversionLinkedWithdrawalGroupVerdict> | null {
  return assessment.groups.find(
    (group) => group.conversionActionId === conversionActionId,
  ) ?? null
}

/**
 * The group verdict this withdrawal must honour, if it is in one.
 *
 * A withdrawal can be named by more than one conversion, so this can have more
 * than one candidate and returns the first in the assessment's sorted order.
 * That stays answer-invariant, and the reason has moved rather than gone away.
 * It used to rest on `disposition` having a single member. It now rests on the
 * contest itself: a withdrawal with two candidates makes every one of them
 * `sharedFundingWithdrawal` carrying `conversion-tax-funding-unallocated`, so
 * the candidates are indistinguishable in everything a withdrawal reads off
 * them. Which one is returned still cannot change what the withdrawal does.
 * That survives the executable arm precisely because a contested pair can never
 * take it — multiplicity is checked before the authorization is read, so a
 * withdrawal with two candidates has two refusals and no release to choose
 * between.
 * Callers checking whether an assessment is complete must key on the
 * (conversion, withdrawal) pair instead of asking this, which cannot
 * distinguish "answered" from "answered for one of several".
 */
export function conversionLinkedWithdrawalGroupForWithdrawal(
  assessment: Readonly<ConversionLinkedWithdrawalGroupAssessment>,
  withdrawalActionId: ActionId,
): Readonly<ConversionLinkedWithdrawalGroupVerdict> | null {
  return assessment.groups.find(
    (group) => group.withdrawalActionId === withdrawalActionId,
  ) ?? null
}
