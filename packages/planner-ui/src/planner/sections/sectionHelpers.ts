/**
 * Non-component helpers shared by the plan entry sections (kept out of the
 * component files so react-refresh sees component-only modules).
 */

import type { Account, AllocationWeights, Plan } from '@retiregolden/engine/model/plan'
import { latestNonQlacQualifiedAnnuityStartAge } from '@retiregolden/engine/model/plan'

export const newId = () => crypto.randomUUID()

export const MONTH_OPTIONS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
].map((label, i) => ({ value: String(i + 1), label }))

export function isIndividuallyOwnedAccount(type: Account['type']): boolean {
  return type === 'traditional' || type === 'roth' || type === 'hsa'
}

export const ACCOUNT_LABEL: Record<Account['type'], string> = {
  cash: 'Cash',
  taxable: 'Brokerage',
  equityComp: 'Equity comp',
  traditional: 'Traditional',
  roth: 'Roth',
  hsa: 'HSA',
  pension: 'Pension',
  annuity: 'Annuity',
  property: 'Property',
  debt: 'Debt',
}

export type AllocatableAccount = Extract<Account, { type: 'taxable' | 'traditional' | 'roth' | 'hsa' }>

export const EVEN_START_WEIGHTS: AllocationWeights = { usStocks: 60, intlStocks: 10, bonds: 25, cash: 5 }

export function isAllocatable(account: Account): account is AllocatableAccount {
  return account.type === 'taxable' || account.type === 'traditional' || account.type === 'roth' || account.type === 'hsa'
}

/**
 * The highest start age a purchased annuity may carry, or null where the rule
 * does not reach it.
 *
 * Only a QLAC may commence after its owner's required beginning date (Treas.
 * Reg. 1.401(a)(9)-6(a)(3)(i), excused by (q)(1)(iii) for a QLAC alone), and the
 * engine refuses the shape at parse. Bound the field rather than letting the
 * household author a plan that will not store — the same treatment the lump-sum
 * election year got. A non-qualified purchase is not reached by section
 * 401(a)(9), and an already-owned annuity moves no premium out of a pre-tax
 * balance, so neither is bounded here.
 */
export function annuityStartAgeCeiling(plan: Plan, account: Account): number | null {
  if (account.type !== 'annuity') return null
  const purchase = account.purchase
  if (purchase === undefined || purchase.taxQualification !== 'qualified' || purchase.qlac === true) {
    return null
  }
  // Same owner resolution the engine takes: an annuity may carry no individual
  // owner, and the projection reads it as the first person's.
  const owner =
    plan.household.people.find((p) => p.id === account.ownerPersonId) ?? plan.household.people[0]
  if (owner === undefined) return null
  const birthYear = Number(owner.dob.slice(0, 4))
  if (!Number.isFinite(birthYear)) return null
  // The schema caps every annuity start age at 95, QLAC or not, so a computed
  // ceiling past it is non-binding here: the field's own schema max governs,
  // and returning a ceiling above it would let the editor offer ages the plan
  // cannot store.
  const ceiling = latestNonQlacQualifiedAnnuityStartAge(birthYear, purchase.year)
  return ceiling >= 95 ? null : ceiling
}

/**
 * The start age an edit has to store instead of the one it asks for, or null
 * when the requested age already fits.
 *
 * Takes the account AS THE EDIT WOULD LEAVE IT, so every field that can move
 * the ceiling asks the same question: the typed start age itself, the purchase
 * (a qualified switch, a cleared QLAC box, an earlier purchase year), and the
 * owner, whose birth year decides the applicable RMD age and therefore the
 * ceiling. Bounding the age field's `max` is not enough on its own — a `max`
 * is what the stepper honours, not what a typed value or an edit to some other
 * field is held to, and the plan that results is one the engine refuses at
 * save with no field showing the fault.
 */
export function clampedAnnuityStartAge(plan: Plan, account: Account): number | null {
  if (account.type !== 'annuity') return null
  const ceiling = annuityStartAgeCeiling(plan, account)
  if (ceiling === null) return null
  return account.startAge > ceiling ? ceiling : null
}
