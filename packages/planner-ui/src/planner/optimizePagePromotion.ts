/**
 * Reading a promoted conversion schedule, and installing it.
 *
 * The tournament publishes a promoted winner as a plan patch plus the action
 * request IDs that patch installs. THE PATCH IS THE RECOMMENDATION: applying it
 * puts named requests on the plan, each one carrying its person, source
 * accounts and Roth destination. Re-installing `winnerConversions` as an
 * aggregate strategy would put back exactly the schedule that names nobody,
 * which is the schedule the readiness veto exists to withhold.
 *
 * Everything here is pure over `(plan, promotion)`, so the load-bearing apply
 * contract is unit-testable without rendering.
 */

import type { Plan } from '@retiregolden/engine/model/plan'
import type {
  ClaimAgeCoOptimization,
  RetirementActionPromotion,
  RetirementActionPromotionYear,
} from '@retiregolden/engine/projection/optimizePlan'
import { applyScenarioPatch } from '@retiregolden/engine/scenarios/scenarios'

import { planWithWinningClaim } from './optimizePageClaim'
import { classifiableIraAccounts, iraClassificationFor } from './retirementActionEligibilityFacts'

/** The two verdicts that carry an installable schedule. */
export type PublishedRetirementActionPromotion = Extract<
  RetirementActionPromotion,
  { outcome: 'equivalent' | 'repriced' }
>

/** The three verdicts that publish nothing and name why. */
export type WithheldRetirementActionPromotion = Exclude<
  RetirementActionPromotion,
  { outcome: 'equivalent' | 'repriced' }
>

export function publishedPromotion(
  promotion: RetirementActionPromotion | null | undefined,
): PublishedRetirementActionPromotion | null {
  if (promotion === null || promotion === undefined) return null
  return promotion.outcome === 'equivalent' || promotion.outcome === 'repriced' ? promotion : null
}

export function withheldPromotion(
  promotion: RetirementActionPromotion | null | undefined,
): WithheldRetirementActionPromotion | null {
  if (promotion === null || promotion === undefined) return null
  return promotion.outcome === 'equivalent' || promotion.outcome === 'repriced' ? null : promotion
}

/** One source account's share of one named conversion. */
export interface PromotedConversionRow {
  readonly actionId: string
  readonly allocationId: string
  readonly year: number
  readonly ownerName: string
  readonly sourceAccountName: string
  readonly destinationAccountName: string
  readonly amountCents: number
}

export type PromotedScheduleRead =
  | Readonly<{
    status: 'read'
    /** The plan the recommendation installs, already parsed through the schema. */
    plan: Plan
    rows: readonly PromotedConversionRow[]
  }>
  | Readonly<{
    /**
     * The patch did not produce the named requests. Nothing is offered for
     * applying: `issues` carries whatever the plan schema said, and may be
     * empty when the patch parsed but did not install what it claimed.
     */
    status: 'unreadable'
    issues: readonly string[]
  }>

/**
 * Materialize a promoted schedule against a plan and describe it row by row.
 *
 * FAIL CLOSED IN BOTH DIRECTIONS: the installed action IDs must be exactly the
 * ones the promotion names, each one must be a conversion request, and the
 * aggregate conversion strategy must be off in the patched plan. A patch that
 * parsed but installed something else, or that left the aggregate strategy
 * running beside the named requests to convert the same dollars twice, is not
 * a schedule this surface may present, let alone apply.
 */
export function readPromotedSchedule(
  plan: Readonly<Plan>,
  promotion: PublishedRetirementActionPromotion,
): PromotedScheduleRead {
  const applied = applyScenarioPatch(plan, promotion.planPatch)
  if (!applied.ok) return { status: 'unreadable', issues: applied.issues }

  if (applied.plan.strategies.rothConversion.mode !== 'none') {
    return { status: 'unreadable', issues: [] }
  }

  const named = [...promotion.actionRequestIds]
  const installed = applied.plan.strategies.retirementActions
  const installedIds = installed.map((action) => action.actionId)
  if (installedIds.length !== named.length ||
      installedIds.some((actionId, index) => actionId !== named[index])) {
    return { status: 'unreadable', issues: [] }
  }

  const personName = new Map(applied.plan.household.people.map((person) => [person.id, person.name]))
  const accountName = new Map(applied.plan.accounts.map((account) => [account.id, account.name]))
  const rows: PromotedConversionRow[] = []
  for (const action of installed) {
    if (action.kind !== 'rothConversion') return { status: 'unreadable', issues: [] }
    const destination = String(action.destinationRothAccountId)
    for (const allocation of action.allocations) {
      const source = String(allocation.sourceAccountId)
      rows.push({
        actionId: action.actionId,
        allocationId: String(allocation.allocationId),
        year: action.year,
        ownerName: personName.get(String(action.personId)) ?? String(action.personId),
        sourceAccountName: accountName.get(source) ?? source,
        destinationAccountName: accountName.get(destination) ?? destination,
        amountCents: allocation.requestedAmount,
      })
    }
  }
  return { status: 'read', plan: applied.plan, rows }
}

/**
 * The plan a promoted recommendation installs: the winning claim change (when
 * one won) and the named conversion requests, together. The schedule was priced
 * against the claim-patched plan, so the claim change has to go on first.
 */
export function promotedRecommendationPlan(
  plan: Readonly<Plan>,
  args: {
    readonly claimAge: ClaimAgeCoOptimization | null
    readonly promotion: PublishedRetirementActionPromotion
  },
): PromotedScheduleRead {
  return readPromotedSchedule(planWithWinningClaim(plan, args.claimAge), args.promotion)
}

/**
 * Whether the promotion verdict alone forbids Apply.
 *
 * TWO SEPARATE REFUSALS, and they are refusals for different reasons:
 *
 * - A withheld verdict published nothing. The aggregate schedule on screen is
 *   exploratory, and installing it is exactly what the readiness veto exists to
 *   prevent. (The page's own `identityIncomplete` arm also blocks it; stating it
 *   here keeps the promotion's half of the contract in one testable place.)
 * - A published verdict whose patch did not read back onto this plan has no
 *   requests to install, and the aggregate schedule is not a substitute for
 *   them.
 */
export function promotionBlocksApply(
  promotion: RetirementActionPromotion | null | undefined,
  read: PromotedScheduleRead | null,
): boolean {
  if (withheldPromotion(promotion) !== null) return true
  return read !== null && read.status === 'unreadable'
}

/** Total conversion dollars in a per-year schedule. */
export function scheduleConversionTotal(
  conversions: readonly { year: number; amount: number }[],
): number {
  return conversions.reduce((sum, conversion) => sum + conversion.amount, 0)
}

/** One owner whose share no lawful Roth IRA could receive. */
export type RetirementActionPromotionTrim = RetirementActionPromotionYear['trims'][number]

/**
 * Distinct trimmed owners across every promoted year, in first-seen order. A
 * trim repeats in every year the schedule converts, and repeating its sentence
 * would read as a fresh finding each time.
 */
export function promotionTrimmedOwners(
  years: readonly RetirementActionPromotionYear[],
): readonly RetirementActionPromotionTrim[] {
  const seen = new Set<string>()
  const owners: RetirementActionPromotionTrim[] = []
  for (const year of years) {
    for (const trim of year.trims) {
      const key = `${trim.ownerPersonId}\u0000${trim.reason}`
      if (seen.has(key)) continue
      seen.add(key)
      owners.push(trim)
    }
  }
  return owners
}

/**
 * The traditional IRAs this plan could classify and has not.
 *
 * Plan-derived, not read off an engine sentence: the facts editor accepts a
 * classification for exactly these accounts, and an absent record is the one
 * thing a household can act on from here. It is not evidence that recording
 * them would produce a recommendation, and the copy does not say it is.
 */
export function unclassifiedIraSourceAccounts(
  plan: Readonly<Plan>,
): readonly { readonly id: string; readonly name: string }[] {
  return classifiableIraAccounts(plan)
    .filter((account) => iraClassificationFor(plan, account.id) === null)
    .map((account) => ({ id: account.id, name: account.name }))
}
