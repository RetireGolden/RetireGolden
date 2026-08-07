/**
 * What to say about a load-time plan repair.
 *
 * The engine reports repairs as facts (`PlanLoadRepair`: a stable kind plus the
 * account ids and names it touched) and deliberately holds no sentences. This
 * module is the only place those facts become English, so the workspace notice
 * and any test of it read the same words.
 *
 * Two of these repairs leave no trace in the projection at all: a lump-sum
 * election for a future year never fired, and the annuity retarget changes only
 * which balance the premium leaves. A household whose stored document was
 * repaired therefore has no other way to find out, which is what this copy is
 * for. Each message states what was on record, what changed, and where the
 * household can change it back or set it up differently. None of them says what
 * the household should choose.
 */

import type { PlanLoadRepair } from '@retiregolden/engine/model/migrations'
import type { Plan } from '@retiregolden/engine/model/plan'

/** Heading on the workspace notice. */
export const PLAN_REPAIR_NOTICE_TITLE = 'This plan changed when it opened'

/** Lead paragraph above the per-repair list. */
export const PLAN_REPAIR_NOTICE_INTRO =
  'This plan was stored with details the app no longer accepts. It opened with the changes below so you can see what is different and decide what to do. Nothing else in your plan was changed.'

/** Label on the control that closes the notice. */
export const PLAN_REPAIR_NOTICE_DISMISS = 'Dismiss'

/** A stored name, or a neutral stand-in when the document carried none. */
function named(value: string, fallback: string): string {
  return value.trim().length > 0 ? value : fallback
}

/** The person the back-filled owner points at, by name where the plan has one. */
function ownerName(plan: Plan, personId: string): string {
  const person = plan.household.people.find((p) => p.id === personId)
  return person ? person.name : 'the first person in your household'
}

/** One repair, as a paragraph for the household. */
export function planRepairMessage(repair: PlanLoadRepair, plan: Plan): string {
  const account = named(repair.accountName, 'An account')
  switch (repair.kind) {
    case 'accountOwnerBackFilled':
      return `${account} was stored without an owner, and it is now owned by ${ownerName(plan, repair.ownerPersonId)}. Open Accounts to assign it to someone else.`
    case 'lumpSumElectionDroppedElectionYearPassed':
      return `${account} was set to take its lump sum in ${repair.electionYear}, and that year has already passed. The election was cleared and the lump-sum offer is still on record. Open Accounts to take the lump sum in a year that has not passed, or leave the pension paying its annuity.`
    case 'lumpSumElectionDroppedUnreadableSaveDate':
      return `${account} was set to take its lump sum. The date this plan was last saved could not be read, so the app could not tell whether the election year had already passed. The election was cleared and the lump-sum offer is still on record. Saving this plan writes a fresh date, and you can set the election again from Accounts.`
    case 'lumpSumElectionDroppedInheritedTarget':
      return `${account} was set to roll its lump sum into ${named(repair.targetAccountName, 'an inherited account')}, which is inherited. An inherited account cannot receive a pension rollover. The election was cleared and the lump-sum offer is still on record. Open Accounts to roll it into a traditional account you own.`
    case 'lumpSumElectionDroppedTargetUnavailable':
      return repair.targetAccountName !== null && repair.targetAccountName.trim().length > 0
        ? `${account} was set to roll its lump sum into ${repair.targetAccountName}, and that is not an account this plan can pay a rollover into. The election was cleared and the lump-sum offer is still on record. Open Accounts to roll it into a traditional account you own.`
        : `${account} was set to roll its lump sum into an account this plan no longer holds. The election was cleared and the lump-sum offer is still on record. Open Accounts to roll it into a traditional account you own.`
    case 'annuityPremiumRetargeted':
      return `${account} was bought with a premium from ${named(repair.fromAccountName, 'an inherited account')}, which is inherited. An inherited account cannot fund an annuity purchase, so the premium now comes from ${named(repair.toAccountName, 'a traditional account you own')}. The purchase year, the premium, and its pre-tax treatment are unchanged. Open Accounts to fund it from a different account you own.`
    case 'annuityPurchaseStoodDown':
      return `${account} was bought with a premium from ${named(repair.fromAccountName, 'an inherited account')}, which is inherited. An inherited account cannot fund an annuity purchase, and this plan holds no traditional account you own that could have paid the premium instead. The purchase was cleared and ${account} pays nothing. Open Accounts to add the account the premium came from, then set the purchase up again.`
    case 'deferredAnnuityPurchaseStoodDown':
      return `${account} was bought with pre-tax money and set to start paying at age ${repair.startAge}. Only a QLAC can start that late; a purchase like this one has to start by age ${repair.latestPermittedStartAge}. The purchase was cleared and ${account} pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age, or to buy it as a QLAC.`
    case 'qlacPurchaseStoodDown':
      return `${account} was bought as a QLAC and set to start paying at age ${repair.startAge}. A QLAC is the longest a pre-tax purchase can wait, but it still has to start by age ${repair.latestPermittedStartAge} — the IRA rules put the last start on the first of the month after your 85th birthday. The purchase was cleared and ${account} pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age.`
  }
}
