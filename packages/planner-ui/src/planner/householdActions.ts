/** Pure plan mutations for household edits (kept out of the component file so
 *  they're testable and don't trip react-refresh's only-export-components rule). */

import {
  clearRetirementActionAnnualTaxFactsForOwners,
  type Plan,
} from '@retiregolden/engine/model/plan'
import { removeStaleAcaContracts, type AcaContractRemovalEdit } from '@retiregolden/engine/model/acaContractRemovals'
import { clearDonorEligibilityFacts } from './eligibilityFactActions'

/**
 * Remove the annual premium-credit (ACA) contracts an edit leaves stale, and
 * record which edit removed them for which years, so the planner can name the
 * edit when it says why a year's credit is not counted (the engine's
 * `removeStaleAcaContracts`; decision D-EXAMPLE-SOURCE-SWITCH, review finding
 * M2). A partner added or removed, or a new filing status, removes every
 * contract, because a contract's stored assertions are facts about who is on
 * the return. A state, move, date-of-birth, planning-age or premium edit
 * removes only the 'stated' contracts, whose roster and premiums are written
 * figures; a 'premiumField' contract (every library example's, and every plan
 * saved from one) derives its region, family, members and premiums from the
 * household and the premium field on each run, so it stays and the credit is
 * priced on the edited plan.
 */
export function invalidateAcaEvidence(d: Plan, edit: AcaContractRemovalEdit) {
  removeStaleAcaContracts(d.expenses.healthcare, edit)
}

/** Apply a planning-horizon change and clear the stated annual ACA evidence
 * whose living tax-family and coverage roster may no longer match the plan
 * horizon (premium-field contracts are derived from it and stay). */
export function updatePersonLongevity(
  d: Plan,
  personIndex: number,
  longevity: Plan['household']['people'][number]['longevity'],
) {
  d.household.people[personIndex]!.longevity = longevity
  invalidateAcaEvidence(d, 'householdChanged')
}

/**
 * Add a partner to a one-person plan. The choices the plan used to leave to
 * list order stay with the person already there (schema v7, decision
 * D-PEOPLE-ORDER): the spending phases and every joint account's
 * contribution schedule keep following that person's age, so adding a
 * partner moves neither. Pure mutator.
 */
export function addPartner(d: Plan, partner: Plan['household']['people'][number]) {
  const existing = d.household.people[0]
  d.household.people.push(partner)
  d.household.filingStatus = 'marriedFilingJointly'
  if (existing !== undefined) {
    if (d.expenses.phasesAgeOf === undefined) d.expenses.phasesAgeOf = existing.id
    for (const account of d.accounts) {
      if (
        (account.type === 'cash' || account.type === 'taxable' || account.type === 'equityComp') &&
        account.ownerPersonId === null &&
        (account.contributionSchedule?.length ?? 0) > 0 &&
        account.contributionScheduleAgeOf === undefined
      ) {
        account.contributionScheduleAgeOf = existing.id
      }
    }
  }
  invalidateAcaEvidence(d, 'partnerAdded')
}

/**
 * Remove a partner and re-home everything that referenced them so the plan stays
 * valid: accounts move to the primary, the removed person's incomes, policies,
 * and donor-bound eligibility facts drop, and any permanent-life beneficiary
 * pointing at them falls back to the estate. Pure mutator (works on an Immer
 * draft or a plain Plan).
 */
export function removePartner(d: Plan, removedId: string) {
  d.household.people = d.household.people.filter((p) => p.id !== removedId)
  d.household.filingStatus = 'single'
  const primaryId = d.household.people[0]!.id
  d.accounts = d.accounts.map((a) => (a.ownerPersonId === removedId ? { ...a, ownerPersonId: primaryId } : a))
  // Whose age the phases and joint schedules follow: the one person left. An
  // account with an owner follows its owner's age and names no one (the
  // schema refuses the field there, as nameContributionSchedulePerson clears
  // it), so a stray name is cleared rather than re-pointed (round-one review
  // of #765, issue 15).
  if (d.expenses.phasesAgeOf !== undefined) d.expenses.phasesAgeOf = primaryId
  for (const account of d.accounts) {
    if (!('contributionScheduleAgeOf' in account) || account.contributionScheduleAgeOf === undefined) continue
    if (account.ownerPersonId !== null) Reflect.deleteProperty(account, 'contributionScheduleAgeOf')
    else account.contributionScheduleAgeOf = primaryId
  }
  d.incomes = d.incomes.filter((s) => !('personId' in s) || s.personId !== removedId)
  d.insurance = d.insurance
    .filter((p) => (p.kind === 'ltc' ? p.owner : p.insured) !== removedId)
    .map((p) => (p.kind === 'permanentLife' && p.beneficiary === removedId ? { ...p, beneficiary: 'estate' as const } : p))
  d.careEvents = d.careEvents.filter((c) => c.personId !== removedId)
  clearDonorEligibilityFacts(d, removedId)
  clearRetirementActionAnnualTaxFactsForOwners(d, [removedId, primaryId])
  // Annual ACA evidence asserts facts about who is on the return (and a stated
  // contract names the roster). Neither holds once a household member is
  // removed; clearing it makes a still-enabled ACA request fail closed to the
  // visible gross premium until fresh evidence is supplied, and the planner
  // says the partner's removal is why.
  invalidateAcaEvidence(d, 'partnerRemoved')
}
