/**
 * Whether the Strategy screen's Retirement actions card mounts, and why. The
 * card is a lazy chunk; this predicate is the small, eager piece the rest of
 * the Strategy screen can share, so no copy refers to a card that is not on
 * the page (#518).
 */

import type { Plan } from '@retiregolden/engine/model/plan'

import { classifiableIraAccounts, contributionDonors } from './retirementActionEligibilityFacts'
import { migratedRetirementActionsNeedingReview } from './retirementActionManualEditor'
import { namedQcdActions } from './retirementActionQcdSchedule'

export interface RetirementActionsCardParts {
  /** Migrated aggregate actions still awaiting source review. */
  actions: ReturnType<typeof migratedRetirementActionsNeedingReview>
  /** The plan has an IRA to classify or a contribution donor to record. */
  hasFacts: boolean
  /** The plan carries at least one scheduled charitable gift from an IRA. */
  hasGifts: boolean
  /** The card mounts whenever any of the three has something to show. */
  mounts: boolean
}

export function retirementActionsCardParts(plan: Readonly<Plan>, startYear: number): RetirementActionsCardParts {
  const actions = migratedRetirementActionsNeedingReview(plan)
  const hasFacts = classifiableIraAccounts(plan).length > 0 || contributionDonors(plan, startYear).length > 0
  const hasGifts = namedQcdActions(plan).length > 0
  return { actions, hasFacts, hasGifts, mounts: actions.length > 0 || hasFacts || hasGifts }
}
