/**
 * Non-component helpers shared by the plan entry sections (kept out of the
 * component files so react-refresh sees component-only modules).
 */

import type { Account, AllocationWeights, Plan } from '@retiregolden/engine/model/plan'
import {
  latestNonQlacQualifiedAnnuityStartAge,
  latestQlacAnnuityStartAge,
} from '@retiregolden/engine/model/plan'

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

/** Both ceilings a qualified annuity purchase can be under, and which one binds. */
export interface AnnuityStartAgeBounds {
  /** The ceiling that binds the contract as it is stored right now. */
  readonly binding: number
  /**
   * The ceiling the SAME contract would be under with the QLAC box toggled the
   * other way. Never null: every qualified purchase has both shapes available
   * to it, which is exactly why a household needs to be told which one is
   * better before they reach for the box.
   */
  readonly ifToggled: number
  /** Whether `binding` is the QLAC ceiling — i.e. whether the box is ticked. */
  readonly isQlac: boolean
}

/**
 * Both bounds on a purchased annuity's start age, or null where neither rule
 * reaches it.
 *
 * A qualified purchase is under one of two ceilings and the QLAC box decides
 * which. Without the box, only a contract commencing by the owner's required
 * beginning date is permitted (Treas. Reg. 1.401(a)(9)-6(a)(3)(i), excused by
 * (q)(1)(iii) for a QLAC alone). With it, that excuse is granted but (q)(1)(ii)
 * substitutes its own ceiling: the contract must commence no later than the
 * first day of the month after the owner's 85th birthday.
 *
 * BOTH are returned, not just the binding one, because NEITHER CEILING IS
 * RELIABLY THE HIGHER OF THE TWO and every sentence the editor writes about the
 * box depends on which way round they are for this owner. The required-
 * beginning-date ceiling is the later of the applicable RMD age plus one and
 * the owner's age in the purchase year, so for a household that annuitizes late
 * it climbs with the purchase — an owner buying at 90 may hold a contract
 * starting at 90 without the box, and ticking it would LOWER their ceiling to
 * 85. Copy that tells them to tick the box to start later is then simply wrong,
 * which is the same interplay the engine's two refusal messages are derived
 * from. One seam, so the editor and the parse cannot drift apart.
 *
 * A non-qualified purchase is not reached by section 401(a)(9), and an
 * already-owned annuity moves no premium out of a pre-tax balance, so neither
 * is bounded here.
 */
export function annuityStartAgeBounds(plan: Plan, account: Account): AnnuityStartAgeBounds | null {
  if (account.type !== 'annuity') return null
  const purchase = account.purchase
  if (purchase === undefined || purchase.taxQualification !== 'qualified') return null
  // Same owner resolution the engine takes: an annuity may carry no individual
  // owner, and the projection reads it as the first person's.
  const owner =
    plan.household.people.find((p) => p.id === account.ownerPersonId) ?? plan.household.people[0]
  if (owner === undefined) return null
  const birthYear = Number(owner.dob.slice(0, 4))
  const birthMonth = Number(owner.dob.slice(5, 7))
  if (!Number.isFinite(birthYear) || !Number.isFinite(birthMonth)) return null
  // The schema caps every annuity start age at 95, QLAC or not, so each binding
  // ceiling is the lower of the regulatory one and the schema's: a computed
  // ceiling past 95 must not raise the field's max, and returning null there
  // would switch the commit-time clamp off exactly where it should bind at 95.
  // The capped pair is also what the copy has to compare — offering a toggle
  // that reaches 97 when the field stops at 95 offers nothing.
  const qlac = Math.min(latestQlacAnnuityStartAge(birthMonth), 95)
  const nonQlac = Math.min(latestNonQlacQualifiedAnnuityStartAge(birthYear, purchase.year), 95)
  const isQlac = purchase.qlac === true
  return {
    binding: isQlac ? qlac : nonQlac,
    ifToggled: isQlac ? nonQlac : qlac,
    isQlac,
  }
}

/**
 * The highest start age a purchased annuity may carry, or null where the rule
 * does not reach it. The binding half of `annuityStartAgeBounds`, kept as its
 * own name because the number field's `max` and the commit clamp want only that.
 */
export function annuityStartAgeCeiling(plan: Plan, account: Account): number | null {
  return annuityStartAgeBounds(plan, account)?.binding ?? null
}

/**
 * What the Start age field says under itself, or undefined where no bound
 * applies and there is nothing to explain.
 *
 * Four sentences, because there are four true situations and the two that name
 * the QLAC box as a way to START LATER are only true half the time. Whether the
 * box raises or lowers this owner's ceiling is a fact about their birth year and
 * their purchase year, so the copy is derived from the two ceilings rather than
 * asserted — the same derivation the engine's refusal messages take, and the
 * reason both live off one seam. Where the box would not help, the copy says so
 * and gives the number, because a household sent to tick a box that refuses them
 * has been told less than nothing.
 */
export function annuityStartAgeHelp(bounds: AnnuityStartAgeBounds | null): string | undefined {
  if (bounds === null) return undefined
  const { binding, ifToggled, isQlac } = bounds
  const helps = ifToggled > binding
  if (isQlac) {
    return helps
      ? `A QLAC has to start paying by age ${binding}. To start later than that, untick "QLAC (qualified longevity annuity)" below — bought this late, an ordinary pre-tax purchase may start as late as age ${ifToggled}.`
      : `A QLAC has to start paying by age ${binding}. Unticking "QLAC (qualified longevity annuity)" below would not buy a later start: a pre-tax purchase that is not a QLAC has to start by age ${ifToggled}.`
  }
  return helps
    ? `A pre-tax annuity purchase has to start paying by age ${binding}. To start later than that, tick "QLAC (qualified longevity annuity)" below — a QLAC is the only kind of deferred annuity the IRA rules allow, and it has to start by age ${ifToggled}.`
    : `A pre-tax annuity purchase has to start paying by age ${binding}. Ticking "QLAC (qualified longevity annuity)" below would not buy a later start: a QLAC has to start by age ${ifToggled}.`
}

/**
 * The start age an edit has to store instead of the one it asks for, or null
 * when the requested age already fits.
 *
 * Takes the account AS THE EDIT WOULD LEAVE IT, so every field that can move
 * the ceiling asks the same question: the typed start age itself, the purchase
 * (a qualified switch, a ticked or cleared QLAC box, an earlier purchase year),
 * and the owner, whose birth year decides the applicable RMD age and whose birth
 * month decides whether the QLAC ceiling is 85 or 86. Bounding the age field's
 * `max` is not enough on its own — a `max` is what the stepper honours, not what
 * a typed value or an edit to some other field is held to, and the plan that
 * results is one the engine refuses at save with no field showing the fault.
 */
export function clampedAnnuityStartAge(plan: Plan, account: Account): number | null {
  if (account.type !== 'annuity') return null
  const ceiling = annuityStartAgeCeiling(plan, account)
  if (ceiling === null) return null
  return account.startAge > ceiling ? ceiling : null
}
