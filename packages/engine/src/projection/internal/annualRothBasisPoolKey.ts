import type { Account } from '../../model/plan.js'

/** Resolve the annual Roth-basis pool shared by conversion and withdrawal phases. */
export function annualRothBasisPoolKey(
  account: Readonly<Extract<Account, { type: 'roth' }>>,
  defaultOwnerPersonId: string,
): string {
  return account.kind === 'ira'
    ? `rothira:${account.ownerPersonId ?? defaultOwnerPersonId}`
    : `roth:${account.id}`
}

/**
 * Whether a pool key names an owner's Roth IRA pool (`rothira:`), the only
 * pool that carries the owner's 26 U.S.C. 408A(d)(2)(B) five-year period. A
 * designated Roth pool (`roth:`) carries none: its own per-plan period under
 * 402A(d)(2)(B) is not modeled (irc-402A-d-2-designated-roth-five-year-period).
 */
export function isRothIraPoolKey(key: string): boolean {
  return key.startsWith('rothira:')
}
