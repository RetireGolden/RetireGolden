/** Pure plan mutations for household edits (kept out of the component file so
 *  they're testable and don't trip react-refresh's only-export-components rule). */

import type { Plan } from '@retiregolden/engine/model/plan'

/**
 * Remove a partner and re-home everything that referenced them so the plan stays
 * valid: accounts move to the primary, the removed person's incomes and policies
 * drop, and any permanent-life beneficiary pointing at them falls back to the
 * estate. Pure mutator (works on an Immer draft or a plain Plan).
 */
export function removePartner(d: Plan, removedId: string) {
  d.household.people = d.household.people.filter((p) => p.id !== removedId)
  d.household.filingStatus = 'single'
  const primaryId = d.household.people[0]!.id
  d.accounts = d.accounts.map((a) => (a.ownerPersonId === removedId ? { ...a, ownerPersonId: primaryId } : a))
  d.incomes = d.incomes.filter((s) => !('personId' in s) || s.personId !== removedId)
  d.insurance = d.insurance
    .filter((p) => (p.kind === 'ltc' ? p.owner : p.insured) !== removedId)
    .map((p) => (p.kind === 'permanentLife' && p.beneficiary === removedId ? { ...p, beneficiary: 'estate' as const } : p))
  d.careEvents = d.careEvents.filter((c) => c.personId !== removedId)
}
