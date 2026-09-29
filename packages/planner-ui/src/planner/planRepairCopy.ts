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

/** Lead paragraph above the per-repair list, for repairs of details the app no longer accepts. */
export const PLAN_REPAIR_NOTICE_INTRO =
  'This plan was stored with details the app no longer accepts. It opened with the changes below so you can see what is different and decide what to do. Nothing else in your plan was changed.'

/**
 * Lead paragraph when every repair is the v5 -> v6 handling of a library
 * example's premium tax credit details. Those details were not refused: the
 * app stores an example's credit details differently now, and the plan
 * opened in the new form (PR #761 review 8).
 */
export const PLAN_REPAIR_NOTICE_EXAMPLE_INTRO =
  "This plan came from a library example, and the app now handles an example's premium tax credit details differently. The plan opened in the new form, as described below. Nothing else in your plan was changed."

/** Lead paragraph when a plan has both kinds of repair. */
export const PLAN_REPAIR_NOTICE_MIXED_INTRO =
  "This plan was stored with details the app no longer accepts, and it came from a library example, whose premium tax credit details the app now handles differently. It opened with the changes below so you can see what is different and decide what to do. Nothing else in your plan was changed."

/** The repairs that are the v5 -> v6 handling of an example's credit details, not a refusal. */
const EXAMPLE_CONTRACT_REPAIR_KINDS: ReadonlySet<PlanLoadRepair['kind']> = new Set<PlanLoadRepair['kind']>([
  'exampleContractsFollowPremiumField',
  'exampleContractsLeftOut',
  'exampleEnteredContractsNowPriced',
])

/** The notice's lead paragraph for these repairs. */
export function planRepairNoticeIntro(repairs: readonly PlanLoadRepair[]): string {
  const example = repairs.filter((repair) => EXAMPLE_CONTRACT_REPAIR_KINDS.has(repair.kind)).length
  if (example === 0) return PLAN_REPAIR_NOTICE_INTRO
  return example === repairs.length ? PLAN_REPAIR_NOTICE_EXAMPLE_INTRO : PLAN_REPAIR_NOTICE_MIXED_INTRO
}

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

/**
 * The v5 -> v6 rewrite of an example's premium-credit contracts (decision
 * D-EXAMPLE-SOURCE-SWITCH): what the plan carried, what it carries now, and
 * what that changes. A plan saved from an example (Save to My Plans,
 * Duplicate, an import) is the household's copy; the library's own demo
 * record (`origin: 'example'`, review finding L8) is the example itself,
 * stored in this browser before the change, and is described as that.
 */
/** "2026", or "3 years from 2026 to 2028". */
function repairYears(repair: { contractCount: number; firstYear: number; lastYear: number }): string {
  return repair.contractCount === 1
    ? `${repair.firstYear}`
    : `${repair.contractCount} years from ${repair.firstYear} to ${repair.lastYear}`
}

/** 'the scenario "Name"', for a repair of the contracts a stored scenario writes. */
function scenarioLabel(scenario: { name: string }): string {
  return scenario.name.trim().length > 0 ? `The scenario “${scenario.name}”` : 'A saved scenario'
}

function exampleContractsMessage(
  repair: Extract<PlanLoadRepair, { kind: 'exampleContractsFollowPremiumField' }>,
  plan: Plan,
): string {
  const years = repairYears(repair)
  const follows =
    "each year's premium is that amount grown with healthcare inflation, worked out again on every run, including each simulated market in Monte Carlo. Changing the premium now reprices the credit rather than removing it. Open Spending to see the premium."
  if (repair.scenario !== undefined) {
    return `${scenarioLabel(repair.scenario)} wrote the example's premium tax credit details for ${years} as fixed amounts. Those years now follow the scenario's pre-65 premium, as the example itself does: each year's premium is that amount grown with healthcare inflation, worked out again on every run, including each simulated market in Monte Carlo.`
  }
  if (plan.origin === 'example') {
    return `This copy of the library example was stored in this browser with its premium tax credit details for ${years} written in as fixed amounts. Those years now follow the example's pre-65 premium, as the library's current version does: ${follows}`
  }
  return `This plan was saved from a library example and carried the example's premium tax credit details for ${years}, with each year's Marketplace premium written in as a fixed amount. Those years now follow the plan's pre-65 premium instead, as the example itself does: ${follows}`
}

/**
 * The v5 -> v6 removal of an example's premium-credit contracts that no longer
 * matched the plan's premium (PR #761 review 2): the v5 engine was already
 * leaving them out, so the figures do not change, and the notice says so.
 */
function exampleContractsLeftOutMessage(
  repair: Extract<PlanLoadRepair, { kind: 'exampleContractsLeftOut' }>,
  plan: Plan,
): string {
  const years = repairYears(repair)
  if (repair.scenario !== undefined) {
    return `${scenarioLabel(repair.scenario)} wrote the example's premium tax credit details for ${years}, and they no longer matched the scenario's pre-65 premium, so the planner was already leaving them out and counting no credit in those years. They have been removed from the scenario, and none of its figures change.`
  }
  const copy = plan.origin === 'example' ? 'This copy of the library example was stored in this browser with' : 'This plan was saved from a library example and carried'
  return `${copy} the example's premium tax credit details for ${years}, and they no longer matched the plan's pre-65 premium, so the planner was already leaving them out and counting no credit in those years. They have been removed, and none of the plan's figures change. The credit in those years is not counted until the planner has details for them.`
}

/**
 * Premium-credit details entered for a plan saved from an example (not the
 * example's own) that the v5 engine refused because they did not match the
 * example's premium: v6 prices them as entered, so the figures of those years
 * change, and the notice says so (PR #761 follow-up a).
 */
function exampleEnteredContractsMessage(
  repair: Extract<PlanLoadRepair, { kind: 'exampleEnteredContractsNowPriced' }>,
  plan: Plan,
): string {
  const years = repairYears(repair)
  const refused =
    "They did not match the example's pre-65 premium, so the planner was leaving them out and counting no credit in those years."
  if (repair.scenario !== undefined) {
    return `${scenarioLabel(repair.scenario)} writes premium tax credit details for ${years} that were entered for it, not written by the example. ${refused} They are now priced as entered, so the scenario's figures change.`
  }
  const copy = plan.origin === 'example' ? 'This copy of the library example stored in this browser carries' : 'This plan was saved from a library example and carries'
  return `${copy} premium tax credit details for ${years} that were entered for it, not written by the example. ${refused} They are now priced as entered, so the credit in those years, and your plan's figures, change.`
}

/** One repair, as a paragraph for the household. */
export function planRepairMessage(repair: PlanLoadRepair, plan: Plan): string {
  if (repair.kind === 'exampleContractsFollowPremiumField') return exampleContractsMessage(repair, plan)
  if (repair.kind === 'exampleContractsLeftOut') return exampleContractsLeftOutMessage(repair, plan)
  if (repair.kind === 'exampleEnteredContractsNowPriced') return exampleEnteredContractsMessage(repair, plan)
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
    // The two start-age stand-downs, and the one sentence they share: whether
    // the OTHER purchase shape would have kept the start age the household
    // stored. It is a real question rather than a rhetorical one, because the
    // two ceilings do not order the same way for every owner — a QLAC's is
    // fixed at 85 (86 for a December birth) while an ordinary purchase's climbs
    // with the purchase year, so for a late annuitizer the QLAC box LOWERS what
    // is allowed. Naming a shape that would refuse the same age is worse than
    // naming none, so both messages are derived from the pair of ceilings the
    // repair carries rather than asserting which box is the generous one.
    case 'deferredAnnuityPurchaseStoodDown':
      return repair.startAge <= repair.latestPermittedStartAgeIfToggled
        ? `${account} was bought with pre-tax money and set to start paying at age ${repair.startAge}. Only a QLAC can start that late; a purchase like this one has to start by age ${repair.latestPermittedStartAge}. The purchase was cleared and ${account} pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age, or to buy it as a QLAC.`
        : `${account} was bought with pre-tax money and set to start paying at age ${repair.startAge}. A purchase like this one has to start by age ${repair.latestPermittedStartAge}, and buying it as a QLAC would not keep the later start either: a QLAC has to start by age ${repair.latestPermittedStartAgeIfToggled}. No pre-tax purchase can wait until ${repair.startAge}. The purchase was cleared and ${account} pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age.`
    case 'qlacPurchaseStoodDown':
      return repair.startAge <= repair.latestPermittedStartAgeIfToggled
        ? `${account} was bought as a QLAC and set to start paying at age ${repair.startAge}. A QLAC has to start by age ${repair.latestPermittedStartAge}; the IRA rules put the last start on the first of the month after your 85th birthday. Bought as late as this one was, an ordinary pre-tax purchase could still start at ${repair.startAge}. The purchase was cleared and ${account} pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age, or without the QLAC box ticked.`
        : `${account} was bought as a QLAC and set to start paying at age ${repair.startAge}. A QLAC is the longest a pre-tax purchase can wait, but it still has to start by age ${repair.latestPermittedStartAge}; the IRA rules put the last start on the first of the month after your 85th birthday. The purchase was cleared and ${account} pays nothing, so the premium stayed in the account it would have come from. Open Accounts to set it up again with an earlier start age.`
    // The account and insurance lists never show ids, so the copy speaks of an
    // internal reference. What the collision did depends on the pair: a cash
    // account and a property (the pair plans accepted) reported the property's
    // value as cash; two rows of the same kind kept one value, so one of them
    // dropped out of the totals; two rows of different kinds kept both in the
    // totals but showed one in place of the other in the year-by-year
    // balances; and two LTC policies counted their benefit years together.
    case 'sharedIdSeparated': {
      if (repair.renamedType === 'property' && repair.keptType === 'cash') {
        const cash = repair.keptName.trim().length > 0
          ? `the cash account ${repair.keptName}`
          : 'a cash account'
        return `${named(repair.accountName, 'A property')} and ${cash} were stored under one internal reference, so the plan showed the property's value as cash. The property now has a reference of its own. Its value and the cash balance are as you entered them, and cash totals no longer include the property. Open Accounts to check both.`
      }
      const renamedIsPolicy = repair.renamedType === 'permanentLife' || repair.renamedType === 'ltc'
      const keptIsPolicy = repair.keptType === 'permanentLife' || repair.keptType === 'ltc'
      const noun = repair.renamedType === 'property' ? 'property' : repair.renamedType === 'debt' ? 'debt' : 'policy'
      const renamed = named(repair.accountName, noun === 'property' ? 'A property' : noun === 'debt' ? 'A debt' : 'An insurance policy')
      const kept = named(repair.keptName, keptIsPolicy ? 'another policy' : 'another account')
      const page = !renamedIsPolicy ? 'Accounts' : keptIsPolicy ? 'Insurance' : 'Accounts and Insurance'
      const effect = repair.renamedType === 'ltc'
        ? 'so the plan counted their benefit years together, and a year one policy paid used up a year of the other'
        : repair.renamedType === repair.keptType
          ? 'so the plan kept one value for the two and left the other out of your totals'
          : 'so the plan showed one in place of the other in your year-by-year balances'
      return `${renamed} and ${kept} were stored under one internal reference, ${effect}. The ${noun} now has a reference of its own, and both are as you entered them. Open ${page} to check both.`
    }
  }
}
